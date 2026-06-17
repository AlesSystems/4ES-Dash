import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import playerSummariesFixture from '../fixtures/steam/player-summaries.json';
import ownedGamesFixture from '../fixtures/steam/owned-games.json';
import recentlyPlayedFixture from '../fixtures/steam/recently-played.json';
import playerAchievementsFixture from '../fixtures/steam/player-achievements.json';
import schemaForGameFixture from '../fixtures/steam/schema-for-game.json';
import globalPercentagesFixture from '../fixtures/steam/global-achievement-percentages.json';
import appDetailsFixture from '../fixtures/steam/appdetails.json';
import friendListFixture from '../fixtures/steam/friend-list.json';

// ---------------------------------------------------------------------------
// Default happy-path handlers
// ---------------------------------------------------------------------------

const STEAM = 'https://api.steampowered.com';

export const handlers = [
  http.get(`${STEAM}/ISteamUser/GetPlayerSummaries/v2/`, () =>
    HttpResponse.json(playerSummariesFixture),
  ),

  http.get(`${STEAM}/IPlayerService/GetOwnedGames/v1/`, () => HttpResponse.json(ownedGamesFixture)),

  http.get(`${STEAM}/IPlayerService/GetRecentlyPlayedGames/v1/`, () =>
    HttpResponse.json(recentlyPlayedFixture),
  ),

  http.get(`${STEAM}/IPlayerService/GetSteamLevel/v1/`, () =>
    HttpResponse.json({ response: { player_level: 42 } }),
  ),

  http.get(`${STEAM}/ISteamUserStats/GetPlayerAchievements/v0001/`, () =>
    HttpResponse.json(playerAchievementsFixture),
  ),

  http.get(`${STEAM}/ISteamUserStats/GetSchemaForGame/v2/`, () =>
    HttpResponse.json(schemaForGameFixture),
  ),

  http.get(`${STEAM}/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/`, () =>
    HttpResponse.json(globalPercentagesFixture),
  ),

  // Undocumented Store JSON API (different host, no API key).
  http.get('https://store.steampowered.com/api/appdetails', () =>
    HttpResponse.json(appDetailsFixture),
  ),

  http.get('https://api.steampowered.com/ISteamUser/GetFriendList/v0001/', () =>
    HttpResponse.json(friendListFixture),
  ),
];

/** MSW Node server — used in Vitest via the lifecycle hooks in tests/setup.ts. */
export const steamServer = setupServer(...handlers);
