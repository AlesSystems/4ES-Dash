/**
 * Unit tests for server/repositories/insights/cost-per-hour.ts
 * Prisma and store are mocked via vi.hoisted — no I/O.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCostPerHour } from '@/server/repositories/insights/cost-per-hour';

const mockPrisma = vi.hoisted(() => ({
  ownedGame: { findMany: vi.fn() },
  game: { findMany: vi.fn() },
  manualGameData: { findMany: vi.fn() },
}));

const mockGetPrice = vi.hoisted(() => vi.fn());

vi.mock('@/server/db', () => ({ prisma: mockPrisma }));
vi.mock('@/server/env', () => ({ getEnv: () => ({ STEAM_ID: '76561198000000000' }) }));
vi.mock('@/server/repositories/store', () => ({ getGameStorePrice: mockGetPrice }));

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.ownedGame.findMany.mockResolvedValue([]);
  mockPrisma.game.findMany.mockResolvedValue([]);
  mockPrisma.manualGameData.findMany.mockResolvedValue([]);
});

describe('getCostPerHour', () => {
  it('returns empty result for no games', async () => {
    const { result } = await getCostPerHour();
    expect(result.ranked).toHaveLength(0);
    expect(result.freeGames).toHaveLength(0);
    expect(result.excludedNoPrice).toBe(0);
    expect(result.excludedNoPlaytime).toBe(0);
  });

  it('maps manual pricePaidCents to CostPrice{kind:paid} — does not call store', async () => {
    mockPrisma.ownedGame.findMany.mockResolvedValue([{ appId: 730, playtimeForever: 60 }]);
    mockPrisma.game.findMany.mockResolvedValue([{ appId: 730, name: 'CS2' }]);
    mockPrisma.manualGameData.findMany.mockResolvedValue([
      { appId: 730, pricePaidCents: 2499, currency: 'USD' },
    ]);
    const { result } = await getCostPerHour();
    expect(result.ranked).toHaveLength(1);
    expect(result.ranked[0]!.priceCents).toBe(2499);
    expect(result.ranked[0]!.currency).toBe('USD');
    expect(mockGetPrice).not.toHaveBeenCalled();
  });

  it('fetches store price for currency when manual.currency is null', async () => {
    mockPrisma.ownedGame.findMany.mockResolvedValue([{ appId: 730, playtimeForever: 60 }]);
    mockPrisma.game.findMany.mockResolvedValue([{ appId: 730, name: 'CS2' }]);
    mockPrisma.manualGameData.findMany.mockResolvedValue([
      { appId: 730, pricePaidCents: 2499, currency: null },
    ]);
    mockGetPrice.mockResolvedValue({
      available: true,
      data: {
        currency: 'EUR',
        initialCents: 2499,
        finalCents: 2499,
        discountPercent: 0,
        formatted: '€24.99',
      },
      stale: false,
    });
    const { result } = await getCostPerHour();
    expect(result.ranked[0]!.currency).toBe('EUR');
  });

  it('falls back to USD when both manual.currency and store price are unavailable', async () => {
    mockPrisma.ownedGame.findMany.mockResolvedValue([{ appId: 730, playtimeForever: 60 }]);
    mockPrisma.game.findMany.mockResolvedValue([{ appId: 730, name: 'CS2' }]);
    mockPrisma.manualGameData.findMany.mockResolvedValue([
      { appId: 730, pricePaidCents: 2499, currency: null },
    ]);
    mockGetPrice.mockResolvedValue({ available: false, reason: 'metadata-unavailable' });
    const { result } = await getCostPerHour();
    expect(result.ranked[0]!.currency).toBe('USD');
  });

  it('maps free store price (null) to CostPrice{kind:free}', async () => {
    mockPrisma.ownedGame.findMany.mockResolvedValue([{ appId: 570, playtimeForever: 100 }]);
    mockPrisma.game.findMany.mockResolvedValue([{ appId: 570, name: 'Dota 2' }]);
    mockPrisma.manualGameData.findMany.mockResolvedValue([]);
    mockGetPrice.mockResolvedValue({ available: true, data: null, stale: false });
    const { result } = await getCostPerHour();
    expect(result.freeGames).toHaveLength(1);
    expect(result.freeGames[0]!.name).toBe('Dota 2');
  });

  it('maps unavailable store price to CostPrice{kind:unavailable}', async () => {
    mockPrisma.ownedGame.findMany.mockResolvedValue([{ appId: 999, playtimeForever: 100 }]);
    mockPrisma.game.findMany.mockResolvedValue([{ appId: 999, name: 'Unknown Game' }]);
    mockPrisma.manualGameData.findMany.mockResolvedValue([]);
    mockGetPrice.mockResolvedValue({ available: false, reason: 'metadata-unavailable' });
    const { result } = await getCostPerHour();
    expect(result.excludedNoPrice).toBe(1);
  });

  it('maps paid store price with finalCents=0 to CostPrice{kind:free}', async () => {
    mockPrisma.ownedGame.findMany.mockResolvedValue([{ appId: 440, playtimeForever: 200 }]);
    mockPrisma.game.findMany.mockResolvedValue([{ appId: 440, name: 'TF2' }]);
    mockPrisma.manualGameData.findMany.mockResolvedValue([]);
    mockGetPrice.mockResolvedValue({
      available: true,
      data: {
        currency: 'USD',
        initialCents: 999,
        finalCents: 0,
        discountPercent: 100,
        formatted: '$0.00',
      },
      stale: false,
    });
    const { result } = await getCostPerHour();
    expect(result.freeGames).toHaveLength(1);
  });

  it('uses App fallback name when game not in DB', async () => {
    mockPrisma.ownedGame.findMany.mockResolvedValue([{ appId: 12345, playtimeForever: 60 }]);
    mockPrisma.game.findMany.mockResolvedValue([]);
    mockPrisma.manualGameData.findMany.mockResolvedValue([]);
    mockGetPrice.mockResolvedValue({ available: true, data: null, stale: false });
    const { result } = await getCostPerHour();
    expect(result.freeGames[0]!.name).toBe('App 12345');
  });

  it('tracks stale from store price', async () => {
    mockPrisma.ownedGame.findMany.mockResolvedValue([{ appId: 730, playtimeForever: 60 }]);
    mockPrisma.game.findMany.mockResolvedValue([{ appId: 730, name: 'CS2' }]);
    mockPrisma.manualGameData.findMany.mockResolvedValue([]);
    mockGetPrice.mockResolvedValue({
      available: true,
      data: {
        currency: 'USD',
        initialCents: 2499,
        finalCents: 2499,
        discountPercent: 0,
        formatted: '$24.99',
      },
      stale: true,
    });
    const { stale } = await getCostPerHour();
    expect(stale).toBe(true);
  });
});
