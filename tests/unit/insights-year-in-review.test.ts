import { describe, it, expect } from 'vitest';
import {
  availableYears,
  computeYearInReview,
  type YearPlaytimeRow,
  type YearAchievementRow,
} from '@/lib/insights/year-in-review';

// ---------------------------------------------------------------------------
// Row factories
// ---------------------------------------------------------------------------

function pt(appId: number, utcDateStr: string, playtimeForever: number): YearPlaytimeRow {
  return { appId, date: new Date(utcDateStr), playtimeForever };
}

function ach(appId: number, utcDateStr: string, unlockedCount: number): YearAchievementRow {
  return { appId, date: new Date(utcDateStr), unlockedCount };
}

// ---------------------------------------------------------------------------
// availableYears
// ---------------------------------------------------------------------------

describe('availableYears', () => {
  it('returns [] for empty rows', () => {
    expect(availableYears([])).toEqual([]);
  });

  it('returns a single year when all rows share one year', () => {
    expect(
      availableYears([
        { date: new Date('2025-03-01T00:00:00.000Z') },
        { date: new Date('2025-11-01T00:00:00.000Z') },
      ]),
    ).toEqual([2025]);
  });

  it('returns distinct years sorted descending', () => {
    const rows = [
      { date: new Date('2023-06-01T00:00:00.000Z') },
      { date: new Date('2025-01-01T00:00:00.000Z') },
      { date: new Date('2024-12-31T00:00:00.000Z') },
      { date: new Date('2023-01-01T00:00:00.000Z') },
    ];
    expect(availableYears(rows)).toEqual([2025, 2024, 2023]);
  });
});

// ---------------------------------------------------------------------------
// computeYearInReview — empty input
// ---------------------------------------------------------------------------

describe('computeYearInReview — empty input', () => {
  it('returns zeroes for empty rows', () => {
    const result = computeYearInReview(2025, [], [], new Map());
    expect(result).toEqual({
      year: 2025,
      totalMinutes: 0,
      topGames: [],
      achievementsUnlocked: 0,
    });
  });
});

// ---------------------------------------------------------------------------
// computeYearInReview — single game, happy path
// ---------------------------------------------------------------------------

describe('computeYearInReview — single game', () => {
  it('computes delta correctly for one game with multiple snapshots', () => {
    const names = new Map([[1, 'Half-Life 3']]);
    const playtime = [
      pt(1, '2025-01-10T00:00:00.000Z', 100),
      pt(1, '2025-06-15T00:00:00.000Z', 250),
      pt(1, '2025-12-31T00:00:00.000Z', 400),
    ];
    const result = computeYearInReview(2025, playtime, [], names);
    expect(result.totalMinutes).toBe(300); // 400 - 100
    expect(result.topGames).toEqual([{ appId: 1, name: 'Half-Life 3', minutesDelta: 300 }]);
    expect(result.achievementsUnlocked).toBe(0);
  });

  it('uses "App {appId}" fallback when game name is missing', () => {
    const playtime = [
      pt(99, '2025-03-01T00:00:00.000Z', 50),
      pt(99, '2025-03-15T00:00:00.000Z', 150),
    ];
    const result = computeYearInReview(2025, playtime, [], new Map());
    expect(result.topGames[0]?.name).toBe('App 99');
  });

  it('includes achievement delta', () => {
    const names = new Map([[1, 'Portal']]);
    const playtime = [
      pt(1, '2025-05-01T00:00:00.000Z', 60),
      pt(1, '2025-05-10T00:00:00.000Z', 120),
    ];
    const achievements = [
      ach(1, '2025-05-01T00:00:00.000Z', 5),
      ach(1, '2025-05-10T00:00:00.000Z', 12),
    ];
    const result = computeYearInReview(2025, playtime, achievements, names);
    expect(result.achievementsUnlocked).toBe(7); // 12 - 5
  });
});

// ---------------------------------------------------------------------------
// computeYearInReview — year filtering
// ---------------------------------------------------------------------------

