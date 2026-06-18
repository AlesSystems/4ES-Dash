import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getGenreBreakdown } from '@/server/repositories/insights/genres';

const mockPrisma = vi.hoisted(() => ({
  ownedGame: { findMany: vi.fn() },
}));

const mockGetMetadata = vi.hoisted(() => vi.fn());

vi.mock('@/server/db', () => ({ prisma: mockPrisma }));
vi.mock('@/server/env', () => ({
  getEnv: () => ({ STEAM_ID: '76561198000000000', ENABLE_STEAMSPY: false }),
}));
vi.mock('@/server/repositories/store', () => ({
  getGameStoreMetadata: mockGetMetadata,
}));
vi.mock('@/server/cache', () => ({
  cache: vi.fn(async (_key: unknown, _ttl: unknown, loader: () => Promise<unknown>) => {
    const value = await loader();
    return { value, stale: false };
  }),
  cacheKey: vi.fn((...args: string[]) => args.join(':')),
  TTL: { storeMetadata: 604800, steamSpy: 86400 },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.ownedGame.findMany.mockResolvedValue([]);
});

describe('getGenreBreakdown', () => {
  it('returns empty breakdown for no games', async () => {
    const result = await getGenreBreakdown('76561198000000000');
    expect(result.genres.slices).toHaveLength(0);
    expect(result.genres.totalMinutes).toBe(0);
    expect(result.tags).toBeNull();
    expect(result.unknownFromUnavailable).toBe(0);
    expect(result.stale).toBe(false);
  });

  it('folds unavailable metadata into Unknown and increments unknownFromUnavailable', async () => {
    mockPrisma.ownedGame.findMany.mockResolvedValue([{ appId: 730, playtimeForever: 600 }]);
    mockGetMetadata.mockResolvedValue({ available: false, reason: 'metadata-unavailable' });
    const result = await getGenreBreakdown('76561198000000000');
    expect(result.unknownFromUnavailable).toBe(1);
    const unknownSlice = result.genres.slices.find((s) => s.label === 'Unknown');
    expect(unknownSlice?.minutes).toBe(600);
  });

  it('aggregates genres from available metadata', async () => {
    mockPrisma.ownedGame.findMany.mockResolvedValue([
      { appId: 730, playtimeForever: 300 },
      { appId: 570, playtimeForever: 100 },
    ]);
    mockGetMetadata
      .mockResolvedValueOnce({
        available: true,
        data: {
          genres: ['Action', 'FPS'],
          name: '',
          shortDescription: '',
          headerImage: '',
          categories: [],
          categoryIds: [],
          developers: [],
          publishers: [],
          releaseDate: null,
          platforms: { windows: true, mac: false, linux: false },
        },
        stale: false,
      })
      .mockResolvedValueOnce({
        available: true,
        data: {
          genres: ['Action'],
          name: '',
          shortDescription: '',
          headerImage: '',
          categories: [],
          categoryIds: [],
          developers: [],
          publishers: [],
          releaseDate: null,
          platforms: { windows: true, mac: false, linux: false },
        },
        stale: false,
      });
    const result = await getGenreBreakdown('76561198000000000');
    const action = result.genres.slices.find((s) => s.label === 'Action');
    expect(action?.minutes).toBe(400); // 300 + 100
    const fps = result.genres.slices.find((s) => s.label === 'FPS');
    expect(fps?.minutes).toBe(300);
    expect(result.unknownFromUnavailable).toBe(0);
  });
});
