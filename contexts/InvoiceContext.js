"use client";

// Invoices, cached with TanStack Query.
// - useClientInvoices(clientId, filters): the paged list for one client. Each
//   filter combination has its own cache entry, so a filtered list can never be
//   mistaken for the full list.
// - useInvoices(): actions (create, update, status, duplicate, delete...) that
//   keep every cached list in sync and refresh them in the background.

import React, { createContext, useCallback, useContext, useMemo } from "react";
import axios from "axios";
import { useAuth } from "@clerk/nextjs";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys, normalizeInvoiceFilters } from "@/lib/queryKeys";

const InvoiceContext = createContext(null);
const PAGE_SIZE = 10;

// ---------- cache helpers (data shape: { pages: [{ invoices, pagination }], pageParams })

function mapInvoicePages(data, mapPage) {
  if (!data?.pages) return data;
  return { ...data, pages: data.pages.map(mapPage) };
}

function mapInvoices(data, mapInvoice) {
  return mapInvoicePages(data, (page) => ({
    ...page,
    invoices: (page.invoices || []).map(mapInvoice),
  }));
}

function adjustTotal(data, delta) {
  return mapInvoicePages(data, (page, i) =>
    i === 0 && page.pagination
      ? { ...page, pagination: { ...page.pagination, totalCount: Math.max(0, (page.pagination.totalCount || 0) + delta) } }
      : page
  );
}

function isUnfiltered(queryKey) {
  const f = queryKey[2] || {};
  return !f.search && !f.date && !f.status;
}

async function fetchInvoicePage({ clientId, filters, page }) {
  const params = new URLSearchParams({ clientId, page: String(page), limit: String(PAGE_SIZE) });
  if (filters.search) params.append("search", filters.search);
  if (filters.date) params.append("date", filters.date);
  if (filters.status) params.append("status", filters.status);
  const res = await axios.get(`/api/invoices?${params.toString()}`);
  return res.data; // { invoices, pagination }
}

// One definition of the invoice list query, shared by the hook and the hover
// prefetch (a prefetch with different options would replace the query's
// options and break refetching lists that have several pages loaded).
function invoiceListOptions(clientId, filters) {
  return {
    queryKey: queryKeys.invoices(clientId, filters),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchInvoicePage({ clientId, filters, page: pageParam }),
    getNextPageParam: (lastPage) =>
      lastPage?.pagination?.hasMore ? lastPage.pagination.page + 1 : undefined,
  };
}

// ---------- list hook

export function useClientInvoices(clientId, filters) {
  const { isLoaded, userId } = useAuth();
  const normalized = normalizeInvoiceFilters(filters);

  const query = useInfiniteQuery({
    ...invoiceListOptions(clientId, normalized),
    enabled: Boolean(clientId) && isLoaded && Boolean(userId),
    // While a new filter loads, keep showing the previous results for the SAME client
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey?.[1] === clientId ? previous : undefined,
  });

  const pages = query.data?.pages;
  const invoices = useMemo(() => {
    const seen = new Set();
    const list = [];
    for (const page of pages || []) {
      for (const invoice of page.invoices || []) {
        if (!seen.has(invoice.id)) {
          seen.add(invoice.id);
          list.push(invoice);
        }
      }
    }
    return list;
  }, [pages]);

  const totalCount = pages?.[0]?.pagination?.totalCount;

  return {
    invoices,
    totalCount: query.hasNextPage ? totalCount ?? invoices.length : invoices.length,
    // No data at all yet for this client (first visit)
    isLoading: query.isPending,
    // A filter change or background refresh is in progress
    isFetching: query.isFetching && !query.isFetchingNextPage,
    isPlaceholder: query.isPlaceholderData,
    isLoadingMore: query.isFetchingNextPage,
    hasMore: Boolean(query.hasNextPage),
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
    },
    error: query.error,
    refetch: query.refetch,
  };
}

// Warm the cache for a client (e.g. when hovering it in the sidebar)
export function prefetchClientInvoices(queryClient, clientId) {
  return queryClient.prefetchInfiniteQuery({
    ...invoiceListOptions(clientId, normalizeInvoiceFilters()),
    staleTime: 60 * 1000, // no request if the cached list is still fresh
  });
}

// ---------- actions

