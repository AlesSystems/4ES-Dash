import type { LibraryGame } from '@/lib/games/sort';
import { GameCard } from './GameCard';

export interface LibraryGridProps {
  games: LibraryGame[];
}

export function LibraryGrid({ games }: LibraryGridProps) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {games.map((game) => (
        <li key={game.appId}>
          <GameCard
            appId={game.appId}
            name={game.name}
            headerUrl={game.headerUrl}
            playtimeMinutes={game.playtime.total}
            twoWeeksMinutes={game.playtime.twoWeeks}
            hasAchievements={game.hasAchievements}
          />
        </li>
      ))}
    </ul>
  );
}
