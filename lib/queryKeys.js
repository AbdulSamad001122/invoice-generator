// Central list of TanStack Query cache keys, so every component and mutation
// refers to the same cache entries.
export const queryKeys = {
  clients: ["clients"],
  client: (id) => ["client", id],
  // All invoice lists for a client start with ["invoices", clientId], so one
  // invalidate(["invoices", clientId]) refreshes every filter combination.
  invoicesForClient: (clientId) => ["invoices", clientId],
  invoices: (clientId, filters) => ["invoices", clientId, filters],
  allInvoices: ["invoices"],
  items: ["items"],
  itemsForClient: (clientId) => ["items", "client", clientId],
  companyProfile: ["companyProfile"],
};

// Normalises invoice filters so equivalent filters share one cache entry.
export function normalizeInvoiceFilters(filters = {}) {
  return {
    search: (filters.search || "").trim(),
    date: filters.date || "",
    status: filters.status || "",
  };
}
