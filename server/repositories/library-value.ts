/**
 * Library value (#29) — current Steam store value of a user's library.
 *
 * Performance (#85): pricing every owned game is O(N) rate-limited Store calls.
 * That work runs in the NIGHTLY JOB via {@link refreshLibraryValueAggregate},
 * which writes one `LibraryValueAggregate` row. The dashboard render path calls
 * {@link getLibraryValue}, which only READS that row — its Steam fan-out is zero
 * and independent of library size. Before the first nightly run the row is
 * absent and `getLibraryValue` returns `unavailable('not-tracked')` so the UI
 * shows a designed "value pending" state — never a synchronous live fan-out and
 * never a fabricated $0.
 *
 * Degrades gracefully per Availability<T>; never throws.
 */

import { prisma } from '@/server/db';
import { getGameStorePrice } from '@/server/repositories/store';
import { requireSteamId } from '@/server/repositories/require-steam-id';
import { available, unavailable, isAvailable, type Availability } from '@/lib/result';
import type { OwnedGame } from '@/lib/steam/schemas';

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
  /** True if any underlying price result was served stale at compute time. */
  stale: boolean;
}

/**
 * Reads the pre-computed library-value aggregate for a user (written nightly by
 * {@link refreshLibraryValueAggregate}). Returns `unavailable('not-tracked')`
 * when no aggregate exists yet (e.g. before the first nightly run) so the UI can
 * render a "value pending" state. **Does no Store pricing** — the render path is
 * a single indexed row read, independent of library size.
 */
export async function getLibraryValue(steamId: string): Promise<Availability<LibraryValue>> {
  const id = requireSteamId(steamId, 'getLibraryValue');

  const row = await prisma.libraryValueAggregate.findUnique({ where: { steamId: id } });
  if (row === null) {
    return unavailable('not-tracked', 'Library value is still being computed.');
  }

  return available({
    totalMinor: row.totalMinor,
    currency: row.currency,
    pricedCount: row.pricedCount,
    freeCount: row.freeCount,
    missingCount: row.missingCount,
    stale: false,
  });
}

/**
 * Computes the current store value of `games` (O(N) rate-limited Store calls)
 * and upserts the `LibraryValueAggregate` row for `steamId`. Runs OFF the
 * request path (nightly snapshot job) so the dashboard never pays this cost.
 *
 * Accounting rules:
 * - available(StorePrice) → priced: adds finalCents, increments pricedCount.
 * - available(null)       → free: increments freeCount, adds 0 to total.
 * - unavailable(...)      → missing: increments missingCount, adds 0 to total.
 *
 * Returns the computed {@link LibraryValue}. Never throws.
 */
export async function refreshLibraryValueAggregate(
  steamId: string,
  games: OwnedGame[],
): Promise<LibraryValue> {
  const id = requireSteamId(steamId, 'refreshLibraryValueAggregate');

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

  await prisma.libraryValueAggregate.upsert({
    where: { steamId: id },
    create: { steamId: id, totalMinor, currency, pricedCount, freeCount, missingCount },
    update: { totalMinor, currency, pricedCount, freeCount, missingCount, computedAt: new Date() },
  });

  return { totalMinor, currency, pricedCount, freeCount, missingCount, stale };
}
