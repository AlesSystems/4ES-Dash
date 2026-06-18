/**
 * Task 04 acceptance test: session-scoped data layer.
 *
 * Proves:
 *  1. MissingSteamIdError is thrown (not a silent fallback) when steamId is blank/missing.
 *  2. Two different steamIds get isolated cache entries — user A's getProfile() call
 *     does NOT return user B's data, and vice versa.
 */

import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { MissingSteamIdError } from '@/server/repositories/require-steam-id';
import { getProfile } from '@/server/repositories/profile';
import { getLevel } from '@/server/repositories/level';
import { getFriends } from '@/server/repositories/friends';
import { getRecentlyPlayed } from '@/server/repositories/recently-played';
import { getGameAchievements } from '@/server/repositories/achievements';
import { clearCache } from '@/server/cache';
import { steamServer } from '../mocks/steam-server';

// Two distinct 17-digit SteamIDs
const STEAM_A = '76561198000000001';
const STEAM_B = '76561198000000002';

beforeEach(() => clearCache());

// ---------------------------------------------------------------------------
// 1. MissingSteamIdError — blank/missing steamId must throw typed error
// ---------------------------------------------------------------------------

describe('requireSteamId — typed error on blank input', () => {
  it('throws MissingSteamIdError when empty string is passed to getProfile', async () => {
    await expect(getProfile('')).rejects.toThrow(MissingSteamIdError);
  });

  it('throws MissingSteamIdError when empty string is passed to getLevel', async () => {
    await expect(getLevel('')).rejects.toThrow(MissingSteamIdError);
  });

  it('throws MissingSteamIdError when empty string is passed to getFriends', async () => {
    await expect(getFriends('')).rejects.toThrow(MissingSteamIdError);
  });

  it('throws MissingSteamIdError when empty string is passed to getRecentlyPlayed', async () => {
    await expect(getRecentlyPlayed('')).rejects.toThrow(MissingSteamIdError);
  });

  it('throws MissingSteamIdError when empty string is passed to getGameAchievements', async () => {
    await expect(getGameAchievements('', 730)).rejects.toThrow(MissingSteamIdError);
  });
});

// ---------------------------------------------------------------------------
// 2. Cache isolation — two steamIds must get isolated results
// ---------------------------------------------------------------------------

describe('cache isolation — two steamIds get their own data', () => {
  it('getProfile returns the correct personaName for each steamId', async () => {
    steamServer.use(
      http.get('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/', ({ request }) => {
        const steamids = new URL(request.url).searchParams.get('steamids');
        if (steamids === STEAM_A) {
          return HttpResponse.json({
            response: {
              players: [
                {
                  steamid: STEAM_A,
                  communityvisibilitystate: 3,
                  profilestate: 1,
                  personaname: 'UserAlpha',
                  profileurl: `https://steamcommunity.com/profiles/${STEAM_A}/`,
                  avatar: 'https://avatars.steamstatic.com/small.jpg',
                  avatarmedium: 'https://avatars.steamstatic.com/medium.jpg',
                  avatarfull: 'https://avatars.steamstatic.com/full.jpg',
                  avatarhash: 'abc',
                  personastate: 1,
                },
              ],
            },
          });
        }
        if (steamids === STEAM_B) {
          return HttpResponse.json({
            response: {
              players: [
                {
                  steamid: STEAM_B,
                  communityvisibilitystate: 3,
                  profilestate: 1,
                  personaname: 'UserBeta',
                  profileurl: `https://steamcommunity.com/profiles/${STEAM_B}/`,
                  avatar: 'https://avatars.steamstatic.com/small.jpg',
                  avatarmedium: 'https://avatars.steamstatic.com/medium.jpg',
                  avatarfull: 'https://avatars.steamstatic.com/full.jpg',
                  avatarhash: 'def',
                  personastate: 1,
                },
              ],
            },
          });
        }
        return new HttpResponse(null, { status: 400 });
      }),
    );

    const [resultA, resultB] = await Promise.all([getProfile(STEAM_A), getProfile(STEAM_B)]);

    // Each call returns the correct user's data — NOT the other user's
    expect(resultA.profile.personaName).toBe('UserAlpha');
    expect(resultB.profile.personaName).toBe('UserBeta');
    expect(resultA.profile.personaName).not.toBe(resultB.profile.personaName);
  });

  it('getProfile cache hit for A does not bleed into B', async () => {
    steamServer.use(
      http.get('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/', ({ request }) => {
        const steamids = new URL(request.url).searchParams.get('steamids');
        if (steamids === STEAM_A) {
          return HttpResponse.json({
            response: {
              players: [
                {
                  steamid: STEAM_A,
                  communityvisibilitystate: 3,
                  profilestate: 1,
                  personaname: 'UserAlpha',
                  profileurl: `https://steamcommunity.com/profiles/${STEAM_A}/`,
                  avatar: 'https://avatars.steamstatic.com/small.jpg',
                  avatarmedium: 'https://avatars.steamstatic.com/medium.jpg',
                  avatarfull: 'https://avatars.steamstatic.com/full.jpg',
                  avatarhash: 'abc',
                  personastate: 1,
                },
              ],
            },
          });
        }
        if (steamids === STEAM_B) {
          return HttpResponse.json({
            response: {
              players: [
                {
                  steamid: STEAM_B,
                  communityvisibilitystate: 3,
                  profilestate: 1,
                  personaname: 'UserBeta',
                  profileurl: `https://steamcommunity.com/profiles/${STEAM_B}/`,
                  avatar: 'https://avatars.steamstatic.com/small.jpg',
                  avatarmedium: 'https://avatars.steamstatic.com/medium.jpg',
                  avatarfull: 'https://avatars.steamstatic.com/full.jpg',
                  avatarhash: 'def',
                  personastate: 1,
                },
              ],
            },
          });
        }
        return new HttpResponse(null, { status: 400 });
      }),
    );

    // Prime the cache for A first
    const firstA = await getProfile(STEAM_A);
    expect(firstA.profile.personaName).toBe('UserAlpha');

    // Then fetch B — must get B's data, not A's cached result
    const firstB = await getProfile(STEAM_B);
    expect(firstB.profile.personaName).toBe('UserBeta');

    // Fetch A again from cache — must still return A's data
    const secondA = await getProfile(STEAM_A);
    expect(secondA.profile.personaName).toBe('UserAlpha');
  });
});
