/**
 * tests/unit/authz.test.ts
 *
 * TDD tests for server/authz.ts (Task 05).
 *
 * Covers:
 *  1. canViewProfile — public privacy → anyone (viewer null, viewer other, owner)
 *  2. canViewProfile — private privacy → only owner; all others denied
 *  3. canViewProfile — friendsOnly → true iff viewer is in target's Steam friends list
 *  4. canViewProfile — friendsOnly with unavailable/erroring friend list → false (FAIL CLOSED)
 *  5. IDOR test: user A cannot read user B's private data
 *
 * Strategy for friend-list tests:
 *  - "viewer is a friend" tests: override MSW to return a real friend-list fixture.
 *  - "fail closed" tests: mock getFriendList directly to avoid retry backoff delays
 *    (500 → transient → 3 retries × seconds of backoff = timeout in Vitest default 5 s).
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { SteamApiError } from '@/lib/steam/errors';
import { steamServer } from '../mocks/steam-server';

const STEAM_A = '76561198000000001';
const STEAM_B = '76561198000000002';
const STEAM_C = '76561198000000003'; // friend of B

const FRIEND_LIST_URL = 'https://api.steampowered.com/ISteamUser/GetFriendList/v0001/';

// Reset modules between tests to ensure clean imports
beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
  steamServer.resetHandlers();
});

// ---------------------------------------------------------------------------
// 1. Public privacy
// ---------------------------------------------------------------------------

describe('canViewProfile — public privacy', () => {
  it('returns true for an unauthenticated viewer (null)', async () => {
    const { canViewProfile } = await import('@/server/authz');
    const result = await canViewProfile(null, { steamId: STEAM_B, privacy: 'public' });
    expect(result).toBe(true);
  });

  it('returns true for a different authenticated viewer', async () => {
    const { canViewProfile } = await import('@/server/authz');
    const result = await canViewProfile(STEAM_A, { steamId: STEAM_B, privacy: 'public' });
    expect(result).toBe(true);
  });

  it('returns true for the owner themselves', async () => {
    const { canViewProfile } = await import('@/server/authz');
    const result = await canViewProfile(STEAM_B, { steamId: STEAM_B, privacy: 'public' });
    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Private privacy
// ---------------------------------------------------------------------------

describe('canViewProfile — private privacy', () => {
  it('returns false for an unauthenticated viewer (null)', async () => {
    const { canViewProfile } = await import('@/server/authz');
    const result = await canViewProfile(null, { steamId: STEAM_B, privacy: 'private' });
    expect(result).toBe(false);
  });

  it('returns false for a different authenticated viewer', async () => {
    const { canViewProfile } = await import('@/server/authz');
    const result = await canViewProfile(STEAM_A, { steamId: STEAM_B, privacy: 'private' });
    expect(result).toBe(false);
  });

  it('returns true for the owner themselves', async () => {
    const { canViewProfile } = await import('@/server/authz');
    const result = await canViewProfile(STEAM_B, { steamId: STEAM_B, privacy: 'private' });
    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. FriendsOnly privacy — friend present in target's friend list
// ---------------------------------------------------------------------------

describe('canViewProfile — friendsOnly, viewer is a friend', () => {
  it('returns true when viewer is in the target Steam friends list', async () => {
    // Override the friend list endpoint to return C as a friend of B
    steamServer.use(
      http.get(FRIEND_LIST_URL, ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('steamid') === STEAM_B) {
          return HttpResponse.json({
            friendslist: {
              friends: [
                { steamid: STEAM_C, relationship: 'friend', friend_since: 1600000000 },
              ],
            },
          });
        }
        return new HttpResponse(null, { status: 400 });
      }),
    );

    const { canViewProfile } = await import('@/server/authz');
    // C is a friend of B → C can view B's friendsOnly profile
    const result = await canViewProfile(STEAM_C, { steamId: STEAM_B, privacy: 'friendsOnly' });
    expect(result).toBe(true);
  });

  it('returns false when viewer is NOT in the target Steam friends list', async () => {
    // Override the friend list endpoint: B has only C as friend, A is not a friend
    steamServer.use(
      http.get(FRIEND_LIST_URL, ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('steamid') === STEAM_B) {
          return HttpResponse.json({
            friendslist: {
              friends: [
                { steamid: STEAM_C, relationship: 'friend', friend_since: 1600000000 },
              ],
            },
          });
        }
        return new HttpResponse(null, { status: 400 });
      }),
    );

    const { canViewProfile } = await import('@/server/authz');
    // A is not a friend of B → A cannot view B's friendsOnly profile
    const result = await canViewProfile(STEAM_A, { steamId: STEAM_B, privacy: 'friendsOnly' });
    expect(result).toBe(false);
  });

  it('returns true when viewer is the owner, regardless of friend list', async () => {
    const { canViewProfile } = await import('@/server/authz');
    // Owner always sees their own profile
    const result = await canViewProfile(STEAM_B, { steamId: STEAM_B, privacy: 'friendsOnly' });
    expect(result).toBe(true);
  });

  it('returns false for unauthenticated viewer (null) on friendsOnly', async () => {
    const { canViewProfile } = await import('@/server/authz');
    const result = await canViewProfile(null, { steamId: STEAM_B, privacy: 'friendsOnly' });
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. FriendsOnly — FAIL CLOSED when friend list is unavailable/errors
//
// We mock getFriendList directly (rather than using MSW HTTP overrides) to
// avoid the retry backoff in lib/steam/retry.ts (500 → 3 retries × seconds
// of sleep = >5 s per test which exceeds Vitest's default timeout).
// ---------------------------------------------------------------------------

describe('canViewProfile — friendsOnly, fail closed on friend list error', () => {
  it('returns false when friend list is private (SteamApiError kind=private)', async () => {
    vi.doMock('@/lib/steam/friends', () => ({
      getFriendList: vi.fn().mockRejectedValue(
        new SteamApiError({ kind: 'private', message: 'Friend list is not public' }),
      ),
    }));

    const { canViewProfile } = await import('@/server/authz');
    const result = await canViewProfile(STEAM_A, { steamId: STEAM_B, privacy: 'friendsOnly' });
    // Fail closed — cannot verify friendship → deny
    expect(result).toBe(false);
  });

  it('returns false when friend list fetch fails (SteamApiError kind=transient)', async () => {
    vi.doMock('@/lib/steam/friends', () => ({
      getFriendList: vi.fn().mockRejectedValue(
        new SteamApiError({ kind: 'transient', message: 'Steam API server error' }),
      ),
    }));

    const { canViewProfile } = await import('@/server/authz');
    const result = await canViewProfile(STEAM_A, { steamId: STEAM_B, privacy: 'friendsOnly' });
    // Fail closed — transient error → deny
    expect(result).toBe(false);
  });

  it('returns false when friend list returns unexpected schema (SteamApiError kind=schema)', async () => {
    vi.doMock('@/lib/steam/friends', () => ({
      getFriendList: vi.fn().mockRejectedValue(
        new SteamApiError({ kind: 'schema', message: 'Unexpected shape in GetFriendList response' }),
      ),
    }));

    const { canViewProfile } = await import('@/server/authz');
    const result = await canViewProfile(STEAM_A, { steamId: STEAM_B, privacy: 'friendsOnly' });
    // Fail closed — schema error → deny
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. IDOR test: user A CANNOT read user B's private data
// ---------------------------------------------------------------------------

describe('IDOR test — user A cannot read user B private data', () => {
  it('canViewProfile(A, B-private) returns false — IDOR prevented', async () => {
    const { canViewProfile } = await import('@/server/authz');

    // User A tries to access user B's private profile
    const result = await canViewProfile(STEAM_A, { steamId: STEAM_B, privacy: 'private' });

    // CRITICAL: must be false — A cannot see B's private data
    expect(result).toBe(false);
  });

  it('canViewProfile(null, B-private) returns false — anon cannot see private', async () => {
    const { canViewProfile } = await import('@/server/authz');

    const result = await canViewProfile(null, { steamId: STEAM_B, privacy: 'private' });
    expect(result).toBe(false);
  });
});
