// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LibraryValueCard } from '@/components/dashboard/LibraryValueCard';
import type { LibraryValue } from '@/server/repositories/library-value';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeValue(partial: Partial<LibraryValue> = {}): LibraryValue {
  return {
    totalMinor: 9999, // $99.99 USD by default
    currency: 'USD',
    pricedCount: 10,
    freeCount: 2,
    missingCount: 0,
    stale: false,
    ...partial,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LibraryValueCard', () => {
  it('renders the formatted total value', () => {
    render(<LibraryValueCard value={makeValue({ totalMinor: 9999, currency: 'USD' })} />);
    // Intl.NumberFormat renders "$99.99" in a Node/jsdom locale
    expect(screen.getByText(/99\.99/)).toBeInTheDocument();
  });

  it('always renders the price-paid disclaimer note', () => {
    render(<LibraryValueCard value={makeValue()} />);
    expect(
      screen.getByText(
        /Based on current store prices — purchase prices are not available via Steam/i,
      ),
    ).toBeInTheDocument();
  });

  it('does NOT render a "vs. paid" purchase price comparison field', () => {
    render(<LibraryValueCard value={makeValue()} />);
    // The disclaimer mentions "purchase prices" but no comparison to what was paid.
    expect(screen.queryByText(/vs\.\s*paid/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/you paid/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/amount paid/i)).not.toBeInTheDocument();
  });

  it('shows "Some prices unavailable" when missingCount > 0', () => {
    render(<LibraryValueCard value={makeValue({ missingCount: 3 })} />);
    expect(screen.getByText(/Some prices unavailable/i)).toBeInTheDocument();
  });

  it('does NOT show "Some prices unavailable" when missingCount is 0', () => {
    render(<LibraryValueCard value={makeValue({ missingCount: 0 })} />);
    expect(screen.queryByText(/Some prices unavailable/i)).not.toBeInTheDocument();
  });

  it('free games do not inflate the total (totalMinor reflects only priced)', () => {
    // totalMinor is 500 cents = $5.00, freeCount=3 — free games add nothing
    render(
      <LibraryValueCard
        value={makeValue({ totalMinor: 500, currency: 'USD', pricedCount: 1, freeCount: 3 })}
      />,
    );
    // Should show $5.00, not some inflated amount
    expect(screen.getByText(/5\.00/)).toBeInTheDocument();
    // Should also mention the 3 free games in the sub-line
    expect(screen.getByText(/3 free/i)).toBeInTheDocument();
  });

  it('renders pricedCount in the sub-line', () => {
    render(<LibraryValueCard value={makeValue({ pricedCount: 42, freeCount: 0 })} />);
    expect(screen.getByText(/42 games/i)).toBeInTheDocument();
  });

  it('uses USD as fallback currency when currency is empty', () => {
    // currency='' → Intl falls back to USD — just check it renders without throwing
    render(<LibraryValueCard value={makeValue({ totalMinor: 0, currency: '', pricedCount: 0 })} />);
    // Should render 0.00 in some currency format without crashing
    expect(screen.getByText(/0\.00/)).toBeInTheDocument();
  });
});
