/**
 * Year-in-Review computation for a single UTC calendar year (issue #34).
 *
 * Pure module — no I/O, no server imports. Accepts snapshot rows and returns
 * a structured summary of total playtime gained, top games, and achievements
 * unlocked within the year. Delta convention mirrors lib/history/aggregate.ts:
 * per-game delta = max(playtimeForever) − min(playtimeForever) among snapshots
 * whose UTC year matches, clamped to ≥0.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single playtime snapshot row from the database. */
export interface YearPlaytimeRow {
  appId: number;
  date: Date;
  playtimeForever: number; // minutes, monotonic
}

/** A single achievement-count snapshot row. */
export interface YearAchievementRow {
  appId: number;
  date: Date;
  unlockedCount: number;
}

/** One entry in the top-games list. */
export interface TopGame {
  appId: number;
  name: string;
  minutesDelta: number;
}

/** The computed Year in Review for one calendar year. */
export interface YearInReview {
  year: number;
  /** Sum of per-game (max − min) playtime deltas within the year, each ≥0. */
  totalMinutes: number;
  /** Games with minutesDelta > 0, sorted desc, top 5. */
  topGames: TopGame[];
  /** Sum of per-game (max − min) achievement-count deltas within the year, each ≥0. */
  achievementsUnlocked: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * For each appId in `rows`, compute (max − min) of `getValue(row)` among
 * rows whose UTC year matches `year`, clamped to ≥0.
 */
function deltasByApp<T extends { appId: number; date: Date }>(
  rows: T[],
  year: number,
  getValue: (row: T) => number,
): Map<number, number> {
  const minMax = new Map<number, { min: number; max: number }>();

  for (const row of rows) {
    if (row.date.getUTCFullYear() !== year) continue;
    const v = getValue(row);
    const existing = minMax.get(row.appId);
    if (existing === undefined) {
      minMax.set(row.appId, { min: v, max: v });
    } else {
      existing.min = Math.min(existing.min, v);
      existing.max = Math.max(existing.max, v);
    }
  }

  const deltas = new Map<number, number>();
  for (const [appId, { min, max }] of minMax) {
    deltas.set(appId, Math.max(0, max - min));
  }
  return deltas;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the distinct UTC calendar years that appear in `rows`, sorted
 * descending. Drives the year-navigation UI; empty rows returns [].
 */
export function availableYears(rows: { date: Date }[]): number[] {
  const years = new Set<number>();
  for (const row of rows) {
    years.add(row.date.getUTCFullYear());
  }
  return Array.from(years).sort((a, b) => b - a);
}

/**
 * Computes the Year in Review for a single UTC calendar year.
 *
 * @param year            The UTC year to summarise (e.g. 2025).
 * @param playtimeRows    All playtime snapshot rows (any years — filtered internally).
 * @param achievementRows All achievement snapshot rows (any years — filtered internally).
 * @param names           Map of appId → display name. Falls back to `"App {appId}"`.
 */
export function computeYearInReview(
  year: number,
  playtimeRows: YearPlaytimeRow[],
  achievementRows: YearAchievementRow[],
  names: Map<number, string>,
): YearInReview {
  const playtimeDeltas = deltasByApp(playtimeRows, year, (r) => r.playtimeForever);
  const achievementDeltas = deltasByApp(achievementRows, year, (r) => r.unlockedCount);

  // Total playtime = sum of all per-game deltas.
  let totalMinutes = 0;
  for (const delta of playtimeDeltas.values()) {
    totalMinutes += delta;
  }

  // Top games: only those with > 0 minutes, sorted desc, top 5.
  const topGames: TopGame[] = Array.from(playtimeDeltas.entries())
    .filter(([, delta]) => delta > 0)
    .sort(([aId, aDelta], [bId, bDelta]) => {
      if (bDelta !== aDelta) return bDelta - aDelta;
      return aId - bId; // stable tie-break
    })
    .slice(0, 5)
    .map(([appId, minutesDelta]) => ({
      appId,
      name: names.get(appId) ?? `App ${appId}`,
      minutesDelta,
    }));

  // Total achievements = sum of all per-game achievement deltas.
  let achievementsUnlocked = 0;
  for (const delta of achievementDeltas.values()) {
    achievementsUnlocked += delta;
  }

  return { year, totalMinutes, topGames, achievementsUnlocked };
}
