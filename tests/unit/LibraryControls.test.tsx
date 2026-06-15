// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LibraryControls } from '@/components/library/LibraryControls';
import { SORT_KEYS, SORT_LABELS } from '@/lib/games/sort';

// Mock next/navigation so the client component can render in jsdom.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/library',
}));

describe('LibraryControls', () => {
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
});
