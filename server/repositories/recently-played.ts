/**
 * Recently-played repository (issue #19 — recently-played widget).
 *
 * Reads the configured STEAM_ID from env, wraps the Steam client call with the
 * shared cache helper, and surfaces the stale flag for the widget's
 * "Data may be outdated" indicator.
 *
 * Data flow: getRecentlyPlayed → cache(key, TTL, loader) → getRecentlyPlayedGames
 */

import { getRecentlyPlayedGames, type RecentGame } from '@/lib/steam/recently-played';
import { cache, cacheKey, TTL } from '@/server/cache';
import { getEnv } from '@/server/env';

export type { RecentGame };

/**
 * Returns the recently played games for the configured Steam user, with a
 * `stale` flag the UI uses to show a "Data may be outdated" indicator when
 * the cache had to serve an expired value after a Steam fetch failure.
 */
export async function getRecentlyPlayed(): Promise<{ games: RecentGame[]; stale: boolean }> {
  const { STEAM_ID } = getEnv();

  const { value, stale } = await cache(
    cacheKey('recently-played', STEAM_ID),
    TTL.recentlyPlayed,
    () => getRecentlyPlayedGames(STEAM_ID),
  );

  return { games: value, stale };
}
