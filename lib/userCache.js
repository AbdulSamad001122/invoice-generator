import { clerkClient } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
// clerkClient() from @clerk/nextjs picks up the configured keys automatically
// (CLERK_SECRET_KEY, or Clerk's keyless-mode keys during local development).

// In-memory cache for user data with size limits and LRU eviction
const userCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes (only the immutable DB id is cached)
const MAX_CACHE_SIZE = 1000; // Maximum number of cached users
const CLEANUP_INTERVAL = 10 * 60 * 1000; // Cleanup every 10 minutes

// In-flight lookups, so concurrent requests for the same user share one
// DB/Clerk round-trip instead of each issuing their own (and racing on create)
const inFlight = new Map();

// Track access order for LRU eviction
const accessOrder = new Map();
let accessCounter = 0;

// Periodic cleanup to prevent memory leaks
let cleanupTimer = null;

/**
 * Initialize cleanup timer
 */
function initializeCleanup() {
  if (cleanupTimer) return;
  
  cleanupTimer = setInterval(() => {
    cleanupExpiredEntries();
    enforceCacheSize();
  }, CLEANUP_INTERVAL);
  
  // Ensure cleanup runs on process exit
  process.on('exit', () => {
    if (cleanupTimer) {
      clearInterval(cleanupTimer);
    }
  });
}

/**
 * Remove expired entries from cache
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  const expiredKeys = [];
  
  for (const [key, value] of userCache.entries()) {
    if (now - value.timestamp >= CACHE_TTL) {
      expiredKeys.push(key);
    }
  }
  
  expiredKeys.forEach(key => {
    userCache.delete(key);
    accessOrder.delete(key);
  });
  
  if (expiredKeys.length > 0) {
    console.log(`Cleaned up ${expiredKeys.length} expired cache entries`);
  }
}

/**
 * Enforce maximum cache size using LRU eviction
 */
function enforceCacheSize() {
  if (userCache.size <= MAX_CACHE_SIZE) return;
  
  // Sort by access order (oldest first)
  const sortedEntries = Array.from(accessOrder.entries())
    .sort((a, b) => a[1] - b[1]);
  
  const entriesToRemove = userCache.size - MAX_CACHE_SIZE;
  const keysToRemove = sortedEntries.slice(0, entriesToRemove).map(([key]) => key);
  
  keysToRemove.forEach(key => {
    userCache.delete(key);
    accessOrder.delete(key);
  });
  
  console.log(`Evicted ${keysToRemove.length} LRU cache entries to enforce size limit`);
}

/**
 * Update access order for LRU tracking
 */
function updateAccessOrder(key) {
  accessOrder.set(key, ++accessCounter);
}

// Initialize cleanup on module load
initializeCleanup();

/**
 * Load the user's DB row id, creating the row on first sight.
 * Only `id` is selected: callers use it purely for ownership scoping, and
 * routes that need profile fields query them directly.
 * Clerk is only contacted when the row does not exist yet.
 */
async function loadUser(clerkUserId) {
  const existing = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true },
  });
  if (existing) return existing;

  const clerkUser = await (await clerkClient()).users.getUser(clerkUserId);
  const username = clerkUser.username || clerkUser.firstName || "Unknown";

  try {
    return await prisma.user.upsert({
      where: { clerkId: clerkUserId },
      update: {},
      create: {
        name: username,
        clerkId: clerkUserId,
      },
      select: { id: true },
    });
  } catch (error) {
    // Another request (e.g. a different server instance) created the row
    // between our read and write; the unique constraint fired, so re-read it.
    if (error?.code === "P2002") {
      const created = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
        select: { id: true },
      });
      if (created) return created;
    }
    throw error;
  }
}

/**
 * Get or create user with caching to reduce database queries
 * @param {string} clerkUserId - Clerk user ID
 * @returns {Promise<{id: string}>} User's database id
 */
export async function getCachedUser(clerkUserId) {
  if (!clerkUserId) {
    throw new Error('User ID is required');
  }

  // Check cache first
  const cacheKey = `user_${clerkUserId}`;
  const cached = userCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    // Update access order for LRU tracking
    updateAccessOrder(cacheKey);
    return cached.user;
  }

  // Share an already-running lookup for this user
  const pending = inFlight.get(cacheKey);
  if (pending) return pending;

  const promise = (async () => {
    try {
      const dbUser = await loadUser(clerkUserId);

      // Cache the result with LRU tracking
      userCache.set(cacheKey, {
        user: dbUser,
        timestamp: Date.now(),
      });
      updateAccessOrder(cacheKey);

      // Enforce cache size limits
      enforceCacheSize();

      return dbUser;
    } catch (error) {
      console.error('Error in getCachedUser:', error);
      throw error;
    } finally {
      inFlight.delete(cacheKey);
    }
  })();

  inFlight.set(cacheKey, promise);
  return promise;
}

/**
 * Clear user from cache (useful when user data is updated)
 * @param {string} clerkUserId - Clerk user ID
 */
export function clearUserCache(clerkUserId) {
  const cacheKey = `user_${clerkUserId}`;
  userCache.delete(cacheKey);
  inFlight.delete(cacheKey);
  accessOrder.delete(cacheKey);
}

/**
 * Clear all cached users (useful for testing or memory management)
 */
export function clearAllUserCache() {
  userCache.clear();
  inFlight.clear();
  accessOrder.clear();
  accessCounter = 0;
}

/**
 * Get cache statistics for monitoring
 */
export function getCacheStats() {
  const now = Date.now();
  let expiredCount = 0;
  
  // Count expired entries
  for (const [key, value] of userCache.entries()) {
    if (now - value.timestamp >= CACHE_TTL) {
      expiredCount++;
    }
  }
  
  return {
    size: userCache.size,
    maxSize: MAX_CACHE_SIZE,
    expiredEntries: expiredCount,
    accessOrderSize: accessOrder.size,
    inFlight: inFlight.size,
    accessCounter,
    cacheTTL: CACHE_TTL,
    cleanupInterval: CLEANUP_INTERVAL,
    keys: Array.from(userCache.keys()),
    memoryUsage: {
      cacheEntries: userCache.size,
      accessOrderEntries: accessOrder.size,
      estimatedMemoryKB: Math.round((userCache.size * 0.5) + (accessOrder.size * 0.1)) // Rough estimate
    }
  };
}