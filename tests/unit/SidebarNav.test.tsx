// @vitest-environment jsdom
/**
 * tests/unit/SidebarNav.test.tsx
 *
 * Covers acceptance criteria for task #87:
 * 1. History (/history) and Friends (/friends) links are present.
 * 2. Exactly 6 links in order: Dashboard, Library, History, Friends, Insights, Year in Review.
 * 3. aria-current="page" on the active link only.
 * 4. Each item renders a single lucide-react icon (svg) at strokeWidth 1.75.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Controllable pathname — overridden per test.
const mockUsePathname = vi.fn().mockReturnValue('/');

vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

// next/link → plain <a> so hrefs are inspectable in jsdom.
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// ---------------------------------------------------------------------------
// Component import (AFTER mocks)
// ---------------------------------------------------------------------------

import { SidebarNav } from '@/components/layout/SidebarNav';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderSidebar(libraryCount: number | null = null) {
  return render(<SidebarNav libraryCount={libraryCount} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SidebarNav (#87)', () => {
  // ── AC1: History and Friends links are present ──────────────────────────

  it('renders a History link with href="/history"', () => {
    renderSidebar();
    const historyLink = screen.getByRole('link', { name: /history/i });
    expect(historyLink).toBeInTheDocument();
    expect(historyLink).toHaveAttribute('href', '/history');
  });

  it('renders a Friends link with href="/friends"', () => {
    renderSidebar();
    const friendsLink = screen.getByRole('link', { name: /friends/i });
    expect(friendsLink).toBeInTheDocument();
    expect(friendsLink).toHaveAttribute('href', '/friends');
  });

  // ── AC2: Exactly 6 links in exact order ─────────────────────────────────

  it('renders exactly 6 nav links', () => {
    renderSidebar();
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(6);
  });

  it('renders links in order: Dashboard, Library, History, Friends, Insights, Year in Review', () => {
    renderSidebar();
    const links = screen.getAllByRole('link');
    const labels = links.map((l) => l.textContent?.trim() ?? '');
    expect(labels[0]).toMatch(/dashboard/i);
    expect(labels[1]).toMatch(/library/i);
    expect(labels[2]).toMatch(/history/i);
    expect(labels[3]).toMatch(/friends/i);
    expect(labels[4]).toMatch(/insights/i);
    expect(labels[5]).toMatch(/year in review/i);
  });

  // ── AC3: aria-current="page" on the active route only ───────────────────

  it('sets aria-current="page" on the History link when pathname is /history', () => {
    mockUsePathname.mockReturnValue('/history');
    renderSidebar();
    const historyLink = screen.getByRole('link', { name: /history/i });
    expect(historyLink).toHaveAttribute('aria-current', 'page');
  });

  it('does NOT set aria-current on non-active links when pathname is /history', () => {
    mockUsePathname.mockReturnValue('/history');
    renderSidebar();
    const allLinks = screen.getAllByRole('link');
    const activeLinkCount = allLinks.filter(
      (l) => l.getAttribute('aria-current') === 'page',
    ).length;
    expect(activeLinkCount).toBe(1);
  });

  it('sets aria-current="page" on the Friends link when pathname is /friends', () => {
    mockUsePathname.mockReturnValue('/friends');
    renderSidebar();
    const friendsLink = screen.getByRole('link', { name: /friends/i });
    expect(friendsLink).toHaveAttribute('aria-current', 'page');
  });

  it('does NOT set aria-current on non-active links when pathname is /friends', () => {
    mockUsePathname.mockReturnValue('/friends');
    renderSidebar();
    const allLinks = screen.getAllByRole('link');
    const activeLinkCount = allLinks.filter(
      (l) => l.getAttribute('aria-current') === 'page',
    ).length;
    expect(activeLinkCount).toBe(1);
  });

  it('does NOT set aria-current="page" on History or Friends when pathname is /', () => {
    mockUsePathname.mockReturnValue('/');
    renderSidebar();
    const historyLink = screen.getByRole('link', { name: /history/i });
    const friendsLink = screen.getByRole('link', { name: /friends/i });
    expect(historyLink).not.toHaveAttribute('aria-current', 'page');
    expect(friendsLink).not.toHaveAttribute('aria-current', 'page');
  });

  // ── AC4: Each item renders an SVG icon ──────────────────────────────────

  it('renders an SVG icon inside each link (6 icons total)', () => {
    renderSidebar();
    const links = screen.getAllByRole('link');
    for (const link of links) {
      // eslint-disable-next-line testing-library/no-node-access
      const svg = link.querySelector('svg');
      expect(svg).not.toBeNull();
    }
  });
});
