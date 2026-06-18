/**
 * Genre/tag breakdown repository (Phase 4, issue #35).
 *
 * Aggregates per-user genre and tag breakdowns from owned games, pulling
 * metadata from the Store API (always) and SteamSpy (when ENABLE_STEAMSPY).
 */

import { prisma } from '@/server/db';
import { getEnv } from '@/server/env';
import { requireSteamId } from '@/server/repositories/require-steam-id';
import { cache, cacheKey, TTL } from '@/server/cache';
import { getGameStoreMetadata } from '@/server/repositories/store';
import { getSteamSpyData } from '@/lib/steam/steamspy-client';
import { aggregateBreakdown, type Breakdown, type BreakdownItem } from '@/lib/insights';
import { isAvailable } from '@/lib/result';

export interface GenreBreakdownResult {
  /** Genre breakdown from Store API metadata. */
  genres: Breakdown;
  /** Tag breakdown from SteamSpy, only when ENABLE_STEAMSPY is set; else null. */
  tags: Breakdown | null;
  stale: boolean;
  /** Number of games whose Store metadata was unavailable (folded into 'Unknown'). */
  unknownFromUnavailable: number;
}

/**
 * Computes genre and optional tag breakdowns for the user's owned games.
 *
 * - Genre data comes from the Store API (cached at TTL.storeMetadata).
 * - Tag data comes from SteamSpy only when ENABLE_STEAMSPY=1 (cached at TTL.steamSpy).
 * - Unavailable metadata contributes an empty-label item that lands in 'Unknown'.
 */
export async function getGenreBreakdown(steamId: string): Promise<GenreBreakdownResult> {
  const id = requireSteamId(steamId, 'getGenreBreakdown');
  const env = getEnv();

  const ownedGames = await prisma.ownedGame.findMany({
    where: { steamId: id },
    select: { appId: true, playtimeForever: true },
  });

  let stale = false;
  let unknownFromUnavailable = 0;

  const genreItems: BreakdownItem[] = [];
  const tagItems: BreakdownItem[] = [];

  await Promise.all(
    ownedGames.map(async (game) => {
      const { appId, playtimeForever } = game;

      // Store metadata for genre breakdown (cache is handled inside getGameStoreMetadata)
      const metaResult = await getGameStoreMetadata(appId);

      if (!isAvailable(metaResult)) {
        unknownFromUnavailable++;
        genreItems.push({ labels: [], minutes: playtimeForever });
      } else {
        if (metaResult.stale) stale = true;
        genreItems.push({ labels: metaResult.data.genres, minutes: playtimeForever });
      }

      // SteamSpy tag breakdown — only when feature flag is on
      if (env.ENABLE_STEAMSPY) {
        const spyResult = await cache(cacheKey('steamspy', 'global', appId), TTL.steamSpy, () =>
          getSteamSpyData(appId),
        );
        if (spyResult.stale) stale = true;

        const spyData = spyResult.value;
        if (isAvailable(spyData)) {
          const tagLabels = spyData.data.tags.map((t) => t.name);
          tagItems.push({ labels: tagLabels, minutes: playtimeForever });
        }
        // If unavailable, skip this game's tags entirely (don't fold into Unknown for tags)
      }
    }),
  );

  const genres = aggregateBreakdown(genreItems);
  const tags = env.ENABLE_STEAMSPY ? aggregateBreakdown(tagItems) : null;

  return { genres, tags, stale, unknownFromUnavailable };
}
