// @vitest-environment jsdom
/**
 * GenreChart component tests.
 *
 * Tremor is lazy-loaded via next/dynamic — we mock the dynamic import so the
 * DonutChart renders synchronously in jsdom without a Tremor bundle.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeAll } from 'vitest';

// ---------------------------------------------------------------------------
// Mock next/dynamic to resolve the lazy component synchronously.
// ---------------------------------------------------------------------------

vi.mock('next/dynamic', () => ({
  default: (factory: () => Promise<unknown>) => {
    // Return a simple placeholder — we just need the wrapper to render.
    const Stub = ({ data }: { data: { name: string; value: number }[] }) => (
      <ul data-testid="donut-chart">
        {data.map((d) => (
          <li key={d.name}>
            {d.name}: {d.value}
          </li>
        ))}
      </ul>
    );
    Stub.displayName = 'MockDonutChart';
    // Attach loading for completeness (not exercised in these tests)
    return Stub;
  },
}));

import { GenreChart } from '@/components/insights/GenreChart';
import type { BreakdownSlice } from '@/lib/insights/genres';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SLICES: BreakdownSlice[] = [
  { label: 'RPG', minutes: 300, percent: 60 },
  { label: 'Action', minutes: 200, percent: 40 },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GenreChart', () => {
  it('renders a container with the aria-label', () => {
    render(<GenreChart slices={SLICES} totalMinutes={500} aria-label="Genre breakdown chart" />);
    expect(screen.getByRole('img', { name: 'Genre breakdown chart' })).toBeInTheDocument();
  });

  it('renders a chart element (the mocked DonutChart)', () => {
    render(<GenreChart slices={SLICES} totalMinutes={500} />);
    expect(screen.getByTestId('donut-chart')).toBeInTheDocument();
  });

  it('passes slice labels to the chart', () => {
    render(<GenreChart slices={SLICES} totalMinutes={500} />);
    expect(screen.getByText(/RPG/)).toBeInTheDocument();
    expect(screen.getByText(/Action/)).toBeInTheDocument();
  });

  it('renders with empty slices without crashing', () => {
    render(<GenreChart slices={[]} totalMinutes={0} />);
    expect(screen.getByTestId('donut-chart')).toBeInTheDocument();
  });

  it('uses the default aria-label when none provided', () => {
    render(<GenreChart slices={SLICES} totalMinutes={500} />);
    expect(screen.getByRole('img', { name: 'Genre breakdown' })).toBeInTheDocument();
  });
});
