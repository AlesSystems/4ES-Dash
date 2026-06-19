/**
 * tests/unit/auth.test.ts
 *
 * TDD tests for:
 *  1. extractSteamId — parses a valid claimed_id URL → 17-digit string,
 *     rejects invalid/foreign URLs.
 *  2. session callback maps token.steamId → session.user.steamId (string).
 *  3. getSessionUser() returns null when no session, { steamId } when present.
 *  4. verifySteamOpenId — SECURITY regression: assertion verification enforced.
 *     - is_valid:true  → steamId returned
 *     - is_valid:false → null (forgery rejected)
 *  5. getViewerSteamId() — production fallback gates (ERR-0013 privacy fix).
 *     - no session + production + STEAM_ID set → returns '' (no leak)
 *     - no session + development + STEAM_ID set → returns STEAM_ID (dev fallback)
 *     - session present → returns session.steamId regardless of NODE_ENV
 *
 * Steam HTTP is intercepted by the MSW server wired in tests/setup.ts.
 * No live calls can slip through (onUnhandledRequest: 'error').
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { steamServer } from '../mocks/steam-server';

// ---------------------------------------------------------------------------
// 1. steamId extraction from OpenID claimed_id
// ---------------------------------------------------------------------------

describe('extractSteamId', () => {
  it('returns the 17-digit steamId from a valid claimed_id URL', async () => {
    const { extractSteamId } = await import('@/server/auth');
    const result = extractSteamId(
      'https://steamcommunity.com/openid/id/76561198000000000',
    );
    expect(result).toBe('76561198000000000');
  });

  it('handles http:// prefix as well as https://', async () => {
    const { extractSteamId } = await import('@/server/auth');
    const result = extractSteamId(
      'http://steamcommunity.com/openid/id/76561190000000001',
    );
    expect(result).toBe('76561190000000001');
  });

  it('returns null for a URL that does not match the Steam OpenID pattern', async () => {
    const { extractSteamId } = await import('@/server/auth');
    expect(extractSteamId('https://evil.com/openid/id/76561198000000000')).toBeNull();
    expect(extractSteamId('https://steamcommunity.com/openid/id/1234')).toBeNull(); // not 17 digits
    expect(extractSteamId('not-a-url')).toBeNull();
    expect(extractSteamId('')).toBeNull();
  });

  it('returns null when the steamId portion has non-digit characters', async () => {
    const { extractSteamId } = await import('@/server/auth');
    expect(
      extractSteamId('https://steamcommunity.com/openid/id/7656119800000000X'),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. session callback maps token.steamId → session.user.steamId
// ---------------------------------------------------------------------------

describe('authOptions session callback', () => {
  it('copies token.steamId onto session.user.steamId as a string', async () => {
    const { authOptions } = await import('@/server/auth');

    const callback = authOptions.callbacks?.session;
    if (!callback) throw new Error('session callback not defined');

    const mockToken = { steamId: '76561198000000000', sub: 'dummy' };
    const mockSession = {
      user: { name: 'TestUser', image: 'http://img' },
      expires: '2099-01-01',
    };

    // next-auth passes { session, token } to the session callback
    const result = await (callback as Function)({
      session: mockSession,
      token: mockToken,
      user: undefined as never,
      newSession: undefined,
      trigger: 'update' as const,
    });

    expect(result.user.steamId).toBe('76561198000000000');
    expect(typeof result.user.steamId).toBe('string');
  });

  it('preserves name and image from the session user', async () => {
    const { authOptions } = await import('@/server/auth');

    const callback = authOptions.callbacks?.session;
    if (!callback) throw new Error('session callback not defined');

    const mockToken = { steamId: '76561198000000001', sub: 'dummy', name: 'SteamUser', picture: 'http://avatar' };
    const mockSession = {
      user: { name: 'SteamUser', image: 'http://avatar' },
      expires: '2099-01-01',
    };

    const result = await (callback as Function)({
      session: mockSession,
      token: mockToken,
      user: undefined as never,
      newSession: undefined,
      trigger: 'update' as const,
    });

    expect(result.user.name).toBe('SteamUser');
    expect(result.user.image).toBe('http://avatar');
  });
});

// ---------------------------------------------------------------------------
// 3. jwt callback sets token.steamId on sign-in
// ---------------------------------------------------------------------------

describe('authOptions jwt callback', () => {
  it('sets token.steamId from user.id on sign-in (when user is provided)', async () => {
    const { authOptions } = await import('@/server/auth');

    const callback = authOptions.callbacks?.jwt;
    if (!callback) throw new Error('jwt callback not defined');

    const mockUser = { id: '76561198000000000', name: 'TestUser', image: 'http://img', email: null };
    const mockToken = { sub: '76561198000000000' };

    const result = await (callback as Function)({
      token: mockToken,
      user: mockUser,
      account: null,
      profile: undefined,
      trigger: 'signIn' as const,
      isNewUser: false,
      session: undefined,
    });

    expect(result.steamId).toBe('76561198000000000');
  });

  it('preserves existing token.steamId on subsequent requests (no user)', async () => {
    const { authOptions } = await import('@/server/auth');

    const callback = authOptions.callbacks?.jwt;
    if (!callback) throw new Error('jwt callback not defined');

    const mockToken = { steamId: '76561198000000000', sub: 'dummy' };

    const result = await (callback as Function)({
      token: mockToken,
      user: undefined as never,
      account: null,
      profile: undefined,
      trigger: 'update' as const,
      isNewUser: false,
      session: undefined,
    });

    expect(result.steamId).toBe('76561198000000000');
  });
});

// ---------------------------------------------------------------------------
// 4. getSessionUser() helper
// ---------------------------------------------------------------------------

describe('getSessionUser', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when getServerSession yields null', async () => {
    vi.doMock('next-auth', () => ({
      getServerSession: vi.fn().mockResolvedValue(null),
    }));

    const { getSessionUser } = await import('@/server/auth');
    const result = await getSessionUser();
    expect(result).toBeNull();
  });

  it('returns null when session exists but user has no steamId', async () => {
    vi.doMock('next-auth', () => ({
      getServerSession: vi.fn().mockResolvedValue({
        user: { name: 'NoSteamId' },
        expires: '2099-01-01',
      }),
    }));

    const { getSessionUser } = await import('@/server/auth');
    const result = await getSessionUser();
    expect(result).toBeNull();
  });

  it('returns { steamId } when session has a valid steamId', async () => {
    vi.doMock('next-auth', () => ({
      getServerSession: vi.fn().mockResolvedValue({
        user: { steamId: '76561198000000000', name: 'GoodUser', image: 'http://img' },
        expires: '2099-01-01',
      }),
    }));

    const { getSessionUser } = await import('@/server/auth');
    const result = await getSessionUser();
    expect(result).toEqual({ steamId: '76561198000000000' });
  });

  it('does NOT throw when getServerSession returns null (unauthenticated)', async () => {
    vi.doMock('next-auth', () => ({
      getServerSession: vi.fn().mockResolvedValue(null),
    }));

    const { getSessionUser } = await import('@/server/auth');
    await expect(getSessionUser()).resolves.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5. verifySteamOpenId — SECURITY: assertion verification is enforced
// ---------------------------------------------------------------------------
//
// This is the critical security regression test. It proves that the
// verification function enforces Steam's check_authentication handshake.
// If the verification function were removed or bypassed, test (b) would
// accept a forged claimed_id and return a steamId — which must NOT happen.

const STEAM_OPENID_ENDPOINT = 'https://steamcommunity.com/openid/login';

/** Minimal set of OpenID callback params that Steam would return. */
const VALID_OPENID_PARAMS: Record<string, string> = {
  'openid.ns': 'http://specs.openid.net/auth/2.0',
  'openid.mode': 'id_res',
  'openid.op_endpoint': STEAM_OPENID_ENDPOINT,
  'openid.claimed_id': 'https://steamcommunity.com/openid/id/76561198000000000',
  'openid.identity': 'https://steamcommunity.com/openid/id/76561198000000000',
  'openid.return_to': 'http://localhost:3000/api/auth/callback/steam',
  'openid.response_nonce': '2099-01-01T00:00:00Zunique',
  'openid.assoc_handle': '1234567890',
  'openid.signed': 'signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle',
  'openid.sig': 'fakesig==',
};

