import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCachedUser } from "@/lib/userCache";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { renumberClientInvoices, isAutoRenumberingEnabled } from "@/app/utils/invoiceRenumbering";
import { 
  validatePagination, 
  validateCursorPagination,
  generateCursor,
  createSafeSearchConditions, 
  validateDate, 
  validateInvoiceStatus,
  sanitizeString 
} from "@/lib/validation";
import { applyRateLimit, createRateLimitResponse } from "@/lib/rateLimiter";
import { performanceMiddleware, trackDbQuery } from "@/lib/performanceMonitor";
import { securityMiddleware, securityAudit, SecurityEventTypes, RiskLevels } from "@/lib/securityAudit";
import { logErrorWithMonitoring, AppError, ErrorTypes } from "@/lib/errorHandler";

const DEFAULT_PAGE_SIZE = 5;

export async function GET(request) {
  // Start performance monitoring
  const perfTracker = performanceMiddleware(request);
  let user = null;

  try {
    // Security middleware check
    const securityCheck = securityMiddleware(request);
    if (securityCheck.hasIssues && securityCheck.riskLevel === RiskLevels.HIGH) {
      securityAudit.logSecurityEvent(
        SecurityEventTypes.SUSPICIOUS_REQUEST,
        RiskLevels.HIGH,
        { issues: securityCheck.issues },
        request
      );
      perfTracker.end(403, 0);
      return NextResponse.json(
        { error: 'Request blocked for security reasons' },
        { status: 403 }
      );
    }

    const { userId } = await auth();

    if (!userId) {
      perfTracker.end(401, 0);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    // Search parameters (validated below)
    const searchTerm = searchParams.get("search");
    const searchDate = searchParams.get("date");
    const searchStatus = searchParams.get("status");

    // A new filtered query (page 1) uses the stricter 'search' bucket; further
    // pages of it (infinite scroll, 5 at a time) and plain lists use 'read'.
    // Keyed per user.
    const requestedPage = Number(searchParams.get("page") || "1");
    const isNewFilteredQuery = Boolean(searchTerm || searchDate || searchStatus) && requestedPage <= 1;
    const rateLimitType = isNewFilteredQuery ? 'search' : 'read';
    const rateLimitResult = applyRateLimit(request, rateLimitType, userId);
    if (rateLimitResult.isLimited) {
      perfTracker.end(429, 0);
      return createRateLimitResponse(rateLimitResult);
    }

    const clientId = sanitizeString(searchParams.get("clientId"));
    const useCursor = searchParams.get("cursor") !== null || searchParams.get("use_cursor") === "true";

    // Validate pagination parameters
    let page, limit, offset, cursor;
    if (useCursor) {
      const cursorPagination = validateCursorPagination(
        searchParams.get("cursor"),
        searchParams.get("limit") ?? DEFAULT_PAGE_SIZE,
        20 // Max 20 invoices per page
      );
      cursor = cursorPagination.cursor;
      limit = cursorPagination.limit;
    } else {
      const offsetPagination = validatePagination(
        searchParams.get("page"),
        searchParams.get("limit") ?? DEFAULT_PAGE_SIZE,
        20 // Max 20 invoices per page
      );
      page = offsetPagination.page;
      limit = offsetPagination.limit;
      offset = offsetPagination.offset;
    }

    if (!clientId) {
      perfTracker.end(400, 0);
      return NextResponse.json(
        { error: "Client ID is required" },
        { status: 400 }
      );
    }

    // Validate client ID format
    if (!/^[a-zA-Z0-9_-]+$/.test(clientId)) {
      perfTracker.end(400, 0);
      return NextResponse.json(
        { error: "Invalid client ID format" },
        { status: 400 }
      );
    }

    // Use cached user lookup to reduce database queries
    user = await getCachedUser(userId);

    // Build base where clause
    const whereClause = {
      clientId: clientId,
      userId: user.id,
      ...(useCursor && cursor && { id: { lt: cursor } }) // Add cursor condition for cursor-based pagination
    };

    // Build search conditions array
    const searchConditions = [];

    // Add safe search term condition
    if (searchTerm) {
      const searchCondition = createSafeSearchConditions(searchTerm, ['invoiceNumber']);
      if (searchCondition) {
        searchConditions.push(searchCondition);
      }
    }

    // Add validated date search condition
    if (searchDate) {
      const dateValidation = validateDate(searchDate);
      if (dateValidation.isValid) {
        // Convert to proper date format for JSON search
        const formattedDate = dateValidation.value; // YYYY-MM-DD format

        const dateConditions = [
          {
            data: {
              path: ["invoiceDate"],
              equals: formattedDate
            }
          },
          {
            data: {
              path: ["issueDate"],
              equals: formattedDate
            }
          },
          {
            data: {
              path: ["dueDate"],
              equals: formattedDate
            }
          }
        ];
        searchConditions.push({ OR: dateConditions });
      }
    }

    // Status lives inside the JSON `data` column. Filter it in SQL so offset
    // paging stays correct. Invoices without a status (key missing or JSON
    // null) count as PENDING, matching the UI default. Prisma.AnyNull on a
    // JSON path compiles to `data #> '{status}' IS NULL OR = 'null'::jsonb`.
    if (searchStatus) {
      const statusValidation = validateInvoiceStatus(searchStatus);
      if (statusValidation.isValid) {
        const statusCondition = { data: { path: ["status"], equals: statusValidation.value } };
        searchConditions.push(
          statusValidation.value === "PENDING"
            ? { OR: [statusCondition, { data: { path: ["status"], equals: Prisma.AnyNull } }] }
            : statusCondition
        );
      }
    }

    // Combine search conditions with AND logic
    if (searchConditions.length > 0) {
      whereClause.AND = searchConditions;
    }

    const invoiceSelect = {
      id: true,
      data: true, // Contains invoice details including status
      createdAt: true,
      updatedAt: true,
      userId: true, // Needed for security checks
    };

    if (useCursor) {
      // Cursor-based pagination - no need for count query
      const findQuery = trackDbQuery('FIND_MANY', 'invoice');
      const invoices = await prisma.invoice.findMany({
        where: whereClause,
        select: invoiceSelect,
        orderBy: {
          id: "desc", // Use ID for consistent cursor ordering
        },
        take: limit + 1, // Fetch one extra to check if there are more
      });
      findQuery.end(invoices.length);

      const hasMore = invoices.length > limit;
      if (hasMore) {
        invoices.pop(); // Remove the extra item
      }

      const nextCursor = hasMore && invoices.length > 0 ? generateCursor(invoices[invoices.length - 1].id) : null;

      perfTracker.end(200, 0);
      return NextResponse.json({
        invoices,
        pagination: {
          limit,
          hasMore,
          nextCursor,
          cursors: {
            next: nextCursor
          }
        },
      });
    }

    // Offset-based pagination (used by the UI's infinite scroll).
    // Fetch one extra row to compute hasMore; the total count is only computed
    // for the first page, in parallel with the page query.
    const findQuery = trackDbQuery('FIND_MANY', 'invoice');
    const [totalCount, invoices] = await Promise.all([
      page === 1 ? prisma.invoice.count({ where: whereClause }) : Promise.resolve(null),
      prisma.invoice.findMany({
        where: whereClause,
        select: invoiceSelect,
        orderBy: {
          createdAt: "desc",
        },
        skip: offset,
        take: limit + 1,
      }),
    ]);
    findQuery.end(invoices.length);

    const hasMore = invoices.length > limit;
    if (hasMore) {
      invoices.pop(); // Remove the extra item
    }

    const pagination = { page, limit, hasMore };
    if (totalCount !== null) {
      pagination.totalCount = totalCount;
      pagination.totalPages = Math.ceil(totalCount / limit);
    }

    perfTracker.end(200, 0);
    return NextResponse.json({ invoices, pagination });
  } catch (error) {
    logErrorWithMonitoring(error, {
      context: 'GET /api/invoices',
      userId: user?.id || 'unknown',
      searchParams: Object.fromEntries(new URL(request.url).searchParams)
    });

    perfTracker.end(500, 0);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const invoiceId = searchParams.get("id");

    if (!invoiceId) {
      return NextResponse.json(
        { error: "Invoice ID is required" },
        { status: 400 }
      );
    }

    const invoiceData = await request.json();

    // Use cached user lookup to reduce database queries
    const user = await getCachedUser(userId);

    // Update the invoice (only if it belongs to the authenticated user)
    const updatedInvoice = await prisma.invoice.update({
      where: {
        id: invoiceId,
        userId: user.id,
      },
      data: {
        data: invoiceData,
      },
    });

      return NextResponse.json({ invoice: updatedInvoice });
  } catch (error) {
    console.error("Error updating invoice:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const invoiceId = searchParams.get("id");

    if (!invoiceId) {
      return NextResponse.json(
        { error: "Invoice ID is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const statusValidation = validateInvoiceStatus(body?.status);

    if (!statusValidation.isValid) {
      return NextResponse.json(
        { error: statusValidation.error },
        { status: 400 }
      );
    }
    const status = statusValidation.value;

    // Use cached user lookup to reduce database queries
    const user = await getCachedUser(userId);

    // Use Prisma's atomic update with JSON operations to avoid extra query
    try {
      // Use raw SQL for atomic JSON update to avoid N+1 query
       const rowsUpdated = await prisma.$executeRaw`
         UPDATE invoices 
         SET data = jsonb_set(data, '{status}', ${JSON.stringify(status)}::jsonb, true),
             updated_at = NOW()
         WHERE id = ${invoiceId} AND user_id = ${user.id}
       `;
      
      if (rowsUpdated === 0) {
        return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
      }
      
      // Fetch the updated invoice
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId, userId: user.id },
        select: {
          id: true,
          data: true,
          createdAt: true,
          updatedAt: true
        }
      });

      return NextResponse.json({ invoice });
    } catch (updateError) {
      if (updateError.code === 'P2025') {
        return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
      }
      throw updateError;
    }
  } catch (error) {
    console.error("Error updating invoice status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const invoiceId = searchParams.get("id");

    if (!invoiceId) {
      return NextResponse.json(
        { error: "Invoice ID is required" },
        { status: 400 }
      );
    }

    // Use cached user lookup to reduce database queries
    const user = await getCachedUser(userId);

    // First, get the invoice to find its clientId before deletion
    const invoiceToDelete = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        userId: user.id,
      },
      select: {
        clientId: true,
      },
    });

    if (!invoiceToDelete) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    const { clientId } = invoiceToDelete;

    // Delete the invoice (only if it belongs to the authenticated user)
    await prisma.invoice.delete({
      where: {
        id: invoiceId,
        userId: user.id,
      },
    });

    // Check if auto-renumbering is enabled for this client
    const autoRenumberEnabled = await isAutoRenumberingEnabled(clientId, user.id);
    
    if (autoRenumberEnabled) {
      // Re-number remaining invoices for this client
      await renumberClientInvoices(clientId, user.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting invoice:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
