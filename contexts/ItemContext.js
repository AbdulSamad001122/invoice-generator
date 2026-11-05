"use client";

// Saved items, cached with TanStack Query. The useItems() API is unchanged.
// The full item list loads only once a page asks for it (fetchItems), so other
// pages don't pay for it.

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import axios from "axios";
import { useAuth } from "@clerk/nextjs";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

const ItemContext = createContext();
const PAGE_SIZE = 20;

export function useItems() {
  const context = useContext(ItemContext);
  if (!context) {
    throw new Error("useItems must be used within an ItemProvider");
  }
  return context;
}

function updateItemPages(data, updatePage) {
  if (!data) return data;
  return { ...data, pages: data.pages.map(updatePage) };
}

const errorMessage = (err, fallback) => err?.response?.data?.error || fallback;

export function ItemProvider({ children }) {
  const { isLoaded, userId } = useAuth();
  const queryClient = useQueryClient();
  const [active, setActive] = useState(false); // becomes true when a page needs the list

  const query = useInfiniteQuery({
    queryKey: queryKeys.items,
    enabled: active && isLoaded && Boolean(userId),
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const res = await axios.get(`/api/items?page=${pageParam}&limit=${PAGE_SIZE}`);
      return res.data; // { items, pagination }
    },
    getNextPageParam: (lastPage) =>
      lastPage?.pagination?.hasMore ? lastPage.pagination.page + 1 : undefined,
    staleTime: 5 * 60 * 1000,
  });

  const pages = query.data?.pages;
  const items = useMemo(() => {
    const seen = new Set();
    const list = [];
    for (const page of pages || []) {
      for (const item of page.items || []) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          list.push(item);
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
    totalCount: firstPagination?.totalCount ?? items.length,
    totalPages: lastPagination?.totalPages || 0,
    hasMore: Boolean(query.hasNextPage),
  };

  // Items for a client changed: per-client lists (used by the invoice form) are stale
  const invalidateClientItemLists = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["items", "client"] });
  }, [queryClient]);

  const addItem = useCallback(async (itemData) => {
    try {
      const response = await axios.post("/api/items", itemData);
      const newItem = response.data;
      queryClient.setQueryData(queryKeys.items, (data) =>
        updateItemPages(data, (page, i) =>
          i === 0 ? { ...page, items: [newItem, ...(page.items || []).filter((x) => x.id !== newItem.id)] } : page
        )
      );
      invalidateClientItemLists();
      return newItem;
    } catch (err) {
      console.error("ItemContext: Error adding item:", err);
      throw new Error(errorMessage(err, "Failed to add item"));
    }
  }, [queryClient, invalidateClientItemLists]);

  const updateItem = useCallback(async (itemId, itemData) => {
    try {
      const response = await axios.put(`/api/items/${itemId}`, itemData);
      const updatedItem = response.data;
      queryClient.setQueryData(queryKeys.items, (data) =>
        updateItemPages(data, (page) => ({
          ...page,
          items: (page.items || []).map((x) => (x.id === itemId ? updatedItem : x)),
        }))
      );
      invalidateClientItemLists();
      return updatedItem;
    } catch (err) {
      console.error("ItemContext: Error updating item:", err);
      throw new Error(errorMessage(err, "Failed to update item"));
    }
  }, [queryClient, invalidateClientItemLists]);

  const deleteItem = useCallback(async (itemId) => {
    try {
      await axios.delete(`/api/items/${itemId}`);
      queryClient.setQueryData(queryKeys.items, (data) =>
        updateItemPages(data, (page) => ({
          ...page,
          items: (page.items || []).filter((x) => x.id !== itemId),
        }))
      );
      invalidateClientItemLists();
    } catch (err) {
      console.error("ItemContext: Error deleting item:", err);
      throw new Error(errorMessage(err, "Failed to delete item"));
    }
  }, [queryClient, invalidateClientItemLists]);

  const getItemById = useCallback((itemId) => items.find((item) => item.id === itemId), [items]);

  // Saved items available to one client (cached, so reopening the invoice form is instant)
  const getItemsForClient = useCallback(async (clientId) => {
    try {
      return await queryClient.fetchQuery({
        queryKey: queryKeys.itemsForClient(clientId),
        queryFn: async () => (await axios.get(`/api/items/client/${clientId}`)).data,
        staleTime: 2 * 60 * 1000,
      });
    } catch (err) {
      console.error("ItemContext: Error fetching items for client:", err);
      throw new Error(errorMessage(err, "Failed to fetch items for client"));
    }
  }, [queryClient]);

  // Called by the pages that show the list (e.g. item-list.jsx)
  const fetchItems = useCallback(() => setActive(true), []);

  const { fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = query;
  const loadMoreItems = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  const refreshItems = useCallback(() => (active ? refetch() : setActive(true)), [active, refetch]);

  const value = {
    items,
    // Loading until the list has been requested and its first load has finished
    // (isPending turns false on error too, so a failed request can't spin forever)
    loading: !active || query.isPending,
    loadingMore: isFetchingNextPage,
    error: query.error ? errorMessage(query.error, "Failed to fetch items") : null,
    pagination,
    addItem,
    updateItem,
    deleteItem,
    getItemById,
    getItemsForClient,
    refreshItems,
    fetchItems,
    loadMoreItems,
  };

  return <ItemContext.Provider value={value}>{children}</ItemContext.Provider>;
}
