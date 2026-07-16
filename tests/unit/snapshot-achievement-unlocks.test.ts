import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { available, unavailable } from '@/lib/result';
import { topGamesByPlaytime } from '@/lib/games/select';
import type { GameAchievements, MergedAchievement } from '@/lib/achievements/aggregate';

/**
 * Write-path coverage for the #91 unlock-event recorder (Blocker 2 from review,
 * revised by optimization theme-5 T1).
 *
 * Asserts the NIGHTLY-JOB pipeline persists correct `AchievementUnlock` rows
 * under the BUDGETED contract: per-invocation candidates are bounded to the
 * hot set (top-20 by two-week playtime) plus one day-keyed rotation window of
 * at most ACHIEVEMENT_UNLOCK_ACHIEVEMENT_UNLOCK_NIGHTLY_LIMIT games — criterion #6 now means
 * EVENTUAL completeness (every achievement game covered within one rotation
 * cycle of ceil(R/LIMIT) nights), not single-run completeness. Also pins
 * attribution by the real `unlockedAt`, exclusion of locked / unlocktime-0
 * achievements at write time, idempotent upserts, and the unchanged explicit-
 * limit (resync) path.
 */

/** The nightly hot-set size (top-20 by two-week playtime) — plan-fixed at 20. */
const HOT_SET_SIZE = 20;

const mockPrisma = vi.hoisted(() => ({
  achievementUnlock: { upsert: vi.fn() },
}));
vi.mock('@/server/db', () => ({ prisma: mockPrisma }));

const mockGetGameAchievements = vi.hoisted(() => vi.fn());
vi.mock('@/server/repositories/achievements', () => ({
  getGameAchievements: mockGetGameAchievements,
}));

import {
  recordAchievementUnlocks,
  rotationWindowForDay,
  topGamesByTwoWeekPlaytime,
  ACHIEVEMENT_UNLOCK_NIGHTLY_LIMIT,
} from '@/server/jobs/snapshot';
import type { OwnedGame } from '@/lib/steam/schemas';

const STEAM_ID = '76561198000000000';

function game(appId: number, playtimeMinutes: number, twoWeeks = 0): OwnedGame {
  return {
    appId,
    name: `Game ${appId}`,
    iconUrl: null,
    headerUrl: '',
    playtime: { total: playtimeMinutes, twoWeeks },
    lastPlayed: null,
    hasAchievements: true,
  };
}

function item(apiName: string, unlocked: boolean, unlockedAt: string | null): MergedAchievement {
  return {
    apiName,
    displayName: apiName,
    description: '',
    iconUrl: '',
    unlocked,
    unlockedAt,
    globalPercent: null,
  };
}

