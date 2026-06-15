/**
 * Cached repository for Store API data (game metadata and price).
 *
 * These are per-app caches (not per-user), so we use 'global' as the steamId
 * slot in the cache key. TTLs come from the single source of truth in
 * server/cache/ttl.ts (storeMetadata = 7d, storePrice = 1h).
 *
 * The loaders never throw (they return Availability<T>), so the cache wraps the
 * Availability value directly. We unwrap `.value` before returning.
 */

import { cache, cacheKey, TTL } from '@/server/cache';
import { getStoreMetadata, getStorePrice } from '@/lib/steam/store-client';
import type { Availability } from '@/lib/result';
import type { StoreMetadata, StorePrice } from '@/lib/steam/store-client';

/**
 * Returns Store metadata for a game, served from cache (7-day TTL).
 * Degrades to `unavailable('metadata-unavailable')` on upstream failure.
 */
export async function getGameStoreMetadata(appId: number): Promise<Availability<StoreMetadata>> {
  const key = cacheKey('store-metadata', 'global', appId);
  const result = await cache(key, TTL.storeMetadata, () => getStoreMetadata(appId));
  return result.value;
}

/**
 * Returns current store price for a game, served from cache (1-hour TTL).
 * Returns `available(null)` for free games.
 * Degrades to `unavailable('metadata-unavailable')` on upstream failure.
 */
export async function getGameStorePrice(appId: number): Promise<Availability<StorePrice>> {
  const key = cacheKey('store-price', 'global', appId);
  const result = await cache(key, TTL.storePrice, () => getStorePrice(appId));
  return result.value;
}
