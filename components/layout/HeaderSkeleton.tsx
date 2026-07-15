import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { NavLinks } from './NavLinks';

/*
 * Static Suspense fallback for the app-shell header (Theme 3, T1).
 *
 * Synchronous server component: no data access, no server/** imports.
 *
 * BINDING RULE: AuthControls is an ASYNC server component (self-fetches
 * session + profile). It must NEVER be composed here — the fallback itself
 * would suspend and re-couple document flush to Steam, which is exactly the
 * coupling the shell Suspense boundaries remove. Its slot is a fixed-size
 * pulse block sized to the UserMenu footprint (28px avatar + name bar).
 *
 * ThemeToggle is likewise a pulse block: the real toggle only reveals its
 * icon after client mount, so a fallback→content re-mount would flash it
 * (not swap-inert). MobileNav's hamburger slot is a same-size pulse for the
 * same reason (its drawer state would reset across the swap).
 *
 * The wordmark is identical static markup to AppHeader, and NavLinks is the
 * real "use client" nav — its markup depends only on the pathname, so it is
 * identical in both trees (visually inert across the swap, zero CLS).
 *
 * Layout-affecting classes are byte-identical to AppHeader's outer elements;
 * tests/unit/header-skeleton.test.tsx pins both files.
 */
export function HeaderSkeleton(): JSX.Element {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg">
      <div className="flex h-14 items-center gap-3 px-4 sm:gap-6 sm:px-6 lg:px-8">
        {/* MobileNav trigger slot — hamburger footprint, hidden at lg+ */}
        <Skeleton className="h-11 w-11 shrink-0 rounded-md lg:hidden" />

        {/* Wordmark — identical static markup to AppHeader */}
        <Link
          href="/"
          aria-label="4es dash — home"
          className="flex shrink-0 items-center gap-1.5 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500">
            <span className="h-2 w-2 rounded-full bg-bg" aria-hidden />
          </span>
          <span className="font-serif text-h2 font-medium italic leading-none text-text-1">
            4es
          </span>
          <span className="text-caption font-medium uppercase tracking-wide text-text-2">dash</span>
        </Link>

        {/* Primary navigation — real client component, identical across the swap */}
        <div className="hidden lg:block">
          <NavLinks />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Profile cluster placeholders */}
        <div className="flex items-center gap-3">
          {/* Steam level badge slot */}
          <Skeleton className="h-[22px] w-12 rounded-md" />

          {/* Total playtime slot — hidden below md, like the real one */}
          <Skeleton className="hidden h-4 w-20 md:block" />

          {/* ThemeToggle slot */}
          <Skeleton className="h-8 w-8 shrink-0 rounded-md" />

          {/* Auth slot — static placeholder ONLY (see binding rule above) */}
          <div className="flex items-center gap-2 px-2 py-1">
            <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
            <Skeleton className="hidden h-4 w-20 sm:block" />
          </div>
        </div>
      </div>
    </header>
  );
}