function gameAchievements(items: MergedAchievement[]): GameAchievements {
  const unlocked = items.filter((i) => i.unlocked).length;
  return { unlocked, total: items.length, percent: 0, items };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('recordAchievementUnlocks (#91 write path)', () => {
  it('criterion #6 (revised, theme-5 T1): every achievement game — incl. one outside any top-played set — is covered within one rotation cycle, not necessarily on night 1', async () => {
    // Issue #91 criterion #6 shipped with single-run semantics ("records unlock
    // events for ALL achievement games" in one nightly run). Theme-5 T1 revises
    // it to EVENTUAL completeness: each night processes only the hot set plus
    // one day-keyed rotation window; full coverage is guaranteed within
    // ceil(R / ACHIEVEMENT_UNLOCK_ACHIEVEMENT_UNLOCK_NIGHTLY_LIMIT) consecutive nights. The
    // low-playtime game may be missed on night 1 but must be recorded by cycle
    // end — delayed, never dropped.
    vi.useFakeTimers();

    // 69 heavy games (appIds 1..69, totals descending) + one near-zero-playtime
    // game with the highest appId — outside any top-played set. Hot set =
    // appIds 1..20 (twoWeeks all 0 → falls back to total); rotation set R = 50
    // (appIds 21..69 + 7000, sorted by appId) → cycle = ceil(50/40) = 2 nights.
    const games = Array.from({ length: 69 }, (_, i) => game(i + 1, 100_000 - i * 10));
    games.push(game(7000, 1 /* outside top-played */));
    const rotationSetSize = games.length - HOT_SET_SIZE;
    const cycleNights = Math.ceil(rotationSetSize / ACHIEVEMENT_UNLOCK_NIGHTLY_LIMIT);

    mockGetGameAchievements.mockImplementation(async (_id: string, appId: number) =>
      available(gameAchievements([item(`ach-${appId}`, true, '2025-01-02T00:00:00.000Z')])),
    );

    // 2026-03-01 = UTC day-of-year 60 → 60 % 2 = 0 → window 0 (appIds 21..60)
    // on night 1, so appId 7000 (window 1) is deterministically NOT night-1 work.
    const night1AppIds: number[] = [];
    for (let night = 0; night < cycleNights; night++) {
      vi.setSystemTime(new Date(Date.UTC(2026, 2, 1 + night, 3)));
      await recordAchievementUnlocks(STEAM_ID, games);
      if (night === 0) {
        night1AppIds.push(...mockGetGameAchievements.mock.calls.map((c) => c[1] as number));
      }
    }

    // Night 1 is budgeted — NOT single-run complete: the low-playtime game
    // waits for its rotation window.
    expect(night1AppIds.length).toBeLessThanOrEqual(HOT_SET_SIZE + ACHIEVEMENT_UNLOCK_NIGHTLY_LIMIT);
    expect(night1AppIds).not.toContain(7000);

    // By cycle end, EVERY achievement game has been recorded — incl. 7000.
    const recorded = new Set(
      mockPrisma.achievementUnlock.upsert.mock.calls.map(
        (c) => c[0].where.steamId_appId_apiName.appId,
      ),
    );
    expect(recorded.has(7000)).toBe(true); // the low-playtime game is delayed, NOT dropped
    expect(recorded.size).toBe(games.length);
  });

  it('nightly path (no limit) processes at most hotSet + ACHIEVEMENT_UNLOCK_NIGHTLY_LIMIT games', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 2, 1, 3)));

    const games = Array.from({ length: 120 }, (_, i) => game(i + 1, 100_000 - i * 10));
    mockGetGameAchievements.mockImplementation(async (_id: string, appId: number) =>
      available(gameAchievements([item(`ach-${appId}`, true, '2025-01-01T00:00:00.000Z')])),
    );

    await recordAchievementUnlocks(STEAM_ID, games);

    expect(mockGetGameAchievements.mock.calls.length).toBeLessThanOrEqual(
      HOT_SET_SIZE + ACHIEVEMENT_UNLOCK_NIGHTLY_LIMIT,
    );
  });

  it('nightly hot set always includes top-20 by two-week playtime', async () => {
    vi.useFakeTimers();
    // 2026-03-01 = day-of-year 60; rotation set R = 100 → windowCount 3;
    // 60 % 3 = 0 → window 0 (lowest appIds) — appId 9999 is NOT in tonight's
    // window, so its presence proves hot-set inclusion, not rotation luck.
    vi.setSystemTime(new Date(Date.UTC(2026, 2, 1, 3)));

    // 119 heavy-total games + one game with the HIGHEST two-week playtime but
    // near-zero total and the highest appId.
    const games = Array.from({ length: 119 }, (_, i) => game(i + 1, 100_000 - i * 10));
    games.push(game(9999, 1, 5000 /* max two-week playtime */));

    mockGetGameAchievements.mockImplementation(async (_id: string, appId: number) =>
      available(gameAchievements([item(`ach-${appId}`, true, '2025-01-01T00:00:00.000Z')])),
    );

    await recordAchievementUnlocks(STEAM_ID, games);

    const calledAppIds = mockGetGameAchievements.mock.calls.map((c) => c[1] as number);
    expect(calledAppIds).toContain(9999); // recently-active game is never delayed
    expect(calledAppIds.length).toBeLessThanOrEqual(HOT_SET_SIZE + ACHIEVEMENT_UNLOCK_NIGHTLY_LIMIT);
  });

  it('explicit limit path unchanged: top-N by playtime (characterization pin, bug-04-adjacent resync bound)', async () => {
    // Pin: with an explicit `limit`, candidate selection must stay byte-identical
    // to the shipped behavior — exactly topGamesByPlaytime(all, limit), in order.
    const games = Array.from({ length: 30 }, (_, i) => game(i + 1, (i + 1) * 100));
    mockGetGameAchievements.mockImplementation(async (_id: string, appId: number) =>
      available(gameAchievements([item(`ach-${appId}`, true, '2025-01-01T00:00:00.000Z')])),
    );

    await recordAchievementUnlocks(STEAM_ID, games, 20);

    const calledAppIds = mockGetGameAchievements.mock.calls.map((c) => c[1] as number);
    expect(calledAppIds).toEqual(topGamesByPlaytime(games, 20).map((g) => g.appId));
  });

  it('attributes the row by the real unlockedAt and uses an idempotent (empty-update) upsert', async () => {
    mockGetGameAchievements.mockResolvedValue(
      available(gameAchievements([item('ach1', true, '2025-03-04T05:06:07.000Z')])),
    );

    await recordAchievementUnlocks(STEAM_ID, [game(100, 5)]);

    expect(mockPrisma.achievementUnlock.upsert).toHaveBeenCalledWith({
      where: { steamId_appId_apiName: { steamId: STEAM_ID, appId: 100, apiName: 'ach1' } },
      create: {
        steamId: STEAM_ID,
        appId: 100,
        apiName: 'ach1',
        unlockedAt: new Date('2025-03-04T05:06:07.000Z'),
      },
      update: {}, // immutable once recorded → idempotent re-run
    });
  });

  it('excludes locked achievements and unlocktime-0 (unlockedAt === null) rows', async () => {
    mockGetGameAchievements.mockResolvedValue(
      available(
        gameAchievements([
          item('unlocked', true, '2025-05-05T00:00:00.000Z'),
          item('locked', false, null),
          item('unlocked-time-unknown', true, null), // Steam unlocktime 0
        ]),
      ),
    );

    const total = await recordAchievementUnlocks(STEAM_ID, [game(100, 5)]);

    expect(total).toBe(1);
    expect(mockPrisma.achievementUnlock.upsert).toHaveBeenCalledTimes(1);
    const firstCall = mockPrisma.achievementUnlock.upsert.mock.calls[0];
    expect(firstCall).toBeDefined();
    expect(firstCall?.[0].where.steamId_appId_apiName.apiName).toBe('unlocked');
  });

  it('skips games whose achievement data is unavailable and never throws', async () => {
    mockGetGameAchievements.mockImplementation(async (_id: string, appId: number) => {
      if (appId === 100) return unavailable('private');
      return available(gameAchievements([item('a', true, '2025-01-01T00:00:00.000Z')]));
    });

    const total = await recordAchievementUnlocks(STEAM_ID, [game(100, 5), game(200, 5)]);

    expect(total).toBe(1); // only the available game contributed
    expect(mockPrisma.achievementUnlock.upsert).toHaveBeenCalledTimes(1);
  });

  it('ignores games with no achievements', async () => {
    const noAch: OwnedGame = { ...game(300, 5), hasAchievements: false };
    const total = await recordAchievementUnlocks(STEAM_ID, [noAch]);
    expect(total).toBe(0);
    expect(mockGetGameAchievements).not.toHaveBeenCalled();
  });

  it('AC3 (bug-04): with limit=K processes only top-K-by-playtime achievement games', async () => {
    // 3 achievement games; limit=2 → only the top 2 by playtime are processed.
    const games = [game(100, 5000), game(200, 1000), game(300, 100)];

    mockGetGameAchievements.mockImplementation(async (_id: string, appId: number) =>
      available(gameAchievements([item(`ach-${appId}`, true, '2025-01-01T00:00:00.000Z')])),
    );

    await recordAchievementUnlocks(STEAM_ID, games, 2);

    // Only top-2 by playtime (appId 100 and 200) should be fetched.
    expect(mockGetGameAchievements).toHaveBeenCalledTimes(2);
    const calledAppIds = mockGetGameAchievements.mock.calls.map((c) => c[1] as number);
    expect(calledAppIds).toContain(100);
    expect(calledAppIds).toContain(200);
    expect(calledAppIds).not.toContain(300);
  });
});

