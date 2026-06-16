import Image from 'next/image';
import Link from 'next/link';
import { formatHours } from '@/lib/format/playtime';

export interface GameRowProps {
  appId: number;
  name: string;
  headerUrl: string;
  playtimeMinutes: number;
  twoWeeksMinutes?: number;
}

/**
 * Library list-view row — the compact alternative to {@link GameCard}.
 * Real data only: thumbnail, serif title, optional recent badge, mono hours.
 */
export function GameRow({
  appId,
  name,
  headerUrl,
  playtimeMinutes,
  twoWeeksMinutes,
}: GameRowProps): JSX.Element {
  const untouched = playtimeMinutes === 0;

  return (
    <Link
      href={`/game/${appId}`}
      aria-label={`${name} — ${untouched ? 'untouched' : formatHours(playtimeMinutes)}`}
      className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500"
    >
      <div className="relative aspect-[2/1] w-28 shrink-0 overflow-hidden rounded-md">
        <Image src={headerUrl} alt="" fill sizes="112px" className="object-cover" aria-hidden />
      </div>
      <p className="min-w-0 flex-1 truncate font-serif text-h3 font-medium text-text-1">{name}</p>
      {typeof twoWeeksMinutes === 'number' && twoWeeksMinutes > 0 && (
        <span className="hidden shrink-0 text-caption tabular-nums text-brand-500 sm:inline">
          +{formatHours(twoWeeksMinutes)} recently
        </span>
      )}
      <span className="shrink-0 font-mono text-body tabular-nums text-text-1">
        {untouched ? 'Untouched' : formatHours(playtimeMinutes)}
      </span>
    </Link>
  );
}
