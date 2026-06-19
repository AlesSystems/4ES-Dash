/**
 * In-memory cache (oldest-insert eviction) with stale-while-revalidate support.
 *
 * This is the Phase 0 implementation (no Redis dependency). The public API
 * is identical to what a Redis-backed implementation would expose, so swapping
 * it in production is a one-file change. Concurrent misses on the same key are
 * de-duplicated (single-flight, #85): N simultaneous misses run the loader
 * exactly once and all share the result.
 *
 * Public surface:
 *   cache<T>(key, ttlSeconds, loader) → Promise<{ value: T; stale: boolean }>
 *   clearCache()                      → void  (tests / hot-reload)
 *   TTL                               → re-exported from ./cache/ttl
 *   cacheKey                          → re-exported from ./cache/ttl
 */

export { TTL, cacheKey } from './cache/ttl';

// ---------------------------------------------------------------------------
// Internal store
// ---------------------------------------------------------------------------

interface Entry<T> {
  value: T;
  expiresAt: number; // epoch-ms from Date.now()
  insertedAt: number; // epoch-ms — used for LRU eviction ordering
}

const MAX_ENTRIES = 500;

// We use `unknown` here because the store holds heterogeneous types.
const store = new Map<string, Entry<unknown>>();

// In-flight loader promises, keyed by cache key. Lets concurrent misses on the
// same key collapse onto a single loader invocation (single-flight, #85).
const inFlight = new Map<string, Promise<unknown>>();

/** Remove all entries — use in tests (beforeEach) or on hot-reload. */
export function clearCache(): void {
  store.clear();
  inFlight.clear();
}

// ---------------------------------------------------------------------------
// LRU eviction
// ---------------------------------------------------------------------------

/** Evict the single entry with the smallest `insertedAt` (oldest insert). */
function evictOldest(): void {
  let oldestKey: string | undefined;
  let oldestTime = Infinity;

  for (const [key, entry] of store) {
    if (entry.insertedAt < oldestTime) {
      oldestTime = entry.insertedAt;
      oldestKey = key;
    }
  }

  if (oldestKey !== undefined) {
    store.delete(oldestKey);
  }
}

// ---------------------------------------------------------------------------
// Public cache helper
// ---------------------------------------------------------------------------

/**
 * Read-through cache helper.
 *
 * Behaviour:
 * - **Hit within TTL** → return `{ value, stale: false }` without calling loader.
 * - **Miss or expired** → call loader, store result, return `{ value, stale: false }`.
 * - **Stale-while-revalidate** → if loader throws AND a previous value exists
 *   (even if expired) → return `{ value: <previous>, stale: true }` and swallow
 *   the error.
 * - **Cold failure** → if loader throws and there is no previous value → rethrow.
 */
export async function cache<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<{ value: T; stale: boolean }> {
  const now = Date.now();
  const existing = store.get(key) as Entry<T> | undefined;

  // Cache hit within TTL
  if (existing !== undefined && existing.expiresAt > now) {
    return { value: existing.value, stale: false };
  }

  // Single-flight: if a loader for this key is already running, join it instead
  // of starting a second one. N concurrent misses → loader runs exactly once.
  const pending = inFlight.get(key) as Promise<T> | undefined;
  if (pending !== undefined) {
    try {
      const value = await pending;
      return { value, stale: false };
    } catch (err) {
      // The shared loader failed — preserve stale-while-revalidate semantics.
      if (existing !== undefined) {
        return { value: existing.value, stale: true };
      }
      throw err;
    }
  }

  // Cache miss or expired — call loader, registering it as the single in-flight
  // load for this key so concurrent callers can join it.
  const promise = loader();
  inFlight.set(key, promise);
  try {
    const value = await promise;
    const entry: Entry<T> = {
      value,
      expiresAt: now + ttlSeconds * 1000,
      insertedAt: now,
    };

    if (store.size >= MAX_ENTRIES) {
      evictOldest();
    }

    store.set(key, entry as Entry<unknown>);
    return { value, stale: false };
  } catch (err) {
    // Stale-while-revalidate: return previous value (even if expired) on error
    if (existing !== undefined) {
      return { value: existing.value, stale: true };
    }
    // No prior value — propagate
    throw err;
  } finally {
    inFlight.delete(key);
  }
}
