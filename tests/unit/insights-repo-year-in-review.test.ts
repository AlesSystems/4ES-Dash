import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAvailableReviewYears,
  getYearInReview,
} from '@/server/repositories/insights/year-in-review';

const mockPrisma = vi.hoisted(() => ({
  playtimeSnapshot: { findMany: vi.fn() },
  achievementSnapshot: { findMany: vi.fn() },
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
    expect(await getAvailableReviewYears()).toEqual([]);
  });

  it('returns distinct years DESC from snapshot dates', async () => {
    mockPrisma.playtimeSnapshot.findMany.mockResolvedValue([
      { date: new Date('2024-01-01T00:00:00.000Z') },
      { date: new Date('2025-06-15T00:00:00.000Z') },
      { date: new Date('2024-11-01T00:00:00.000Z') },
    ]);
    const years = await getAvailableReviewYears();
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
    mockPrisma.achievementSnapshot.findMany.mockResolvedValue([]);
    mockPrisma.game.findMany.mockResolvedValue([]);
    const result = await getYearInReview(2025);
    expect(result).toEqual({ year: 2025, totalMinutes: 0, topGames: [], achievementsUnlocked: 0 });
  });

  it('uses game name from DB and App fallback', async () => {
    mockPrisma.playtimeSnapshot.findMany.mockResolvedValue([
      { appId: 730, date: new Date('2025-01-01T00:00:00.000Z'), playtimeForever: 100 },
      { appId: 730, date: new Date('2025-06-01T00:00:00.000Z'), playtimeForever: 200 },
      { appId: 999, date: new Date('2025-01-01T00:00:00.000Z'), playtimeForever: 50 },
      { appId: 999, date: new Date('2025-06-01T00:00:00.000Z'), playtimeForever: 150 },
    ]);
    mockPrisma.achievementSnapshot.findMany.mockResolvedValue([]);
    mockPrisma.game.findMany.mockResolvedValue([{ appId: 730, name: 'Counter-Strike 2' }]);
    const result = await getYearInReview(2025);
    const cs2 = result.topGames.find((g) => g.appId === 730);
    const unknown = result.topGames.find((g) => g.appId === 999);
    expect(cs2?.name).toBe('Counter-Strike 2');
    expect(unknown?.name).toBe('App 999');
  });
});
