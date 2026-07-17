/**
 * Tests for server/repositories/achievements.ts — the caching + short-circuit
 * layer over the Steam achievement clients.
 *
 * The key guarantee here (ERR-0003): when a game's per-user achievement data is
 * unavailable (private profile / no achievements), the repository must NOT spend
 * two extra rate-limited Steam calls fetching that game's schema + global
 * percentages. MSW call counters assert the skip.
 */

import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getGameAchievements } from '@/server/repositories/achievements';
import { cache, clearCache, TTL } from '@/server/cache';
import { steamServer } from '../mocks/steam-server';

// Wrap `cache` in a pass-through spy so we can assert the TTL each call site
// uses, without changing cache behaviour (real store, real single-flight).
vi.mock('@/server/cache', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/cache')>();
  return {
    ...actual,
    cache: vi.fn(actual.cache),
  };
});

const APP_ID = 730;
const PLAYER_URL = 'https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/';
const SCHEMA_URL = 'https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/';
const GLOBAL_URL =
  'https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/';

// Cache is process-global — clear it so each test starts cold and actually hits
// the (mocked) Steam endpoints.
beforeEach(() => clearCache());

describe('getGameAchievements – skip metadata when player data is unavailable', () => {
  it('does NOT fetch schema or global percentages when the profile is private (403)', async () => {
    let schemaCalls = 0;
    let globalCalls = 0;
    steamServer.use(
      http.get(PLAYER_URL, () =>
        HttpResponse.json(
          { playerstats: { error: 'Profile is not public', success: false } },
          { status: 403 },
        ),
      ),
      http.get(SCHEMA_URL, () => {
        schemaCalls++;
        return HttpResponse.json({ game: {} });
      }),
      http.get(GLOBAL_URL, () => {
        globalCalls++;
        return HttpResponse.json({ achievementpercentages: { achievements: [] } });
      }),
    );

    const result = await getGameAchievements('76561198000000000', APP_ID);

    expect(result.available).toBe(false);
    if (result.available) return;
    expect(result.reason).toBe('private');
    // The whole point of the optimization: the two metadata calls are skipped.
    expect(schemaCalls).toBe(0);
    expect(globalCalls).toBe(0);
  });

  it('still returns available achievement data on the happy path (reorder is safe)', async () => {
    // All three endpoints use the default fixture handlers (matching player +
    // schema + global data), so the merge succeeds.
    const result = await getGameAchievements('76561198000000000', APP_ID);

    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.data.total).toBeGreaterThan(0);
  });
});

describe('getGameAchievements – cache TTLs', () => {
  it('schema and global caches use dedicated reference TTLs; player cache unchanged', async () => {
    const cacheSpy = vi.mocked(cache);
    cacheSpy.mockClear();

    // Default fixture handlers — happy path so all three cache calls fire.
    const result = await getGameAchievements('76561198000000000', APP_ID);
    expect(result.available).toBe(true);

    // Per-user progress: unchanged 1 h TTL (ERR-0003 mitigation surface).
    expect(cacheSpy).toHaveBeenCalledWith(
      `steam:player-achievements:76561198000000000:${APP_ID}`,
      TTL.playerAchievements,
      expect.any(Function),
    );
    // Per-app reference data ('global' pseudo-steamId): dedicated longer TTLs.
    expect(cacheSpy).toHaveBeenCalledWith(
      `steam:achievement-schema:global:${APP_ID}`,
      TTL.achievementSchema,
      expect.any(Function),
    );
    expect(cacheSpy).toHaveBeenCalledWith(
      `steam:achievement-global:global:${APP_ID}`,
      TTL.achievementGlobal,
      expect.any(Function),
    );
    // The reference TTLs must actually differ from the per-user TTL — otherwise
    // this test would pass trivially if the new keys aliased 3600.
    expect(TTL.achievementSchema).toBeGreaterThan(TTL.playerAchievements);
    expect(TTL.achievementGlobal).toBeGreaterThan(TTL.playerAchievements);
  });
});
