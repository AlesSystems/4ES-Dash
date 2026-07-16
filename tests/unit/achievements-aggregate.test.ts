/**
 * Tests for lib/achievements/aggregate.ts — pure functions, no I/O, no MSW needed.
 *
 * Covers:
 *  - mergeGameAchievements: join, sorting, icon selection, percent calculation
 *  - aggregateLibrary: sums, percent, recentUnlocks filtering & sorting
 */

import { describe, expect, it } from 'vitest';
import {
  mergeGameAchievements,
  aggregateLibrary,
  type GameAchievements,
  type MergedAchievement,
} from '@/lib/achievements/aggregate';
import type { PlayerAchievement, AchievementSchema } from '@/lib/steam/achievements';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SCHEMA: AchievementSchema[] = [
  {
    apiName: 'WIN_1_MATCH',
    displayName: 'Win One Match',
    description: 'Win your first competitive match.',
    iconUrl: 'https://example.com/win1.jpg',
    iconGrayUrl: 'https://example.com/win1_gray.jpg',
  },
  {
    apiName: 'WIN_10_MATCHES',
    displayName: 'Win Ten Matches',
    description: 'Win 10 competitive matches.',
    iconUrl: 'https://example.com/win10.jpg',
    iconGrayUrl: 'https://example.com/win10_gray.jpg',
  },
  {
    apiName: 'FIRST_KILL',
    displayName: 'First Blood',
    description: 'Get your first kill.',
    iconUrl: 'https://example.com/firstkill.jpg',
    iconGrayUrl: 'https://example.com/firstkill_gray.jpg',
  },
];

const PLAYER: PlayerAchievement[] = [
  { apiName: 'WIN_1_MATCH', unlocked: true, unlockedAt: '2023-11-14T22:13:20.000Z' },
  { apiName: 'WIN_10_MATCHES', unlocked: false, unlockedAt: null },
  { apiName: 'FIRST_KILL', unlocked: true, unlockedAt: '2023-11-13T17:46:40.000Z' },
];

const GLOBAL = new Map<string, number>([
  ['WIN_1_MATCH', 72.5],
  ['WIN_10_MATCHES', 48.3],
  ['FIRST_KILL', 95.1],
]);

// ---------------------------------------------------------------------------
// mergeGameAchievements
// ---------------------------------------------------------------------------

