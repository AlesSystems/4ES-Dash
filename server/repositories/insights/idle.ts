/**
 * Idle-spike detection repository (Phase 4, issue #37).
 *
 * Surfaces detected idle windows for a user, filtered against their
 * dismissals, and allows new dismissals to be recorded.
 */

import { prisma } from '@/server/db';
import { requireSteamId } from '@/server/repositories/require-steam-id';
import { detectIdleSpikes, DEFAULT_IDLE_THRESHOLD_MINUTES, type IdleFlag } from '@/lib/insights';

export interface IdleFlagView {
  appId: number;
  name: string;
  fromDate: Date;
  toDate: Date;
  deltaMinutes: number;
}

/**
 * Returns active (non-dismissed) idle spike windows for the user.
 *
 * A flag is considered dismissed when there is a matching IdleDismissal row
 * with the same appId, fromDate, and toDate (exact epoch-ms equality).
 */
export async function getIdleFlags(
  steamId: string,
  thresholdMinutes?: number,
): Promise<IdleFlagView[]> {
  const id = requireSteamId(steamId, 'getIdleFlags');

  const [snapshotRows, dismissalRows] = await Promise.all([
    prisma.playtimeSnapshot.findMany({
      where: { steamId: id },
      select: { appId: true, date: true, playtimeForever: true },
    }),
    prisma.idleDismissal.findMany({
      where: { steamId: id },
      select: { appId: true, fromDate: true, toDate: true },
    }),
  ]);

  const flags: IdleFlag[] = detectIdleSpikes(
    snapshotRows,
    thresholdMinutes ?? DEFAULT_IDLE_THRESHOLD_MINUTES,
  );

  // Build a Set of dismissal keys for O(1) lookup
  const dismissedKeys = new Set<string>(
    dismissalRows.map((d) => `${d.appId}:${d.fromDate.getTime()}:${d.toDate.getTime()}`),
  );

  const activeFlags = flags.filter(
    (f) => !dismissedKeys.has(`${f.appId}:${f.fromDate.getTime()}:${f.toDate.getTime()}`),
  );

  if (activeFlags.length === 0) return [];

  const activeAppIds = Array.from(new Set(activeFlags.map((f) => f.appId)));
  const gameRecords = await prisma.game.findMany({
    where: { appId: { in: activeAppIds } },
    select: { appId: true, name: true },
  });

  const names = new Map<number, string>(gameRecords.map((g) => [g.appId, g.name]));

  return activeFlags.map((flag) => ({
    appId: flag.appId,
    name: names.get(flag.appId) ?? `App ${flag.appId}`,
    fromDate: flag.fromDate,
    toDate: flag.toDate,
    deltaMinutes: flag.deltaMinutes,
  }));
}

/**
 * Records a dismissal for the given idle spike window.
 * Idempotent — upserting with empty update means re-dismissing is a no-op.
 */
export async function dismissIdleFlag(
  steamId: string,
  input: { appId: number; fromDate: Date; toDate: Date },
): Promise<void> {
  const id = requireSteamId(steamId, 'dismissIdleFlag');

  await prisma.idleDismissal.upsert({
    where: {
      steamId_appId_fromDate_toDate: {
        steamId: id,
        appId: input.appId,
        fromDate: input.fromDate,
        toDate: input.toDate,
      },
    },
    create: {
      steamId: id,
      appId: input.appId,
      fromDate: input.fromDate,
      toDate: input.toDate,
    },
    update: {},
  });
}
