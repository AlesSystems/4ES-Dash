import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import playerSummariesFixture from '../fixtures/steam/player-summaries.json';
import ownedGamesFixture from '../fixtures/steam/owned-games.json';

// ---------------------------------------------------------------------------
// Default happy-path handlers
// ---------------------------------------------------------------------------

export const handlers = [
  http.get('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/', () =>
    HttpResponse.json(playerSummariesFixture),
  ),

  http.get('https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/', () =>
    HttpResponse.json(ownedGamesFixture),
  ),
];

/** MSW Node server — used in Vitest via the lifecycle hooks in tests/setup.ts. */
export const steamServer = setupServer(...handlers);
