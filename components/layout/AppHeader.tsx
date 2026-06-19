import Link from 'next/link';
import { getProfile } from '@/server/repositories/profile';
import { getLevel } from '@/server/repositories/level';
import { getViewerSteamId } from '@/server/auth';
import { isSteamApiError } from '@/lib/steam/errors';
import { formatHours } from '@/lib/format/playtime';
import { AuthControls } from '@/components/auth/AuthControls';
import { NavLinks } from './NavLinks';
import { MobileNav } from './MobileNav';
import { ThemeToggle } from './ThemeToggle';

// ---------------------------------------------------------------------------
// Placeholder fallbacks — shown on any fetch failure (graceful degradation)
// ---------------------------------------------------------------------------

const PLACEHOLDER_VALUE = '—';

// ---------------------------------------------------------------------------
// AppHeader — async RSC, self-fetching
// ---------------------------------------------------------------------------

/**
 * Persistent site header (#20).
 *
 * Renders: wordmark | NavLinks | avatar + display name + level badge + total playtime.
 * On any fetch failure the header degrades gracefully (never throws).
 */
export async function AppHeader(): Promise<JSX.Element> {
  // Resolve profile + level in parallel; absorb all errors — the header must
  // never crash the page. Avatar/persona now live in <AuthControls/>; here we
  // only compute the viewer-stat badges (level + total playtime).
  let levelDisplay = PLACEHOLDER_VALUE;
  let totalPlaytimeDisplay = PLACEHOLDER_VALUE;

  try {
    const featuredId = await getViewerSteamId();
    const [profileResult, levelResult] = await Promise.all([
      getProfile(featuredId).catch((err: unknown) => {
        // isSteamApiError is a narrowing helper — we degrade on any error here.
        if (!isSteamApiError(err)) {
          // Unknown error: still degrade
        }
        return null;
      }),
      getLevel(featuredId).catch(() => null),
    ]);

    if (profileResult !== null) {
      // Total playtime = sum of all owned games' total playtime.
      const totalMinutes = profileResult.games.reduce((sum, game) => sum + game.playtime.total, 0);
      totalPlaytimeDisplay = formatHours(totalMinutes);
    }

    if (levelResult !== null) {
      levelDisplay = levelResult.level !== null ? String(levelResult.level) : PLACEHOLDER_VALUE;
    }
  } catch {
    // Belt-and-suspenders: if Promise.all itself somehow throws, stay degraded.
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg">
      <div className="flex h-14 items-center gap-3 px-4 sm:gap-6 sm:px-6 lg:px-8">
        {/* Mobile navigation — hamburger + drawer, hidden at lg+ */}
        <MobileNav />

        {/* Wordmark — amber dot logo + "4es" (serif italic) · "dash" (sans) */}
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

        {/* Primary navigation — desktop only; mobile uses the drawer above */}
        <div className="hidden lg:block">
          <NavLinks />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Profile cluster */}
        <div className="flex items-center gap-3">
          {/* Steam level badge */}
          <span
            className="inline-flex items-center rounded-md border border-border bg-surface-2 px-2 py-0.5 text-caption font-semibold text-text-2 tabular-nums"
            aria-label={`Steam level ${levelDisplay}`}
            title="Steam level"
          >
            Lv {levelDisplay}
          </span>

          {/* Total library playtime */}
          <span
            className="hidden md:flex items-center gap-1 text-caption text-text-3 tabular-nums"
            aria-label={`Total library playtime: ${totalPlaytimeDisplay}`}
          >
            <span className="font-medium text-text-2">{totalPlaytimeDisplay}</span>
            <span>total</span>
          </span>

          {/* Theme toggle (#21) */}
          <ThemeToggle />

          {/* Auth control — user menu when signed in, sign-in button when not */}
          <AuthControls />
        </div>
      </div>
    </header>
  );
}