describe('computeYearInReview — year filtering', () => {
  it('ignores rows from other years', () => {
    const names = new Map([[1, 'Game']]);
    const playtime = [
      pt(1, '2024-12-31T00:00:00.000Z', 100), // year 2024 — excluded
      pt(1, '2025-01-01T00:00:00.000Z', 200), // year 2025 — included
      pt(1, '2025-12-31T00:00:00.000Z', 350), // year 2025 — included
      pt(1, '2026-01-01T00:00:00.000Z', 400), // year 2026 — excluded
    ];
    const result = computeYearInReview(2025, playtime, [], names);
    // Within 2025: min=200, max=350 → delta=150
    expect(result.totalMinutes).toBe(150);
  });

  it('single snapshot in-year produces delta 0 (no second point to compare)', () => {
    const names = new Map([[1, 'Game']]);
    const playtime = [pt(1, '2025-07-01T00:00:00.000Z', 500)];
    const result = computeYearInReview(2025, playtime, [], names);
    expect(result.totalMinutes).toBe(0);
    expect(result.topGames).toEqual([]); // delta = 0, not > 0
  });
});

// ---------------------------------------------------------------------------
// computeYearInReview — multi-game
// ---------------------------------------------------------------------------

describe('computeYearInReview — multi-game', () => {
  it('sums deltas across multiple games', () => {
    const names = new Map([
      [1, 'Alpha'],
      [2, 'Beta'],
    ]);
    const playtime = [
      pt(1, '2025-01-01T00:00:00.000Z', 0),
      pt(1, '2025-06-01T00:00:00.000Z', 120), // delta 120
      pt(2, '2025-02-01T00:00:00.000Z', 300),
      pt(2, '2025-09-01T00:00:00.000Z', 480), // delta 180
    ];
    const result = computeYearInReview(2025, playtime, [], names);
    expect(result.totalMinutes).toBe(300); // 120 + 180
  });

  it('top-games list contains at most 5 entries', () => {
    const names = new Map(
      Array.from({ length: 7 }, (_, i) => [i + 1, `Game ${i + 1}`] as [number, string]),
    );
    // Give each game a different delta so ordering is deterministic.
    const playtime = Array.from({ length: 7 }, (_, i) => [
      pt(i + 1, '2025-01-01T00:00:00.000Z', 0),
      pt(i + 1, '2025-06-01T00:00:00.000Z', (i + 1) * 100),
    ]).flat();
    const result = computeYearInReview(2025, playtime, [], names);
    expect(result.topGames).toHaveLength(5);
    // First entry should have the highest delta (game 7: 700 min)
    expect(result.topGames[0]?.appId).toBe(7);
  });

  it('top-games excludes games with zero delta', () => {
    const names = new Map([
      [1, 'Active'],
      [2, 'Idle'],
    ]);
    const playtime = [
      pt(1, '2025-03-01T00:00:00.000Z', 0),
      pt(1, '2025-03-15T00:00:00.000Z', 60), // delta 60
      pt(2, '2025-04-01T00:00:00.000Z', 200), // single snapshot → delta 0
    ];
    const result = computeYearInReview(2025, playtime, [], names);
    expect(result.topGames.map((g) => g.appId)).toEqual([1]);
  });

  it('produces delta 0 when all in-year snapshots have identical playtime', () => {
    // If Steam corrections bring playtime back to the same value across all in-year
    // snapshots, max − min = 0 and the game contributes nothing to the total.
    const names = new Map([[1, 'Game']]);
    const playtime = [
      pt(1, '2025-01-01T00:00:00.000Z', 500),
      pt(1, '2025-06-01T00:00:00.000Z', 500), // same value — delta = 0
    ];
    const result = computeYearInReview(2025, playtime, [], names);
    expect(result.totalMinutes).toBe(0);
    expect(result.topGames).toEqual([]);
  });

  it('sums achievement deltas across multiple games', () => {
    const achievements = [
      ach(1, '2025-01-01T00:00:00.000Z', 0),
      ach(1, '2025-12-01T00:00:00.000Z', 10), // +10
      ach(2, '2025-03-01T00:00:00.000Z', 5),
      ach(2, '2025-09-01T00:00:00.000Z', 18), // +13
    ];
    const result = computeYearInReview(2025, [], achievements, new Map());
    expect(result.achievementsUnlocked).toBe(23); // 10 + 13
  });
});
