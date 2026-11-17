import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCachedUser } from "@/lib/userCache";
import prisma from "@/lib/prisma";
import { 
  validatePagination, 
  validateCursorPagination,
  generateCursor,
  validateEmail, 
  validateName, 
  sanitizeString,
  validateRequestSize 
} from "@/lib/validation";
import { applyRateLimit, createRateLimitResponse } from "@/lib/rateLimiter";

const DEFAULT_PAGE_SIZE = 5;

// GET /api/clients - Fetch clients for the authenticated user with pagination support
export async function GET(request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit per authenticated user (after auth so users behind one IP don't share a bucket)
    const rateLimitResult = applyRateLimit(request, 'read', userId);
    if (rateLimitResult.isLimited) {
      return createRateLimitResponse(rateLimitResult);
    }

    // Parse pagination parameters from URL
    const { searchParams } = new URL(request.url);
    const useCursor = searchParams.get("cursor") !== null || searchParams.get("use_cursor") === "true";
    
    // Use cached user lookup to reduce database queries
    const dbUser = await getCachedUser(userId);

    if (useCursor) {
      // Use cursor-based pagination (more efficient for large datasets)
      const { cursor, limit } = validateCursorPagination(
        searchParams.get("cursor"),
        searchParams.get("limit"),
        50 // Max 50 clients per page
      );

      // Build where clause with cursor
      const whereClause = {
        userId: dbUser.id,
        ...(cursor && { id: { lt: cursor } }) // Use 'lt' for descending order
      };

      // Fetch clients with cursor pagination
      const clients = await prisma.client.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          email: true,
          autoRenumberInvoices: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          id: "desc", // Use ID for consistent ordering
        },
        take: limit + 1, // Fetch one extra to check if there are more
      });

      const hasMore = clients.length > limit;
      if (hasMore) {
        clients.pop(); // Remove the extra item
      }

      const nextCursor = hasMore && clients.length > 0 ? generateCursor(clients[clients.length - 1].id) : null;

      return NextResponse.json({
        clients,
        pagination: {
          limit,
          hasMore,
          nextCursor,
          cursors: {
            next: nextCursor
          }
        },
      });
    } else {
      // Offset-based pagination (used by the UI's infinite scroll)
      const { page, limit, offset } = validatePagination(
        searchParams.get("page"),
        searchParams.get("limit") ?? DEFAULT_PAGE_SIZE,
        50 // Max 50 clients per page
      );

      // Optional server-side search on name/email
      const searchTerm = (searchParams.get("search") || "").trim().slice(0, 100);
      const whereClause = {
        userId: dbUser.id,
        ...(searchTerm && {
          OR: [
            { name: { contains: searchTerm, mode: "insensitive" } },
            { email: { contains: searchTerm, mode: "insensitive" } },
          ],
        }),
      };

      // Fetch one extra row to compute hasMore without a count query.
      // The total count is only needed (and only computed) for the first page,
      // in parallel with the page query.
      const [totalCount, clients] = await Promise.all([
        page === 1 ? prisma.client.count({ where: whereClause }) : Promise.resolve(null),
        prisma.client.findMany({
          where: whereClause,
          select: {
            id: true,
            name: true,
            email: true,
            autoRenumberInvoices: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          skip: offset,
          take: limit + 1,
        }),
      ]);

      const hasMore = clients.length > limit;
      if (hasMore) {
        clients.pop(); // Remove the extra item
      }

      const pagination = { page, limit, hasMore };
      if (totalCount !== null) {
        pagination.totalCount = totalCount;
        pagination.totalPages = Math.ceil(totalCount / limit);
      }

      return NextResponse.json({ clients, pagination });
    }
  } catch (error) {
    console.error("Error fetching clients:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/clients - Create a new client
export async function POST(request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit per authenticated user (after auth so users behind one IP don't share a bucket)
    const rateLimitResult = applyRateLimit(request, 'write', userId);
    if (rateLimitResult.isLimited) {
      return createRateLimitResponse(rateLimitResult);
    }

    // Validate request size
    const sizeValidation = await validateRequestSize(request, 10240); // 10KB limit
    if (!sizeValidation.isValid) {
      return NextResponse.json(
        { error: sizeValidation.error },
        { status: 413 }
      );
    }

    const body = await request.json();
    const { name, email } = body;

    // Validate and sanitize required fields
    const nameValidation = validateName(name);
    if (!nameValidation.isValid) {
      return NextResponse.json(
        { error: nameValidation.error },
        { status: 400 }
      );
    }

    // Email is optional for clients (stored as null); validate it only when given
    const emailValidation =
      typeof email === "string" && email.trim()
        ? validateEmail(email)
        : { isValid: true, value: null };
    if (!emailValidation.isValid) {
      return NextResponse.json(
        { error: emailValidation.error },
        { status: 400 }
      );
    }

    // Use cached user lookup to reduce database queries
    const dbUser = await getCachedUser(userId);

    // add client into Db
    const newClient = await prisma.client.create({
      data: {
        name: nameValidation.value,
        email: emailValidation.value,
        userId: dbUser.id, // Use the database user's id
        autoRenumberInvoices: true, // Default to auto-renumbering enabled
      },
    });

    console.log("new client added successfully");

    return NextResponse.json(newClient, {
      message: "Client added successfully",
      status: 201,
    });
  } catch (error) {
    console.error("Error creating client:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/clients/[id] - Update an existing client
export async function PUT(request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit per authenticated user (after auth so users behind one IP don't share a bucket)
    const rateLimitResult = applyRateLimit(request, 'write', userId);
    if (rateLimitResult.isLimited) {
      return createRateLimitResponse(rateLimitResult);
    }

    // Validate request size
    const sizeValidation = await validateRequestSize(request, 10240); // 10KB limit
    if (!sizeValidation.isValid) {
      return NextResponse.json(
        { error: sizeValidation.error },
        { status: 413 }
      );
    }

    // Use cached user lookup to reduce database queries
    const dbUser = await getCachedUser(userId);

    const body = await request.json();
    const { id, name, email, updateOption } = body;

    // Validate required fields
    if (!id) {
      return NextResponse.json(
        { error: "Client ID is required" },
        { status: 400 }
      );
    }

    // Validate and sanitize fields
    const nameValidation = validateName(name);
    if (!nameValidation.isValid) {
      return NextResponse.json(
        { error: nameValidation.error },
        { status: 400 }
      );
    }

    // Email is optional for clients (stored as null); validate it only when given
    const emailValidation =
      typeof email === "string" && email.trim()
        ? validateEmail(email)
        : { isValid: true, value: null };
    if (!emailValidation.isValid) {
      return NextResponse.json(
        { error: emailValidation.error },
        { status: 400 }
      );
    }

    // Update client in database (only if it belongs to the authenticated user)
    let updatedClient;
    try {
      updatedClient = await prisma.client.update({
        where: { id, userId: dbUser.id },
        data: {
          name: nameValidation.value,
          email: emailValidation.value,
        },
      });
    } catch (updateError) {
      if (updateError.code === "P2025") {
        return NextResponse.json(
          { error: "Client not found" },
          { status: 404 }
        );
      }
      throw updateError;
    }

    // If updateOption is 'allInvoices', update all invoices with new client data
    if (updateOption === "allInvoices") {
      // Merge the new client details into every invoice's JSON in one statement
      // (previously one UPDATE per invoice)
      const patch = JSON.stringify({
        clientName: nameValidation.value,
        clientEmail: emailValidation.value,
      });
      await prisma.$executeRaw`
        UPDATE invoices
        SET data = data || ${patch}::jsonb,
            updated_at = NOW()
        WHERE client_id = ${id}
          AND user_id = ${dbUser.id}
          AND jsonb_typeof(data) = 'object'
      `;
    }

    return NextResponse.json(updatedClient);
  } catch (error) {
    console.error("Error updating client:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/clients/[id] - Delete a client
export async function DELETE(request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit per authenticated user (after auth so users behind one IP don't share a bucket)
    const rateLimitResult = applyRateLimit(request, 'write', userId);
    if (rateLimitResult.isLimited) {
      return createRateLimitResponse(rateLimitResult);
    }

    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Client ID is required" },
        { status: 400 }
      );
    }

    // Use cached user lookup to reduce database queries
    const dbUser = await getCachedUser(userId);

    // Delete client from database with ownership verification
    try {
      await prisma.client.delete({
        where: {
          id,
          userId: dbUser.id, // Ensure user owns the client
        },
      });

      return NextResponse.json(
        { message: "Client deleted successfully" },
        { status: 200 }
      );
    } catch (deleteError) {
      if (deleteError.code === "P2025") {
        return NextResponse.json(
          { error: "Client not found" },
          { status: 404 }
        );
      }
      throw deleteError;
    }
  } catch (error) {
    console.error("Error deleting client:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
