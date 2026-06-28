import Image from 'next/image';
import Link from 'next/link';
import { formatHours } from '@/lib/format/playtime';

export interface GameCardProps {
  appId: number;
  name: string;
  headerUrl: string;
  playtimeMinutes: number;
  twoWeeksMinutes?: number;
  hasAchievements?: boolean;
  /** When true playtime is hidden by Steam privacy — suppress fabricated "Untouched" labels. */
  playtimeHidden?: boolean;
}

/**
 * Library grid tile — warm "Wrapped" editorial card.
 *
 * Real data only: serif title, mono hours (or an italic "Untouched" for games
 * with zero playtime), and an optional recent-playtime badge. Per-tile
 * achievement progress is intentionally omitted (it needs a per-game Steam
 * fetch we can't afford across a full library — see CLAUDE.md degradation rule).
 */
export function GameCard({
  appId,
  name,
  headerUrl,
  playtimeMinutes,
  twoWeeksMinutes,
  // Accepted for API parity with the grid; achievement % is a later-phase feature.
  hasAchievements: _hasAchievements,
  playtimeHidden = false,
}: GameCardProps): JSX.Element {
  const untouched = playtimeMinutes === 0;
  const ariaLabel =
    playtimeHidden && untouched
      ? 'playtime hidden'
      : untouched
        ? 'untouched'
        : formatHours(playtimeMinutes);

  return (
    <Link
      href={`/game/${appId}`}
      aria-label={`${name} — ${ariaLabel}`}
      className="group relative block overflow-hidden rounded-lg border border-border bg-surface transition hover:-translate-y-0.5 hover:border-border-2 hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
    >
      {/* Cover art — aspect-[2/1] matches the loading skeleton (no CLS) */}
      <div className="relative aspect-[2/1] w-full overflow-hidden">
        <Image
          src={headerUrl}
          alt={name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw"
          className="object-cover transition duration-200 group-hover:scale-[1.02] group-hover:saturate-[1.06]"
        />
        {untouched && !playtimeHidden && (
          <>
            {/* Scrim keeps the pill legible over bright key art */}
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 to-transparent"
              aria-hidden
            />
            <span className="absolute right-2.5 top-2.5 rounded-full border border-white/20 bg-black/55 px-2 py-0.5 text-caption font-medium uppercase tracking-wide text-white backdrop-blur-sm">
              Untouched
            </span>
          </>
        )}
        {/* Neutral bottom fade into the card body */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-surface to-transparent"
          aria-hidden
        />
      </div>

      <div className="p-3">
        <p className="mb-1.5 truncate font-serif text-h3 font-medium text-text-1">{name}</p>
        <div className="flex items-baseline justify-between gap-2">
          {untouched && playtimeHidden ? (
            <span className="font-mono text-stat tabular-nums text-text-3">—</span>
          ) : untouched ? (
            <span className="font-serif text-stat italic text-text-3">Untouched</span>
          ) : (
            <span className="font-mono text-stat tabular-nums text-text-1">
              {formatHours(playtimeMinutes)}
            </span>
          )}
          {typeof twoWeeksMinutes === 'number' && twoWeeksMinutes > 0 && (
            <span className="text-caption tabular-nums text-brand-500">
              +{formatHours(twoWeeksMinutes)} recently
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
