/**
 * Aggregates the current Steam store prices for all owned games into a single
 * library value summary (issue #29).
 *
 * Uses getGameStorePrice (1-hour TTL via server/cache/ttl.ts) — never adds its
 * own TTL or magic numbers. Never throws; degrades gracefully per Availability<T>.
 */

import { getProfile } from '@/server/repositories/profile';
import { getGameStorePrice } from '@/server/repositories/store';
import { isAvailable } from '@/lib/result';

export interface LibraryValue {
  /** Sum of finalCents across priced games (free/missing contribute 0). */
  totalMinor: number;
  /** ISO currency code from the first priced game; '' if no game is priced. */
  currency: string;
  /** Games with a real (non-null) price_overview. */
  pricedCount: number;
  /** Games where available(null) — free; counted, contributes 0 to total. */
  freeCount: number;
  /** Games where the Store API was unavailable; treated as 0, never NaN. */
  missingCount: number;
  /** True if any underlying price result was served stale. */
  stale: boolean;
}

/**
 * Returns the aggregated current store value of the configured user's library.
 *
 * Accounting rules:
 * - available(StorePrice)    → priced: adds finalCents, increments pricedCount.
 * - available(null)          → free: increments freeCount, adds 0 to total.
 * - unavailable(...)         → missing: increments missingCount, adds 0 to total.
 *
 * Promise.all is used so the Store client's global rate-limiter serialises
 * naturally; no additional throttle is introduced here.
 */
export async function getLibraryValue(): Promise<LibraryValue> {
  const { games } = await getProfile();

  const prices = await Promise.all(games.map((g) => getGameStorePrice(g.appId)));

  let totalMinor = 0;
  let currency = '';
  let pricedCount = 0;
  let freeCount = 0;
  let missingCount = 0;
  let stale = false;

  for (const result of prices) {
    if (isAvailable(result)) {
      if (result.stale) stale = true;

      if (result.data !== null) {
        // Priced game — add to total and capture currency from the first one.
        totalMinor += result.data.finalCents;
        if (currency === '') currency = result.data.currency;
        pricedCount++;
      } else {
        // Free game — available but null price_overview.
        freeCount++;
      }
    } else {
      // Store API unavailable for this game — treat as 0, never throw.
      missingCount++;
    }
  }

  return { totalMinor, currency, pricedCount, freeCount, missingCount, stale };
}
