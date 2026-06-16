import Link from 'next/link';

export interface TopGamesProps {
  games: { appId: number; name: string; playtimeMinutes: number }[];
}

export function TopGames({ games }: TopGamesProps): JSX.Element {
  const sumHours = Math.round(
    games.reduce((acc, g) => acc + g.playtimeMinutes, 0) / 60,
  ).toLocaleString();

  const maxMinutes = games.length > 0 ? Math.max(...games.map((g) => g.playtimeMinutes)) : 1;

  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <div className="mb-4">
        <h2 className="font-serif text-h2 text-text-1">
          Most played, <span className="italic">all time</span>
        </h2>
        {games.length > 0 && (
          <p className="font-mono text-caption text-text-3 tabular-nums mt-1">
            {sumHours} hours across the top {games.length}
          </p>
        )}
      </div>

      {games.length === 0 ? (
        <p className="text-body text-text-3">No games to rank yet.</p>
      ) : (
        <div>
          {games.map((game, i) => {
            const pct = (game.playtimeMinutes / maxMinutes) * 100;
            const hours = Math.round(game.playtimeMinutes / 60).toLocaleString();

            return (
              <div
                key={game.appId}
                className={`grid grid-cols-[24px_1fr_auto] items-center gap-4 py-3${
                  i === 0 ? '' : ' border-t border-border'
                }`}
              >
                {/* Rank */}
                <span className="font-serif italic text-h3 text-text-3 tabular-nums">{i + 1}</span>

                {/* Name + bar */}
                <div className="min-w-0">
                  <Link
                    href={`/game/${game.appId}`}
                    className="text-body font-medium text-text-1 truncate block hover:text-brand-500 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                  >
                    {game.name}
                  </Link>
                  <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden mt-1.5">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Hours */}
                <span className="font-serif text-stat tabular-nums text-text-1 text-right whitespace-nowrap">
                  {hours}
                  <span className="font-serif text-caption italic text-text-3">h</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
