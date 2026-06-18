/**
 * Hero fallback tests for app/game/[appId]/page.tsx
 *
 * When the game is not in the owned-games list (e.g. not owned or private profile),
 * the hero should fall back to store metadata (name + headerImage) if available,
 * and only use the generic `App {appId}` / CDN fallback as a last resort.
 *
 * These tests import the async RSC GameDetailPage directly and await it in jsdom,
 * following the same pattern as homepage.test.tsx.
 */
// @vitest-environment jsdom
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Async sub-components hit live Steam — stub them so the page resolves
// synchronously and without extra MSW handlers.
vi.mock('@/components/game/GameAchievementsSection', () => ({
  GameAchievementsSection: () => null,
}));
vi.mock('@/components/game/GameStoreSection', () => ({
  GameStoreSection: () => null,
}));

import GameDetailPage from '@/app/game/[appId]/page';
import { clearCache } from '@/server/cache';
import { steamServer } from '../../mocks/steam-server';

const OWNED_GAMES_URL = 'https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/';
const APP_DETAILS_URL = 'https://store.steampowered.com/api/appdetails';

// App 620 is NOT in the owned-games fixture (730, 570) but IS in the appdetails
// fixture as "Portal 2".
const NOT_OWNED_APP_ID = '620';

beforeEach(() => clearCache());

describe('GameDetailPage hero — store-metadata fallback when game is not owned', () => {
  it('uses store metadata name when game is not in owned list', async () => {
    // Arrange: owned games fixture has 730 and 570 — not 620
    const jsx = await GameDetailPage({ params: { appId: NOT_OWNED_APP_ID } });
    render(jsx);

    // The GameHero renders an <h1> with the game name
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Portal 2');
  });

  it('does NOT show generic "App 620" when store metadata is available', async () => {
    const jsx = await GameDetailPage({ params: { appId: NOT_OWNED_APP_ID } });
    render(jsx);

    expect(screen.getByRole('heading', { level: 1 })).not.toHaveTextContent(`App ${NOT_OWNED_APP_ID}`);
  });

  it('falls back to "App {appId}" when store metadata is also unavailable', async () => {
    // Override the store API to return a 500 / empty so metadata fails
    steamServer.use(
      http.get(APP_DETAILS_URL, () => HttpResponse.json({ [NOT_OWNED_APP_ID]: { success: false } })),
    );

    const jsx = await GameDetailPage({ params: { appId: NOT_OWNED_APP_ID } });
    render(jsx);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(`App ${NOT_OWNED_APP_ID}`);
  });

  it('uses owned-game name (not store metadata) when game IS owned', async () => {
    // App 730 (Counter-Strike 2) IS in the owned-games fixture
    const jsx = await GameDetailPage({ params: { appId: '730' } });
    render(jsx);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Counter-Strike 2');
  });
});
