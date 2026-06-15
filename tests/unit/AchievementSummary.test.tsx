// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AchievementSummary } from '@/components/dashboard/AchievementSummary';
import { available, unavailable } from '@/lib/result';
import type { LibrarySummary } from '@/server/repositories/achievements';
import type { MergedAchievement } from '@/lib/achievements/aggregate';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeAchievement(overrides: Partial<MergedAchievement> = {}): MergedAchievement {
  return {
    apiName: 'ACH_TEST',
    displayName: 'Test Achievement',
    description: 'Do the thing.',
    iconUrl: '',
    unlocked: true,
    unlockedAt: '2026-06-10T14:00:00.000Z',
    globalPercent: 50,
    ...overrides,
  };
}

const RECENT_UNLOCK = makeAchievement({
  apiName: 'ACH_RECENT',
  displayName: 'Speed Runner',
  unlockedAt: '2026-06-12T09:00:00.000Z',
  iconUrl:
    'https://media.steampowered.com/steamcommunity/public/images/apps/220/ach_speed_runner.jpg',
});

const SUMMARY_WITH_UNLOCKS: LibrarySummary = {
  totalUnlocked: 42,
  totalAvailable: 200,
  percent: 21,
  recentUnlocks: [RECENT_UNLOCK],
};

const SUMMARY_NO_RECENT: LibrarySummary = {
  totalUnlocked: 100,
  totalAvailable: 500,
  percent: 20,
  recentUnlocks: [],
};

// ---------------------------------------------------------------------------
// Tests — available state with recent unlocks
// ---------------------------------------------------------------------------

describe('AchievementSummary — available with recent unlocks', () => {
  it('renders the completion percentage', () => {
    render(<AchievementSummary result={available(SUMMARY_WITH_UNLOCKS)} />);
    expect(screen.getByText('21%')).toBeInTheDocument();
  });

  it('renders the "Achievement completion" label', () => {
    render(<AchievementSummary result={available(SUMMARY_WITH_UNLOCKS)} />);
    expect(screen.getByText('Achievement completion')).toBeInTheDocument();
  });

  it('renders a progress bar with correct aria-valuenow', () => {
    render(<AchievementSummary result={available(SUMMARY_WITH_UNLOCKS)} />);
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute('aria-valuenow', '21');
    expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '100');
  });

  it('renders the unlocked / total count', () => {
    render(<AchievementSummary result={available(SUMMARY_WITH_UNLOCKS)} />);
    expect(screen.getByText(/42/)).toBeInTheDocument();
    expect(screen.getByText(/200/)).toBeInTheDocument();
  });

  it('renders the recent unlocks heading', () => {
    render(<AchievementSummary result={available(SUMMARY_WITH_UNLOCKS)} />);
    expect(screen.getByText('Recent unlocks')).toBeInTheDocument();
  });

  it('renders each recent unlock display name', () => {
    render(<AchievementSummary result={available(SUMMARY_WITH_UNLOCKS)} />);
    expect(screen.getByText('Speed Runner')).toBeInTheDocument();
  });

  it('renders the unlock date as a <time> element', () => {
    render(<AchievementSummary result={available(SUMMARY_WITH_UNLOCKS)} />);
    const timeEl = document.querySelector('time');
    expect(timeEl).not.toBeNull();
    expect(timeEl?.getAttribute('dateTime')).toBe('2026-06-12T09:00:00.000Z');
  });

  it('renders the achievement icon image when iconUrl is non-empty', () => {
    const { container } = render(<AchievementSummary result={available(SUMMARY_WITH_UNLOCKS)} />);
    // The icon is rendered with aria-hidden and alt="" (decorative) — query via DOM
    const iconImg = container.querySelector('img[aria-hidden="true"]') as HTMLImageElement | null;
    expect(iconImg).not.toBeNull();
    // next/image encodes the src into the /_next/image URL; check the original URL is present
    expect(iconImg?.src).toContain('ach_speed_runner');
  });

  it('does not show the "no unlocks" inline note when recent unlocks exist', () => {
    render(<AchievementSummary result={available(SUMMARY_WITH_UNLOCKS)} />);
    expect(screen.queryByText('No unlocks in the last 7 days')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — unavailable state
// ---------------------------------------------------------------------------

describe('AchievementSummary — unavailable state', () => {
  it('renders the empty state title when result is unavailable', () => {
    render(<AchievementSummary result={unavailable('no-achievements')} />);
    expect(screen.getByText('No achievement data yet')).toBeInTheDocument();
  });

  it('renders the empty state description', () => {
    render(<AchievementSummary result={unavailable('no-achievements')} />);
    expect(
      screen.getByText('Play games with achievements to see your progress.'),
    ).toBeInTheDocument();
  });

  it('does not render a progress bar when unavailable', () => {
    render(<AchievementSummary result={unavailable('no-achievements')} />);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('does not render a percentage value when unavailable', () => {
    render(<AchievementSummary result={unavailable('no-achievements')} />);
    expect(screen.queryByText('%')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — available but no recent unlocks
// ---------------------------------------------------------------------------

describe('AchievementSummary — available with no recent unlocks', () => {
  it('renders the percentage and progress bar', () => {
    render(<AchievementSummary result={available(SUMMARY_NO_RECENT)} />);
    expect(screen.getByText('20%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows the inline "No unlocks in the last 7 days" note', () => {
    render(<AchievementSummary result={available(SUMMARY_NO_RECENT)} />);
    expect(screen.getByText('No unlocks in the last 7 days')).toBeInTheDocument();
  });

  it('does not render a list of unlock items', () => {
    render(<AchievementSummary result={available(SUMMARY_NO_RECENT)} />);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('does not render the EmptyState component', () => {
    render(<AchievementSummary result={available(SUMMARY_NO_RECENT)} />);
    // EmptyState renders "No achievement data yet" only — that text should be absent
    expect(screen.queryByText('No achievement data yet')).not.toBeInTheDocument();
  });
});
