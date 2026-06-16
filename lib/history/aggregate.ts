/**
 * Pure aggregation of playtime snapshot rows into weekly or monthly buckets.
 * No I/O — safe to import in any environment (lib/ is client-bundle-safe).
 *
 * Playtime is cumulative (monotonic): to find minutes PLAYED in a period for
 * one game, compute MAX(playtimeForever) − MIN(playtimeForever) within that
 * period, then sum those deltas across all games for a library-wide total.
 *
 * The output is zero-filled: every period from the first to the last that
 * appears in the data is present, even if no play occurred (0 minutes), so
 * charts render zero bars rather than gaps.
 *
 * All date arithmetic uses UTC to match the snapshot schema.
 */

export type Bucket = 'week' | 'month';

export interface PlaytimePoint {
  period: string;
  minutes: number;
}

// ---------------------------------------------------------------------------
// ISO-8601 week helper (Thursday rule — no external dependency).
// ---------------------------------------------------------------------------

/**
 * Returns the ISO 8601 week year and week number for a UTC date.
 *
 * ISO rule: week 1 is the week containing the year's first Thursday.
 * Equivalently, Jan 4 is always in week 1.
 *
 * Algorithm:
 * 1. Find the Thursday of the current ISO week (shift from Mon-based weekday).
 * 2. That Thursday's Gregorian year is the ISO year.
 * 3. Find the Monday of week 1 (the Monday on or before Jan 4 of that ISO year).
 * 4. Week number = 1 + days_since_week1_monday / 7.
 *
 * All arithmetic is in UTC — we never touch local time.
 */
function isoWeek(date: Date): { year: number; week: number } {
  // Clone to UTC midnight to avoid mutating the caller's Date.
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

  // ISO weekday: Mon=0, Tue=1, …, Sun=6  (shift getUTCDay's Sun=0 baseline)
  const dow = (d.getUTCDay() + 6) % 7;

  // Advance (or retreat) to the Thursday of this ISO week (Thu = dow index 3).
  d.setUTCDate(d.getUTCDate() + (3 - dow));

  // The Thursday's Gregorian year is the ISO year.
  const isoYear = d.getUTCFullYear();

  // Jan 4 is always in ISO week 1; find its ISO weekday, then back up to Monday.
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4Dow = (jan4.getUTCDay() + 6) % 7;
  const week1Monday = new Date(jan4.getTime() - jan4Dow * 24 * 60 * 60 * 1000);

  // Week number = 1 + whole weeks elapsed since week 1's Monday.
  const weekNum = 1 + Math.round((d.getTime() - week1Monday.getTime()) / (7 * 24 * 60 * 60 * 1000));

  return { year: isoYear, week: weekNum };
}

/**
 * Formats a date as the period key string.
 * Month  → "YYYY-MM"
 * Week   → "YYYY-Www" (e.g. "2026-W03")
 */
function periodKey(date: Date, bucket: Bucket): string {
  if (bucket === 'month') {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }
  const { year, week } = isoWeek(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Period sequence generators (for zero-fill)
// ---------------------------------------------------------------------------

/** Returns the next month period key after a given "YYYY-MM" string. */
function nextMonthKey(key: string): string {
  const [y, m] = key.split('-').map(Number) as [number, number];
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

/** Returns the next ISO week period key after a given "YYYY-Www" string. */
function nextWeekKey(key: string): string {
  // Parse "YYYY-Www"
  const year = Number(key.slice(0, 4));
  const week = Number(key.slice(6));

  // Total ISO weeks in this year (52 or 53)
  const weeksInYear = isoWeeksInYear(year);
  if (week < weeksInYear) {
    return `${year}-W${String(week + 1).padStart(2, '0')}`;
  }
  // Roll over to week 1 of next year
  return `${year + 1}-W01`;
}

/**
 * Returns the number of ISO weeks in a given year (52 or 53).
 * A year has 53 weeks if Jan 1 or Dec 31 is a Thursday (accounting for leap years).
 */
function isoWeeksInYear(year: number): number {
  // Jan 1 of this year
  const jan1 = new Date(Date.UTC(year, 0, 1)).getUTCDay();
  // Dec 31 of this year
  const dec31 = new Date(Date.UTC(year, 11, 31)).getUTCDay();
  // 53 weeks if Jan 1 is Thu (4) or Dec 31 is Thu (4)
  return jan1 === 4 || dec31 === 4 ? 53 : 52;
}

/** Advances a period key by one step. */
function nextPeriodKey(key: string, bucket: Bucket): string {
  return bucket === 'month' ? nextMonthKey(key) : nextWeekKey(key);
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Aggregates raw snapshot rows into a continuous, zero-filled series of
 * playtime-played totals per week or per month.
 *
 * @param rows  Snapshot rows sorted by date ascending (any order works but
 *              ascending is what `getPlaytimeSnapshots` guarantees).
 * @param bucket Whether to group by ISO week or calendar month.
 * @returns     Array of { period, minutes } sorted by period ascending, with
 *              every period in the range present (zero-filled).
 */
export function aggregatePlaytime(
  rows: { appId: number; date: Date; playtimeForever: number }[],
  bucket: Bucket,
): PlaytimePoint[] {
  if (rows.length === 0) return [];

  // Step 1: For each (game, period), track min and max playtimeForever.
  // We use a nested Map: periodKey → appId → { min, max }.
  const periodGame = new Map<string, Map<number, { min: number; max: number }>>();

  for (const row of rows) {
    const key = periodKey(row.date, bucket);
    if (!periodGame.has(key)) periodGame.set(key, new Map());
    const gameMap = periodGame.get(key)!;

    const existing = gameMap.get(row.appId);
    if (existing === undefined) {
      gameMap.set(row.appId, { min: row.playtimeForever, max: row.playtimeForever });
    } else {
      existing.min = Math.min(existing.min, row.playtimeForever);
      existing.max = Math.max(existing.max, row.playtimeForever);
    }
  }

  // Step 2: Compute library-wide delta per period.
  // delta per game = max − min (minutes played within that period for that game)
  const periodTotals = new Map<string, number>();
  for (const [key, gameMap] of periodGame) {
    let total = 0;
    for (const { min, max } of gameMap.values()) {
      total += max - min;
    }
    periodTotals.set(key, total);
  }

  // Step 3: Determine the full continuous range of periods from first to last.
  // Sort found period keys lexicographically (ISO strings sort correctly by design).
  const foundKeys = Array.from(periodGame.keys()).sort();
  const firstKey = foundKeys[0]!;
  const lastKey = foundKeys[foundKeys.length - 1]!;

  // Step 4: Generate the zero-filled output.
  const result: PlaytimePoint[] = [];
  let current = firstKey;
  while (current <= lastKey) {
    result.push({
      period: current,
      minutes: periodTotals.get(current) ?? 0,
    });
    current = nextPeriodKey(current, bucket);
  }

  return result;
}
