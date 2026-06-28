// @vitest-environment jsdom
/**
 * Red-first test for AC3 (bug-02): GameCard playtimeHidden prop.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { GameCard } from '@/components/library/GameCard';

const defaultProps = {
  appId: 220,
  name: 'Half-Life 2',
  headerUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/220/header.jpg',
  playtimeMinutes: 0,
};

describe('GameCard — playtimeHidden (bug-02)', () => {
  it('renders "Untouched" text (corner pill + body) when playtimeMinutes=0 and playtimeHidden is absent', () => {
    render(<GameCard {...defaultProps} />);
    // GameCard renders Untouched in two places: corner pill + italic body span
    expect(screen.getAllByText('Untouched')).toHaveLength(2);
  });

  it('renders "—" instead of all "Untouched" text when playtimeHidden=true', () => {
    render(<GameCard {...defaultProps} playtimeHidden />);
    expect(screen.queryAllByText('Untouched')).toHaveLength(0);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('does not render the corner pill when playtimeHidden=true', () => {
    render(<GameCard {...defaultProps} playtimeHidden />);
    expect(screen.queryAllByText('Untouched')).toHaveLength(0);
  });
});
