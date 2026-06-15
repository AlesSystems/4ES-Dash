// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RecentlyPlayed } from '@/components/dashboard/RecentlyPlayed';
import type { RecentGame } from '@/server/repositories/recently-played';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeGame(overrides: Partial<RecentGame> & { appId: number; name: string }): RecentGame {
  return {
    iconUrl: null,
    headerUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${overrides.appId}/header.jpg`,
    twoWeeksMinutes: 120,
    totalMinutes: 600,
    ...overrides,
  };
}

const GAME_A = makeGame({ appId: 220, name: 'Half-Life 2' });
const GAME_B = makeGame({ appId: 440, name: 'Team Fortress 2', twoWeeksMinutes: 90 });
const GAME_C = makeGame({ appId: 730, name: 'Counter-Strike 2' });

// Build a list of 12 unique games to verify the 10-game cap.
const TWELVE_GAMES: RecentGame[] = Array.from({ length: 12 }, (_, i) =>
  makeGame({ appId: 1000 + i, name: `Game ${i + 1}` }),
);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RecentlyPlayed — populated state', () => {
  it('renders the section heading', () => {
    render(<RecentlyPlayed games={[GAME_A, GAME_B]} stale={false} />);
    expect(screen.getByText('Recently played')).toBeInTheDocument();
  });

  it('renders each game name', () => {
    render(<RecentlyPlayed games={[GAME_A, GAME_B]} stale={false} />);
    expect(screen.getByText('Half-Life 2')).toBeInTheDocument();
    expect(screen.getByText('Team Fortress 2')).toBeInTheDocument();
  });

  it('renders a link to /game/:appId for each game', () => {
    render(<RecentlyPlayed games={[GAME_A, GAME_B]} stale={false} />);
    const links = screen.getAllByRole('link');
    const hrefs = links.map((l) => l.getAttribute('href'));
    expect(hrefs).toContain('/game/220');
    expect(hrefs).toContain('/game/440');
  });

  it('renders the two-weeks playtime for each game', () => {
    render(<RecentlyPlayed games={[GAME_A]} stale={false} />);
    // 120 minutes = 2 h
    expect(screen.getByText('2 h')).toBeInTheDocument();
    expect(screen.getByText('last 2 weeks')).toBeInTheDocument();
  });

  it('renders cover art images with meaningful alt text', () => {
    render(<RecentlyPlayed games={[GAME_A, GAME_B]} stale={false} />);
    expect(screen.getByRole('img', { name: 'Half-Life 2' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Team Fortress 2' })).toBeInTheDocument();
  });

  it('caps the list at 10 games when more than 10 are provided', () => {
    render(<RecentlyPlayed games={TWELVE_GAMES} stale={false} />);
    // 10 games → 10 links
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(10);
    // First 10 names are present; 11th and 12th are not
    expect(screen.getByText('Game 1')).toBeInTheDocument();
    expect(screen.getByText('Game 10')).toBeInTheDocument();
    expect(screen.queryByText('Game 11')).not.toBeInTheDocument();
    expect(screen.queryByText('Game 12')).not.toBeInTheDocument();
  });

  it('does not render the stale banner when stale is false', () => {
    render(<RecentlyPlayed games={[GAME_A]} stale={false} />);
    expect(screen.queryByText('Data may be outdated')).not.toBeInTheDocument();
  });
});

describe('RecentlyPlayed — empty state', () => {
  it('renders the empty state title when there are no games', () => {
    render(<RecentlyPlayed games={[]} stale={false} />);
    expect(screen.getByText('Nothing played recently')).toBeInTheDocument();
  });

  it('renders the empty state description', () => {
    render(<RecentlyPlayed games={[]} stale={false} />);
    expect(
      screen.getByText('Games you play in the last two weeks will show up here.'),
    ).toBeInTheDocument();
  });

  it('does not render a game list when there are no games', () => {
    render(<RecentlyPlayed games={[]} stale={false} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('RecentlyPlayed — stale state', () => {
  it('renders the StaleBanner when stale is true', () => {
    render(<RecentlyPlayed games={[GAME_C]} stale={true} />);
    expect(screen.getByText('Data may be outdated')).toBeInTheDocument();
  });

  it('StaleBanner has role="status"', () => {
    render(<RecentlyPlayed games={[GAME_C]} stale={true} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('still renders the game list when stale is true and games are present', () => {
    render(<RecentlyPlayed games={[GAME_C]} stale={true} />);
    expect(screen.getByText('Counter-Strike 2')).toBeInTheDocument();
  });

  it('renders empty state AND stale banner when stale=true and games=[]', () => {
    render(<RecentlyPlayed games={[]} stale={true} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Nothing played recently')).toBeInTheDocument();
  });
});
