/**
 * Achievement repository (issue #18 — achievement progress aggregate).
 *
 * Data flow:
 *   getGameAchievements  →  cache (schema, global, player)
 *                        →  getSchemaForGame / getGlobalAchievementPercentages / getPlayerAchievements
 *                        →  mergeGameAchievements
 *
 *   getAchievementProgress  →  getGameAchievements[] (already cached)
 *                           →  aggregateLibrary
 *
 * All three Steam calls are individually cached under `server/cache/ttl.ts`
 * TTL.playerAchievements (3600 s). The steamId is passed explicitly — never
 * read from getEnv() inside this repository.
 */

import {
  getPlayerAchievements,
  getSchemaForGame,
  getGlobalAchievementPercentages,
} from '@/lib/steam/achievements';
import { mergeGameAchievements, aggregateLibrary } from '@/lib/achievements/aggregate';
import type { GameAchievements, LibrarySummary } from '@/lib/achievements/aggregate';
import { Availability, available, unavailable } from '@/lib/result';
import { cache, cacheKey, TTL } from '@/server/cache';
import { requireSteamId } from '@/server/repositories/require-steam-id';

// Re-export domain types so consumers don't need to import from two places.
export type { GameAchievements, LibrarySummary };

// ---------------------------------------------------------------------------
// getGameAchievements
// ---------------------------------------------------------------------------

/**
 * Returns the merged achievement view for a single game.
 *
 * - Schema and global-percentage data are cached under the 'global' pseudo-steamId
 *   (they are per-game, not per-user).
 * - Player achievement data is cached per steamId.
 * - If the player result is unavailable (private profile or no achievements),
 *   that Availability is passed through unchanged.
 *
 * @param steamId - Required. Pass getEnv().STEAM_ID at the call site for the
 *   featured/dev default — never read env.STEAM_ID inside this repository.
 */
export async function getGameAchievements(steamId: string, appId: number): Promise<Availability<GameAchievements>> {
  const id = requireSteamId(steamId, 'getGameAchievements');

  // Fetch the per-user progress FIRST. When a game is private or has no
  // achievements, there is no point spending two more rate-limited calls on its
  // schema + global percentages — short-circuit and skip them. This cuts the
  // dashboard's cold-load cost from 3 Steam calls/game to 1 for every
  // unavailable game (a private library is ~38 s → ~13 s). See ERR-0003.
  const playerResult = await cache(
    cacheKey('player-achievements', id, appId),
    TTL.playerAchievements,
    () => getPlayerAchievements(id, appId),
  );

  const playerAvailability = playerResult.value;

  // Pass through private / no-achievements degradation — no metadata needed.
  if (!playerAvailability.available) {
    return playerAvailability;
  }

  // Only games with real player data need schema (display names/icons) + global
  // percentages. Both are per-game and cached under the 'global' pseudo-steamId.
  const [schemaResult, globalResult] = await Promise.all([
    cache(cacheKey('achievement-schema', 'global', appId), TTL.playerAchievements, () =>
      getSchemaForGame(appId),
    ),
    cache(cacheKey('achievement-global', 'global', appId), TTL.playerAchievements, () =>
      getGlobalAchievementPercentages(appId),
    ),
  ]);

  const merged = mergeGameAchievements(
    playerAvailability.data,
    schemaResult.value,
    globalResult.value,
  );

  // Surface staleness if any cached fetch served an expired value after an
  // upstream failure (stale-while-revalidate).
  const stale = playerAvailability.stale || schemaResult.stale || globalResult.stale;
  return available(merged, stale);
}

// ---------------------------------------------------------------------------
// getAchievementProgress
// ---------------------------------------------------------------------------

/**
 * Aggregates achievement progress across a set of game app IDs.
 *
 * Each game's data is fetched via `getGameAchievements` (already cached).
 * Unavailable games (private / no achievements) are silently skipped.
 *
 * Returns `unavailable('no-achievements')` when none of the requested games
 * have available achievement data.
 *
 * @param steamId - Required. Pass getEnv().STEAM_ID at the call site for the
 *   featured/dev default — never read env.STEAM_ID inside this repository.
 */
export async function getAchievementProgress(
  steamId: string,
  appIds: number[],
): Promise<Availability<LibrarySummary>> {
  const results = await Promise.all(appIds.map((id) => getGameAchievements(steamId, id)));

  const availableResults = results.filter(
    (r): r is Extract<typeof r, { available: true }> => r.available,
  );

  if (availableResults.length === 0) {
    return unavailable(
      'no-achievements',
      'No achievement data available for any of the requested games',
    );
  }

  const summary = aggregateLibrary(availableResults.map((r) => r.data));
  const stale = availableResults.some((r) => r.stale);
  return available(summary, stale);
}
