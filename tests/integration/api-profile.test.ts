/**
 * Integration tests for GET /api/profile.
 * Exercises the full stack: route handler → repository → cache → lib/steam.
 * MSW intercepts all Steam HTTP calls — no real network or env secrets needed.
 */

import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { GET } from '@/app/api/profile/route';
import { clearCache } from '@/server/cache';
import { ProfileResponse } from '@/lib/zod/api/profile';
import { steamServer } from '../mocks/steam-server';

const OWNED_GAMES_URL = 'https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/';
const PLAYER_SUMMARIES_URL = 'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/';

/** Invoke the route handler exactly as Next.js would, with an unused context arg. */
async function callGET(): Promise<Response> {
  return GET(new Request('http://localhost/api/profile'), undefined as never);
}

// Clear the in-memory cache before each test so values don't bleed across cases.
beforeEach(() => clearCache());

// ---------------------------------------------------------------------------
// Happy path
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
