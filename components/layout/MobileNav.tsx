'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Nav items — identical order to NavLinks.tsx and SidebarNav.tsx
// ---------------------------------------------------------------------------

const CURRENT_YEAR = new Date().getUTCFullYear();

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/' },
  { label: 'Library', href: '/library' },
  { label: 'History', href: '/history' },
  { label: 'Friends', href: '/friends' },
  { label: 'Insights', href: '/insights/genres' },
  { label: 'Year in Review', href: `/review/${CURRENT_YEAR}` },
] as const;

const DRAWER_ID = 'mobile-nav-drawer';

// ---------------------------------------------------------------------------
// MobileNav — hamburger + slide-in drawer (no external deps, React state only)
// ---------------------------------------------------------------------------

/**
 * Mobile navigation drawer for viewports below the `lg` breakpoint.
 *
 * The trigger button is hidden at `lg` and above (desktop uses the top
 * NavLinks + left Sidebar instead). Below `lg`, tapping the hamburger icon
 * opens a full-height overlay panel with all 6 nav links.
 */
export function MobileNav(): JSX.Element {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while open; restore on close / unmount
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      // Move focus into the drawer
      firstLinkRef.current?.focus();
    } else {
      document.body.style.overflow = '';
      // Restore focus to the trigger when drawer closes
      // (only if the drawer was previously open — avoid noise on initial render)
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Escape key closes the drawer
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  function close(): void {
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <>
      {/* Hamburger trigger — hidden at lg+ */}
      <button
        ref={triggerRef}
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls={DRAWER_ID}
        onClick={() => setOpen(true)}
        className="lg:hidden inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 text-text-2 transition-colors hover:text-text-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
      >
        <Menu size={20} strokeWidth={1.75} aria-hidden />
      </button>

      {/* Overlay — only mounted when open */}
      {open && (
        <>
          {/* Semi-transparent backdrop */}
          <div
            data-testid="mobile-nav-backdrop"
            className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm"
            onClick={close}
            aria-hidden
          />

          {/* Drawer panel */}
          <div
            id={DRAWER_ID}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-bg shadow-xl"
          >
            {/* Drawer header */}
            <div className="flex h-14 items-center justify-between px-4 border-b border-border">
              <span className="font-serif text-h2 font-medium italic leading-none text-text-1">
                4es
              </span>
              <button
                type="button"
                aria-label="Close menu"
                onClick={close}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 text-text-2 transition-colors hover:text-text-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              >
                <X size={20} strokeWidth={1.75} aria-hidden />
              </button>
            </div>

            {/* Nav links */}
            <nav aria-label="Mobile navigation" className="flex-1 overflow-y-auto px-3 py-4">
              <ul className="flex flex-col gap-1" role="list">
                {NAV_ITEMS.map(({ label, href }, index) => {
                  const isActive = pathname === href;
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        ref={index === 0 ? firstLinkRef : undefined}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'relative flex min-h-[44px] items-center rounded-md px-3 py-2 text-body font-medium transition-colors',
                          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                          isActive
                            ? 'bg-surface text-text-1'
                            : 'text-text-2 hover:bg-surface-2 hover:text-text-1',
                        )}
                      >
                        {isActive && (
                          <span
                            className="absolute bottom-2 left-0 top-2 w-1 rounded-full bg-brand-500"
                            aria-hidden
                          />
                        )}
                        {label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        </>
      )}
    </>
  );
}
