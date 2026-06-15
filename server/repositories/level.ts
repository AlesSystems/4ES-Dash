/**
 * Steam level repository (issue #20 — profile header).
 *
 * Reads the configured STEAM_ID from env, wraps the Steam client call with the
 * shared cache helper, and surfaces the stale flag.
 *
 * Data flow: getLevel → cache(key, TTL, loader) → getSteamLevel
 */

import { getSteamLevel } from '@/lib/steam/level';
import { cache, cacheKey, TTL } from '@/server/cache';
import { getEnv } from '@/server/env';

/**
 * Returns the Steam level for the configured user, with a `stale` flag the UI
 * uses to show a "Data may be outdated" indicator when the cache had to serve
 * an expired value after a Steam fetch failure.
 *
 * `level` is `null` when the user's profile is private or the field is absent
 * in Steam's response — this is a valid, designed empty state (not an error).
 */
export async function getLevel(): Promise<{ level: number | null; stale: boolean }> {
  const { STEAM_ID } = getEnv();

  const { value, stale } = await cache(cacheKey('steam-level', STEAM_ID), TTL.steamLevel, () =>
    getSteamLevel(STEAM_ID),
  );

  return { level: value, stale };
}
