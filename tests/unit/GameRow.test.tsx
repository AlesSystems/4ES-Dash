// @vitest-environment jsdom
/**
 * tests/unit/GameRow.test.tsx
 * Red-first test for AC4 (bug-02): playtimeHidden prop doesn't exist yet.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { GameRow } from '@/components/library/GameRow';

const defaultProps = {
  appId: 220,
  name: 'Half-Life 2',
  headerUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/220/header.jpg',
  playtimeMinutes: 0,
};

describe('GameRow', () => {
  it('renders "Untouched" when playtimeMinutes=0 and playtimeHidden is absent', () => {
    render(<GameRow {...defaultProps} />);
    expect(screen.getByText('Untouched')).toBeInTheDocument();
  });

  it('renders "—" instead of "Untouched" when playtimeHidden=true', () => {
    render(<GameRow {...defaultProps} playtimeHidden />);
    expect(screen.queryByText('Untouched')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('still renders formatted hours when playtimeMinutes>0 regardless of playtimeHidden', () => {
    render(<GameRow {...defaultProps} playtimeMinutes={120} playtimeHidden />);
    expect(screen.getByText('2 h')).toBeInTheDocument();
    expect(screen.queryByText('Untouched')).not.toBeInTheDocument();
  });
});
