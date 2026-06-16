/**
 * Read-side repository for snapshot-derived data (#26, #27).
 *
 * Snapshots are the long-term value of the app: `acquiredAt` is inferred as the
 * first day a game appears here, and all playtime time-series derive from these
 * rows. Steam itself exposes none of this.
 */

import { prisma } from '@/server/db';
import { getProfile } from '@/server/repositories/profile';
import { getEnv } from '@/server/env';
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
 */
export async function getFirstSeenDates(steamId?: string): Promise<Map<number, string>> {
  const id = steamId ?? getEnv().STEAM_ID;
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
 */
export async function getLibraryWithAcquisition(): Promise<{
  games: LibraryGame[];
  stale: boolean;
}> {
  const { games, stale } = await getProfile();
  const firstSeen = await getFirstSeenDates();
  const withDates: LibraryGame[] = games.map((g) => ({
    ...g,
    acquiredAt: firstSeen.get(g.appId) ?? null,
  }));
  return { games: withDates, stale };
}

/**
 * Raw playtime snapshot rows for the configured user, oldest-first. The pure
 * weekly/monthly bucketing lives in `lib/history/aggregate.ts` (#27).
 */
export async function getPlaytimeSnapshots(steamId?: string): Promise<PlaytimeSnapshotRow[]> {
  const id = steamId ?? getEnv().STEAM_ID;
  return prisma.playtimeSnapshot.findMany({
    where: { steamId: id },
    select: { appId: true, date: true, playtimeForever: true },
    orderBy: { date: 'asc' },
  });
}
