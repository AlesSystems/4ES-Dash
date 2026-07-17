// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LibraryResults } from '@/components/library/LibraryResults';
import type { LibraryTileGame } from '@/lib/games/sort';

// LibraryResults is an RSC, but it renders the LoadMoreButton client leaf,
// which needs next/navigation to render under jsdom.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/library',
}));

function tile(appId: number): LibraryTileGame {
  return {
    appId,
    name: `Game ${appId}`,
    headerUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`,
    hasAchievements: false,
    playtime: { total: 60, twoWeeks: 0 },
  };
}

// The visible page the RSC passes after its server-side slice(0, 24).
const page24 = Array.from({ length: 24 }, (_, i) => tile(i + 1));

describe('LibraryResults', () => {
  it('renders only the games it is given (server slice)', () => {
    // No active filter: filtered count == library total (100-game fixture,
    // limit=24 → the page hands over exactly 24 tiles).
    render(<LibraryResults games={page24} filteredTotal={100} view="grid" />);
    expect(screen.getAllByRole('listitem')).toHaveLength(24);
    expect(screen.getByText(/24 of 100 · 76 remaining/)).toBeInTheDocument();
  });

  it('"of Y" uses the filtered count, not the library total', () => {
    // Active filter: library total 100, filtered 40, limit=24. If the page's
    // all-games length (100) were mis-wired in, this copy would read
    // "24 of 100 · 76 remaining" and fail here.
    render(<LibraryResults games={page24} filteredTotal={40} view="grid" />);
    expect(screen.getAllByRole('listitem')).toHaveLength(24);
    expect(screen.getByText(/24 of 40 · 16 remaining/)).toBeInTheDocument();
  });

  it('renders no load-more affordance when everything is shown', () => {
    render(<LibraryResults games={page24.slice(0, 10)} filteredTotal={10} view="grid" />);
    expect(screen.queryByRole('button', { name: /load \d+ more/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/remaining/)).not.toBeInTheDocument();
  });

  it('LibraryResults is a server component', () => {
    // Source-level assertion (ERR-0006: async RSCs can't render under jsdom —
    // this one stays synchronous, so the render tests above work directly).
    const source = readFileSync(
      join(process.cwd(), 'components/library/LibraryResults.tsx'),
      'utf8',
    );
    expect(source).not.toMatch(/['"]use client['"]/);
    expect(source).not.toMatch(/\buseState\b/);
  });
});