describe('verifySteamOpenId — security regression', () => {
  // Each test manages its own module state to avoid cross-test contamination
  // from the vi.doMock usage in the getSessionUser tests above.
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    steamServer.resetHandlers();
  });

  it(
    '(a) accepts a valid assertion when Steam check_authentication returns is_valid:true',
    async () => {
      // Override the MSW handler for the check_authentication POST to Steam
      steamServer.use(
        http.post(STEAM_OPENID_ENDPOINT, () =>
          HttpResponse.text('ns:http://specs.openid.net/auth/2.0\nis_valid:true\n'),
        ),
      );

      const { verifySteamOpenId } = await import('@/server/auth');
      const steamId = await verifySteamOpenId(VALID_OPENID_PARAMS);
      expect(steamId).toBe('76561198000000000');
    },
  );

  it(
    '(b) REJECTS a forged assertion when Steam check_authentication returns is_valid:false',
    async () => {
      // Steam returns is_valid:false → attacker cannot forge any steamId
      steamServer.use(
        http.post(STEAM_OPENID_ENDPOINT, () =>
          HttpResponse.text('ns:http://specs.openid.net/auth/2.0\nis_valid:false\n'),
        ),
      );

      const { verifySteamOpenId } = await import('@/server/auth');
      const steamId = await verifySteamOpenId(VALID_OPENID_PARAMS);
      // Must be null — the forged identity must NOT be returned
      expect(steamId).toBeNull();
    },
  );

  it(
    '(c) returns null when claimed_id does not match Steam OpenID pattern',
    async () => {
      // Even if Steam would say is_valid:true, an attacker-supplied claimed_id
      // with a non-Steam domain must be rejected before the network call.
      steamServer.use(
        http.post(STEAM_OPENID_ENDPOINT, () =>
          HttpResponse.text('ns:http://specs.openid.net/auth/2.0\nis_valid:true\n'),
        ),
      );

      const { verifySteamOpenId } = await import('@/server/auth');
      const forgery = {
        ...VALID_OPENID_PARAMS,
        'openid.claimed_id': 'https://evil.com/openid/id/76561198000000000',
        'openid.identity': 'https://evil.com/openid/id/76561198000000000',
      };
      const steamId = await verifySteamOpenId(forgery);
      expect(steamId).toBeNull();
    },
  );

  it(
    '(d) returns null when Steam check_authentication endpoint returns an error',
    async () => {
      steamServer.use(
        http.post(STEAM_OPENID_ENDPOINT, () =>
          new HttpResponse(null, { status: 500 }),
        ),
      );

      const { verifySteamOpenId } = await import('@/server/auth');
      const steamId = await verifySteamOpenId(VALID_OPENID_PARAMS);
      expect(steamId).toBeNull();
    },
  );
});

