/**
 * Steam Friends API client functions.
 *
 * Network I/O follows the same pattern as client.ts:
 *   steamLimiter.acquire()  →  withRetry(() => fetchJson(url))  →  Zod parse
 *
 * Security rules (CLAUDE.md):
 *  - API key is fetched lazily via getEnv() — never at module top-level.
 *  - The key NEVER appears in thrown errors, messages, or `cause`.
 *  - URLs are constructed server-side only; never passed to the client.
 *
 * Private-list handling note:
 *  GetFriendList returns HTTP 401 when the target profile's friend list is NOT
 *  public. Since our API key is validated by all other endpoints, a 401 here
 *  means "friend list is private", not "bad key". We catch kind:'auth' from
 *  fetchJson and rethrow as kind:'private' to preserve that semantic distinction
 *  for the error boundary (which maps 'private' → 403 in the JSON API).
 */

import { z } from 'zod';
import { getEnv } from '@/server/env';
import { SteamApiError, isSteamApiError } from './errors';
import { steamLimiter } from './limiter';
import { withRetry } from './retry';
import { FriendSummary, FriendStatus, RawPlayerSummaries } from './schemas';

// ---------------------------------------------------------------------------
// Private HTTP helper (mirrors client.ts fetchJson — fetchJson is not exported)
// ---------------------------------------------------------------------------

/**
 * Performs a GET fetch and maps HTTP status codes to `SteamApiError`.
 * The URL is intentionally NOT included in error messages to keep the API key
 * out of logs/traces (the key is a query param).
 */
