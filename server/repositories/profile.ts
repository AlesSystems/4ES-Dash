import { getOwnedGames, getPlayerSummaries, type OwnedGame, type PlayerSummary } from '@/lib/steam';
import { cache, cacheKey, TTL } from '@/server/cache';
import { requireSteamId } from '@/server/repositories/require-steam-id';

/**
 * Fetches the given user's Steam profile + owned game library.
 *
 * Phase 0: cache → Steam only. The DB read-through layer slots in here at Phase 2.
 *
 * @param steamId - Required. The 17-digit SteamID to fetch. Pass getEnv().STEAM_ID
 *   at the call site (page/route/job) for the featured/dev default — never read
 *   env.STEAM_ID inside this repository.
 * @returns Combined profile, games, and a `stale` flag (true if either value
 *   was served from expired cache due to a Steam fetch failure).
 */
export async function getProfile(steamId: string): Promise<{
  profile: PlayerSummary;
  games: OwnedGame[];
  stale: boolean;
  /**
   * True when Steam returns a non-empty library where every game has
   * `playtime.total === 0` AND at least one game has a non-null `lastPlayed`
   * timestamp. This is a near-conclusive signal that the account has
   * "Game details" privacy enabled — a never-played game cannot have a
   * last-played timestamp. A genuinely-new (all-null lastPlayed) account
   * yields false and is NOT flagged. (bug-02)
   */
  playtimeHidden: boolean;
}> {
  const id = requireSteamId(steamId, 'getProfile');

  const [summary, games] = await Promise.all([
    cache(
      cacheKey('player-summaries', id),
      TTL.playerSummaries,
      () => getPlayerSummaries(id),
    ),
    cache(
      cacheKey('owned-games', id),
      TTL.ownedGames,
      () => getOwnedGames(id),
    ),
  ]);

  const g = games.value;
  const playtimeHidden =
    g.length > 0 &&
    g.every((x) => x.playtime.total === 0) &&
    g.some((x) => x.lastPlayed !== null);

  return {
    profile: summary.value,
    games: g,
    stale: summary.stale || games.stale,
    playtimeHidden,
  };
}
