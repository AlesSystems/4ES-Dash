// @vitest-environment jsdom
/**
 * Red-first tests for AC2 (bug-04): ResyncButton always resolves its loading
 * state; designed error message on failure; "Synced" on success.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockResyncNow = vi.fn();
vi.mock('@/app/settings/actions', () => ({
  resyncNow: (...args: unknown[]) => mockResyncNow(...args),
}));

import { ResyncButton } from '@/app/settings/ResyncButton';

beforeEach(() => {
  mockResyncNow.mockReset();
});

describe('ResyncButton — loading state resolution (bug-04)', () => {
  it('shows "Synced" after resyncNow resolves successfully', async () => {
    mockResyncNow.mockResolvedValue({ onboarded: true });
    render(<ResyncButton />);

    fireEvent.click(screen.getByRole('button', { name: /re-sync now/i }));

    await waitFor(() => {
      expect(screen.getByText('Synced')).toBeInTheDocument();
    });
    // Loading is cleared (button is no longer pending)
    expect(screen.queryByText(/re-syncing/i)).not.toBeInTheDocument();
  });

  it('shows an error message when resyncNow rejects — spinner does NOT persist', async () => {
    mockResyncNow.mockRejectedValue(new Error('Steam timeout'));
    render(<ResyncButton />);

    fireEvent.click(screen.getByRole('button', { name: /re-sync now/i }));

    await waitFor(() => {
      // An error state must be visible
      expect(screen.queryByText(/re-syncing/i)).not.toBeInTheDocument();
    });

    // "Synced" must NOT appear on failure
    expect(screen.queryByText('Synced')).not.toBeInTheDocument();

    // An error message must be visible (text-danger or similar)
    const errorEl = document.querySelector('[aria-live]');
    expect(errorEl).not.toBeNull();
    expect(errorEl?.textContent).toMatch(/failed|error|try again/i);
  });

  it('loading state always clears after settle (success)', async () => {
    mockResyncNow.mockResolvedValue({ onboarded: true });
    render(<ResyncButton />);
    fireEvent.click(screen.getByRole('button', { name: /re-sync now/i }));
    await waitFor(() => expect(screen.queryByText(/re-syncing/i)).not.toBeInTheDocument());
  });

  it('loading state always clears after settle (rejection)', async () => {
    mockResyncNow.mockRejectedValue(new Error('fail'));
    render(<ResyncButton />);
    fireEvent.click(screen.getByRole('button', { name: /re-sync now/i }));
    await waitFor(() => expect(screen.queryByText(/re-syncing/i)).not.toBeInTheDocument());
  });
});
