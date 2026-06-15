// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GameCard } from '@/components/library/GameCard';

describe('GameCard', () => {
  const defaultProps = {
    appId: 220,
    name: 'Half-Life 2',
    headerUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/220/header.jpg',
    playtimeMinutes: 90,
  };

  it('renders the game name', () => {
    render(<GameCard {...defaultProps} />);
    expect(screen.getByText('Half-Life 2')).toBeInTheDocument();
  });

  it('renders total playtime formatted as hours', () => {
    render(<GameCard {...defaultProps} />);
    // 90 minutes = 1.5 h
    expect(screen.getByText('1.5 h')).toBeInTheDocument();
  });

  it('renders a link to /game/<appId>', () => {
    render(<GameCard {...defaultProps} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/game/220');
  });

  it('link has an accessible name containing the game name', () => {
    render(<GameCard {...defaultProps} />);
    const link = screen.getByRole('link', { name: /Half-Life 2/ });
    expect(link).toBeInTheDocument();
  });

  it('renders cover image with alt equal to the game name', () => {
    render(<GameCard {...defaultProps} />);
    const img = screen.getByRole('img', { name: 'Half-Life 2' });
    expect(img).toBeInTheDocument();
  });

  it('shows "+X h recently" when twoWeeksMinutes is greater than 0', () => {
    render(<GameCard {...defaultProps} twoWeeksMinutes={60} />);
    expect(screen.getByText('+1 h recently')).toBeInTheDocument();
  });

  it('does not show recent caption when twoWeeksMinutes is 0', () => {
    render(<GameCard {...defaultProps} twoWeeksMinutes={0} />);
    expect(screen.queryByText(/recently/)).not.toBeInTheDocument();
  });

  it('does not show recent caption when twoWeeksMinutes is omitted', () => {
    render(<GameCard {...defaultProps} />);
    expect(screen.queryByText(/recently/)).not.toBeInTheDocument();
  });
});
