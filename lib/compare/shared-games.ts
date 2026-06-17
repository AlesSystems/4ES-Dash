import type { OwnedGame } from '@/lib/steam/schemas';

// ---------------------------------------------------------------------------
// Shared-games computation (Phase 3, compare two users — issue #31)
// Pure + client-safe. No imports from @/server/*.
// ---------------------------------------------------------------------------

export interface SharedGame {
  appId: number;
  name: string;
  iconUrl: string | null;
  headerUrl: string;
  /** User A's total playtime in minutes. */
  playtimeA: number;
  /** User B's total playtime in minutes. */
  playtimeB: number;
  /** Absolute difference: Math.abs(playtimeA - playtimeB). */
  deltaMinutes: number;
}

/**
 * Inner-join two libraries on appId → the games BOTH users own.
 *
 * Sorting: deltaMinutes DESC; ties broken by name ASC (case-insensitive).
 * Metadata (name, iconUrl, headerUrl) is taken from user A's entry; falls
 * back to B's name when A's name is an empty string.
 *
 * O(n + m) — builds a Map from B for the join. Never mutates either input.
 * Duplicate appIds within one input: last entry wins (no crash).
 */
export function computeSharedGames(a: OwnedGame[], b: OwnedGame[]): SharedGame[] {
  if (a.length === 0 || b.length === 0) return [];

  // Build lookup map from B (last duplicate wins).
  const bMap = new Map<number, OwnedGame>();
  for (const game of b) {
    bMap.set(game.appId, game);
  }

  // Build a de-duplicated map from A (last duplicate wins) then join.
  const aMap = new Map<number, OwnedGame>();
  for (const game of a) {
    aMap.set(game.appId, game);
  }

  const shared: SharedGame[] = [];
  for (const [appId, gameA] of aMap) {
    const gameB = bMap.get(appId);
    if (gameB === undefined) continue;

    const playtimeA = gameA.playtime.total;
    const playtimeB = gameB.playtime.total;
    const deltaMinutes = Math.abs(playtimeA - playtimeB);

    shared.push({
      appId,
      name: gameA.name || gameB.name,
      iconUrl: gameA.iconUrl,
      headerUrl: gameA.headerUrl,
      playtimeA,
      playtimeB,
      deltaMinutes,
    });
  }

  // Sort: deltaMinutes DESC, then name ASC (case-insensitive).
  return shared.sort(
    (x, y) =>
      y.deltaMinutes - x.deltaMinutes ||
      x.name.localeCompare(y.name, undefined, { sensitivity: 'base' }),
  );
}
