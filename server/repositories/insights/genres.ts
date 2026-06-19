/**
 * Genre/tag breakdown repository (Phase 4, issue #35).
 *
 * Aggregates per-user genre and tag breakdowns from owned games, pulling
 * genres from the Game table (written nightly by the enrichment job) and
 * tags from SteamSpy (when ENABLE_STEAMSPY).
 */

import { prisma } from '@/server/db';
import { getEnv } from '@/server/env';
import { requireSteamId } from '@/server/repositories/require-steam-id';
import { cache, cacheKey, TTL } from '@/server/cache';
import { getSteamSpyData } from '@/lib/steam/steamspy-client';
import { aggregateBreakdown, type Breakdown, type BreakdownItem } from '@/lib/insights';
import { isAvailable } from '@/lib/result';

export interface GenreBreakdownResult {
  /** Genre breakdown from Game table (written nightly). */
  genres: Breakdown;
  /** Tag breakdown from SteamSpy, only when ENABLE_STEAMSPY is set; else null. */
  tags: Breakdown | null;
  stale: boolean;
  /** Number of games whose genre data was unavailable (no Game row or empty genres). */
  unknownFromUnavailable: number;
}

/**
 * Computes genre and optional tag breakdowns for the user's owned games.
 *
 * - Genre data comes from the Game table (single DB query, populated nightly).
 * - Tag data comes from SteamSpy only when ENABLE_STEAMSPY=1 (cached at TTL.steamSpy).
 * - Games with no genre data (empty array or no Game row) contribute to unknownFromUnavailable.
 * - If NO game has any real genre, returns empty slices so the UI shows its
 *   "No genre data yet" empty state instead of a single 100%-"Unknown" slice.
 */
export async function getGenreBreakdown(steamId: string): Promise<GenreBreakdownResult> {
  const id = requireSteamId(steamId, 'getGenreBreakdown');
  const env = getEnv();

  const ownedGames = await prisma.ownedGame.findMany({
    where: { steamId: id },
    select: { appId: true, playtimeForever: true },
  });

  if (ownedGames.length === 0) {
    return {
      genres: { slices: [], totalMinutes: 0 },
      tags: env.ENABLE_STEAMSPY ? { slices: [], totalMinutes: 0 } : null,
      stale: false,
      unknownFromUnavailable: 0,
    };
  }

  const appIds = ownedGames.map((g) => g.appId);

  // Single DB read — no per-game Store API calls
  const gameRows = await prisma.game.findMany({
    where: { appId: { in: appIds } },
    select: { appId: true, genres: true },
  });

  // Build a Map<appId, string[]> from JSON-encoded genres
  const genreMap = new Map<number, string[]>();
  for (const row of gameRows) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.genres);
    } catch {
      parsed = [];
    }
    genreMap.set(
      row.appId,
      Array.isArray(parsed) && parsed.every((x): x is string => typeof x === 'string')
        ? parsed
        : [],
    );
  }

  let stale = false;
  let unknownFromUnavailable = 0;

  const genreItems: BreakdownItem[] = [];
  const tagItems: BreakdownItem[] = [];

  for (const game of ownedGames) {
    const { appId, playtimeForever } = game;
    const labels = genreMap.get(appId) ?? [];

    if (labels.length === 0) {
      unknownFromUnavailable++;
    }
    genreItems.push({ labels, minutes: playtimeForever });

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
  }

  // Edge case: if every game has empty genres (e.g. before first nightly run),
  // return empty slices so the UI can show a "No genre data yet" empty state
  // rather than a single 100%-"Unknown" slice.
  const hasAnyRealGenre = genreItems.some((item) => item.labels.length > 0);
  const genres = hasAnyRealGenre
    ? aggregateBreakdown(genreItems)
    : { slices: [], totalMinutes: genreItems.reduce((acc, item) => acc + item.minutes, 0) };

  const tags = env.ENABLE_STEAMSPY ? aggregateBreakdown(tagItems) : null;

  return { genres, tags, stale, unknownFromUnavailable };
}
