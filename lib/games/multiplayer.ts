/**
 * Multiplayer-eligibility helpers for the library filter (issue #32).
 * Pure + client-safe — no `@/server/*` imports.
 */

import type { LibraryGame } from './sort';

/** Steam Store category IDs that mark a game as multiplayer-eligible:
 *  1 = Multi-player, 9 = Co-op, 27 = Cross-Platform Multiplayer. */
export const MULTIPLAYER_CATEGORY_IDS: readonly number[] = [1, 9, 27];

/**
 * Returns true when a game's Store categoryIds include any multiplayer-eligible id.
 * Safely handles null/undefined (e.g. when Store metadata was unavailable).
 */
export function isMultiplayerGame(categoryIds: number[] | null | undefined): boolean {
  if (categoryIds == null || categoryIds.length === 0) return false;
  return categoryIds.some((id) => (MULTIPLAYER_CATEGORY_IDS as readonly number[]).includes(id));
}

/**
 * Coerce an untrusted `?multiplayer=` query-param value to a boolean.
 * Returns true only for the strings `'1'` and `'true'`; everything else is false.
 */
export function parseMultiplayerParam(value: string | null | undefined): boolean {
  return value === '1' || value === 'true';
}

/**
 * Keep only games whose appId is present in `multiplayerAppIds`.
 * Never mutates the input array.
 */
export function filterToMultiplayer(
  games: LibraryGame[],
  multiplayerAppIds: Set<number>,
): LibraryGame[] {
  if (multiplayerAppIds.size === 0) return [];
  return games.filter((g) => multiplayerAppIds.has(g.appId));
}
