/**
 * Steam level repository (issue #20 — profile header).
 *
 * Data flow: getLevel → cache(key, TTL, loader) → getSteamLevel
 */

import { getSteamLevel } from '@/lib/steam/level';
import { cache, cacheKey, TTL } from '@/server/cache';
import { requireSteamId } from '@/server/repositories/require-steam-id';

/**
 * Returns the Steam level for the given user, with a `stale` flag the UI
 * uses to show a "Data may be outdated" indicator when the cache had to serve
 * an expired value after a Steam fetch failure.
 *
 * `level` is `null` when the user's profile is private or the field is absent
 * in Steam's response — this is a valid, designed empty state (not an error).
 *
 * @param steamId - Required. Pass getEnv().STEAM_ID at the call site for the
 *   featured/dev default — never read env.STEAM_ID inside this repository.
 */
export async function getLevel(steamId: string): Promise<{ level: number | null; stale: boolean }> {
  const id = requireSteamId(steamId, 'getLevel');

  const { value, stale } = await cache(cacheKey('steam-level', id), TTL.steamLevel, () =>
    getSteamLevel(id),
  );

  return { level: value, stale };
}
