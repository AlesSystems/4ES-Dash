/**
 * Integration tests for server/repositories/multiplayer.ts (theme-2 T3).
 *
 * Post-T3, getMultiplayerAppIds reads persisted `Game.categoryIds` (written by
 * the nightly job — T2) instead of fanning out one live Store `appdetails`
 * call per owned game. These tests therefore seed `Game` rows in the real
 * SQLite test DB (migrated by tests/global-setup.ts) and assert ZERO Store
 * calls. MSW still serves GetOwnedGames/GetPlayerSummaries (the retained
 * getProfile call); the store repository module is mocked so any call to it
 * is caught, and an MSW tripwire counts stray `appdetails` HTTP requests.
 *
 * Pre-rewrite case → DB-seeded equivalent (no case silently dropped):
 * - "mixed library" (MSW appdetails [1]/[2]/[9])
 *     → seeded rows categoryIds '[1]' / '[2]' / '[9]'.
 * - "metadata unavailable for one game" (success:false appdetails)
 *     → seeded row with categoryIds NULL (job saw the game, Store had
 *       nothing — T2 leaves the column untouched/null).
 * - "non-200 Store response for one game" (HTTP 500 appdetails)
 *     → NO Game row at all (network-level failure — the job never persisted
 *       the game).
 * - "empty library" → empty owned set, nothing seeded.
 * - "no-multiplayer library" (appdetails [2,22]) → seeded row '[2,22]'.
 * Plus new T3 cases: malformed stored JSON → missingCount (plan test #5) and
 * empty Game table degradation (plan test #6).
 *
 * DB hygiene: this file writes ONLY the `Game` table, using appIds in the
 * 8xxx range that no other suite touches (snapshot.test.ts upserts 730/570;
 * import-route.test.ts writes ManualGameData only).
 */

import { http, HttpResponse } from 'msw';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCache } from '@/server/cache';
import { prisma } from '@/server/db';
import { getMultiplayerAppIds } from '@/server/repositories/multiplayer';
import { steamServer } from '../mocks/steam-server';

// ---------------------------------------------------------------------------
// Store repository mock — the reader must NEVER call it (zero Store calls).
// ---------------------------------------------------------------------------

vi.mock('@/server/repositories/store');

import { getGameStoreMetadata, getGameStorePrice } from '@/server/repositories/store';

const mockGetGameStoreMetadata = vi.mocked(getGameStoreMetadata);
const mockGetGameStorePrice = vi.mocked(getGameStorePrice);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OWNED_GAMES_URL = 'https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/';
const PLAYER_SUMMARIES_URL = 'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/';
const APP_DETAILS_URL = 'https://store.steampowered.com/api/appdetails';

const STEAM_ID = '76561198000000001';

