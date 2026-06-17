/**
 * SteamSpy enrichment client (T2 — free opt-in, best-effort).
 *
 * Talks to steamspy.com/api.php, NOT api.steampowered.com.
 * Rules:
 *   - NEVER sends STEAM_API_KEY.
 *   - Sends a descriptive User-Agent header.
 *   - Rate-limited with steamLimiter.acquire() before each fetch.
 *   - Single attempt — best-effort; no withRetry.
 *   - All failures (network, non-200, bad shape) degrade to
 *     Availability<T> { available: false, reason: 'metadata-unavailable' }.
 *     They are never thrown to callers.
 *
 * Note: SteamSpy asks for ≤1 req/sec for appdetails; the repository caches
 * ≥24 h (TTL.steamSpy) which mitigates burst concerns.
 * Gating on the ENABLE_STEAMSPY feature flag happens in the repository, not here.
 * This module is client-safe: no process.env, no server/ imports.
 */

import { z } from 'zod';
import { available, unavailable, type Availability } from '@/lib/result';
import { steamLimiter } from './limiter';

// ---------------------------------------------------------------------------
// Domain types (exported for consumers)
// ---------------------------------------------------------------------------

export interface SteamSpyTag {
  name: string;
  votes: number;
}

export interface SteamSpyData {
  /** Genre strings split from the 'genre' field on ', '; [] if absent. */
  genres: string[];
  /** Tags from the tags object, sorted by votes descending; [] if absent/array. */
  tags: SteamSpyTag[];
  /** Raw owners band string (e.g. "10,000,000 .. 20,000,000"); '' if absent. */
  ownersBand: string;
}

// ---------------------------------------------------------------------------
// Zod schemas — lenient: only assert what we read
// ---------------------------------------------------------------------------

/**
 * SteamSpy returns `tags` as either:
 *   - an object  { "Tag Name": <votes>, ... }  when present
 *   - an empty array  []  when absent
 * We normalise both into SteamSpyTag[].
 */
const RawTagsField = z.union([
  // Object mapping tag name → vote count
  z.record(z.string(), z.number()),
  // Empty array (no tags)
  z.array(z.unknown()),
]);

const RawSteamSpyAppDetails = z
  .object({
    appid: z.union([z.number(), z.string()]).optional(),
    name: z.string().optional(),
    developer: z.string().optional(),
    publisher: z.string().optional(),
    owners: z.string().optional(),
    genre: z.string().optional(),
    tags: RawTagsField.optional(),
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEAMSPY_BASE_URL = 'https://steamspy.com/api.php';
const USER_AGENT = '4ES-Dash/0.0.0 (+https://github.com/AlesSystems/4ES-Dash)';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function parseTags(raw: z.infer<typeof RawTagsField> | undefined): SteamSpyTag[] {
  if (raw === undefined) return [];
  // Empty array or non-object array → no tags
  if (Array.isArray(raw)) return [];
  // Object: { "Tag Name": votes }
  return Object.entries(raw)
    .map(([name, votes]) => ({ name, votes }))
    .sort((a, b) => b.votes - a.votes);
}

function parseGenres(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch SteamSpy enrichment for one app.
 * Degrades to unavailable('metadata-unavailable') on any failure.
 * Single attempt, rate-limited via steamLimiter.
 */
export async function getSteamSpyData(appId: number): Promise<Availability<SteamSpyData>> {
  const url = `${STEAMSPY_BASE_URL}?request=appdetails&appid=${appId}`;

  await steamLimiter.acquire();

  let raw: unknown;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn('[steamspy-client] HTTP %d for appId=%d', res.status, appId);
      return unavailable('metadata-unavailable');
    }

    raw = (await res.json()) as unknown;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[steamspy-client] fetch failed for appId=%d: %o', appId, err);
    return unavailable('metadata-unavailable');
  }

  let parsed: z.infer<typeof RawSteamSpyAppDetails>;
  try {
    parsed = RawSteamSpyAppDetails.parse(raw);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[steamspy-client] schema mismatch for appId=%d: %o', appId, err);
    return unavailable('metadata-unavailable');
  }

  const data: SteamSpyData = {
    genres: parseGenres(parsed.genre),
    tags: parseTags(parsed.tags),
    ownersBand: parsed.owners ?? '',
  };

  return available(data);
}
