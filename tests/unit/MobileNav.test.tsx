// @vitest-environment jsdom
/**
 * tests/unit/MobileNav.test.tsx
 *
 * Covers acceptance criteria for MobileNav:
 * 1. Renders a trigger button with aria-label "Open menu" and aria-expanded=false initially.
 * 2. Clicking the trigger opens the drawer and all 6 nav links are present with correct hrefs.
 * 3. Pressing Escape closes the drawer (aria-expanded=false).
 * 4. The close button closes the drawer.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Controllable pathname
const mockUsePathname = vi.fn().mockReturnValue('/');

vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

// next/link → plain <a> so hrefs are inspectable in jsdom
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

import { MobileNav } from '@/components/layout/MobileNav';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CURRENT_YEAR = new Date().getUTCFullYear();

const EXPECTED_NAV_ITEMS = [
  { label: /dashboard/i, href: '/' },
  { label: /library/i, href: '/library' },
  { label: /history/i, href: '/history' },
  { label: /friends/i, href: '/friends' },
  { label: /insights/i, href: '/insights/genres' },
  { label: /year in review/i, href: `/review/${CURRENT_YEAR}` },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MobileNav', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/');
    // Reset body overflow
    document.body.style.overflow = '';
  });

  afterEach(() => {
    document.body.style.overflow = '';
    vi.clearAllMocks();
  });

  // ── AC1: Trigger button initial state ────────────────────────────────────

  it('renders a trigger button with aria-label "Open menu"', () => {
    render(<MobileNav />);
    const trigger = screen.getByRole('button', { name: 'Open menu' });
    expect(trigger).toBeInTheDocument();
  });

  it('trigger button has aria-expanded=false initially', () => {
    render(<MobileNav />);
    const trigger = screen.getByRole('button', { name: 'Open menu' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('drawer is not visible initially', () => {
    render(<MobileNav />);
    expect(screen.queryByRole('button', { name: 'Close menu' })).toBeNull();
  });

  // ── AC2: Clicking trigger opens drawer with all 6 nav links ─────────────

  it('clicking the trigger opens the drawer', () => {
    render(<MobileNav />);
    const trigger = screen.getByRole('button', { name: 'Open menu' });
    fireEvent.click(trigger);
    expect(screen.getByRole('button', { name: 'Close menu' })).toBeInTheDocument();
  });

  it('trigger aria-expanded=true after opening', () => {
    render(<MobileNav />);
    const trigger = screen.getByRole('button', { name: 'Open menu' });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('all 6 nav links are present after opening', () => {
    render(<MobileNav />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(6);
  });

  it('nav links have correct hrefs', () => {
    render(<MobileNav />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    for (const { href } of EXPECTED_NAV_ITEMS) {
      const link = screen.getByRole('link', { name: EXPECTED_NAV_ITEMS.find((i) => i.href === href)!.label });
      expect(link).toHaveAttribute('href', href);
    }
  });

  // ── AC3: Pressing Escape closes the drawer ───────────────────────────────

  it('pressing Escape closes the drawer', () => {
    render(<MobileNav />);
    const trigger = screen.getByRole('button', { name: 'Open menu' });
    fireEvent.click(trigger);
    expect(screen.getByRole('button', { name: 'Close menu' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('button', { name: 'Close menu' })).toBeNull();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  // ── AC4: Close button closes the drawer ─────────────────────────────────

  it('clicking the close button closes the drawer', () => {
    render(<MobileNav />);
    const trigger = screen.getByRole('button', { name: 'Open menu' });
    fireEvent.click(trigger);

    const closeBtn = screen.getByRole('button', { name: 'Close menu' });
    fireEvent.click(closeBtn);

    expect(screen.queryByRole('button', { name: 'Close menu' })).toBeNull();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  // ── Backdrop click closes the drawer ────────────────────────────────────

  it('clicking the backdrop closes the drawer', () => {
    render(<MobileNav />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));

    const backdrop = document.querySelector('[data-testid="mobile-nav-backdrop"]') as HTMLElement;
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop);

    expect(screen.queryByRole('button', { name: 'Close menu' })).toBeNull();
  });

  // ── Route change closes the drawer (usePathname effect) ──────────────────

  it('closes the drawer when the route changes', () => {
    mockUsePathname.mockReturnValue('/');
    const { rerender } = render(<MobileNav />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByRole('button', { name: 'Close menu' })).toBeInTheDocument();

    // Simulate a client navigation: pathname changes, component re-renders.
    mockUsePathname.mockReturnValue('/library');
    rerender(<MobileNav />);

    expect(screen.queryByRole('button', { name: 'Close menu' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  // ── Body scroll lock is applied while open and restored on close ─────────

  it('locks body scroll while open and restores it on close', () => {
    render(<MobileNav />);
    expect(document.body.style.overflow).toBe('');

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(document.body.style.overflow).toBe('');
  });

  // ── aria-controls points at the drawer element ───────────────────────────

  it('trigger aria-controls references the opened drawer element id', () => {
    render(<MobileNav />);
    const trigger = screen.getByRole('button', { name: 'Open menu' });
    const controlsId = trigger.getAttribute('aria-controls');
    expect(controlsId).toBeTruthy();

    fireEvent.click(trigger);
    expect(document.getElementById(controlsId!)).not.toBeNull();
  });

  // ── aria-current on active link ──────────────────────────────────────────

  it('marks the active link with aria-current="page"', () => {
    mockUsePathname.mockReturnValue('/library');
    render(<MobileNav />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));

    const libraryLink = screen.getByRole('link', { name: /library/i });
    expect(libraryLink).toHaveAttribute('aria-current', 'page');
  });

  it('does not set aria-current on inactive links', () => {
    mockUsePathname.mockReturnValue('/library');
    render(<MobileNav />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));

    const links = screen.getAllByRole('link');
    const activeLinks = links.filter((l) => l.getAttribute('aria-current') === 'page');
    expect(activeLinks).toHaveLength(1);
  });
});
