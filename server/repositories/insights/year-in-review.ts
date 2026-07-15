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

  // UTC review-year window. The main playtime scan keeps the full { gte, lt }
  // bound so @@index([steamId, date]) prunes to the year's rows instead of an
  // unbounded full-partition steamId scan (ERR-0020). The bound means the main
  // scan can NEVER see pre-year rows — so the pre-year baseline (ERR-0019) is
  // sourced from its own separately bounded fetch below, never derived from
  // the main scan's rows.
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

  const [playtimeRows, baselineKeys, unlockRows] = await Promise.all([
    prisma.playtimeSnapshot.findMany({
      where: { steamId: id, date: { gte: yearStart, lt: yearEnd } },
      select: { appId: true, date: true, playtimeForever: true },
    }),
    // Pre-year baseline keys (ERR-0019): playtime is a cumulative monotonic
    // counter, so the year's gain is (in-year max) − (the last snapshot
    // STRICTLY before Jan 1). Latest pre-year snapshot date per app; bounded
    // `lt: yearStart` only, prunes on @@index([steamId, date]) and returns at
    // most one key per app.
    prisma.playtimeSnapshot.groupBy({
      by: ['appId'],
      where: { steamId: id, date: { lt: yearStart } },
      _max: { date: true },
    }),
    // Per-achievement unlock EVENTS (#91). achievementsUnlocked is counted from
    // these by real unlockedAt UTC year — not a cumulative-snapshot delta.
    // Bounded to the review year so @@index([steamId, unlockedAt]) prunes;
    // computeYearInReview re-filters by UTC year as the pure module's
    // defensive contract.
    prisma.achievementUnlock.findMany({
      where: { steamId: id, unlockedAt: { gte: yearStart, lt: yearEnd } },
      select: { steamId: true, appId: true, apiName: true, unlockedAt: true },
    }),
  ]);

  // Keyed fetch of the (appId, latest pre-year date) rows → playtimeForever.
  // Apps with no pre-year snapshot stay absent from the map, which makes
  // computeYearInReview flag the partial-year caveat rather than fabricate a
  // floor (degrade, never fabricate).
  const baselinePairs = baselineKeys.flatMap((k) =>
    k._max.date === null ? [] : [{ appId: k.appId, date: k._max.date }],
  );
  const baselineRows =
    baselinePairs.length === 0
      ? []
      : await prisma.playtimeSnapshot.findMany({
          where: { steamId: id, OR: baselinePairs },
          select: { appId: true, playtimeForever: true },
        });
  const baselineByApp = new Map<number, number>(
    baselineRows.map((r) => [r.appId, r.playtimeForever]),
  );

  // Names are only needed for the playtime-driven topGames list — derived from
  // the year-bounded rows only, so game.findMany shrinks with the main scan.
  const appIds = Array.from(new Set(playtimeRows.map((r) => r.appId)));

  const gameRecords = await prisma.game.findMany({
    where: { appId: { in: appIds } },
    select: { appId: true, name: true },
  });

  const names = new Map<number, string>(gameRecords.map((g) => [g.appId, g.name]));

  return computeYearInReview(year, playtimeRows, unlockRows, names, baselineByApp);
}
