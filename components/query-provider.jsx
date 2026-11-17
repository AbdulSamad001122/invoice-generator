"use client";

import { useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider, dehydrate, hydrate } from "@tanstack/react-query";
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
        // One retry for flaky requests, but never when rate limited (429):
        // retrying would only spend more of the limit.
        retry: (failureCount, error) => error?.response?.status !== 429 && failureCount < 1,
      },
    },
  });
}

// ---------- Cache that survives a page refresh
// The query cache lives in memory, so a refresh used to start from nothing.
// We save the loaded data (clients, invoice lists, items, company profile) to
// localStorage and restore it right after the page mounts, so a refresh shows
// the previous data instantly. Restored data is marked stale, so it is quietly
// refreshed from the server in the background as soon as it's on screen.
// Safety: saved per user and wiped when the user signs out or a different
// account signs in; ignored after 24 hours.
const STORAGE_KEY = "invoice-app-query-cache:v1";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const PERSISTED_ROOTS = new Set(["clients", "client", "invoices", "items", "companyProfile"]);

const shouldPersist = (query) => {
  const [root, second] = query.queryKey;
  if (!PERSISTED_ROOTS.has(root)) return false;
  if (root === "clients" && second === "search") return false; // per-keystroke results
  return query.state.status === "success";
};

const readSaved = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!saved?.state || Date.now() - (saved.savedAt || 0) > MAX_AGE_MS) return null;
    return saved;
  } catch {
    return null;
  }
};

const removeSaved = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable (private mode etc.): nothing to remove
  }
};

function PersistQueryCache({ client }) {
  const { isLoaded, userId } = useAuth();
  const restoredUserId = useRef(undefined); // whose data was restored (null = none)
  const userIdRef = useRef(null);
  userIdRef.current = isLoaded ? userId ?? null : null;

  // 1) Restore once, right after mount. This component renders before the pages,
  //    so its effect runs before their queries subscribe; restoring after mount
  //    (not during render) keeps server and client HTML identical (no hydration errors).
  useEffect(() => {
    const saved = readSaved();
    restoredUserId.current = null;
    if (!saved) return;
    hydrate(client, saved.state);
    restoredUserId.current = saved.userId;
    // Show it now, refresh it in the background once a page uses it
    client.invalidateQueries({ refetchType: "none" });
  }, [client]);

  // 2) Never show one account's saved data to another, or after signing out
  useEffect(() => {
    if (!isLoaded) return;
    if (!userId) {
      removeSaved();
      if (restoredUserId.current) client.clear();
      restoredUserId.current = null;
      return;
    }
    if (restoredUserId.current && restoredUserId.current !== userId) {
      client.clear();
      removeSaved();
      restoredUserId.current = null;
    }
  }, [isLoaded, userId, client]);

  // 3) Save (throttled) whenever the cache changes, and when the page is hidden
  useEffect(() => {
    let timer = null;
    const save = () => {
      timer = null;
      const currentUser = userIdRef.current;
      if (!currentUser) return;
      try {
        const state = dehydrate(client, { shouldDehydrateQuery: shouldPersist });
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ userId: currentUser, savedAt: Date.now(), state })
        );
      } catch {
        // Quota exceeded or storage unavailable: caching across refreshes is best effort
        removeSaved();
      }
    };
    const schedule = () => {
      if (!timer) timer = setTimeout(save, 1000);
    };
    const unsubscribe = client.getQueryCache().subscribe(schedule);
    const onHide = () => {
      if (timer) clearTimeout(timer);
      save();
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      unsubscribe();
      window.removeEventListener("pagehide", onHide);
      if (timer) clearTimeout(timer);
    };
  }, [client]);

  return null;
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
      removeSaved();
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
      {/* Must stay before {children}: its restore effect has to run first */}
      <PersistQueryCache client={client} />
      <ClearCacheOnUserChange client={client} />
      {children}
    </QueryClientProvider>
  );
}
