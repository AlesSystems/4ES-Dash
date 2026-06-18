/**
 * Recently-played repository (issue #19 — recently-played widget).
 *
 * Data flow: getRecentlyPlayed → cache(key, TTL, loader) → getRecentlyPlayedGames
 */

import { getRecentlyPlayedGames, type RecentGame } from '@/lib/steam/recently-played';
import { cache, cacheKey, TTL } from '@/server/cache';
import { requireSteamId } from '@/server/repositories/require-steam-id';

export type { RecentGame };

/**
 * Returns the recently played games for the given Steam user, with a
 * `stale` flag the UI uses to show a "Data may be outdated" indicator when
 * the cache had to serve an expired value after a Steam fetch failure.
 *
 * @param steamId - Required. Pass getEnv().STEAM_ID at the call site for the
 *   featured/dev default — never read env.STEAM_ID inside this repository.
 */
export async function getRecentlyPlayed(steamId: string): Promise<{ games: RecentGame[]; stale: boolean }> {
  const id = requireSteamId(steamId, 'getRecentlyPlayed');

  const { value, stale } = await cache(
    cacheKey('recently-played', id),
    TTL.recentlyPlayed,
    () => getRecentlyPlayedGames(id),
  );

  return { games: value, stale };
}