export function InvoiceProvider({ children }) {
  const queryClient = useQueryClient();

  const invalidateClient = useCallback(
    (clientId) => queryClient.invalidateQueries({ queryKey: queryKeys.invoicesForClient(clientId) }),
    [queryClient]
  );

  // Add a new invoice to the top of the client's unfiltered list, then refresh
  const prependInvoice = useCallback((clientId, invoice) => {
    queryClient.setQueriesData({ queryKey: queryKeys.invoicesForClient(clientId) }, (data) => {
      if (!data?.pages) return data;
      const already = data.pages.some((p) => (p.invoices || []).some((x) => x.id === invoice.id));
      if (already) return data;
      return adjustTotal(data, 1);
    });
    queryClient
      .getQueryCache()
      .findAll({ queryKey: queryKeys.invoicesForClient(clientId) })
      .filter((q) => isUnfiltered(q.queryKey))
      .forEach((q) =>
        queryClient.setQueryData(q.queryKey, (data) =>
          mapInvoicePages(data, (page, i) =>
            i === 0 && !(page.invoices || []).some((x) => x.id === invoice.id)
              ? { ...page, invoices: [invoice, ...(page.invoices || [])] }
              : page
          )
        )
      );
    invalidateClient(clientId);
  }, [queryClient, invalidateClient]);

  const replaceInvoice = useCallback((clientId, invoiceId, next) => {
    queryClient.setQueriesData({ queryKey: queryKeys.invoicesForClient(clientId) }, (data) =>
      mapInvoices(data, (inv) => (inv.id === invoiceId ? { ...inv, ...next } : inv))
    );
  }, [queryClient]);

  const createInvoice = useCallback(async (newInvoice) => {
    const invoice = newInvoice?.invoice || newInvoice;
    if (invoice?.clientId && invoice?.id) prependInvoice(invoice.clientId, invoice);
    return invoice;
  }, [prependInvoice]);

  const updateInvoice = useCallback(async (invoiceId, updated) => {
    const invoice = updated?.invoice || updated;
    if (invoice?.clientId) {
      replaceInvoice(invoice.clientId, invoiceId, invoice);
      invalidateClient(invoice.clientId);
    } else {
      queryClient.invalidateQueries({ queryKey: queryKeys.allInvoices });
    }
    return invoice;
  }, [replaceInvoice, invalidateClient, queryClient]);

  const updateInvoiceStatus = useCallback(async (invoiceId, status, clientId) => {
    const key = { queryKey: queryKeys.invoicesForClient(clientId) };
    // Stop in-flight refreshes so an older response can't overwrite the new status
    await queryClient.cancelQueries(key);

    // Remember only this invoice's previous status (not whole lists), then show the new one
    let previousStatus;
    for (const [, data] of queryClient.getQueriesData(key)) {
      for (const page of data?.pages || []) {
        const found = (page.invoices || []).find((inv) => inv.id === invoiceId);
        if (found && previousStatus === undefined) previousStatus = found.data?.status;
      }
    }
    const setStatus = (value) =>
      queryClient.setQueriesData(key, (data) =>
        mapInvoices(data, (inv) => (inv.id === invoiceId ? { ...inv, data: { ...(inv.data || {}), status: value } } : inv))
      );
    setStatus(status);

    try {
      const response = await axios.patch(`/api/invoices?id=${invoiceId}`, { status });
      const saved = response.data.invoice;
      if (saved) replaceInvoice(clientId, invoiceId, saved);
      return saved;
    } catch (err) {
      if (previousStatus !== undefined) setStatus(previousStatus);
      throw err;
    } finally {
      // Settle to the server's data (and refresh lists filtered by status)
      invalidateClient(clientId);
    }
  }, [queryClient, replaceInvoice, invalidateClient]);

  const duplicateInvoice = useCallback(async (invoiceId, clientId) => {
    const response = await axios.post(`/api/invoices/duplicate`, { invoiceId });
    const duplicated = response.data.invoice;
    if (duplicated) prependInvoice(clientId, duplicated);
    return duplicated;
  }, [prependInvoice]);

  const deleteInvoice = useCallback(async (invoiceId, clientId) => {
    await axios.delete(`/api/invoices?id=${invoiceId}`);
    // Remove it now, then refetch (the server renumbers the remaining invoices)
    queryClient.setQueriesData({ queryKey: queryKeys.invoicesForClient(clientId) }, (data) =>
      adjustTotal(
        mapInvoicePages(data, (page) => ({
          ...page,
          invoices: (page.invoices || []).filter((inv) => inv.id !== invoiceId),
        })),
        -1
      )
    );
    await invalidateClient(clientId);
  }, [queryClient, invalidateClient]);

  const deleteAllInvoices = useCallback(async (clientId) => {
    await axios.delete(`/api/invoices/bulk?clientId=${clientId}`);
    queryClient.setQueriesData({ queryKey: queryKeys.invoicesForClient(clientId) }, (data) =>
      mapInvoicePages(data, (page) => ({
        ...page,
        invoices: [],
        pagination: { ...(page.pagination || {}), totalCount: 0, totalPages: 0, hasMore: false },
      }))
    );
    invalidateClient(clientId);
  }, [queryClient, invalidateClient]);

  const refreshInvoices = useCallback((clientId) => invalidateClient(clientId), [invalidateClient]);

  // After bulk server-side changes (e.g. company profile "update all invoices")
  const invalidateAllInvoices = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.allInvoices }),
    [queryClient]
  );

  const value = useMemo(
    () => ({
      createInvoice,
      updateInvoice,
      updateInvoiceStatus,
      duplicateInvoice,
      deleteInvoice,
      deleteAllInvoices,
      refreshInvoices,
      invalidateAllInvoices,
    }),
    [createInvoice, updateInvoice, updateInvoiceStatus, duplicateInvoice, deleteInvoice, deleteAllInvoices, refreshInvoices, invalidateAllInvoices]
  );

  return <InvoiceContext.Provider value={value}>{children}</InvoiceContext.Provider>;
}

export function useInvoices() {
  const context = useContext(InvoiceContext);
  if (!context) {
    throw new Error("useInvoices must be used within an InvoiceProvider");
  }
  return context;
}
