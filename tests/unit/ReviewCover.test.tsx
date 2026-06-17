// @vitest-environment jsdom
/**
 * ReviewCover + TopGamesSection component tests.
 *
 * Both are pure presentational RSC-compatible components (no hooks), so they
 * can be rendered in jsdom directly.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReviewCover } from '@/components/review/ReviewCover';
import { TopGamesSection } from '@/components/review/TopGamesSection';
import type { TopGame } from '@/lib/insights/year-in-review';

// ---------------------------------------------------------------------------
// ReviewCover tests
// ---------------------------------------------------------------------------

describe('ReviewCover', () => {
  it('renders the total playtime as hours', () => {
    // 3660 minutes = 61 h
    render(<ReviewCover year={2025} totalMinutes={3660} />);
    expect(screen.getByText('61 h')).toBeInTheDocument();
  });

  it('renders "played" label', () => {
    render(<ReviewCover year={2025} totalMinutes={120} />);
    expect(screen.getByText('played')).toBeInTheDocument();
  });

  it('has accessible section label for the year', () => {
    render(<ReviewCover year={2024} totalMinutes={600} />);
    expect(
      screen.getByRole('region', { name: /Year in Review cover for 2024/i }),
    ).toBeInTheDocument();
  });

  it('renders "Total playtime" label containing the year', () => {
    render(<ReviewCover year={2023} totalMinutes={60} />);
    expect(screen.getByText(/Total playtime 2023/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// TopGamesSection tests
// ---------------------------------------------------------------------------

const TOP_GAMES: TopGame[] = [
  { appId: 730, name: 'Counter-Strike 2', minutesDelta: 1800 },
  { appId: 440, name: 'Team Fortress 2', minutesDelta: 900 },
  { appId: 570, name: 'Dota 2', minutesDelta: 600 },
];

describe('TopGamesSection', () => {
  it('renders all game names', () => {
    render(<TopGamesSection topGames={TOP_GAMES} />);
    expect(screen.getByText('Counter-Strike 2')).toBeInTheDocument();
    expect(screen.getByText('Team Fortress 2')).toBeInTheDocument();
    expect(screen.getByText('Dota 2')).toBeInTheDocument();
  });

  it('renders rank numbers 1, 2, 3', () => {
    render(<TopGamesSection topGames={TOP_GAMES} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders formatted playtime for the top game (1800 min = 30 h)', () => {
    render(<TopGamesSection topGames={TOP_GAMES} />);
    expect(screen.getByText('30 h')).toBeInTheDocument();
  });

  it('renders the "Top games" heading', () => {
    render(<TopGamesSection topGames={TOP_GAMES} />);
    expect(screen.getByText(/top games/i)).toBeInTheDocument();
  });

  it('returns null when topGames is empty', () => {
    const { container } = render(<TopGamesSection topGames={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
