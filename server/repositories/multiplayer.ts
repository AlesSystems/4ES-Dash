/**
 * Aggregates Store category metadata across the owned library to produce a
 * set of multiplayer-eligible appIds (issue #32).
 *
 * Uses getGameStoreMetadata (7-day TTL via server/cache/ttl.ts) — never adds
 * its own TTL or magic numbers. Never throws; degrades gracefully per
 * Availability<T>. Games whose metadata is unavailable are excluded from the
 * set and counted in missingCount so the UI can surface the uncertainty.
 */

import { getProfile } from '@/server/repositories/profile';
import { getGameStoreMetadata } from '@/server/repositories/store';
import { requireSteamId } from '@/server/repositories/require-steam-id';
import { isAvailable } from '@/lib/result';
import { isMultiplayerGame } from '@/lib/games/multiplayer';

export interface MultiplayerLibrary {
  /** appIds whose Store categories mark them multiplayer-eligible. */
  multiplayerAppIds: Set<number>;
  /**
   * Games whose Store metadata was unavailable — excluded from the set,
   * never silently treated as multiplayer or non-multiplayer.
   */
  missingCount: number;
  /** True if any underlying metadata result was served stale. */
  stale: boolean;
}

/**
 * Returns the set of multiplayer-eligible appIds for the given user's library.
 *
 * Classification rules:
 * - available(StoreMetadata) with multiplayer categoryId → added to the set.
 * - available(StoreMetadata) without multiplayer categoryId → skipped.
 * - unavailable(...) → increments missingCount; excluded from the set.
 *
 * Promise.all is used so the Store client's global rate-limiter serialises
 * naturally; no additional throttle is introduced here.
 *
 * @param steamId - Required. Pass getEnv().STEAM_ID at the call site for the
 *   featured/dev default — never read env.STEAM_ID inside this repository.
 */
export async function getMultiplayerAppIds(steamId: string): Promise<MultiplayerLibrary> {
  const id = requireSteamId(steamId, 'getMultiplayerAppIds');
  const { games } = await getProfile(id);

  const metadataResults = await Promise.all(games.map((g) => getGameStoreMetadata(g.appId)));

  const multiplayerAppIds = new Set<number>();
  let missingCount = 0;
  let stale = false;

  for (let i = 0; i < metadataResults.length; i++) {
    const result = metadataResults[i]!;
    const game = games[i]!;

    if (isAvailable(result)) {
      if (result.stale) stale = true;

      if (isMultiplayerGame(result.data.categoryIds)) {
        multiplayerAppIds.add(game.appId);
      }
    } else {
      // Store API unavailable for this game — exclude from the set, never throw.
      missingCount++;
    }
  }

  return { multiplayerAppIds, missingCount, stale };
}
