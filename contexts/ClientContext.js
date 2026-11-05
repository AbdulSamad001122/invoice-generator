"use client";

// Clients, cached with TanStack Query. The useClients() API is unchanged, so
// components keep working; the cache now handles freshness, de-duplication
// and background refreshes.

import React, { createContext, useCallback, useContext, useMemo } from "react";
import axios from "axios";
import { useAuth } from "@clerk/nextjs";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

const ClientContext = createContext();
const PAGE_SIZE = 15;

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
    queryFn: async ({ pageParam }) => {
      const res = await axios.get(`/api/clients?page=${pageParam}&limit=${PAGE_SIZE}`);
      return res.data; // { clients, pagination }
    },
    getNextPageParam: (lastPage) =>
      lastPage?.pagination?.hasMore ? lastPage.pagination.page + 1 : undefined,
    staleTime: 5 * 60 * 1000, // client list changes rarely
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

  const firstPagination = pages?.[0]?.pagination;
  const lastPagination = pages?.[pages.length - 1]?.pagination;
  const pagination = {
    page: lastPagination?.page || 1,
    limit: PAGE_SIZE,
    totalCount: firstPagination?.totalCount ?? clients.length,
    totalPages: lastPagination?.totalPages || 0,
    hasMore: Boolean(query.hasNextPage),
  };

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
    return newClient;
  }, [queryClient, setTotal]);

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
      // The server rewrote this client's details on every invoice
      queryClient.invalidateQueries({ queryKey: queryKeys.invoicesForClient(clientId) });
    }
    return updatedClient;
  }, [queryClient]);

  const deleteClient = useCallback(async (clientId) => {
    await axios.delete(`/api/clients?id=${clientId}`);
    queryClient.setQueryData(queryKeys.clients, (data) =>
      updateClientPages(data, (page) => ({
        ...page,
        clients: (page.clients || []).filter((c) => c.id !== clientId),
      }))
    );
    setTotal(-1);
    // The client's invoices were deleted with it
    queryClient.removeQueries({ queryKey: queryKeys.invoicesForClient(clientId) });
    queryClient.removeQueries({ queryKey: queryKeys.client(clientId) });
  }, [queryClient, setTotal]);

  const getClientById = useCallback(
    (clientId) => clients.find((client) => client.id === clientId),
    [clients]
  );

  const { fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = query;
  const loadMoreClients = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const refreshClients = useCallback(() => refetch(), [refetch]);

  const value = {
    clients,
    // "loading" = no data yet (first load); background refreshes keep showing cached data
    loading: query.isPending,
    loadingMore: isFetchingNextPage,
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
