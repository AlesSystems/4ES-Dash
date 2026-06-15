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
 * TTL.playerAchievements (3600 s). The STEAM_ID is read lazily from getEnv().
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
import { getEnv } from '@/server/env';

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
 * - Player achievement data is cached per STEAM_ID.
 * - If the player result is unavailable (private profile or no achievements),
 *   that Availability is passed through unchanged.
 */
export async function getGameAchievements(appId: number): Promise<Availability<GameAchievements>> {
  const { STEAM_ID } = getEnv();

  // Fetch schema, global percentages, and player progress in parallel.
  // All three are individually cached.
  const [schemaResult, globalResult, playerResult] = await Promise.all([
    cache(cacheKey('achievement-schema', 'global', appId), TTL.playerAchievements, () =>
      getSchemaForGame(appId),
    ),
    cache(cacheKey('achievement-global', 'global', appId), TTL.playerAchievements, () =>
      getGlobalAchievementPercentages(appId),
    ),
    cache(cacheKey('player-achievements', STEAM_ID, appId), TTL.playerAchievements, () =>
      getPlayerAchievements(STEAM_ID, appId),
    ),
  ]);

  const playerAvailability = playerResult.value;

  // Pass through private / no-achievements degradation.
  if (!playerAvailability.available) {
    return playerAvailability;
  }

  const merged = mergeGameAchievements(
    playerAvailability.data,
    schemaResult.value,
    globalResult.value,
  );

  return available(merged);
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
 */
export async function getAchievementProgress(
  appIds: number[],
): Promise<Availability<LibrarySummary>> {
  const results = await Promise.all(appIds.map((id) => getGameAchievements(id)));

  const available_results = results.filter(
    (r): r is Extract<typeof r, { available: true }> => r.available,
  );

  if (available_results.length === 0) {
    return unavailable(
      'no-achievements',
      'No achievement data available for any of the requested games',
    );
  }

  const summary = aggregateLibrary(available_results.map((r) => r.data));
  return available(summary);
}
