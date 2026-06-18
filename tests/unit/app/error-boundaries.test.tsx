// @vitest-environment jsdom
/**
 * Error boundary tests for route-segment error.tsx files.
 *
 * AC5: Rendering an error.tsx with a fake error + reset spy asserts the fallback
 *      (heading + Retry button) renders and clicking Retry calls reset.
 * AC4: Production-safety — pass an Error whose message/stack contains a
 *      recognizable secret string and assert it is ABSENT from the rendered output.
 *
 * We test the shared RouteError contract (already covered in route-error.test.tsx)
 * and one representative segment error.tsx per the requirements, plus global-error.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock next/navigation — must come before component imports.
// ---------------------------------------------------------------------------

const mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

// ---------------------------------------------------------------------------
// Import all error boundary components (they don't exist yet → tests will fail)
// ---------------------------------------------------------------------------

import HomeError from '@/app/error';
import LibraryError from '@/app/library/error';
import GameError from '@/app/game/[appId]/error';
import FriendsError from '@/app/friends/error';
import HistoryError from '@/app/history/error';
import CompareError from '@/app/compare/error';
import ReviewError from '@/app/review/[year]/error';
import InsightsError from '@/app/insights/error';
import GlobalError from '@/app/global-error';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeError(message: string, stack?: string): Error & { digest?: string } {
  const err = new Error(message);
  if (stack !== undefined) err.stack = stack;
  return err;
}

const SECRET = 'SUPER_SECRET_KEY_XYZ_1234567890';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('app/error.tsx (home segment)', () => {
  const resetSpy = vi.fn();

  beforeEach(() => {
    resetSpy.mockClear();
    mockRefresh.mockClear();
  });

  it('AC5: renders a heading', () => {
    render(<HomeError error={makeError('boom')} reset={resetSpy} />);
    expect(screen.getByRole('heading')).toBeInTheDocument();
  });

  it('AC5: renders a Retry button', () => {
    render(<HomeError error={makeError('boom')} reset={resetSpy} />);
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('AC5: clicking Retry calls reset', () => {
    render(<HomeError error={makeError('boom')} reset={resetSpy} />);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(resetSpy).toHaveBeenCalledOnce();
  });

  it('AC4: does not render error.message in the DOM', () => {
    render(<HomeError error={makeError(SECRET)} reset={resetSpy} />);
    expect(document.body.textContent).not.toContain(SECRET);
  });

  it('AC4: does not render error.stack in the DOM', () => {
    const err = makeError('boom');
    err.stack = `Error: boom\n    at Object.<anonymous> ${SECRET}`;
    render(<HomeError error={err} reset={resetSpy} />);
    expect(document.body.textContent).not.toContain(SECRET);
  });
});

describe('app/library/error.tsx', () => {
  const resetSpy = vi.fn();

  beforeEach(() => {
    resetSpy.mockClear();
    mockRefresh.mockClear();
  });

  it('AC1: renders route-appropriate title (library)', () => {
    render(<LibraryError error={makeError('boom')} reset={resetSpy} />);
    expect(screen.getByRole('heading')).toHaveTextContent(/library/i);
  });

  it('AC5: renders a Retry button', () => {
    render(<LibraryError error={makeError('boom')} reset={resetSpy} />);
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('AC5: clicking Retry calls reset', () => {
    render(<LibraryError error={makeError('boom')} reset={resetSpy} />);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(resetSpy).toHaveBeenCalledOnce();
  });

  it('AC4: does not expose secret in output', () => {
    render(<LibraryError error={makeError(SECRET)} reset={resetSpy} />);
    expect(document.body.textContent).not.toContain(SECRET);
  });
});

describe('app/game/[appId]/error.tsx', () => {
  const resetSpy = vi.fn();

  beforeEach(() => {
    resetSpy.mockClear();
    mockRefresh.mockClear();
  });

  it('AC1: renders route-appropriate title (game)', () => {
    render(<GameError error={makeError('boom')} reset={resetSpy} />);
    expect(screen.getByRole('heading')).toHaveTextContent(/game/i);
  });

  it('AC5: renders a Retry button and calls reset on click', () => {
    render(<GameError error={makeError('boom')} reset={resetSpy} />);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(resetSpy).toHaveBeenCalledOnce();
  });

  it('AC4: does not expose secret in output', () => {
    render(<GameError error={makeError(SECRET)} reset={resetSpy} />);
    expect(document.body.textContent).not.toContain(SECRET);
  });
});

describe('app/friends/error.tsx', () => {
  const resetSpy = vi.fn();

  beforeEach(() => {
    resetSpy.mockClear();
    mockRefresh.mockClear();
  });

  it('AC1: renders route-appropriate title (friends)', () => {
    render(<FriendsError error={makeError('boom')} reset={resetSpy} />);
    expect(screen.getByRole('heading')).toHaveTextContent(/friend/i);
  });

  it('AC5: clicking Retry calls reset', () => {
    render(<FriendsError error={makeError('boom')} reset={resetSpy} />);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(resetSpy).toHaveBeenCalledOnce();
  });

  it('AC4: does not expose secret in output', () => {
    render(<FriendsError error={makeError(SECRET)} reset={resetSpy} />);
    expect(document.body.textContent).not.toContain(SECRET);
  });
});

describe('app/history/error.tsx', () => {
  const resetSpy = vi.fn();

  beforeEach(() => {
    resetSpy.mockClear();
    mockRefresh.mockClear();
  });

  it('AC1: renders route-appropriate title (history)', () => {
    render(<HistoryError error={makeError('boom')} reset={resetSpy} />);
    expect(screen.getByRole('heading')).toHaveTextContent(/history/i);
  });

  it('AC5: clicking Retry calls reset', () => {
    render(<HistoryError error={makeError('boom')} reset={resetSpy} />);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(resetSpy).toHaveBeenCalledOnce();
  });

  it('AC4: does not expose secret in output', () => {
    render(<HistoryError error={makeError(SECRET)} reset={resetSpy} />);
    expect(document.body.textContent).not.toContain(SECRET);
  });
});

describe('app/compare/error.tsx', () => {
  const resetSpy = vi.fn();

  beforeEach(() => {
    resetSpy.mockClear();
    mockRefresh.mockClear();
  });

  it('AC1: renders route-appropriate title (compare)', () => {
    render(<CompareError error={makeError('boom')} reset={resetSpy} />);
    expect(screen.getByRole('heading')).toHaveTextContent(/compare/i);
  });

  it('AC5: clicking Retry calls reset', () => {
    render(<CompareError error={makeError('boom')} reset={resetSpy} />);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(resetSpy).toHaveBeenCalledOnce();
  });

  it('AC4: does not expose secret in output', () => {
    render(<CompareError error={makeError(SECRET)} reset={resetSpy} />);
    expect(document.body.textContent).not.toContain(SECRET);
  });
});

describe('app/review/[year]/error.tsx', () => {
  const resetSpy = vi.fn();

  beforeEach(() => {
    resetSpy.mockClear();
    mockRefresh.mockClear();
  });

  it('AC1: renders route-appropriate title (review)', () => {
    render(<ReviewError error={makeError('boom')} reset={resetSpy} />);
    expect(screen.getByRole('heading')).toHaveTextContent(/review/i);
  });

  it('AC5: clicking Retry calls reset', () => {
    render(<ReviewError error={makeError('boom')} reset={resetSpy} />);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(resetSpy).toHaveBeenCalledOnce();
  });

  it('AC4: does not expose secret in output', () => {
    render(<ReviewError error={makeError(SECRET)} reset={resetSpy} />);
    expect(document.body.textContent).not.toContain(SECRET);
  });
});

describe('app/insights/error.tsx', () => {
  const resetSpy = vi.fn();

  beforeEach(() => {
    resetSpy.mockClear();
    mockRefresh.mockClear();
  });

  it('AC1: renders route-appropriate title (insights)', () => {
    render(<InsightsError error={makeError('boom')} reset={resetSpy} />);
    expect(screen.getByRole('heading')).toHaveTextContent(/insight/i);
  });

  it('AC5: clicking Retry calls reset', () => {
    render(<InsightsError error={makeError('boom')} reset={resetSpy} />);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(resetSpy).toHaveBeenCalledOnce();
  });

  it('AC4: does not expose secret in output', () => {
    render(<InsightsError error={makeError(SECRET)} reset={resetSpy} />);
    expect(document.body.textContent).not.toContain(SECRET);
  });
});

describe('app/global-error.tsx', () => {
  const resetSpy = vi.fn();

  beforeEach(() => {
    resetSpy.mockClear();
    mockRefresh.mockClear();
  });

  it('AC2: renders a heading (last-resort UI)', () => {
    render(<GlobalError error={makeError('boom')} reset={resetSpy} />);
    expect(screen.getByRole('heading')).toBeInTheDocument();
  });

  it('AC2: renders a retry button', () => {
    render(<GlobalError error={makeError('boom')} reset={resetSpy} />);
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('AC5: clicking Retry calls reset', () => {
    render(<GlobalError error={makeError('boom')} reset={resetSpy} />);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(resetSpy).toHaveBeenCalledOnce();
  });

  it('AC4: does not expose secret in output', () => {
    render(<GlobalError error={makeError(SECRET)} reset={resetSpy} />);
    expect(document.body.textContent).not.toContain(SECRET);
  });
});
