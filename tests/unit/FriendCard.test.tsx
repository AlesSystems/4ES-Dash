// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FriendCard } from '@/components/friends/FriendCard';
import type { FriendSummary } from '@/lib/steam/schemas';

const baseFriend: FriendSummary = {
  steamId: '76561198000000001',
  personaName: 'kael',
  avatar: {
    small: 'https://avatars.steamstatic.com/small.jpg',
    medium: 'https://avatars.steamstatic.com/medium.jpg',
    full: 'https://avatars.steamstatic.com/full.jpg',
  },
  profileUrl: 'https://steamcommunity.com/id/kael',
  status: 'online',
  inGame: false,
  playing: null,
  friendSince: null,
};

describe('FriendCard', () => {
  it('renders the persona name', () => {
    render(<FriendCard friend={baseFriend} />);
    expect(screen.getByText('kael')).toBeInTheDocument();
  });

  it('renders the status label text ("Online") when not in a game', () => {
    render(<FriendCard friend={baseFriend} />);
    expect(screen.getByText('Online')).toBeInTheDocument();
  });

  it('renders "Away" label for away status', () => {
    const friend: FriendSummary = { ...baseFriend, status: 'away' };
    render(<FriendCard friend={friend} />);
    expect(screen.getByText('Away')).toBeInTheDocument();
  });

  it('renders "Offline" label for offline status', () => {
    const friend: FriendSummary = { ...baseFriend, status: 'offline' };
    render(<FriendCard friend={friend} />);
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('renders "In <game>" when playing is set', () => {
    const friend: FriendSummary = {
      ...baseFriend,
      status: 'online',
      inGame: true,
      playing: { appId: 440, name: 'Team Fortress 2' },
    };
    render(<FriendCard friend={friend} />);
    expect(screen.getByText('In Team Fortress 2')).toBeInTheDocument();
  });

  it('does NOT render a game name when playing is null', () => {
    render(<FriendCard friend={baseFriend} />);
    expect(screen.queryByText(/^In /)).not.toBeInTheDocument();
  });

  it('renders the avatar image with the persona name as alt text', () => {
    render(<FriendCard friend={baseFriend} />);
    expect(screen.getByRole('img', { name: 'kael' })).toBeInTheDocument();
  });

  it('links to the friend Steam profile URL', () => {
    render(<FriendCard friend={baseFriend} />);
    const profileLink = screen.getByRole('link', { name: /view Steam profile/ });
    expect(profileLink).toHaveAttribute('href', 'https://steamcommunity.com/id/kael');
  });

  it('renders a Compare link pointing to /compare?b=<steamId>', () => {
    render(<FriendCard friend={baseFriend} />);
    const compareLink = screen.getByRole('link', { name: /compare with kael/i });
    expect(compareLink).toHaveAttribute('href', '/compare?b=76561198000000001');
  });

  it('the Compare link href uses the correct steamId', () => {
    const friend: FriendSummary = { ...baseFriend, steamId: '76561198999999999' };
    render(<FriendCard friend={friend} />);
    const compareLink = screen.getByRole('link', { name: /compare with/i });
    expect(compareLink).toHaveAttribute('href', '/compare?b=76561198999999999');
  });

  it('renders "Friends since <year>" when friendSince is set', () => {
    const friend: FriendSummary = {
      ...baseFriend,
      friendSince: '2019-06-15T00:00:00.000Z',
    };
    render(<FriendCard friend={friend} />);
    expect(screen.getByText('Friends since 2019')).toBeInTheDocument();
  });

  it('does NOT render "Friends since" when friendSince is null', () => {
    render(<FriendCard friend={baseFriend} />);
    expect(screen.queryByText(/Friends since/)).not.toBeInTheDocument();
  });

  it('renders exactly two links: profile (external) and compare (internal)', () => {
    render(<FriendCard friend={baseFriend} />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
  });
});
