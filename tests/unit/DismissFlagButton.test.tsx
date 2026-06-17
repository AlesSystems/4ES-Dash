// @vitest-environment jsdom
/**
 * DismissFlagButton component tests.
 *
 * The server action is mocked so the test doesn't touch the database.
 * useTransition is available in React 18 jsdom — we rely on act() to flush it.
 */

import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the server action — must be declared before the component import.
// ---------------------------------------------------------------------------

const mockDismissAction = vi.fn().mockResolvedValue(undefined);

vi.mock('@/app/insights/idle/actions', () => ({
  dismissIdleFlagAction: (...args: unknown[]) => mockDismissAction(...args),
}));

import { DismissFlagButton } from '@/components/insights/DismissFlagButton';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DEFAULT_PROPS = {
  appId: 440,
  fromDate: '2025-01-01T00:00:00.000Z',
  toDate: '2025-01-02T00:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DismissFlagButton', () => {
  beforeEach(() => {
    mockDismissAction.mockClear();
    mockDismissAction.mockResolvedValue(undefined);
  });

  it('renders a button with label "Dismiss"', () => {
    render(<DismissFlagButton {...DEFAULT_PROPS} />);
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
  });

  it('calls dismissIdleFlagAction with the correct args when clicked', async () => {
    render(<DismissFlagButton {...DEFAULT_PROPS} />);
    const btn = screen.getByRole('button', { name: /dismiss/i });

    await act(async () => {
      fireEvent.click(btn);
    });

    expect(mockDismissAction).toHaveBeenCalledOnce();
    expect(mockDismissAction).toHaveBeenCalledWith({
      appId: DEFAULT_PROPS.appId,
      fromDate: DEFAULT_PROPS.fromDate,
      toDate: DEFAULT_PROPS.toDate,
    });
  });

  it('shows "Dismissed" after the action resolves', async () => {
    render(<DismissFlagButton {...DEFAULT_PROPS} />);
    const btn = screen.getByRole('button', { name: /dismiss/i });

    await act(async () => {
      fireEvent.click(btn);
    });

    expect(screen.getByText('Dismissed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument();
  });

  it('the button is initially enabled', () => {
    render(<DismissFlagButton {...DEFAULT_PROPS} />);
    expect(screen.getByRole('button', { name: /dismiss/i })).not.toBeDisabled();
  });
});
