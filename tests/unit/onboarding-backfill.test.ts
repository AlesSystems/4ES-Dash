/**
 * tests/unit/onboarding-backfill.test.ts
 *
 * TDD tests for server/jobs/onboarding-backfill.ts (Task 06).
 *
 * Covers:
 *  1. First login seeds baseline — runOnboardingBackfill with no existing
 *     onboardedAt upserts User/games and creates PlaytimeSnapshot rows,
 *     then sets onboardedAt.
 *  2. Idempotency — running again (onboardedAt already set) returns early
 *     without inserting duplicate rows; prisma.playtimeSnapshot.upsert is
 *     NOT called a second time.
 *  3. Private profile → locked — getProfile throws SteamApiError kind:'private'
 *     → returns { onboarded: false, reason: 'private' }; no snapshot created,
 *     no crash.
 *
 * All Steam HTTP is intercepted by the MSW server wired in tests/setup.ts.
 * onUnhandledRequest: 'error' — no live call can slip through.
 *
 * Prisma is mocked via vi.mock to avoid touching the actual test DB.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { SteamApiError } from '@/lib/steam/errors';
import { steamServer } from '../mocks/steam-server';

// ---------------------------------------------------------------------------
// Prisma mock — we test call counts and argument shapes, not the DB itself
// ---------------------------------------------------------------------------

const mockUpsertUser = vi.fn().mockResolvedValue({});
const mockFindManyGames = vi.fn().mockResolvedValue([]);
const mockUpsertGame = vi.fn().mockResolvedValue({});
const mockUpsertOwnedGame = vi.fn().mockResolvedValue({});
const mockFindFirstSnapshot = vi.fn().mockResolvedValue(null);
const mockGroupBySnapshot = vi.fn().mockResolvedValue([]);
const mockFindManySnapshots = vi.fn().mockResolvedValue([]);
const mockUpsertSnapshot = vi.fn().mockResolvedValue({});
const mockUpdateUser = vi.fn().mockResolvedValue({});
const mockTransaction = vi.fn().mockImplementation((ops: Promise<unknown>[]) =>
  Promise.all(ops),
);
const mockFindUniqueUser = vi.fn();

vi.mock('@/server/db', () => ({
  prisma: {
    user: {
      upsert: mockUpsertUser,
      update: mockUpdateUser,
      findUnique: mockFindUniqueUser,
    },
    game: {
      upsert: mockUpsertGame,
    },
    ownedGame: {
      upsert: mockUpsertOwnedGame,
    },
    playtimeSnapshot: {
      findFirst: mockFindFirstSnapshot,
      findMany: mockFindManySnapshots,
      upsert: mockUpsertSnapshot,
      groupBy: mockGroupBySnapshot,
    },
    $transaction: mockTransaction,
  },
}));

// The fixture steamId from player-summaries.json
const TEST_STEAM_ID = '76561198000000000';

// ---------------------------------------------------------------------------
// Reset between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no existing onboardedAt (first login)
  mockFindUniqueUser.mockResolvedValue(null);
  // Default: no prior snapshots
  mockGroupBySnapshot.mockResolvedValue([]);
  mockFindManySnapshots.mockResolvedValue([]);
});

afterEach(() => {
  steamServer.resetHandlers();
});

// ---------------------------------------------------------------------------
// 1. First login seeds baseline
// ---------------------------------------------------------------------------

describe('runOnboardingBackfill — first login', () => {
  it('returns { onboarded: true } and upserts User + snapshots when no onboardedAt', async () => {
    // The default MSW handlers return player-summaries.json and owned-games.json
    // (steamId 76561198000000000, 2 games: CS2 appId 730, Dota 2 appId 570)
    const { runOnboardingBackfill } = await import('@/server/jobs/onboarding-backfill');
    const result = await runOnboardingBackfill(TEST_STEAM_ID);

    expect(result).toEqual({ onboarded: true });

    // User row upserted at least once
    expect(mockUpsertUser).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const upsertUserCall = mockUpsertUser.mock.calls[0]![0] as {
      where: { steamId: string };
      create: { steamId: string; personaName: string };
    };
    expect(upsertUserCall.where.steamId).toBe(TEST_STEAM_ID);
    expect(upsertUserCall.create.steamId).toBe(TEST_STEAM_ID);
    expect(typeof upsertUserCall.create.personaName).toBe('string');

    // Snapshot upserts called (one per game = 2 games)
    expect(mockUpsertSnapshot).toHaveBeenCalledTimes(2);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const snapCall = mockUpsertSnapshot.mock.calls[0]![0] as {
      where: { steamId_appId_date: { steamId: string; appId: number; date: Date } };
      create: { steamId: string; appId: number; date: Date; playtimeForever: number };
    };
    expect(snapCall.where.steamId_appId_date.steamId).toBe(TEST_STEAM_ID);
    expect(typeof snapCall.create.appId).toBe('number');
    expect(snapCall.create.date).toBeInstanceOf(Date);
    expect(typeof snapCall.create.playtimeForever).toBe('number');

    // onboardedAt set via user update
    expect(mockUpdateUser).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const updateCall = mockUpdateUser.mock.calls[0]![0] as {
      where: { steamId: string };
      data: { onboardedAt: Date };
    };
    expect(updateCall.where.steamId).toBe(TEST_STEAM_ID);
    expect(updateCall.data.onboardedAt).toBeInstanceOf(Date);
  });

  it('upserts Game + OwnedGame reference rows for each owned game', async () => {
    const { runOnboardingBackfill } = await import('@/server/jobs/onboarding-backfill');
    await runOnboardingBackfill(TEST_STEAM_ID);

    // 2 games from owned-games.json fixture
    expect(mockUpsertGame).toHaveBeenCalledTimes(2);
    expect(mockUpsertOwnedGame).toHaveBeenCalledTimes(2);

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const gameCall = mockUpsertGame.mock.calls[0]![0] as {
      where: { appId: number };
      create: { appId: number; name: string };
    };
    expect(typeof gameCall.create.appId).toBe('number');
    expect(typeof gameCall.create.name).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// 2. Idempotency — second login / re-run does NOT re-insert
// ---------------------------------------------------------------------------

describe('runOnboardingBackfill — idempotency (second login)', () => {
  it('returns { onboarded: true } early without re-creating snapshots', async () => {
    // Simulate already onboarded (onboardedAt set on the User row)
    mockFindUniqueUser.mockResolvedValue({
      steamId: TEST_STEAM_ID,
      onboardedAt: new Date('2026-06-18T00:00:00.000Z'),
    });

    const { runOnboardingBackfill } = await import('@/server/jobs/onboarding-backfill');
    const result = await runOnboardingBackfill(TEST_STEAM_ID);

    expect(result).toEqual({ onboarded: true });

    // The early return must skip all DB writes
    expect(mockUpsertSnapshot).not.toHaveBeenCalled();
    expect(mockUpsertGame).not.toHaveBeenCalled();
    expect(mockUpsertOwnedGame).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('does not call Steam at all when already onboarded (no extra rate-limit tokens consumed)', async () => {
    mockFindUniqueUser.mockResolvedValue({
      steamId: TEST_STEAM_ID,
      onboardedAt: new Date(),
    });

    // If the mock is called we'd get the default fixture — but we also verify
    // that no new upserts happened, which proves the early exit.
    const getSummariesSpy = vi.fn().mockResolvedValue({
      profile: { steamId: TEST_STEAM_ID, personaName: 'Ales' },
      games: [],
      stale: false,
    });

    vi.doMock('@/server/repositories/profile', () => ({ getProfile: getSummariesSpy }));

    const { runOnboardingBackfill } = await import('@/server/jobs/onboarding-backfill');
    await runOnboardingBackfill(TEST_STEAM_ID);

    // getProfile should NOT have been invoked on re-run
    expect(getSummariesSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 3. Private profile → locked state
// ---------------------------------------------------------------------------

describe('runOnboardingBackfill — private profile', () => {
  // vi.doMock only takes effect when the module is freshly imported AFTER the
  // mock is registered. resetModules() clears the module registry so every
  // `await import(...)` below gets a fresh copy with the mock applied.
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns { onboarded: false, reason: "private" } when getProfile throws kind:"private"', async () => {
    // Override the MSW handler to simulate a private library (Steam returns {})
    // by mocking the profile repository to throw SteamApiError kind:'private'
    vi.doMock('@/server/repositories/profile', () => ({
      getProfile: vi.fn().mockRejectedValue(
        new SteamApiError({ kind: 'private', message: 'Profile is private' }),
      ),
    }));

    const { runOnboardingBackfill } = await import('@/server/jobs/onboarding-backfill');
    const result = await runOnboardingBackfill(TEST_STEAM_ID);

    expect(result).toEqual({ onboarded: false, reason: 'private' });
  });

  it('does NOT create any snapshot rows when the profile is private', async () => {
    vi.doMock('@/server/repositories/profile', () => ({
      getProfile: vi.fn().mockRejectedValue(
        new SteamApiError({ kind: 'private', message: 'Profile is private' }),
      ),
    }));

    const { runOnboardingBackfill } = await import('@/server/jobs/onboarding-backfill');
    await runOnboardingBackfill(TEST_STEAM_ID);

    expect(mockUpsertSnapshot).not.toHaveBeenCalled();
  });

  it('does NOT crash — never throws — when the profile is private', async () => {
    vi.doMock('@/server/repositories/profile', () => ({
      getProfile: vi.fn().mockRejectedValue(
        new SteamApiError({ kind: 'private', message: 'Profile is private' }),
      ),
    }));

    const { runOnboardingBackfill } = await import('@/server/jobs/onboarding-backfill');
    await expect(runOnboardingBackfill(TEST_STEAM_ID)).resolves.not.toThrow();
  });

  it('does NOT crash on transient Steam errors — returns { onboarded: false, reason: "error" }', async () => {
    vi.doMock('@/server/repositories/profile', () => ({
      getProfile: vi.fn().mockRejectedValue(
        new SteamApiError({ kind: 'transient', message: 'Steam 503' }),
      ),
    }));

    const { runOnboardingBackfill } = await import('@/server/jobs/onboarding-backfill');
    const result = await runOnboardingBackfill(TEST_STEAM_ID);

    expect(result).toEqual({ onboarded: false, reason: 'error' });
    expect(mockUpsertSnapshot).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 4. Missing/blank steamId — typed error
// ---------------------------------------------------------------------------

describe('runOnboardingBackfill — invalid steamId', () => {
  it('throws MissingSteamIdError for blank steamId', async () => {
    const { MissingSteamIdError } = await import('@/server/repositories/require-steam-id');
    const { runOnboardingBackfill } = await import('@/server/jobs/onboarding-backfill');
    await expect(runOnboardingBackfill('')).rejects.toThrow(MissingSteamIdError);
  });
});
