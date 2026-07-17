/**
 * CLS / geometry tests for the shell HeaderSkeleton (Theme 3, T1).
 *
 * Model: tests/unit/section-suspense-geometry.test.tsx — render the skeleton
 * and assert its layout-affecting classes are byte-identical to the real
 * component's outer elements.
 *
 * Per ERR-0006 (docs/ERROR.md), jsdom CANNOT render the real AppHeader (an
 * async RSC embedding the async AuthControls). Its geometry classes are pinned
 * from source text instead, so a drift in EITHER file fails this suite.
 */
// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HeaderSkeleton } from '@/components/layout/HeaderSkeleton';

// HeaderSkeleton renders the real client NavLinks (usePathname).
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

// ---------------------------------------------------------------------------
// Pinned geometry — byte-identical layout-affecting classes (plan T1 AC #2)
// ---------------------------------------------------------------------------

const HEADER_OUTER_CLASSES = 'sticky top-0 z-40 border-b border-border bg-bg';
const HEADER_ROW_CLASSES = 'flex h-14 items-center gap-3 px-4 sm:gap-6 sm:px-6 lg:px-8';

const APP_HEADER_SOURCE = readFileSync(
  join(process.cwd(), 'components/layout/AppHeader.tsx'),
  'utf8',
);
const HEADER_SKELETON_SOURCE = readFileSync(
  join(process.cwd(), 'components/layout/HeaderSkeleton.tsx'),
  'utf8',
);

/** Strip comments so constraint regexes hit code only, not prose. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const HEADER_SKELETON_CODE = stripComments(HEADER_SKELETON_SOURCE);

describe('HeaderSkeleton matches AppHeader outer geometry classes', () => {
  it('real AppHeader still uses the pinned geometry classes (source anchor)', () => {
    // If the real header's geometry changes, this fails and forces the
    // skeleton (and these pins) to be updated in lockstep — the CLS guard.
    expect(APP_HEADER_SOURCE).toContain(`<header className="${HEADER_OUTER_CLASSES}">`);
    expect(APP_HEADER_SOURCE).toContain(`"${HEADER_ROW_CLASSES}"`);
  });

  it('skeleton root is a <header> with byte-identical outer classes', () => {
    const { container } = render(<HeaderSkeleton />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.tagName.toLowerCase()).toBe('header');
    expect(root.className).toBe(HEADER_OUTER_CLASSES);
  });

  it('skeleton inner row has byte-identical h-14 row classes', () => {
    const { container } = render(<HeaderSkeleton />);
    const root = container.firstElementChild as HTMLElement;
    const row = root.firstElementChild as HTMLElement;

    expect(row.className).toBe(HEADER_ROW_CLASSES);
  });

  it('skeleton pulse shards use the Skeleton token primitive (aria-hidden, bg-surface-2)', () => {
    const { container } = render(<HeaderSkeleton />);
    const pulseEls = container.querySelectorAll('.animate-pulse');

    // At minimum: level badge, playtime, ThemeToggle slot, AuthControls slot.
    expect(pulseEls.length).toBeGreaterThanOrEqual(4);
    pulseEls.forEach((el) => {
      expect(el).toHaveClass('bg-surface-2');
      expect(el).toHaveAttribute('aria-hidden', 'true');
    });
  });
});

describe('HeaderSkeleton is a sync server component (plan T1 AC #1)', () => {
  it('has no async/await, no server/** imports, no AuthControls usage, no "use client"', () => {
    expect(HEADER_SKELETON_CODE).not.toMatch(/\basync\b/);
    expect(HEADER_SKELETON_CODE).not.toMatch(/\bawait\b/);
    expect(HEADER_SKELETON_CODE).not.toMatch(/from\s+['"]@\/server/);
    expect(HEADER_SKELETON_CODE).not.toMatch(/from\s+['"][./]*server\//);
    expect(HEADER_SKELETON_CODE).not.toMatch(/AuthControls/);
    expect(HEADER_SKELETON_CODE).not.toContain("'use client'");
  });

  it('has no hardcoded hex colors (tokens only)', () => {
    expect(HEADER_SKELETON_SOURCE).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
