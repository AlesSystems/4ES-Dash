/**
 * Year-in-Review repository (Phase 4, issue #34).
 *
 * Queries snapshot tables and delegates computation to the pure
 * lib/insights/year-in-review module.
 */

import { prisma } from '@/server/db';
import { requireSteamId } from '@/server/repositories/require-steam-id';
import { availableYears, computeYearInReview, type YearInReview } from '@/lib/insights';

/**
 * Distinct UTC years with ≥1 playtime snapshot for the user, sorted DESC.
 * Returns [] when no snapshots exist.
 */
export async function getAvailableReviewYears(steamId: string): Promise<number[]> {
  const id = requireSteamId(steamId, 'getAvailableReviewYears');

  const rows = await prisma.playtimeSnapshot.findMany({
    where: { steamId: id },
    select: { date: true },
  });

  return availableYears(rows);
}

/**
 * Year recap from snapshots. Calls computeYearInReview with playtime and
 * achievement snapshot rows for the given year. Game names come from the
 * Game reference table (falls back to "App {id}").
 *
 * Returns totals of 0 + empty topGames when the year has no data.
 */
export async function getYearInReview(steamId: string, year: number): Promise<YearInReview> {
  const id = requireSteamId(steamId, 'getYearInReview');

  const [playtimeRows, unlockRows] = await Promise.all([
    prisma.playtimeSnapshot.findMany({
      where: { steamId: id },
      select: { appId: true, date: true, playtimeForever: true },
    }),
    // Per-achievement unlock EVENTS (#91). achievementsUnlocked is counted from
    // these by real unlockedAt UTC year — not a cumulative-snapshot delta.
    prisma.achievementUnlock.findMany({
      where: { steamId: id },
      select: { steamId: true, appId: true, apiName: true, unlockedAt: true },
    }),
  ]);

  // Prior-year baseline (ERR-0019): playtime is a cumulative monotonic counter,
  // so the year's gain is (in-year max) − (last snapshot strictly before Jan 1).
  // Derive that floor per app from the already-fetched rows — collapse rows dated
  // before the UTC year boundary to the latest value seen for each app. Apps with
  // no pre-year snapshot are absent, which makes computeYearInReview flag the
  // partial-year caveat rather than fabricate a floor.
  const yearStartMs = Date.UTC(year, 0, 1, 0, 0, 0, 0);
  const baselineByApp = new Map<number, number>();
  const baselineDate = new Map<number, number>();
  for (const row of playtimeRows) {
    const t = row.date.getTime();
    if (t >= yearStartMs) continue;
    const seen = baselineDate.get(row.appId);
    if (seen === undefined || t >= seen) {
      baselineDate.set(row.appId, t);
      baselineByApp.set(row.appId, row.playtimeForever);
    }
  }

  // Names are only needed for the playtime-driven topGames list.
  const appIds = Array.from(new Set(playtimeRows.map((r) => r.appId)));

  const gameRecords = await prisma.game.findMany({
    where: { appId: { in: appIds } },
    select: { appId: true, name: true },
  });

  const names = new Map<number, string>(gameRecords.map((g) => [g.appId, g.name]));

  return computeYearInReview(year, playtimeRows, unlockRows, names, baselineByApp);
}
