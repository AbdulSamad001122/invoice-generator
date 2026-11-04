"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useUser } from '@clerk/nextjs';

const InvoiceContext = createContext();

export function useInvoices() {
  const context = useContext(InvoiceContext);
  if (!context) {
    throw new Error('useInvoices must be used within an InvoiceProvider');
  }
  return context;
}

export function InvoiceProvider({ children }) {
  const { user, isLoaded } = useUser();
  const [invoicesByClient, setInvoicesByClient] = useState({});
  const [loading, setLoading] = useState({});
  const [loadingMore, setLoadingMore] = useState({});
  const [searchLoading, setSearchLoading] = useState({});
  const [error, setError] = useState({});
  const [lastFetch, setLastFetch] = useState({});
  const [pagination, setPagination] = useState({});

  // Refs mirror state so callbacks can read the latest values synchronously.
  // (Reading state through setState updaters is unreliable in React 18+.)
  const userId = user?.id;
  const lastFetchRef = useRef({});
  const paginationRef = useRef({});
  const invoicesRef = useRef({});
  const loadingMoreRef = useRef({});
  // Active search filters per client, so "load more" keeps filtering
  const searchParamsRef = useRef({});
  useEffect(() => { lastFetchRef.current = lastFetch; }, [lastFetch]);
  useEffect(() => { paginationRef.current = pagination; }, [pagination]);
  useEffect(() => { invoicesRef.current = invoicesByClient; }, [invoicesByClient]);

  // Cache duration: 2 minutes for invoices (shorter than clients as they change more frequently)
  const CACHE_DURATION = 2 * 60 * 1000;
  const MAX_CACHED_CLIENTS = 50; // Limit number of cached client invoice lists

  // Cleanup old cache entries to prevent memory buildup
  const cleanupCache = useCallback(() => {
    setInvoicesByClient(prev => {
      const clientIds = Object.keys(prev);
      if (clientIds.length <= MAX_CACHED_CLIENTS) return prev;
      
      // Sort by last fetch time and keep only the most recent entries
      const sortedIds = clientIds.sort((a, b) => (lastFetch[b] || 0) - (lastFetch[a] || 0));
      const idsToKeep = sortedIds.slice(0, MAX_CACHED_CLIENTS);
      
      const cleaned = {};
      idsToKeep.forEach(id => {
        cleaned[id] = prev[id];
      });
      return cleaned;
    });
    
    setLastFetch(prev => {
      const cleaned = {};
      // Use functional state update to get current invoicesByClient
      setInvoicesByClient(currentInvoices => {
        Object.keys(prev).forEach(id => {
          if (Object.keys(currentInvoices).includes(id)) {
            cleaned[id] = prev[id];
          }
        });
        return currentInvoices;
      });
      return cleaned;
    });
  }, []);

  const fetchInvoices = useCallback(async (clientId, force = false, reset = false, searchParams = {}) => {
    // Skip if not authenticated or still loading
    if (!isLoaded || !user || !clientId) {
      return;
    }

    // Always fetch when search parameters are provided
    const hasSearchParams = Object.keys(searchParams).some(key => searchParams[key]);
    // Remember (or clear) the active filters for this client
    if (reset || hasSearchParams) {
      searchParamsRef.current = { ...searchParamsRef.current, [clientId]: hasSearchParams ? searchParams : null };
    }

    // Check if we have fresh data and don't need to force refresh
    const lastFetchTime = lastFetchRef.current[clientId];
    
    if (!force && !reset && !hasSearchParams && lastFetchTime && Date.now() - lastFetchTime < CACHE_DURATION) {
      return;
    }

    try {
      // Use functional state updates to avoid dependency issues
      const existing = invoicesRef.current[clientId];
      const isInitialLoad = reset || !existing || existing.length === 0;
      const currentPagination = paginationRef.current[clientId] || { page: 1, limit: 10 };

      if (isInitialLoad) {
        setPagination(prev => ({ ...prev, [clientId]: { page: 1, limit: 10, totalCount: 0, totalPages: 0, hasMore: false } }));
      }
      
      // Use different loading states for search vs initial load
      if (hasSearchParams) {
        setSearchLoading(prev => ({ ...prev, [clientId]: true }));
      } else if (isInitialLoad) {
        setLoading(prev => ({ ...prev, [clientId]: true }));
      }
      
      setError(prev => ({ ...prev, [clientId]: null }));
      
      const page = reset ? 1 : currentPagination.page;
      
      // Build query parameters
      const queryParams = new URLSearchParams({
        clientId,
        page: page.toString(),
        limit: currentPagination.limit.toString()
      });
      
      // Add search parameters if provided
      if (searchParams.search) queryParams.append('search', searchParams.search);
      if (searchParams.date) queryParams.append('date', searchParams.date);
      if (searchParams.status) queryParams.append('status', searchParams.status);
      
      const response = await axios.get(`/api/invoices?${queryParams.toString()}`);
      
      const newInvoices = response.data.invoices || [];
      
      // Always reset when search parameters are provided to avoid mixing results
      if (reset || isInitialLoad || hasSearchParams) {
        setInvoicesByClient(prev => ({
          ...prev,
          [clientId]: newInvoices
        }));
      } else {
        setInvoicesByClient(prev => {
          const existingInvoices = prev[clientId] || [];
          const existingIds = new Set(existingInvoices.map(invoice => invoice.id));
          const uniqueNewInvoices = newInvoices.filter(invoice => !existingIds.has(invoice.id));
          
          return {
            ...prev,
            [clientId]: [...existingInvoices, ...uniqueNewInvoices]
          };
        });
      }
      
      setPagination(prev => ({
        ...prev,
        [clientId]: {
          page: response.data.pagination.page,
          limit: response.data.pagination.limit,
          totalCount: response.data.pagination.totalCount,
          totalPages: response.data.pagination.totalPages,
          hasMore: response.data.pagination.hasMore,
        }
      }));
      
      // A filtered list is not the client's full list: don't treat it as a fresh
      // cache, so coming back to this client loads the full list again.
      const fetchedAt = hasSearchParams ? 0 : Date.now();
      lastFetchRef.current = { ...lastFetchRef.current, [clientId]: fetchedAt };
      setLastFetch(prev => ({
        ...prev,
        [clientId]: fetchedAt
      }));
      
      // Cleanup cache if needed
      setTimeout(cleanupCache, 0);
    } catch (err) {
      console.error('Error fetching invoices:', err);
      setError(prev => ({
        ...prev,
        [clientId]: err.message
      }));
      // Keep existing invoices on error to avoid empty state
    } finally {
      setLoading(prev => ({ ...prev, [clientId]: false }));
      setSearchLoading(prev => ({ ...prev, [clientId]: false }));
    }
  }, [isLoaded, userId, CACHE_DURATION]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMoreInvoices = useCallback(async (clientId) => {
    const clientPagination = paginationRef.current[clientId];
    if (!clientPagination?.hasMore || loadingMoreRef.current[clientId]) return;

    try {
      loadingMoreRef.current = { ...loadingMoreRef.current, [clientId]: true };
      setLoadingMore(prev => ({ ...prev, [clientId]: true }));
      setError(prev => ({ ...prev, [clientId]: null }));
      
      const nextPage = clientPagination.page + 1;
      const query = new URLSearchParams({
        clientId,
        page: String(nextPage),
        limit: String(clientPagination.limit),
      });
      const activeSearch = searchParamsRef.current[clientId];
      if (activeSearch?.search) query.append("search", activeSearch.search);
      if (activeSearch?.date) query.append("date", activeSearch.date);
      if (activeSearch?.status) query.append("status", activeSearch.status);
      const response = await axios.get(`/api/invoices?${query.toString()}`);
      
      const newInvoices = response.data.invoices || [];
      
      setInvoicesByClient(prev => {
        const existingInvoices = prev[clientId] || [];
        const existingIds = new Set(existingInvoices.map(invoice => invoice.id));
        const uniqueNewInvoices = newInvoices.filter(invoice => !existingIds.has(invoice.id));
        
        return {
          ...prev,
          [clientId]: [...existingInvoices, ...uniqueNewInvoices]
        };
      });
      
      setPagination(prev => ({
        ...prev,
        [clientId]: {
          page: response.data.pagination.page,
          limit: response.data.pagination.limit,
          totalCount: response.data.pagination.totalCount,
          totalPages: response.data.pagination.totalPages,
          hasMore: response.data.pagination.hasMore,
        }
      }));
    } catch (err) {
      console.error('Error loading more invoices:', err);
      setError(prev => ({
        ...prev,
        [clientId]: 'Failed to load more invoices'
      }));
    } finally {
      loadingMoreRef.current = { ...loadingMoreRef.current, [clientId]: false };
      setLoadingMore(prev => ({ ...prev, [clientId]: false }));
    }
  }, []);

  const createInvoice = useCallback(async (newInvoice) => {
    try {
      const clientId = newInvoice.clientId;

      // Keep the total in sync (checked outside the state updater, which may run twice)
      const alreadyListed = (invoicesRef.current[clientId] || []).some(inv => inv.id === newInvoice.id);
      if (!alreadyListed) {
        setPagination(p => p[clientId]
          ? { ...p, [clientId]: { ...p[clientId], totalCount: (p[clientId].totalCount || 0) + 1 } }
          : p);
      }

      // Add the already created invoice to the list
      setInvoicesByClient(prev => {
        const existingInvoices = prev[clientId] || [];
        const existingIds = new Set(existingInvoices.map(invoice => invoice.id));

        // Only add if it doesn't already exist
        if (!existingIds.has(newInvoice.id)) {
          return {
            ...prev,
            [clientId]: [newInvoice, ...existingInvoices]
          };
        }
        
        return prev;
      });
      
      setLastFetch(prev => ({
        ...prev,
        [clientId]: Date.now()
      }));
      
      return newInvoice;
    } catch (err) {
      console.error('Error adding invoice to context:', err);
      throw err;
    }
  }, []);

  const updateInvoice = useCallback(async (invoiceId, updatedInvoice) => {
    try {
      const clientId = updatedInvoice.clientId;
      
      // Update the invoice list with the already updated invoice
      setInvoicesByClient(prev => ({
        ...prev,
        [clientId]: (prev[clientId] || []).map(invoice => 
          invoice.id === invoiceId ? updatedInvoice : invoice
        )
      }));
      
      setLastFetch(prev => ({
        ...prev,
        [clientId]: Date.now()
      }));
      
      return updatedInvoice;
    } catch (err) {
      console.error('Error updating invoice:', err);
      throw err;
    }
  }, []);

  const updateInvoiceStatus = useCallback(async (invoiceId, status, clientId) => {
    try {
      const response = await axios.patch(`/api/invoices?id=${invoiceId}`, { status });
      const updatedInvoice = response.data.invoice;
      
      // Optimistically update the invoice list
      setInvoicesByClient(prev => ({
        ...prev,
        [clientId]: (prev[clientId] || []).map(invoice => 
          invoice.id === invoiceId ? updatedInvoice : invoice
        )
      }));
      
      setLastFetch(prev => ({
        ...prev,
        [clientId]: Date.now()
      }));
      
      return updatedInvoice;
    } catch (err) {
      console.error('Error updating invoice status:', err);
      throw err;
    }
  }, []);

  const duplicateInvoice = useCallback(async (invoiceId, clientId) => {
    try {
      const response = await axios.post(`/api/invoices/duplicate`, { invoiceId });
      const duplicatedInvoice = response.data.invoice;
      
      // Add the duplicated invoice to the beginning of the list
      setPagination(prev => prev[clientId]
        ? { ...prev, [clientId]: { ...prev[clientId], totalCount: (prev[clientId].totalCount || 0) + 1 } }
        : prev);
      setInvoicesByClient(prev => {
        const existingInvoices = prev[clientId] || [];
        return {
          ...prev,
          [clientId]: [duplicatedInvoice, ...existingInvoices]
        };
      });
      
      setLastFetch(prev => ({
        ...prev,
        [clientId]: Date.now()
      }));
      
      return duplicatedInvoice;
    } catch (err) {
      console.error('Error duplicating invoice:', err);
      throw err;
    }
  }, []);

  const deleteInvoice = useCallback(async (invoiceId, clientId) => {
    try {
      await axios.delete(`/api/invoices?id=${invoiceId}`);
      
      // Refresh the invoice list to get updated invoice numbers after re-arrangement
      await fetchInvoices(clientId, true, true);
    } catch (err) {
      console.error('Error deleting invoice:', err);
      throw err;
    }
  }, [fetchInvoices]);

  const deleteAllInvoices = useCallback(async (clientId) => {
    try {
      // Get all invoices for the client
      const clientInvoices = invoicesByClient[clientId] || [];
      
      if (clientInvoices.length === 0) {
        return;
      }

      // Delete all invoices for this client
      await axios.delete(`/api/invoices/bulk?clientId=${clientId}`);
      
      // Clear the client's invoices from the state
      setInvoicesByClient(prev => ({
        ...prev,
        [clientId]: []
      }));
      
      // Update pagination
      setPagination(prev => ({
        ...prev,
        [clientId]: { page: 1, limit: 10, totalCount: 0, totalPages: 0, hasMore: false }
      }));
      
      setLastFetch(prev => ({
        ...prev,
        [clientId]: Date.now()
      }));
    } catch (err) {
      console.error('Error deleting all invoices:', err);
      throw err;
    }
  }, [invoicesByClient]);

  const getInvoicesForClient = useCallback((clientId) => {
    return invoicesByClient[clientId] || [];
  }, [invoicesByClient]);

  const getInvoiceById = useCallback((invoiceId, clientId) => {
    const clientInvoices = invoicesByClient[clientId] || [];
    return clientInvoices.find(invoice => invoice.id === invoiceId);
  }, [invoicesByClient]);

  const refreshInvoices = useCallback((clientId) => {
    return fetchInvoices(clientId, true, true); // force refresh and reset pagination
  }, [fetchInvoices]);

  // Mark every cached client list as stale so it reloads next time it's shown
  const invalidateAllInvoices = useCallback(() => {
    lastFetchRef.current = {};
    setLastFetch({});
  }, []);

  const clearClientInvoices = useCallback((clientId) => {
    setInvoicesByClient(prev => {
      const newState = { ...prev };
      delete newState[clientId];
      return newState;
    });
    setLastFetch(prev => {
      const newState = { ...prev };
      delete newState[clientId];
      return newState;
    });
    setLoading(prev => {
      const newState = { ...prev };
      delete newState[clientId];
      return newState;
    });
    setError(prev => {
      const newState = { ...prev };
      delete newState[clientId];
      return newState;
    });
  }, []);

  const value = {
    invoicesByClient,
    loading,
    loadingMore,
    searchLoading,
    error,
    pagination,
    fetchInvoices,
    loadMoreInvoices,
    createInvoice,
    updateInvoice,
    updateInvoiceStatus,
    duplicateInvoice,
    deleteInvoice,
    deleteAllInvoices,
    getInvoicesForClient,
    getInvoiceById,
    refreshInvoices,
    clearClientInvoices,
    invalidateAllInvoices,
    lastFetch
  };

  return (
    <InvoiceContext.Provider value={value}>
      {children}
    </InvoiceContext.Provider>
  );
}