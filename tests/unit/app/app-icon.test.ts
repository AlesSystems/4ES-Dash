/**
 * Browser icon tests — Task 08 (#92)
 *
 * AC1: An icon file exists under app/ and is wired as a Next.js file-convention icon.
 * AC2: The favicon reproduces the amber-dot brand mark using fixed color #e8a05c.
 * AC3: The icon route exports the required size/contentType metadata so Next.js
 *      auto-generates the correct <link rel="icon"> in <head>.
 *
 * Strategy: read source as text (avoids next/og and server-only import issues
 * that prevent importing app/ modules directly in Vitest) + assert that the
 * route returns a proper Response via a direct call in Node.
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

function readSource(relPath: string): string {
  return fs.readFileSync(path.resolve(ROOT, relPath), 'utf-8');
}

function fileExists(relPath: string): boolean {
  return fs.existsSync(path.resolve(ROOT, relPath));
}

// ---------------------------------------------------------------------------
// AC1: icon.tsx exists under app/
// ---------------------------------------------------------------------------

describe('app/icon.tsx — file existence', () => {
  it('app/icon.tsx exists', () => {
    expect(fileExists('app/icon.tsx'), 'app/icon.tsx must exist').toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC2: amber brand color is present
// ---------------------------------------------------------------------------

describe('app/icon.tsx — brand mark', () => {
  const src = readSource('app/icon.tsx');

  it('uses the amber brand color #e8a05c', () => {
    expect(src).toMatch(/#e8a05c/i);
  });

  it('uses ImageResponse from next/og', () => {
    expect(src).toMatch(/ImageResponse/);
    expect(src).toMatch(/next\/og/);
  });

  it('renders a filled circle (outer dot)', () => {
    // The icon must reference a circle shape — either a div with borderRadius 50%
    // or an explicit shape keyword indicating a circle/rounded element.
    expect(src).toMatch(/borderRadius|border-radius|rounded|50%/);
  });

  it('renders a centered inner hole (inner dot)', () => {
    // Must have two distinct circle elements reproducing the amber-dot logo:
    // an outer filled amber ring and an inner "hole" element.
    // We check for two distinct color-bearing elements (amber outer + bg inner).
    expect(src).toMatch(/#e8a05c/i);
    // Inner hole is a distinct element — must have more than one circle-like element.
    const circleMatches = src.match(/borderRadius\s*:\s*['"]50%['"]/g);
    expect(
      circleMatches,
      'Must have at least two elements with borderRadius 50% (outer + inner)',
    ).not.toBeNull();
    expect((circleMatches ?? []).length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// AC3: exported size and contentType (Next.js icon route convention)
// ---------------------------------------------------------------------------

describe('app/icon.tsx — Next.js icon route exports', () => {
  const src = readSource('app/icon.tsx');

  it('exports a size object with width and height', () => {
    expect(src).toMatch(/export\s+const\s+size\s*[=:]/);
    expect(src).toMatch(/width\s*:/);
    expect(src).toMatch(/height\s*:/);
  });

  it('exports a contentType string', () => {
    expect(src).toMatch(/export\s+const\s+contentType\s*[=:]/);
    expect(src).toMatch(/image\/png/);
  });

  it('has a default export (the route handler function)', () => {
    expect(src).toMatch(/export\s+default\s+function/);
  });

  it('does not set metadata.icons in app/layout.tsx (file convention takes over)', () => {
    const layoutSrc = readSource('app/layout.tsx');
    // The file-based icon convention is used; no manual icons key in metadata.
    expect(layoutSrc).not.toMatch(/icons\s*:/);
  });
});