describe('rotation window + hot-set helpers (pure, theme-5 T1)', () => {
  it('rotation windows cover every achievement game exactly once per cycle and are stable within a day', () => {
    const appIds = Array.from({ length: 100 }, (_, i) => i + 1); // sorted asc
    const windowCount = Math.ceil(appIds.length / ACHIEVEMENT_UNLOCK_NIGHTLY_LIMIT); // 3

    // Same dayKey twice → identical window (idempotent same-day re-run).
    const day0 = new Date(Date.UTC(2026, 2, 1));
    expect(rotationWindowForDay(appIds, day0)).toEqual(rotationWindowForDay(appIds, day0));

    // Union over windowCount consecutive simulated days = the full set, with
    // no appId appearing twice within one cycle.
    const seen: number[] = [];
    for (let n = 0; n < windowCount; n++) {
      seen.push(...rotationWindowForDay(appIds, new Date(Date.UTC(2026, 2, 1 + n))));
    }
    expect(seen).toHaveLength(appIds.length); // exactly once per cycle
    expect(new Set(seen).size).toBe(appIds.length);
    expect([...seen].sort((a, b) => a - b)).toEqual(appIds);

    // Consecutive days → successive (different) windows.
    const w1 = rotationWindowForDay(appIds, new Date(Date.UTC(2026, 2, 2)));
    expect(rotationWindowForDay(appIds, day0)).not.toEqual(w1);
  });

  it('rotation window of an empty candidate list is empty (no division-by-zero)', () => {
    expect(rotationWindowForDay([], new Date(Date.UTC(2026, 2, 1)))).toEqual([]);
  });

  it('topGamesByTwoWeekPlaytime sorts by two-week playtime first, falling back to total', () => {
    const heavyTotal = game(1, 10_000, 0);
    const recentlyActive = game(2, 5, 300); // low total, but recent activity wins
    const midTotal = game(3, 500, 0);
    expect(
      topGamesByTwoWeekPlaytime([midTotal, heavyTotal, recentlyActive], 2).map((g) => g.appId),
    ).toEqual([2, 1]);
  });
});
