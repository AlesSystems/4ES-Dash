/**
 * Tests for lib/steam/achievements.ts — the three Steam API client functions.
 *
 * MSW intercepts all HTTP calls. The default handlers below serve fixture data.
 * Per-test overrides use `steamServer.use(...)` + auto-reset in afterEach via
 * tests/setup.ts.
 */

import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isSteamApiError } from '@/lib/steam/errors';
import {
  getPlayerAchievements,
  getSchemaForGame,
  getGlobalAchievementPercentages,
} from '@/lib/steam/achievements';
import { steamServer } from '../mocks/steam-server';

import playerAchievementsFixture from '../fixtures/steam/player-achievements.json';
import schemaForGameFixture from '../fixtures/steam/schema-for-game.json';
import globalPercentagesFixture from '../fixtures/steam/global-achievement-percentages.json';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEAM_ID = '76561198000000000';
const APP_ID = 730;

const PLAYER_ACHIEVEMENTS_URL =
  'https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/';
const SCHEMA_FOR_GAME_URL = 'https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/';
const GLOBAL_PERCENTAGES_URL =
  'https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/';

// Re-register default handlers before each test because tests/setup.ts calls
// steamServer.resetHandlers() in afterEach, which clears per-test overrides
// (and any handlers added via steamServer.use() at runtime).
beforeEach(() => {
  steamServer.use(
    http.get(PLAYER_ACHIEVEMENTS_URL, () => HttpResponse.json(playerAchievementsFixture)),
    http.get(SCHEMA_FOR_GAME_URL, () => HttpResponse.json(schemaForGameFixture)),
    http.get(GLOBAL_PERCENTAGES_URL, () => HttpResponse.json(globalPercentagesFixture)),
  );
});

// ---------------------------------------------------------------------------
// getPlayerAchievements — happy path
// ---------------------------------------------------------------------------

describe('getPlayerAchievements – happy path', () => {
  it('returns available PlayerAchievement[] with correct field mapping', async () => {
    const result = await getPlayerAchievements(STEAM_ID, APP_ID);

    expect(result.available).toBe(true);
    if (!result.available) return;

    expect(result.data).toHaveLength(3);

    const win1 = result.data.find((a) => a.apiName === 'WIN_1_MATCH');
    expect(win1).toBeDefined();
    expect(win1!.unlocked).toBe(true);
    expect(win1!.unlockedAt).toBe(new Date(1700000000 * 1000).toISOString());

    const win10 = result.data.find((a) => a.apiName === 'WIN_10_MATCHES');
    expect(win10).toBeDefined();
    expect(win10!.unlocked).toBe(false);
    expect(win10!.unlockedAt).toBeNull();

    const firstKill = result.data.find((a) => a.apiName === 'FIRST_KILL');
    expect(firstKill).toBeDefined();
    expect(firstKill!.unlocked).toBe(true);
    expect(firstKill!.unlockedAt).toBe(new Date(1699900000 * 1000).toISOString());
  });
});

// ---------------------------------------------------------------------------
// getPlayerAchievements — private profile
// ---------------------------------------------------------------------------

describe('getPlayerAchievements – private profile', () => {
  it('returns unavailable("private") when success:false with "not public" error', async () => {
    steamServer.use(
      http.get(PLAYER_ACHIEVEMENTS_URL, () =>
        HttpResponse.json({
          playerstats: {
            success: false,
            error: 'Profile is not public',
          },
        }),
      ),
    );

    const result = await getPlayerAchievements(STEAM_ID, APP_ID);
    expect(result.available).toBe(false);
    if (result.available) return;
    expect(result.reason).toBe('private');
  });

  it('returns unavailable("private") when error message contains "profile"', async () => {
    steamServer.use(
      http.get(PLAYER_ACHIEVEMENTS_URL, () =>
        HttpResponse.json({
          playerstats: {
            success: false,
            error: 'Requested profile is private',
          },
        }),
      ),
    );

    const result = await getPlayerAchievements(STEAM_ID, APP_ID);
    expect(result.available).toBe(false);
    if (result.available) return;
    expect(result.reason).toBe('private');
  });
});

// ---------------------------------------------------------------------------
// getPlayerAchievements — no achievements
// ---------------------------------------------------------------------------

