/**
 * GameHero — top section of the game detail page.
 *
 * Shows the game's header image, name, and total playtime.
 * RSC: no interactivity, no browser APIs needed.
 *
 * Image hosts in next.config.mjs allow-list:
 *   - cdn.akamai.steamstatic.com (CDN headers)
 *   - media.steampowered.com
 */

import Image from 'next/image';
import { formatHours } from '@/lib/format/playtime';

export interface GameHeroProps {
  name: string;
  headerUrl: string;
  playtimeMinutes: number;
}

export function GameHero({ name, headerUrl, playtimeMinutes }: GameHeroProps): JSX.Element {
  return (
    <section className="relative mb-8 overflow-hidden rounded-xl border border-border bg-surface">
      {/* Header image — 4:1 on mobile, 5:1 on desktop */}
      <div className="relative h-48 w-full sm:h-64">
        <Image
          src={headerUrl}
          alt={name}
          fill
          priority
          sizes="(max-width: 640px) 100vw, 1280px"
          className="object-cover"
        />
        {/* Gradient overlay so text is always readable */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-surface via-surface/60 to-transparent"
          aria-hidden
        />
      </div>

      {/* Text content overlaid at the bottom */}
      <div className="relative -mt-20 px-6 pb-6 pt-0">
        <h1 className="text-display font-bold text-text-1 leading-tight">{name}</h1>
        <p className="mt-1 text-body text-text-2">
          Total playtime:{' '}
          <span className="tabular-nums font-medium text-text-1">
            {formatHours(playtimeMinutes)}
          </span>
        </p>
      </div>
    </section>
  );
}
