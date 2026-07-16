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

/** Exactly the fields the library tiles render — nothing else crosses the RSC→client boundary. */
export type LibraryTileGame = Pick<
  OwnedGame,
  'appId' | 'name' | 'headerUrl' | 'hasAchievements'
> & {
  playtime: { total: number; twoWeeks: number };
};

/**
 * Project a full {@link LibraryGame} to the tile-only shape sent to the client.
 * Sort/filter on the full `LibraryGame` FIRST (e.g. `recent`/`added` need
 * `playtime.twoWeeks`/`acquiredAt`), then map with this at the boundary.
 */
export function toLibraryTile(g: LibraryGame): LibraryTileGame {
  return {
    appId: g.appId,
    name: g.name,
    headerUrl: g.headerUrl,
    hasAchievements: g.hasAchievements,
    playtime: { total: g.playtime.total, twoWeeks: g.playtime.twoWeeks },
  };
}

/**
 * Library status filter. Derived purely from playtime (real data):
 * - `in-progress`: total playtime > 0
 * - `untouched`: never played (total playtime === 0)
 * "Completed" is intentionally absent — it needs per-game achievement data we
 * can't afford across a full library (see CLAUDE.md degradation contract).
 */
export type StatusFilter = 'all' | 'in-progress' | 'untouched';

export const STATUS_KEYS: readonly StatusFilter[] = ['all', 'in-progress', 'untouched'];

export const STATUS_LABELS: Record<StatusFilter, string> = {
  all: 'All',
  'in-progress': 'In progress',
  untouched: 'Untouched',
};

/** Grid vs list presentation for the results area. */
export type ViewMode = 'grid' | 'list';

export const VIEW_KEYS: readonly ViewMode[] = ['grid', 'list'];

/** Coerce an untrusted `?status=` value to a valid {@link StatusFilter} (default `all`). */
export function parseStatusKey(value: string | null | undefined): StatusFilter {
  return value != null && (STATUS_KEYS as readonly string[]).includes(value)
    ? (value as StatusFilter)
    : 'all';
}

/** Coerce an untrusted `?view=` value to a valid {@link ViewMode} (default `grid`). */
export function parseViewMode(value: string | null | undefined): ViewMode {
  return value === 'list' ? 'list' : 'grid';
}

/** Filter by play status. `all` returns the input unchanged (no copy). */
export function filterByStatus(games: LibraryGame[], status: StatusFilter): LibraryGame[] {
  if (status === 'all') return games;
  if (status === 'untouched') return games.filter((g) => g.playtime.total === 0);
  return games.filter((g) => g.playtime.total > 0);
}

/** Games revealed per "Load more" click — the server-side page size for `/library`. */
export const PAGE_SIZE = 24;

/** Hard ceiling for `?limit=` — bounds the worst-case payload a URL can request. */
export const MAX_LIMIT = 960;

/**
 * Coerce an untrusted `?limit=` value to a bounded page limit.
 *
 * Invalid / missing / non-positive → {@link PAGE_SIZE}. Valid numbers are
 * clamped to {@link MAX_LIMIT} and snapped DOWN to a multiple of
 * {@link PAGE_SIZE} (a hand-edited `?limit=25` shows 24 — never more than the
 * URL asked for; our own UI only writes multiples of 24). Follows the shipped
 * non-Zod `parseSortKey`/`parseStatusKey` convention: invalid → default,
 * never throw.
 */
export function parseLimitParam(value: string | null | undefined): number {
  const n = value != null && value.trim() !== '' ? Number(value) : NaN;
  if (!Number.isFinite(n) || n < PAGE_SIZE) return PAGE_SIZE;
  const clamped = Math.min(Math.floor(n), MAX_LIMIT);
  return clamped - (clamped % PAGE_SIZE);
}

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
