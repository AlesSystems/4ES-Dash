/**
 * Read-side repository for snapshot-derived data (#26, #27).
 *
 * Snapshots are the long-term value of the app: `acquiredAt` is inferred as the
 * first day a game appears here, and all playtime time-series derive from these
 * rows. Steam itself exposes none of this.
 */

import { prisma } from '@/server/db';
import { cache, cacheKey, TTL } from '@/server/cache';
import { getProfile } from '@/server/repositories/profile';
import { requireSteamId } from '@/server/repositories/require-steam-id';
import type { LibraryGame } from '@/lib/games/sort';

/** A single playtime snapshot row, in shape for time-series aggregation (#27). */
export interface PlaytimeSnapshotRow {
  appId: number;
  date: Date;
  playtimeForever: number;
}

/**
 * The first date each owned app appeared in a snapshot → inferred `acquiredAt`.
 * Returns a map of `appId → "YYYY-MM-DD"`. Apps never snapshotted are absent
 * (their `acquiredAt` stays null — never fabricated).
 *
 * @param steamId - Required. Pass getEnv().STEAM_ID at the call site for the
 *   featured/dev default — never read env.STEAM_ID inside this repository.
 */
export async function getFirstSeenDates(steamId: string): Promise<Map<number, string>> {
  const id = requireSteamId(steamId, 'getFirstSeenDates');
  const rows = await prisma.playtimeSnapshot.groupBy({
    by: ['appId'],
    where: { steamId: id },
    _min: { date: true },
  });
  return new Map(
    rows
      .filter((r) => r._min.date != null)
      .map((r) => [r.appId, r._min.date!.toISOString().slice(0, 10)]),
  );
}

/**
 * Owned games with snapshot-inferred `acquiredAt` merged in — the data source for
 * the library's `sort=added`. Games owned before snapshotting began keep
 * `acquiredAt: null`, which the library UI surfaces with a "dates may be missing"
 * note (app/library/page.tsx). A drop-in replacement for `getProfile()` on that page.
 *
 * @param steamId - Required. Pass getEnv().STEAM_ID at the call site for the
 *   featured/dev default — never read env.STEAM_ID inside this repository.
 */
export async function getLibraryWithAcquisition(steamId: string): Promise<{
  games: LibraryGame[];
  stale: boolean;
}> {
  const id = requireSteamId(steamId, 'getLibraryWithAcquisition');
  const { games, stale } = await getProfile(id);
  const firstSeen = await getFirstSeenDates(id);
  const withDates: LibraryGame[] = games.map((g) => ({
    ...g,
    acquiredAt: firstSeen.get(g.appId) ?? null,
  }));
  return { games: withDates, stale };
}

/**
 * Raw playtime snapshot rows for the given user, oldest-first. The pure
 * weekly/monthly bucketing lives in `lib/history/aggregate.ts` (#27).
 *
 * @param steamId - Required. Pass getEnv().STEAM_ID at the call site for the
 *   featured/dev default — never read env.STEAM_ID inside this repository.
 * @param opts.since - Optional lower date bound (inclusive). When provided the
 *   scan is windowed with `date: { gte: since }` so the compound
 *   `(steamId, date)` index prunes instead of hydrating the full append-only
 *   history (Theme 1 / T4, DATA-6). Callers must pass a value floored to the
 *   rendering bucket's boundary — see `historyWindowStart` in
 *   `lib/history/aggregate.ts` — or the oldest rendered bucket under-counts.
 *   Omitted → byte-identical full-history behavior (getFirstSeenDates and
 *   acquiredAt inference depend on full history and never pass `since`).
 *
 * The since-parameterized path (the /history read) is cached at
 * `TTL.insightsAggregate` (Theme 1 / T5, DATA-4): snapshots are written once
 * nightly, so the windowed scan is safe to reuse. The unparameterized
 * full-history path stays UNCACHED — its callers (acquiredAt inference) expect
 * a direct read. windowCode discriminator: the epoch-ms of `since`
 * (`since.getTime()`) — callers floor `since` to the bucket boundary, so the
 * code is stable per rendered window and distinct windows never share an entry.
 */
export async function getPlaytimeSnapshots(
  steamId: string,
  opts?: { since?: Date },
): Promise<PlaytimeSnapshotRow[]> {
  const id = requireSteamId(steamId, 'getPlaytimeSnapshots');
  const since = opts?.since;
  if (since !== undefined) {
    const { value } = await cache(
      cacheKey('history-snapshots', id, since.getTime()),
      TTL.insightsAggregate,
      () => queryPlaytimeSnapshots(id, since),
    );
    return value;
  }
  return queryPlaytimeSnapshots(id, undefined);
}

/** The raw scan — shared by the cached (windowed) and uncached (full) paths. */
function queryPlaytimeSnapshots(id: string, since: Date | undefined): Promise<PlaytimeSnapshotRow[]> {
  return prisma.playtimeSnapshot.findMany({
    where: since ? { steamId: id, date: { gte: since } } : { steamId: id },
    select: { appId: true, date: true, playtimeForever: true },
    orderBy: { date: 'asc' },
  });
}
