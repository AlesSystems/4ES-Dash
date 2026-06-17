/**
 * Manual game data import repository (Phase 4, issue #40).
 *
 * Persists user-supplied price-paid and acquisition data for owned games.
 * Uses an upsert transaction so re-imports are idempotent.
 */

import { prisma } from '@/server/db';
import { getEnv } from '@/server/env';
import type { ManualGameImportRow } from '@/lib/zod/api/import';

export type { ManualGameImportRow };

/**
 * Upserts ManualGameData rows for the given steamId.
 * All rows are written in a single transaction; the operation is idempotent
 * (re-importing the same rows overwrites with the same values).
 *
 * @returns The number of rows processed (= rows.length on success).
 */
export async function importManualGameData(
  rows: ManualGameImportRow[],
  steamId?: string,
): Promise<{ imported: number }> {
  const id = steamId ?? getEnv().STEAM_ID;

  await prisma.$transaction(
    rows.map((row) =>
      prisma.manualGameData.upsert({
        where: { steamId_appId: { steamId: id, appId: row.appId } },
        create: {
          steamId: id,
          appId: row.appId,
          pricePaidCents: row.pricePaidCents ?? null,
          currency: row.currency ?? null,
          acquiredAt: row.acquiredAt ? new Date(row.acquiredAt) : null,
        },
        update: {
          pricePaidCents: row.pricePaidCents ?? null,
          currency: row.currency ?? null,
          acquiredAt: row.acquiredAt ? new Date(row.acquiredAt) : null,
        },
      }),
    ),
  );

  return { imported: rows.length };
}
