// @vitest-environment jsdom
/**
 * tests/unit/app/public-profile-parallel-preauthz.test.tsx
 *
 * TDD #7 (Theme 3, T3 / RSC-8) — the PRE-authz pair on /u/[steamId] starts
 * concurrently: the viewer-session read (getSessionUser) and the target's
 * privacy lookup (prisma.user.findUnique) are independent of each other and
 * must both be started before either resolves.
 *
 * RED at HEAD: the page awaits getSessionUser serially, so findUnique is not
 * invoked until the session read resolves. GREEN after the Promise.all change.
 *
 * NOTE this parallelism is strictly PRE-authz. The authz-before-data ordering
 * (canViewProfile before getProfile) is pinned separately by
 * tests/unit/app/public-profile-authz-order.test.tsx and is untouched here.
 *
 * Pattern: `await PublicProfilePage({ params })` per
 * tests/unit/app/game-detail-hero-fallback.test.tsx (ERR-0006).
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
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PublicProfilePage — session read and target privacy lookup start concurrently', () => {
  it('invokes both getSessionUser and prisma.user.findUnique before either resolves', async () => {
    const starts: string[] = [];
    const session = deferred<{ steamId: string } | null>();
    const db = deferred<{ privacy: string } | null>();

    mocks.getSessionUser.mockImplementation(() => {
      starts.push('getSessionUser');
      return session.promise;
    });
    mocks.findUnique.mockImplementation(() => {
      starts.push('findUnique');
      return db.promise;
    });
    // Downstream stays serial and is exercised only after both resolve.
    mocks.canViewProfile.mockResolvedValue(false);

    const pagePromise = PublicProfilePage({ params: { steamId: TARGET } });

    await flush();

    // Both pre-authz reads must have STARTED while both are still pending.
    expect(starts).toContain('getSessionUser');
    expect(starts).toContain('findUnique');
    expect(mocks.getSessionUser).toHaveBeenCalledTimes(1);
    expect(mocks.findUnique).toHaveBeenCalledTimes(1);

    // Unblock the pair and let the page complete (authz denies → locked state,
    // zero target-data fetches — behavior unchanged by the parallelization).
    session.resolve({ steamId: VIEWER });
    db.resolve({ privacy: 'private' });
    render(await pagePromise);

    expect(screen.getByText(/private/i)).toBeInTheDocument();
    expect(mocks.getProfile).not.toHaveBeenCalled();
  });
});
