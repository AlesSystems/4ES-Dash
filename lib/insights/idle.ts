/**
 * Idle-spike detection for the Insights panel (issue #37).
 *
 * Pure module — no I/O, no server imports. Detects consecutive snapshot pairs
 * (per game, sorted by date ascending) where the playtime delta EXCEEDS a
 * configurable threshold. This catches sessions where Steam's playtime counter
 * advanced suspiciously fast — e.g. a game left running idle overnight.
 *
 * Dismissal filtering is handled by the repository layer, not here.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single playtime snapshot row. */
export interface IdleSnapshotRow {
  appId: number;
  date: Date;
  playtimeForever: number; // minutes, monotonic
}

/** One detected idle spike between two consecutive snapshots for a game. */
export interface IdleFlag {
  appId: number;
  fromDate: Date;
  toDate: Date;
  deltaMinutes: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default threshold: 12 hours in a single snapshot-to-snapshot window. */
export const DEFAULT_IDLE_THRESHOLD_MINUTES = 720;

/**
 * How far back the idle-detection scan reads snapshots. Bounds the
 * `PlaytimeSnapshot` query so the `@@index([steamId, date])` is used instead of
 * an unbounded full-table `steamId` scan (perf). 365 days matches the app's
 * one-year snapshot horizon and keeps a full year of flags visible.
 */
export const IDLE_LOOKBACK_DAYS = 365;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detects consecutive snapshot pairs (per game) where the playtime delta
 * EXCEEDS `thresholdMinutes`.
 *
 * - Negative or zero deltas are ignored (monotonic enforcement is the repo's job).
 * - A delta equal to the threshold is NOT flagged — it must EXCEED it.
 * - Result is sorted by deltaMinutes DESC; ties broken by toDate DESC then appId ASC.
 *
 * @param rows              All snapshot rows (any games, any order).
 * @param thresholdMinutes  Minimum delta to flag (exclusive). Default: 720 min.
 */
export function detectIdleSpikes(
  rows: IdleSnapshotRow[],
  thresholdMinutes: number = DEFAULT_IDLE_THRESHOLD_MINUTES,
): IdleFlag[] {
  // Group rows by appId.
  const byApp = new Map<number, IdleSnapshotRow[]>();
  for (const row of rows) {
    const bucket = byApp.get(row.appId);
    if (bucket === undefined) {
      byApp.set(row.appId, [row]);
    } else {
      bucket.push(row);
    }
  }

  const flags: IdleFlag[] = [];

  for (const [appId, appRows] of byApp) {
    // Sort by date ascending.
    appRows.sort((a, b) => a.date.getTime() - b.date.getTime());

    for (let i = 1; i < appRows.length; i++) {
      const prev = appRows[i - 1]!;
      const curr = appRows[i]!;
      const delta = curr.playtimeForever - prev.playtimeForever;

      if (delta > thresholdMinutes) {
        flags.push({
          appId,
          fromDate: prev.date,
          toDate: curr.date,
          deltaMinutes: delta,
        });
      }
    }
  }

  // Sort: deltaMinutes DESC, toDate DESC, appId ASC.
  flags.sort((a, b) => {
    if (b.deltaMinutes !== a.deltaMinutes) return b.deltaMinutes - a.deltaMinutes;
    const timeDiff = b.toDate.getTime() - a.toDate.getTime();
    if (timeDiff !== 0) return timeDiff;
    return a.appId - b.appId;
  });

  return flags;
}
