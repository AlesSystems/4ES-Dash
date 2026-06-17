import Image from 'next/image';
import { formatHours } from '@/lib/format/playtime';
import type { ComparedSide } from '@/server/repositories/compare';

export interface UserColumnProps {
  side: ComparedSide;
  /** 'left' for user A, 'right' for user B — controls text alignment. */
  align?: 'left' | 'right';
}

/**
 * One column in the CompareHeader: avatar, persona name, and library stats.
 * Degrades gracefully when the profile is null or the library is private.
 */
export function UserColumn({ side, align = 'left' }: UserColumnProps): JSX.Element {
  const { profile, steamId, gamesCount, totalMinutes, isPrivate } = side;
  const displayName = profile?.personaName ?? steamId;
  const avatarUrl = profile?.avatar.full ?? null;

  const alignClass = align === 'right' ? 'items-end text-right' : 'items-start text-left';

  return (
    <div className={`flex flex-1 flex-col gap-4 ${alignClass}`}>
      {/* Avatar */}
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-border bg-surface-2">
        {avatarUrl !== null ? (
          <Image src={avatarUrl} alt={displayName} fill sizes="80px" className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-serif text-h2 text-text-3">
            {displayName.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>

      {/* Name */}
      <p className="font-serif text-display-md font-normal leading-tight tracking-tight text-text-1">
        {displayName}
      </p>

      {/* Stats */}
      {isPrivate ? (
        <p className="text-body italic text-text-3">Library is private</p>
      ) : (
        <div className={`flex gap-6 ${align === 'right' ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className={`flex flex-col ${alignClass}`}>
            <span className="font-serif text-stat tabular-nums text-text-1">
              {gamesCount !== null ? gamesCount.toLocaleString() : '—'}
            </span>
            <span className="mt-1.5 font-mono text-caption uppercase tracking-widest text-text-3">
              Games
            </span>
          </div>
          <div className={`flex flex-col ${alignClass}`}>
            <span className="font-serif text-stat tabular-nums text-text-1">
              {totalMinutes !== null ? formatHours(totalMinutes) : '—'}
            </span>
            <span className="mt-1.5 font-mono text-caption uppercase tracking-widest text-text-3">
              Hours
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
