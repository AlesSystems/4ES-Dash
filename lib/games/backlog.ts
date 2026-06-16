import type { LibraryGame } from '@/lib/games/sort';

export interface OldestUnplayed {
  name: string;
  acquiredAt: string | null;
}

/**
 * The oldest unplayed (playtime.total === 0) game.
 * Ordering: games with a known acquiredAt come first, earliest date wins
 * (ISO strings sort lexicographically); ties / all-null fall back to name
 * ascending (localeCompare). Returns null if nothing is unplayed.
 */
export function oldestUnplayed(games: LibraryGame[]): OldestUnplayed | null {
  const unplayed = games.filter((g) => g.playtime.total === 0);
  if (unplayed.length === 0) return null;

  const winner = unplayed.reduce((best, current) => {
    const bDate = best.acquiredAt ?? null;
    const cDate = current.acquiredAt ?? null;

    // Known date beats unknown (null)
    if (bDate !== null && cDate === null) return best;
    if (bDate === null && cDate !== null) return current;

    // Both known — earlier ISO string wins; equal dates fall through to name tiebreak
    if (bDate !== null && cDate !== null) {
      const dateCmp = bDate.localeCompare(cDate);
      if (dateCmp !== 0) return dateCmp < 0 ? best : current;
    }

    // Both null, or tied on date — lower name (case-insensitive) wins
    return best.name.localeCompare(current.name, undefined, { sensitivity: 'base' }) <= 0
      ? best
      : current;
  });

  return { name: winner.name, acquiredAt: winner.acquiredAt ?? null };
}
