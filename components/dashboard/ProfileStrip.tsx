import Image from 'next/image';
import { formatHours } from '@/lib/format/playtime';

export interface ProfileStripProps {
  personaName: string;
  avatarUrl: string;
  level: number | null;
  accountAgeYears: number | null;
  gamesCount: number;
  totalPlaytimeMinutes: number;
  recentlyPlayedCount: number;
}

/**
 * Editorial profile header for the dashboard.
 * Pure RSC — no client state. Mirrors the wrapped.jsx profile header
 * (lines ~216-238) with real data only (no period toggle, no online/last-seen).
 */
export function ProfileStrip({
  personaName,
  avatarUrl,
  level,
  accountAgeYears,
  gamesCount,
  totalPlaytimeMinutes,
  recentlyPlayedCount,
}: ProfileStripProps): JSX.Element {
  const yearLabel =
    accountAgeYears !== null
      ? accountAgeYears === 1
        ? '1 year in.'
        : `${accountAgeYears} years in.`
      : null;

  return (
    <div className="mb-7 flex items-center gap-5">
      {/* Avatar with optional level badge */}
      <div className="relative h-[72px] w-[72px] shrink-0">
        <Image
          src={avatarUrl}
          alt={`${personaName}'s avatar`}
          width={72}
          height={72}
          sizes="72px"
          className="rounded-full border-2 border-border-2 object-cover"
        />
        {level !== null && (
          <span
            className="absolute bottom-0 right-0 translate-x-1 translate-y-1 rounded-full bg-brand-500 px-1.5 py-0.5 font-mono text-caption font-semibold tabular-nums text-accent-ink"
            aria-label={`Steam level ${level}`}
          >
            {level}
          </span>
        )}
      </div>

      {/* Headline + stat line */}
      <div>
        <h1 className="font-serif text-display-md text-text-1 leading-tight tracking-tight">
          {yearLabel !== null ? (
            <>
              <span className="italic text-text-2">{personaName},</span> {yearLabel}
            </>
          ) : (
            personaName
          )}
        </h1>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-caption tabular-nums text-text-3">
          <span>{gamesCount.toLocaleString()} games</span>
          <span className="text-border-2" aria-hidden>
            ·
          </span>
          <span>{formatHours(totalPlaytimeMinutes)}</span>
          <span className="text-border-2" aria-hidden>
            ·
          </span>
          <span>{recentlyPlayedCount} played recently</span>
        </div>
      </div>
    </div>
  );
}
