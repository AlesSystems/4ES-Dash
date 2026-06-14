import type { OwnedGame } from '@/lib/steam/schemas';

/**
 * Return the top `limit` games by total playtime, descending. Ties break by
 * name (ascending) for stable ordering. Does not mutate the input. If fewer
 * than `limit` games exist, all are returned (no padding). See ACCEPTANCE #13.
 */
export function topGamesByPlaytime(games: OwnedGame[], limit = 10): OwnedGame[] {
  return [...games]
    .sort((a, b) => b.playtime.total - a.playtime.total || a.name.localeCompare(b.name))
    .slice(0, limit);
}
