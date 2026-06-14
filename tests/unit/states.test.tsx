// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from '@/components/states/EmptyState';
import { StaleBanner } from '@/components/states/StaleBanner';

describe('EmptyState', () => {
  it('renders the title', () => {
    render(<EmptyState title="No games found" />);
    expect(screen.getByText('No games found')).toBeInTheDocument();
  });

  it('renders the description when provided', () => {
    render(
      <EmptyState
        title="No games found"
        description="Add games to your library to see them here."
      />,
    );
    expect(screen.getByText('No games found')).toBeInTheDocument();
    expect(screen.getByText('Add games to your library to see them here.')).toBeInTheDocument();
  });

  it('does not render a description element when omitted', () => {
    render(<EmptyState title="No games found" />);
    expect(screen.queryByText(/Add games/)).toBeNull();
  });
});

describe('StaleBanner', () => {
  it('renders the stale data text', () => {
    render(<StaleBanner />);
    expect(screen.getByText('Data may be outdated')).toBeInTheDocument();
  });

  it('has role="status"', () => {
    render(<StaleBanner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('accepts an optional className without errors', () => {
    render(<StaleBanner className="mt-4" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
