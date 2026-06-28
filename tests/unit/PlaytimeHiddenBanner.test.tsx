// @vitest-environment jsdom
/**
 * tests/unit/PlaytimeHiddenBanner.test.tsx
 * Red-first test for AC6 (bug-02): component doesn't exist yet.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PlaytimeHiddenBanner } from '@/components/library/PlaytimeHiddenBanner';

describe('PlaytimeHiddenBanner', () => {
  it('renders the privacy explanation copy', () => {
    render(<PlaytimeHiddenBanner />);
    expect(screen.getByText(/playtime is hidden/i)).toBeInTheDocument();
  });

  it('renders a link to the Steam privacy settings page', () => {
    render(<PlaytimeHiddenBanner />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://steamcommunity.com/my/edit/settings');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('renders no fabricated number (no digit in text content)', () => {
    render(<PlaytimeHiddenBanner />);
    const banner = screen.getByRole('status');
    // The banner must not contain bare digits (no fabricated count)
    expect(banner.textContent).not.toMatch(/\b\d+\b/);
  });
});
