import { describe, it, expect, vi, beforeEach } from 'vitest';
import { available, unavailable } from '@/lib/result';
import type { GameAchievements, MergedAchievement } from '@/lib/achievements/aggregate';

/**
 * Write-path coverage for the #91 unlock-event recorder (Blocker 2 from review).
 *
 * Asserts the NIGHTLY-JOB pipeline actually persists correct `AchievementUnlock`
 * rows: every achievement-bearing game (incl. one outside any top-N played set —
 * criterion #6), attribution by the real `unlockedAt`, exclusion of locked /
 * unlocktime-0 achievements at write time, and idempotent upserts. A regression
 * like writing `new Date()` instead of `new Date(unlockedAt)`, or dropping the
 * null guard, would now fail here.
 */

const mockPrisma = vi.hoisted(() => ({
  achievementUnlock: { upsert: vi.fn() },
}));
vi.mock('@/server/db', () => ({ prisma: mockPrisma }));

const mockGetGameAchievements = vi.hoisted(() => vi.fn());
vi.mock('@/server/repositories/achievements', () => ({
  getGameAchievements: mockGetGameAchievements,
}));

import { recordAchievementUnlocks } from '@/server/jobs/snapshot';
import type { OwnedGame } from '@/lib/steam/schemas';

const STEAM_ID = '76561198000000000';

function game(appId: number, playtimeMinutes: number): OwnedGame {
  return {
    appId,
    name: `Game ${appId}`,
    iconUrl: null,
    headerUrl: '',
    playtime: { total: playtimeMinutes, twoWeeks: 0 },
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

describe('recordAchievementUnlocks (#91 write path)', () => {
  it('records unlock events for ALL achievement games, incl. one outside the top-played set (#6)', async () => {
    // A high-playtime game AND a near-zero-playtime game that would fall outside
    // any top-N-by-playtime bound. Both must have their unlocks recorded.
    const games = [game(100, 10_000), game(200, 1 /* outside top-N */)];

    mockGetGameAchievements.mockImplementation(async (_id: string, appId: number) => {
      if (appId === 100) {
        return available(
          gameAchievements([item('a', true, '2025-01-02T00:00:00.000Z')]),
        );
      }
      return available(gameAchievements([item('z', true, '2025-09-09T00:00:00.000Z')]));
    });

    const total = await recordAchievementUnlocks(STEAM_ID, games);

    expect(total).toBe(2);
    const appIdsRecorded = mockPrisma.achievementUnlock.upsert.mock.calls.map(
      (c) => c[0].where.steamId_appId_apiName.appId,
    );
    expect(appIdsRecorded).toContain(100);
    expect(appIdsRecorded).toContain(200); // the low-playtime game is NOT dropped
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
});
