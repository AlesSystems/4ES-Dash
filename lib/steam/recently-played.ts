/**
 * Steam Web API — IPlayerService/GetRecentlyPlayedGames
 *
 * Follows the same fetchJson → steamLimiter.acquire() → withRetry → Zod parse
 * pattern as lib/steam/client.ts. The API key is fetched lazily via getEnv()
 * and never appears in thrown errors, messages, or causes.
 *
 * Empty-games response (no `games` key or empty array) is NOT an error for
 * recently-played — it simply means the user hasn't played anything in two
 * weeks. Returns [] in that case.
 */

import { z } from 'zod';
import { getEnv } from '@/server/env';
import { SteamApiError } from './errors';
import { steamLimiter } from './limiter';
import { withRetry } from './retry';

// ---------------------------------------------------------------------------
// Raw response schema
// ---------------------------------------------------------------------------

const RawRecentGameSchema = z.object({
  appid: z.number(),
  name: z.string(),
  playtime_2weeks: z.number(),
  playtime_forever: z.number(),
  img_icon_url: z.string().optional(),
});

const RawRecentlyPlayedSchema = z.object({
  response: z.object({
    total_count: z.number().optional(),
    games: z.array(RawRecentGameSchema).optional(),
  }),
});

// ---------------------------------------------------------------------------
// Domain type
// ---------------------------------------------------------------------------

export interface RecentGame {
  appId: number;
  name: string;
  /** null when img_icon_url is absent in the Steam response */
  iconUrl: string | null;
  headerUrl: string;
  twoWeeksMinutes: number;
  totalMinutes: number;
}

// ---------------------------------------------------------------------------
// Local helpers (mirrors client.ts — not imported to keep file boundaries clean)
// ---------------------------------------------------------------------------

function buildRecentlyPlayedUrl(key: string, steamId: string): string {
  return (
    `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/` +
    `?key=${key}&steamid=${steamId}`
  );
}

function buildHeaderUrl(appId: number): string {
  return `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`;
}

function buildIconUrl(appId: number, imgIconUrl: string | undefined): string | null {
  if (!imgIconUrl) return null;
  return `https://media.steampowered.com/steamcommunity/public/images/apps/${appId}/${imgIconUrl}.jpg`;
}

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
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetches recently played games for a Steam user.
 *
 * An empty / missing `games` array is valid — it means the user hasn't played
 * anything in the past two weeks. Returns `[]` in that case (not an error).
 * A malformed response shape throws `SteamApiError({ kind: 'schema' })`.
 */
export async function getRecentlyPlayedGames(steamId: string): Promise<RecentGame[]> {
  const key = getEnv().STEAM_API_KEY;
  const url = buildRecentlyPlayedUrl(key, steamId);

  await steamLimiter.acquire();

  const raw = await withRetry(() => fetchJson(url));

  let parsed: z.infer<typeof RawRecentlyPlayedSchema>;
  try {
    parsed = RawRecentlyPlayedSchema.parse(raw);
  } catch (cause) {
    throw new SteamApiError({
      kind: 'schema',
      message: 'Unexpected shape in GetRecentlyPlayedGames response',
      cause,
    });
  }

  const games = parsed.response.games;

  // No games key or empty array — valid "nothing played recently" state.
  if (!games || games.length === 0) {
    return [];
  }

  return games.map(
    (game): RecentGame => ({
      appId: game.appid,
      name: game.name,
      iconUrl: buildIconUrl(game.appid, game.img_icon_url),
      headerUrl: buildHeaderUrl(game.appid),
      twoWeeksMinutes: game.playtime_2weeks,
      totalMinutes: game.playtime_forever,
    }),
  );
}
