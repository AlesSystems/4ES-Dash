// @vitest-environment jsdom
/**
 * RetryBoundary component tests.
 *
 * next/navigation is mocked so jsdom has a router.
 * We verify:
 *   - a throwing child renders the RouteError fallback (Retry button visible)
 *   - after reset with a non-throwing child, children render again
 */

import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock next/navigation — must come before the component imports.
// ---------------------------------------------------------------------------

const mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

import { RetryBoundary } from '@/components/states/RetryBoundary';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A child that always throws during render. */
function ThrowingChild(): JSX.Element {
  throw new Error('Child render error');
}

/** A child that renders normally. */
function GoodChild(): JSX.Element {
  return <div data-testid="good-child">All good</div>;
}

// Suppress React's error boundary console.error noise in test output.
const originalConsoleError = console.error;
beforeEach(() => {
  mockRefresh.mockClear();
  // Suppress React error boundary noise
  console.error = vi.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RetryBoundary', () => {
  it('renders children when no error is thrown', () => {
    render(
      <RetryBoundary>
        <GoodChild />
      </RetryBoundary>,
    );
    expect(screen.getByTestId('good-child')).toBeInTheDocument();
  });

  it('renders the fallback (Retry button) when a child throws', () => {
    render(
      <RetryBoundary>
        <ThrowingChild />
      </RetryBoundary>,
    );
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('does not render children after a child throws', () => {
    render(
      <RetryBoundary>
        <ThrowingChild />
      </RetryBoundary>,
    );
    expect(screen.queryByTestId('good-child')).toBeNull();
  });

  it('calls onReset when Retry is clicked', () => {
    const onReset = vi.fn();
    render(
      <RetryBoundary onReset={onReset}>
        <ThrowingChild />
      </RetryBoundary>,
    );
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it('calls router.refresh by default when Retry is clicked', () => {
    render(
      <RetryBoundary>
        <ThrowingChild />
      </RetryBoundary>,
    );
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(mockRefresh).toHaveBeenCalledOnce();
  });

  it('renders children again after reset when the child no longer throws', async () => {
    let shouldThrow = true;

    function MaybeThrow(): JSX.Element {
      if (shouldThrow) throw new Error('boom');
      return <div data-testid="recovered-child">Recovered</div>;
    }

    const { rerender } = render(
      <RetryBoundary>
        <MaybeThrow />
      </RetryBoundary>,
    );

    // Fallback is showing
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();

    // Fix the condition and click Retry
    shouldThrow = false;
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    });

    // Rerender with a non-throwing child to confirm boundary cleared
    rerender(
      <RetryBoundary>
        <MaybeThrow />
      </RetryBoundary>,
    );

    expect(screen.getByTestId('recovered-child')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
  });
});
