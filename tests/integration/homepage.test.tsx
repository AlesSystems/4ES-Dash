// @vitest-environment jsdom
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// The library-value widget is an async server component that streams in its own
// Suspense boundary — @testing-library can't render async components in jsdom.
// Stub it with a sync no-op; its own behavior is covered by library-value tests.
vi.mock('@/components/dashboard/LibraryValueSection', () => ({
  LibraryValueSection: () => null,
  LibraryValueSkeleton: () => null,
}));

// The achievement summary is likewise an async server component streaming in its
// own Suspense boundary (#85) — stub it; its data logic is covered by the
// achievements repository tests and AchievementSummary's own component tests.
vi.mock('@/components/dashboard/AchievementSummarySection', () => ({
  AchievementSummarySection: () => null,
  AchievementSummarySkeleton: () => null,
}));

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
    // The achievement summary now streams in its own Suspense boundary (#85) and
    // is stubbed above (it's an async server component); its behaviour is covered
    // by the achievements repository + AchievementSummary component tests.
    // The 2-game fixture appears in the most-played ranking.
    expect(screen.getAllByText('Counter-Strike 2').length).toBeGreaterThanOrEqual(1);
  });

  it('renders a designed empty state when the library is private', async () => {
    steamServer.use(http.get(OWNED_GAMES_URL, () => HttpResponse.json({ response: {} })));
    await renderHome();
    expect(screen.getByText('Profile is private')).toBeInTheDocument();
  });
});
