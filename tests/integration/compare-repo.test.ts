/**
 * Integration tests for server/repositories/compare.ts
 *
 * Calls getComparison() directly. MSW intercepts all Steam HTTP calls.
 * No real network or env secrets needed.
 */

import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearCache } from '@/server/cache';
import { getComparison } from '@/server/repositories/compare';
import { steamServer } from '../mocks/steam-server';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OWNED_GAMES_URL = 'https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/';
const PLAYER_SUMMARIES_URL = 'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/';

const ID_A = '76561198000000001';
const ID_B = '76561198000000002';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/** Build a minimal GetOwnedGames response body for a list of {appid, playtime} pairs. */
function ownedGamesBody(games: Array<{ appid: number; playtime_forever: number; name?: string }>) {
  return {
    response: {
      game_count: games.length,
      games: games.map((g) => ({
        appid: g.appid,
        name: g.name ?? `Game ${g.appid}`,
        playtime_forever: g.playtime_forever,
        img_icon_url: `icon${g.appid}`,
        has_community_visible_stats: false,
      })),
    },
  };
}

/** Build a minimal GetPlayerSummaries response body for a given steamId. */
function playerSummaryBody(steamId: string) {
  return {
    response: {
      players: [
        {
          steamid: steamId,
          communityvisibilitystate: 3,
          profilestate: 1,
          personaname: `User ${steamId.slice(-4)}`,
          profileurl: `https://steamcommunity.com/profiles/${steamId}/`,
          avatar: 'https://avatars.steamstatic.com/small.jpg',
          avatarmedium: 'https://avatars.steamstatic.com/medium.jpg',
          avatarfull: 'https://avatars.steamstatic.com/full.jpg',
          avatarhash: 'abc',
          personastate: 1,
        },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// A's library: appIds {1, 2, 3}  B's library: appIds {2, 3, 4}
// ---------------------------------------------------------------------------
const A_GAMES = [
  { appid: 1, playtime_forever: 100 },
  { appid: 2, playtime_forever: 200 },
  { appid: 3, playtime_forever: 300 },
];

const B_GAMES = [
  { appid: 2, playtime_forever: 50 },
  { appid: 3, playtime_forever: 400 },
  { appid: 4, playtime_forever: 600 },
];

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => clearCache());

// ---------------------------------------------------------------------------
// Case 1: Both public — shared games computed correctly
// ---------------------------------------------------------------------------

describe('getComparison – both public', () => {
  beforeEach(() => {
    // Per-user handlers that inspect the query param.
    steamServer.use(
      http.get(PLAYER_SUMMARIES_URL, ({ request }) => {
        const steamids = new URL(request.url).searchParams.get('steamids') ?? '';
        if (steamids.includes(ID_A)) return HttpResponse.json(playerSummaryBody(ID_A));
        if (steamids.includes(ID_B)) return HttpResponse.json(playerSummaryBody(ID_B));
        return new HttpResponse(null, { status: 400 });
      }),

      http.get(OWNED_GAMES_URL, ({ request }) => {
        const steamid = new URL(request.url).searchParams.get('steamid');
        if (steamid === ID_A) return HttpResponse.json(ownedGamesBody(A_GAMES));
        if (steamid === ID_B) return HttpResponse.json(ownedGamesBody(B_GAMES));
        return new HttpResponse(null, { status: 400 });
      }),
    );
  });

  it('returns sameUser=false and sharedSkipped=null', async () => {
    const result = await getComparison(ID_A, ID_B);
    expect(result.sameUser).toBe(false);
    expect(result.sharedSkipped).toBeNull();
  });

  it('shared contains exactly appIds {2, 3} sorted by |delta| desc', async () => {
    const result = await getComparison(ID_A, ID_B);

    expect(result.shared).not.toBeNull();
    const shared = result.shared!;
    const sharedAppIds = shared.map((g) => g.appId);
    expect(sharedAppIds).toContain(2);
    expect(sharedAppIds).toContain(3);
    expect(sharedAppIds).not.toContain(1);
    expect(sharedAppIds).not.toContain(4);
    expect(shared).toHaveLength(2);

    // appId 3: |300 - 400| = 100  vs  appId 2: |200 - 50| = 150 → 2 sorts first (desc)
    // Wait: delta for 2 = |200 - 50| = 150; delta for 3 = |300 - 400| = 100. So 2 first.
    expect(shared[0]!.appId).toBe(2);
    expect(shared[1]!.appId).toBe(3);
  });

  it('playtimeA and playtimeB are correct for each shared game', async () => {
    const result = await getComparison(ID_A, ID_B);
    const shared = result.shared!;

    const game2 = shared.find((g) => g.appId === 2)!;
    expect(game2.playtimeA).toBe(200);
    expect(game2.playtimeB).toBe(50);
    expect(game2.deltaMinutes).toBe(150);

    const game3 = shared.find((g) => g.appId === 3)!;
    expect(game3.playtimeA).toBe(300);
    expect(game3.playtimeB).toBe(400);
    expect(game3.deltaMinutes).toBe(100);
  });

  it("A's side has correct gamesCount and totalMinutes", async () => {
    const result = await getComparison(ID_A, ID_B);
    expect(result.a.gamesCount).toBe(3);
    expect(result.a.totalMinutes).toBe(100 + 200 + 300);
  });

  it("B's side has correct gamesCount and totalMinutes", async () => {
    const result = await getComparison(ID_A, ID_B);
    expect(result.b.gamesCount).toBe(3);
    expect(result.b.totalMinutes).toBe(50 + 400 + 600);
  });

  it('both profiles are non-null', async () => {
    const result = await getComparison(ID_A, ID_B);
    expect(result.a.profile).not.toBeNull();
    expect(result.b.profile).not.toBeNull();
    expect(result.a.profile?.steamId).toBe(ID_A);
    expect(result.b.profile?.steamId).toBe(ID_B);
  });

  it('neither side is private', async () => {
    const result = await getComparison(ID_A, ID_B);
    expect(result.a.isPrivate).toBe(false);
    expect(result.b.isPrivate).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Case 2: One side private
// ---------------------------------------------------------------------------

describe('getComparison – one side private (B)', () => {
  beforeEach(() => {
    steamServer.use(
      http.get(PLAYER_SUMMARIES_URL, ({ request }) => {
        const steamids = new URL(request.url).searchParams.get('steamids') ?? '';
        if (steamids.includes(ID_A)) return HttpResponse.json(playerSummaryBody(ID_A));
        if (steamids.includes(ID_B)) return HttpResponse.json(playerSummaryBody(ID_B));
        return new HttpResponse(null, { status: 400 });
      }),

      http.get(OWNED_GAMES_URL, ({ request }) => {
        const steamid = new URL(request.url).searchParams.get('steamid');
        if (steamid === ID_A) return HttpResponse.json(ownedGamesBody(A_GAMES));
        // B's library is private — Steam returns { response: {} }
        if (steamid === ID_B) return HttpResponse.json({ response: {} });
        return new HttpResponse(null, { status: 400 });
      }),
    );
  });

  it('b.isPrivate is true', async () => {
    const result = await getComparison(ID_A, ID_B);
    expect(result.b.isPrivate).toBe(true);
  });

  it('b.gamesCount and b.totalMinutes are null', async () => {
    const result = await getComparison(ID_A, ID_B);
    expect(result.b.gamesCount).toBeNull();
    expect(result.b.totalMinutes).toBeNull();
  });

  it('shared is null and sharedSkipped is unavailable', async () => {
    const result = await getComparison(ID_A, ID_B);
    expect(result.shared).toBeNull();
    expect(result.sharedSkipped).toBe('unavailable');
  });

  it("A's side is still fully populated", async () => {
    const result = await getComparison(ID_A, ID_B);
    expect(result.a.gamesCount).toBe(3);
    expect(result.a.totalMinutes).toBe(600);
    expect(result.a.isPrivate).toBe(false);
    expect(result.a.profile).not.toBeNull();
  });

  it('a.isPrivate is false', async () => {
    const result = await getComparison(ID_A, ID_B);
    expect(result.a.isPrivate).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Case 3: Same user
// ---------------------------------------------------------------------------

describe('getComparison – same user', () => {
  beforeEach(() => {
    // Default handlers from steam-server are fine — just one user needed.
    steamServer.use(
      http.get(PLAYER_SUMMARIES_URL, () => HttpResponse.json(playerSummaryBody(ID_A))),
      http.get(OWNED_GAMES_URL, () => HttpResponse.json(ownedGamesBody(A_GAMES))),
    );
  });

  it('sameUser is true', async () => {
    const result = await getComparison(ID_A, ID_A);
    expect(result.sameUser).toBe(true);
  });

  it('shared is null', async () => {
    const result = await getComparison(ID_A, ID_A);
    expect(result.shared).toBeNull();
  });

  it("sharedSkipped is 'same-user'", async () => {
    const result = await getComparison(ID_A, ID_A);
    expect(result.sharedSkipped).toBe('same-user');
  });

  it('both sides are still populated (cache hit for same id)', async () => {
    const result = await getComparison(ID_A, ID_A);
    expect(result.a.gamesCount).toBe(3);
    expect(result.b.gamesCount).toBe(3);
    expect(result.a.profile).not.toBeNull();
    expect(result.b.profile).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Case 4: Profile fetch failure for one side — still resolves
// ---------------------------------------------------------------------------

describe('getComparison – profile fetch failure for B', () => {
  beforeEach(() => {
    steamServer.use(
      http.get(PLAYER_SUMMARIES_URL, ({ request }) => {
        const steamids = new URL(request.url).searchParams.get('steamids') ?? '';
        // A's profile succeeds; B's returns a bad shape that will fail schema parse.
        if (steamids.includes(ID_A)) return HttpResponse.json(playerSummaryBody(ID_A));
        // Return empty players array — client throws schema error for missing player.
        return HttpResponse.json({ response: { players: [] } });
      }),

      http.get(OWNED_GAMES_URL, ({ request }) => {
        const steamid = new URL(request.url).searchParams.get('steamid');
        if (steamid === ID_A) return HttpResponse.json(ownedGamesBody(A_GAMES));
        if (steamid === ID_B) return HttpResponse.json(ownedGamesBody(B_GAMES));
        return new HttpResponse(null, { status: 400 });
      }),
    );
  });

  it('resolves without throwing', async () => {
    await expect(getComparison(ID_A, ID_B)).resolves.toBeDefined();
  });

  it("B's profile is null; A's profile is non-null", async () => {
    const result = await getComparison(ID_A, ID_B);
    expect(result.b.profile).toBeNull();
    expect(result.a.profile).not.toBeNull();
  });

  it("B's games are still available (games fetch succeeded independently)", async () => {
    const result = await getComparison(ID_A, ID_B);
    expect(result.b.gamesCount).toBe(3);
    expect(result.b.isPrivate).toBe(false);
  });

  it('shared games are computed despite B profile failure', async () => {
    const result = await getComparison(ID_A, ID_B);
    // Both games fetches succeeded, so shared should be computed.
    expect(result.shared).not.toBeNull();
    expect(result.sharedSkipped).toBeNull();
  });
});
