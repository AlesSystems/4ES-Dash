/**
 * SEO / metadata tests — Task 04 AC1 + AC3.
 *
 * AC1: Each route's metadata.title is present and unique; viewport/themeColor
 *      is exported from the root layout.
 * AC3: Charts are imported via next/dynamic (not a static import at the page
 *      module top level).
 *
 * Strategy: read source files as text to inspect static exports and import
 * patterns — avoids the next/font/google and server-only module issues that
 * prevent importing app/ modules directly in Vitest.
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

function readSource(relPath: string): string {
  return fs.readFileSync(path.resolve(ROOT, relPath), 'utf-8');
}

// ---------------------------------------------------------------------------
// AC1: Layout — metadataBase, viewport, themeColor
// ---------------------------------------------------------------------------

describe('app/layout.tsx — viewport and metadataBase', () => {
  const src = readSource('app/layout.tsx');

  it('exports a viewport object', () => {
    expect(src).toMatch(/export\s+const\s+viewport\s*[=:]/);
  });

  it('viewport includes themeColor', () => {
    // viewport export must contain themeColor as a property (not just in a comment)
    expect(src).toMatch(/themeColor\s*:/);
  });

  it('viewport dark themeColor is #141211', () => {
    expect(src).toMatch(/#141211/);
  });

  it('viewport light themeColor is #f4ede1', () => {
    expect(src).toMatch(/#f4ede1/);
  });

  it('metadata includes metadataBase', () => {
    expect(src).toMatch(/metadataBase/);
  });

  it('metadata has a title', () => {
    expect(src).toMatch(/title\s*:/);
  });

  it('metadata has a description', () => {
    expect(src).toMatch(/description\s*:/);
  });
});

// ---------------------------------------------------------------------------
// AC1: Per-route pages export metadata with unique titles
// ---------------------------------------------------------------------------

const PAGES = [
  { route: '/', file: 'app/page.tsx' },
  { route: '/library', file: 'app/library/page.tsx' },
  { route: '/friends', file: 'app/friends/page.tsx' },
  { route: '/history', file: 'app/history/page.tsx' },
  { route: '/compare', file: 'app/compare/page.tsx' },
  { route: '/insights/genres', file: 'app/insights/genres/page.tsx' },
  { route: '/insights/cost-per-hour', file: 'app/insights/cost-per-hour/page.tsx' },
  { route: '/insights/idle', file: 'app/insights/idle/page.tsx' },
  { route: '/review/[year]', file: 'app/review/[year]/page.tsx' },
] as const;

describe('per-route metadata — export presence', () => {
  it.each(PAGES)('$route exports metadata', ({ file }) => {
    const src = readSource(file);
    expect(src).toMatch(/export\s+const\s+metadata\s*[=:]/);
  });

  it.each(PAGES)('$route metadata has a title', ({ file }) => {
    const src = readSource(file);
    // Must have a title field after "export const metadata"
    expect(src).toMatch(/export\s+const\s+metadata[\s\S]{0,300}title\s*:/);
  });

  it.each(PAGES)('$route metadata has a description', ({ file }) => {
    const src = readSource(file);
    expect(src).toMatch(/export\s+const\s+metadata[\s\S]{0,300}description\s*:/);
  });
});

describe('per-route metadata — title uniqueness', () => {
  it('all route titles are distinct strings', () => {
    // Extract title values by finding the metadata block for each page.
    // We parse out the string content of each title: field.
    const titles: string[] = [];

    for (const { file } of PAGES) {
      const src = readSource(file);
      // Match: title: 'Foo Bar' or title: "Foo Bar"
      const m = src.match(/export\s+const\s+metadata[\s\S]*?title\s*:\s*(['"`])([^'"`]+)\1/);
      expect(m, `Could not extract title string from ${file}`).not.toBeNull();
      if (m && m[2] !== undefined) titles.push(m[2]);
    }

    const duplicates = titles.filter((t, i) => titles.indexOf(t) !== i);
    expect(duplicates, `Duplicate titles found: ${duplicates.join(', ')}`).toHaveLength(0);
    const unique = new Set(titles);
    expect(unique.size).toBe(titles.length);
  });
});

// ---------------------------------------------------------------------------
// AC3: Charts use next/dynamic — not static top-level Tremor imports
// ---------------------------------------------------------------------------

describe('PlaytimeChart — lazy-loaded via next/dynamic', () => {
  const src = readSource('components/history/PlaytimeChart.tsx');

  it('does NOT have a static top-level import of BarChart from @tremor/react', () => {
    expect(src).not.toMatch(
      /^import\s+\{[^}]*BarChart[^}]*\}\s+from\s+['"]@tremor\/react['"]/m,
    );
  });

  it('uses next/dynamic to load BarChart', () => {
    expect(src).toMatch(/import\s+dynamic\s+from\s+['"]next\/dynamic['"]/);
    expect(src).toMatch(/dynamic\s*\(/);
    expect(src).toMatch(/BarChart/);
  });

  it('provides a loading skeleton placeholder', () => {
    expect(src).toMatch(/loading\s*:/);
    expect(src).toMatch(/animate-pulse|Skeleton|ChartLoading/);
  });

  it('sets ssr: false', () => {
    expect(src).toMatch(/ssr\s*:\s*false/);
  });
});

describe('GenreChart — lazy-loaded via next/dynamic', () => {
  const src = readSource('components/insights/GenreChart.tsx');

  it('does NOT have a static top-level import of DonutChart from @tremor/react', () => {
    expect(src).not.toMatch(
      /^import\s+\{[^}]*DonutChart[^}]*\}\s+from\s+['"]@tremor\/react['"]/m,
    );
  });

  it('uses next/dynamic to load DonutChart', () => {
    expect(src).toMatch(/import\s+dynamic\s+from\s+['"]next\/dynamic['"]/);
    expect(src).toMatch(/dynamic\s*\(/);
    expect(src).toMatch(/DonutChart/);
  });

  it('provides a loading skeleton placeholder', () => {
    expect(src).toMatch(/loading\s*:/);
    expect(src).toMatch(/animate-pulse|Skeleton|ChartLoading/);
  });

  it('sets ssr: false', () => {
    expect(src).toMatch(/ssr\s*:\s*false/);
  });
});
