import { describe, expect, it, vi, beforeEach } from 'vitest';
import { available, unavailable } from '@/lib/result';

// ---------------------------------------------------------------------------
// Module mocks — must be declared before importing the module under test.
// ---------------------------------------------------------------------------

vi.mock('@/server/repositories/profile');
vi.mock('@/server/repositories/store');

import { getProfile } from '@/server/repositories/profile';
import { getGameStorePrice } from '@/server/repositories/store';
import { getLibraryValue } from '@/server/repositories/library-value';
import type { OwnedGame } from '@/lib/steam/schemas';

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------

const mockGetProfile = vi.mocked(getProfile);
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
// Tests
// ---------------------------------------------------------------------------

describe('getLibraryValue', () => {
  it('sums finalCents across priced games', async () => {
    mockGetProfile.mockResolvedValue({
      profile: {} as never,
      games: [ownedGame(1), ownedGame(2)],
      stale: false,
    });

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

    const result = await getLibraryValue();

    expect(result.totalMinor).toBe(3498); // 2999 + 499
    expect(result.pricedCount).toBe(2);
    expect(result.currency).toBe('USD');
    expect(result.freeCount).toBe(0);
    expect(result.missingCount).toBe(0);
    expect(result.stale).toBe(false);
  });

  it('counts free games (available(null)) without inflating the total', async () => {
    mockGetProfile.mockResolvedValue({
      profile: {} as never,
      games: [ownedGame(1), ownedGame(2)],
      stale: false,
    });

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

    const result = await getLibraryValue();

    expect(result.totalMinor).toBe(999); // free game contributes 0
    expect(result.pricedCount).toBe(1);
    expect(result.freeCount).toBe(1);
    expect(result.missingCount).toBe(0);
  });

  it('counts unavailable prices as missingCount, contributes 0, does not throw', async () => {
    mockGetProfile.mockResolvedValue({
      profile: {} as never,
      games: [ownedGame(1), ownedGame(2)],
      stale: false,
    });

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

    const result = await getLibraryValue();

    expect(result.totalMinor).toBe(1499);
    expect(result.pricedCount).toBe(1);
    expect(result.missingCount).toBe(1);
    expect(result.freeCount).toBe(0);
    expect(Number.isNaN(result.totalMinor)).toBe(false);
  });

  it('captures currency from the first priced game', async () => {
    mockGetProfile.mockResolvedValue({
      profile: {} as never,
      games: [ownedGame(1), ownedGame(2), ownedGame(3)],
      stale: false,
    });

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

    const result = await getLibraryValue();

    // First priced result is GBP (index 1 — index 0 was unavailable)
    expect(result.currency).toBe('GBP');
  });

  it('propagates stale flag when any price result is stale', async () => {
    mockGetProfile.mockResolvedValue({
      profile: {} as never,
      games: [ownedGame(1), ownedGame(2)],
      stale: false,
    });

    mockGetGameStorePrice
      .mockResolvedValueOnce(
        available(
          {
            currency: 'USD',
            initialCents: 999,
            finalCents: 999,
            discountPercent: 0,
            formatted: '$9.99',
          },
          true /* stale */,
        ),
      )
      .mockResolvedValueOnce(
        available(
          {
            currency: 'USD',
            initialCents: 499,
            finalCents: 499,
            discountPercent: 0,
            formatted: '$4.99',
          },
          false,
        ),
      );

    const result = await getLibraryValue();

    expect(result.stale).toBe(true);
  });

  it('returns zero total and empty currency when all games are free or unavailable', async () => {
    mockGetProfile.mockResolvedValue({
      profile: {} as never,
      games: [ownedGame(1), ownedGame(2)],
      stale: false,
    });

    mockGetGameStorePrice
      .mockResolvedValueOnce(available(null)) // free
      .mockResolvedValueOnce(unavailable('metadata-unavailable')); // missing

    const result = await getLibraryValue();

    expect(result.totalMinor).toBe(0);
    expect(result.currency).toBe('');
    expect(result.pricedCount).toBe(0);
    expect(result.freeCount).toBe(1);
    expect(result.missingCount).toBe(1);
    expect(Number.isNaN(result.totalMinor)).toBe(false);
  });

  it('returns zero total for an empty library', async () => {
    mockGetProfile.mockResolvedValue({
      profile: {} as never,
      games: [],
      stale: false,
    });

    const result = await getLibraryValue();

    expect(result.totalMinor).toBe(0);
    expect(result.pricedCount).toBe(0);
    expect(result.freeCount).toBe(0);
    expect(result.missingCount).toBe(0);
    expect(result.currency).toBe('');
    expect(result.stale).toBe(false);
  });
});
