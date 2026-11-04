// Invoice Re-numbering Utility
// Handles automatic re-numbering of invoices when deletions occur

import prisma from '@/lib/prisma';

/**
 * Re-numbers invoices for a specific client in sequential order
 * @param {string} clientId - The client ID whose invoices need re-numbering
 * @param {string} userId - The user ID for security validation
 * @returns {Promise<void>}
 */
export async function renumberClientInvoices(clientId, userId) {
  try {
    // One statement renumbers every invoice for the client in creation order
    // (INV-1, INV-2, ...), and only writes rows whose number actually changes.
    // Previously this was one UPDATE per invoice.
    const updatedCount = await prisma.$executeRaw`
      UPDATE invoices AS i
      SET data = jsonb_set(i.data, '{invoiceNumber}', to_jsonb('INV-' || r.rn::text), true),
          updated_at = NOW()
      FROM (
        SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS rn
        FROM invoices
        WHERE client_id = ${clientId} AND user_id = ${userId}
      ) AS r
      WHERE i.id = r.id
        AND (i.data->>'invoiceNumber') IS DISTINCT FROM ('INV-' || r.rn::text)
    `;

    console.log(`Renumbered invoices for client ${clientId} (${updatedCount} changed)`);
  } catch (error) {
    console.error('Error renumbering invoices:', error);
    throw new Error('Failed to renumber invoices');
  }
}

/**
 * Generates the next sequential invoice number for a client
 * @param {string} clientId - The client ID
 * @param {string} userId - The user ID for security validation
 * @param {boolean} autoRenumber - Whether auto-renumbering is enabled for this client
 * @returns {Promise<string>} The next invoice number
 */
export async function generateNextInvoiceNumber(clientId, userId, autoRenumber = true) {
  try {
    if (autoRenumber) {
      // For auto-renumbering clients, always use sequential numbering
      const invoiceCount = await prisma.invoice.count({
        where: {
          clientId: clientId,
          userId: userId,
        },
      });
      return `INV-${invoiceCount + 1}`;
    }

    // For non-auto-renumbering clients, the database finds the highest
    // "INV-<number>" in one query instead of downloading every invoice.
    const [row] = await prisma.$queryRaw`
      SELECT COALESCE(MAX((substring(data->>'invoiceNumber' from 'INV-([0-9]+)'))::bigint), 0) AS max_number
      FROM invoices
      WHERE client_id = ${clientId} AND user_id = ${userId}
    `;
    const maxNumber = Number(row?.max_number ?? 0);

    return `INV-${maxNumber + 1}`;
  } catch (error) {
    console.error('Error generating invoice number:', error);
    throw new Error('Failed to generate invoice number');
  }
}

/**
 * Checks if a client has auto-renumbering enabled
 * @param {string} clientId - The client ID
 * @param {string} userId - The user ID for security validation
 * @returns {Promise<boolean>} Whether auto-renumbering is enabled
 */
export async function isAutoRenumberingEnabled(clientId, userId) {
  try {
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        userId: userId,
      },
      select: {
        autoRenumberInvoices: true,
      },
    });

    return client?.autoRenumberInvoices ?? true; // Default to true if not found
  } catch (error) {
    console.error('Error checking auto-renumbering setting:', error);
    return true; // Default to true on error
  }
}