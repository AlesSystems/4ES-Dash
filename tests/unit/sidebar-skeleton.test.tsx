/**
 * CLS / geometry tests for the shell SidebarSkeleton (Theme 3, T1).
 *
 * Model: tests/unit/section-suspense-geometry.test.tsx — render the skeleton
 * and assert its layout-affecting classes are byte-identical to the real
 * component's outer element.
 *
 * Per ERR-0006 (docs/ERROR.md), jsdom CANNOT render the real Sidebar (an
 * async RSC). Its geometry classes are pinned from source text instead, so a
 * drift in EITHER file fails this suite.
 */
// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SidebarSkeleton } from '@/components/layout/SidebarSkeleton';

// SidebarSkeleton renders the real client SidebarNav (usePathname).
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

// ---------------------------------------------------------------------------
// Pinned geometry — byte-identical layout-affecting classes (plan T1 AC #2)
// ---------------------------------------------------------------------------

const SIDEBAR_ASIDE_CLASSES =
  'sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r border-border bg-bg px-4 py-7 lg:block';

const SIDEBAR_SOURCE = readFileSync(
  join(process.cwd(), 'components/layout/Sidebar.tsx'),
  'utf8',
);
const SIDEBAR_SKELETON_SOURCE = readFileSync(
  join(process.cwd(), 'components/layout/SidebarSkeleton.tsx'),
  'utf8',
);

/** Strip comments so constraint regexes hit code only, not prose. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const SIDEBAR_SKELETON_CODE = stripComments(SIDEBAR_SKELETON_SOURCE);

describe('SidebarSkeleton matches Sidebar aside geometry classes', () => {
  it('real Sidebar still uses the pinned geometry classes (source anchor)', () => {
    // If the real sidebar's geometry changes, this fails and forces the
    // skeleton (and this pin) to be updated in lockstep — the CLS guard.
    expect(SIDEBAR_SOURCE).toContain(`<aside className="${SIDEBAR_ASIDE_CLASSES}">`);
  });

  it('skeleton root is an <aside> with byte-identical outer classes', () => {
    const { container } = render(<SidebarSkeleton />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.tagName.toLowerCase()).toBe('aside');
    expect(root.className).toBe(SIDEBAR_ASIDE_CLASSES);
  });

  it('renders the real client SidebarNav rows (identical markup to the degraded Sidebar)', () => {
    const { getByRole } = render(<SidebarSkeleton />);

    // Same nav geometry across the Suspense swap — no CLS.
    expect(getByRole('navigation', { name: 'Browse' })).toBeInTheDocument();
    expect(getByRole('link', { name: /Library/ })).toBeInTheDocument();
  });

  it('any pulse shard uses the Skeleton token primitive (aria-hidden, bg-surface-2)', () => {
    const { container } = render(<SidebarSkeleton />);
    const pulseEls = container.querySelectorAll('.animate-pulse');
    pulseEls.forEach((el) => {
      expect(el).toHaveClass('bg-surface-2');
      expect(el).toHaveAttribute('aria-hidden', 'true');
    });
  });
});

describe('SidebarSkeleton is a sync server component (plan T1 AC #1)', () => {
  it('has no async/await, no server/** imports, no async-RSC imports, no "use client"', () => {
    expect(SIDEBAR_SKELETON_CODE).not.toMatch(/\basync\b/);
    expect(SIDEBAR_SKELETON_CODE).not.toMatch(/\bawait\b/);
    expect(SIDEBAR_SKELETON_CODE).not.toMatch(/from\s+['"]@\/server/);
    expect(SIDEBAR_SKELETON_CODE).not.toMatch(/from\s+['"][./]*server\//);
    expect(SIDEBAR_SKELETON_CODE).not.toMatch(/AuthControls/);
    expect(SIDEBAR_SKELETON_CODE).not.toContain("'use client'");
  });

  it('has no hardcoded hex colors (tokens only)', () => {
    expect(SIDEBAR_SKELETON_SOURCE).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
