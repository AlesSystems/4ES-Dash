/**
 * Steam Web API client.
 *
 * All network I/O passes through:
 *   steamLimiter.acquire()  →  withRetry(() => fetchJson(url))  →  Zod parse
 *
 * Security rules (CLAUDE.md):
 *  - API key is fetched lazily via getEnv() — never at module top-level.
 *  - The key NEVER appears in thrown errors, messages, or `cause`.
 *  - URLs are constructed server-side only; never passed to the client.
 */

import { getEnv } from '@/server/env';
import { SteamApiError } from './errors';
import { steamLimiter } from './limiter';
import { OwnedGame, PlayerSummary, RawOwnedGames, RawPlayerSummaries } from './schemas';
import { withRetry } from './retry';

// ---------------------------------------------------------------------------
// Shared HTTP helper
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
// URL helpers (no secret exposure — callers never see these URLs)
// ---------------------------------------------------------------------------

function buildPlayerSummariesUrl(key: string, steamId: string): string {
  return `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${key}&steamids=${steamId}`;
}

function buildOwnedGamesUrl(key: string, steamId: string): string {
  return (
    `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/` +
    `?key=${key}&steamid=${steamId}&include_appinfo=1&include_played_free_games=1`
  );
}

// ---------------------------------------------------------------------------
// Domain mapping helpers
// ---------------------------------------------------------------------------

function toIsoOrNull(unixSeconds: number | undefined): string | null {
  if (unixSeconds == null || unixSeconds === 0) return null;
  return new Date(unixSeconds * 1000).toISOString();
}

function buildIconUrl(appId: number, imgIconUrl: string | undefined): string | null {
  if (!imgIconUrl) return null;
  return `https://media.steampowered.com/steamcommunity/public/images/apps/${appId}/${imgIconUrl}.jpg`;
}

function buildHeaderUrl(appId: number): string {
  return `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetches the Steam profile summary for a single `steamId`.
 * Throws `SteamApiError({ kind: 'schema' })` if the player is not in the response.
 */
export async function getPlayerSummaries(steamId: string): Promise<PlayerSummary> {
  const key = getEnv().STEAM_API_KEY;
  const url = buildPlayerSummariesUrl(key, steamId);

  await steamLimiter.acquire();

  const raw = await withRetry(() => fetchJson(url));

  let parsed: ReturnType<typeof RawPlayerSummaries.parse>;
  try {
    parsed = RawPlayerSummaries.parse(raw);
  } catch (cause) {
    throw new SteamApiError({
      kind: 'schema',
      message: 'Unexpected shape in GetPlayerSummaries response',
      cause,
    });
  }

  const player = parsed.response.players[0];
  if (player === undefined) {
    throw new SteamApiError({
      kind: 'schema',
      message: 'No player returned in GetPlayerSummaries response',
    });
  }

  const result: PlayerSummary = {
    steamId: player.steamid,
    personaName: player.personaname,
    avatar: {
      small: player.avatar,
      medium: player.avatarmedium,
      full: player.avatarfull,
    },
    profileUrl: player.profileurl,
    createdAt: toIsoOrNull(player.timecreated),
    ...(player.loccountrycode !== undefined ? { countryCode: player.loccountrycode } : {}),
  };

  return result;
}

/**
 * Fetches the owned games for a `steamId`.
 * Throws `SteamApiError({ kind: 'private' })` when the library is not public
 * (Steam returns `{ response: {} }` — no `games` key at all).
 */
export async function getOwnedGames(steamId: string): Promise<OwnedGame[]> {
  const key = getEnv().STEAM_API_KEY;
  const url = buildOwnedGamesUrl(key, steamId);

  await steamLimiter.acquire();

  const raw = await withRetry(() => fetchJson(url));

  let parsed: ReturnType<typeof RawOwnedGames.parse>;
  try {
    parsed = RawOwnedGames.parse(raw);
  } catch (cause) {
    throw new SteamApiError({
      kind: 'schema',
      message: 'Unexpected shape in GetOwnedGames response',
      cause,
    });
  }

  // `games` key absence == private profile.
  if (!('games' in parsed.response) || parsed.response.games === undefined) {
    throw new SteamApiError({
      kind: 'private',
      message: 'Steam library is not public',
    });
  }

  return parsed.response.games.map(
    (game): OwnedGame => ({
      appId: game.appid,
      name: game.name ?? '',
      iconUrl: buildIconUrl(game.appid, game.img_icon_url),
      headerUrl: buildHeaderUrl(game.appid),
      playtime: {
        total: game.playtime_forever,
        twoWeeks: game.playtime_2weeks ?? 0,
      },
      lastPlayed: toIsoOrNull(game.rtime_last_played),
      hasAchievements: game.has_community_visible_stats ?? false,
    }),
  );
}