describe('getPlayerAchievements – no achievements', () => {
  it('returns unavailable("no-achievements") when success:false with stats error', async () => {
    steamServer.use(
      http.get(PLAYER_ACHIEVEMENTS_URL, () =>
        HttpResponse.json({
          playerstats: {
            success: false,
            error: 'Requested app has no stats',
          },
        }),
      ),
    );

    const result = await getPlayerAchievements(STEAM_ID, APP_ID);
    expect(result.available).toBe(false);
    if (result.available) return;
    expect(result.reason).toBe('no-achievements');
  });

  it('classifies a "no stats" error as no-achievements even if it mentions "profile"', async () => {
    steamServer.use(
      http.get(PLAYER_ACHIEVEMENTS_URL, () =>
        HttpResponse.json({
          playerstats: { success: false, error: 'Profile has no stats for this app' },
        }),
      ),
    );

    const result = await getPlayerAchievements(STEAM_ID, APP_ID);
    expect(result.available).toBe(false);
    if (result.available) return;
    expect(result.reason).toBe('no-achievements');
  });

  it('returns unavailable("no-achievements") when success:true but no achievements array', async () => {
    steamServer.use(
      http.get(PLAYER_ACHIEVEMENTS_URL, () =>
        HttpResponse.json({
          playerstats: {
            success: true,
            // No achievements key
          },
        }),
      ),
    );

    const result = await getPlayerAchievements(STEAM_ID, APP_ID);
    expect(result.available).toBe(false);
    if (result.available) return;
    expect(result.reason).toBe('no-achievements');
  });
});

// ---------------------------------------------------------------------------
// getPlayerAchievements — schema error
// ---------------------------------------------------------------------------

describe('getPlayerAchievements – schema error', () => {
  it('throws SteamApiError kind:schema when response shape is invalid', async () => {
    steamServer.use(
      http.get(PLAYER_ACHIEVEMENTS_URL, () => HttpResponse.json({ unexpected: 'shape' })),
    );

    await expect(getPlayerAchievements(STEAM_ID, APP_ID)).rejects.toSatisfy(
      (err: unknown) => isSteamApiError(err) && err.kind === 'schema',
    );
  });
});

// ---------------------------------------------------------------------------
// getPlayerAchievements — auth error
// ---------------------------------------------------------------------------

