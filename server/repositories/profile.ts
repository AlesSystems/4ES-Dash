import { getOwnedGames, getPlayerSummaries, type OwnedGame, type PlayerSummary } from '@/lib/steam';
import { cache, cacheKey, TTL } from '@/server/cache';
import { getEnv } from '@/server/env';

/**
 * Fetches the configured user's Steam profile + owned game library.
 *
 * Phase 0: cache → Steam only. The DB read-through layer slots in here at Phase 2.
 *
 * @returns Combined profile, games, and a `stale` flag (true if either value
 *   was served from expired cache due to a Steam fetch failure).
 */
export async function getProfile(): Promise<{
  profile: PlayerSummary;
  games: OwnedGame[];
  stale: boolean;
}> {
  const { STEAM_ID } = getEnv();

  const [summary, games] = await Promise.all([
    cache(
      cacheKey('player-summaries', STEAM_ID),
      TTL.playerSummaries,
      () => getPlayerSummaries(STEAM_ID),
    ),
    cache(
      cacheKey('owned-games', STEAM_ID),
      TTL.ownedGames,
      () => getOwnedGames(STEAM_ID),
    ),
  ]);

  return {
    profile: summary.value,
    games: games.value,
    stale: summary.stale || games.stale,
  };
}
