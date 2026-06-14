// @vitest-environment jsdom
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomePage from '@/app/page';
import { clearCache } from '@/server/cache';
import { steamServer } from '../mocks/steam-server';

const OWNED_GAMES_URL = 'https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/';

// HomePage is an async Server Component: await it to resolve the tree, then render.
async function renderHome(): Promise<void> {
  render(await HomePage());
}

beforeEach(() => clearCache());

describe('HomePage', () => {
  it('renders the profile name and game tiles on the happy path', async () => {
    await renderHome();
    expect(screen.getByText('Ales')).toBeInTheDocument();
    expect(screen.getByText('Counter-Strike 2')).toBeInTheDocument();
    expect(screen.getByText('Dota 2')).toBeInTheDocument();
    // 1 avatar + 2 game header images (the 2-game fixture); guards the top-N slice.
    expect(screen.getAllByRole('img')).toHaveLength(3);
  });

  it('renders a designed empty state when the library is private', async () => {
    steamServer.use(http.get(OWNED_GAMES_URL, () => HttpResponse.json({ response: {} })));
    await renderHome();
    expect(screen.getByText('Profile is private')).toBeInTheDocument();
  });
});
