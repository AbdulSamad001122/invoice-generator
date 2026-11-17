"use client";

// Clients, cached with TanStack Query. The useClients() API is unchanged, so
// components keep working; the cache now handles freshness, de-duplication
// and background refreshes.
//
// The shared list loads PAGE_SIZE clients at a time (more as the user scrolls).
// Search runs on the server in the sidebar's own query (["clients", "search",
// term]); this shared list is never keyed on a search term.

import React, { createContext, useCallback, useContext, useMemo } from "react";
import axios from "axios";
import { useAuth } from "@clerk/nextjs";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { trimClientInvoicePages } from "@/contexts/InvoiceContext";

const ClientContext = createContext();
export const CLIENT_PAGE_SIZE = 5;
const PAGE_SIZE = CLIENT_PAGE_SIZE;
const CLIENT_LIST_STALE_TIME = 5 * 60 * 1000; // client list changes rarely

// One page of clients: { clients, pagination: { page, limit, hasMore, totalCount? (page 1 only) } }.
// Shared by the list below and the sidebar's search query.
export async function fetchClientsPage({ page, search = "", signal }) {
  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (search) params.append("search", search);
  const res = await axios.get(`/api/clients?${params.toString()}`, { signal });
  return res.data;
}

export const getNextClientsPageParam = (lastPage) =>
  lastPage?.pagination?.hasMore ? lastPage.pagination.page + 1 : undefined;

// Every client, for pickers and filters (e.g. the Items page). The shared list
// above only holds the pages scrolled so far; this pages through all of them
// (50 per request) in one cached query. Invalidated with the other client lists.
export function useAllClients() {
  const { isLoaded, userId } = useAuth();
  const query = useQuery({
    queryKey: queryKeys.allClients,
    enabled: isLoaded && Boolean(userId),
    staleTime: CLIENT_LIST_STALE_TIME,
    queryFn: async ({ signal }) => {
      const all = [];
      for (let page = 1; page <= 100; page++) {
        const res = await axios.get(`/api/clients?page=${page}&limit=50`, { signal });
        all.push(...(res.data?.clients || []));
        if (!res.data?.pagination?.hasMore) break;
      }
      return all;
    },
  });
  return { clients: query.data || [], loading: query.isPending, error: query.error };
}

export function useClients() {
  const context = useContext(ClientContext);
  if (!context) {
    throw new Error("useClients must be used within a ClientProvider");
  }
  return context;
}

// Apply a change to every page of the cached infinite client list
function updateClientPages(data, updatePage) {
  if (!data) return data;
  return { ...data, pages: data.pages.map(updatePage) };
}

