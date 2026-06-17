// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SharedGamesTable } from '@/components/compare/SharedGamesTable';
import type { SharedGame } from '@/lib/compare/shared-games';

const makeGame = (overrides: Partial<SharedGame> = {}): SharedGame => ({
  appId: 440,
  name: 'Team Fortress 2',
  iconUrl: null,
  headerUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/440/header.jpg',
  playtimeA: 120, // 2 h
  playtimeB: 60, // 1 h
  deltaMinutes: 60, // 1 h delta
  ...overrides,
});

describe('SharedGamesTable', () => {
  const A = 'Altan';
  const B = 'kael';

  it('renders the game name', () => {
    render(<SharedGamesTable rows={[makeGame()]} aName={A} bName={B} />);
    expect(screen.getByText('Team Fortress 2')).toBeInTheDocument();
  });

  it('renders the exact delta string format with both names and Δ value', () => {
    // Use distinct playtimes so each value appears exactly once.
    render(
      <SharedGamesTable
        rows={[makeGame({ playtimeA: 120, playtimeB: 30, deltaMinutes: 90 })]}
        aName={A}
        bName={B}
      />,
    );

    // All parts of the delta line must be present in one row element.
    const rows = screen.getAllByRole('row');
    // First row is the header; second is the data row.
    const dataRow = rows[1];
    if (!dataRow) throw new Error('expected a data row');
    expect(within(dataRow).getByText(A)).toBeInTheDocument();
    // playtimeA = 120 min = 2 h
    expect(within(dataRow).getByText('2 h')).toBeInTheDocument();
    expect(within(dataRow).getByText(B)).toBeInTheDocument();
    // playtimeB = 30 min = 0.5 h
    expect(within(dataRow).getByText('0.5 h')).toBeInTheDocument();
    // Δ = 90 min = 1.5 h — use getAllByText since the same value could appear elsewhere
    const deltaSpans = within(dataRow).getAllByText('1.5 h');
    expect(deltaSpans.length).toBeGreaterThanOrEqual(1);
  });

  it('renders rows in input order (pre-sorted by caller)', () => {
    const rows: SharedGame[] = [
      makeGame({ appId: 1, name: 'Alpha', deltaMinutes: 300 }),
      makeGame({ appId: 2, name: 'Beta', deltaMinutes: 200 }),
      makeGame({ appId: 3, name: 'Gamma', deltaMinutes: 100 }),
    ];
    render(<SharedGamesTable rows={rows} aName={A} bName={B} />);

    const names = screen
      .getAllByRole('row')
      .slice(1)
      .map((r) => r.textContent ?? '');
    expect(names[0]).toContain('Alpha');
    expect(names[1]).toContain('Beta');
    expect(names[2]).toContain('Gamma');
  });

  it('renders nothing (empty fragment) when rows is empty', () => {
    const { container } = render(<SharedGamesTable rows={[]} aName={A} bName={B} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the shared-game count in the heading', () => {
    const rows = [makeGame({ appId: 1 }), makeGame({ appId: 2 }), makeGame({ appId: 3 })];
    render(<SharedGamesTable rows={rows} aName={A} bName={B} />);
    expect(screen.getByText(/3 in common/)).toBeInTheDocument();
  });

  it('renders one data row per shared game', () => {
    const rows = [makeGame({ appId: 1 }), makeGame({ appId: 2 }), makeGame({ appId: 3 })];
    render(<SharedGamesTable rows={rows} aName={A} bName={B} />);
    // getAllByRole('row') includes the header row, so subtract 1.
    expect(screen.getAllByRole('row')).toHaveLength(rows.length + 1);
  });

  it('renders fractional hours correctly (90 min → 1.5 h)', () => {
    render(
      <SharedGamesTable
        rows={[makeGame({ playtimeA: 90, playtimeB: 0, deltaMinutes: 90 })]}
        aName={A}
        bName={B}
      />,
    );
    // "1.5 h" appears twice: once for playtimeA, once for Δ (both are 90 min).
    const matches = screen.getAllByText('1.5 h');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });
});
