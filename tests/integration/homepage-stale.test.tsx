// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// The library-value widget is an async server component (streams in a Suspense
// boundary) — stub it so @testing-library can render the dashboard tree in jsdom.
vi.mock('@/components/dashboard/LibraryValueSection', () => ({
  LibraryValueSection: () => null,
  LibraryValueSkeleton: () => null,
}));

// When the cache serves stale data (its SWR path is unit-tested in cache.test.ts),
// getProfile reports `stale: true`; assert the homepage surfaces the indicator.
vi.mock('@/server/repositories/profile', () => ({
  getProfile: vi.fn(async () => ({
    profile: {
      steamId: '76561198000000000',
      personaName: 'Ales',
      avatar: {
        small: 'https://avatars.steamstatic.com/x_small.jpg',
        medium: 'https://avatars.steamstatic.com/x_medium.jpg',
        full: 'https://avatars.steamstatic.com/x_full.jpg',
      },
      profileUrl: 'https://steamcommunity.com/id/ales/',
      createdAt: null,
      countryCode: 'US',
    },
    games: [],
    stale: true,
  })),
}));

import HomePage from '@/app/page';

describe('HomePage – stale data', () => {
  it('renders the "Data may be outdated" indicator when getProfile reports stale data', async () => {
    render(await HomePage());
    expect(screen.getByText('Data may be outdated')).toBeInTheDocument();
  });
});
