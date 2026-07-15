// @vitest-environment jsdom
/**
 * Red-first tests for AC4 (bug-03): distinct honest empty states in the
 * history page.
 *
 * Pattern: render(await HistoryPage(...)) — safe because HistoryPage is a
 * flat async RSC with no inline async children (matches the genres-page
 * pattern approved by the reviewer as ERR-0006-safe).
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stub heavy client components that can't render in jsdom.
vi.mock('@/components/history/PlaytimeChart', () => ({
  PlaytimeChart: () => <div data-testid="chart" />,
}));
vi.mock('@/components/history/HistoryToggle', () => ({
  HistoryToggle: () => <div data-testid="toggle" />,
}));
vi.mock('@/server/auth', () => ({
  getViewerSteamId: vi.fn().mockResolvedValue('76561198000000000'),
}));

const mockRedirect = vi.fn((_url: string) => {
  throw new Error('NEXT_REDIRECT');
});
vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}));

const mockGetOnboardingStatus = vi.fn();
vi.mock('@/server/onboarding-gate', () => ({
  getOnboardingStatus: () => mockGetOnboardingStatus(),
}));

// getPlaytimeSnapshots is mocked per-test.
const mockGetPlaytimeSnapshots = vi.fn();
vi.mock('@/server/repositories/snapshots', () => ({
  getPlaytimeSnapshots: (...args: unknown[]) => mockGetPlaytimeSnapshots(...args),
}));

import HistoryPage from '@/app/history/page';

beforeEach(() => {
  mockGetPlaytimeSnapshots.mockReset();
  mockRedirect.mockClear();
  // Default to onboarded so existing empty-state cases exercise the page body.
  mockGetOnboardingStatus.mockResolvedValue('onboarded');
});

/** Minimal snapshot row shape sufficient for aggregatePlaytime. */
function makeRow(date: Date, playtimeForever = 100) {
  return { appId: 730, date, playtimeForever };
}

describe('HistoryPage — empty states (bug-03)', () => {
  it('(1) renders "No history yet" when there are zero snapshot rows', async () => {
    mockGetPlaytimeSnapshots.mockResolvedValue([]);
    render(await HistoryPage({ searchParams: {} }));
    expect(screen.getByText(/No history yet/i)).toBeInTheDocument();
    expect(screen.queryByTestId('chart')).not.toBeInTheDocument();
  });

  it('(2) renders "History is still building" when there is exactly one snapshot row', async () => {
    mockGetPlaytimeSnapshots.mockResolvedValue([
      makeRow(new Date(Date.UTC(2024, 0, 1))),
    ]);
    render(await HistoryPage({ searchParams: {} }));
    expect(screen.getByText(/History is still building/i)).toBeInTheDocument();
    expect(screen.queryByTestId('chart')).not.toBeInTheDocument();
  });

  it('(3) renders the chart when there are ≥2 snapshot rows spanning ≥2 weeks', async () => {
    mockGetPlaytimeSnapshots.mockResolvedValue([
      makeRow(new Date(Date.UTC(2024, 0, 1))),
      makeRow(new Date(Date.UTC(2024, 0, 8))),
      makeRow(new Date(Date.UTC(2024, 0, 15))),
    ]);
    render(await HistoryPage({ searchParams: {} }));
    expect(screen.getByTestId('chart')).toBeInTheDocument();
    expect(screen.queryByText(/No history yet/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/History is still building/i)).not.toBeInTheDocument();
  });

  it('(4) renders the chart for 3 daily rows inside ONE ISO week (period-cliff fix)', async () => {
    // bug-1: short-span data used to collapse to a single point and hit the
    // "still building" empty state. It must now draw a chart.
    mockGetPlaytimeSnapshots.mockResolvedValue([
      makeRow(new Date(Date.UTC(2024, 0, 1)), 100),
      makeRow(new Date(Date.UTC(2024, 0, 2)), 160),
      makeRow(new Date(Date.UTC(2024, 0, 3)), 250),
    ]);
    render(await HistoryPage({ searchParams: {} }));
    expect(screen.getByTestId('chart')).toBeInTheDocument();
    expect(screen.queryByText(/History is still building/i)).not.toBeInTheDocument();
  });
});

describe('HistoryPage — onboarding gate (bug-1)', () => {
  it('redirects a not-onboarded viewer to /onboarding', async () => {
    mockGetOnboardingStatus.mockResolvedValue('not-onboarded');
    mockGetPlaytimeSnapshots.mockResolvedValue([]);
    await expect(HistoryPage({ searchParams: {} })).rejects.toThrow('NEXT_REDIRECT');
    expect(mockRedirect).toHaveBeenCalledWith('/onboarding');
  });

  it('does not fetch snapshots before redirecting a not-onboarded viewer', async () => {
    mockGetOnboardingStatus.mockResolvedValue('not-onboarded');
    mockGetPlaytimeSnapshots.mockResolvedValue([]);
    await expect(HistoryPage({ searchParams: {} })).rejects.toThrow('NEXT_REDIRECT');
    expect(mockGetPlaytimeSnapshots).not.toHaveBeenCalled();
  });
});
