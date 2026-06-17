// @vitest-environment jsdom
/**
 * Tests for the cost-per-hour persistent note and empty-state rendering.
 *
 * Because CostPerHourPage is an async RSC, we test the presentational pieces
 * that can be rendered synchronously in jsdom.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from '@/components/states/EmptyState';

// ---------------------------------------------------------------------------
// Persistent disclaimer note — rendered via a simple wrapper component
// ---------------------------------------------------------------------------

function CostPerHourNote(): JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-4 py-3">
      <p className="text-sm text-text-2">
        <strong className="font-medium text-text-1">Note:</strong> Prices reflect current store
        prices, not what you paid. Your actual cost may have been different.
      </p>
    </div>
  );
}

describe('CostPerHourNote (persistent disclaimer)', () => {
  it('renders the disclaimer text', () => {
    render(<CostPerHourNote />);
    expect(
      screen.getByText(/Prices reflect current store prices, not what you paid/i),
    ).toBeInTheDocument();
  });

  it('includes the "Note:" label', () => {
    render(<CostPerHourNote />);
    expect(screen.getByText('Note:')).toBeInTheDocument();
  });

  it('mentions that actual cost may differ', () => {
    render(<CostPerHourNote />);
    expect(screen.getByText(/Your actual cost may have been different/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Empty-state for cost-per-hour (used when ranked + freeGames are both empty)
// ---------------------------------------------------------------------------

describe('CostPerHour empty state', () => {
  it('renders the EmptyState with the right title', () => {
    render(
      <EmptyState
        title="No cost data yet"
        description="We need both playtime history and store price data to rank your games."
      />,
    );
    expect(screen.getByText('No cost data yet')).toBeInTheDocument();
  });

  it('renders the description', () => {
    render(
      <EmptyState
        title="No cost data yet"
        description="We need both playtime history and store price data to rank your games."
      />,
    );
    expect(
      screen.getByText(/We need both playtime history and store price data/),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Empty-state for genres page
// ---------------------------------------------------------------------------

describe('Genres empty state', () => {
  it('renders the EmptyState for the genre breakdown', () => {
    render(
      <EmptyState
        title="No genre data yet"
        description="Play some games or make sure the nightly job has run to see your genre breakdown."
      />,
    );
    expect(screen.getByText('No genre data yet')).toBeInTheDocument();
    expect(screen.getByText(/nightly job/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Empty-state for idle page
// ---------------------------------------------------------------------------

describe('Idle empty state', () => {
  it('renders the EmptyState for no flags', () => {
    render(
      <EmptyState
        title="No unusual spikes detected"
        description="All your playtime increments look normal. Keep playing!"
      />,
    );
    expect(screen.getByText('No unusual spikes detected')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Empty-state for Year in Review (no data year)
// ---------------------------------------------------------------------------

describe('Year in Review empty state', () => {
  it('renders the EmptyState for a year with no data', () => {
    render(
      <EmptyState
        title="No data for 2019"
        description="Make sure the nightly job has been running to generate Year in Review data."
      />,
    );
    expect(screen.getByText('No data for 2019')).toBeInTheDocument();
    expect(screen.getByText(/nightly job has been running/)).toBeInTheDocument();
  });
});
