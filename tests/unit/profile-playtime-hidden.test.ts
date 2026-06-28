/**
 * tests/unit/profile-playtime-hidden.test.ts
 *
 * Red-first tests for AC1 + AC2 (bug-02):
 * - getProfile returns playtimeHidden=true when all total===0 AND some lastPlayed!==null
 * - getProfile returns playtimeHidden=false for genuinely new accounts (all lastPlayed===null)
 * - playtimeHidden=false when any game has total>0
 * - playtimeHidden=false for empty library
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Steam at the lib boundary — never hit the network.
const mockGetPlayerSummaries = vi.fn();
const mockGetOwnedGames = vi.fn();

vi.mock('@/lib/steam', () => ({
  getPlayerSummaries: (...args: unknown[]) => mockGetPlayerSummaries(...args),
  getOwnedGames: (...args: unknown[]) => mockGetOwnedGames(...args),
}));

// Mock cache to pass through the loader directly (no cache layer).
vi.mock('@/server/cache', () => ({
  cache: (_key: string, _ttl: number, loader: () => unknown) => loader(),
  cacheKey: (...parts: string[]) => parts.join(':'),
  TTL: { playerSummaries: 300, ownedGames: 300 },
}));

import { getProfile } from '@/server/repositories/profile';

const STEAM_ID = '76561198000000000';

const mockProfile = {
  steamId: STEAM_ID,
  personaName: 'TestUser',
  avatar: { small: '', medium: '', full: '' },
  profileUrl: '',
  createdAt: null,
  countryCode: null,
};

function makeSummary() {
  return { value: mockProfile, stale: false };
}

function makeGames(
  entries: Array<{ total: number; lastPlayed: string | null }>,
) {
  return {
    value: entries.map((e, i) => ({
      appId: 100 + i,
      name: `Game ${i}`,
      iconUrl: null,
      headerUrl: '',
      playtime: { total: e.total, twoWeeks: 0 },
      lastPlayed: e.lastPlayed,
      hasAchievements: false,
    })),
    stale: false,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetPlayerSummaries.mockResolvedValue(makeSummary());
});

describe('getProfile — playtimeHidden (bug-02)', () => {
  it('is true when all total===0 AND at least one lastPlayed is non-null (privacy-hidden)', async () => {
    mockGetOwnedGames.mockResolvedValue(
      makeGames([
        { total: 0, lastPlayed: '2024-01-01T00:00:00.000Z' },
        { total: 0, lastPlayed: null },
      ]),
    );
    const result = await getProfile(STEAM_ID);
    expect(result.playtimeHidden).toBe(true);
  });

  it('is false when any game has total > 0 (real playtime present)', async () => {
    mockGetOwnedGames.mockResolvedValue(
      makeGames([
        { total: 120, lastPlayed: '2024-01-01T00:00:00.000Z' },
        { total: 0, lastPlayed: null },
      ]),
    );
    const result = await getProfile(STEAM_ID);
    expect(result.playtimeHidden).toBe(false);
  });

  it('is false when all total===0 AND all lastPlayed===null (genuinely new account, not flagged)', async () => {
    mockGetOwnedGames.mockResolvedValue(
      makeGames([
        { total: 0, lastPlayed: null },
        { total: 0, lastPlayed: null },
      ]),
    );
    const result = await getProfile(STEAM_ID);
    expect(result.playtimeHidden).toBe(false);
  });

  it('is false for an empty library', async () => {
    mockGetOwnedGames.mockResolvedValue(makeGames([]));
    const result = await getProfile(STEAM_ID);
    expect(result.playtimeHidden).toBe(false);
  });
});
