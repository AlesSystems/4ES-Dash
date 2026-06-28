/**
 * tests/unit/account-settings.test.ts
 *
 * TDD tests for Task 08 — privacy controls + account settings.
 *
 * Covers:
 *  1. Privacy enforcement: friends-only hides from a non-friend (reuse canViewProfile)
 *  2. setPrivacy persists the chosen level ONLY for the session user (not another user)
 *  3. deleteAccountData removes ALL rows for a steamId across every table, atomically
 *  4. Re-sync idempotency: runOnboardingBackfill(steamId, { force: true }) twice → no duplicates
 *  5. Friends-only fail-closed when friends list is unavailable
 *
 * Mock architecture:
 *  - One top-level vi.mock for @/server/db (hoisted) with ALL prisma model methods needed
 *    across all tests — stable spy references that persist even after vi.resetModules().
 *  - vi.resetModules() in beforeEach for sections that need fresh module imports.
 *  - vi.doMock() for per-test overrides of other modules (auth, profile, friends).
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { SteamApiError } from '@/lib/steam/errors';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEAM_A = '76561198000000001';
const STEAM_B = '76561198000000002';
const STEAM_C = '76561198000000003';

// ---------------------------------------------------------------------------
// Stable top-level spy references — used across all test sections.
// All are declared at module scope so they survive vi.resetModules().
// ---------------------------------------------------------------------------

// --- Transaction delete spies (section 2) ---
const deleteSpies = {
  playtimeSnapshot: vi.fn().mockResolvedValue({ count: 0 }),
  achievementSnapshot: vi.fn().mockResolvedValue({ count: 0 }),
  ownedGame: vi.fn().mockResolvedValue({ count: 0 }),
  manualGameData: vi.fn().mockResolvedValue({ count: 0 }),
  idleDismissal: vi.fn().mockResolvedValue({ count: 0 }),
  userDelete: vi.fn().mockResolvedValue({}),
};

// --- User CRUD spies (sections 3 & 5) ---
const mockUpdateUser = vi.fn().mockResolvedValue({});
const mockFindUniqueUser = vi.fn().mockResolvedValue(null);
const mockUpsertUser = vi.fn().mockResolvedValue({});

// --- Other model spies (section 5 — backfill) ---
const mockUpsertGame = vi.fn().mockResolvedValue({});
const mockUpsertOwnedGame = vi.fn().mockResolvedValue({});
const mockUpsertSnapshot = vi.fn().mockResolvedValue({});

// --- $transaction spy ---
// Supports both callback-style (deleteAccountData) and array-style (backfill unused here)
const mockTransaction = vi.fn().mockImplementation(async (arg: unknown) => {
  if (typeof arg === 'function') {
    const tx = {
      playtimeSnapshot: {
        deleteMany: deleteSpies.playtimeSnapshot,
        upsert: mockUpsertSnapshot,
      },
      achievementSnapshot: { deleteMany: deleteSpies.achievementSnapshot },
      ownedGame: { deleteMany: deleteSpies.ownedGame, upsert: mockUpsertOwnedGame },
      manualGameData: { deleteMany: deleteSpies.manualGameData },
      idleDismissal: { deleteMany: deleteSpies.idleDismissal },
      game: { upsert: mockUpsertGame },
      user: { delete: deleteSpies.userDelete, upsert: mockUpsertUser, update: mockUpdateUser },
    };
    return (arg as (tx: unknown) => Promise<void>)(tx);
  }
  if (Array.isArray(arg)) return Promise.all(arg as Promise<unknown>[]);
  return arg;
});

// Top-level vi.mock — hoisted by Vitest; runs before any test code.
// Must include every prisma model method used across all test sections.
vi.mock('@/server/db', () => ({
  prisma: {
    user: {
      update: mockUpdateUser,
      findUnique: mockFindUniqueUser,
      upsert: mockUpsertUser,
    },
    game: { upsert: mockUpsertGame },
    ownedGame: { upsert: mockUpsertOwnedGame },
    playtimeSnapshot: { upsert: mockUpsertSnapshot },
    $transaction: mockTransaction,
  },
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

// ===========================================================================
// 1. Privacy enforcement — friends-only hides from a non-friend
// ===========================================================================

describe('Privacy enforcement — friends-only', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false for a non-friend viewer when privacy is friendsOnly', async () => {
    vi.doMock('@/lib/steam/friends', () => ({
      getFriendList: vi.fn().mockResolvedValue([
        { steamId: STEAM_C, relationship: 'friend', friendSince: 1600000000 },
      ]),
    }));
    const { canViewProfile } = await import('@/server/authz');
    const result = await canViewProfile(STEAM_A, { steamId: STEAM_B, privacy: 'friendsOnly' });
    expect(result).toBe(false);
  });

  it('returns true for a friend viewer when privacy is friendsOnly', async () => {
    vi.doMock('@/lib/steam/friends', () => ({
      getFriendList: vi.fn().mockResolvedValue([
        { steamId: STEAM_C, relationship: 'friend', friendSince: 1600000000 },
      ]),
    }));
    const { canViewProfile } = await import('@/server/authz');
    const result = await canViewProfile(STEAM_C, { steamId: STEAM_B, privacy: 'friendsOnly' });
    expect(result).toBe(true);
  });

  it('returns false (fail-closed) when friends list is unavailable — private friend list', async () => {
    vi.doMock('@/lib/steam/friends', () => ({
      getFriendList: vi.fn().mockRejectedValue(
        new SteamApiError({ kind: 'private', message: 'Friend list is not public' }),
      ),
    }));
    const { canViewProfile } = await import('@/server/authz');
    const result = await canViewProfile(STEAM_A, { steamId: STEAM_B, privacy: 'friendsOnly' });
    expect(result).toBe(false);
  });

  it('returns false (fail-closed) when friends list fetch throws transient error', async () => {
    vi.doMock('@/lib/steam/friends', () => ({
      getFriendList: vi.fn().mockRejectedValue(
        new SteamApiError({ kind: 'transient', message: 'Steam 503' }),
      ),
    }));
    const { canViewProfile } = await import('@/server/authz');
    const result = await canViewProfile(STEAM_A, { steamId: STEAM_B, privacy: 'friendsOnly' });
    expect(result).toBe(false);
  });
});

// ===========================================================================
// 2. deleteAccountData — removes all rows for a steamId atomically
// ===========================================================================

describe('deleteAccountData — removes all rows atomically', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-apply resolved values after clearAllMocks
    deleteSpies.playtimeSnapshot.mockResolvedValue({ count: 0 });
    deleteSpies.achievementSnapshot.mockResolvedValue({ count: 0 });
    deleteSpies.ownedGame.mockResolvedValue({ count: 0 });
    deleteSpies.manualGameData.mockResolvedValue({ count: 0 });
    deleteSpies.idleDismissal.mockResolvedValue({ count: 0 });
    deleteSpies.userDelete.mockResolvedValue({});
    mockTransaction.mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') {
        const tx = {
          playtimeSnapshot: { deleteMany: deleteSpies.playtimeSnapshot },
          achievementSnapshot: { deleteMany: deleteSpies.achievementSnapshot },
          ownedGame: { deleteMany: deleteSpies.ownedGame },
          manualGameData: { deleteMany: deleteSpies.manualGameData },
          idleDismissal: { deleteMany: deleteSpies.idleDismissal },
          user: { delete: deleteSpies.userDelete, upsert: mockUpsertUser, update: mockUpdateUser },
        };
        return (arg as (tx: unknown) => Promise<void>)(tx);
      }
      if (Array.isArray(arg)) return Promise.all(arg as Promise<unknown>[]);
      return arg;
    });
  });

  it('calls $transaction and deletes all child tables before the User row', async () => {
    const { deleteAccountData } = await import('@/server/repositories/account');
    await deleteAccountData(STEAM_A);

    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(deleteSpies.playtimeSnapshot).toHaveBeenCalledWith({ where: { steamId: STEAM_A } });
    expect(deleteSpies.achievementSnapshot).toHaveBeenCalledWith({ where: { steamId: STEAM_A } });
    expect(deleteSpies.ownedGame).toHaveBeenCalledWith({ where: { steamId: STEAM_A } });
    expect(deleteSpies.manualGameData).toHaveBeenCalledWith({ where: { steamId: STEAM_A } });
    expect(deleteSpies.idleDismissal).toHaveBeenCalledWith({ where: { steamId: STEAM_A } });
    expect(deleteSpies.userDelete).toHaveBeenCalledWith({ where: { steamId: STEAM_A } });
  });

  it('does NOT touch rows belonging to a different steamId', async () => {
    const { deleteAccountData } = await import('@/server/repositories/account');
    await deleteAccountData(STEAM_A);

    for (const spy of [
      deleteSpies.playtimeSnapshot,
      deleteSpies.achievementSnapshot,
      deleteSpies.ownedGame,
      deleteSpies.manualGameData,
      deleteSpies.idleDismissal,
    ]) {
      const calls = spy.mock.calls as Array<[{ where: { steamId: string } }]>;
      for (const [args] of calls) {
        expect(args?.where?.steamId).toBe(STEAM_A);
        expect(args?.where?.steamId).not.toBe(STEAM_B);
      }
    }
  });

  it('throws MissingSteamIdError for a blank steamId', async () => {
    const { deleteAccountData } = await import('@/server/repositories/account');
    const { MissingSteamIdError } = await import('@/server/repositories/require-steam-id');
    await expect(deleteAccountData('')).rejects.toThrow(MissingSteamIdError);
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// 3. setPrivacy action — persists level ONLY for the session user
// ===========================================================================

describe('setPrivacy action — persists to session user only', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockUpdateUser.mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls prisma.user.update with the session steamId and the chosen privacy level', async () => {
    vi.doMock('@/server/auth', () => ({
      getSessionUser: vi.fn().mockResolvedValue({ steamId: STEAM_A }),
    }));

    const { setPrivacy } = await import('@/app/settings/actions');
    await setPrivacy('public');

    expect(mockUpdateUser).toHaveBeenCalledOnce();
    const call = mockUpdateUser.mock.calls[0]![0] as {
      where: { steamId: string };
      data: { privacy: string };
    };
    expect(call.where.steamId).toBe(STEAM_A);
    expect(call.data.privacy).toBe('public');
  });

  it('does NOT use a hardcoded or different steamId — cannot set another user privacy', async () => {
    vi.doMock('@/server/auth', () => ({
      getSessionUser: vi.fn().mockResolvedValue({ steamId: STEAM_A }),
    }));

    const { setPrivacy } = await import('@/app/settings/actions');
    await setPrivacy('private');

    const call = mockUpdateUser.mock.calls[0]![0] as {
      where: { steamId: string };
      data: { privacy: string };
    };
    expect(call.where.steamId).not.toBe(STEAM_B);
    expect(call.where.steamId).toBe(STEAM_A);
  });

  it('rejects an invalid privacy level with a ZodError-like failure', async () => {
    vi.doMock('@/server/auth', () => ({
      getSessionUser: vi.fn().mockResolvedValue({ steamId: STEAM_A }),
    }));

    const { setPrivacy } = await import('@/app/settings/actions');
    await expect(setPrivacy('admin' as 'public' | 'friendsOnly' | 'private')).rejects.toThrow();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('throws when no session user is found', async () => {
    vi.doMock('@/server/auth', () => ({
      getSessionUser: vi.fn().mockResolvedValue(null),
    }));

    const { setPrivacy } = await import('@/app/settings/actions');
    await expect(setPrivacy('public')).rejects.toThrow();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// 4. resyncNow action — calls runOnboardingBackfill with force: true
// ===========================================================================

describe('resyncNow action — force re-sync', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns an OnboardingResult and calls resyncAccount WITH the achievement limit', async () => {
    const mockResyncAccount = vi.fn().mockResolvedValue({ onboarded: true });
    vi.doMock('@/server/auth', () => ({
      getSessionUser: vi.fn().mockResolvedValue({ steamId: STEAM_A }),
    }));
    // Mock through the account repository — never mock onboarding-backfill directly
    // to avoid polluting the mock registry for section 5.
    vi.doMock('@/server/repositories/account', () => ({
      deleteAccountData: vi.fn(),
      resyncAccount: mockResyncAccount,
    }));

    const { resyncNow } = await import('@/app/settings/actions');
    const result = await resyncNow();

    // (a) returns a non-void OnboardingResult
    expect(result).toBeDefined();
    expect(result).toMatchObject({ onboarded: expect.any(Boolean) });

    // (b) calls resyncAccount with steamId AND a numeric achievement limit
    expect(mockResyncAccount).toHaveBeenCalledOnce();
    const call = mockResyncAccount.mock.calls[0] as [string, number];
    expect(call[0]).toBe(STEAM_A);
    expect(typeof call[1]).toBe('number');
    expect(call[1]).toBeGreaterThan(0);
  });

  it('throws when no session user is found', async () => {
    vi.doMock('@/server/auth', () => ({
      getSessionUser: vi.fn().mockResolvedValue(null),
    }));

    const { resyncNow } = await import('@/app/settings/actions');
    await expect(resyncNow()).rejects.toThrow();
  });
});

// ===========================================================================
// 5. Re-sync idempotency — force flag bypasses onboardedAt guard
//
// Uses the top-level vi.mock for @/server/db (still active after resetModules).
// Controls findUnique via mockFindUniqueUser; controls getProfile via vi.doMock.
// ===========================================================================

describe('runOnboardingBackfill — force re-sync bypasses onboardedAt guard', () => {
  beforeEach(() => {
    vi.resetModules();
    // Cancel the vi.doMock('@/server/jobs/onboarding-backfill') registered by the
    // resyncNow section above. vi.resetModules() clears the module cache but NOT
    // the mock registry — vi.unmock() cancels the registration so the next
    // import('@/server/jobs/onboarding-backfill') gets the real module.
    vi.unmock('@/server/jobs/onboarding-backfill');
    vi.clearAllMocks();
    // Re-apply resolved values after clearAllMocks
    mockFindUniqueUser.mockResolvedValue(null);
    mockUpsertUser.mockResolvedValue({});
    mockUpsertGame.mockResolvedValue({});
    mockUpsertOwnedGame.mockResolvedValue({});
    mockUpsertSnapshot.mockResolvedValue({});
    mockUpdateUser.mockResolvedValue({});
    // Re-apply $transaction implementation (clearAllMocks wipes it)
    mockTransaction.mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') {
        const tx = {
          playtimeSnapshot: { deleteMany: deleteSpies.playtimeSnapshot, upsert: mockUpsertSnapshot },
          achievementSnapshot: { deleteMany: deleteSpies.achievementSnapshot },
          ownedGame: { deleteMany: deleteSpies.ownedGame, upsert: mockUpsertOwnedGame },
          manualGameData: { deleteMany: deleteSpies.manualGameData },
          idleDismissal: { deleteMany: deleteSpies.idleDismissal },
          game: { upsert: mockUpsertGame },
          user: { delete: deleteSpies.userDelete, upsert: mockUpsertUser, update: mockUpdateUser },
        };
        return (arg as (tx: unknown) => Promise<void>)(tx);
      }
      if (Array.isArray(arg)) return Promise.all(arg as Promise<unknown>[]);
      return arg;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('with force:true, does NOT early-return even if onboardedAt is set', async () => {
    // Without force: user already onboarded → early return
    mockFindUniqueUser.mockResolvedValue({
      steamId: STEAM_A,
      onboardedAt: new Date('2026-06-01T00:00:00.000Z'),
    });

    vi.doMock('@/server/repositories/profile', () => ({
      getProfile: vi.fn().mockResolvedValue({
        profile: {
          steamId: STEAM_A,
          personaName: 'Tester',
          avatar: { full: 'https://avatars.steamstatic.com/test.jpg' },
          countryCode: null,
          createdAt: new Date().toISOString(),
        },
        games: [
          {
            appId: 730,
            name: 'CS2',
            iconUrl: null,
            hasAchievements: false,
            playtime: { total: 1000, twoWeeks: 0 },
            lastPlayed: null,
          },
        ],
      }),
    }));

    const { runOnboardingBackfill } = await import('@/server/jobs/onboarding-backfill');

    // Without force: early returns because onboardedAt is set
    const resultNoForce = await runOnboardingBackfill(STEAM_A);
    expect(resultNoForce).toEqual({ onboarded: true });
    expect(mockUpsertUser).not.toHaveBeenCalled(); // early return — no upserts

    vi.clearAllMocks();
    // Re-apply resolved values after clearAllMocks
    mockFindUniqueUser.mockResolvedValue({
      steamId: STEAM_A,
      onboardedAt: new Date('2026-06-01T00:00:00.000Z'),
    });
    mockUpsertUser.mockResolvedValue({});
    mockUpsertGame.mockResolvedValue({});
    mockUpsertOwnedGame.mockResolvedValue({});
    mockUpsertSnapshot.mockResolvedValue({});
    mockUpdateUser.mockResolvedValue({});

    // With force: true, should run full backfill even though onboardedAt is set
    const resultForce = await runOnboardingBackfill(STEAM_A, { force: true });
    expect(resultForce).toEqual({ onboarded: true });
    expect(mockUpsertUser).toHaveBeenCalled();
    expect(mockUpsertSnapshot).toHaveBeenCalled();
  });

  it('with force:true run twice, snapshot upsert uses day-keyed compound key (idempotent)', async () => {
    mockFindUniqueUser.mockResolvedValue({
      steamId: STEAM_A,
      onboardedAt: new Date('2026-06-01T00:00:00.000Z'),
    });

    vi.doMock('@/server/repositories/profile', () => ({
      getProfile: vi.fn().mockResolvedValue({
        profile: {
          steamId: STEAM_A,
          personaName: 'Tester',
          avatar: { full: 'https://avatars.steamstatic.com/test.jpg' },
          countryCode: null,
          createdAt: new Date().toISOString(),
        },
        games: [
          {
            appId: 730,
            name: 'CS2',
            iconUrl: null,
            hasAchievements: false,
            playtime: { total: 1000, twoWeeks: 0 },
            lastPlayed: null,
          },
        ],
      }),
    }));

    const { runOnboardingBackfill } = await import('@/server/jobs/onboarding-backfill');

    // Run twice with force: true
    await runOnboardingBackfill(STEAM_A, { force: true });
    await runOnboardingBackfill(STEAM_A, { force: true });

    // Snapshot upsert uses day-keyed compound key — calling it twice is idempotent.
    expect(mockUpsertSnapshot).toHaveBeenCalled();

    // All calls use the correct compound key structure
    for (const call of mockUpsertSnapshot.mock.calls as Array<
      [{ where: { steamId_appId_date: { steamId: string; appId: number; date: Date } } }]
    >) {
      const where = call[0]?.where?.steamId_appId_date;
      expect(where?.steamId).toBe(STEAM_A);
      expect(typeof where?.appId).toBe('number');
      expect(where?.date).toBeInstanceOf(Date);
    }
  });
});
