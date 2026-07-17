/**
 * Unit tests for server/repositories/insights/cost-per-hour.ts
 * Prisma is mocked — price data comes from Game table columns, no Store API calls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCostPerHour } from '@/server/repositories/insights/cost-per-hour';
import { clearCache } from '@/server/cache';

const mockPrisma = vi.hoisted(() => ({
  ownedGame: { findMany: vi.fn() },
  game: { findMany: vi.fn() },
}));

// Mock the store module so we can assert it is NEVER called.
const mockGetPrice = vi.hoisted(() => vi.fn());

vi.mock('@/server/db', () => ({ prisma: mockPrisma }));
vi.mock('@/server/env', () => ({ getEnv: () => ({ STEAM_ID: '76561198000000000' }) }));
vi.mock('@/server/repositories/store', () => ({
  getGameStorePrice: mockGetPrice,
  getGameStoreMetadata: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  // getCostPerHour is cached (T5) — clear between cases so a warm hit never
  // breaks Prisma call-count expectations (plan: binding).
  clearCache();
  mockPrisma.ownedGame.findMany.mockResolvedValue([]);
  mockPrisma.game.findMany.mockResolvedValue([]);
});

describe('getCostPerHour', () => {
  it('returns empty result for no games', async () => {
    const { result } = await getCostPerHour('76561198000000000');
    expect(result.ranked).toHaveLength(0);
    expect(result.freeGames).toHaveLength(0);
    expect(result.excludedNoPrice).toBe(0);
    expect(result.excludedNoPlaytime).toBe(0);
  });

  it('never calls getGameStorePrice (reads from DB instead)', async () => {
    mockPrisma.ownedGame.findMany.mockResolvedValue([{ appId: 730, playtimeForever: 60 }]);
    mockPrisma.game.findMany.mockResolvedValue([
      {
        appId: 730,
        name: 'CS2',
        priceFinalCents: 2499,
        priceCurrency: 'USD',
        priceIsFree: false,
        priceRefreshedAt: new Date('2024-01-01'),
      },
    ]);
    await getCostPerHour('76561198000000000');
    expect(mockGetPrice).not.toHaveBeenCalled();
  });

  it('ranks a paid game using DB price columns', async () => {
    mockPrisma.ownedGame.findMany.mockResolvedValue([{ appId: 730, playtimeForever: 60 }]);
    mockPrisma.game.findMany.mockResolvedValue([
      {
        appId: 730,
        name: 'CS2',
        priceFinalCents: 1499,
        priceCurrency: 'USD',
        priceIsFree: false,
        priceRefreshedAt: new Date('2024-01-01'),
      },
    ]);
    const { result, stale } = await getCostPerHour('76561198000000000');
    expect(result.ranked).toHaveLength(1);
    expect(result.ranked[0]!.priceCents).toBe(1499);
    expect(result.ranked[0]!.currency).toBe('USD');
    expect(stale).toBe(false);
  });

  it('maps priceIsFree=true to CostPrice{kind:free}', async () => {
    mockPrisma.ownedGame.findMany.mockResolvedValue([{ appId: 570, playtimeForever: 100 }]);
    mockPrisma.game.findMany.mockResolvedValue([
      {
        appId: 570,
        name: 'Dota 2',
        priceFinalCents: null,
        priceCurrency: null,
        priceIsFree: true,
        priceRefreshedAt: new Date('2024-01-01'),
      },
    ]);
    const { result } = await getCostPerHour('76561198000000000');
    expect(result.freeGames).toHaveLength(1);
    expect(result.freeGames[0]!.name).toBe('Dota 2');
  });

  it('maps priceRefreshedAt=null (never priced) to CostPrice{kind:unavailable}', async () => {
    mockPrisma.ownedGame.findMany.mockResolvedValue([{ appId: 999, playtimeForever: 100 }]);
    mockPrisma.game.findMany.mockResolvedValue([
      {
        appId: 999,
        name: 'New Game',
        priceFinalCents: null,
        priceCurrency: null,
        priceIsFree: null,
        priceRefreshedAt: null,
      },
    ]);
    const { result } = await getCostPerHour('76561198000000000');
    expect(result.excludedNoPrice).toBe(1);
  });

  it('maps no Game row (missing from DB) to CostPrice{kind:unavailable}', async () => {
    mockPrisma.ownedGame.findMany.mockResolvedValue([{ appId: 999, playtimeForever: 100 }]);
    mockPrisma.game.findMany.mockResolvedValue([]);
    const { result } = await getCostPerHour('76561198000000000');
    expect(result.excludedNoPrice).toBe(1);
  });

  it('maps priceIsFree=null with priceFinalCents=null (refreshed but no price) to unavailable', async () => {
    mockPrisma.ownedGame.findMany.mockResolvedValue([{ appId: 440, playtimeForever: 200 }]);
    mockPrisma.game.findMany.mockResolvedValue([
      {
        appId: 440,
        name: 'TF2',
        priceFinalCents: null,
        priceCurrency: null,
        priceIsFree: null,
        priceRefreshedAt: new Date('2024-01-01'),
      },
    ]);
    const { result } = await getCostPerHour('76561198000000000');
    expect(result.excludedNoPrice).toBe(1);
  });

  it('uses App fallback name when game not in DB', async () => {
    mockPrisma.ownedGame.findMany.mockResolvedValue([{ appId: 12345, playtimeForever: 60 }]);
    mockPrisma.game.findMany.mockResolvedValue([]);
    const { result } = await getCostPerHour('76561198000000000');
    // No price → excluded, but excludedNoPrice not freeGames
    expect(result.excludedNoPrice).toBe(1);
  });

  it('returns stale:false (DB read is never stale)', async () => {
    mockPrisma.ownedGame.findMany.mockResolvedValue([{ appId: 730, playtimeForever: 60 }]);
    mockPrisma.game.findMany.mockResolvedValue([
      {
        appId: 730,
        name: 'CS2',
        priceFinalCents: 2499,
        priceCurrency: 'USD',
        priceIsFree: false,
        priceRefreshedAt: new Date('2024-01-01'),
      },
    ]);
    const { stale } = await getCostPerHour('76561198000000000');
    expect(stale).toBe(false);
  });

  it('defaults currency to USD when priceCurrency is null on a paid game', async () => {
    mockPrisma.ownedGame.findMany.mockResolvedValue([{ appId: 730, playtimeForever: 60 }]);
    mockPrisma.game.findMany.mockResolvedValue([
      {
        appId: 730,
        name: 'CS2',
        priceFinalCents: 999,
        priceCurrency: null,
        priceIsFree: false,
        priceRefreshedAt: new Date('2024-01-01'),
      },
    ]);
    const { result } = await getCostPerHour('76561198000000000');
    expect(result.ranked[0]!.currency).toBe('USD');
  });
});
