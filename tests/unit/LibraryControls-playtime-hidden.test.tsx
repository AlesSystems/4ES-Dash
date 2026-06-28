// @vitest-environment jsdom
/**
 * Red-first test for AC7 (bug-02): LibraryControls relabels "Untouched" chip.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/library',
}));

import { LibraryControls } from '@/components/library/LibraryControls';

const defaultProps = {
  sort: 'playtime' as const,
  query: '',
  total: 42,
  shown: 42,
  addedUnavailable: false,
};

describe('LibraryControls — playtimeHidden (bug-02)', () => {
  it('renders "Untouched" chip when playtimeHidden is absent', () => {
    render(<LibraryControls {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Untouched' })).toBeInTheDocument();
  });

  it('relabels the Untouched chip to "Playtime hidden" when playtimeHidden=true', () => {
    render(<LibraryControls {...defaultProps} playtimeHidden />);
    expect(screen.queryByRole('button', { name: 'Untouched' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Playtime hidden' })).toBeInTheDocument();
  });

  it('does not mutate STATUS_LABELS globally — other instances still say "Untouched"', () => {
    // Render hidden first, then normal — the mutation test
    const { unmount } = render(<LibraryControls {...defaultProps} playtimeHidden />);
    unmount();
    render(<LibraryControls {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Untouched' })).toBeInTheDocument();
  });
});
