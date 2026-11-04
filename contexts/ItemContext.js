"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { useUser } from "@clerk/nextjs";

const ItemContext = createContext();

export function useItems() {
  const context = useContext(ItemContext);
  if (!context) {
    throw new Error("useItems must be used within an ItemProvider");
  }
  return context;
}

export function ItemProvider({ children }) {
  const { user, isLoaded } = useUser();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    totalCount: 0,
    totalPages: 0,
    hasMore: false,
  });

  // Cache duration: 5 minutes
  const CACHE_DURATION = 5 * 60 * 1000;

  // Refs mirror state so callbacks read the latest values synchronously
  // (reading state through setState updaters is unreliable in React 18+).
  const userId = user?.id;
  const paginationRef = useRef(pagination);
  const loadingMoreRef = useRef(false);
  useEffect(() => { paginationRef.current = pagination; }, [pagination]);
  const lastFetchRef = useRef(null);
  const hasFetchedRef = useRef(false);

  const fetchItems = useCallback(async (force = false, reset = false) => {
    if (!isLoaded || !user) {
      console.log("ItemContext: User not loaded or not authenticated", {
        isLoaded,
        user: !!user,
      });
      setLoading(false);
      return;
    }

    // Check cache validity for initial load
    const now = Date.now();
    if (!force && !reset && hasFetchedRef.current && lastFetchRef.current && (now - lastFetchRef.current) < CACHE_DURATION) {
      console.log("ItemContext: Using cached data");
      return;
    }

    try {
      const isInitialLoad = reset || !hasFetchedRef.current;
      if (isInitialLoad) {
        console.log("ItemContext: Fetching items from API");
        setLoading(true);
        setPagination(prev => ({ ...prev, page: 1 }));
      }
      
      setError(null);
      const page = isInitialLoad ? 1 : paginationRef.current.page;
      const response = await axios.get(`/api/items?page=${page}&limit=${paginationRef.current.limit}`);
      console.log("ItemContext: Received items:", response.data);
      
      if (reset || isInitialLoad) {
        setItems(response.data.items);
      } else {
        setItems(prev => [...prev, ...response.data.items]);
      }
      
      setPagination({
        page: response.data.pagination.page,
        limit: response.data.pagination.limit,
        totalCount: response.data.pagination.totalCount,
        totalPages: response.data.pagination.totalPages,
        hasMore: response.data.pagination.hasMore,
      });
      
      hasFetchedRef.current = true;
      lastFetchRef.current = now;
      setLastFetch(now);
    } catch (err) {
      console.error("ItemContext: Error fetching items:", err);
      setError(err.response?.data?.error || "Failed to fetch items");
    } finally {
      setLoading(false);
    }
  }, [isLoaded, userId, CACHE_DURATION]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMoreItems = useCallback(async () => {
    const currentPagination = paginationRef.current;
    if (!currentPagination.hasMore || loadingMoreRef.current) return;

    try {
      loadingMoreRef.current = true;
      setLoadingMore(true);
      setError(null);
      const nextPage = currentPagination.page + 1;
      const response = await axios.get(`/api/items?page=${nextPage}&limit=${currentPagination.limit}`);
      
      setItems(prev => [...prev, ...response.data.items]);
      setPagination({
        page: response.data.pagination.page,
        limit: response.data.pagination.limit,
        totalCount: response.data.pagination.totalCount,
        totalPages: response.data.pagination.totalPages,
        hasMore: response.data.pagination.hasMore,
      });
    } catch (err) {
      console.error("ItemContext: Error loading more items:", err);
      setError("Failed to load more items");
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, []);

  const addItem = async (itemData) => {
    try {
      setError(null);
      const response = await axios.post("/api/items", itemData);
      const newItem = response.data;
      setItems((prevItems) => [newItem, ...prevItems]);
      setLastFetch(Date.now());
      return newItem;
    } catch (err) {
      console.error("ItemContext: Error adding item:", err);
      const errorMessage = err.response?.data?.error || "Failed to add item";
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const updateItem = async (itemId, itemData) => {
    try {
      setError(null);
      const response = await axios.put(`/api/items/${itemId}`, itemData);
      const updatedItem = response.data;
      setItems((prevItems) =>
        prevItems.map((item) => (item.id === itemId ? updatedItem : item))
      );
      setLastFetch(Date.now());
      return updatedItem;
    } catch (err) {
      console.error("ItemContext: Error updating item:", err);
      const errorMessage = err.response?.data?.error || "Failed to update item";
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const deleteItem = async (itemId) => {
    try {
      setError(null);
      await axios.delete(`/api/items/${itemId}`);
      setItems((prevItems) => prevItems.filter((item) => item.id !== itemId));
      setLastFetch(Date.now());
    } catch (err) {
      console.error("ItemContext: Error deleting item:", err);
      const errorMessage = err.response?.data?.error || "Failed to delete item";
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const getItemById = (itemId) => {
    return items.find((item) => item.id === itemId);
  };

  const getItemsForClient = async (clientId) => {
    try {
      setError(null);
      const response = await axios.get(`/api/items/client/${clientId}`);
      return response.data;
    } catch (err) {
      console.error("ItemContext: Error fetching items for client:", err);
      const errorMessage =
        err.response?.data?.error || "Failed to fetch items for client";
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const refreshItems = () => {
    fetchItems(true, true); // force refresh and reset pagination
  };

  // Items are loaded on demand by the pages that show them (see item-list.jsx),
  // instead of on every page load across the app.

  const value = {
    items,
    loading,
    loadingMore,
    error,
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
