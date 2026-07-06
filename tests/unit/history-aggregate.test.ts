import { describe, it, expect } from 'vitest';
import { aggregatePlaytime } from '@/lib/history/aggregate';

// ---------------------------------------------------------------------------
// Helpers to create snapshot rows with UTC dates.
// ---------------------------------------------------------------------------

function row(appId: number, utcDateStr: string, playtimeForever: number) {
  return {
    appId,
    date: new Date(utcDateStr),
    playtimeForever,
  };
}

// ---------------------------------------------------------------------------
// Empty input
// ---------------------------------------------------------------------------

describe('aggregatePlaytime — empty input', () => {
  it('returns [] for an empty row array (week)', () => {
    expect(aggregatePlaytime([], 'week')).toEqual([]);
  });

  it('returns [] for an empty row array (month)', () => {
    expect(aggregatePlaytime([], 'month')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Monthly aggregation
// ---------------------------------------------------------------------------

describe('aggregatePlaytime — monthly bucket', () => {
  it('computes delta = max − min for a single game in one month', () => {
    const rows = [
      row(1, '2026-01-05T00:00:00.000Z', 100),
      row(1, '2026-01-10T00:00:00.000Z', 150),
      row(1, '2026-01-20T00:00:00.000Z', 200),
    ];
    const result = aggregatePlaytime(rows, 'month');
    // bug-1: a single-month span now falls back to day-granularity so the chart
    // is drawable. The total played (max 200 − min 100 = 100) is preserved.
    expect(result.reduce((sum, p) => sum + p.minutes, 0)).toBe(100);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('sums deltas across multiple games in the same month', () => {
    const rows = [
      row(1, '2026-03-01T00:00:00.000Z', 500),
      row(1, '2026-03-15T00:00:00.000Z', 600), // game 1 delta = 100
      row(2, '2026-03-05T00:00:00.000Z', 200),
      row(2, '2026-03-20T00:00:00.000Z', 350), // game 2 delta = 150
    ];
    const result = aggregatePlaytime(rows, 'month');
    // bug-1: single-month span → day-fallback; summed total (100 + 150) preserved.
    expect(result.reduce((sum, p) => sum + p.minutes, 0)).toBe(250);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('produces separate period entries for different months', () => {
    const rows = [
      row(1, '2026-01-10T00:00:00.000Z', 100),
      row(1, '2026-01-20T00:00:00.000Z', 180), // Jan delta = 80
      row(1, '2026-02-05T00:00:00.000Z', 210),
      row(1, '2026-02-25T00:00:00.000Z', 270), // Feb delta = 60
    ];
    const result = aggregatePlaytime(rows, 'month');
    expect(result).toEqual([
      { period: '2026-01', minutes: 80 },
      { period: '2026-02', minutes: 60 },
    ]);
  });

  it('zero-fills missing months between first and last period', () => {
    // Jan has data, Feb is empty, Mar has data.
    const rows = [
      row(1, '2026-01-10T00:00:00.000Z', 100),
      row(1, '2026-01-20T00:00:00.000Z', 150), // Jan delta = 50
      row(1, '2026-03-10T00:00:00.000Z', 200),
      row(1, '2026-03-20T00:00:00.000Z', 280), // Mar delta = 80
    ];
    const result = aggregatePlaytime(rows, 'month');
    expect(result).toEqual([
      { period: '2026-01', minutes: 50 },
      { period: '2026-02', minutes: 0 }, // zero-filled gap
      { period: '2026-03', minutes: 80 },
    ]);
  });

  it('handles year boundary in zero-fill (Dec → Jan)', () => {
    const rows = [
      row(1, '2025-12-15T00:00:00.000Z', 100),
      row(1, '2025-12-20T00:00:00.000Z', 150), // Dec 2025 delta = 50
      row(1, '2026-02-05T00:00:00.000Z', 200),
      row(1, '2026-02-15T00:00:00.000Z', 230), // Feb 2026 delta = 30
    ];
    const result = aggregatePlaytime(rows, 'month');
    expect(result).toEqual([
      { period: '2025-12', minutes: 50 },
      { period: '2026-01', minutes: 0 }, // zero-filled
      { period: '2026-02', minutes: 30 },
    ]);
  });

  it('falls back to per-day points when all rows are in the same month (short-span)', () => {
    // bug-1: a single-month span must still yield a drawable (≥2 point) series
    // rather than collapsing to one discarded bucket. Day-granularity fallback.
    const rows = [row(1, '2026-05-01T00:00:00.000Z', 0), row(1, '2026-05-31T00:00:00.000Z', 300)];
    const result = aggregatePlaytime(rows, 'month');
    expect(result.length).toBeGreaterThanOrEqual(2);
    // Total minutes played across the span is preserved (0 → 300 = 300).
    expect(result.reduce((sum, p) => sum + p.minutes, 0)).toBe(300);
    // Day-granularity keys look like YYYY-MM-DD.
    expect(result[0]?.period).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ---------------------------------------------------------------------------
// Weekly aggregation (ISO 8601)
// ---------------------------------------------------------------------------

describe('aggregatePlaytime — weekly bucket', () => {
  it('falls back to per-day points when 3 daily rows fall in one ISO week (short-span)', () => {
    // bug-1: 3 daily snapshots inside ONE ISO week must produce a drawable
    // multi-point series, not a single week bucket that the page discards.
    // 2026-01-05 is Monday of 2026-W02
    const rows = [
      row(1, '2026-01-05T00:00:00.000Z', 100),
      row(1, '2026-01-06T00:00:00.000Z', 160),
      row(1, '2026-01-07T00:00:00.000Z', 250),
    ];
    const result = aggregatePlaytime(rows, 'week');
    expect(result.length).toBeGreaterThanOrEqual(2);
    // Total played across the span preserved: 250 − 100 = 150.
    expect(result.reduce((sum, p) => sum + p.minutes, 0)).toBe(150);
    expect(result[0]?.period).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('uses ISO week numbering — Jan 1 2026 is in 2026-W01', () => {
    // 2026-01-01 is a Thursday → week 1 of 2026
    const rows = [row(1, '2026-01-01T00:00:00.000Z', 0), row(1, '2026-01-01T00:00:00.000Z', 60)];
    const result = aggregatePlaytime(rows, 'week');
    expect(result[0]?.period).toBe('2026-W01');
  });

  it('separates rows in different ISO weeks', () => {
    // 2026-W02: Jan 5–11; 2026-W03: Jan 12–18
    const rows = [
      row(1, '2026-01-05T00:00:00.000Z', 100),
      row(1, '2026-01-11T00:00:00.000Z', 180), // W02 delta = 80
      row(1, '2026-01-12T00:00:00.000Z', 200),
      row(1, '2026-01-18T00:00:00.000Z', 260), // W03 delta = 60
    ];
    const result = aggregatePlaytime(rows, 'week');
    expect(result).toEqual([
      { period: '2026-W02', minutes: 80 },
      { period: '2026-W03', minutes: 60 },
    ]);
  });

  it('zero-fills empty weeks between first and last week', () => {
    // W02 has data, W03 is empty, W04 has data.
    const rows = [
      row(1, '2026-01-05T00:00:00.000Z', 100),
      row(1, '2026-01-07T00:00:00.000Z', 150), // W02 delta = 50
      row(1, '2026-01-19T00:00:00.000Z', 200),
      row(1, '2026-01-21T00:00:00.000Z', 240), // W04 delta = 40
    ];
    const result = aggregatePlaytime(rows, 'week');
    expect(result).toEqual([
      { period: '2026-W02', minutes: 50 },
      { period: '2026-W03', minutes: 0 }, // zero-filled gap
      { period: '2026-W04', minutes: 40 },
    ]);
  });

  it('handles year boundary: Dec 29 2025 is in 2026-W01 (ISO)', () => {
    // 2025-12-29 is a Monday. The week containing Jan 1 2026 (Thursday) is W01.
    // In ISO 8601, 2025-12-29 through 2026-01-04 is 2026-W01.
    const rows = [row(1, '2025-12-29T00:00:00.000Z', 50), row(1, '2026-01-04T00:00:00.000Z', 100)];
    const result = aggregatePlaytime(rows, 'week');
    // bug-1: both dates sit in ONE ISO week (2026-W01) → day-fallback. The
    // series starts at the first snapshot day and preserves the total (100−50).
    expect(result[0]?.period).toBe('2025-12-29');
    expect(result.reduce((sum, p) => sum + p.minutes, 0)).toBe(50);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Multi-game summation
// ---------------------------------------------------------------------------

describe('aggregatePlaytime — multi-game library', () => {
  it('sums deltas from three games in the same period', () => {
    const rows = [
      row(10, '2026-04-01T00:00:00.000Z', 0),
      row(10, '2026-04-28T00:00:00.000Z', 120), // game 10 delta = 120
      row(20, '2026-04-05T00:00:00.000Z', 300),
      row(20, '2026-04-20T00:00:00.000Z', 480), // game 20 delta = 180
      row(30, '2026-04-10T00:00:00.000Z', 60),
      row(30, '2026-04-25T00:00:00.000Z', 90), // game 30 delta = 30
    ];
    // Total: 120 + 180 + 30 = 330
    const result = aggregatePlaytime(rows, 'month');
    // bug-1: single-month span → day-fallback; summed total across games preserved.
    expect(result.reduce((sum, p) => sum + p.minutes, 0)).toBe(330);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('correctly attributes deltas when games span multiple months', () => {
    const rows = [
      row(1, '2026-01-10T00:00:00.000Z', 100),
      row(1, '2026-01-20T00:00:00.000Z', 200), // game 1, Jan delta = 100
      row(2, '2026-01-05T00:00:00.000Z', 50),
      row(2, '2026-01-25T00:00:00.000Z', 80), // game 2, Jan delta = 30
      row(1, '2026-02-05T00:00:00.000Z', 220),
      row(1, '2026-02-15T00:00:00.000Z', 260), // game 1, Feb delta = 40
      row(2, '2026-02-10T00:00:00.000Z', 80),
      row(2, '2026-02-20T00:00:00.000Z', 150), // game 2, Feb delta = 70
    ];
    const result = aggregatePlaytime(rows, 'month');
    expect(result).toEqual([
      { period: '2026-01', minutes: 130 }, // 100 + 30
      { period: '2026-02', minutes: 110 }, // 40 + 70
    ]);
  });
});

// ---------------------------------------------------------------------------
// Output ordering
// ---------------------------------------------------------------------------

describe('aggregatePlaytime — output ordering', () => {
  it('sorts periods ascending even if rows are not in order', () => {
    // Deliberately give rows out of order.
    const rows = [
      row(1, '2026-03-10T00:00:00.000Z', 200),
      row(1, '2026-01-10T00:00:00.000Z', 100),
      row(1, '2026-01-20T00:00:00.000Z', 150),
      row(1, '2026-03-20T00:00:00.000Z', 260),
    ];
    const result = aggregatePlaytime(rows, 'month');
    // Expect Jan, Feb (zero), Mar
    expect(result.map((p) => p.period)).toEqual(['2026-01', '2026-02', '2026-03']);
  });
});

// ---------------------------------------------------------------------------
// Zero-fill across an ISO W53 year boundary (2020 is a 53-week ISO year)
// ---------------------------------------------------------------------------

describe('aggregatePlaytime — zero-fill across a W53 boundary', () => {
  it('fills the empty 2020-W53 week between 2020-W52 and 2021-W01', () => {
    const rows = [
      // 2020-W52 (Mon 2020-12-21 .. Sun 2020-12-27): two snapshots → delta 60
      row(1, '2020-12-21T00:00:00.000Z', 100),
      row(1, '2020-12-24T00:00:00.000Z', 160),
      // gap: 2020-W53 (Mon 2020-12-28 .. Sun 2021-01-03) has no snapshots
      // 2021-W01 (Mon 2021-01-04 ..): two snapshots → delta 60
      row(1, '2021-01-04T00:00:00.000Z', 200),
      row(1, '2021-01-07T00:00:00.000Z', 260),
    ];
    const result = aggregatePlaytime(rows, 'week');
    expect(result.map((p) => p.period)).toEqual(['2020-W52', '2020-W53', '2021-W01']);
    expect(result.map((p) => p.minutes)).toEqual([60, 0, 60]);
  });
});
