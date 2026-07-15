/**
 * Multiplayer-eligibility for the library filter (issue #32), read from the
 * DB — zero Store calls on the request path (theme-2 T3, ERR-0010/0011
 * precompute pattern).
 *
 * The nightly job (refreshGameStoreData) persists Store category ids into
 * `Game.categoryIds` (JSON-encoded number array; null = never categorized).
 * This reader is one indexed `game.findMany` over the owned appIds plus the
 * retained getProfile call — O(1) in external calls, independent of library
 * size. Never throws on missing data; degrades via missingCount.
 */

import { prisma } from '@/server/db';
import { getProfile } from '@/server/repositories/profile';
import { requireSteamId } from '@/server/repositories/require-steam-id';
import { isMultiplayerGame } from '@/lib/games/multiplayer';

export interface MultiplayerLibrary {
  /** appIds whose persisted Store categories mark them multiplayer-eligible. */
  multiplayerAppIds: Set<number>;
  /**
   * Games with no usable persisted categoryIds (no Game row, null column, or
   * malformed stored JSON) — excluded from the set, never silently treated as
   * multiplayer or non-multiplayer.
   */
  missingCount: number;
  /**
   * Always false: the DB read of nightly-refreshed reference data carries no
   * stale-while-revalidate signal, and fabricating one is forbidden. Data
   * gaps surface through missingCount only. Kept for interface stability.
   */
  stale: boolean;
}

/**
 * Defensively parse a stored `Game.categoryIds` value.
 *
 * Returns the number array, or null when the value is null, not valid JSON,
 * or not a pure number array — malformed stored data degrades to "never
 * categorized" (→ missingCount), never a crash and never a classification.
 */
function parseCategoryIds(raw: string | null): number[] | null {
  if (raw == null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    if (!parsed.every((v): v is number => typeof v === 'number')) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Returns the set of multiplayer-eligible appIds for the given user's library.
 *
 * Classification rules (from persisted `Game.categoryIds`):
 * - parseable number array with a multiplayer categoryId → added to the set.
 * - parseable number array without one (incl. `[]`) → skipped — a positive
 *   "not multiplayer" classification.
 * - missing Game row / null column / malformed JSON → increments missingCount;
 *   excluded from the set — never classified from missing data.
 *
 * @param steamId - Required. Pass getEnv().STEAM_ID at the call site for the
 *   featured/dev default — never read env.STEAM_ID inside this repository.
 */
export async function getMultiplayerAppIds(steamId: string): Promise<MultiplayerLibrary> {
  const id = requireSteamId(steamId, 'getMultiplayerAppIds');
  const { games } = await getProfile(id);

  const rows = await prisma.game.findMany({
    where: { appId: { in: games.map((g) => g.appId) } },
    select: { appId: true, categoryIds: true },
  });
  const storedByAppId = new Map(rows.map((r) => [r.appId, r.categoryIds]));

  const multiplayerAppIds = new Set<number>();
  let missingCount = 0;

  for (const game of games) {
    const categoryIds = parseCategoryIds(storedByAppId.get(game.appId) ?? null);
    if (categoryIds === null) {
      // No row / never refreshed / malformed — surface via missingCount.
      missingCount++;
      continue;
    }
    if (isMultiplayerGame(categoryIds)) {
      multiplayerAppIds.add(game.appId);
    }
  }

  return { multiplayerAppIds, missingCount, stale: false };
}
