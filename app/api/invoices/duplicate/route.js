import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getCachedUser } from '@/lib/userCache';
import { generateNextInvoiceNumber, isAutoRenumberingEnabled } from '@/app/utils/invoiceRenumbering';
import prisma from '@/lib/prisma';

export async function POST(request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { invoiceId } = await request.json();

    if (!invoiceId) {
      return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
    }

    // Get the original invoice
    const originalInvoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        data: true, // Contains invoice details needed for duplication
        clientId: true,
        userId: true,
        client: {
          select: {
            id: true,
            userId: true, // Needed for authorization check
          }
        }
      }
    });

    if (!originalInvoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Generate new invoice number for the duplicate
    const user = await getCachedUser(userId);
    
    // Verify the invoice belongs to the authenticated user
    if (originalInvoice.client.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const autoRenumberEnabled = await isAutoRenumberingEnabled(originalInvoice.clientId, user.id);
    const newInvoiceNumber = await generateNextInvoiceNumber(originalInvoice.clientId, user.id, autoRenumberEnabled);

    // Read the due-days setting fresh (the cached user may be up to 5 minutes stale)
    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: { defaultDueDays: true },
    });
    const dueDays = Number.isInteger(profile?.defaultDueDays) && profile.defaultDueDays >= 0
      ? profile.defaultDueDays
      : 30;
    const today = new Date();
    const issueDate = today.toISOString().split('T')[0];
    const dueDate = new Date(today.getTime() + dueDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Create duplicate invoice with new invoice number and current date
    const duplicatedInvoice = await prisma.invoice.create({
      data: {
        clientId: originalInvoice.clientId,
        userId: user.id,
        data: {
          ...originalInvoice.data,
          invoiceNumber: newInvoiceNumber,
          status: "PENDING", // a copy is a new, unpaid invoice
          invoiceDate: issueDate,
          issueDate, // The invoice form reads issueDate
          dueDate, // Uses the user's default due days (falls back to 30)
        },
      },
      include: {
        client: true
      }
    });

    return NextResponse.json({ 
      message: 'Invoice duplicated successfully', 
      invoice: duplicatedInvoice 
    });
  } catch (error) {
    console.error('Error duplicating invoice:', error);
    return NextResponse.json(
      { error: 'Failed to duplicate invoice' },
      { status: 500 }
    );
  }
}