// Every appId this file may write — cleaned up around each test. Unique to
// this suite (8xxx) so concurrent DB-touching suites never collide.
const ALL_APP_IDS = [8101, 8102, 8103, 8201, 8202, 8301, 8302, 8401, 8501, 8502, 8503, 8601, 8602, 8603];

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
function playerSummaryBody(steamId = STEAM_ID) {
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

/** Seed one Game row; `categoryIds` is the raw stored string (or null). */
async function seedGame(appId: number, categoryIds: string | null): Promise<void> {
  await prisma.game.create({
    data: { appId, name: `Game ${appId}`, genres: '[]', categoryIds },
  });
}

/** Register the profile handlers for a given owned library. */
function useOwnedLibrary(appIds: number[]): void {
  steamServer.use(
    http.get(PLAYER_SUMMARIES_URL, () => HttpResponse.json(playerSummaryBody())),
    http.get(OWNED_GAMES_URL, () =>
      HttpResponse.json(ownedGamesBody(appIds.map((appid) => ({ appid })))),
    ),
  );
}

// ---------------------------------------------------------------------------
// Setup — zero-Store-call tripwires apply to EVERY test in this file.
// ---------------------------------------------------------------------------

let appDetailsRequests = 0;

beforeEach(async () => {
  clearCache();
  vi.clearAllMocks();
  appDetailsRequests = 0;
  // Tripwire: any appdetails HTTP request (e.g. a future inline fetch or a
  // direct store-client call) is counted; every test asserts the count is 0.
  steamServer.use(
    http.get(APP_DETAILS_URL, () => {
      appDetailsRequests++;
      return new HttpResponse(null, { status: 500 });
    }),
  );
  await prisma.game.deleteMany({ where: { appId: { in: ALL_APP_IDS } } });
});

afterEach(() => {
  // The reader must never touch the store repository or the Store host.
  expect(mockGetGameStoreMetadata).not.toHaveBeenCalled();
  expect(mockGetGameStorePrice).not.toHaveBeenCalled();
  expect(appDetailsRequests).toBe(0);
});

afterAll(async () => {
  await prisma.game.deleteMany({ where: { appId: { in: ALL_APP_IDS } } });
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// Case 1 (plan test #4): mixed library, classified from persisted rows
// ---------------------------------------------------------------------------

describe('getMultiplayerAppIds – mixed library from persisted Game.categoryIds', () => {
  const APP_A = 8101; // categoryIds [1] (Multi-player) → multiplayer
  const APP_B = 8102; // categoryIds [2] (not multiplayer)
  const APP_C = 8103; // categoryIds [9] (Co-op) → multiplayer

  beforeEach(async () => {
    useOwnedLibrary([APP_A, APP_B, APP_C]);
    await seedGame(APP_A, JSON.stringify([1]));
    await seedGame(APP_B, JSON.stringify([2]));
    await seedGame(APP_C, JSON.stringify([9]));
  });

  it('classifies from persisted Game.categoryIds without any Store call', async () => {
    const result = await getMultiplayerAppIds(STEAM_ID);

    expect(result.multiplayerAppIds.has(APP_A)).toBe(true);
    expect(result.multiplayerAppIds.has(APP_C)).toBe(true);
    expect(result.multiplayerAppIds.has(APP_B)).toBe(false);
    expect(result.multiplayerAppIds.size).toBe(2);
    // Zero Store calls — the afterEach tripwires re-assert this globally.
    expect(mockGetGameStoreMetadata).not.toHaveBeenCalled();
    expect(appDetailsRequests).toBe(0);
    expect(result.stale).toBe(false);
  });

  it('missingCount is 0 when every owned game has persisted categoryIds', async () => {
    const result = await getMultiplayerAppIds(STEAM_ID);
    expect(result.missingCount).toBe(0);
  });

  it('stale is always false — the DB read carries no stale-while-revalidate signal', async () => {
    const result = await getMultiplayerAppIds(STEAM_ID);
    expect(result.stale).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Case 2: never-categorized game (row exists, categoryIds NULL — the T2
// unavailable-metadata outcome). Pre-rewrite: "metadata unavailable".
// ---------------------------------------------------------------------------

describe('getMultiplayerAppIds – null categoryIds (never categorized by the job)', () => {
  const APP_GOOD = 8201; // categoryIds [1] → multiplayer
  const APP_MISSING = 8202; // row exists, categoryIds null

  beforeEach(async () => {
    useOwnedLibrary([APP_GOOD, APP_MISSING]);
    await seedGame(APP_GOOD, JSON.stringify([1]));
    await seedGame(APP_MISSING, null);
  });

  it('null-categoryIds game is NOT in the multiplayer set', async () => {
    const result = await getMultiplayerAppIds(STEAM_ID);
    expect(result.multiplayerAppIds.has(APP_MISSING)).toBe(false);
  });

  it('missingCount is 1', async () => {
    const result = await getMultiplayerAppIds(STEAM_ID);
    expect(result.missingCount).toBe(1);
  });

  it('categorized multiplayer game IS in the set', async () => {
    const result = await getMultiplayerAppIds(STEAM_ID);
    expect(result.multiplayerAppIds.has(APP_GOOD)).toBe(true);
    expect(result.multiplayerAppIds.size).toBe(1);
  });

  it('resolves without throwing', async () => {
    await expect(getMultiplayerAppIds(STEAM_ID)).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Case 2b: owned game with NO Game row at all (the job never reached it —
// pre-rewrite: "non-200 Store response", network-level unavailability).
// ---------------------------------------------------------------------------

describe('getMultiplayerAppIds – owned game missing from the Game table', () => {
  const APP_OK = 8301; // categoryIds [27] (Cross-Platform Multiplayer)
  const APP_NO_ROW = 8302; // no Game row seeded

  beforeEach(async () => {
    useOwnedLibrary([APP_OK, APP_NO_ROW]);
    await seedGame(APP_OK, JSON.stringify([27]));
  });

  it('row-less game is excluded from the multiplayer set and counted as missing', async () => {
    const result = await getMultiplayerAppIds(STEAM_ID);
    expect(result.multiplayerAppIds.has(APP_NO_ROW)).toBe(false);
    expect(result.missingCount).toBe(1);
  });

  it('the persisted multiplayer game (id=27) is in the set', async () => {
    const result = await getMultiplayerAppIds(STEAM_ID);
    expect(result.multiplayerAppIds.has(APP_OK)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Case 3 (plan test #5): malformed / never-refreshed rows → missingCount
// ---------------------------------------------------------------------------

describe('getMultiplayerAppIds – malformed and null categoryIds', () => {
  const APP_NULL = 8501; // never refreshed
  const APP_MALFORMED = 8502; // stored JSON does not parse
  const APP_VALID = 8503; // categoryIds [1] → multiplayer

  beforeEach(async () => {
    useOwnedLibrary([APP_NULL, APP_MALFORMED, APP_VALID]);
    await seedGame(APP_NULL, null);
    await seedGame(APP_MALFORMED, 'not-json{');
    await seedGame(APP_VALID, JSON.stringify([1]));
  });

  it('counts never-refreshed (null) and malformed categoryIds into missingCount', async () => {
    const result = await getMultiplayerAppIds(STEAM_ID);

    expect(result.missingCount).toBe(2);
    expect(result.multiplayerAppIds.has(APP_NULL)).toBe(false);
    expect(result.multiplayerAppIds.has(APP_MALFORMED)).toBe(false);
    // Malformed stored data degrades — it never crashes and never classifies.
    expect(result.multiplayerAppIds.has(APP_VALID)).toBe(true);
    expect(result.multiplayerAppIds.size).toBe(1);
    expect(result.stale).toBe(false);
  });

  it('treats a parseable-but-wrong shape (non-number elements) as missing', async () => {
    await prisma.game.update({
      where: { appId: APP_MALFORMED },
      data: { categoryIds: '[1, "x"]' }, // valid JSON, invalid shape
    });

    const result = await getMultiplayerAppIds(STEAM_ID);
    expect(result.multiplayerAppIds.has(APP_MALFORMED)).toBe(false);
    expect(result.missingCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Case 4 (plan test #6): empty Game table → designed degradation, no throw
// ---------------------------------------------------------------------------

describe('getMultiplayerAppIds – empty Game table', () => {
  const OWNED = [8601, 8602, 8603];

  beforeEach(() => {
    useOwnedLibrary(OWNED);
    // Nothing seeded — e.g. the first post-deploy nightly job has not run yet.
  });

  it('empty Game table degrades to all-uncategorized, never throws', async () => {
    const result = await getMultiplayerAppIds(STEAM_ID);

    expect(result.multiplayerAppIds.size).toBe(0);
    expect(result.missingCount).toBe(OWNED.length);
    expect(result.stale).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Case 5: empty / no-multiplayer library (pre-rewrite cases preserved)
// ---------------------------------------------------------------------------

describe('getMultiplayerAppIds – empty library', () => {
  beforeEach(() => {
    useOwnedLibrary([]);
  });

  it('returns an empty set with missingCount 0', async () => {
    const result = await getMultiplayerAppIds(STEAM_ID);
    expect(result.multiplayerAppIds.size).toBe(0);
    expect(result.missingCount).toBe(0);
    expect(result.stale).toBe(false);
  });
});

describe('getMultiplayerAppIds – no-multiplayer library', () => {
  const APP_SINGLE = 8401; // categoryIds [2, 22] — positive data, no multiplayer ids

  beforeEach(async () => {
    useOwnedLibrary([APP_SINGLE]);
    await seedGame(APP_SINGLE, JSON.stringify([2, 22]));
  });

  it('returns an empty set when no game has a multiplayer category', async () => {
    const result = await getMultiplayerAppIds(STEAM_ID);
    // A well-formed empty/non-multiplayer array is POSITIVE data: classified
    // non-multiplayer, NOT missing.
    expect(result.multiplayerAppIds.size).toBe(0);
    expect(result.missingCount).toBe(0);
  });
});
