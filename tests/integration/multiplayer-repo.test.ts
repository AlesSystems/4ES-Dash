/**
 * Integration tests for server/repositories/multiplayer.ts
 *
 * Calls getMultiplayerAppIds() directly. MSW intercepts all Steam/Store HTTP
 * calls. No real network or env secrets needed.
 *
 * Pattern: override GetOwnedGames to return a small library, then override the
 * Store appdetails endpoint to return per-app category payloads (inspecting
 * the `appids` query param to route per-game responses).
 */

import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearCache } from '@/server/cache';
import { getMultiplayerAppIds } from '@/server/repositories/multiplayer';
import { steamServer } from '../mocks/steam-server';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OWNED_GAMES_URL = 'https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/';
const PLAYER_SUMMARIES_URL = 'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/';
const APP_DETAILS_URL = 'https://store.steampowered.com/api/appdetails';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/** Minimal GetOwnedGames response body. */
function ownedGamesBody(games: Array<{ appid: number; playtime_forever?: number }>) {
  return {
    response: {
      game_count: games.length,
      games: games.map((g) => ({
        appid: g.appid,
        name: `Game ${g.appid}`,
        playtime_forever: g.playtime_forever ?? 0,
        img_icon_url: `icon${g.appid}`,
        has_community_visible_stats: false,
      })),
    },
  };
}

