import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAvailableReviewYears,
  getYearInReview,
} from '@/server/repositories/insights/year-in-review';

const mockPrisma = vi.hoisted(() => ({
  playtimeSnapshot: { findMany: vi.fn() },
  achievementSnapshot: { findMany: vi.fn() },
  achievementUnlock: { findMany: vi.fn() },
  game: { findMany: vi.fn() },
}));

vi.mock('@/server/db', () => ({ prisma: mockPrisma }));
vi.mock('@/server/env', () => ({ getEnv: () => ({ STEAM_ID: '76561198000000000' }) }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getAvailableReviewYears', () => {
  it('returns [] when no snapshots', async () => {
    mockPrisma.playtimeSnapshot.findMany.mockResolvedValue([]);
    expect(await getAvailableReviewYears('76561198000000000')).toEqual([]);
  });

  it('returns distinct years DESC from snapshot dates', async () => {
    mockPrisma.playtimeSnapshot.findMany.mockResolvedValue([
      { date: new Date('2024-01-01T00:00:00.000Z') },
      { date: new Date('2025-06-15T00:00:00.000Z') },
      { date: new Date('2024-11-01T00:00:00.000Z') },
    ]);
    const years = await getAvailableReviewYears('76561198000000000');
    expect(years).toEqual([2025, 2024]);
  });

  it('accepts explicit steamId', async () => {
    mockPrisma.playtimeSnapshot.findMany.mockResolvedValue([]);
    await getAvailableReviewYears('76561198111111111');
    expect(mockPrisma.playtimeSnapshot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { steamId: '76561198111111111' } }),
    );
  });
});

describe('getYearInReview', () => {
  it('returns zero totals when no data for the year', async () => {
    mockPrisma.playtimeSnapshot.findMany.mockResolvedValue([]);
    mockPrisma.achievementUnlock.findMany.mockResolvedValue([]);
    mockPrisma.game.findMany.mockResolvedValue([]);
    const result = await getYearInReview('76561198000000000', 2025);
    expect(result).toEqual({ year: 2025, totalMinutes: 0, topGames: [], achievementsUnlocked: 0 });
  });

  it('uses game name from DB and App fallback', async () => {
    mockPrisma.playtimeSnapshot.findMany.mockResolvedValue([
      { appId: 730, date: new Date('2025-01-01T00:00:00.000Z'), playtimeForever: 100 },
      { appId: 730, date: new Date('2025-06-01T00:00:00.000Z'), playtimeForever: 200 },
      { appId: 999, date: new Date('2025-01-01T00:00:00.000Z'), playtimeForever: 50 },
      { appId: 999, date: new Date('2025-06-01T00:00:00.000Z'), playtimeForever: 150 },
    ]);
    mockPrisma.achievementUnlock.findMany.mockResolvedValue([]);
    mockPrisma.game.findMany.mockResolvedValue([{ appId: 730, name: 'Counter-Strike 2' }]);
    const result = await getYearInReview('76561198000000000', 2025);
    const cs2 = result.topGames.find((g) => g.appId === 730);
    const unknown = result.topGames.find((g) => g.appId === 999);
    expect(cs2?.name).toBe('Counter-Strike 2');
    expect(unknown?.name).toBe('App 999');
  });

  it('counts achievementsUnlocked from unlock EVENTS, not snapshot deltas (#91)', async () => {
    // The regression case: a single day of playtime data (no snapshot history),
    // but several real unlock events in the year — the old delta logic returned 0.
    mockPrisma.playtimeSnapshot.findMany.mockResolvedValue([
      { appId: 730, date: new Date('2025-05-01T00:00:00.000Z'), playtimeForever: 100 },
    ]);
    mockPrisma.achievementUnlock.findMany.mockResolvedValue([
      { steamId: '76561198000000000', appId: 730, apiName: 'a', unlockedAt: new Date('2025-05-01T00:00:00.000Z') },
      { steamId: '76561198000000000', appId: 730, apiName: 'b', unlockedAt: new Date('2025-05-02T00:00:00.000Z') },
      // An unlock in a game with NO playtime snapshot still counts.
      { steamId: '76561198000000000', appId: 111, apiName: 'c', unlockedAt: new Date('2025-09-09T00:00:00.000Z') },
      // A different year is excluded.
      { steamId: '76561198000000000', appId: 730, apiName: 'd', unlockedAt: new Date('2024-12-31T23:59:59.000Z') },
    ]);
    mockPrisma.game.findMany.mockResolvedValue([{ appId: 730, name: 'Counter-Strike 2' }]);
    const result = await getYearInReview('76561198000000000', 2025);
    expect(result.achievementsUnlocked).toBe(3);
    // queries the unlock table, scoped to the user
    expect(mockPrisma.achievementUnlock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { steamId: '76561198000000000' } }),
    );
  });
});
