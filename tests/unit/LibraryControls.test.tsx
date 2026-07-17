// @vitest-environment jsdom
import { render, screen, within, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LibraryControls } from '@/components/library/LibraryControls';
import { SORT_KEYS, SORT_LABELS } from '@/lib/games/sort';

// Shared mock replace function — reassigned per test that needs to assert on it.
const mockReplace = vi.fn();
// Current-URL search string the mocked useSearchParams returns — '' by default,
// set per test that needs pre-existing params (e.g. a stale ?limit=).
let mockSearch = '';

// Mock next/navigation so the client component can render in jsdom.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(mockSearch),
  usePathname: () => '/library',
}));

describe('LibraryControls', () => {
  beforeEach(() => {
    mockSearch = '';
  });

  const defaultProps = {
    sort: 'playtime' as const,
    query: '',
    total: 42,
    shown: 42,
    addedUnavailable: false,
  };

  it('renders a search input', () => {
    render(<LibraryControls {...defaultProps} />);
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('renders a sort select with all SORT_KEYS as options', () => {
    render(<LibraryControls {...defaultProps} />);
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();

    for (const key of SORT_KEYS) {
      expect(screen.getByRole('option', { name: SORT_LABELS[key] })).toBeInTheDocument();
    }
  });

  it('shows "Showing X of Y" count', () => {
    render(<LibraryControls {...defaultProps} shown={10} total={42} />);
    expect(screen.getByText(/10/)).toBeInTheDocument();
    expect(screen.getByText(/42/)).toBeInTheDocument();
  });

  it('search input is pre-seeded with the query prop', () => {
    render(<LibraryControls {...defaultProps} query="half-life" />);
    const input = screen.getByRole('searchbox');
    expect(input).toHaveValue('half-life');
  });

  it('sort select reflects the current sort prop', () => {
    render(<LibraryControls {...defaultProps} sort="name" />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('name');
  });

  it('does NOT show the date-added note when sort is not "added"', () => {
    render(<LibraryControls {...defaultProps} sort="playtime" addedUnavailable={true} />);
    expect(screen.queryByText(/inferred from snapshots/)).not.toBeInTheDocument();
  });

  it('does NOT show the date-added note when sort is "added" but dates ARE available', () => {
    render(<LibraryControls {...defaultProps} sort="added" addedUnavailable={false} />);
    expect(screen.queryByText(/inferred from snapshots/)).not.toBeInTheDocument();
  });

  it('shows the date-added note when sort is "added" AND addedUnavailable is true', () => {
    render(<LibraryControls {...defaultProps} sort="added" addedUnavailable={true} />);
    expect(screen.getByText(/inferred from snapshots/)).toBeInTheDocument();
  });

  it('search input has an accessible label', () => {
    render(<LibraryControls {...defaultProps} />);
    // The label is sr-only; getByLabelText still picks it up.
    expect(screen.getByLabelText(/search games/i)).toBeInTheDocument();
  });

  it('sort select has an accessible label', () => {
    render(<LibraryControls {...defaultProps} />);
    expect(screen.getByLabelText(/sort by/i)).toBeInTheDocument();
  });

  it('renders a status filter chip for each status', () => {
    render(<LibraryControls {...defaultProps} />);
    const group = screen.getByRole('group', { name: /filter by status/i });
    expect(within(group).getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'In progress' })).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'Untouched' })).toBeInTheDocument();
  });

  it('marks the active status chip as pressed', () => {
    render(<LibraryControls {...defaultProps} status="untouched" />);
    expect(screen.getByRole('button', { name: 'Untouched' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders grid and list view-mode buttons', () => {
    render(<LibraryControls {...defaultProps} />);
    expect(screen.getByRole('button', { name: /grid view/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /list view/i })).toBeInTheDocument();
  });

  // ── Multiplayer filter ──────────────────────────────────────────────────────

  it('renders the Multiplayer toggle button', () => {
    render(<LibraryControls {...defaultProps} />);
    expect(screen.getByRole('button', { name: /multiplayer/i })).toBeInTheDocument();
  });

  it('Multiplayer toggle has aria-pressed=false when multiplayer prop is false (default)', () => {
    render(<LibraryControls {...defaultProps} multiplayer={false} />);
    expect(screen.getByRole('button', { name: /multiplayer/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('Multiplayer toggle has aria-pressed=true when multiplayer prop is true', () => {
    render(<LibraryControls {...defaultProps} multiplayer={true} />);
    expect(screen.getByRole('button', { name: /multiplayer/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('clicking Multiplayer toggle when inactive calls router.replace with multiplayer=1', () => {
    mockReplace.mockClear();
    render(<LibraryControls {...defaultProps} multiplayer={false} />);
    fireEvent.click(screen.getByRole('button', { name: /multiplayer/i }));
    expect(mockReplace).toHaveBeenCalledTimes(1);
    const calledUrl = mockReplace.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain('multiplayer=1');
  });

  it('clicking Multiplayer toggle when active calls router.replace without multiplayer param', () => {
    mockReplace.mockClear();
    render(<LibraryControls {...defaultProps} multiplayer={true} />);
    fireEvent.click(screen.getByRole('button', { name: /multiplayer/i }));
    expect(mockReplace).toHaveBeenCalledTimes(1);
    const calledUrl = mockReplace.mock.calls[0]?.[0] as string;
    expect(calledUrl).not.toContain('multiplayer');
  });

  it('does NOT show the uncategorized note when multiplayer is false', () => {
    render(<LibraryControls {...defaultProps} multiplayer={false} uncategorizedCount={5} />);
    expect(screen.queryByText(/some games could not be categorized/i)).not.toBeInTheDocument();
  });

  it('does NOT show the uncategorized note when multiplayer is true but uncategorizedCount is 0', () => {
    render(<LibraryControls {...defaultProps} multiplayer={true} uncategorizedCount={0} />);
    expect(screen.queryByText(/some games could not be categorized/i)).not.toBeInTheDocument();
  });

  it('shows the uncategorized note when multiplayer is true and uncategorizedCount > 0', () => {
    render(<LibraryControls {...defaultProps} multiplayer={true} uncategorizedCount={3} />);
    expect(screen.getByText(/some games could not be categorized/i)).toBeInTheDocument();
  });

  // ── Pagination reset (TDD row 6) ────────────────────────────────────────────
  // Set-changing keys (q/status/sort/multiplayer) change the visible result
  // set, so a stale ?limit= must be dropped; `view` only switches tile markup
  // and must preserve it (matches HEAD's view-toggle behavior — the old
  // remount key never included view).

  describe('set-changing filter change drops limit; view toggle keeps it', () => {
    beforeEach(() => {
      mockReplace.mockClear();
      mockSearch = 'sort=name&limit=480';
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    function lastReplaceParams(): URLSearchParams {
      expect(mockReplace).toHaveBeenCalled();
      const url = mockReplace.mock.calls.at(-1)?.[0] as string;
      return new URLSearchParams(url.split('?')[1] ?? '');
    }

    it('status change drops limit', () => {
      render(<LibraryControls {...defaultProps} sort="name" />);
      fireEvent.click(screen.getByRole('button', { name: 'In progress' }));
      const params = lastReplaceParams();
      expect(params.get('status')).toBe('in-progress');
      expect(params.get('sort')).toBe('name');
      expect(params.has('limit')).toBe(false);
    });

    it('sort change drops limit', () => {
      render(<LibraryControls {...defaultProps} sort="name" />);
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'recent' } });
      const params = lastReplaceParams();
      expect(params.get('sort')).toBe('recent');
      expect(params.has('limit')).toBe(false);
    });

    it('search (q) change drops limit', () => {
      vi.useFakeTimers();
      render(<LibraryControls {...defaultProps} sort="name" />);
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'hades' } });
      vi.advanceTimersByTime(250); // flush the search debounce
      const params = lastReplaceParams();
      expect(params.get('q')).toBe('hades');
      expect(params.has('limit')).toBe(false);
    });

    it('multiplayer toggle drops limit', () => {
      render(<LibraryControls {...defaultProps} sort="name" multiplayer={false} />);
      fireEvent.click(screen.getByRole('button', { name: /multiplayer/i }));
      const params = lastReplaceParams();
      expect(params.get('multiplayer')).toBe('1');
      expect(params.has('limit')).toBe(false);
    });

    it('view toggle preserves limit', () => {
      render(<LibraryControls {...defaultProps} sort="name" view="grid" />);
      fireEvent.click(screen.getByRole('button', { name: /list view/i }));
      const params = lastReplaceParams();
      expect(params.get('view')).toBe('list');
      expect(params.get('limit')).toBe('480');
    });
  });
});
