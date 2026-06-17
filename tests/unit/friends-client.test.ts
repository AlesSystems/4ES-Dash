import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { isSteamApiError } from '@/lib/steam/errors';
import {
  personaStateToStatus,
  sortFriends,
  getFriendList,
  getPlayerSummariesBatch,
} from '@/lib/steam/friends';
import type { FriendSummary } from '@/lib/steam/schemas';
import { steamServer } from '../mocks/steam-server';

// ---------------------------------------------------------------------------
// URLs under test
// ---------------------------------------------------------------------------

const FRIEND_LIST_URL = 'https://api.steampowered.com/ISteamUser/GetFriendList/v0001/';
const PLAYER_SUMMARIES_URL = 'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/';

const STEAM_ID = '76561198000000001';

// ---------------------------------------------------------------------------
// Helper: minimal FriendSummary factory
// ---------------------------------------------------------------------------

function makeFriend(overrides: Partial<FriendSummary>): FriendSummary {
  return {
    steamId: '1',
    personaName: 'Test',
    avatar: { small: '', medium: '', full: '' },
    profileUrl: '',
    status: 'online',
    inGame: false,
    playing: null,
    friendSince: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// personaStateToStatus — pure function
// ---------------------------------------------------------------------------

describe('personaStateToStatus', () => {
  it('maps 0 → offline', () => {
    expect(personaStateToStatus(0)).toBe('offline');
  });

  it('maps undefined → offline', () => {
    expect(personaStateToStatus(undefined)).toBe('offline');
  });

  it('maps 1 → online', () => {
    expect(personaStateToStatus(1)).toBe('online');
  });

  it('maps 5 (looking to trade) → online', () => {
    expect(personaStateToStatus(5)).toBe('online');
  });

  it('maps 6 (looking to play) → online', () => {
    expect(personaStateToStatus(6)).toBe('online');
  });

  it('maps 2 (busy) → away', () => {
    expect(personaStateToStatus(2)).toBe('away');
  });

  it('maps 3 (away) → away', () => {
    expect(personaStateToStatus(3)).toBe('away');
  });

  it('maps 4 (snooze) → away', () => {
    expect(personaStateToStatus(4)).toBe('away');
  });

  it('maps unknown state → offline', () => {
    expect(personaStateToStatus(99)).toBe('offline');
  });
});

// ---------------------------------------------------------------------------
// sortFriends — pure function
// ---------------------------------------------------------------------------

describe('sortFriends', () => {
  it('places non-offline friends before offline friends', () => {
    const input = [
      makeFriend({ steamId: '1', personaName: 'Charlie', status: 'offline' }),
      makeFriend({ steamId: '2', personaName: 'Alice', status: 'online' }),
      makeFriend({ steamId: '3', personaName: 'Bob', status: 'away' }),
    ];
    const sorted = sortFriends(input);

    // Alice and Bob are non-offline; Charlie is offline
    expect(sorted.map((f) => f.personaName)).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('sorts alphabetically within the non-offline group', () => {
    const input = [
      makeFriend({ steamId: '1', personaName: 'Zara', status: 'online' }),
      makeFriend({ steamId: '2', personaName: 'alice', status: 'away' }),
      makeFriend({ steamId: '3', personaName: 'Mike', status: 'online' }),
    ];
    const sorted = sortFriends(input);

    expect(sorted.map((f) => f.personaName.toLowerCase())).toEqual(['alice', 'mike', 'zara']);
  });

  it('sorts alphabetically within the offline group', () => {
    const input = [
      makeFriend({ steamId: '1', personaName: 'Zara', status: 'offline' }),
      makeFriend({ steamId: '2', personaName: 'Alice', status: 'offline' }),
    ];
    const sorted = sortFriends(input);

    expect(sorted.map((f) => f.personaName)).toEqual(['Alice', 'Zara']);
  });

  it('is case-insensitive when sorting', () => {
    const input = [
      makeFriend({ steamId: '1', personaName: 'bob', status: 'online' }),
      makeFriend({ steamId: '2', personaName: 'Alice', status: 'online' }),
    ];
    const sorted = sortFriends(input);

    expect(sorted.map((f) => f.personaName)).toEqual(['Alice', 'bob']);
  });

  it('does NOT mutate the input array', () => {
    const alice = makeFriend({ steamId: '1', personaName: 'Alice', status: 'offline' });
    const bob = makeFriend({ steamId: '2', personaName: 'Bob', status: 'online' });
    const input = [alice, bob];
    const original = [...input];

    sortFriends(input);

    expect(input).toEqual(original); // same order, same references
  });

  it('returns a new array instance', () => {
    const input = [makeFriend({ steamId: '1', personaName: 'Alice', status: 'online' })];
    const result = sortFriends(input);

    expect(result).not.toBe(input);
  });

  it('handles empty array', () => {
    expect(sortFriends([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getFriendList — async (uses MSW)
// ---------------------------------------------------------------------------

describe('getFriendList – happy path', () => {
  it('returns parsed friend stubs with correct steamId and friendSince', async () => {
    const unix = 1700000000;
    steamServer.use(
      http.get(FRIEND_LIST_URL, () =>
        HttpResponse.json({
          friendslist: {
            friends: [
              { steamid: '111', relationship: 'friend', friend_since: unix },
              { steamid: '222', relationship: 'friend', friend_since: 0 },
            ],
          },
        }),
      ),
    );

    const result = await getFriendList(STEAM_ID);

    expect(result).toHaveLength(2);

    const first = result.find((f) => f.steamId === '111');
    expect(first).toBeDefined();
    expect(first!.friendSince).toBe(new Date(unix * 1000).toISOString());

    const second = result.find((f) => f.steamId === '222');
    expect(second).toBeDefined();
    // friend_since 0 → null
    expect(second!.friendSince).toBeNull();
  });

  it('maps missing friend_since to null', async () => {
    steamServer.use(
      http.get(FRIEND_LIST_URL, () =>
        HttpResponse.json({
          friendslist: {
            friends: [{ steamid: '333' }],
          },
        }),
      ),
    );

    const result = await getFriendList(STEAM_ID);
    const [first] = result;
    expect(first?.friendSince).toBeNull();
  });
});

describe('getFriendList – private friend list (401)', () => {
  it('throws SteamApiError kind:private when Steam returns 401', async () => {
    steamServer.use(http.get(FRIEND_LIST_URL, () => new HttpResponse(null, { status: 401 })));

    await expect(getFriendList(STEAM_ID)).rejects.toSatisfy(
      (err: unknown) => isSteamApiError(err) && err.kind === 'private',
    );
  });
});

// ---------------------------------------------------------------------------
// getPlayerSummariesBatch — async (uses MSW)
// ---------------------------------------------------------------------------

describe('getPlayerSummariesBatch – happy path', () => {
  it('maps personastate → status correctly', async () => {
    steamServer.use(
      http.get(PLAYER_SUMMARIES_URL, () =>
        HttpResponse.json({
          response: {
            players: [
              {
                steamid: '100',
                personaname: 'Alpha',
                profileurl: 'https://steamcommunity.com/id/alpha/',
                avatar: 'https://avatars.steamstatic.com/a_small.jpg',
                avatarmedium: 'https://avatars.steamstatic.com/a_medium.jpg',
                avatarfull: 'https://avatars.steamstatic.com/a_full.jpg',
                personastate: 1, // online
              },
              {
                steamid: '101',
                personaname: 'Beta',
                profileurl: 'https://steamcommunity.com/id/beta/',
                avatar: 'https://avatars.steamstatic.com/b_small.jpg',
                avatarmedium: 'https://avatars.steamstatic.com/b_medium.jpg',
                avatarfull: 'https://avatars.steamstatic.com/b_full.jpg',
                personastate: 3, // away
              },
              {
                steamid: '102',
                personaname: 'Gamma',
                profileurl: 'https://steamcommunity.com/id/gamma/',
                avatar: 'https://avatars.steamstatic.com/c_small.jpg',
                avatarmedium: 'https://avatars.steamstatic.com/c_medium.jpg',
                avatarfull: 'https://avatars.steamstatic.com/c_full.jpg',
                personastate: 0, // offline
              },
            ],
          },
        }),
      ),
    );

    const result = await getPlayerSummariesBatch(['100', '101', '102']);

    expect(result).toHaveLength(3);

    const alpha = result.find((f) => f.steamId === '100');
    expect(alpha?.status).toBe('online');
    expect(alpha?.inGame).toBe(false);
    expect(alpha?.playing).toBeNull();
    expect(alpha?.friendSince).toBeNull();

    const beta = result.find((f) => f.steamId === '101');
    expect(beta?.status).toBe('away');

    const gamma = result.find((f) => f.steamId === '102');
    expect(gamma?.status).toBe('offline');
  });

  it('maps gameextrainfo + numeric gameid → playing object', async () => {
    steamServer.use(
      http.get(PLAYER_SUMMARIES_URL, () =>
        HttpResponse.json({
          response: {
            players: [
              {
                steamid: '200',
                personaname: 'Gamer',
                profileurl: 'https://steamcommunity.com/id/gamer/',
                avatar: 'https://avatars.steamstatic.com/g_small.jpg',
                avatarmedium: 'https://avatars.steamstatic.com/g_medium.jpg',
                avatarfull: 'https://avatars.steamstatic.com/g_full.jpg',
                personastate: 1,
                gameextrainfo: 'Counter-Strike 2',
                gameid: '730',
              },
            ],
          },
        }),
      ),
    );

    const result = await getPlayerSummariesBatch(['200']);
    const [gamer] = result;

    expect(gamer?.inGame).toBe(true);
    expect(gamer?.playing).toEqual({ appId: 730, name: 'Counter-Strike 2' });
  });

  it('maps non-numeric gameid (non-Steam game) → appId null', async () => {
    steamServer.use(
      http.get(PLAYER_SUMMARIES_URL, () =>
        HttpResponse.json({
          response: {
            players: [
              {
                steamid: '201',
                personaname: 'NonSteamer',
                profileurl: 'https://steamcommunity.com/id/ns/',
                avatar: 'https://avatars.steamstatic.com/ns_small.jpg',
                avatarmedium: 'https://avatars.steamstatic.com/ns_medium.jpg',
                avatarfull: 'https://avatars.steamstatic.com/ns_full.jpg',
                personastate: 1,
                gameextrainfo: 'A Non-Steam Game',
                gameid: 'non-steam-id',
              },
            ],
          },
        }),
      ),
    );

    const result = await getPlayerSummariesBatch(['201']);
    const [first] = result;
    expect(first?.playing).toEqual({ appId: null, name: 'A Non-Steam Game' });
    expect(first?.inGame).toBe(true);
  });

  it('returns [] without making any request when given empty array', async () => {
    // MSW is in onUnhandledRequest:'error' mode (set up in tests/setup.ts).
    // If a request were made, the test would fail automatically.
    const result = await getPlayerSummariesBatch([]);
    expect(result).toEqual([]);
  });
});

describe('getPlayerSummariesBatch – chunking (150 ids)', () => {
  it('makes 2 requests and returns all 150 friends', async () => {
    let requestCount = 0;

    // Each chunk returns 100 or 50 minimal player objects matching the ids
    // we can derive from the request URL.
    steamServer.use(
      http.get(PLAYER_SUMMARIES_URL, ({ request }) => {
        requestCount++;
        const url = new URL(request.url);
        const ids = url.searchParams.get('steamids')?.split(',') ?? [];

        const players = ids.map((id) => ({
          steamid: id,
          personaname: `Player_${id}`,
          profileurl: `https://steamcommunity.com/profiles/${id}/`,
          avatar: 'https://avatars.steamstatic.com/small.jpg',
          avatarmedium: 'https://avatars.steamstatic.com/medium.jpg',
          avatarfull: 'https://avatars.steamstatic.com/full.jpg',
          personastate: 1,
        }));

        return HttpResponse.json({ response: { players } });
      }),
    );

    const ids = Array.from({ length: 150 }, (_, i) => String(i + 1));
    const result = await getPlayerSummariesBatch(ids);

    expect(requestCount).toBe(2);
    expect(result).toHaveLength(150);
    // Spot-check a few to confirm ids are preserved correctly.
    expect(result.find((f) => f.steamId === '1')).toBeDefined();
    expect(result.find((f) => f.steamId === '100')).toBeDefined();
    expect(result.find((f) => f.steamId === '150')).toBeDefined();
  });
});
