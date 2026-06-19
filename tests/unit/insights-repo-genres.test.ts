import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getGenreBreakdown } from '@/server/repositories/insights/genres';

const mockPrisma = vi.hoisted(() => ({
  ownedGame: { findMany: vi.fn() },
  game: { findMany: vi.fn() },
}));

// We still mock the store module to assert it is NEVER called.
const mockGetMetadata = vi.hoisted(() => vi.fn());

vi.mock('@/server/db', () => ({ prisma: mockPrisma }));
vi.mock('@/server/env', () => ({
  getEnv: () => ({ STEAM_ID: '76561198000000000', ENABLE_STEAMSPY: false }),
}));
vi.mock('@/server/repositories/store', () => ({
  getGameStoreMetadata: mockGetMetadata,
  getGameStorePrice: vi.fn(),
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
  mockPrisma.game.findMany.mockResolvedValue([]);
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

  it('never calls getGameStoreMetadata (reads from DB instead)', async () => {
    mockPrisma.ownedGame.findMany.mockResolvedValue([{ appId: 730, playtimeForever: 600 }]);
    mockPrisma.game.findMany.mockResolvedValue([{ appId: 730, genres: '["Action"]' }]);
    await getGenreBreakdown('76561198000000000');
    expect(mockGetMetadata).not.toHaveBeenCalled();
  });

  it('aggregates genres from Game table genres JSON', async () => {
    mockPrisma.ownedGame.findMany.mockResolvedValue([
      { appId: 730, playtimeForever: 300 },
      { appId: 570, playtimeForever: 100 },
    ]);
    mockPrisma.game.findMany.mockResolvedValue([
      { appId: 730, genres: '["Action","FPS"]' },
      { appId: 570, genres: '["Action"]' },
    ]);
    const result = await getGenreBreakdown('76561198000000000');
    const action = result.genres.slices.find((s) => s.label === 'Action');
    expect(action?.minutes).toBe(400); // 300 + 100
    const fps = result.genres.slices.find((s) => s.label === 'FPS');
    expect(fps?.minutes).toBe(300);
    expect(result.unknownFromUnavailable).toBe(0);
    expect(result.stale).toBe(false);
  });

  it('folds game with empty genres JSON ("[]") into Unknown when other real genres exist', async () => {
    mockPrisma.ownedGame.findMany.mockResolvedValue([
      { appId: 730, playtimeForever: 300 },
      { appId: 999, playtimeForever: 100 },
    ]);
    mockPrisma.game.findMany.mockResolvedValue([
      { appId: 730, genres: '["Action"]' },
      { appId: 999, genres: '[]' },
    ]);
    const result = await getGenreBreakdown('76561198000000000');
    const unknownSlice = result.genres.slices.find((s) => s.label === 'Unknown');
    expect(unknownSlice?.minutes).toBe(100);
    const action = result.genres.slices.find((s) => s.label === 'Action');
    expect(action?.minutes).toBe(300);
  });

  it('increments unknownFromUnavailable for games with empty labels (no Game row or empty genres)', async () => {
    mockPrisma.ownedGame.findMany.mockResolvedValue([
      { appId: 730, playtimeForever: 600 },
    ]);
    // No Game row for appId 730
    mockPrisma.game.findMany.mockResolvedValue([]);
    const result = await getGenreBreakdown('76561198000000000');
    expect(result.unknownFromUnavailable).toBe(1);
  });

  it('returns empty slices when ALL owned games have empty genres (before first nightly run)', async () => {
    mockPrisma.ownedGame.findMany.mockResolvedValue([
      { appId: 730, playtimeForever: 300 },
      { appId: 570, playtimeForever: 100 },
    ]);
    mockPrisma.game.findMany.mockResolvedValue([
      { appId: 730, genres: '[]' },
      { appId: 570, genres: '[]' },
    ]);
    const result = await getGenreBreakdown('76561198000000000');
    // All-empty: return empty slices so the UI shows "No genre data yet"
    expect(result.genres.slices).toHaveLength(0);
    expect(result.genres.totalMinutes).toBe(400);
  });

  it('gracefully handles malformed genres JSON (treats as empty)', async () => {
    mockPrisma.ownedGame.findMany.mockResolvedValue([
      { appId: 730, playtimeForever: 300 },
    ]);
    mockPrisma.game.findMany.mockResolvedValue([
      { appId: 730, genres: 'not-valid-json' },
    ]);
    const result = await getGenreBreakdown('76561198000000000');
    expect(result.unknownFromUnavailable).toBe(1);
  });

  it('treats valid JSON that is not an array (e.g. object or number) as empty genres', async () => {
    mockPrisma.ownedGame.findMany.mockResolvedValue([
      { appId: 730, playtimeForever: 300 },
      { appId: 570, playtimeForever: 100 },
    ]);
    // '{}' and '42' are valid JSON but not arrays — must fold into Unknown.
    mockPrisma.game.findMany.mockResolvedValue([
      { appId: 730, genres: '{}' },
      { appId: 570, genres: '42' },
    ]);
    const result = await getGenreBreakdown('76561198000000000');
    // Both games have no genres → unknownFromUnavailable = 2
    expect(result.unknownFromUnavailable).toBe(2);
    // All-unknown → empty slices (same "no genre data yet" path)
    expect(result.genres.slices).toHaveLength(0);
    expect(result.genres.totalMinutes).toBe(400);
  });
});
