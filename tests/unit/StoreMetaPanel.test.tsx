// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StoreMetaPanel } from '@/components/game/StoreMetaPanel';
import { available, unavailable } from '@/lib/result';
import type { StoreMetadata, StorePrice } from '@/lib/steam/store-client';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const META: StoreMetadata = {
  name: 'Portal 2',
  shortDescription: 'A mind-bending puzzle platformer.',
  headerImage: 'https://cdn.akamai.steamstatic.com/steam/apps/620/header.jpg',
  genres: ['Action', 'Puzzle'],
  categories: ['Single-player', 'Multi-player'],
  developers: ['Valve'],
  publishers: ['Valve'],
  releaseDate: '18 Apr, 2011',
  platforms: { windows: true, mac: true, linux: true },
};

const PAID_PRICE: StorePrice = {
  currency: 'USD',
  initialCents: 999,
  finalCents: 999,
  discountPercent: 0,
  formatted: '$9.99',
};

const DISCOUNTED_PRICE: StorePrice = {
  currency: 'USD',
  initialCents: 999,
  finalCents: 499,
  discountPercent: 50,
  formatted: '$4.99',
};

// ---------------------------------------------------------------------------
// Tests: available metadata + paid price
// ---------------------------------------------------------------------------

describe('StoreMetaPanel — available metadata', () => {
  it('renders the short description', () => {
    render(<StoreMetaPanel metadata={available(META)} price={available(PAID_PRICE)} />);
    expect(screen.getByText('A mind-bending puzzle platformer.')).toBeInTheDocument();
  });

  it('renders genre chips', () => {
    render(<StoreMetaPanel metadata={available(META)} price={available(PAID_PRICE)} />);
    expect(screen.getByText('Action')).toBeInTheDocument();
    expect(screen.getByText('Puzzle')).toBeInTheDocument();
  });

  it('renders category chips', () => {
    render(<StoreMetaPanel metadata={available(META)} price={available(PAID_PRICE)} />);
    expect(screen.getByText('Single-player')).toBeInTheDocument();
    expect(screen.getByText('Multi-player')).toBeInTheDocument();
  });

  it('renders the formatted price', () => {
    render(<StoreMetaPanel metadata={available(META)} price={available(PAID_PRICE)} />);
    expect(screen.getByText('$9.99')).toBeInTheDocument();
  });

  it('renders "Free" for a free game (price.data === null)', () => {
    render(<StoreMetaPanel metadata={available(META)} price={available(null)} />);
    expect(screen.getByText('Free')).toBeInTheDocument();
  });

  it('renders the developer in a label/value row', () => {
    render(<StoreMetaPanel metadata={available(META)} price={available(PAID_PRICE)} />);
    // Developer and publisher are both "Valve" in the fixture — getAllByText handles the duplicate
    const valveElements = screen.getAllByText('Valve');
    expect(valveElements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the release date', () => {
    render(<StoreMetaPanel metadata={available(META)} price={available(PAID_PRICE)} />);
    expect(screen.getByText('18 Apr, 2011')).toBeInTheDocument();
  });

  it('shows a discount badge when discountPercent > 0', () => {
    render(<StoreMetaPanel metadata={available(META)} price={available(DISCOUNTED_PRICE)} />);
    expect(screen.getByText(/-50%/)).toBeInTheDocument();
    expect(screen.getByText('$4.99')).toBeInTheDocument();
  });

  it('shows no discount badge when discountPercent is 0', () => {
    render(<StoreMetaPanel metadata={available(META)} price={available(PAID_PRICE)} />);
    expect(screen.queryByText(/-0%/)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests: unavailable metadata
// ---------------------------------------------------------------------------

describe('StoreMetaPanel — unavailable metadata', () => {
  it('renders the "Store metadata unavailable" notice', () => {
    render(
      <StoreMetaPanel
        metadata={unavailable('metadata-unavailable')}
        price={unavailable('metadata-unavailable')}
      />,
    );
    expect(screen.getByText('Store metadata unavailable')).toBeInTheDocument();
  });

  it('does not render genres or description when metadata is unavailable', () => {
    render(
      <StoreMetaPanel
        metadata={unavailable('metadata-unavailable')}
        price={unavailable('metadata-unavailable')}
      />,
    );
    expect(screen.queryByText('Action')).not.toBeInTheDocument();
    expect(screen.queryByText('A mind-bending puzzle platformer.')).not.toBeInTheDocument();
  });

  it('does not render a price when metadata is unavailable', () => {
    // Even if price would be available, we don't render it without the metadata panel
    render(
      <StoreMetaPanel
        metadata={unavailable('metadata-unavailable')}
        price={available(PAID_PRICE)}
      />,
    );
    expect(screen.queryByText('$9.99')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests: price unavailable but metadata available
// ---------------------------------------------------------------------------

describe('StoreMetaPanel — metadata available, price unavailable', () => {
  it('still renders metadata without crashing', () => {
    render(
      <StoreMetaPanel metadata={available(META)} price={unavailable('metadata-unavailable')} />,
    );
    expect(screen.getByText('A mind-bending puzzle platformer.')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
  });

  it('does not render any price when price is unavailable', () => {
    render(
      <StoreMetaPanel metadata={available(META)} price={unavailable('metadata-unavailable')} />,
    );
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
    expect(screen.queryByText('Free')).not.toBeInTheDocument();
  });
});
