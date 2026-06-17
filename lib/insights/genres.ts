/**
 * Genre/tag breakdown aggregation for the Insights panel (issue #35).
 *
 * Pure module — no I/O, no server imports. Accepts a list of games with their
 * labels (genres, tags) and playtime, and returns a breakdown sorted by total
 * minutes per label.
 *
 * Important: a game with N labels contributes its full playtime to EACH label,
 * so slice percentages can sum to more than 100 % — this is expected and correct
 * for genre breakdowns (a game that is both "RPG" and "Strategy" counts in full
 * for both slices). totalMinutes counts each game's minutes ONCE.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One game's label set and current cumulative playtime. */
export interface BreakdownItem {
  labels: string[]; // genres or tags; may be empty
  minutes: number; // playtimeForever for this game
}

/** One label's share of the library. */
export interface BreakdownSlice {
  label: string;
  minutes: number;
  /** Percentage of totalMinutes (0–100). Can exceed 100 when summed across slices. */
  percent: number;
}

/** The full breakdown result. */
export interface Breakdown {
  slices: BreakdownSlice[];
  totalMinutes: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Aggregates playtime by label.
 *
 * - Each game with labels contributes its full `minutes` to every label.
 * - Games with an empty `labels` array fall into the `unknownLabel` bucket.
 * - `totalMinutes` is the sum of each game's minutes counted once.
 * - Slices are sorted by minutes desc; ties broken by label asc.
 * - `percent` = sliceMinutes / totalMinutes × 100 (0 when totalMinutes is 0).
 *
 * @param items        Array of games with label sets and playtime.
 * @param unknownLabel Bucket name for label-less games (default `"Unknown"`).
 */
export function aggregateBreakdown(items: BreakdownItem[], unknownLabel = 'Unknown'): Breakdown {
  const labelMinutes = new Map<string, number>();
  let totalMinutes = 0;

  for (const item of items) {
    totalMinutes += item.minutes;

    const effectiveLabels = item.labels.length > 0 ? item.labels : [unknownLabel];
    for (const label of effectiveLabels) {
      labelMinutes.set(label, (labelMinutes.get(label) ?? 0) + item.minutes);
    }
  }

  const slices: BreakdownSlice[] = Array.from(labelMinutes.entries())
    .sort(([aLabel, aMin], [bLabel, bMin]) => {
      if (bMin !== aMin) return bMin - aMin;
      return aLabel.localeCompare(bLabel);
    })
    .map(([label, minutes]) => ({
      label,
      minutes,
      percent: totalMinutes > 0 ? Math.round((minutes / totalMinutes) * 1000) / 10 : 0,
    }));

  return { slices, totalMinutes };
}
