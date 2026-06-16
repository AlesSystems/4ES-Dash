// @vitest-environment jsdom
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomePage from '@/app/page';
import { clearCache } from '@/server/cache';
import { steamServer } from '../mocks/steam-server';

const OWNED_GAMES_URL = 'https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/';

// HomePage is an async Server Component: await it to resolve the tree, then render.
// The persistent profile header lives in the root layout (AppHeader), so the
// dashboard itself renders the widgets + top-games sections.
async function renderHome(): Promise<void> {
  render(await HomePage());
}

beforeEach(() => clearCache());

describe('HomePage', () => {
  it('renders the dashboard widgets and top games on the happy path', async () => {
    await renderHome();
    // Recently-played widget + most-played (top games) section both render.
    expect(screen.getByRole('heading', { name: /recently played/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /most played/i })).toBeInTheDocument();
    // Achievement aggregate resolved (not the unavailable empty state).
    expect(screen.getByText(/achievement completion/i)).toBeInTheDocument();
    // The 2-game fixture appears in the most-played ranking.
    expect(screen.getAllByText('Counter-Strike 2').length).toBeGreaterThanOrEqual(1);
  });

  it('renders a designed empty state when the library is private', async () => {
    steamServer.use(http.get(OWNED_GAMES_URL, () => HttpResponse.json({ response: {} })));
    await renderHome();
    expect(screen.getByText('Profile is private')).toBeInTheDocument();
  });
});