export function ClientProvider({ children }) {
  const { isLoaded, userId } = useAuth();
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: queryKeys.clients,
    enabled: isLoaded && Boolean(userId),
    initialPageParam: 1,
    // The signal aborts the request if the query is cancelled
    queryFn: ({ pageParam, signal }) => fetchClientsPage({ page: pageParam, signal }),
    getNextPageParam: getNextClientsPageParam,
    staleTime: CLIENT_LIST_STALE_TIME,
  });

  const pages = query.data?.pages;
  const clients = useMemo(() => {
    // Flatten pages and drop duplicates (a client added locally may also arrive on a later page)
    const seen = new Set();
    const list = [];
    for (const page of pages || []) {
      for (const client of page.clients || []) {
        if (!seen.has(client.id)) {
          seen.add(client.id);
          list.push(client);
        }
      }
    }
    return list;
  }, [pages]);

  // Only page 1 carries totalCount/totalPages (the server counts once, on the first page)
  const firstPagination = pages?.[0]?.pagination;
  const lastPagination = pages?.[pages.length - 1]?.pagination;
  const pagination = {
    page: lastPagination?.page || 1,
    limit: PAGE_SIZE,
    totalCount: firstPagination?.totalCount ?? clients.length,
    totalPages: firstPagination?.totalPages ?? 0,
    hasMore: Boolean(query.hasNextPage),
  };

  // Search results are their own queries: refresh them after any change
  // (never patched locally, so a result never shows a client that doesn't match)
  // Search results and the full picker list are derived lists: refresh them on any change
  const invalidateClientSearches = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.clientSearchAll });
    queryClient.invalidateQueries({ queryKey: queryKeys.allClients });
  }, [queryClient]);

  const setTotal = useCallback((delta) => {
    queryClient.setQueryData(queryKeys.clients, (data) =>
      updateClientPages(data, (page, i) =>
        i === 0 && page.pagination
          ? { ...page, pagination: { ...page.pagination, totalCount: Math.max(0, (page.pagination.totalCount || 0) + delta) } }
          : page
      )
    );
  }, [queryClient]);

  const addClient = useCallback(async (clientData) => {
    const response = await axios.post("/api/clients", clientData);
    const newClient = response.data;
    // Newest first, matching the server order
    queryClient.setQueryData(queryKeys.clients, (data) =>
      updateClientPages(data, (page, i) =>
        i === 0 ? { ...page, clients: [newClient, ...(page.clients || []).filter((c) => c.id !== newClient.id)] } : page
      )
    );
    setTotal(1);
    queryClient.setQueryData(queryKeys.client(newClient.id), newClient);
    invalidateClientSearches();
    return newClient;
  }, [queryClient, setTotal, invalidateClientSearches]);

  const updateClient = useCallback(async (clientId, clientData, updateOption = "fromNow") => {
    const response = await axios.put("/api/clients", { id: clientId, ...clientData, updateOption });
    const updatedClient = response.data;
    queryClient.setQueryData(queryKeys.clients, (data) =>
      updateClientPages(data, (page) => ({
        ...page,
        clients: (page.clients || []).map((c) => (c.id === clientId ? { ...c, ...updatedClient } : c)),
      }))
    );
    queryClient.setQueryData(queryKeys.client(clientId), (old) => ({ ...(old || {}), ...updatedClient }));
    if (updateOption === "allInvoices") {
      // The server rewrote this client's details on every invoice (trimmed
      // first, so each list refetches one page rather than every loaded page)
      trimClientInvoicePages(queryClient, clientId);
      queryClient.invalidateQueries({ queryKey: queryKeys.invoicesForClient(clientId) });
    }
    invalidateClientSearches();
    return updatedClient;
  }, [queryClient, invalidateClientSearches]);

  const deleteClient = useCallback(async (clientId) => {
    await axios.delete(`/api/clients?id=${clientId}`);
    queryClient.setQueryData(queryKeys.clients, (data) =>
      updateClientPages(data, (page) => ({
        ...page,
        clients: (page.clients || []).filter((c) => c.id !== clientId),
      }))
    );
    setTotal(-1);
    // Pages are offset-based: after a delete every later client shifts up one slot,
    // so the next page would skip one. Keep only page 1 and re-sync from the server.
    queryClient.setQueryData(queryKeys.clients, (data) =>
      data && data.pages.length > 1
        ? { ...data, pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) }
        : data
    );
    queryClient.invalidateQueries({ queryKey: queryKeys.clients, exact: true });
    // The client's invoices were deleted with it
    queryClient.removeQueries({ queryKey: queryKeys.invoicesForClient(clientId) });
    queryClient.removeQueries({ queryKey: queryKeys.client(clientId) });
    invalidateClientSearches();
  }, [queryClient, setTotal, invalidateClientSearches]);

  const getClientById = useCallback(
    (clientId) => clients.find((client) => client.id === clientId),
    [clients]
  );

  const { fetchNextPage, hasNextPage, isFetching, isFetchingNextPage, refetch } = query;
  // Not while any fetch runs: fetchNextPage would cancel a refresh in progress
  const loadMoreClients = useCallback(() => {
    if (hasNextPage && !isFetching) fetchNextPage();
  }, [hasNextPage, isFetching, fetchNextPage]);

  const refreshClients = useCallback(() => refetch(), [refetch]);

  const value = {
    clients,
    // "loading" = no data yet (first load); background refreshes keep showing cached data
    loading: query.isPending,
    loadingMore: isFetchingNextPage,
    // A background refresh (not "load more") is running
    refreshing: isFetching && !isFetchingNextPage,
    // Loading the next page failed: auto-loading stops until the user retries
    loadMoreError: query.isFetchNextPageError,
    error: query.error ? "Failed to fetch clients" : null,
    pagination,
    fetchClients: refreshClients,
    loadMoreClients,
    addClient,
    updateClient,
    deleteClient,
    getClientById,
    refreshClients,
    lastFetch: query.dataUpdatedAt || null,
  };

  return <ClientContext.Provider value={value}>{children}</ClientContext.Provider>;
}
