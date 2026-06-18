// @vitest-environment jsdom
/**
 * RouteError component tests.
 *
 * next/navigation is mocked so jsdom has a router.
 * We verify:
 *   - default + custom title/description render
 *   - Retry invokes the reset spy
 *   - Retry calls router.refresh
 *   - The rendered DOM never contains error.message or error.stack text
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock next/navigation — must come before the component import.
// ---------------------------------------------------------------------------

const mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

import { RouteError } from '@/components/states/RouteError';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeError(message: string, stack?: string): Error & { digest?: string } {
  const err = new Error(message);
  if (stack !== undefined) err.stack = stack;
  return err;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RouteError', () => {
  const resetSpy = vi.fn();

  beforeEach(() => {
    resetSpy.mockClear();
    mockRefresh.mockClear();
  });

  it('renders the default title when none is provided', () => {
    render(<RouteError error={makeError('boom')} reset={resetSpy} />);
    expect(screen.getByRole('heading')).toHaveTextContent('Something went wrong');
  });

  it('renders a custom title when provided', () => {
    render(<RouteError error={makeError('boom')} reset={resetSpy} title="Library failed" />);
    expect(screen.getByRole('heading')).toHaveTextContent('Library failed');
  });

  it('renders the default description when none is provided', () => {
    render(<RouteError error={makeError('boom')} reset={resetSpy} />);
    // default description should contain some friendly copy
    expect(screen.getByText(/try again/i)).toBeInTheDocument();
  });

  it('renders a custom description when provided', () => {
    render(
      <RouteError
        error={makeError('boom')}
        reset={resetSpy}
        description="Custom friendly message"
      />,
    );
    expect(screen.getByText('Custom friendly message')).toBeInTheDocument();
  });

  it('calls the reset prop when Retry button is clicked', () => {
    render(<RouteError error={makeError('boom')} reset={resetSpy} />);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(resetSpy).toHaveBeenCalledOnce();
  });

  it('calls router.refresh when Retry button is clicked', () => {
    render(<RouteError error={makeError('boom')} reset={resetSpy} />);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(mockRefresh).toHaveBeenCalledOnce();
  });

  it('does not render error.message text in the DOM', () => {
    const err = makeError('super-secret-error-message-xyz');
    render(<RouteError error={err} reset={resetSpy} />);
    expect(screen.queryByText(/super-secret-error-message-xyz/)).toBeNull();
    expect(document.body.textContent).not.toContain('super-secret-error-message-xyz');
  });

  it('does not render error.stack text in the DOM', () => {
    const err = makeError('boom');
    err.stack = 'Error: boom\n    at <anonymous>:1:1 SECRET-STACK-TRACE';
    render(<RouteError error={err} reset={resetSpy} />);
    expect(document.body.textContent).not.toContain('SECRET-STACK-TRACE');
  });
});
