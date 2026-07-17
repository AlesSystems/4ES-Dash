// @vitest-environment jsdom
/**
 * tests/unit/app/public-profile-authz-order.test.tsx
 *
 * TDD #6 (Theme 3, T3) — authz-before-data ORDER pin for /u/[steamId].
 *
 * /u/[steamId] is the IDOR boundary (ERR-0013): getProfile(steamId) must
 * never be *called* before canViewProfile has resolved, and must never be
 * called at all when it resolves false. This test is GREEN at HEAD and must
 * STAY GREEN after the pre-authz pair (getSessionUser ∥ prisma.user.findUnique)
 * is parallelized — it pins the invariant through the refactor.
 *
 * Pattern: `await PublicProfilePage({ params })` per
 * tests/unit/app/game-detail-hero-fallback.test.tsx (ERR-0006: jsdom cannot
 * render unresolved async RSCs — invoke the page function directly).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Hoisted mocks (repo precedent: tests/unit/insights-repo-genres.test.ts)
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  findUnique: vi.fn(),
  canViewProfile: vi.fn(),
  getProfile: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('next/image', () => ({
  default: vi.fn().mockReturnValue(null),
}));

vi.mock('@/server/auth', () => ({
  getSessionUser: mocks.getSessionUser,
}));

vi.mock('@/server/db', () => ({
  prisma: { user: { findUnique: mocks.findUnique } },
}));

vi.mock('@/server/authz', () => ({
  canViewProfile: mocks.canViewProfile,
}));

vi.mock('@/server/repositories/profile', () => ({
  getProfile: mocks.getProfile,
}));

import PublicProfilePage from '@/app/u/[steamId]/page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VIEWER = '76561198000000001';
const TARGET = '76561198000000002';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/** Drains the microtask queue so the page advances to its next pending await. */
function flush(): Promise<void> {
  return new Promise((res) => setTimeout(res, 0));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSessionUser.mockResolvedValue({ steamId: VIEWER });
  mocks.findUnique.mockResolvedValue({ privacy: 'public' });
  mocks.getProfile.mockResolvedValue({
    profile: {
      personaName: 'Target B',
      avatar: { medium: 'https://avatars.steamstatic.com/x_medium.jpg' },
      profileUrl: 'https://steamcommunity.com/profiles/76561198000000002',
    },
    games: [],
    stale: false,
    playtimeHidden: false,
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PublicProfilePage — getProfile is never called before canViewProfile resolves', () => {
  it('does not invoke getProfile while canViewProfile is pending, then invokes it once allowed', async () => {
    const authz = deferred<boolean>();
    mocks.canViewProfile.mockReturnValue(authz.promise);

    // Start the page render but do NOT await it yet — hold it at the authz gate.
    const pagePromise = PublicProfilePage({ params: { steamId: TARGET } });

    await flush();

    // The page has reached the gate (authz asked) but the gate has not resolved:
    // target data must not have been touched.
    expect(mocks.canViewProfile).toHaveBeenCalledTimes(1);
    expect(mocks.getProfile).not.toHaveBeenCalled();

    // Only AFTER the gate resolves true may target data be fetched.
    authz.resolve(true);
    await pagePromise;
    expect(mocks.getProfile).toHaveBeenCalledTimes(1);
    expect(mocks.getProfile).toHaveBeenCalledWith(TARGET);
  });

  it('never invokes getProfile when canViewProfile resolves false (locked state)', async () => {
    const authz = deferred<boolean>();
    mocks.canViewProfile.mockReturnValue(authz.promise);

    const pagePromise = PublicProfilePage({ params: { steamId: TARGET } });

    await flush();
    expect(mocks.getProfile).not.toHaveBeenCalled();

    authz.resolve(false);
    render(await pagePromise);

    // Locked state rendered, zero target-data fetches — ever.
    expect(screen.getByText(/private/i)).toBeInTheDocument();
    expect(mocks.getProfile).not.toHaveBeenCalled();
  });
});
