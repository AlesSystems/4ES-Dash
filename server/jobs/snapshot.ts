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
import { refreshLibraryValueAggregate } from '@/server/repositories/library-value';
import { refreshGameStoreData } from '@/server/repositories/game-store';
import { getEnv } from '@/server/env';
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
 * Aggregated result returned by `runSnapshot()` after processing all users.
 * Top-level numeric keys are summed across users for backward compatibility
 * with the cron route (which returns them verbatim) and existing assertions.
 */
export interface SnapshotBatchResult {
  /** Total owned games seen across all users. */
  gamesProcessed: number;
  /** Total playtime rows written across all users. */
  rowsInserted: number;
  /** Total monotonic clamps across all users. */
  clamped: number;
  /** Total achievement rows written across all users. */
  achievementRowsInserted: number;
  /** Number of distinct users processed this run. */
  usersProcessed: number;
  /** Per-user result details. */
  results: SnapshotResult[];
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
 * Run the snapshot job for a single Steam user. Extracted from the original
 * `runSnapshot` so that `runSnapshot` can fan-out across all onboarded users.
 * Does NOT create a JobRun row — the caller is responsible for observability.
 * Throws on unrecoverable failure (private profile, network error, etc.).
 */
export async function runSnapshotForUser(steamId: string): Promise<SnapshotResult> {
  const { profile, games } = await getProfile(steamId);
  const resolvedSteamId = profile.steamId;
  const dayKey = utcDayKey();

  // The snapshot tables FK to User — ensure the row exists before inserting.
  await prisma.user.upsert({
    where: { steamId: resolvedSteamId },
    create: {
      steamId: resolvedSteamId,
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
  const priorMaxByApp = await prismaPriorMax(resolvedSteamId, dayKey);

  // Which apps already have a row for today (so re-runs report 0 inserted).
  const existingToday = await prisma.playtimeSnapshot.findMany({
    where: { steamId: resolvedSteamId, date: dayKey },
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
        resolvedSteamId,
        game.appId,
        game.playtime.total,
        prior,
      );
    }
    if (!existingAppIds.has(game.appId)) rowsInserted += 1;
    return prisma.playtimeSnapshot.upsert({
      where: { steamId_appId_date: { steamId: resolvedSteamId, appId: game.appId, date: dayKey } },
      create: { steamId: resolvedSteamId, appId: game.appId, date: dayKey, playtimeForever: value },
      update: {}, // today's row is immutable once written → idempotent re-run
    });
  });
  await prisma.$transaction(upserts);

  const achievementRowsInserted = await snapshotAchievements(resolvedSteamId, games, dayKey);

  // Record per-achievement unlock EVENTS for ALL achievement-bearing games.
  // Best-effort: never fails the snapshot.
  try {
    await recordAchievementUnlocks(resolvedSteamId, games);
  } catch (err) {
    console.error('[snapshot] achievement unlock recording failed steamId=%s', resolvedSteamId, err);
  }

  // Pre-compute the library-value aggregate. Best-effort.
  try {
    await refreshLibraryValueAggregate(resolvedSteamId, games);
  } catch (err) {
    console.error('[snapshot] library-value aggregate refresh failed steamId=%s', resolvedSteamId, err);
  }

  // Persist per-game genres + current price. Best-effort.
  try {
    await refreshGameStoreData(games);
  } catch (err) {
    console.error('[snapshot] game store data refresh failed steamId=%s', resolvedSteamId, err);
  }

  return {
    steamId: resolvedSteamId,
    date: dayKey.toISOString().slice(0, 10),
    gamesProcessed: games.length,
    rowsInserted,
    clamped,
    achievementRowsInserted,
  };
}

/**
 * Run the nightly snapshot job for ALL onboarded users plus the featured
 * STEAM_ID (if configured). Uses a deduped Set so a featured-also-onboarded
 * user is only processed once. One user's failure is isolated (try/catch +
 * log); the batch continues and the cron route returns 200 regardless.
 * Returns a backward-compatible `SnapshotBatchResult` whose top-level numeric
 * keys are summed across users (so existing route + test assertions hold for
 * the single-user case).
 */
export async function runSnapshot(): Promise<SnapshotBatchResult> {
  const job = await prisma.jobRun.create({
    data: { name: 'snapshot', status: 'running' },
  });

  try {
    // Build deduped target set: featured STEAM_ID (if set) ∪ all onboarded users.
    const targetSet = new Set<string>();
    const featuredId = getEnv().STEAM_ID;
    if (featuredId) targetSet.add(featuredId);

    const onboardedUsers = await prisma.user.findMany({
      where: { onboardedAt: { not: null } },
      select: { steamId: true },
    });
    for (const u of onboardedUsers) targetSet.add(u.steamId);

    if (targetSet.size === 0) {
      throw new Error('No target users configured — set STEAM_ID or onboard a user first');
    }

    const results: SnapshotResult[] = [];
    for (const id of targetSet) {
      try {
        const result = await runSnapshotForUser(id);
        results.push(result);
      } catch (err) {
        console.error('[snapshot] per-user snapshot failed steamId=%s', id, err);
      }
    }

    const batch: SnapshotBatchResult = {
      gamesProcessed: results.reduce((s, r) => s + r.gamesProcessed, 0),
      rowsInserted: results.reduce((s, r) => s + r.rowsInserted, 0),
      clamped: results.reduce((s, r) => s + r.clamped, 0),
      achievementRowsInserted: results.reduce((s, r) => s + r.achievementRowsInserted, 0),
      usersProcessed: results.length,
      results,
    };

    await prisma.jobRun.update({
      where: { id: job.id },
      data: { status: 'ok', finishedAt: new Date(), payload: JSON.stringify(batch) },
    });

    return batch;
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
 * Best-effort cumulative achievement-COUNT snapshot for the most-played
 * achievement games. Bounded to {@link ACHIEVEMENT_SNAPSHOT_LIMIT} because each
 * game costs rate-limited Steam calls. Games whose achievement data is
 * unavailable (private / none) are silently skipped — never throws.
 *
 * Per-achievement unlock EVENTS (#91) are recorded separately by
 * {@link recordAchievementUnlocks} (over ALL achievement-bearing games), not here.
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
    const result = await getGameAchievements(steamId, game.appId);
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

/** Minimal per-achievement shape needed to record an unlock event. */
interface UnlockItem {
  apiName: string;
  unlocked: boolean;
  /** ISO-8601 UTC string; null when locked or Steam reports unlocktime 0. */
  unlockedAt: string | null;
}

/**
 * Upserts AchievementUnlock rows for the unlocked achievements of one game,
 * keyed by the real unlock time. Achievements that are locked or have an
 * unknown unlock time (`unlockedAt === null`, i.e. Steam's unlocktime 0) are
 * skipped — never stored as a 1970 epoch. Idempotent: the row is immutable
 * once written (compound PK `(steamId, appId, apiName)`, empty `update`).
 * Returns the number of unlock rows seen (created or already present).
 */
async function upsertUnlockEvents(
  steamId: string,
  appId: number,
  items: UnlockItem[],
): Promise<number> {
  let n = 0;
  for (const item of items) {
    if (!item.unlocked || item.unlockedAt === null) continue;
    await prisma.achievementUnlock.upsert({
      where: { steamId_appId_apiName: { steamId, appId, apiName: item.apiName } },
      create: { steamId, appId, apiName: item.apiName, unlockedAt: new Date(item.unlockedAt) },
      update: {}, // a recorded unlock is immutable — idempotent re-run
    });
    n += 1;
  }
  return n;
}

/**
 * Records per-achievement unlock events (#91) for ALL achievement-bearing games
 * of `steamId`, via the cached, rate-limited achievement repository. Recording
 * EVERY such game (not just the top-N played) is what makes criterion #6 hold —
 * an unlock in a game outside the most-played set still counts in Year-in-Review.
 * This per-game fan-out is deliberately in the nightly JOB / onboarding flow,
 * never on an interactive request path (architecture: heavy work lives in jobs);
 * `getGameAchievements` is cached + single-flight, so games already fetched for
 * the cumulative-count pass are not re-fetched. Used by the onboarding backfill
 * too, so a brand-new user's EXISTING unlocks (and prior years) populate
 * immediately, attributed by their real `unlockedAt`. Unavailable games are
 * skipped; a single game's failure does not abort the rest. Returns the number
 * of unlock rows recorded.
 */
export async function recordAchievementUnlocks(
  steamId: string,
  games: OwnedGame[],
  limit?: number,
): Promise<number> {
  const all = games.filter((g) => g.hasAchievements);
  // When a limit is provided (interactive resync path), cap to the top-N by
  // playtime so the fan-out is bounded. When omitted (nightly), process all.
  const candidates = limit !== undefined ? topGamesByPlaytime(all, limit) : all;

  let total = 0;
  for (const game of candidates) {
    try {
      const result = await getGameAchievements(steamId, game.appId);
      if (!result.available) continue;
      total += await upsertUnlockEvents(steamId, game.appId, result.data.items);
    } catch (err) {
      console.error(
        '[snapshot] unlock recording failed steamId=%s appId=%d',
        steamId,
        game.appId,
        err,
      );
    }
  }
  return total;
}
