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
}

export function GameCard({
  appId,
  name,
  headerUrl,
  playtimeMinutes,
  twoWeeksMinutes,
  hasAchievements: _hasAchievements,
}: GameCardProps) {
  return (
    <Link
      href={`/game/${appId}`}
      aria-label={`${name} — ${formatHours(playtimeMinutes)}`}
      className={[
        'group block overflow-hidden rounded-lg border border-border bg-surface',
        'transition-colors hover:border-brand-500 focus-visible:outline-none',
        'focus-visible:ring-2 focus-visible:ring-brand-500',
      ].join(' ')}
    >
      {/* Cover art — aspect-[2/1] matches GameTile and the loading skeleton */}
      <div className="relative aspect-[2/1] w-full overflow-hidden">
        <Image
          src={headerUrl}
          alt={name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
          className="object-cover transition-transform duration-200 group-hover:scale-[1.02]"
        />
      </div>

      <div className="flex flex-col gap-0.5 p-3">
        <p className="truncate text-body font-medium text-text-1">{name}</p>
        <p className="text-caption text-text-3 tabular-nums">{formatHours(playtimeMinutes)}</p>
        {typeof twoWeeksMinutes === 'number' && twoWeeksMinutes > 0 && (
          <p className="text-caption text-brand-500 tabular-nums">
            +{formatHours(twoWeeksMinutes)} recently
          </p>
        )}
      </div>
    </Link>
  );
}
