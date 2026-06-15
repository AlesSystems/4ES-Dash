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
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-h2 font-semibold text-text-1">Recently played</h2>
        {stale && <StaleBanner />}
      </div>

      {displayGames.length === 0 ? (
        <EmptyState
          title="Nothing played recently"
          description="Games you play in the last two weeks will show up here."
        />
      ) : (
        <ul
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          role="list"
        >
          {displayGames.map((game) => (
            <li key={game.appId}>
              <Link
                href={`/game/${game.appId}`}
                className="group block overflow-hidden rounded-lg border border-border bg-surface transition-colors hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              >
                {/* 2:1 aspect box — matches GameTile skeleton geometry */}
                <div className="relative aspect-[2/1] w-full overflow-hidden">
                  <Image
                    src={game.headerUrl}
                    alt={game.name}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                    className="object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                  />
                </div>

                <div className="flex flex-col gap-0.5 p-3">
                  <p className="text-body font-medium text-text-1 truncate">{game.name}</p>
                  <p className="text-caption text-text-3 tabular-nums">
                    <span className="font-medium text-text-2">
                      {formatHours(game.twoWeeksMinutes)}
                    </span>{' '}
                    <span>last 2 weeks</span>
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
