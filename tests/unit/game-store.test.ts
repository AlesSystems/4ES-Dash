import { describe, expect, it, vi, beforeEach } from 'vitest';
import { available, unavailable } from '@/lib/result';

// ---------------------------------------------------------------------------
// Module mocks — must be declared before importing the module under test.
// ---------------------------------------------------------------------------

vi.mock('@/server/repositories/store');

const mockPrisma = vi.hoisted(() => ({
  game: { upsert: vi.fn() },
}));
vi.mock('@/server/db', () => ({ prisma: mockPrisma }));

import { getGameStoreMetadata, getGameStorePrice } from '@/server/repositories/store';
import { refreshGameStoreData } from '@/server/repositories/game-store';
import type { OwnedGame } from '@/lib/steam/schemas';

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------

const mockGetGameStoreMetadata = vi.mocked(getGameStoreMetadata);
const mockGetGameStorePrice = vi.mocked(getGameStorePrice);

/** OwnedGame stub — only appId and name are read by refreshGameStoreData. */
function ownedGame(appId: number, name = `Game ${appId}`): OwnedGame {
  return {
    appId,
    name,
    iconUrl: null,
    headerUrl: '',
    playtime: { total: 0, twoWeeks: 0 },
    lastPlayed: null,
    hasAchievements: false,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// refreshGameStoreData
// ---------------------------------------------------------------------------

describe('refreshGameStoreData', () => {
  it('upserts a paid game with priceFinalCents, priceCurrency, priceIsFree=false and genres', async () => {
    mockGetGameStoreMetadata.mockResolvedValue(
      available({ name: 'Half-Life 2', shortDescription: '', headerImage: '', genres: ['Action', 'FPS'], categories: [], categoryIds: [], developers: [], publishers: [], releaseDate: null, platforms: { windows: true, mac: false, linux: false } }),
    );
    mockGetGameStorePrice.mockResolvedValue(
      available({ currency: 'USD', initialCents: 999, finalCents: 799, discountPercent: 20, formatted: '$7.99' }),
    );

    await refreshGameStoreData([ownedGame(220, 'Half-Life 2')]);

    expect(mockPrisma.game.upsert).toHaveBeenCalledOnce();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const call = mockPrisma.game.upsert.mock.calls[0]![0]!;
    expect(call.where).toEqual({ appId: 220 });
    // genres — JSON-encoded array
    expect(call.create.genres).toBe(JSON.stringify(['Action', 'FPS']));
    expect(call.update.genres).toBe(JSON.stringify(['Action', 'FPS']));
    // price columns
    expect(call.create.priceFinalCents).toBe(799);
    expect(call.create.priceCurrency).toBe('USD');
    expect(call.create.priceIsFree).toBe(false);
    expect(call.update.priceFinalCents).toBe(799);
    expect(call.update.priceCurrency).toBe('USD');
    expect(call.update.priceIsFree).toBe(false);
    // priceRefreshedAt must be a Date
    expect(call.create.priceRefreshedAt).toBeInstanceOf(Date);
    expect(call.update.priceRefreshedAt).toBeInstanceOf(Date);
  });

  it('upserts a free game with priceIsFree=true and null price columns', async () => {
    mockGetGameStoreMetadata.mockResolvedValue(
      available({ name: 'Dota 2', shortDescription: '', headerImage: '', genres: ['Strategy'], categories: [], categoryIds: [], developers: [], publishers: [], releaseDate: null, platforms: { windows: true, mac: false, linux: false } }),
    );
    mockGetGameStorePrice.mockResolvedValue(available(null)); // free game → available(null)

    await refreshGameStoreData([ownedGame(570, 'Dota 2')]);

    expect(mockPrisma.game.upsert).toHaveBeenCalledOnce();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const call = mockPrisma.game.upsert.mock.calls[0]![0]!;
    expect(call.create.priceIsFree).toBe(true);
    expect(call.create.priceFinalCents).toBeNull();
    expect(call.create.priceCurrency).toBeNull();
    expect(call.update.priceIsFree).toBe(true);
    expect(call.update.priceFinalCents).toBeNull();
    expect(call.update.priceCurrency).toBeNull();
  });

  it('upserts with priceIsFree=null when price is unavailable (metadata still applied if available)', async () => {
    mockGetGameStoreMetadata.mockResolvedValue(
      available({ name: 'Some Game', shortDescription: '', headerImage: '', genres: ['RPG'], categories: [], categoryIds: [], developers: [], publishers: [], releaseDate: null, platforms: { windows: true, mac: false, linux: false } }),
    );
    mockGetGameStorePrice.mockResolvedValue(unavailable('metadata-unavailable'));

    await refreshGameStoreData([ownedGame(999, 'Some Game')]);

    expect(mockPrisma.game.upsert).toHaveBeenCalledOnce();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const call = mockPrisma.game.upsert.mock.calls[0]![0]!;
    // Genres should still be written since metadata was available
    expect(call.create.genres).toBe(JSON.stringify(['RPG']));
    // Price columns reflect unavailability
    expect(call.create.priceIsFree).toBeNull();
    expect(call.create.priceFinalCents).toBeNull();
    expect(call.create.priceCurrency).toBeNull();
    expect(call.update.priceIsFree).toBeNull();
    expect(call.update.priceFinalCents).toBeNull();
    expect(call.update.priceCurrency).toBeNull();
  });

  it('writes genres=[] when metadata is unavailable', async () => {
    mockGetGameStoreMetadata.mockResolvedValue(unavailable('metadata-unavailable'));
    mockGetGameStorePrice.mockResolvedValue(unavailable('metadata-unavailable'));

    await refreshGameStoreData([ownedGame(1234, 'Mystery Game')]);

    expect(mockPrisma.game.upsert).toHaveBeenCalledOnce();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const call = mockPrisma.game.upsert.mock.calls[0]![0]!;
    expect(call.create.genres).toBe('[]');
  });

  it('processes remaining games when one game throws (best-effort)', async () => {
    // First game: getGameStoreMetadata rejects
    mockGetGameStoreMetadata
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce(
        available({ name: 'Team Fortress 2', shortDescription: '', headerImage: '', genres: ['Action'], categories: [], categoryIds: [], developers: [], publishers: [], releaseDate: null, platforms: { windows: true, mac: false, linux: false } }),
      );
    mockGetGameStorePrice
      .mockResolvedValueOnce(available(null)) // first game price (won't be reached due to metadata throw above)
      .mockResolvedValueOnce(available(null)); // second game

    await refreshGameStoreData([ownedGame(440, 'TF2'), ownedGame(440002, 'Team Fortress 2')]);

    // The second game should still be written despite the first throwing
    expect(mockPrisma.game.upsert).toHaveBeenCalledTimes(1);
  });
});
