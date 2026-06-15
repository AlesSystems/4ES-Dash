// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AchievementList } from '@/components/game/AchievementList';
import { available, unavailable } from '@/lib/result';
import type { GameAchievements } from '@/lib/achievements/aggregate';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ACHIEVEMENT_ITEM = {
  apiName: 'ACH_WIN_ONE_GAME',
  displayName: 'First Win',
  description: 'Win your first game.',
  iconUrl: '',
  unlocked: true,
  unlockedAt: '2024-03-15T12:00:00Z',
  globalPercent: 42.5,
};

const LOCKED_ITEM = {
  apiName: 'ACH_WIN_100_GAMES',
  displayName: 'Centurion',
  description: 'Win 100 games.',
  iconUrl: '',
  unlocked: false,
  unlockedAt: null,
  globalPercent: 5.2,
};

const FULL_ACHIEVEMENTS: GameAchievements = {
  unlocked: 1,
  total: 2,
  percent: 50,
  items: [ACHIEVEMENT_ITEM, LOCKED_ITEM],
};

// ---------------------------------------------------------------------------
// Tests: available data
// ---------------------------------------------------------------------------

describe('AchievementList — available', () => {
  it('renders the heading with unlocked count', () => {
    render(<AchievementList result={available(FULL_ACHIEVEMENTS)} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Achievements');
    expect(screen.getByText('1 of 2 unlocked')).toBeInTheDocument();
  });

  it('renders a progress bar with correct aria-valuenow', () => {
    render(<AchievementList result={available(FULL_ACHIEVEMENTS)} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '50');
  });

  it('renders each achievement display name', () => {
    render(<AchievementList result={available(FULL_ACHIEVEMENTS)} />);
    expect(screen.getByText('First Win')).toBeInTheDocument();
    expect(screen.getByText('Centurion')).toBeInTheDocument();
  });

  it('shows globalPercent for an achievement', () => {
    render(<AchievementList result={available(FULL_ACHIEVEMENTS)} />);
    // 42.5% of players
    expect(screen.getByText('42.5% of players')).toBeInTheDocument();
  });

  it('shows "Unlocked" badge for unlocked achievements', () => {
    render(<AchievementList result={available(FULL_ACHIEVEMENTS)} />);
    // The status badge is an exact text match on the <span> itself
    // (the date span reads "Unlocked <date>" which also triggers getByText)
    const badges = screen.getAllByText('Unlocked', { exact: true });
    // At least one element is an "Unlocked" status badge (the <span> element)
    const badge = badges.find((el) => el.tagName.toLowerCase() === 'span');
    expect(badge).toBeInTheDocument();
  });

  it('shows "Locked" label for locked achievements', () => {
    render(<AchievementList result={available(FULL_ACHIEVEMENTS)} />);
    expect(screen.getByText('Locked')).toBeInTheDocument();
  });

  it('renders zero-achievement state gracefully (empty items)', () => {
    const empty: GameAchievements = { unlocked: 0, total: 0, percent: 0, items: [] };
    render(<AchievementList result={available(empty)} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Achievements');
    // Should not crash even with no items
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests: degraded — private
// ---------------------------------------------------------------------------

describe('AchievementList — unavailable(private)', () => {
  it('renders the private-profile message', () => {
    render(<AchievementList result={unavailable('private')} />);
    expect(screen.getByText('Achievements hidden (private profile)')).toBeInTheDocument();
  });

  it('does not render a progress bar or list', () => {
    render(<AchievementList result={unavailable('private')} />);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests: degraded — no-achievements
// ---------------------------------------------------------------------------

describe('AchievementList — unavailable(no-achievements)', () => {
  it('renders the no-achievements message', () => {
    render(<AchievementList result={unavailable('no-achievements')} />);
    expect(screen.getByText('This game has no achievements')).toBeInTheDocument();
  });

  it('does not render a progress bar or list', () => {
    render(<AchievementList result={unavailable('no-achievements')} />);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