/** Minimal GetPlayerSummaries response body. */
function playerSummaryBody(steamId = '76561198000000001') {
  return {
    response: {
      players: [
        {
          steamid: steamId,
          communityvisibilitystate: 3,
          profilestate: 1,
          personaname: 'TestUser',
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

/**
 * Build a success:true appdetails response body for the given appId with the
 * supplied category ids.
 */
function appDetailsBody(appId: number, categoryIds: number[]) {
  return {
    [String(appId)]: {
      success: true,
      data: {
        name: `Game ${appId}`,
        short_description: '',
        header_image: '',
        genres: [],
        categories: categoryIds.map((id) => ({ id, description: `Cat ${id}` })),
        developers: [],
        publishers: [],
        release_date: { coming_soon: false, date: '1 Jan, 2020' },
        platforms: { windows: true, mac: false, linux: false },
      },
    },
  };
}

/** Build a success:false appdetails response body (simulates unavailable). */
function appDetailsUnavailableBody(appId: number) {
  return {
    [String(appId)]: { success: false },
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => clearCache());

// ---------------------------------------------------------------------------
// Case 1: Mixed library — multiplayer, non-multiplayer, co-op
// ---------------------------------------------------------------------------

describe('getMultiplayerAppIds – mixed library', () => {
  const APP_A = 1001; // categories: [1] (Multi-player) → multiplayer
  const APP_B = 1002; // categories: [2] (not multiplayer)
  const APP_C = 1003; // categories: [9] (Co-op) → multiplayer

  beforeEach(() => {
    steamServer.use(
      http.get(PLAYER_SUMMARIES_URL, () => HttpResponse.json(playerSummaryBody())),

      http.get(OWNED_GAMES_URL, () =>
        HttpResponse.json(ownedGamesBody([{ appid: APP_A }, { appid: APP_B }, { appid: APP_C }])),
      ),

      http.get(APP_DETAILS_URL, ({ request }) => {
        const appids = new URL(request.url).searchParams.get('appids');
        if (appids === String(APP_A)) return HttpResponse.json(appDetailsBody(APP_A, [1]));
        if (appids === String(APP_B)) return HttpResponse.json(appDetailsBody(APP_B, [2]));
        if (appids === String(APP_C)) return HttpResponse.json(appDetailsBody(APP_C, [9]));
        return new HttpResponse(null, { status: 400 });
      }),
    );
  });

  it('multiplayerAppIds contains A and C but not B', async () => {
    const result = await getMultiplayerAppIds();

    expect(result.multiplayerAppIds.has(APP_A)).toBe(true);
    expect(result.multiplayerAppIds.has(APP_C)).toBe(true);
    expect(result.multiplayerAppIds.has(APP_B)).toBe(false);
    expect(result.multiplayerAppIds.size).toBe(2);
  });

  it('missingCount is 0 when all metadata is available', async () => {
    const result = await getMultiplayerAppIds();
    expect(result.missingCount).toBe(0);
  });

  it('stale is false when no result is stale', async () => {
    const result = await getMultiplayerAppIds();
    expect(result.stale).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Case 2: One game's Store metadata is unavailable
// ---------------------------------------------------------------------------

describe('getMultiplayerAppIds – metadata unavailable for one game', () => {
  const APP_GOOD = 2001; // categories: [1] → multiplayer
  const APP_MISSING = 2002; // metadata unavailable

  beforeEach(() => {
    steamServer.use(
      http.get(PLAYER_SUMMARIES_URL, () => HttpResponse.json(playerSummaryBody())),

      http.get(OWNED_GAMES_URL, () =>
        HttpResponse.json(ownedGamesBody([{ appid: APP_GOOD }, { appid: APP_MISSING }])),
      ),

      http.get(APP_DETAILS_URL, ({ request }) => {
        const appids = new URL(request.url).searchParams.get('appids');
        if (appids === String(APP_GOOD)) return HttpResponse.json(appDetailsBody(APP_GOOD, [1]));
        if (appids === String(APP_MISSING))
          return HttpResponse.json(appDetailsUnavailableBody(APP_MISSING));
        return new HttpResponse(null, { status: 400 });
      }),
    );
  });

  it('unavailable game is NOT in the multiplayer set', async () => {
    const result = await getMultiplayerAppIds();
    expect(result.multiplayerAppIds.has(APP_MISSING)).toBe(false);
  });

  it('missingCount is 1', async () => {
    const result = await getMultiplayerAppIds();
    expect(result.missingCount).toBe(1);
  });

  it('available multiplayer game IS in the set', async () => {
    const result = await getMultiplayerAppIds();
    expect(result.multiplayerAppIds.has(APP_GOOD)).toBe(true);
    expect(result.multiplayerAppIds.size).toBe(1);
  });

  it('resolves without throwing', async () => {
    await expect(getMultiplayerAppIds()).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Case 2b: Store returns HTTP 500 for one game (network-level unavailability)
// ---------------------------------------------------------------------------

describe('getMultiplayerAppIds – non-200 Store response for one game', () => {
  const APP_OK = 3001;
  const APP_ERROR = 3002;

  beforeEach(() => {
    steamServer.use(
      http.get(PLAYER_SUMMARIES_URL, () => HttpResponse.json(playerSummaryBody())),

      http.get(OWNED_GAMES_URL, () =>
        HttpResponse.json(ownedGamesBody([{ appid: APP_OK }, { appid: APP_ERROR }])),
      ),

      http.get(APP_DETAILS_URL, ({ request }) => {
        const appids = new URL(request.url).searchParams.get('appids');
        if (appids === String(APP_OK)) return HttpResponse.json(appDetailsBody(APP_OK, [27])); // Cross-Platform Multiplayer
        if (appids === String(APP_ERROR)) return new HttpResponse(null, { status: 500 });
        return new HttpResponse(null, { status: 400 });
      }),
    );
  });

  it('HTTP-error game is excluded from multiplayer set and counted as missing', async () => {
    const result = await getMultiplayerAppIds();
    expect(result.multiplayerAppIds.has(APP_ERROR)).toBe(false);
    expect(result.missingCount).toBe(1);
  });

  it('the successful multiplayer game (id=27) is in the set', async () => {
    const result = await getMultiplayerAppIds();
    expect(result.multiplayerAppIds.has(APP_OK)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Case 3: Empty / none-multiplayer library
// ---------------------------------------------------------------------------

describe('getMultiplayerAppIds – empty library', () => {
  beforeEach(() => {
    steamServer.use(
      http.get(PLAYER_SUMMARIES_URL, () => HttpResponse.json(playerSummaryBody())),
      http.get(OWNED_GAMES_URL, () => HttpResponse.json(ownedGamesBody([]))),
    );
  });

  it('returns an empty set with missingCount 0', async () => {
    const result = await getMultiplayerAppIds();
    expect(result.multiplayerAppIds.size).toBe(0);
    expect(result.missingCount).toBe(0);
    expect(result.stale).toBe(false);
  });
});

describe('getMultiplayerAppIds – no-multiplayer library', () => {
  const APP_SINGLE = 4001; // solo game only

  beforeEach(() => {
    steamServer.use(
      http.get(PLAYER_SUMMARIES_URL, () => HttpResponse.json(playerSummaryBody())),

      http.get(OWNED_GAMES_URL, () => HttpResponse.json(ownedGamesBody([{ appid: APP_SINGLE }]))),

      http.get(APP_DETAILS_URL, ({ request }) => {
        const appids = new URL(request.url).searchParams.get('appids');
        if (appids === String(APP_SINGLE))
          return HttpResponse.json(appDetailsBody(APP_SINGLE, [2, 22])); // no multiplayer ids
        return new HttpResponse(null, { status: 400 });
      }),
    );
  });

  it('returns an empty set when no game has a multiplayer category', async () => {
    const result = await getMultiplayerAppIds();
    expect(result.multiplayerAppIds.size).toBe(0);
    expect(result.missingCount).toBe(0);
  });
});
