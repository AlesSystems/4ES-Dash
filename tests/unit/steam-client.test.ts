import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { isSteamApiError } from '@/lib/steam/errors';
import { getOwnedGames, getPlayerSummaries } from '@/lib/steam/client';
import { steamServer } from '../mocks/steam-server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STEAM_ID = '76561198000000000';

const OWNED_GAMES_URL = 'https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/';
const PLAYER_SUMMARIES_URL = 'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/';

// ---------------------------------------------------------------------------
// Happy-path tests (default MSW handlers serve the fixture data)
// ---------------------------------------------------------------------------

describe('getOwnedGames – happy path', () => {
  it('returns parsed OwnedGame array with correct field mapping', async () => {
    const games = await getOwnedGames(STEAM_ID);

    expect(games).toHaveLength(2);

    // CS2 — has all optional fields
    const cs2 = games.find((g) => g.appId === 730);
    expect(cs2).toBeDefined();
    expect(cs2!.name).toBe('Counter-Strike 2');
    expect(cs2!.iconUrl).toBe(
      'https://media.steampowered.com/steamcommunity/public/images/apps/730/abc123.jpg',
    );
    expect(cs2!.headerUrl).toBe('https://cdn.akamai.steamstatic.com/steam/apps/730/header.jpg');
    expect(cs2!.playtime.total).toBe(23410);
    expect(cs2!.playtime.twoWeeks).toBe(120);
    expect(cs2!.hasAchievements).toBe(true);
    // rtime_last_played 1715724780 → ISO string
    expect(cs2!.lastPlayed).toBe(new Date(1715724780 * 1000).toISOString());

    // Dota 2 — missing optional fields default correctly
    const dota = games.find((g) => g.appId === 570);
    expect(dota).toBeDefined();
    expect(dota!.name).toBe('Dota 2');
    expect(dota!.playtime.twoWeeks).toBe(0); // missing playtime_2weeks → 0
    expect(dota!.lastPlayed).toBeNull(); // no rtime_last_played
    expect(dota!.hasAchievements).toBe(false); // has_community_visible_stats absent → false
    expect(dota!.iconUrl).toBe(
      'https://media.steampowered.com/steamcommunity/public/images/apps/570/def456.jpg',
    );
  });
});

describe('getPlayerSummaries – happy path', () => {
  it('returns mapped PlayerSummary with ISO createdAt', async () => {
    const player = await getPlayerSummaries(STEAM_ID);

    expect(player.steamId).toBe('76561198000000000');
    expect(player.personaName).toBe('Ales');
    expect(player.avatar.small).toContain('avatars.steamstatic.com');
    expect(player.avatar.medium).toContain('medium');
    expect(player.avatar.full).toContain('full');
    expect(player.countryCode).toBe('US');
    // timecreated 1208044800 → ISO string
    expect(player.createdAt).toBe(new Date(1208044800 * 1000).toISOString());
  });
});

// ---------------------------------------------------------------------------
// Private profile
// ---------------------------------------------------------------------------

describe('getOwnedGames – private profile', () => {
  it('throws SteamApiError kind:private when response has no games key', async () => {
    steamServer.use(http.get(OWNED_GAMES_URL, () => HttpResponse.json({ response: {} })));

    await expect(getOwnedGames(STEAM_ID)).rejects.toSatisfy(
      (err: unknown) => isSteamApiError(err) && err.kind === 'private',
    );
  });
});

// ---------------------------------------------------------------------------
// Schema mismatch
// ---------------------------------------------------------------------------

describe('getOwnedGames – schema error', () => {
  it('throws SteamApiError kind:schema when game shape is invalid', async () => {
    steamServer.use(
      http.get(OWNED_GAMES_URL, () =>
        HttpResponse.json({
          response: { games: [{ appid: 'not-a-number' }] },
        }),
      ),
    );

    await expect(getOwnedGames(STEAM_ID)).rejects.toSatisfy(
      (err: unknown) => isSteamApiError(err) && err.kind === 'schema',
    );
  });
});

// ---------------------------------------------------------------------------
// Transient (5xx) + retry exhaustion
// ---------------------------------------------------------------------------

describe('getOwnedGames – transient / 5xx', () => {
  it('retries and ultimately throws kind:transient after 3 attempts', async () => {
    // Use zero backoffs to keep the test fast.
    const zeroBackoff = [0, 0, 0];
    let callCount = 0;

    steamServer.use(
      http.get(OWNED_GAMES_URL, () => {
        callCount++;
        return new HttpResponse(null, { status: 500 });
      }),
    );

    // Patch withRetry via the module to use zero backoff — instead, we call
    // the internal retry indirectly.  The simplest approach: use fake timers.
    vi.useFakeTimers();

    const promise = getOwnedGames(STEAM_ID);

    // Advance through each retry delay (default 250, 1000, 4000 ms).
    // We flush all pending timers repeatedly until the promise settles.
    let settled = false;
    const check = promise.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );

    // Drain all micro/macro tasks including timer delays.
    for (let i = 0; i < 20 && !settled; i++) {
      await vi.runAllTimersAsync();
    }

    await check;
    vi.useRealTimers();

    await expect(promise).rejects.toSatisfy(
      (err: unknown) => isSteamApiError(err) && err.kind === 'transient',
    );

    // 3 total attempts (initial + 2 retries)
    expect(callCount).toBe(3);

    void zeroBackoff; // suppress unused-var lint
  });
});

// ---------------------------------------------------------------------------
// Auth (401) — must NOT retry
// ---------------------------------------------------------------------------

describe('getOwnedGames – auth error', () => {
  it('throws kind:auth and does not retry on 401', async () => {
    let callCount = 0;

    steamServer.use(
      http.get(OWNED_GAMES_URL, () => {
        callCount++;
        return new HttpResponse(null, { status: 401 });
      }),
    );

    await expect(getOwnedGames(STEAM_ID)).rejects.toSatisfy(
      (err: unknown) => isSteamApiError(err) && err.kind === 'auth',
    );

    // auth is non-retryable — handler must be called exactly once.
    expect(callCount).toBe(1);
  });
});
