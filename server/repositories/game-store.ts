/**
 * Game store metadata refresh (#ERR-0011) — genres + price per game.
 *
 * Performance fix: Insights pages previously fan out one rate-limited Store
 * API call per owned game ON the render path (16–65 s for a real library →
 * serverless timeout). This module moves that work to the NIGHTLY JOB via
 * {@link refreshGameStoreData}, which writes `genres`, `priceFinalCents`,
 * `priceCurrency`, `priceIsFree`, and `priceRefreshedAt` into the `Game` row.
 * The render path reads those persisted columns — zero Store fan-out at request
 * time, independent of library size.
 *
 * Mirrors the {@link refreshLibraryValueAggregate} pattern (ERR-0010).
 * Degrades gracefully per game — a single game's Store failure must not abort
 * the rest. Never throws.
 */

import { prisma } from '@/server/db';
import { getGameStoreMetadata, getGameStorePrice } from '@/server/repositories/store';
import { isAvailable } from '@/lib/result';
import type { OwnedGame } from '@/lib/steam/schemas';

/**
 * Refreshes Store metadata (genres) and current price for every game in
 * `games`, persisting the results into `Game` rows. Runs OFF the request path
 * (nightly snapshot job) so Insights pages never pay this O(N) Store cost.
 *
 * Column mapping:
 *   - available(StoreMetadata) → genres = JSON.stringify(meta.genres)
 *   - unavailable(...)         → genres = '[]'
 *   - available(StoreMetadata) → categoryIds = JSON.stringify(meta.categoryIds)
 *   - unavailable(...)         → categoryIds OMITTED from update (last-known-good
 *                                value untouched); null on create (never
 *                                categorized). NEVER '[]' on unavailable — this
 *                                deliberately diverges from the genres behavior:
 *                                '[]' genres are a safe empty display state, but
 *                                '[]' categoryIds are a *positive* "no
 *                                multiplayer categories" classification — the
 *                                multiplayer reader would classify
 *                                isMultiplayerGame([]) === false and drop the
 *                                game from missingCount, fabricating a
 *                                non-multiplayer verdict from missing data.
 *   - available(StorePrice)    → priceFinalCents / priceCurrency, priceIsFree=false
 *   - available(null)          → priceIsFree=true, priceFinalCents/priceCurrency=null
 *   - unavailable(...)         → priceIsFree=null, priceFinalCents/priceCurrency=null
 *   - always                   → priceRefreshedAt = new Date()
 *
 * Best-effort: a single game's failure is logged and skipped; the rest proceed.
 * Never throws.
 */
export async function refreshGameStoreData(games: OwnedGame[]): Promise<void> {
  for (const game of games) {
    try {
      // --- Genres -----------------------------------------------------------
      const metaResult = await getGameStoreMetadata(game.appId);
      const genres = isAvailable(metaResult)
        ? JSON.stringify(metaResult.data.genres)
        : '[]';
      // undefined on unavailable → field omitted from the update below
      // (last-known-good preserved); create falls back to null. See the
      // "Column mapping" comment for why this diverges from genres.
      const categoryIds = isAvailable(metaResult)
        ? JSON.stringify(metaResult.data.categoryIds)
        : undefined;

      // --- Price ------------------------------------------------------------
      const priceResult = await getGameStorePrice(game.appId);

      let priceFinalCents: number | null = null;
      let priceCurrency: string | null = null;
      let priceIsFree: boolean | null = null;

      if (isAvailable(priceResult)) {
        if (priceResult.data !== null) {
          // Paid game
          priceFinalCents = priceResult.data.finalCents;
          priceCurrency = priceResult.data.currency;
          priceIsFree = false;
        } else {
          // Free-to-play (available but null price_overview)
          priceIsFree = true;
        }
      }
      // else: unavailable → all three stay null (price unknown)

      const priceRefreshedAt = new Date();

      await prisma.game.upsert({
        where: { appId: game.appId },
        create: {
          appId: game.appId,
          name: game.name,
          genres,
          categoryIds: categoryIds ?? null,
          priceFinalCents,
          priceCurrency,
          priceIsFree,
          priceRefreshedAt,
        },
        update: {
          genres,
          // Omit categoryIds entirely when unavailable — preserves the
          // last-known-good value instead of clobbering it (see Column mapping).
          ...(categoryIds !== undefined ? { categoryIds } : {}),
          priceFinalCents,
          priceCurrency,
          priceIsFree,
          priceRefreshedAt,
        },
      });
    } catch (err) {
      console.error(
        '[game-store] store data refresh failed appId=%d',
        game.appId,
        err,
      );
    }
  }
}
