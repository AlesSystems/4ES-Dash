import type { OwnedGame } from '@/lib/steam/schemas';

/**
 * Sort/filter helpers for the library grid (issue #15). Pure + client-safe.
 *
 * Acquisition date (`sort=added`) is a T4 gap: Steam does not expose it. Until
 * snapshots backfill `acquiredAt` (Phase 2, #26), every game's `acquiredAt` is
 * `null`, so `sort=added` degrades to name order — the UI surfaces a note. The
 * optional `acquiredAt` field below lets that sort light up later with no API
 * change here.
 */
export type SortKey = 'playtime' | 'name' | 'recent' | 'added';

export const SORT_KEYS: readonly SortKey[] = ['playtime', 'name', 'recent', 'added'];

export const SORT_LABELS: Record<SortKey, string> = {
  playtime: 'Playtime',
  name: 'Name',
  recent: 'Recently played',
  added: 'Date added',
};

/** A library game optionally carrying a snapshot-inferred acquisition date. */
export type LibraryGame = OwnedGame & { acquiredAt?: string | null };

/** Coerce an untrusted `?sort=` value to a valid {@link SortKey} (default `playtime`). */
export function parseSortKey(value: string | null | undefined): SortKey {
  return value != null && (SORT_KEYS as readonly string[]).includes(value)
    ? (value as SortKey)
    : 'playtime';
}

const byNameAsc = (a: LibraryGame, b: LibraryGame): number =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

/**
 * Returns a new array sorted by `sort`. Never mutates the input.
 * - `playtime`: total desc, ties broken by name asc
 * - `name`: case-insensitive asc
 * - `recent`: last-two-weeks minutes desc; games not played recently (0) sink below
 * - `added`: known `acquiredAt` asc first, then `null` acquiredAt by name asc
 */
export function sortGames(games: LibraryGame[], sort: SortKey): LibraryGame[] {
  const copy = [...games];
  switch (sort) {
    case 'name':
      return copy.sort(byNameAsc);
    case 'recent':
      return copy.sort((a, b) => b.playtime.twoWeeks - a.playtime.twoWeeks || byNameAsc(a, b));
    case 'added':
      return copy.sort((a, b) => {
        const aDate = a.acquiredAt ?? null;
        const bDate = b.acquiredAt ?? null;
        if (aDate !== null && bDate !== null) return aDate.localeCompare(bDate) || byNameAsc(a, b);
        if (aDate !== null) return -1; // known dates first
        if (bDate !== null) return 1;
        return byNameAsc(a, b); // both unknown → name order
      });
    case 'playtime':
    default:
      return copy.sort((a, b) => b.playtime.total - a.playtime.total || byNameAsc(a, b));
  }
}

/** Case-insensitive substring filter on game name. Empty/blank query returns all. */
export function filterGames(games: LibraryGame[], query: string | null | undefined): LibraryGame[] {
  const q = (query ?? '').trim().toLowerCase();
  if (q === '') return games;
  return games.filter((g) => g.name.toLowerCase().includes(q));
}

/** True when no game carries a known acquisition date — drives the `sort=added` UI note. */
export function acquisitionDatesUnavailable(games: LibraryGame[]): boolean {
  return games.every((g) => (g.acquiredAt ?? null) === null);
}
