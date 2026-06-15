/**
 * Steam Web API client functions for achievements.
 *
 * Three endpoints:
 *   1. GetPlayerAchievements   — per-user progress for a single game
 *   2. GetSchemaForGame        — achievement metadata (display names, icons)
 *   3. GetGlobalAchievementPercentages — global unlock rates (no key required)
 *
 * All network I/O follows the same pattern as lib/steam/client.ts:
 *   steamLimiter.acquire()  →  withRetry(() => fetchJson(url))  →  Zod parse
 *
 * Security rules (CLAUDE.md):
 *   - API key is fetched lazily via getEnv() — never at module top-level.
 *   - The key NEVER appears in thrown errors, messages, or cause.
 *   - URLs are constructed server-side only; never passed to the client.
 */

import { z } from 'zod';
import { getEnv } from '@/server/env';
import { Availability, available, unavailable } from '@/lib/result';
import { SteamApiError } from './errors';
import { steamLimiter } from './limiter';
import { withRetry } from './retry';

// ---------------------------------------------------------------------------
// Shared HTTP helper (local copy — do not import from client.ts)
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
// Domain types
// ---------------------------------------------------------------------------

export type PlayerAchievement = {
  apiName: string;
  unlocked: boolean;
  /** ISO-8601 UTC string, or null when never unlocked or Steam reports unlocktime 0. */
  unlockedAt: string | null;
};

export type AchievementSchema = {
  apiName: string;
  displayName: string;
  description: string;
  iconUrl: string;
  iconGrayUrl: string;
};

// ---------------------------------------------------------------------------
// Zod raw schemas
// ---------------------------------------------------------------------------

const RawAchievementProgressItem = z.object({
  apiname: z.string(),
  achieved: z.union([z.literal(0), z.literal(1)]),
  unlocktime: z.number(),
});

const RawPlayerAchievements = z.object({
  playerstats: z.object({
    success: z.boolean(),
    error: z.string().optional(),
    achievements: z.array(RawAchievementProgressItem).optional(),
  }),
});

const RawAchievementSchemaItem = z.object({
  name: z.string(),
  displayName: z.string(),
  description: z.string().optional(),
  icon: z.string(),
  icongray: z.string(),
});

const RawSchemaForGame = z.object({
  game: z
    .object({
      availableGameStats: z
        .object({
          achievements: z.array(RawAchievementSchemaItem).optional(),
        })
        .optional(),
    })
    .optional(),
});

const RawGlobalPercentageItem = z.object({
  name: z.string(),
  percent: z.number(),
});

const RawGlobalAchievementPercentages = z.object({
  achievementpercentages: z.object({
    achievements: z.array(RawGlobalPercentageItem),
  }),
});

// ---------------------------------------------------------------------------
// URL helpers (no secret exposure — callers never see these URLs)
// ---------------------------------------------------------------------------

function buildPlayerAchievementsUrl(key: string, steamId: string, appId: number): string {
  return (
    `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/` +
    `?key=${key}&steamid=${steamId}&appid=${appId}`
  );
}

function buildSchemaForGameUrl(key: string, appId: number): string {
  return (
    `https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/` +
    `?key=${key}&appid=${appId}`
  );
}

function buildGlobalAchievementPercentagesUrl(appId: number): string {
  // Note: no API key needed for this endpoint.
  return (
    `https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/` +
    `?gameid=${appId}`
  );
}

// ---------------------------------------------------------------------------
// Domain mapping helpers
// ---------------------------------------------------------------------------

