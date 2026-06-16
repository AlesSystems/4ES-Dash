/**
 * Nightly snapshot job (#25). Captures one playtime row per owned game per UTC
 * day, plus a bounded pass of achievement-unlock counts. Designed to be safe to
 * re-run: a second invocation on the same calendar day inserts no new rows.
 *
 * Idempotency: each row is written with an `upsert` keyed on the compound
 * `(steamId, appId, date)` PK and an empty `update` — re-running is a no-op.
 * (Prisma's `createMany({ skipDuplicates })` is not supported on SQLite, so we
 * use per-row upserts inside a single transaction instead. See ERR-0005.)
 *
 * Monotonicity: `playtimeForever` only ever increases. If Steam reports a lower
 * number than the latest *prior* snapshot (a Steam-side correction), we clamp to
 * the previous value and log a warning.
 */

import { prisma } from '@/server/db';
import { getProfile } from '@/server/repositories/profile';
import { getGameAchievements } from '@/server/repositories/achievements';
import { topGamesByPlaytime } from '@/lib/games/select';
import type { OwnedGame } from '@/lib/steam/schemas';

/** How many of the most-played achievement games to snapshot unlock counts for. */
export const ACHIEVEMENT_SNAPSHOT_LIMIT = 20;

export interface SnapshotResult {
  /** The Steam ID the snapshot ran for. */
  steamId: string;
  /** The UTC calendar day key, as an ISO date (YYYY-MM-DD). */
  date: string;
  /** Owned games seen this run. */
  gamesProcessed: number;
  /** New playtime rows written (0 on an idempotent re-run). */
  rowsInserted: number;
  /** Games whose reported playtime was clamped up to a prior higher value. */
  clamped: number;
  /** Achievement-count rows written this run. */
  achievementRowsInserted: number;
}

/**
 * Truncate a timestamp to its UTC calendar day (midnight UTC). Snapshots are
 * keyed by day, not hour — Steam playtime isn't real-time anyway.
 */
export function utcDayKey(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Clamp a reported playtime to be monotonic against the previous value.
 * Returns the value to store and whether a clamp was applied.
 */
export function clampPlaytime(
  reported: number,
  previous: number,
): { value: number; clamped: boolean } {
  if (reported < previous) return { value: previous, clamped: true };
  return { value: reported, clamped: false };
}

/**
 * Run the snapshot job for the configured Steam user. Writes a `JobRun` row for
 * observability (running → ok/error). Throws on an unrecoverable failure (e.g. a
 * private profile) after recording the failed `JobRun`; the cron route maps that
 * to a 500.
 */
export async function runSnapshot(): Promise<SnapshotResult> {
  const job = await prisma.jobRun.create({
    data: { name: 'snapshot', status: 'running' },
  });

  try {
    const { profile, games } = await getProfile();
    const steamId = profile.steamId;
    const dayKey = utcDayKey();

    // The snapshot tables FK to User — ensure the row exists before inserting.
    await prisma.user.upsert({
      where: { steamId },
      create: {
        steamId,
        personaName: profile.personaName,
        avatarUrl: profile.avatar.full,
        countryCode: profile.countryCode ?? null,
        // createdAt is non-null in the schema; epoch signals "unknown" when Steam
        // omits timecreated (private/new accounts).
        createdAt: profile.createdAt ? new Date(profile.createdAt) : new Date(0),
      },
      update: {
        personaName: profile.personaName,
        avatarUrl: profile.avatar.full,
        countryCode: profile.countryCode ?? null,
        lastSyncedAt: new Date(),
      },
    });

    // Latest prior playtime per app (strictly before today) for the clamp.
    const priorMaxByApp = await prismaPriorMax(steamId, dayKey);

    // Which apps already have a row for today (so re-runs report 0 inserted).
    // This drives the `rowsInserted` count only — it is best-effort reporting,
    // not the idempotency mechanism (that is the upsert's compound PK below).
    const existingToday = await prisma.playtimeSnapshot.findMany({
      where: { steamId, date: dayKey },
      select: { appId: true },
    });
    const existingAppIds = new Set(existingToday.map((r) => r.appId));

    let clamped = 0;
    let rowsInserted = 0;
    const upserts = games.map((game) => {
      const prior = priorMaxByApp.get(game.appId) ?? 0;
      const { value, clamped: didClamp } = clampPlaytime(game.playtime.total, prior);
      if (didClamp) {
        clamped += 1;
        console.warn(
          '[snapshot] monotonic clamp applied steamId=%s appId=%d reported=%d previous=%d',
          steamId,
          game.appId,
          game.playtime.total,
          prior,
        );
      }
      if (!existingAppIds.has(game.appId)) rowsInserted += 1;
      return prisma.playtimeSnapshot.upsert({
        where: { steamId_appId_date: { steamId, appId: game.appId, date: dayKey } },
        create: { steamId, appId: game.appId, date: dayKey, playtimeForever: value },
        update: {}, // today's row is immutable once written → idempotent re-run
      });
    });
    await prisma.$transaction(upserts);

    const achievementRowsInserted = await snapshotAchievements(steamId, games, dayKey);

    const result: SnapshotResult = {
      steamId,
      date: dayKey.toISOString().slice(0, 10),
      gamesProcessed: games.length,
      rowsInserted,
      clamped,
      achievementRowsInserted,
    };

    await prisma.jobRun.update({
      where: { id: job.id },
      data: { status: 'ok', finishedAt: new Date(), payload: JSON.stringify(result) },
    });

    return result;
  } catch (err) {
    await prisma.jobRun.update({
      where: { id: job.id },
      data: {
        status: 'error',
        finishedAt: new Date(),
        error: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}

/** Latest playtime per app from snapshots strictly before `dayKey`. */
async function prismaPriorMax(steamId: string, dayKey: Date): Promise<Map<number, number>> {
  const rows = await prisma.playtimeSnapshot.groupBy({
    by: ['appId'],
    where: { steamId, date: { lt: dayKey } },
    _max: { playtimeForever: true },
  });
  return new Map(rows.map((r) => [r.appId, r._max.playtimeForever ?? 0]));
}

/**
 * Best-effort achievement-count snapshot for the most-played achievement games.
 * Bounded to {@link ACHIEVEMENT_SNAPSHOT_LIMIT} because each game costs
 * rate-limited Steam calls. Games whose achievement data is unavailable
 * (private / none) are silently skipped — never throws.
 */
async function snapshotAchievements(
  steamId: string,
  games: OwnedGame[],
  dayKey: Date,
): Promise<number> {
  const candidates = topGamesByPlaytime(
    games.filter((g) => g.hasAchievements),
    ACHIEVEMENT_SNAPSHOT_LIMIT,
  );

  let written = 0;
  for (const game of candidates) {
    const result = await getGameAchievements(game.appId);
    if (!result.available) continue;
    await prisma.achievementSnapshot.upsert({
      where: { steamId_appId_date: { steamId, appId: game.appId, date: dayKey } },
      create: { steamId, appId: game.appId, date: dayKey, unlockedCount: result.data.unlocked },
      update: {},
    });
    written += 1;
  }
  return written;
}