describe('getPlayerAchievements – auth error', () => {
  it('throws SteamApiError kind:auth on 401 and does not retry', async () => {
    let callCount = 0;
    steamServer.use(
      http.get(PLAYER_ACHIEVEMENTS_URL, () => {
        callCount++;
        return new HttpResponse(null, { status: 401 });
      }),
    );

    await expect(getPlayerAchievements(STEAM_ID, APP_ID)).rejects.toSatisfy(
      (err: unknown) => isSteamApiError(err) && err.kind === 'auth',
    );
    expect(callCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getPlayerAchievements — rate limit
// ---------------------------------------------------------------------------

describe('getPlayerAchievements – rate limit', () => {
  it('throws SteamApiError kind:rate_limit on 429 and does not retry', async () => {
    let callCount = 0;
    steamServer.use(
      http.get(PLAYER_ACHIEVEMENTS_URL, () => {
        callCount++;
        return new HttpResponse(null, { status: 429, headers: { 'Retry-After': '60' } });
      }),
    );

    await expect(getPlayerAchievements(STEAM_ID, APP_ID)).rejects.toSatisfy(
      (err: unknown) => isSteamApiError(err) && err.kind === 'rate_limit',
    );
    expect(callCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getPlayerAchievements — transient / 5xx + retry
// ---------------------------------------------------------------------------

describe('getPlayerAchievements – transient / 5xx', () => {
  it('retries then throws kind:transient after 4 attempts', async () => {
    let callCount = 0;
    steamServer.use(
      http.get(PLAYER_ACHIEVEMENTS_URL, () => {
        callCount++;
        return new HttpResponse(null, { status: 500 });
      }),
    );

    vi.useFakeTimers();
    try {
      const promise = getPlayerAchievements(STEAM_ID, APP_ID);
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

// ---------------------------------------------------------------------------
// getSchemaForGame — happy path
// ---------------------------------------------------------------------------

describe('getSchemaForGame – happy path', () => {
  it('returns AchievementSchema[] with correct field mapping', async () => {
    const schema = await getSchemaForGame(APP_ID);

    expect(schema).toHaveLength(3);

    const win1 = schema.find((s) => s.apiName === 'WIN_1_MATCH');
    expect(win1).toBeDefined();
    expect(win1!.displayName).toBe('Win One Match');
    expect(win1!.description).toBe('Win your first competitive match.');
    expect(win1!.iconUrl).toBe('https://cdn.steamstatic.com/steam/apps/730/win1match.jpg');
    expect(win1!.iconGrayUrl).toBe('https://cdn.steamstatic.com/steam/apps/730/win1match_gray.jpg');

    const firstKill = schema.find((s) => s.apiName === 'FIRST_KILL');
    expect(firstKill).toBeDefined();
    expect(firstKill!.displayName).toBe('First Blood');
  });
});

// ---------------------------------------------------------------------------
// getSchemaForGame — no achievements
// ---------------------------------------------------------------------------

describe('getSchemaForGame – no achievements', () => {
  it('returns empty array when game has no achievement stats', async () => {
    steamServer.use(http.get(SCHEMA_FOR_GAME_URL, () => HttpResponse.json({ game: {} })));

    const schema = await getSchemaForGame(APP_ID);
    expect(schema).toEqual([]);
  });

  it('returns empty array when response has no game key', async () => {
    steamServer.use(http.get(SCHEMA_FOR_GAME_URL, () => HttpResponse.json({})));

    const schema = await getSchemaForGame(APP_ID);
    expect(schema).toEqual([]);
  });

  it('returns empty array when achievements array is empty', async () => {
    steamServer.use(
      http.get(SCHEMA_FOR_GAME_URL, () =>
        HttpResponse.json({
          game: { availableGameStats: { achievements: [] } },
        }),
      ),
    );

    const schema = await getSchemaForGame(APP_ID);
    expect(schema).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getSchemaForGame — description optional
// ---------------------------------------------------------------------------

describe('getSchemaForGame – optional description', () => {
  it('defaults description to empty string when absent from response', async () => {
    steamServer.use(
      http.get(SCHEMA_FOR_GAME_URL, () =>
        HttpResponse.json({
          game: {
            availableGameStats: {
              achievements: [
                {
                  name: 'NO_DESC',
                  displayName: 'No Description',
                  // description absent
                  icon: 'https://example.com/icon.jpg',
                  icongray: 'https://example.com/icon_gray.jpg',
                },
              ],
            },
          },
        }),
      ),
    );

    const schema = await getSchemaForGame(APP_ID);
    expect(schema).toHaveLength(1);
    expect(schema[0]!.description).toBe('');
  });
});

// ---------------------------------------------------------------------------
// getSchemaForGame — schema error
// ---------------------------------------------------------------------------

describe('getSchemaForGame – schema error', () => {
  it('throws SteamApiError kind:schema when response shape is invalid', async () => {
    steamServer.use(
      http.get(SCHEMA_FOR_GAME_URL, () =>
        HttpResponse.json({
          game: {
            availableGameStats: {
              achievements: [{ invalid: 'shape' }],
            },
          },
        }),
      ),
    );

    await expect(getSchemaForGame(APP_ID)).rejects.toSatisfy(
      (err: unknown) => isSteamApiError(err) && err.kind === 'schema',
    );
  });
});

// ---------------------------------------------------------------------------
// getGlobalAchievementPercentages — happy path
// ---------------------------------------------------------------------------

describe('getGlobalAchievementPercentages – happy path', () => {
  it('returns Map<string, number> with correct entries', async () => {
    const result = await getGlobalAchievementPercentages(APP_ID);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(3);
    expect(result.get('WIN_1_MATCH')).toBe(72.5);
    expect(result.get('WIN_10_MATCHES')).toBe(48.3);
    expect(result.get('FIRST_KILL')).toBe(95.1);
  });
});

// ---------------------------------------------------------------------------
// getGlobalAchievementPercentages — degrade on failure
// ---------------------------------------------------------------------------

describe('getGlobalAchievementPercentages – degradation', () => {
  it('returns empty Map on 403 (no key endpoint — some apps restrict)', async () => {
    steamServer.use(
      http.get(GLOBAL_PERCENTAGES_URL, () => new HttpResponse(null, { status: 403 })),
    );

    const result = await getGlobalAchievementPercentages(APP_ID);
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });

  it('returns empty Map on 500 server error', async () => {
    steamServer.use(
      http.get(GLOBAL_PERCENTAGES_URL, () => new HttpResponse(null, { status: 500 })),
    );

    vi.useFakeTimers();
    let result: Map<string, number>;
    try {
      const promise = getGlobalAchievementPercentages(APP_ID);
      // Advance timers to drain retry backoff
      await vi.runAllTimersAsync();
      result = await promise;
    } finally {
      vi.useRealTimers();
    }
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });

  it('returns empty Map when response shape is unexpected', async () => {
    steamServer.use(
      http.get(GLOBAL_PERCENTAGES_URL, () => HttpResponse.json({ unexpected: 'shape' })),
    );

    const result = await getGlobalAchievementPercentages(APP_ID);
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });
});
