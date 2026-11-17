"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Calls onLoadMore when a sentinel element scrolls into view.
//
//   const sentinelRef = useInfiniteScroll({
//     enabled: hasMore && !isFetchingNextPage,
//     loading: isFetchingNextPage,
//     onLoadMore: loadMore,
//     rootRef: scrollContainerRef, // optional; defaults to the viewport
//   });
//   ...
//   <div ref={sentinelRef} aria-hidden />
//
// - The callback is kept in a ref, so an unstable onLoadMore never re-creates the observer.
// - The observer is re-created when `loading` changes: if the sentinel is still
//   visible after a page arrives (a short page that doesn't fill the screen),
//   the fresh observer fires again and loads the next page. It stops as soon as
//   `enabled` turns false (no more pages), so it cannot loop.
// - Returns a callback ref, so it works when the sentinel mounts later (e.g.
//   after a loading skeleton) or switches between elements (list/grid views).
export function useInfiniteScroll({
  enabled = true,
  loading = false,
  onLoadMore,
  rootRef,
  rootMargin = "200px",
} = {}) {
  const callbackRef = useRef(onLoadMore);
  const [node, setNode] = useState(null);

  useEffect(() => {
    callbackRef.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    if (!enabled || loading || !node) return undefined;
    if (typeof IntersectionObserver === "undefined") return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          callbackRef.current?.();
        }
      },
      { root: rootRef?.current ?? null, rootMargin }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, loading, node, rootRef, rootMargin]);

  return useCallback((element) => setNode(element), []);
}
