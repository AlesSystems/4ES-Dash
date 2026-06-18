import { getFriendList, getPlayerSummariesBatch, sortFriends } from '@/lib/steam/friends';
import type { FriendSummary } from '@/lib/steam/schemas';
import { cache, cacheKey, TTL } from '@/server/cache';
import { requireSteamId } from '@/server/repositories/require-steam-id';

/**
 * Result returned by getFriends.
 * `stale` is true if any cached value was served from an expired entry because
 * the upstream Steam fetch failed (stale-while-revalidate).
 */
export interface FriendsResult {
  friends: FriendSummary[];
  stale: boolean;
}

/**
 * Fetches the given user's friend list, enriches each entry with full
 * player summaries, overlays `friendSince` from the friend-list response, and
 * sorts the result (non-offline first, then alphabetical within groups).
 *
 * Caching:
 *  - Friend list (steamIds + friendSince): `TTL.friendList` (24 h)
 *  - Batch player summaries: `TTL.playerSummaries` (5 min)
 *
 * Private-list propagation: if `getFriendList` throws `SteamApiError({ kind: 'private' })`
 * it propagates unmodified so `withErrorBoundary` maps it to a 403 problem response.
 * No inner try/catch here beyond what's needed for data overlay.
 *
 * @param steamId - Required. Pass getEnv().STEAM_ID at the call site for the
 *   featured/dev default — never read env.STEAM_ID inside this repository.
 */
export async function getFriends(steamId: string): Promise<FriendsResult> {
  const id = requireSteamId(steamId, 'getFriends');

  // ── Step 1: fetch (cached) friend list ─────────────────────────────────────
  // SteamApiError({ kind: 'private' }) is allowed to propagate.
  const friendListResult = await cache(cacheKey('friend-list', id), TTL.friendList, () =>
    getFriendList(id),
  );

  const friendList = friendListResult.value;

  if (friendList.length === 0) {
    return { friends: [], stale: friendListResult.stale };
  }

  const ids = friendList.map((f) => f.steamId);

  // ── Step 2: fetch (cached) player summaries for the whole friend set ───────
  const summariesResult = await cache(
    cacheKey('friends-summaries', id),
    TTL.playerSummaries,
    () => getPlayerSummariesBatch(ids),
  );

  // ── Step 3: overlay friendSince from the friend-list onto each summary ─────
  const friendSinceMap = new Map<string, string | null>(
    friendList.map((f) => [f.steamId, f.friendSince]),
  );

  const enriched: FriendSummary[] = summariesResult.value.map((summary) => ({
    ...summary,
    friendSince: friendSinceMap.get(summary.steamId) ?? null,
  }));

  // ── Step 4: sort and return ─────────────────────────────────────────────────
  const friends = sortFriends(enriched);

  return {
    friends,
    stale: friendListResult.stale || summariesResult.stale,
  };
}
