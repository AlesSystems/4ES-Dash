/**
 * Structural (non-load-bearing) check: each /insights page streams its slow
 * data section behind its OWN <Suspense> boundary, instead of the whole page
 * blocking on its slowest await. Guards against a regression back to a single
 * top-level await that blocks first paint.
 *
 * We assert on source text (structural), not on render(await Page()), per the
 * data-layer assertion rule (ERR-0006).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PAGES = [
  'app/insights/genres/page.tsx',
  'app/insights/idle/page.tsx',
  'app/insights/cost-per-hour/page.tsx',
];

describe('insights pages stream behind their own Suspense boundary', () => {
  for (const rel of PAGES) {
    it(`${rel} imports and renders a <Suspense> boundary`, () => {
      const src = readFileSync(resolve(process.cwd(), rel), 'utf8');
      expect(src).toMatch(/import\s+\{[^}]*\bSuspense\b[^}]*\}\s+from\s+['"]react['"]/);
      expect(src).toMatch(/<Suspense[\s>]/);
      // The Suspense must have a fallback skeleton (no CLS placeholder).
      expect(src).toMatch(/fallback=\{/);
    });
  }
});
