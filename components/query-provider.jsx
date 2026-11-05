"use client";

import { useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";

// Defaults tuned for this app: data is shown instantly from cache when you come
// back to a page, and refreshed quietly in the background once it is a minute old.
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // fresh for 1 minute: no refetch when navigating back
        gcTime: 30 * 60 * 1000, // keep unused data in memory for 30 minutes
        refetchOnWindowFocus: false, // avoid surprise reloads when switching tabs
        retry: 1,
      },
    },
  });
}

// Clears all cached data when the signed-in user changes (sign out, or a
// different account), so one user's data can never be shown to another.
function ClearCacheOnUserChange({ client }) {
  const { isLoaded, userId } = useAuth();
  const previous = useRef(undefined);

  useEffect(() => {
    if (!isLoaded) return;
    if (previous.current !== undefined && previous.current !== userId) {
      client.clear();
    }
    previous.current = userId ?? null;
  }, [isLoaded, userId, client]);

  return null;
}

export function QueryProvider({ children }) {
  // One client per browser session (useState keeps it stable across renders)
  const [client] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={client}>
      <ClearCacheOnUserChange client={client} />
      {children}
    </QueryClientProvider>
  );
}
