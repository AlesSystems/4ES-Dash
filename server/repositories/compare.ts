/**
 * Repository for comparing two Steam users side-by-side (Phase 3, issue #31).
 *
 * Fetches each side concurrently (profile + owned games), degrades gracefully on
 * private libraries or any other fetch failures, then computes the set of shared
 * games via computeSharedGames.
 *
 * No @/server/env import — callers supply explicit steamIds. The configured user's
 * cache is re-used transparently via identical cache keys.
 */

import { getOwnedGames, getPlayerSummaries, type OwnedGame, type PlayerSummary } from '@/lib/steam';
import { isSteamApiError } from '@/lib/steam/errors';
import { computeSharedGames, type SharedGame } from '@/lib/compare/shared-games';
import { cache, cacheKey, TTL } from '@/server/cache';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ComparedSide {
  steamId: string;
  /** null when the summary fetch failed — degraded, not thrown. */
  profile: PlayerSummary | null;
  /** null when the library is private or unavailable. */
  gamesCount: number | null;
  /** Sum of playtime.total across all owned games; null when unavailable. */
  totalMinutes: number | null;
  /** true specifically when the library is private (GetOwnedGames returned {}). */
  isPrivate: boolean;
}

export interface Comparison {
  /** true when aId === bId (same Steam account compared with itself). */
  sameUser: boolean;
  a: ComparedSide;
  b: ComparedSide;
  /** null when skipped; see sharedSkipped for the reason. */
  shared: SharedGame[] | null;
  /** 'same-user' | 'unavailable' | null */
  sharedSkipped: 'same-user' | 'unavailable' | null;
  /** OR of every underlying cached result's stale flag. */
  stale: boolean;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface SideResult {
  side: ComparedSide;
  games: OwnedGame[] | null;
  stale: boolean;
}

/** Fetch one side: profile + owned games, degrading on any failure. */
async function fetchSide(steamId: string): Promise<SideResult> {
  // Run profile and games concurrently; each failure is independent.
  const [summaryResult, gamesResult] = await Promise.allSettled([
    cache(cacheKey('player-summaries', steamId), TTL.playerSummaries, () =>
      getPlayerSummaries(steamId),
    ),
    cache(cacheKey('owned-games', steamId), TTL.ownedGames, () => getOwnedGames(steamId)),
  ]);

  // --- Profile ---
  let profile: PlayerSummary | null = null;
  let summaryStale = false;
  if (summaryResult.status === 'fulfilled') {
    profile = summaryResult.value.value;
    summaryStale = summaryResult.value.stale;
  }
  // On rejection we leave profile as null and stale as false (nothing to OR in).

  // --- Owned games ---
  let games: OwnedGame[] | null = null;
  let isPrivate = false;
  let gamesStale = false;

  if (gamesResult.status === 'fulfilled') {
    games = gamesResult.value.value;
    gamesStale = gamesResult.value.stale;
  } else {
    // Rejection: either the cache had no prior value (cold failure propagated)
    // or it propagated. Distinguish private from other errors.
    const err = gamesResult.reason;
    if (isSteamApiError(err) && err.kind === 'private') {
      isPrivate = true;
    }
    // Either way, games are unavailable.
  }

  const gamesCount = games !== null ? games.length : null;
  const totalMinutes = games !== null ? games.reduce((acc, g) => acc + g.playtime.total, 0) : null;

  return {
    side: { steamId, profile, gamesCount, totalMinutes, isPrivate },
    games,
    stale: summaryStale || gamesStale,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compare two Steam users by steamId.
 *
 * Never throws for private/unavailable libraries — those degrade to null fields.
 * Only throws when an unexpected error propagates from a cold cache hit (no prior
 * value) for a non-private, non-degradable failure.
 */
export async function getComparison(aId: string, bId: string): Promise<Comparison> {
  const sameUser = aId === bId;

  // Fetch both sides concurrently.
  const [aResult, bResult] = await Promise.all([fetchSide(aId), fetchSide(bId)]);

  const stale = aResult.stale || bResult.stale;

  // Determine shared games.
  let shared: SharedGame[] | null = null;
  let sharedSkipped: Comparison['sharedSkipped'] = null;

  if (sameUser) {
    sharedSkipped = 'same-user';
  } else if (aResult.games === null || bResult.games === null) {
    sharedSkipped = 'unavailable';
  } else {
    shared = computeSharedGames(aResult.games, bResult.games);
  }

  return {
    sameUser,
    a: aResult.side,
    b: bResult.side,
    shared,
    sharedSkipped,
    stale,
  };
}
