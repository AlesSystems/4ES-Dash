/**
 * tests/unit/achievement-kpi-section.test.tsx
 *
 * Red-first tests for AC2 (bug-01):
 * AchievementKpiSection maps available → real %, unavailable → "—", never 0%.
 *
 * ERR-0006-safe: we await the async server component ourselves and render
 * only its synchronous JSX return (the genres-page / achievements-repo pattern).
 */

// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { available, unavailable } from '@/lib/result';
import type { LibrarySummary } from '@/lib/achievements/aggregate';

// Mock the achievements repository at the boundary — never hit Steam.
const mockGetAchievementProgress = vi.fn();
vi.mock('@/server/repositories/achievements', () => ({
  getAchievementProgress: (...args: unknown[]) => mockGetAchievementProgress(...args),
}));

// Import AFTER mocks.
import { AchievementKpiSection, AchievementKpiSkeleton } from '@/components/dashboard/AchievementKpiSection';

const STEAM_ID = '76561198000000000';
const APP_IDS = [730, 570];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AchievementKpiSection', () => {
  it('renders the real percent when achievements are available', async () => {
    const summary: LibrarySummary = { totalUnlocked: 50, totalAvailable: 100, percent: 50, recentUnlocks: [] };
    mockGetAchievementProgress.mockResolvedValue(available(summary));

    const jsx = await AchievementKpiSection({ steamId: STEAM_ID, appIds: APP_IDS });
    render(jsx);

    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('%')).toBeInTheDocument();
    expect(screen.queryByText('—')).not.toBeInTheDocument();
  });

  it('renders "—" when achievements are unavailable — never fabricates 0%', async () => {
    mockGetAchievementProgress.mockResolvedValue(unavailable('private'));

    const jsx = await AchievementKpiSection({ steamId: STEAM_ID, appIds: APP_IDS });
    render(jsx);

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('%')).not.toBeInTheDocument();
    // Must not render a numeric zero
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});

describe('AchievementKpiSkeleton', () => {
  it('renders an aria-busy placeholder', () => {
    render(<AchievementKpiSkeleton />);
    // The skeleton is a container; just confirm it mounts without error.
    const el = document.querySelector('[aria-busy="true"]');
    expect(el).toBeInTheDocument();
  });
});
