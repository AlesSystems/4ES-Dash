/**
 * Pure aggregate functions for achievement data.
 *
 * No I/O — all functions are deterministic given their inputs.
 * These are the building blocks consumed by server/repositories/achievements.ts.
 */

import type { PlayerAchievement, AchievementSchema } from '@/lib/steam/achievements';

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type MergedAchievement = {
  apiName: string;
  displayName: string;
  description: string;
  iconUrl: string;
  unlocked: boolean;
  unlockedAt: string | null;
  globalPercent: number | null;
};

export type GameAchievements = {
  unlocked: number;
  total: number;
  /** Math.round(unlocked/total*100), or 0 when total is 0. */
  percent: number;
  items: MergedAchievement[];
};

export type LibrarySummary = {
  totalUnlocked: number;
  totalAvailable: number;
  /** Math.round(totalUnlocked/totalAvailable*100), or 0 when totalAvailable is 0. */
  percent: number;
  /** All unlocked achievements across all games with unlockedAt within the last 7 days, sorted newest-first. */
  recentUnlocks: MergedAchievement[];
};

// ---------------------------------------------------------------------------
// mergeGameAchievements
// ---------------------------------------------------------------------------

/**
 * Joins player progress, schema, and global percentages into a single
 * `GameAchievements` view.
 *
 * Join strategy:
 * - The schema drives the set of known achievement names / display labels.
 * - Player data fills unlocked/unlockedAt; achievements missing from the player
 *   list (schema-only) are treated as locked with no unlock time.
 * - Global percent is taken from the map; missing entries → null.
 *
 * Sort order of items: unlocked first, then by globalPercent desc, nulls last.
 */
export function mergeGameAchievements(
  player: PlayerAchievement[],
  schema: AchievementSchema[],
  global: Map<string, number>,
): GameAchievements {
  // Index player data by apiName for O(1) lookups.
  const playerMap = new Map<string, PlayerAchievement>();
  for (const p of player) {
    playerMap.set(p.apiName, p);
  }

  // Build schema-keyed merged list. Fall back to apiName as displayName when
  // the entry is present in player data but absent from schema.
  const schemaMap = new Map<string, AchievementSchema>();
  for (const s of schema) {
    schemaMap.set(s.apiName, s);
  }

  // Union of all known achievement names (schema takes precedence; player fills gaps).
  const allNames = new Set<string>([
    ...schema.map((s) => s.apiName),
    ...player.map((p) => p.apiName),
  ]);

  const items: MergedAchievement[] = [];

  for (const apiName of allNames) {
    const schemaDef = schemaMap.get(apiName);
    const playerDef = playerMap.get(apiName);

    const unlocked = playerDef?.unlocked ?? false;
    const unlockedAt = playerDef?.unlockedAt ?? null;
    const globalPercent = global.get(apiName) ?? null;

    // When schema is missing, fall back for display fields.
    const displayName = schemaDef?.displayName ?? apiName;
    const description = schemaDef?.description ?? '';

    // Choose colour icon when unlocked, grey icon when locked.
    const iconUrl = unlocked
      ? (schemaDef?.iconUrl ?? schemaDef?.iconGrayUrl ?? '')
      : (schemaDef?.iconGrayUrl ?? schemaDef?.iconUrl ?? '');

    items.push({
      apiName,
      displayName,
      description,
      iconUrl,
      unlocked,
      unlockedAt,
      globalPercent,
    });
  }

  // Sort: unlocked first, then globalPercent desc (nulls last).
  items.sort((a, b) => {
    if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;

    const aGp = a.globalPercent;
    const bGp = b.globalPercent;

    if (aGp === null && bGp === null) return 0;
    if (aGp === null) return 1;
    if (bGp === null) return -1;
    return bGp - aGp;
  });

  const unlocked = items.filter((i) => i.unlocked).length;
  const total = items.length;
  const percent = total > 0 ? Math.round((unlocked / total) * 100) : 0;

  return { unlocked, total, percent, items };
}

// ---------------------------------------------------------------------------
// aggregateLibrary
// ---------------------------------------------------------------------------

const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

/**
 * Aggregates per-game `GameAchievements` into a library-wide summary.
 *
 * @param perGame  Array of game achievement results (unlocked, total, items).
 * @param now      Reference date for the "recent 7 days" window. Defaults to `new Date()`.
 */
export function aggregateLibrary(
  perGame: Array<{ unlocked: number; total: number; items: MergedAchievement[] }>,
  now?: Date,
): LibrarySummary {
  const reference = now ?? new Date();
  const cutoff = reference.getTime() - RECENT_WINDOW_MS;

  let totalUnlocked = 0;
  let totalAvailable = 0;
  // Carry the parsed unlock time alongside each item so the sort comparator
  // never re-parses dates (COMP-7: parse once per surviving item).
  const recent: Array<{ item: MergedAchievement; ms: number }> = [];

  for (const game of perGame) {
    totalUnlocked += game.unlocked;
    totalAvailable += game.total;

    for (const item of game.items) {
      if (!item.unlocked || item.unlockedAt === null) continue;

      const unlockedMs = new Date(item.unlockedAt).getTime();
      if (unlockedMs >= cutoff) {
        recent.push({ item, ms: unlockedMs });
      }
    }
  }

  // Sort recent unlocks newest-first using the pre-parsed timestamps.
  recent.sort((a, b) => b.ms - a.ms);
  const recentUnlocks = recent.map((r) => r.item);

  const percent = totalAvailable > 0 ? Math.round((totalUnlocked / totalAvailable) * 100) : 0;

  return { totalUnlocked, totalAvailable, percent, recentUnlocks };
}
