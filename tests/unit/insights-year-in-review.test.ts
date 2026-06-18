import { describe, it, expect } from 'vitest';
import {
  availableYears,
  computeYearInReview,
  countUnlocksInYear,
  type YearPlaytimeRow,
  type AchievementUnlockRow,
} from '@/lib/insights/year-in-review';

// ---------------------------------------------------------------------------
// Row factories
// ---------------------------------------------------------------------------

function pt(appId: number, utcDateStr: string, playtimeForever: number): YearPlaytimeRow {
  return { appId, date: new Date(utcDateStr), playtimeForever };
}

let _seq = 0;
/** An achievement UNLOCK EVENT row (#91), keyed by real unlockedAt. */
function unlock(appId: number, utcDateStr: string, apiName?: string): AchievementUnlockRow {
  return {
    steamId: '76561190000000000',
    appId,
    apiName: apiName ?? `ach_${appId}_${_seq++}`,
    unlockedAt: new Date(utcDateStr),
  };
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

  it('counts achievement unlock events in the year', () => {
    const names = new Map([[1, 'Portal']]);
    const playtime = [
      pt(1, '2025-05-01T00:00:00.000Z', 60),
      pt(1, '2025-05-10T00:00:00.000Z', 120),
    ];
    const unlocks = [
      unlock(1, '2025-05-01T00:00:00.000Z'),
      unlock(1, '2025-05-03T00:00:00.000Z'),
      unlock(1, '2025-05-10T00:00:00.000Z'),
    ];
    const result = computeYearInReview(2025, playtime, unlocks, names);
    expect(result.achievementsUnlocked).toBe(3);
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

  it('counts unlock events across multiple games', () => {
    const unlocks = [
      unlock(1, '2025-01-01T00:00:00.000Z'),
      unlock(1, '2025-12-01T00:00:00.000Z'),
      unlock(2, '2025-03-01T00:00:00.000Z'),
      unlock(2, '2025-09-01T00:00:00.000Z'),
      unlock(2, '2025-09-02T00:00:00.000Z'),
    ];
    const result = computeYearInReview(2025, [], unlocks, new Map());
    expect(result.achievementsUnlocked).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// countUnlocksInYear — #91 achievement-unlock counting by real unlockedAt
// ---------------------------------------------------------------------------

describe('countUnlocksInYear (#91)', () => {
  it('counts unlocks whose unlockedAt UTC year matches (history-independent)', () => {
    // A single day of data, no snapshot history at all — the old delta logic
    // returned 0 here; counting events returns the real number.
    const rows = [
      unlock(1, '2025-04-01T12:00:00.000Z'),
      unlock(1, '2025-04-01T12:05:00.000Z'),
      unlock(2, '2025-04-01T12:10:00.000Z'),
    ];
    expect(countUnlocksInYear(rows, 2025)).toBe(3);
  });

  it('history-independent via computeYearInReview: one playtime day, unlocks > 0', () => {
    const playtime = [pt(1, '2025-07-01T00:00:00.000Z', 500)]; // single snapshot
    const unlocks = [unlock(1, '2025-07-01T00:00:00.000Z'), unlock(1, '2025-07-01T01:00:00.000Z')];
    const result = computeYearInReview(2025, playtime, unlocks, new Map([[1, 'Game']]));
    expect(result.totalMinutes).toBe(0); // single snapshot → no playtime delta
    expect(result.achievementsUnlocked).toBe(2); // but unlocks still count
  });

  it('respects UTC year boundaries in both directions', () => {
    const rows = [
      unlock(1, '2025-12-31T23:59:59.000Z'), // 2025
      unlock(1, '2026-01-01T00:00:00.000Z'), // 2026
    ];
    expect(countUnlocksInYear(rows, 2025)).toBe(1);
    expect(countUnlocksInYear(rows, 2026)).toBe(1);
  });

  it('seconds→ms: a unix-seconds unlocktime lands in the correct year', () => {
    // 1735689599 s = 2024-12-31T23:59:59Z ; 1735689600 s = 2025-01-01T00:00:00Z
    const beforeNewYear: AchievementUnlockRow = {
      steamId: '76561190000000000',
      appId: 1,
      apiName: 'a',
      unlockedAt: new Date(1735689599 * 1000),
    };
    const afterNewYear: AchievementUnlockRow = {
      steamId: '76561190000000000',
      appId: 1,
      apiName: 'b',
      unlockedAt: new Date(1735689600 * 1000),
    };
    expect(countUnlocksInYear([beforeNewYear], 2024)).toBe(1);
    expect(countUnlocksInYear([beforeNewYear], 2025)).toBe(0);
    expect(countUnlocksInYear([afterNewYear], 2025)).toBe(1);
  });

  it('counts an unlock in a game outside the top-played set', () => {
    // The count never filters by which games are "top" — a high appId with no
    // playtime delta still contributes its unlocks.
    const rows = [unlock(999999, '2025-02-02T00:00:00.000Z')];
    const result = computeYearInReview(2025, [], rows, new Map());
    expect(result.achievementsUnlocked).toBe(1);
  });

  it('excludes an epoch (unlocktime 0 → 1970) row defensively', () => {
    const rows: AchievementUnlockRow[] = [
      { steamId: '76561190000000000', appId: 1, apiName: 'x', unlockedAt: new Date(0) },
      unlock(1, '1970-06-01T00:00:00.000Z'),
    ];
    expect(countUnlocksInYear(rows, 1970)).toBe(0);
  });

  it('cross-check: sum over years equals total real unlock rows', () => {
    const rows = [
      unlock(1, '2023-05-01T00:00:00.000Z'),
      unlock(1, '2024-05-01T00:00:00.000Z'),
      unlock(2, '2024-08-01T00:00:00.000Z'),
      unlock(3, '2025-01-02T00:00:00.000Z'),
    ];
    const total = [2023, 2024, 2025].reduce((sum, y) => sum + countUnlocksInYear(rows, y), 0);
    expect(total).toBe(rows.length);
  });
});
