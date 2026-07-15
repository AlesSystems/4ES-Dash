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

  it('persists categoryIds alongside genres for available metadata', async () => {
    mockGetGameStoreMetadata.mockResolvedValue(
      available({ name: 'Portal 2', shortDescription: '', headerImage: '', genres: ['Puzzle'], categories: ['Multi-player', 'Co-op'], categoryIds: [1, 36], developers: [], publishers: [], releaseDate: null, platforms: { windows: true, mac: false, linux: false } }),
    );
    mockGetGameStorePrice.mockResolvedValue(available(null));

    await refreshGameStoreData([ownedGame(620, 'Portal 2')]);

    expect(mockPrisma.game.upsert).toHaveBeenCalledOnce();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const call = mockPrisma.game.upsert.mock.calls[0]![0]!;
    // categoryIds — JSON-encoded number array, written on both branches
    expect(call.create.categoryIds).toBe(JSON.stringify([1, 36]));
    expect(call.update.categoryIds).toBe(JSON.stringify([1, 36]));
    // genres persistence is unchanged by the categoryIds addition (ERR-0011)
    expect(call.create.genres).toBe(JSON.stringify(['Puzzle']));
    expect(call.update.genres).toBe(JSON.stringify(['Puzzle']));
  });

  it('leaves categoryIds untouched when metadata is unavailable', async () => {
    mockGetGameStoreMetadata.mockResolvedValue(unavailable('metadata-unavailable'));
    mockGetGameStorePrice.mockResolvedValue(unavailable('metadata-unavailable'));

    await refreshGameStoreData([ownedGame(4321, 'Unreachable Game')]);

    expect(mockPrisma.game.upsert).toHaveBeenCalledOnce();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const call = mockPrisma.game.upsert.mock.calls[0]![0]!;
    // update OMITS the field entirely — a pre-seeded value survives the pass
    // (last-known-good). Writing anything here would clobber it.
    expect('categoryIds' in call.update).toBe(false);
    // a never-seen game is created with null (never categorized), NEVER '[]' —
    // '[]' is a positive "no multiplayer categories" classification and would
    // fabricate a non-multiplayer verdict from missing data.
    expect(call.create.categoryIds).toBeNull();
    expect(call.create.categoryIds).not.toBe('[]');
  });

  it('adds no extra Store calls', async () => {
    // Regression tripwire (green throughout): persisting categoryIds must ride
    // the metadata result the pass already holds — exactly one
    // getGameStoreMetadata call per game, zero added limiter pressure.
    mockGetGameStoreMetadata.mockResolvedValue(
      available({ name: 'Any', shortDescription: '', headerImage: '', genres: [], categories: [], categoryIds: [1], developers: [], publishers: [], releaseDate: null, platforms: { windows: true, mac: false, linux: false } }),
    );
    mockGetGameStorePrice.mockResolvedValue(available(null));

    const games = [ownedGame(10), ownedGame(20), ownedGame(30)];
    await refreshGameStoreData(games);

    expect(mockGetGameStoreMetadata).toHaveBeenCalledTimes(games.length);
  });

  it('is idempotent — a second run on the same input writes identical rows', async () => {
    mockGetGameStoreMetadata.mockResolvedValue(
      available({ name: 'Portal 2', shortDescription: '', headerImage: '', genres: ['Puzzle'], categories: ['Multi-player'], categoryIds: [1, 36], developers: [], publishers: [], releaseDate: null, platforms: { windows: true, mac: false, linux: false } }),
    );
    mockGetGameStorePrice.mockResolvedValue(available(null));

    await refreshGameStoreData([ownedGame(620, 'Portal 2')]);
    await refreshGameStoreData([ownedGame(620, 'Portal 2')]);

    expect(mockPrisma.game.upsert).toHaveBeenCalledTimes(2);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const first = mockPrisma.game.upsert.mock.calls[0]![0]!;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const second = mockPrisma.game.upsert.mock.calls[1]![0]!;
    // Identical rows modulo the refresh timestamp.
    const strip = (args: { create: Record<string, unknown>; update: Record<string, unknown> }) => ({
      create: { ...args.create, priceRefreshedAt: undefined },
      update: { ...args.update, priceRefreshedAt: undefined },
    });
    expect(strip(second)).toEqual(strip(first));
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
