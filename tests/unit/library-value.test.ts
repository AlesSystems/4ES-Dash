import { describe, expect, it, vi, beforeEach } from 'vitest';
import { available, unavailable } from '@/lib/result';

// ---------------------------------------------------------------------------
// Module mocks — must be declared before importing the module under test.
// ---------------------------------------------------------------------------

vi.mock('@/server/repositories/store');

const mockPrisma = vi.hoisted(() => ({
  libraryValueAggregate: { findUnique: vi.fn(), upsert: vi.fn() },
}));
vi.mock('@/server/db', () => ({ prisma: mockPrisma }));

import { getGameStorePrice } from '@/server/repositories/store';
import {
  getLibraryValue,
  refreshLibraryValueAggregate,
} from '@/server/repositories/library-value';
import type { OwnedGame } from '@/lib/steam/schemas';

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------

const mockGetGameStorePrice = vi.mocked(getGameStorePrice);

/** OwnedGame stub — only appId is read by the aggregator; the rest satisfies the type. */
function ownedGame(appId: number): OwnedGame {
  return {
    appId,
    name: `Game ${appId}`,
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
// getLibraryValue — READS the pre-computed aggregate (no Store pricing) (#85)
// ---------------------------------------------------------------------------

describe('getLibraryValue (reads aggregate, no live pricing)', () => {
  it('maps the aggregate row to a LibraryValue when present', async () => {
    mockPrisma.libraryValueAggregate.findUnique.mockResolvedValue({
      steamId: '76561198000000000',
      totalMinor: 3498,
      currency: 'USD',
      pricedCount: 2,
      freeCount: 1,
      missingCount: 0,
      computedAt: new Date(),
    });

    const result = await getLibraryValue('76561198000000000');

    expect(result.available).toBe(true);
    if (!result.available) throw new Error('expected available');
    expect(result.data.totalMinor).toBe(3498);
    expect(result.data.currency).toBe('USD');
    expect(result.data.pricedCount).toBe(2);
    expect(result.data.freeCount).toBe(1);
    // Reading the aggregate must NOT price any game live.
    expect(mockGetGameStorePrice).not.toHaveBeenCalled();
  });

  it('returns unavailable("not-tracked") when no aggregate row exists yet', async () => {
    mockPrisma.libraryValueAggregate.findUnique.mockResolvedValue(null);

    const result = await getLibraryValue('76561198000000000');

    expect(result.available).toBe(false);
    if (result.available) throw new Error('expected unavailable');
    expect(result.reason).toBe('not-tracked');
    expect(mockGetGameStorePrice).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// refreshLibraryValueAggregate — JOB-side live pricing + upsert
// ---------------------------------------------------------------------------

describe('refreshLibraryValueAggregate (job-side, prices live + upserts)', () => {
  it('sums finalCents across priced games and upserts the row', async () => {
    mockGetGameStorePrice
      .mockResolvedValueOnce(
        available({
          currency: 'USD',
          initialCents: 2999,
          finalCents: 2999,
          discountPercent: 0,
          formatted: '$29.99',
        }),
      )
      .mockResolvedValueOnce(
        available({
          currency: 'USD',
          initialCents: 999,
          finalCents: 499,
          discountPercent: 50,
          formatted: '$4.99',
        }),
      );

    const result = await refreshLibraryValueAggregate('76561198000000000', [
      ownedGame(1),
      ownedGame(2),
    ]);

    expect(result.totalMinor).toBe(3498); // 2999 + 499
    expect(result.pricedCount).toBe(2);
    expect(result.currency).toBe('USD');
    expect(result.freeCount).toBe(0);
    expect(result.missingCount).toBe(0);
    expect(result.stale).toBe(false);
    expect(mockPrisma.libraryValueAggregate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { steamId: '76561198000000000' } }),
    );
  });

  it('counts free games (available(null)) without inflating the total', async () => {
    mockGetGameStorePrice
      .mockResolvedValueOnce(
        available({
          currency: 'USD',
          initialCents: 999,
          finalCents: 999,
          discountPercent: 0,
          formatted: '$9.99',
        }),
      )
      .mockResolvedValueOnce(available(null)); // free game

    const result = await refreshLibraryValueAggregate('76561198000000000', [
      ownedGame(1),
      ownedGame(2),
    ]);

    expect(result.totalMinor).toBe(999);
    expect(result.pricedCount).toBe(1);
    expect(result.freeCount).toBe(1);
    expect(result.missingCount).toBe(0);
  });

  it('counts unavailable prices as missingCount, contributes 0, does not throw', async () => {
    mockGetGameStorePrice
      .mockResolvedValueOnce(
        available({
          currency: 'EUR',
          initialCents: 1499,
          finalCents: 1499,
          discountPercent: 0,
          formatted: '€14.99',
        }),
      )
      .mockResolvedValueOnce(unavailable('metadata-unavailable'));

    const result = await refreshLibraryValueAggregate('76561198000000000', [
      ownedGame(1),
      ownedGame(2),
    ]);

    expect(result.totalMinor).toBe(1499);
    expect(result.pricedCount).toBe(1);
    expect(result.missingCount).toBe(1);
    expect(result.freeCount).toBe(0);
    expect(Number.isNaN(result.totalMinor)).toBe(false);
  });

  it('captures currency from the first priced game', async () => {
    mockGetGameStorePrice
      .mockResolvedValueOnce(unavailable('metadata-unavailable')) // skipped — unavailable
      .mockResolvedValueOnce(
        available({
          currency: 'GBP',
          initialCents: 799,
          finalCents: 799,
          discountPercent: 0,
          formatted: '£7.99',
        }),
      )
      .mockResolvedValueOnce(
        available({
          currency: 'USD',
          initialCents: 1999,
          finalCents: 1999,
          discountPercent: 0,
          formatted: '$19.99',
        }),
      );

    const result = await refreshLibraryValueAggregate('76561198000000000', [
      ownedGame(1),
      ownedGame(2),
      ownedGame(3),
    ]);

    expect(result.currency).toBe('GBP');
  });

  it('propagates stale flag when any price result is stale', async () => {
    mockGetGameStorePrice
      .mockResolvedValueOnce(
        available(
          { currency: 'USD', initialCents: 999, finalCents: 999, discountPercent: 0, formatted: '$9.99' },
          true /* stale */,
        ),
      )
      .mockResolvedValueOnce(
        available(
          { currency: 'USD', initialCents: 499, finalCents: 499, discountPercent: 0, formatted: '$4.99' },
          false,
        ),
      );

    const result = await refreshLibraryValueAggregate('76561198000000000', [
      ownedGame(1),
      ownedGame(2),
    ]);

    expect(result.stale).toBe(true);
  });

  it('returns zero total and empty currency when all games are free or unavailable', async () => {
    mockGetGameStorePrice
      .mockResolvedValueOnce(available(null)) // free
      .mockResolvedValueOnce(unavailable('metadata-unavailable')); // missing

    const result = await refreshLibraryValueAggregate('76561198000000000', [
      ownedGame(1),
      ownedGame(2),
    ]);

    expect(result.totalMinor).toBe(0);
    expect(result.currency).toBe('');
    expect(result.pricedCount).toBe(0);
    expect(result.freeCount).toBe(1);
    expect(result.missingCount).toBe(1);
    expect(Number.isNaN(result.totalMinor)).toBe(false);
  });

  it('returns zero total for an empty library and still upserts', async () => {
    const result = await refreshLibraryValueAggregate('76561198000000000', []);

    expect(result.totalMinor).toBe(0);
    expect(result.pricedCount).toBe(0);
    expect(result.freeCount).toBe(0);
    expect(result.missingCount).toBe(0);
    expect(result.currency).toBe('');
    expect(result.stale).toBe(false);
    expect(mockGetGameStorePrice).not.toHaveBeenCalled();
    expect(mockPrisma.libraryValueAggregate.upsert).toHaveBeenCalled();
  });
});
