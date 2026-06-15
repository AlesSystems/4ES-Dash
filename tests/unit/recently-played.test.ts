import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { isSteamApiError } from '@/lib/steam/errors';
import { getRecentlyPlayedGames } from '@/lib/steam/recently-played';
import { steamServer } from '../mocks/steam-server';
import recentlyPlayedFixture from '../fixtures/steam/recently-played.json';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STEAM_ID = '76561198000000000';
const RECENTLY_PLAYED_URL =
  'https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/';

// ---------------------------------------------------------------------------
// Happy path — fixture with two games
// ---------------------------------------------------------------------------

describe('getRecentlyPlayedGames – happy path', () => {
  it('maps fixture to RecentGame[] with correct URLs and minutes', async () => {
    steamServer.use(http.get(RECENTLY_PLAYED_URL, () => HttpResponse.json(recentlyPlayedFixture)));

    const games = await getRecentlyPlayedGames(STEAM_ID);

    expect(games).toHaveLength(2);

    // CS2 — has img_icon_url
    const cs2 = games.find((g) => g.appId === 730);
    expect(cs2).toBeDefined();
    expect(cs2!.name).toBe('Counter-Strike 2');
    expect(cs2!.twoWeeksMinutes).toBe(240);
    expect(cs2!.totalMinutes).toBe(23410);
    expect(cs2!.headerUrl).toBe('https://cdn.akamai.steamstatic.com/steam/apps/730/header.jpg');
    expect(cs2!.iconUrl).toBe(
      'https://media.steampowered.com/steamcommunity/public/images/apps/730/abc123.jpg',
    );

    // Dota 2 — missing img_icon_url → iconUrl should be null
    const dota = games.find((g) => g.appId === 570);
    expect(dota).toBeDefined();
    expect(dota!.name).toBe('Dota 2');
    expect(dota!.twoWeeksMinutes).toBe(60);
    expect(dota!.totalMinutes).toBe(5000);
    expect(dota!.headerUrl).toBe('https://cdn.akamai.steamstatic.com/steam/apps/570/header.jpg');
    expect(dota!.iconUrl).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Empty — no games key
// ---------------------------------------------------------------------------

describe('getRecentlyPlayedGames – no games', () => {
  it('returns [] when response has no games key (user has not played recently)', async () => {
    steamServer.use(
      http.get(RECENTLY_PLAYED_URL, () => HttpResponse.json({ response: { total_count: 0 } })),
    );

    const games = await getRecentlyPlayedGames(STEAM_ID);
    expect(games).toEqual([]);
  });

  it('returns [] when games array is empty', async () => {
    steamServer.use(
      http.get(RECENTLY_PLAYED_URL, () =>
        HttpResponse.json({ response: { total_count: 0, games: [] } }),
      ),
    );

    const games = await getRecentlyPlayedGames(STEAM_ID);
    expect(games).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Schema error — bad shape
// ---------------------------------------------------------------------------

describe('getRecentlyPlayedGames – schema error', () => {
  it('throws SteamApiError kind:schema when response shape is invalid', async () => {
    steamServer.use(
      http.get(RECENTLY_PLAYED_URL, () =>
        HttpResponse.json({ response: { games: [{ appid: 'not-a-number' }] } }),
      ),
    );

    await expect(getRecentlyPlayedGames(STEAM_ID)).rejects.toSatisfy(
      (err: unknown) => isSteamApiError(err) && err.kind === 'schema',
    );
  });

  it('throws SteamApiError kind:schema when top-level shape is wrong', async () => {
    steamServer.use(http.get(RECENTLY_PLAYED_URL, () => HttpResponse.json({ wrong: true })));

    await expect(getRecentlyPlayedGames(STEAM_ID)).rejects.toSatisfy(
      (err: unknown) => isSteamApiError(err) && err.kind === 'schema',
    );
  });
});

// ---------------------------------------------------------------------------
// Transient (5xx) + retry exhaustion
// ---------------------------------------------------------------------------

describe('getRecentlyPlayedGames – transient / 5xx', () => {
  it('retries then throws kind:transient after 4 attempts (1 initial + 3 retries)', async () => {
    let callCount = 0;
    steamServer.use(
      http.get(RECENTLY_PLAYED_URL, () => {
        callCount++;
        return new HttpResponse(null, { status: 500 });
      }),
    );

    vi.useFakeTimers();
    try {
      const promise = getRecentlyPlayedGames(STEAM_ID);
      const assertion = expect(promise).rejects.toSatisfy(
        (err: unknown) => isSteamApiError(err) && err.kind === 'transient',
      );
      await vi.runAllTimersAsync();
      await assertion;
    } finally {
      vi.useRealTimers();
    }

    expect(callCount).toBe(4);
  });
});
