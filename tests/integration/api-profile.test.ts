/**
 * Integration tests for GET /api/profile.
 * Exercises the full stack: route handler → repository → cache → lib/steam.
 * MSW intercepts all Steam HTTP calls — no real network or env secrets needed.
 *
 * ERR-0013: anonymous requests must receive 401, not the owner's profile data.
 * The session mock controls auth state; null → 401, present → 200.
 */

import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCache } from '@/server/cache';
import { ProfileResponse } from '@/lib/zod/api/profile';
import { steamServer } from '../mocks/steam-server';

// Mock getSessionUser so tests control who (if anyone) is signed in.
// Default: authenticated with the test STEAM_ID.
let mockSession: { steamId: string } | null = { steamId: '76561190000000000' };
vi.mock('@/server/auth', () => ({
  getSessionUser: () => Promise.resolve(mockSession),
}));

import { GET } from '@/app/api/profile/route';

const OWNED_GAMES_URL = 'https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/';
const PLAYER_SUMMARIES_URL = 'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/';

/** Invoke the route handler exactly as Next.js would, with an unused context arg. */
async function callGET(): Promise<Response> {
  return GET(new Request('http://localhost/api/profile'), undefined as never);
}

// Clear the in-memory cache before each test so values don't bleed across cases.
// Reset session to authenticated by default.
beforeEach(() => {
  clearCache();
  mockSession = { steamId: '76561190000000000' };
});

// ---------------------------------------------------------------------------
// Anonymous access — ERR-0013 privacy fix
// ---------------------------------------------------------------------------

describe('GET /api/profile – anonymous (unauthenticated)', () => {
  it('returns 401 with an unauthorized body when there is no session', async () => {
    mockSession = null;

    const res = await callGET();

    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body['error']).toBe('unauthorized');
  });

  it('sets Cache-Control: private, no-store on the 401 response', async () => {
    mockSession = null;

    const res = await callGET();

    expect(res.status).toBe(401);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it('does not call getProfile when there is no session', async () => {
    mockSession = null;

    // If getProfile were called it would hit GetPlayerSummaries, which we make
    // respond with a server error — any non-401 would mean the guard ran but
    // still reached the loader as a side-effect.
    steamServer.use(
      http.get(PLAYER_SUMMARIES_URL, () => new HttpResponse(null, { status: 500 })),
    );

    const res = await callGET();

    // Must be 401, not a 500 from Steam, proving getProfile was never reached.
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Happy path (authenticated)
// ---------------------------------------------------------------------------

describe('GET /api/profile – happy path', () => {
  it('returns 200 with a valid ProfileResponse body', async () => {
    const res = await callGET();

    expect(res.status).toBe(200);

    const body = (await res.json()) as unknown;

    // ProfileResponse.parse throws if the shape is invalid — that's the assertion.
    expect(() => ProfileResponse.parse(body)).not.toThrow();

    const parsed = ProfileResponse.parse(body);
    expect(Array.isArray(parsed.games)).toBe(true);
    expect(parsed.games.length).toBeGreaterThan(0);
  });

  it('excludes the internal stale flag from the response body', async () => {
    const res = await callGET();
    const body = (await res.json()) as Record<string, unknown>;

    expect('stale' in body).toBe(false);
  });

  it('sets Cache-Control: private, no-store', async () => {
    const res = await callGET();
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });
});

// ---------------------------------------------------------------------------
// Auth error (401 from GetPlayerSummaries)
// ---------------------------------------------------------------------------

describe('GET /api/profile – auth error', () => {
  it('returns 401 with a steam-auth problem body', async () => {
    steamServer.use(http.get(PLAYER_SUMMARIES_URL, () => new HttpResponse(null, { status: 401 })));

    const res = await callGET();
    expect(res.status).toBe(401);

    const body = (await res.json()) as Record<string, unknown>;
    expect(typeof body['type']).toBe('string');
    expect((body['type'] as string).endsWith('steam-auth')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Private profile (GetOwnedGames returns { response: {} })
// ---------------------------------------------------------------------------

describe('GET /api/profile – private profile', () => {
  it('returns 403 with a steam-private-profile problem body', async () => {
    steamServer.use(http.get(OWNED_GAMES_URL, () => HttpResponse.json({ response: {} })));

    const res = await callGET();
    expect(res.status).toBe(403);

    const body = (await res.json()) as Record<string, unknown>;
    expect(typeof body['type']).toBe('string');
    expect((body['type'] as string).endsWith('steam-private-profile')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Unexpected Steam shape → 400 RFC 7807 validation (ACCEPTANCE #12 line 56)
// ---------------------------------------------------------------------------

describe('GET /api/profile – unexpected Steam shape', () => {
  it('returns 400 with a validation problem body', async () => {
    steamServer.use(
      http.get(PLAYER_SUMMARIES_URL, () =>
        HttpResponse.json({ response: { players: 'not-an-array' } }),
      ),
    );

    const res = await callGET();
    expect(res.status).toBe(400);

    const body = (await res.json()) as Record<string, unknown>;
    expect(typeof body['type']).toBe('string');
    expect((body['type'] as string).endsWith('validation')).toBe(true);
    expect(body['title']).toBeDefined();
    expect(body['detail']).toBeDefined();
  });
});
