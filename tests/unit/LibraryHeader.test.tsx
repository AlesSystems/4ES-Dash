// @vitest-environment jsdom
/**
 * tests/unit/LibraryHeader.test.tsx
 * Red-first test for AC5 (bug-02): playtimeHidden prop doesn't exist yet.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LibraryHeader } from '@/components/library/LibraryHeader';

const defaultProps = {
  accountAgeYears: 5,
  gamesCount: 100,
  totalPlaytimeMinutes: 6000,
  inProgressCount: 10,
  untouchedCount: 50,
};

describe('LibraryHeader', () => {
  it('renders untouched count normally when playtimeHidden is absent', () => {
    render(<LibraryHeader {...defaultProps} />);
    expect(screen.getByText('50 unplayed')).toBeInTheDocument();
  });

  it('hides fabricated unplayed count when playtimeHidden=true', () => {
    render(<LibraryHeader {...defaultProps} playtimeHidden />);
    expect(screen.queryByText('50 unplayed')).not.toBeInTheDocument();
    // Should not render the numeric untouched stat
    expect(screen.queryByText('50')).not.toBeInTheDocument();
  });

  it('shows "—" for untouched stat when playtimeHidden=true', () => {
    render(<LibraryHeader {...defaultProps} playtimeHidden />);
    // "—" should appear in place of the count
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('still shows gamesCount and totalHours regardless of playtimeHidden', () => {
    render(<LibraryHeader {...defaultProps} playtimeHidden />);
    expect(screen.getByText('100 games')).toBeInTheDocument();
    expect(screen.getByText('100 hours')).toBeInTheDocument();
  });
});
