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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

// Existence probe (T4): the page counts snapshot rows when the windowed fetch
// is empty, to distinguish "no data ever" from "no data in window".
const mockSnapshotCount = vi.fn();
vi.mock('@/server/db', () => ({
  prisma: { playtimeSnapshot: { count: (...args: unknown[]) => mockSnapshotCount(...args) } },
}));

import HistoryPage from '@/app/history/page';
import { historyWindowStart } from '@/lib/history/aggregate';

beforeEach(() => {
  mockGetPlaytimeSnapshots.mockReset();
  mockRedirect.mockClear();
  // Default to onboarded so existing empty-state cases exercise the page body.
  mockGetOnboardingStatus.mockResolvedValue('onboarded');
  // Default: no snapshot rows exist at all (the true "No history yet" case).
  mockSnapshotCount.mockReset();
  mockSnapshotCount.mockResolvedValue(0);
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

describe('HistoryPage — windowed fetch (T4, TDD #12)', () => {
  const FIXED_NOW = new Date('2026-07-15T12:00:00.000Z');

  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes the computed floored since for bucket=week', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    mockGetPlaytimeSnapshots.mockResolvedValue([
      makeRow(new Date(Date.UTC(2026, 5, 1)), 100),
      makeRow(new Date(Date.UTC(2026, 5, 15)), 200),
    ]);
    render(await HistoryPage({ searchParams: { bucket: 'week' } }));
    expect(mockGetPlaytimeSnapshots).toHaveBeenCalledWith('76561198000000000', {
      since: historyWindowStart('week', FIXED_NOW),
    });
  });

  it('passes the computed floored since for bucket=month', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    mockGetPlaytimeSnapshots.mockResolvedValue([
      makeRow(new Date(Date.UTC(2026, 4, 1)), 100),
      makeRow(new Date(Date.UTC(2026, 5, 15)), 200),
    ]);
    render(await HistoryPage({ searchParams: { bucket: 'month' } }));
    expect(mockGetPlaytimeSnapshots).toHaveBeenCalledWith('76561198000000000', {
      since: historyWindowStart('month', FIXED_NOW),
    });
  });
});

describe('HistoryPage — pre-window-only data (T4, TDD #13)', () => {
  it('renders the window-accurate quiet state, NOT "No history yet", when history exists only before the window', async () => {
    // Onboarded user whose snapshots all predate the window: the windowed
    // fetch is empty but the existence probe finds rows. Claiming "No history
    // yet" would fabricate absence (degrade-never-fabricate).
    mockGetPlaytimeSnapshots.mockResolvedValue([]);
    mockSnapshotCount.mockResolvedValue(5);
    render(await HistoryPage({ searchParams: { bucket: 'week' } }));
    expect(screen.getByText(/No recent playtime/i)).toBeInTheDocument();
    expect(screen.getByText(/last 53 weeks/i)).toBeInTheDocument();
    expect(screen.queryByText(/No history yet/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('chart')).not.toBeInTheDocument();
  });

  it('uses the month lookback in the quiet-state copy for bucket=month', async () => {
    mockGetPlaytimeSnapshots.mockResolvedValue([]);
    mockSnapshotCount.mockResolvedValue(5);
    render(await HistoryPage({ searchParams: { bucket: 'month' } }));
    expect(screen.getByText(/last 25 months/i)).toBeInTheDocument();
    expect(screen.queryByText(/No history yet/i)).not.toBeInTheDocument();
  });

  it('still renders the true "No history yet" state when no snapshots exist at all', async () => {
    mockGetPlaytimeSnapshots.mockResolvedValue([]);
    mockSnapshotCount.mockResolvedValue(0);
    render(await HistoryPage({ searchParams: {} }));
    expect(screen.getByText(/No history yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/No recent playtime/i)).not.toBeInTheDocument();
  });
});
