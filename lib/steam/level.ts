/**
 * Steam Web API — IPlayerService/GetSteamLevel
 *
 * Follows the same fetchJson → steamLimiter.acquire() → withRetry → Zod parse
 * pattern as lib/steam/client.ts. The API key is fetched lazily via getEnv()
 * and never appears in thrown errors, messages, or causes.
 *
 * Missing `player_level` (private profile or new account) returns `null` — not
 * an error. The caller decides how to render the absent value.
 */

import { z } from 'zod';
import { getEnv } from '@/server/env';
import { SteamApiError } from './errors';
import { steamLimiter } from './limiter';
import { withRetry } from './retry';

// ---------------------------------------------------------------------------
// Raw response schema
// ---------------------------------------------------------------------------

const RawSteamLevelSchema = z.object({
  response: z.object({
    player_level: z.number().optional(),
  }),
});

// ---------------------------------------------------------------------------
// Local fetchJson helper (mirrors client.ts; not imported to keep boundaries)
// ---------------------------------------------------------------------------

function buildSteamLevelUrl(key: string, steamId: string): string {
  return (
    `https://api.steampowered.com/IPlayerService/GetSteamLevel/v1/` +
    `?key=${key}&steamid=${steamId}`
  );
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
 * Fetches the Steam level for a user.
 *
 * Returns `null` when `player_level` is absent in the response (private
 * profile or account with no level info) — this is NOT an error.
 * A malformed response shape throws `SteamApiError({ kind: 'schema' })`.
 */
export async function getSteamLevel(steamId: string): Promise<number | null> {
  const key = getEnv().STEAM_API_KEY;
  const url = buildSteamLevelUrl(key, steamId);

  await steamLimiter.acquire();

  const raw = await withRetry(() => fetchJson(url));

  let parsed: z.infer<typeof RawSteamLevelSchema>;
  try {
    parsed = RawSteamLevelSchema.parse(raw);
  } catch (cause) {
    throw new SteamApiError({
      kind: 'schema',
      message: 'Unexpected shape in GetSteamLevel response',
      cause,
    });
  }

  // Missing player_level is valid — private profile or new account.
  return parsed.response.player_level ?? null;
}