describe('mergeGameAchievements – basic merge', () => {
  it('produces one item per achievement with correct unlocked/unlockedAt', () => {
    const result = mergeGameAchievements(PLAYER, SCHEMA, GLOBAL);

    expect(result.total).toBe(3);
    expect(result.unlocked).toBe(2);
    expect(result.percent).toBe(67); // Math.round(2/3*100)

    const win1 = result.items.find((i) => i.apiName === 'WIN_1_MATCH');
    expect(win1).toBeDefined();
    expect(win1!.unlocked).toBe(true);
    expect(win1!.unlockedAt).toBe('2023-11-14T22:13:20.000Z');

    const win10 = result.items.find((i) => i.apiName === 'WIN_10_MATCHES');
    expect(win10).toBeDefined();
    expect(win10!.unlocked).toBe(false);
    expect(win10!.unlockedAt).toBeNull();
  });

  it('uses displayName and description from schema', () => {
    const result = mergeGameAchievements(PLAYER, SCHEMA, GLOBAL);
    const item = result.items.find((i) => i.apiName === 'WIN_1_MATCH')!;
    expect(item.displayName).toBe('Win One Match');
    expect(item.description).toBe('Win your first competitive match.');
  });

  it('attaches globalPercent from global map', () => {
    const result = mergeGameAchievements(PLAYER, SCHEMA, GLOBAL);
    const item = result.items.find((i) => i.apiName === 'FIRST_KILL')!;
    expect(item.globalPercent).toBe(95.1);
  });

  it('sets globalPercent to null for achievements missing from global map', () => {
    const partialGlobal = new Map<string, number>([['WIN_1_MATCH', 72.5]]);
    const result = mergeGameAchievements(PLAYER, SCHEMA, partialGlobal);
    const win10 = result.items.find((i) => i.apiName === 'WIN_10_MATCHES')!;
    expect(win10.globalPercent).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// mergeGameAchievements — icon selection
// ---------------------------------------------------------------------------

describe('mergeGameAchievements – icon selection', () => {
  it('uses iconUrl (colour) for unlocked achievements', () => {
    const result = mergeGameAchievements(PLAYER, SCHEMA, GLOBAL);
    const win1 = result.items.find((i) => i.apiName === 'WIN_1_MATCH')!;
    expect(win1.iconUrl).toBe('https://example.com/win1.jpg');
  });

  it('uses iconGrayUrl for locked achievements', () => {
    const result = mergeGameAchievements(PLAYER, SCHEMA, GLOBAL);
    const win10 = result.items.find((i) => i.apiName === 'WIN_10_MATCHES')!;
    expect(win10.iconUrl).toBe('https://example.com/win10_gray.jpg');
  });
});

// ---------------------------------------------------------------------------
// mergeGameAchievements — sort order
// ---------------------------------------------------------------------------

describe('mergeGameAchievements – sort order', () => {
  it('puts unlocked achievements before locked ones', () => {
    const result = mergeGameAchievements(PLAYER, SCHEMA, GLOBAL);
    const unlockedEnd = result.items.findIndex((i) => !i.unlocked);
    const lockedStart = result.items.findIndex((i) => !i.unlocked);
    // All items before lockedStart must be unlocked
    for (let i = 0; i < lockedStart; i++) {
      expect(result.items[i]!.unlocked).toBe(true);
    }
    // All items from lockedStart must be locked
    for (let i = lockedStart; i < result.items.length; i++) {
      expect(result.items[i]!.unlocked).toBe(false);
    }
    // Verify unlockedEnd === lockedStart
    expect(unlockedEnd).toBe(lockedStart);
  });

  it('sorts unlocked achievements by globalPercent desc within their group', () => {
    const result = mergeGameAchievements(PLAYER, SCHEMA, GLOBAL);
    const unlocked = result.items.filter((i) => i.unlocked);
    // FIRST_KILL (95.1) should come before WIN_1_MATCH (72.5)
    expect(unlocked[0]!.apiName).toBe('FIRST_KILL');
    expect(unlocked[1]!.apiName).toBe('WIN_1_MATCH');
  });

  it('places null globalPercent last within the same locked/unlocked group', () => {
    const noGlobal = new Map<string, number>();
    const mixedPlayer: PlayerAchievement[] = [
      { apiName: 'WIN_1_MATCH', unlocked: false, unlockedAt: null },
      { apiName: 'WIN_10_MATCHES', unlocked: false, unlockedAt: null },
      { apiName: 'FIRST_KILL', unlocked: false, unlockedAt: null },
    ];
    const partialGlobal = new Map<string, number>([['WIN_1_MATCH', 50]]);
    const result = mergeGameAchievements(mixedPlayer, SCHEMA, partialGlobal);
    const locked = result.items.filter((i) => !i.unlocked);
    // WIN_1_MATCH (50) should be first; others (null) come after
    expect(locked[0]!.apiName).toBe('WIN_1_MATCH');
    // Others should have null globalPercent
    expect(locked[1]!.globalPercent).toBeNull();
    expect(locked[2]!.globalPercent).toBeNull();
    void noGlobal; // unused — just prevent TS unused variable
  });
});

// ---------------------------------------------------------------------------
// mergeGameAchievements — schema fallback
// ---------------------------------------------------------------------------

describe('mergeGameAchievements – schema fallback', () => {
  it('falls back to apiName as displayName when schema is missing for an achievement', () => {
    const playerWithExtra: PlayerAchievement[] = [
      ...PLAYER,
      { apiName: 'MYSTERY_ACH', unlocked: true, unlockedAt: '2023-10-01T00:00:00.000Z' },
    ];
    const result = mergeGameAchievements(playerWithExtra, SCHEMA, GLOBAL);
    const mystery = result.items.find((i) => i.apiName === 'MYSTERY_ACH')!;
    expect(mystery.displayName).toBe('MYSTERY_ACH');
    expect(mystery.description).toBe('');
  });
});

// ---------------------------------------------------------------------------
// mergeGameAchievements — edge cases
// ---------------------------------------------------------------------------

describe('mergeGameAchievements – edge cases', () => {
  it('returns percent 0 when total is 0', () => {
    const result = mergeGameAchievements([], [], new Map());
    expect(result.total).toBe(0);
    expect(result.unlocked).toBe(0);
    expect(result.percent).toBe(0);
    expect(result.items).toEqual([]);
  });

  it('returns percent 0 when all achievements are locked', () => {
    const allLocked: PlayerAchievement[] = PLAYER.map((p) => ({
      ...p,
      unlocked: false,
      unlockedAt: null,
    }));
    const result = mergeGameAchievements(allLocked, SCHEMA, GLOBAL);
    expect(result.unlocked).toBe(0);
    expect(result.percent).toBe(0);
  });

  it('returns percent 100 when all achievements are unlocked', () => {
    const allUnlocked: PlayerAchievement[] = PLAYER.map((p) => ({
      ...p,
      unlocked: true,
      unlockedAt: '2023-01-01T00:00:00.000Z',
    }));
    const result = mergeGameAchievements(allUnlocked, SCHEMA, GLOBAL);
    expect(result.unlocked).toBe(3);
    expect(result.percent).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// aggregateLibrary — basic sums
// ---------------------------------------------------------------------------

describe('aggregateLibrary – sums', () => {
  it('totals unlocked and available across games', () => {
    const game1: GameAchievements = {
      unlocked: 2,
      total: 3,
      percent: 67,
      items: [],
    };
    const game2: GameAchievements = {
      unlocked: 5,
      total: 10,
      percent: 50,
      items: [],
    };
    const summary = aggregateLibrary([game1, game2]);
    expect(summary.totalUnlocked).toBe(7);
    expect(summary.totalAvailable).toBe(13);
    expect(summary.percent).toBe(54); // Math.round(7/13*100)
  });

  it('returns percent 0 when no achievements are available', () => {
    const summary = aggregateLibrary([]);
    expect(summary.totalUnlocked).toBe(0);
    expect(summary.totalAvailable).toBe(0);
    expect(summary.percent).toBe(0);
    expect(summary.recentUnlocks).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// aggregateLibrary — recentUnlocks
// ---------------------------------------------------------------------------

describe('aggregateLibrary – recentUnlocks', () => {
  it('includes achievements unlocked within the last 7 days', () => {
    const now = new Date('2024-01-10T00:00:00.000Z');
    const recentDate = '2024-01-08T12:00:00.000Z'; // 2 days ago
    const oldDate = '2024-01-01T12:00:00.000Z'; // 9 days ago

    const recentItem: MergedAchievement = {
      apiName: 'RECENT_ACH',
      displayName: 'Recent',
      description: '',
      iconUrl: 'https://example.com/r.jpg',
      unlocked: true,
      unlockedAt: recentDate,
      globalPercent: 50,
    };
    const oldItem: MergedAchievement = {
      apiName: 'OLD_ACH',
      displayName: 'Old',
      description: '',
      iconUrl: 'https://example.com/o.jpg',
      unlocked: true,
      unlockedAt: oldDate,
      globalPercent: 30,
    };
    const lockedItem: MergedAchievement = {
      apiName: 'LOCKED_ACH',
      displayName: 'Locked',
      description: '',
      iconUrl: 'https://example.com/l_gray.jpg',
      unlocked: false,
      unlockedAt: null,
      globalPercent: 80,
    };

    const game: GameAchievements = {
      unlocked: 2,
      total: 3,
      percent: 67,
      items: [recentItem, oldItem, lockedItem],
    };

    const summary = aggregateLibrary([game], now);
    expect(summary.recentUnlocks).toHaveLength(1);
    expect(summary.recentUnlocks[0]!.apiName).toBe('RECENT_ACH');
  });

  it('sorts recentUnlocks newest-first', () => {
    const now = new Date('2024-01-10T00:00:00.000Z');

    const item1: MergedAchievement = {
      apiName: 'ACH_1',
      displayName: 'First',
      description: '',
      iconUrl: 'https://example.com/1.jpg',
      unlocked: true,
      unlockedAt: '2024-01-05T00:00:00.000Z',
      globalPercent: null,
    };
    const item2: MergedAchievement = {
      apiName: 'ACH_2',
      displayName: 'Second',
      description: '',
      iconUrl: 'https://example.com/2.jpg',
      unlocked: true,
      unlockedAt: '2024-01-08T00:00:00.000Z',
      globalPercent: null,
    };
    const item3: MergedAchievement = {
      apiName: 'ACH_3',
      displayName: 'Third',
      description: '',
      iconUrl: 'https://example.com/3.jpg',
      unlocked: true,
      unlockedAt: '2024-01-07T00:00:00.000Z',
      globalPercent: null,
    };

    const game: GameAchievements = {
      unlocked: 3,
      total: 3,
      percent: 100,
      items: [item1, item2, item3],
    };

    const summary = aggregateLibrary([game], now);
    expect(summary.recentUnlocks).toHaveLength(3);
    // Newest first: ACH_2 (Jan 8), ACH_3 (Jan 7), ACH_1 (Jan 5)
    expect(summary.recentUnlocks[0]!.apiName).toBe('ACH_2');
    expect(summary.recentUnlocks[1]!.apiName).toBe('ACH_3');
    expect(summary.recentUnlocks[2]!.apiName).toBe('ACH_1');
  });

  it('excludes locked achievements from recentUnlocks', () => {
    const now = new Date('2024-01-10T00:00:00.000Z');
    const lockedItem: MergedAchievement = {
      apiName: 'LOCKED',
      displayName: 'Locked',
      description: '',
      iconUrl: 'https://example.com/l_gray.jpg',
      unlocked: false,
      unlockedAt: null,
      globalPercent: null,
    };

    const game: GameAchievements = {
      unlocked: 0,
      total: 1,
      percent: 0,
      items: [lockedItem],
    };

    const summary = aggregateLibrary([game], now);
    expect(summary.recentUnlocks).toHaveLength(0);
  });

  it('aggregates recentUnlocks across multiple games', () => {
    const now = new Date('2024-01-10T00:00:00.000Z');
    const recentDate = '2024-01-09T00:00:00.000Z';

    const makeGame = (apiName: string): GameAchievements => ({
      unlocked: 1,
      total: 1,
      percent: 100,
      items: [
        {
          apiName,
          displayName: apiName,
          description: '',
          iconUrl: 'https://example.com/i.jpg',
          unlocked: true,
          unlockedAt: recentDate,
          globalPercent: null,
        },
      ],
    });

    const summary = aggregateLibrary([makeGame('GAME1_ACH'), makeGame('GAME2_ACH')], now);
    expect(summary.recentUnlocks).toHaveLength(2);
  });

  // -------------------------------------------------------------------------
  // COMP-7 pins (theme-4 T3) — pinned tripwire tests, green from start.
  // These behavior tests pin ordering + cutoff semantics while the sort
  // comparator's redundant Date re-parse is removed (verified by diff review).
  // -------------------------------------------------------------------------

  const makeUnlockedItem = (apiName: string, unlockedAt: string): MergedAchievement => ({
    apiName,
    displayName: apiName,
    description: '',
    iconUrl: 'https://example.com/i.jpg',
    unlocked: true,
    unlockedAt,
    globalPercent: null,
  });

  it('recentUnlocks sorts without re-parsing dates: 3 in-window unlocks return newest-first (pinned tripwire — green from start)', () => {
    const now = new Date('2024-01-10T00:00:00.000Z');
    const game: GameAchievements = {
      unlocked: 3,
      total: 3,
      percent: 100,
      items: [
        makeUnlockedItem('MID', '2024-01-07T00:00:00.000Z'),
        makeUnlockedItem('OLDEST', '2024-01-05T00:00:00.000Z'),
        makeUnlockedItem('NEWEST', '2024-01-09T00:00:00.000Z'),
      ],
    };

    const summary = aggregateLibrary([game], now);
    expect(summary.recentUnlocks.map((i) => i.apiName)).toEqual(['NEWEST', 'MID', 'OLDEST']);
  });

  it('sorts two unlocks 1 minute apart inside the window newest-first (pinned tripwire — green from start)', () => {
    const now = new Date('2024-01-10T00:00:00.000Z');
    const game: GameAchievements = {
      unlocked: 2,
      total: 2,
      percent: 100,
      items: [
        makeUnlockedItem('EARLIER', '2024-01-08T12:00:00.000Z'),
        makeUnlockedItem('LATER', '2024-01-08T12:01:00.000Z'),
      ],
    };

    const summary = aggregateLibrary([game], now);
    expect(summary.recentUnlocks.map((i) => i.apiName)).toEqual(['LATER', 'EARLIER']);
  });

  it('includes an unlock exactly at the 7-day cutoff boundary (>= cutoff inclusive) (pinned tripwire — green from start)', () => {
    const now = new Date('2024-01-10T00:00:00.000Z');
    // Exactly 7 days before `now` — must be included (>= cutoff, not > cutoff).
    const boundary = '2024-01-03T00:00:00.000Z';
    // One millisecond older than the cutoff — must be excluded.
    const justOutside = '2024-01-02T23:59:59.999Z';
    const game: GameAchievements = {
      unlocked: 2,
      total: 2,
      percent: 100,
      items: [
        makeUnlockedItem('AT_BOUNDARY', boundary),
        makeUnlockedItem('JUST_OUTSIDE', justOutside),
      ],
    };

    const summary = aggregateLibrary([game], now);
    expect(summary.recentUnlocks.map((i) => i.apiName)).toEqual(['AT_BOUNDARY']);
  });

  it('uses current date as default reference for the 7-day window', () => {
    // An achievement unlocked 1 second ago should appear in recentUnlocks
    const justNow = new Date(Date.now() - 1000).toISOString();
    const recentItem: MergedAchievement = {
      apiName: 'JUST_NOW',
      displayName: 'Just Now',
      description: '',
      iconUrl: 'https://example.com/j.jpg',
      unlocked: true,
      unlockedAt: justNow,
      globalPercent: null,
    };
    const game: GameAchievements = {
      unlocked: 1,
      total: 1,
      percent: 100,
      items: [recentItem],
    };
    // No `now` argument — should use new Date() internally
    const summary = aggregateLibrary([game]);
    expect(summary.recentUnlocks).toHaveLength(1);
  });
});
