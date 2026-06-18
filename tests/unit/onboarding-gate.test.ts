/**
 * tests/unit/onboarding-gate.test.ts
 *
 * TDD tests for server/onboarding-gate.ts (Task 06 / #90).
 *
 * Covers:
 *  1. getOnboardingStatus returns "not-onboarded" when User row has onboardedAt == null.
 *  2. getOnboardingStatus returns "onboarded" when User row has onboardedAt set.
 *  3. getOnboardingStatus returns "no-session" when getSessionUser() → null.
 *  4. Gate is idempotent — repeated calls with onboardedAt set always return "onboarded".
 *  5. getOnboardingStatus returns "not-onboarded" for a user whose signIn upserted
 *     a bare User row (onboardedAt == null, no /onboarding visit yet) — regression for #90.
 *
 * Prisma and session are fully mocked; no real DB or Steam calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Prisma mock
// ---------------------------------------------------------------------------

const mockFindUniqueUser = vi.fn();

vi.mock('@/server/db', () => ({
  prisma: {
    user: {
      findUnique: mockFindUniqueUser,
    },
  },
}));

// ---------------------------------------------------------------------------
// Session mock — getSessionUser
// ---------------------------------------------------------------------------

const mockGetSessionUser = vi.fn();

vi.mock('@/server/auth', () => ({
  getSessionUser: mockGetSessionUser,
}));

const TEST_STEAM_ID = '76561198000000000';

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 1. getOnboardingStatus returns "no-session" when there is no session user
// ---------------------------------------------------------------------------

describe('getOnboardingStatus — no session', () => {
  it('returns "no-session" when getSessionUser yields null', async () => {
    mockGetSessionUser.mockResolvedValue(null);

    const { getOnboardingStatus } = await import('@/server/onboarding-gate');
    const status = await getOnboardingStatus();

    expect(status).toBe('no-session');
    expect(mockFindUniqueUser).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 2. getOnboardingStatus returns "not-onboarded" when onboardedAt == null
// ---------------------------------------------------------------------------

describe('getOnboardingStatus — session exists, onboardedAt null', () => {
  it('returns "not-onboarded" when user has no onboardedAt (bare User row from signIn)', async () => {
    mockGetSessionUser.mockResolvedValue({ steamId: TEST_STEAM_ID });
    mockFindUniqueUser.mockResolvedValue({
      steamId: TEST_STEAM_ID,
      onboardedAt: null,
    });

    const { getOnboardingStatus } = await import('@/server/onboarding-gate');
    const status = await getOnboardingStatus();

    expect(status).toBe('not-onboarded');
  });

  it('returns "not-onboarded" when user row does not exist yet (null from DB)', async () => {
    mockGetSessionUser.mockResolvedValue({ steamId: TEST_STEAM_ID });
    mockFindUniqueUser.mockResolvedValue(null);

    const { getOnboardingStatus } = await import('@/server/onboarding-gate');
    const status = await getOnboardingStatus();

    expect(status).toBe('not-onboarded');
  });

  it('regression #90: fresh sign-in (signIn fired, no /onboarding visit) → "not-onboarded"', async () => {
    // signIn upserts a bare User with onboardedAt == null; nothing else has run yet.
    mockGetSessionUser.mockResolvedValue({ steamId: TEST_STEAM_ID });
    mockFindUniqueUser.mockResolvedValue({
      steamId: TEST_STEAM_ID,
      onboardedAt: null, // this is the bare user from the signIn event
    });

    const { getOnboardingStatus } = await import('@/server/onboarding-gate');
    const status = await getOnboardingStatus();

    expect(status).toBe('not-onboarded');
    // ensures the gate consulted the DB
    expect(mockFindUniqueUser).toHaveBeenCalledWith({
      where: { steamId: TEST_STEAM_ID },
      select: { onboardedAt: true },
    });
  });
});

// ---------------------------------------------------------------------------
// 3. getOnboardingStatus returns "onboarded" when onboardedAt is set
// ---------------------------------------------------------------------------

describe('getOnboardingStatus — session exists, onboardedAt set', () => {
  it('returns "onboarded" when user has a non-null onboardedAt', async () => {
    mockGetSessionUser.mockResolvedValue({ steamId: TEST_STEAM_ID });
    mockFindUniqueUser.mockResolvedValue({
      steamId: TEST_STEAM_ID,
      onboardedAt: new Date('2026-06-18T00:00:00.000Z'),
    });

    const { getOnboardingStatus } = await import('@/server/onboarding-gate');
    const status = await getOnboardingStatus();

    expect(status).toBe('onboarded');
  });

  it('idempotent — second call with onboardedAt set still returns "onboarded"', async () => {
    mockGetSessionUser.mockResolvedValue({ steamId: TEST_STEAM_ID });
    mockFindUniqueUser.mockResolvedValue({
      steamId: TEST_STEAM_ID,
      onboardedAt: new Date('2026-06-18T00:00:00.000Z'),
    });

    const { getOnboardingStatus } = await import('@/server/onboarding-gate');
    const first = await getOnboardingStatus();
    const second = await getOnboardingStatus();

    expect(first).toBe('onboarded');
    expect(second).toBe('onboarded');
  });
});

// ---------------------------------------------------------------------------
// 4. Only selects onboardedAt — no extra DB columns read
// ---------------------------------------------------------------------------

describe('getOnboardingStatus — minimal DB read', () => {
  it('calls prisma.user.findUnique with only { onboardedAt: true } in select', async () => {
    mockGetSessionUser.mockResolvedValue({ steamId: TEST_STEAM_ID });
    mockFindUniqueUser.mockResolvedValue({ onboardedAt: null });

    const { getOnboardingStatus } = await import('@/server/onboarding-gate');
    await getOnboardingStatus();

    expect(mockFindUniqueUser).toHaveBeenCalledWith({
      where: { steamId: TEST_STEAM_ID },
      select: { onboardedAt: true },
    });
  });
});