function toIsoOrNull(unixSeconds: number): string | null {
  if (unixSeconds === 0) return null;
  return new Date(unixSeconds * 1000).toISOString();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetches per-user achievement progress for a single game.
 *
 * Degrades to `unavailable('private')` when the profile is not public and to
 * `unavailable('no-achievements')` when the game has no stats / no achievements.
 *
 * Auth (401/403), rate-limit (429), and transient (5xx) errors are thrown as
 * `SteamApiError` — they are non-recoverable at this layer.
 */
export async function getPlayerAchievements(
  steamId: string,
  appId: number,
): Promise<Availability<PlayerAchievement[]>> {
  const key = getEnv().STEAM_API_KEY;
  const url = buildPlayerAchievementsUrl(key, steamId, appId);

  await steamLimiter.acquire();

  const raw = await withRetry(() => fetchJson(url));

  let parsed: z.infer<typeof RawPlayerAchievements>;
  try {
    parsed = RawPlayerAchievements.parse(raw);
  } catch (cause) {
    throw new SteamApiError({
      kind: 'schema',
      message: 'Unexpected shape in GetPlayerAchievements response',
      cause,
    });
  }

  const { playerstats } = parsed;

  // success:false → distinguish "no stats/achievements" from "private profile".
  // Check the no-stats signal first so a future error string that merely contains
  // the word "profile" isn't misclassified as private. Never surface the raw
  // upstream error text to the UI — map to a static, sanitized message.
  if (!playerstats.success) {
    const lowerMsg = (playerstats.error ?? '').toLowerCase();
    const isNoStats = lowerMsg.includes('stat') || lowerMsg.includes('no achievement');
    if (!isNoStats && (lowerMsg.includes('not public') || lowerMsg.includes('profile'))) {
      return unavailable('private', 'Steam achievement data is not public');
    }
    return unavailable('no-achievements', 'Game has no achievement stats');
  }

  // success:true but no achievements array — game has no achievements.
  if (playerstats.achievements === undefined) {
    return unavailable('no-achievements', 'Game has no achievements');
  }

  const result: PlayerAchievement[] = playerstats.achievements.map((a) => ({
    apiName: a.apiname,
    unlocked: a.achieved === 1,
    unlockedAt: toIsoOrNull(a.unlocktime),
  }));

  return available(result);
}

/**
 * Fetches achievement definitions (display name, description, icon URLs) for a game.
 * Returns an empty array when the game has no achievement schema.
 */
export async function getSchemaForGame(appId: number): Promise<AchievementSchema[]> {
  const key = getEnv().STEAM_API_KEY;
  const url = buildSchemaForGameUrl(key, appId);

  await steamLimiter.acquire();

  const raw = await withRetry(() => fetchJson(url));

  let parsed: z.infer<typeof RawSchemaForGame>;
  try {
    parsed = RawSchemaForGame.parse(raw);
  } catch (cause) {
    throw new SteamApiError({
      kind: 'schema',
      message: 'Unexpected shape in GetSchemaForGame response',
      cause,
    });
  }

  const achievements = parsed.game?.availableGameStats?.achievements;
  if (achievements === undefined || achievements.length === 0) {
    return [];
  }

  return achievements.map((a) => ({
    apiName: a.name,
    displayName: a.displayName,
    description: a.description ?? '',
    iconUrl: a.icon,
    iconGrayUrl: a.icongray,
  }));
}

/**
 * Fetches global achievement unlock percentages for a game.
 * No API key required. Degrades to an empty Map on any failure (403, unexpected
 * shape, network error) — some apps do not expose global stats.
 */
export async function getGlobalAchievementPercentages(appId: number): Promise<Map<string, number>> {
  const url = buildGlobalAchievementPercentagesUrl(appId);

  try {
    await steamLimiter.acquire();
    const raw = await withRetry(() => fetchJson(url));

    let parsed: z.infer<typeof RawGlobalAchievementPercentages>;
    try {
      parsed = RawGlobalAchievementPercentages.parse(raw);
    } catch {
      // Unexpected shape — degrade silently.
      return new Map();
    }

    const result = new Map<string, number>();
    for (const item of parsed.achievementpercentages.achievements) {
      result.set(item.name, item.percent);
    }
    return result;
  } catch {
    // Any network/auth/rate-limit failure — degrade to empty map.
    return new Map();
  }
}
