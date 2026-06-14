// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProfileHeader } from '../../components/profile/ProfileHeader';

describe('ProfileHeader', () => {
  const baseProps = {
    personaName: 'SteamUser42',
    avatarUrl: 'https://avatars.steamstatic.com/avatar.jpg',
  };

  it('renders the persona name', () => {
    render(<ProfileHeader {...baseProps} />);
    expect(screen.getByText('SteamUser42')).toBeInTheDocument();
  });

  it('renders the avatar image with alt equal to personaName', () => {
    render(<ProfileHeader {...baseProps} />);
    const img = screen.getByRole('img', { name: 'SteamUser42' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('alt', 'SteamUser42');
  });

  it('renders a link with the profileUrl when provided', () => {
    render(<ProfileHeader {...baseProps} profileUrl="https://steamcommunity.com/id/steamuser42" />);
    const link = screen.getByRole('link', { name: 'SteamUser42' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://steamcommunity.com/id/steamuser42');
  });

  it('does not render a link when profileUrl is omitted', () => {
    render(<ProfileHeader {...baseProps} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders the country code when provided', () => {
    render(<ProfileHeader {...baseProps} countryCode="DE" />);
    expect(screen.getByText('DE')).toBeInTheDocument();
  });

  it('does not render a country code element when omitted', () => {
    render(<ProfileHeader {...baseProps} />);
    // No subtitle text visible
    expect(screen.queryByText(/^[A-Z]{2}$/)).not.toBeInTheDocument();
  });
});
