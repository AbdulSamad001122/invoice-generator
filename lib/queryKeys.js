// Central list of TanStack Query cache keys, so every component and mutation
// refers to the same cache entries.
export const queryKeys = {
  clients: ["clients"],
  // Sidebar server-side search results. Prefix ["clients", "search"] invalidates
  // every search term at once; it never matches the shared list query exactly.
  clientSearch: (term) => ["clients", "search", term],
  clientSearchAll: ["clients", "search"],
  // Every client (paged through in the background) for pickers/filters that
  // must not depend on how far the sidebar list has been scrolled.
  allClients: ["clients", "all"],
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
