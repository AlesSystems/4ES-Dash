/**
 * Integration tests for GET /api/friends.
 * Exercises the full stack: route handler → repository → cache → lib/steam/friends.
 * MSW intercepts all Steam HTTP calls — no real network or env secrets needed.
 *
 * ERR-0013: anonymous requests must receive 401, not the owner's friends data.
 * The session mock controls auth state; null → 401, present → 200.
 */

import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCache } from '@/server/cache';
import { FriendsResponse } from '@/lib/zod/api/friends';
import { steamServer } from '../mocks/steam-server';

// Mock getSessionUser so tests control who (if anyone) is signed in.
// Default: authenticated with the test STEAM_ID.
let mockSession: { steamId: string } | null = { steamId: '76561190000000000' };
vi.mock('@/server/auth', () => ({
  getSessionUser: () => Promise.resolve(mockSession),
}));

import { GET } from '@/app/api/friends/route';

const FRIEND_LIST_URL = 'https://api.steampowered.com/ISteamUser/GetFriendList/v0001/';
const PLAYER_SUMMARIES_URL = 'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/';

/** Invoke the route handler exactly as Next.js would, with an unused context arg. */
async function callGET(): Promise<Response> {
  return GET(new Request('http://localhost/api/friends'), undefined as never);
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

describe('GET /api/friends – anonymous (unauthenticated)', () => {
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

  it('does not call getFriends when there is no session', async () => {
    mockSession = null;

    // If getFriends were called it would hit GetFriendList, which we make
    // respond with a server error — any 200 would mean the guard was bypassed.
    steamServer.use(http.get(FRIEND_LIST_URL, () => new HttpResponse(null, { status: 500 })));

    const res = await callGET();

    // Must be 401, not a 500 from Steam, proving getFriends was never reached.
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe('GET /api/friends – happy path', () => {
  it('returns 200 with a valid FriendsResponse body, sorted, with friendSince overlaid', async () => {
    // Provide player summaries for the two friends from friend-list.json.
    // Friend ...001: in-game (CS2), online
    // Friend ...002: online only
    steamServer.use(
      http.get(PLAYER_SUMMARIES_URL, () =>
        HttpResponse.json({
          response: {
            players: [
              {
                steamid: '76561198000000001',
                personaname: 'Zara',
                profileurl: 'https://steamcommunity.com/id/zara/',
                avatar: 'https://avatars.steamstatic.com/zara_small.jpg',
                avatarmedium: 'https://avatars.steamstatic.com/zara_medium.jpg',
                avatarfull: 'https://avatars.steamstatic.com/zara_full.jpg',
                personastate: 1,
                gameextrainfo: 'Counter-Strike 2',
                gameid: '730',
              },
              {
                steamid: '76561198000000002',
                personaname: 'Alice',
                profileurl: 'https://steamcommunity.com/id/alice/',
                avatar: 'https://avatars.steamstatic.com/alice_small.jpg',
                avatarmedium: 'https://avatars.steamstatic.com/alice_medium.jpg',
                avatarfull: 'https://avatars.steamstatic.com/alice_full.jpg',
                personastate: 1,
              },
            ],
          },
        }),
      ),
    );

    const res = await callGET();

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');

    const body = (await res.json()) as unknown;

    // FriendsResponse.parse throws if the shape is invalid — that's the assertion.
    expect(() => FriendsResponse.parse(body)).not.toThrow();

    const parsed = FriendsResponse.parse(body);
    expect(Array.isArray(parsed.friends)).toBe(true);
    expect(parsed.friends.length).toBe(2);

    // Sorting: non-offline first (both online here), then alphabetical.
    // Alice < Zara alphabetically → Alice should be first.
    expect(parsed.friends[0]!.personaName).toBe('Alice');
    expect(parsed.friends[1]!.personaName).toBe('Zara');

    // In-game friend (Zara, steamId ...001) should have playing set.
    const zara = parsed.friends.find((f) => f.steamId === '76561198000000001');
    expect(zara).toBeDefined();
    expect(zara!.playing).not.toBeNull();
    expect(zara!.playing!.appId).toBe(730);
    expect(zara!.playing!.name).toBe('Counter-Strike 2');
    expect(zara!.inGame).toBe(true);

    // friendSince overlay:
    // ...001 has friend_since = 1600000000 → ISO string
    expect(typeof zara!.friendSince).toBe('string');
    expect(zara!.friendSince).toBe(new Date(1600000000 * 1000).toISOString());

    // ...002 has friend_since = 0 → null
    const alice = parsed.friends.find((f) => f.steamId === '76561198000000002');
    expect(alice).toBeDefined();
    expect(alice!.friendSince).toBeNull();
  });

  it('excludes the internal stale flag from the response body', async () => {
    steamServer.use(
      http.get(PLAYER_SUMMARIES_URL, () =>
        HttpResponse.json({
          response: {
            players: [
              {
                steamid: '76561198000000001',
                personaname: 'Friend1',
                profileurl: 'https://steamcommunity.com/id/f1/',
                avatar: 'https://avatars.steamstatic.com/f1_s.jpg',
                avatarmedium: 'https://avatars.steamstatic.com/f1_m.jpg',
                avatarfull: 'https://avatars.steamstatic.com/f1_f.jpg',
                personastate: 1,
              },
              {
                steamid: '76561198000000002',
                personaname: 'Friend2',
                profileurl: 'https://steamcommunity.com/id/f2/',
                avatar: 'https://avatars.steamstatic.com/f2_s.jpg',
                avatarmedium: 'https://avatars.steamstatic.com/f2_m.jpg',
                avatarfull: 'https://avatars.steamstatic.com/f2_f.jpg',
                personastate: 0,
              },
            ],
          },
        }),
      ),
    );

    const res = await callGET();
    const body = (await res.json()) as Record<string, unknown>;
    expect('stale' in body).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Private friend list (GetFriendList returns 401)
// ---------------------------------------------------------------------------

describe('GET /api/friends – private friend list', () => {
  it('returns 403 with a steam-private-profile problem body', async () => {
    steamServer.use(http.get(FRIEND_LIST_URL, () => new HttpResponse(null, { status: 401 })));

    const res = await callGET();
    expect(res.status).toBe(403);

    const body = (await res.json()) as Record<string, unknown>;
    expect(typeof body['type']).toBe('string');
    expect((body['type'] as string).endsWith('steam-private-profile')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Stale-while-revalidate
// ---------------------------------------------------------------------------

describe('GET /api/friends – cache-hit resilience', () => {
  // This asserts the route stays up when an upstream call fails while a warm
  // cache entry exists (the request never reaches Steam). The page-level
  // "Data may be outdated" stale indicator is covered in friends-stale.test.tsx.
  it('returns 200 with cached friends when GetPlayerSummaries fails after a prior success', async () => {
    // First call: prime the cache with two friends.
    const twoFriendsPayload = {
      response: {
        players: [
          {
            steamid: '76561198000000001',
            personaname: 'CachedFriend1',
            profileurl: 'https://steamcommunity.com/id/cf1/',
            avatar: 'https://avatars.steamstatic.com/cf1_s.jpg',
            avatarmedium: 'https://avatars.steamstatic.com/cf1_m.jpg',
            avatarfull: 'https://avatars.steamstatic.com/cf1_f.jpg',
            personastate: 1,
          },
          {
            steamid: '76561198000000002',
            personaname: 'CachedFriend2',
            profileurl: 'https://steamcommunity.com/id/cf2/',
            avatar: 'https://avatars.steamstatic.com/cf2_s.jpg',
            avatarmedium: 'https://avatars.steamstatic.com/cf2_m.jpg',
            avatarfull: 'https://avatars.steamstatic.com/cf2_f.jpg',
            personastate: 0,
          },
        ],
      },
    };

    steamServer.use(http.get(PLAYER_SUMMARIES_URL, () => HttpResponse.json(twoFriendsPayload)));

    const firstRes = await callGET();
    expect(firstRes.status).toBe(200);

    // Second call: GetPlayerSummaries now fails (500). The cache is NOT cleared
    // between the two calls (beforeEach only runs before each test, not between
    // statements), so both the friend-list and summaries entries are still warm.
    steamServer.use(http.get(PLAYER_SUMMARIES_URL, () => new HttpResponse(null, { status: 500 })));

    // The summaries entry is still within its 5-min TTL, so the loader (and thus
    // the 500) is never reached — the warm cache returns the previous value and
    // the route stays 200. (True expired-entry SWR is unit-tested in cache.test.ts.)
    const secondRes = await callGET();
    expect(secondRes.status).toBe(200);

    const body = (await secondRes.json()) as unknown;
    expect(() => FriendsResponse.parse(body)).not.toThrow();

    const parsed = FriendsResponse.parse(body);
    expect(parsed.friends.length).toBe(2);
  });
});
