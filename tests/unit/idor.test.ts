// @vitest-environment jsdom
/**
 * tests/unit/idor.test.ts
 *
 * IDOR regression test (Task 05, Job B).
 *
 * Proves that viewer A CANNOT read target B's private data via the public
 * profile route (/u/[steamId]). The authz gate must short-circuit before any
 * data fetch when access is denied.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Module mocks — vi.mock factories are hoisted above ALL module-level code,
// so any values referenced inside must be literals, not variables.
// ---------------------------------------------------------------------------

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('next/image', () => ({
  default: vi.fn().mockReturnValue(null),
}));

// Literal SteamID string — cannot reference VIEWER_A here (hoisting).
vi.mock('@/server/auth', () => ({
  getSessionUser: vi.fn().mockResolvedValue({ steamId: '76561198000000001' }),
  getViewerSteamId: vi.fn().mockResolvedValue('76561198000000001'),
  buildAuthOptions: vi.fn(),
  authOptions: {},
  extractSteamId: vi.fn(),
  verifySteamOpenId: vi.fn(),
}));

vi.mock('@/server/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn().mockResolvedValue({ privacy: 'private' }),
    },
  },
}));

vi.mock('@/server/repositories/profile', () => ({
  getProfile: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after vi.mock declarations)
// ---------------------------------------------------------------------------

import { canViewProfile } from '@/server/authz';
import PublicProfilePage from '@/app/u/[steamId]/page';
import { getProfile } from '@/server/repositories/profile';

// Named constants used in test bodies (not in factory closures).
const VIEWER_A = '76561198000000001';
const TARGET_B = '76561198000000002';

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 1. canViewProfile direct unit assertion
// ---------------------------------------------------------------------------

describe('canViewProfile direct assertion', () => {
  it('returns false when viewer A tries to see private target B', async () => {
    const result = await canViewProfile(VIEWER_A, { steamId: TARGET_B, privacy: 'private' });
    expect(result).toBe(false);
  });

  it('returns true when owner views their own private profile (A views A)', async () => {
    const result = await canViewProfile(VIEWER_A, { steamId: VIEWER_A, privacy: 'private' });
    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Route-level IDOR: render /u/[steamId] as viewer A visiting private target B
// ---------------------------------------------------------------------------

describe('PublicProfilePage IDOR — viewer A cannot read private target B', () => {
  it('renders locked state and does NOT call getProfile for private profile', async () => {
    render(await PublicProfilePage({ params: { steamId: TARGET_B } }));

    // Locked/private state must be visible.
    expect(screen.getByText(/private/i)).toBeInTheDocument();

    // CRITICAL: getProfile must NEVER be called — authz gate short-circuits first.
    expect(getProfile).not.toHaveBeenCalled();
  });

  it('does not expose target B data in the locked state', async () => {
    render(await PublicProfilePage({ params: { steamId: TARGET_B } }));

    // No data fetch for denied viewer.
    expect(getProfile).not.toHaveBeenCalled();
    // No games-count paragraph (only rendered on the success path).
    expect(screen.queryByText(/games in library/i)).not.toBeInTheDocument();
  });
});
