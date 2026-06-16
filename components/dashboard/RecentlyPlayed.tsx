import Image from 'next/image';
import Link from 'next/link';
import type { RecentGame } from '@/server/repositories/recently-played';
import { formatHours } from '@/lib/format/playtime';
import { EmptyState } from '@/components/states/EmptyState';
import { StaleBanner } from '@/components/states/StaleBanner';

export interface RecentlyPlayedProps {
  games: RecentGame[];
  stale: boolean;
}

const MAX_GAMES = 10;

/**
 * Recently played widget (#19).
 *
 * Pure RSC — receives pre-fetched data from the parent page.
 * Renders up to 10 games played in the last two weeks.
 */
export function RecentlyPlayed({ games, stale }: RecentlyPlayedProps): JSX.Element {
  const displayGames = games.slice(0, MAX_GAMES);

  return (
    <section aria-label="Recently played games">
      <div className="mb-4 flex items-baseline gap-3">
        <h2 className="flex items-baseline gap-3 font-serif text-h2 text-text-1">
          <span>Recently played</span>
          <span className="font-mono text-caption font-normal text-text-3">last 14 days</span>
        </h2>
        {stale && <StaleBanner />}
      </div>

      {displayGames.length === 0 ? (
        <EmptyState
          title="Nothing played recently"
          description="Games you play in the last two weeks will show up here."
        />
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5" role="list">
          {displayGames.map((game) => (
            <li key={game.appId}>
              <Link
                href={`/game/${game.appId}`}
                className="group block overflow-hidden rounded-lg border border-border bg-surface transition hover:-translate-y-0.5 hover:border-border-2 hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              >
                {/* 2:1 aspect box — matches GameTile skeleton geometry */}
                <div className="relative aspect-[2/1] w-full overflow-hidden">
                  <Image
                    src={game.headerUrl}
                    alt={game.name}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 20vw"
                    className="object-cover transition duration-200 group-hover:scale-[1.02] group-hover:saturate-[1.06]"
                  />
                  {/* Neutral bottom fade into the card body (no fabricated art tint) */}
                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-surface to-transparent"
                    aria-hidden
                  />
                </div>

                <div className="p-3">
                  <p className="mb-2 truncate font-serif text-h3 font-medium text-text-1">
                    {game.name}
                  </p>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-stat tabular-nums text-text-1">
                      {formatHours(game.twoWeeksMinutes)}
                    </span>
                    <span className="text-caption text-text-3">last 2 weeks</span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
