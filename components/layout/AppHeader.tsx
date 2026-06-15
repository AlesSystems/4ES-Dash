import Image from 'next/image';
import { getProfile } from '@/server/repositories/profile';
import { getLevel } from '@/server/repositories/level';
import { isSteamApiError } from '@/lib/steam/errors';
import { formatHours } from '@/lib/format/playtime';
import { NavLinks } from './NavLinks';

// ---------------------------------------------------------------------------
// Placeholder fallbacks — shown on any fetch failure (graceful degradation)
// ---------------------------------------------------------------------------

const PLACEHOLDER_AVATAR =
  'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_medium.jpg';
const PLACEHOLDER_NAME = '—';
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
  // never crash the page.
  let personaName = PLACEHOLDER_NAME;
  let avatarUrl = PLACEHOLDER_AVATAR;
  let levelDisplay = PLACEHOLDER_VALUE;
  let totalPlaytimeDisplay = PLACEHOLDER_VALUE;

  try {
    const [profileResult, levelResult] = await Promise.all([
      getProfile().catch((err: unknown) => {
        // isSteamApiError is a narrowing helper — we degrade on any error here.
        if (!isSteamApiError(err)) {
          // Unknown error: still degrade
        }
        return null;
      }),
      getLevel().catch(() => null),
    ]);

    if (profileResult !== null) {
      personaName = profileResult.profile.personaName;
      avatarUrl = profileResult.profile.avatar.medium;

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
      <div className="max-w-content mx-auto flex h-14 items-center gap-6 px-4 sm:px-6 lg:px-8">
        {/* Wordmark */}
        <span className="shrink-0 text-h3 font-semibold tracking-tight text-text-1">4ES·Dash</span>

        {/* Primary navigation */}
        <NavLinks />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Profile cluster */}
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <Image
            src={avatarUrl}
            alt={personaName !== PLACEHOLDER_NAME ? `${personaName}'s avatar` : 'Steam avatar'}
            width={32}
            height={32}
            sizes="32px"
            className="rounded-full shrink-0"
            priority
          />

          {/* Display name */}
          <span className="hidden sm:block text-body font-medium text-text-1 max-w-[140px] truncate">
            {personaName}
          </span>

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

          {/* theme toggle mounts here (#21) */}
        </div>
      </div>
    </header>
  );
}
