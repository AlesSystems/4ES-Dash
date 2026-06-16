// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BacklogCard } from '@/components/dashboard/BacklogCard';

describe('BacklogCard', () => {
  const baseProps = { untouchedCount: 42, librarySize: 100 };

  it('renders the "Browse the backlog" CTA when there are unplayed games', () => {
    render(<BacklogCard {...baseProps} />);
    expect(screen.getByRole('link', { name: /Browse the backlog/i })).toBeInTheDocument();
  });

  it('renders the empty state and hides the CTA when untouchedCount is 0', () => {
    render(<BacklogCard untouchedCount={0} librarySize={50} />);
    expect(screen.getByText(/you've started every game/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Browse the backlog/i })).not.toBeInTheDocument();
  });

  it('does NOT render the oldest-unplayed block when oldestUnplayed is undefined', () => {
    render(<BacklogCard {...baseProps} />);
    expect(screen.queryByText(/Oldest unplayed/i)).not.toBeInTheDocument();
  });

  it('does NOT render the oldest-unplayed block when oldestUnplayed is null', () => {
    render(<BacklogCard {...baseProps} oldestUnplayed={null} />);
    expect(screen.queryByText(/Oldest unplayed/i)).not.toBeInTheDocument();
  });

  it('renders the oldest unplayed game name and formatted date when acquiredAt is known', () => {
    render(
      <BacklogCard
        {...baseProps}
        oldestUnplayed={{ name: 'Hollow Knight', acquiredAt: '2021-03-15' }}
      />,
    );
    expect(screen.getByText('Hollow Knight')).toBeInTheDocument();
    // "Added Mar 2021" — month/year formatted via Intl in UTC
    expect(screen.getByText('Added Mar 2021')).toBeInTheDocument();
  });

  it('renders "Date unknown" when acquiredAt is null', () => {
    render(
      <BacklogCard {...baseProps} oldestUnplayed={{ name: 'Disco Elysium', acquiredAt: null }} />,
    );
    expect(screen.getByText('Disco Elysium')).toBeInTheDocument();
    expect(screen.getByText('Date unknown')).toBeInTheDocument();
  });

  it('does not render the oldest-unplayed block when untouchedCount is 0, even if prop is given', () => {
    render(
      <BacklogCard
        untouchedCount={0}
        librarySize={50}
        oldestUnplayed={{ name: 'Some Game', acquiredAt: null }}
      />,
    );
    // The whole footer is hidden when isEmpty; no oldest-unplayed section should appear
    expect(screen.queryByText('Some Game')).not.toBeInTheDocument();
    expect(screen.queryByText(/Date unknown/i)).not.toBeInTheDocument();
  });
});
