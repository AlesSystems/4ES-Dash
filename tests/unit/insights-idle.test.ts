import { describe, it, expect } from 'vitest';
import {
  detectIdleSpikes,
  DEFAULT_IDLE_THRESHOLD_MINUTES,
  type IdleSnapshotRow,
} from '@/lib/insights/idle';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function snap(appId: number, utcDateStr: string, playtimeForever: number): IdleSnapshotRow {
  return { appId, date: new Date(utcDateStr), playtimeForever };
}

// ---------------------------------------------------------------------------
// Empty input
// ---------------------------------------------------------------------------

describe('detectIdleSpikes — empty input', () => {
  it('returns [] for empty rows', () => {
    expect(detectIdleSpikes([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Single snapshot per game — no pair to compare
// ---------------------------------------------------------------------------

describe('detectIdleSpikes — single snapshot', () => {
  it('returns no flags when there is only one snapshot for a game', () => {
    const result = detectIdleSpikes([snap(1, '2025-06-01T00:00:00.000Z', 1000)]);
    expect(result).toEqual([]);
  });

  it('returns no flags for multiple single-snapshot games', () => {
    const result = detectIdleSpikes([
      snap(1, '2025-06-01T00:00:00.000Z', 800),
      snap(2, '2025-06-02T00:00:00.000Z', 1200),
    ]);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Threshold boundary — exactly at threshold is NOT flagged
// ---------------------------------------------------------------------------

describe('detectIdleSpikes — threshold boundary', () => {
  it('does NOT flag a delta equal to the default threshold (720 min)', () => {
    const result = detectIdleSpikes([
      snap(1, '2025-01-01T00:00:00.000Z', 0),
      snap(1, '2025-01-02T00:00:00.000Z', DEFAULT_IDLE_THRESHOLD_MINUTES),
    ]);
    expect(result).toEqual([]);
  });

  it('flags a delta of threshold + 1', () => {
    const result = detectIdleSpikes([
      snap(1, '2025-01-01T00:00:00.000Z', 0),
      snap(1, '2025-01-02T00:00:00.000Z', DEFAULT_IDLE_THRESHOLD_MINUTES + 1),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.deltaMinutes).toBe(DEFAULT_IDLE_THRESHOLD_MINUTES + 1);
  });

  it('does NOT flag a delta equal to a custom threshold', () => {
    const result = detectIdleSpikes(
      [snap(1, '2025-01-01T00:00:00.000Z', 0), snap(1, '2025-01-02T00:00:00.000Z', 60)],
      60,
    );
    expect(result).toEqual([]);
  });

  it('flags a delta exceeding a custom threshold', () => {
    const result = detectIdleSpikes(
      [snap(1, '2025-01-01T00:00:00.000Z', 0), snap(1, '2025-01-02T00:00:00.000Z', 61)],
      60,
    );
    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Single game — happy path
// ---------------------------------------------------------------------------

describe('detectIdleSpikes — single game happy path', () => {
  it('flags a spike between two consecutive snapshots', () => {
    const from = new Date('2025-03-10T00:00:00.000Z');
    const to = new Date('2025-03-11T00:00:00.000Z');
    const result = detectIdleSpikes([
      { appId: 1, date: from, playtimeForever: 100 },
      { appId: 1, date: to, playtimeForever: 1000 },
    ]);
    expect(result).toEqual([{ appId: 1, fromDate: from, toDate: to, deltaMinutes: 900 }]);
  });

  it('only flags pairs that exceed threshold; normal pairs are ignored', () => {
    const result = detectIdleSpikes([
      snap(1, '2025-01-01T00:00:00.000Z', 0),
      snap(1, '2025-01-02T00:00:00.000Z', 60), // delta 60 — normal
      snap(1, '2025-01-03T00:00:00.000Z', 900), // delta 840 — spike!
      snap(1, '2025-01-04T00:00:00.000Z', 960), // delta 60 — normal
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.deltaMinutes).toBe(840);
  });

  it('ignores negative deltas (monotonic correction)', () => {
    const result = detectIdleSpikes([
      snap(1, '2025-02-01T00:00:00.000Z', 1000),
      snap(1, '2025-02-02T00:00:00.000Z', 800), // delta -200 — ignored
    ]);
    expect(result).toEqual([]);
  });

  it('ignores zero deltas', () => {
    const result = detectIdleSpikes([
      snap(1, '2025-04-01T00:00:00.000Z', 500),
      snap(1, '2025-04-02T00:00:00.000Z', 500), // delta 0 — ignored
    ]);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Multi-game
// ---------------------------------------------------------------------------

describe('detectIdleSpikes — multi-game', () => {
  it('detects spikes in different games independently', () => {
    const result = detectIdleSpikes([
      snap(1, '2025-05-01T00:00:00.000Z', 0),
      snap(1, '2025-05-02T00:00:00.000Z', 800), // spike: 800
      snap(2, '2025-05-03T00:00:00.000Z', 0),
      snap(2, '2025-05-04T00:00:00.000Z', 900), // spike: 900
    ]);
    expect(result).toHaveLength(2);
    // Sorted by deltaMinutes DESC: game 2 first (900), then game 1 (800)
    expect(result[0]?.appId).toBe(2);
    expect(result[1]?.appId).toBe(1);
  });

  it('does not cross-contaminate snapshots across games', () => {
    // Game 1 has small delta; game 2 would look like a spike only if mixed.
    const result = detectIdleSpikes([
      snap(1, '2025-06-01T00:00:00.000Z', 0),
      snap(2, '2025-06-02T00:00:00.000Z', 2000), // different game — should NOT pair with game 1
      snap(1, '2025-06-03T00:00:00.000Z', 60), // game 1 delta: 60 — normal
    ]);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Sort order
// ---------------------------------------------------------------------------

describe('detectIdleSpikes — sort order', () => {
  it('sorts by deltaMinutes DESC, then toDate DESC, then appId ASC', () => {
    const date1 = new Date('2025-07-01T00:00:00.000Z');
    const date2 = new Date('2025-07-02T00:00:00.000Z');
    const date3 = new Date('2025-07-03T00:00:00.000Z');

    // Three spikes: same delta (800), different toDate and appId.
    const rows: IdleSnapshotRow[] = [
      // App 3: earlier toDate
      { appId: 3, date: date1, playtimeForever: 0 },
      { appId: 3, date: date2, playtimeForever: 800 },
      // App 1: later toDate
      { appId: 1, date: date2, playtimeForever: 0 },
      { appId: 1, date: date3, playtimeForever: 800 },
      // App 2: later toDate (same as app 1), lower appId
      { appId: 2, date: date2, playtimeForever: 0 },
      { appId: 2, date: date3, playtimeForever: 800 },
    ];
    const result = detectIdleSpikes(rows, 700);
    // Same delta (800): toDate DESC → app1/app2 (date3) before app3 (date2)
    //   among date3 ties: appId ASC → app 1, app 2, then app 3
    expect(result.map((f) => f.appId)).toEqual([1, 2, 3]);
  });

  it('sorts unordered input rows by date before comparing', () => {
    // Snapshots given in reverse-date order — sort must fix this.
    const result = detectIdleSpikes([
      snap(1, '2025-08-10T00:00:00.000Z', 900), // later snapshot
      snap(1, '2025-08-01T00:00:00.000Z', 50), // earlier snapshot
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.deltaMinutes).toBe(850);
    expect(result[0]?.fromDate).toEqual(new Date('2025-08-01T00:00:00.000Z'));
    expect(result[0]?.toDate).toEqual(new Date('2025-08-10T00:00:00.000Z'));
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_IDLE_THRESHOLD_MINUTES constant
// ---------------------------------------------------------------------------

describe('DEFAULT_IDLE_THRESHOLD_MINUTES constant', () => {
  it('is exported and equals 720', () => {
    expect(DEFAULT_IDLE_THRESHOLD_MINUTES).toBe(720);
  });
});