async function fetchJson(url: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new SteamApiError({
      kind: 'transient',
      message: 'Network error reaching Steam API',
      cause: err,
    });
  }

  if (res.status === 401 || res.status === 403) {
    throw new SteamApiError({
      kind: 'auth',
      status: res.status,
      message: 'Steam API key rejected',
    });
  }

  if (res.status === 429) {
    const retryAfterHeader = res.headers.get('Retry-After');
    const retryAfter = retryAfterHeader != null ? parseInt(retryAfterHeader, 10) : undefined;
    throw new SteamApiError({
      kind: 'rate_limit',
      status: 429,
      retryAfter: Number.isFinite(retryAfter) ? retryAfter : undefined,
      message: 'Steam API rate limit exceeded',
    });
  }

  if (res.status >= 500) {
    throw new SteamApiError({
      kind: 'transient',
      status: res.status,
      message: 'Steam API server error',
    });
  }

  if (!res.ok) {
    throw new SteamApiError({
      kind: 'unknown',
      status: res.status,
      message: 'Unexpected response from Steam API',
    });
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Maps Steam's `personastate` integer to the three UI buckets.
 *
 * Steam states:
 *   0 = Offline / private  → 'offline'
 *   1 = Online             → 'online'
 *   2 = Busy               → 'away'
 *   3 = Away               → 'away'
 *   4 = Snooze             → 'away'
 *   5 = Looking to Trade   → 'online'
 *   6 = Looking to Play    → 'online'
 *
 * `undefined` (hidden profile) → 'offline'
 */
export function personaStateToStatus(state: number | undefined): FriendStatus {
  switch (state) {
    case 1:
    case 5:
    case 6:
      return 'online';
    case 2:
    case 3:
    case 4:
      return 'away';
    default:
      return 'offline';
  }
}

/**
 * Returns a NEW sorted array of friends.
 * Order: non-offline (online + away) first, offline last.
 * Within each group: ascending by `personaName`, case-insensitive.
 *
 * ACCEPTANCE: "online friends first, then offline; within each group alphabetically."
 */
export function sortFriends(friends: FriendSummary[]): FriendSummary[] {
  return [...friends].sort((a, b) => {
    const aOffline = a.status === 'offline';
    const bOffline = b.status === 'offline';

    if (aOffline !== bOffline) {
      // Non-offline sorts before offline.
      return aOffline ? 1 : -1;
    }

    // Same group — sort alphabetically, case-insensitive.
    return a.personaName.localeCompare(b.personaName, undefined, { sensitivity: 'base' });
  });
}

// ---------------------------------------------------------------------------
// Raw response schemas (lenient — only assert what we read)
// ---------------------------------------------------------------------------

const RawFriendSchema = z.object({
  steamid: z.string(),
  relationship: z.string().optional(),
  friend_since: z.number().optional(),
});

const RawFriendListSchema = z.object({
  friendslist: z.object({
    friends: z.array(RawFriendSchema),
  }),
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetches the friend list for `steamId` and returns lightweight stubs.
 * The full `FriendSummary` is assembled by the repository after enriching with
 * `getPlayerSummariesBatch`; this layer returns only what GetFriendList provides.
 *
 * `friendSince` is null when Steam omits `friend_since` or reports 0 (epoch).
 *
 * Private handling: GetFriendList returns HTTP 401 when the target's friend
 * list is not public. Because a 401 from any other endpoint means "bad API
 * key", we intercept kind:'auth' here and rethrow as kind:'private' to
 * preserve the correct semantic for the error boundary.
 */
export async function getFriendList(
  steamId: string,
): Promise<{ steamId: string; friendSince: string | null }[]> {
  const key = getEnv().STEAM_API_KEY;
  const url =
    `https://api.steampowered.com/ISteamUser/GetFriendList/v0001/` +
    `?key=${key}&steamid=${steamId}&relationship=friend`;

  await steamLimiter.acquire();

  let raw: unknown;
  try {
    raw = await withRetry(() => fetchJson(url));
  } catch (err) {
    // 401 on GetFriendList means the friend list is not public, not a bad key.
    if (isSteamApiError(err) && err.kind === 'auth') {
      throw new SteamApiError({
        kind: 'private',
        message: 'Friend list is not public',
      });
    }
    throw err;
  }

  let parsed: z.infer<typeof RawFriendListSchema>;
  try {
    parsed = RawFriendListSchema.parse(raw);
  } catch (cause) {
    throw new SteamApiError({
      kind: 'schema',
      message: 'Unexpected shape in GetFriendList response',
      cause,
    });
  }

  return parsed.friendslist.friends.map((f) => ({
    steamId: f.steamid,
    friendSince:
      f.friend_since == null || f.friend_since === 0
        ? null
        : new Date(f.friend_since * 1000).toISOString(),
  }));
}

/**
 * Fetches full player summaries for up to N friends in batches of ≤100.
 * Returns an array of `FriendSummary` objects with `friendSince: null` — the
 * repository overlays `friendSince` from the GetFriendList results.
 *
 * Empty input → returns [] without making any network request.
 *
 * ACCEPTANCE: batch size 100 (Steam's documented max for GetPlayerSummaries).
 */
export async function getPlayerSummariesBatch(steamIds: string[]): Promise<FriendSummary[]> {
  if (steamIds.length === 0) return [];

  const CHUNK_SIZE = 100;
  const chunks: string[][] = [];
  for (let i = 0; i < steamIds.length; i += CHUNK_SIZE) {
    chunks.push(steamIds.slice(i, i + CHUNK_SIZE));
  }

  const key = getEnv().STEAM_API_KEY;
  const results: FriendSummary[] = [];

  for (const chunk of chunks) {
    const url =
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/` +
      `?key=${key}&steamids=${chunk.join(',')}`;

    await steamLimiter.acquire();
    const raw = await withRetry(() => fetchJson(url));

    let parsed: z.infer<typeof RawPlayerSummaries>;
    try {
      parsed = RawPlayerSummaries.parse(raw);
    } catch (cause) {
      throw new SteamApiError({
        kind: 'schema',
        message: 'Unexpected shape in GetPlayerSummaries (batch) response',
        cause,
      });
    }

    for (const p of parsed.response.players) {
      // Determine current-game info from gameextrainfo / gameid.
      let playing: FriendSummary['playing'] = null;
      if (p.gameextrainfo !== undefined) {
        // gameid is a string from the API; convert to number when finite/valid.
        const rawGameId = p.gameid;
        const numericGameId =
          rawGameId !== undefined && Number.isFinite(Number(rawGameId)) ? Number(rawGameId) : null;
        playing = { appId: numericGameId, name: p.gameextrainfo };
      }

      results.push({
        steamId: p.steamid,
        personaName: p.personaname,
        avatar: {
          small: p.avatar,
          medium: p.avatarmedium,
          full: p.avatarfull,
        },
        profileUrl: p.profileurl,
        status: personaStateToStatus(p.personastate),
        inGame: playing !== null,
        playing,
        // friendSince is overlaid by the repository using GetFriendList data.
        friendSince: null,
      });
    }
  }

  return results;
}
