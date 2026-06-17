// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// When the cache serves stale data (its SWR path is unit-tested in cache.test.ts),
// getFriends reports `stale: true`; assert the friends page surfaces the indicator.
// This is the page-level counterpart to the route-level cache-hit test in
// tests/integration/api-friends.test.ts.
vi.mock('@/server/repositories/friends', () => ({
  getFriends: vi.fn(async () => ({
    friends: [
      {
        steamId: '76561198000000001',
        personaName: 'CachedFriend',
        avatar: {
          small: 'https://avatars.steamstatic.com/cf_small.jpg',
          medium: 'https://avatars.steamstatic.com/cf_medium.jpg',
          full: 'https://avatars.steamstatic.com/cf_full.jpg',
        },
        profileUrl: 'https://steamcommunity.com/id/cf/',
        status: 'online',
        inGame: false,
        playing: null,
        friendSince: null,
      },
    ],
    stale: true,
  })),
}));

import FriendsPage from '@/app/friends/page';

describe('FriendsPage – stale data', () => {
  it('renders the "Data may be outdated" indicator when getFriends reports stale data', async () => {
    render(await FriendsPage());
    expect(screen.getByText('Data may be outdated')).toBeInTheDocument();
  });
});
