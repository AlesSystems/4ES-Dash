// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GameTile } from '@/components/games/GameTile';

describe('GameTile', () => {
  const defaultProps = {
    name: 'Half-Life 2',
    headerUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/220/header.jpg',
    playtimeMinutes: 90,
  };

  it('renders the game name', () => {
    render(<GameTile {...defaultProps} />);
    expect(screen.getByText('Half-Life 2')).toBeInTheDocument();
  });

  it('renders "1.5 h" when playtimeMinutes is 90', () => {
    render(<GameTile {...defaultProps} />);
    expect(screen.getByText('1.5 h')).toBeInTheDocument();
  });

  it('renders an img with alt equal to the game name', () => {
    render(<GameTile {...defaultProps} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('alt', 'Half-Life 2');
  });
});