// ---------------------------------------------------------------------------
// 6. getViewerSteamId() — production fallback gate (ERR-0013 privacy fix)
// ---------------------------------------------------------------------------
//
// In production, an unauthenticated request must resolve to '' even when
// STEAM_ID is set (to avoid leaking the owner's account to anonymous visitors).
// Outside production (development / test), the STEAM_ID fallback is preserved
// for local dev and featured-profile usage.

describe('getViewerSteamId — production fallback gate', () => {
  const OWNER_STEAM_ID = '76561198000000042';

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns "" in production when there is no session, even when STEAM_ID is set', async () => {
    vi.doMock('next-auth', () => ({
      getServerSession: vi.fn().mockResolvedValue(null),
    }));
    vi.doMock('@/server/env', () => ({
      getEnv: vi.fn().mockReturnValue({
        NODE_ENV: 'production',
        STEAM_ID: OWNER_STEAM_ID,
        STEAM_API_KEY: 'k',
        NEXTAUTH_SECRET: 's',
        NEXTAUTH_URL: 'https://example.com',
      }),
    }));

    const { getViewerSteamId } = await import('@/server/auth');
    const result = await getViewerSteamId();
    expect(result).toBe('');
  });

  it('returns STEAM_ID in development when there is no session and STEAM_ID is set', async () => {
    vi.doMock('next-auth', () => ({
      getServerSession: vi.fn().mockResolvedValue(null),
    }));
    vi.doMock('@/server/env', () => ({
      getEnv: vi.fn().mockReturnValue({
        NODE_ENV: 'development',
        STEAM_ID: OWNER_STEAM_ID,
        STEAM_API_KEY: 'k',
        NEXTAUTH_SECRET: 's',
        NEXTAUTH_URL: 'http://localhost:3000',
      }),
    }));

    const { getViewerSteamId } = await import('@/server/auth');
    const result = await getViewerSteamId();
    expect(result).toBe(OWNER_STEAM_ID);
  });

  it('returns session.steamId in production regardless of STEAM_ID', async () => {
    const SESSION_STEAM_ID = '76561198111111111';
    vi.doMock('next-auth', () => ({
      getServerSession: vi.fn().mockResolvedValue({
        user: { steamId: SESSION_STEAM_ID, name: 'User', image: 'http://img' },
        expires: '2099-01-01',
      }),
    }));
    vi.doMock('@/server/env', () => ({
      getEnv: vi.fn().mockReturnValue({
        NODE_ENV: 'production',
        STEAM_ID: OWNER_STEAM_ID,
        STEAM_API_KEY: 'k',
        NEXTAUTH_SECRET: 's',
        NEXTAUTH_URL: 'https://example.com',
      }),
    }));

    const { getViewerSteamId } = await import('@/server/auth');
    const result = await getViewerSteamId();
    expect(result).toBe(SESSION_STEAM_ID);
  });

  it('returns session.steamId in development regardless of STEAM_ID', async () => {
    const SESSION_STEAM_ID = '76561198222222222';
    vi.doMock('next-auth', () => ({
      getServerSession: vi.fn().mockResolvedValue({
        user: { steamId: SESSION_STEAM_ID, name: 'DevUser', image: 'http://img' },
        expires: '2099-01-01',
      }),
    }));
    vi.doMock('@/server/env', () => ({
      getEnv: vi.fn().mockReturnValue({
        NODE_ENV: 'development',
        STEAM_ID: OWNER_STEAM_ID,
        STEAM_API_KEY: 'k',
        NEXTAUTH_SECRET: 's',
        NEXTAUTH_URL: 'http://localhost:3000',
      }),
    }));

    const { getViewerSteamId } = await import('@/server/auth');
    const result = await getViewerSteamId();
    expect(result).toBe(SESSION_STEAM_ID);
  });
});
