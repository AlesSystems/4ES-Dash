/**
 * Year-in-Review repository (Phase 4, issue #34).
 *
 * Queries snapshot tables and delegates computation to the pure
 * lib/insights/year-in-review module.
 */

import { prisma } from '@/server/db';
import { getEnv } from '@/server/env';
import { availableYears, computeYearInReview, type YearInReview } from '@/lib/insights';

/**
 * Distinct UTC years with ≥1 playtime snapshot for the user, sorted DESC.
 * Returns [] when no snapshots exist.
 */
export async function getAvailableReviewYears(steamId?: string): Promise<number[]> {
  const id = steamId ?? getEnv().STEAM_ID;

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
export async function getYearInReview(year: number, steamId?: string): Promise<YearInReview> {
  const id = steamId ?? getEnv().STEAM_ID;

  const [playtimeRows, achievementRows] = await Promise.all([
    prisma.playtimeSnapshot.findMany({
      where: { steamId: id },
      select: { appId: true, date: true, playtimeForever: true },
    }),
    prisma.achievementSnapshot.findMany({
      where: { steamId: id },
      select: { appId: true, date: true, unlockedCount: true },
    }),
  ]);

  // Collect unique appIds from both snapshot sets
  const appIdSet = new Set<number>();
  for (const row of playtimeRows) appIdSet.add(row.appId);
  for (const row of achievementRows) appIdSet.add(row.appId);
  const appIds = Array.from(appIdSet);

  const gameRecords = await prisma.game.findMany({
    where: { appId: { in: appIds } },
    select: { appId: true, name: true },
  });

  const names = new Map<number, string>(gameRecords.map((g) => [g.appId, g.name]));

  return computeYearInReview(year, playtimeRows, achievementRows, names);
}
