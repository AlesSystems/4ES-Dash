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

/** A persisted achievement unlock event row (AchievementUnlock table). */
export interface AchievementUnlockRow {
  steamId: string;
  appId: number;
  apiName: string;
  unlockedAt: Date;
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
  /** Sum of per-game playtime gained within the year (each ≥0). */
  totalMinutes: number;
  /** Games with minutesDelta > 0, sorted desc, top 5. */
  topGames: TopGame[];
  /** Sum of per-game (max − min) achievement-count deltas within the year, each ≥0. */
  achievementsUnlocked: number;
  /**
   * True when ≥1 game contributing playtime had NO snapshot strictly before
   * Jan 1 of the year (onboarded mid-year). Its floor is the first in-year
   * snapshot instead of a real pre-year baseline, so its gain is a lower bound.
   * Degrade-never-fabricate: surfaced as a caveat rather than a silent number.
   */
  partialYear: boolean;
}

// ---------------------------------------------------------------------------
// countUnlocksInYear
// ---------------------------------------------------------------------------

/**
 * Counts AchievementUnlock rows whose unlockedAt UTC year === year.
 *
 * - Does NOT restrict to any top-N set of games.
 * - Rows with unlocktime 0 are already excluded upstream (stored as null and
 *   never inserted into AchievementUnlock); this function adds a defensive
 *   guard: any row with getUTCFullYear() === 1970 is excluded.
 * - seconds-vs-ms: the caller is responsible for passing Date objects already
 *   converted from unix seconds × 1000. This function operates on Date values
 *   only, making it pure and easy to test.
 */
export function countUnlocksInYear(rows: AchievementUnlockRow[], year: number): number {
  let count = 0;
  for (const row of rows) {
    const y = row.unlockedAt.getUTCFullYear();
    // Guard: exclude any row that maps to epoch (unlocktime 0 guard)
    if (y === 1970) continue;
    if (y === year) count += 1;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Per-app playtime gain plus whether any contributing app lacked a baseline. */
interface PlaytimeDeltaResult {
  /** appId → minutes gained within the year (each ≥0). */
  deltas: Map<number, number>;
  /**
   * True when ≥1 app with a positive gain had NO snapshot strictly before the
   * year (its floor fell back to the first in-year snapshot).
   */
  partialYear: boolean;
}

/**
 * Playtime gain per app for the year of a CUMULATIVE monotonic counter.
 *
 * The gain is `(max in-year) − baseline`, where the baseline is the value of the
 * LAST snapshot strictly before Jan 1 of the year (ERR-0019). A cumulative delta
 * needs a sample bracketing the LOWER edge of the window; deriving the floor from
 * the in-year minimum under-counts hours accrued before the first in-year sample.
 *
 * When an app has no pre-year baseline (onboarded mid-year), the first in-year
 * snapshot is used as a best-effort floor and `partialYear` is flagged — we
 * degrade with a caveat rather than fabricate a number.
 */
function playtimeDeltasByApp<T extends { appId: number; date: Date }>(
  rows: T[],
  year: number,
  baselineByApp: Map<number, number>,
  getValue: (row: T) => number,
): PlaytimeDeltaResult {
  // Per app, track the max in-year value and the first in-year sample (fallback floor).
  const inYear = new Map<number, { max: number; firstValue: number; firstDate: Date }>();

  for (const row of rows) {
    if (row.date.getUTCFullYear() !== year) continue;
    const v = getValue(row);
    const existing = inYear.get(row.appId);
    if (existing === undefined) {
      inYear.set(row.appId, { max: v, firstValue: v, firstDate: row.date });
    } else {
      existing.max = Math.max(existing.max, v);
      if (row.date.getTime() < existing.firstDate.getTime()) {
        existing.firstValue = v;
        existing.firstDate = row.date;
      }
    }
  }

  const deltas = new Map<number, number>();
  let partialYear = false;
  for (const [appId, { max, firstValue }] of inYear) {
    const baseline = baselineByApp.get(appId);
    const hasBaseline = baseline !== undefined;
    // Real baseline if we have one, else fall back to the first in-year sample.
    const floor = hasBaseline ? baseline : firstValue;
    // Monotonic clamp: never negative (Steam-side corrections can lower values).
    const gain = Math.max(0, max - floor);
    deltas.set(appId, gain);
    // Any in-year app without a real pre-year baseline makes the year's total a
    // lower bound — flag it regardless of this app's gain.
    if (!hasBaseline) partialYear = true;
  }
  return { deltas, partialYear };
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
 * @param year                  The UTC year to summarise (e.g. 2025).
 * @param playtimeRows          All playtime snapshot rows (any years — filtered internally).
 * @param achievementUnlockRows All achievement UNLOCK EVENT rows (any years —
 *   filtered internally). achievementsUnlocked is counted from these by real
 *   `unlockedAt` UTC year (#91), NOT from a cumulative-snapshot delta, so the
 *   count is correct with a single day of data and no snapshot history, and an
 *   unlock in a game outside the top-played set still contributes.
 * @param names                 Map of appId → display name. Falls back to `"App {appId}"`.
 * @param baselineByApp         appId → playtimeForever of the LAST snapshot
 *   strictly before Jan 1 of `year` (ERR-0019). Games absent from this map had
 *   no pre-year baseline; their gain floors at the first in-year snapshot and
 *   sets `partialYear`. Defaults to empty (all games treated as onboarded now).
 */
export function computeYearInReview(
  year: number,
  playtimeRows: YearPlaytimeRow[],
  achievementUnlockRows: AchievementUnlockRow[],
  names: Map<number, string>,
  baselineByApp: Map<number, number> = new Map(),
): YearInReview {
  const { deltas: playtimeDeltas, partialYear } = playtimeDeltasByApp(
    playtimeRows,
    year,
    baselineByApp,
    (r) => r.playtimeForever,
  );

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

  // Total achievements = count of unlock events whose unlockedAt UTC year === year.
  const achievementsUnlocked = countUnlocksInYear(achievementUnlockRows, year);

  return { year, totalMinutes, topGames, achievementsUnlocked, partialYear };
}
