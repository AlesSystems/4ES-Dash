/**
 * tests/unit/shell-streaming.test.tsx — Theme 3, T2 binding proof.
 *
 * Structural assertion that app/layout.tsx wraps each async shell component
 * (AppHeader, Sidebar) in its own <Suspense> boundary with the matching
 * geometry skeleton as fallback, and that {children} sits OUTSIDE both
 * boundaries — so the document (and route content) streams independently of
 * the shell's Steam-gated awaits.
 *
 * Per ERR-0006 (docs/ERROR.md), jsdom cannot render async server components,
 * and importing app/ modules directly trips next/font/google (see
 * tests/unit/app/seo-metadata.test.ts). So this is a source-structure
 * assertion per the tests/unit/page-wiring.test.ts precedent: extract each
 * <Suspense>…</Suspense> block from the layout source and assert its exact
 * contents — no async child is ever invoked.
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const layoutSrc = fs.readFileSync(
  path.resolve(__dirname, '../../app/layout.tsx'),
  'utf8',
);

/** Every <Suspense …>…</Suspense> block in the layout source. */
const suspenseBlocks = layoutSrc.match(/<Suspense[\s\S]*?<\/Suspense>/g) ?? [];

describe('layout has exactly two Suspense boundaries and children outside them', () => {
  it('imports Suspense and both shell skeletons', () => {
    expect(layoutSrc).toMatch(/import\s+\{[^}]*\bSuspense\b[^}]*\}\s+from\s+'react'/);
    expect(layoutSrc).toContain('HeaderSkeleton');
    expect(layoutSrc).toContain('SidebarSkeleton');
  });

  it('contains exactly two <Suspense> boundaries', () => {
    expect(suspenseBlocks).toHaveLength(2);
  });

  it('AppHeader is a direct child of a Suspense with HeaderSkeleton fallback', () => {
    const headerBoundary = suspenseBlocks.find((block) => block.includes('<AppHeader'));
    expect(headerBoundary).toBeDefined();
    expect(headerBoundary).toMatch(/<Suspense\s+fallback=\{<HeaderSkeleton\s*\/>\}\s*>/);
    expect(headerBoundary).toMatch(/<AppHeader\s*\/>/);
  });

  it('Sidebar is a direct child of a Suspense with SidebarSkeleton fallback', () => {
    const sidebarBoundary = suspenseBlocks.find((block) => block.includes('<Sidebar'));
    expect(sidebarBoundary).toBeDefined();
    expect(sidebarBoundary).toMatch(/<Suspense\s+fallback=\{<SidebarSkeleton\s*\/>\}\s*>/);
    expect(sidebarBoundary).toMatch(/<Sidebar\s*\/>/);
  });

  it('the two boundaries wrap distinct shell components (one each)', () => {
    const headerBoundaries = suspenseBlocks.filter((block) => block.includes('<AppHeader'));
    const sidebarBoundaries = suspenseBlocks.filter((block) => block.includes('<Sidebar'));
    expect(headerBoundaries).toHaveLength(1);
    expect(sidebarBoundaries).toHaveLength(1);
  });

  it('{children} is rendered but is NOT inside either Suspense boundary', () => {
    // {children} must still be part of the layout tree…
    expect(layoutSrc).toContain('{children}');
    // …but not a descendant of either boundary — the whole point: route
    // content streams regardless of Steam health in the shell.
    for (const block of suspenseBlocks) {
      expect(block).not.toContain('{children}');
    }
  });

  it('AppHeader and Sidebar are never mounted outside their boundaries', () => {
    const outsideBoundaries = layoutSrc.replace(/<Suspense[\s\S]*?<\/Suspense>/g, '');
    expect(outsideBoundaries).not.toMatch(/<AppHeader\s*\/>/);
    expect(outsideBoundaries).not.toMatch(/<Sidebar\s*\/>/);
  });
});
