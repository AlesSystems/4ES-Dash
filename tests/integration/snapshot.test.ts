/**
 * Integration tests for the snapshot pipeline (#25, #26). These open the real
 * SQLite test DB (migrated by tests/global-setup.ts) — all DB-touching tests
 * live in this single file so no two test files write the database concurrently
 * (Prisma's SQLite connector has no skipDuplicates / weak concurrent-write story).
 *
 * Owned games are served by MSW (tests/mocks/steam-server.ts): appid 730
 * (playtime 23410, has stats) and 570 (playtime 5000).
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { POST } from '@/app/api/cron/snapshot/route';
import { prisma } from '@/server/db';
import { clearCache } from '@/server/cache';
import { getFirstSeenDates } from '@/server/repositories/snapshots';

// The job persists `profile.steamId` from GetPlayerSummaries — i.e. the
// player-summaries fixture's steamid, which differs from the .env.test
// placeholder (in production Steam echoes the configured id, so they match).
const STEAM_ID = '76561198000000000';
const SECRET = 'test_placeholder_secret'; // from .env.test

function post(headers: Record<string, string> = {}): Promise<Response> {
  return POST(new Request('http://localhost/api/cron/snapshot', { method: 'POST', headers }));
}

async function resetDb(): Promise<void> {
  // Snapshots FK to User (ON DELETE RESTRICT) — delete children first.
  await prisma.playtimeSnapshot.deleteMany();
  await prisma.achievementSnapshot.deleteMany();
  await prisma.jobRun.deleteMany();
  await prisma.user.deleteMany();
}

beforeEach(async () => {
  clearCache();
  await resetDb();
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe('POST /api/cron/snapshot — auth', () => {
  it('returns 401 with no x-cron-secret header and writes nothing', async () => {
    const res = await post();
    expect(res.status).toBe(401);
    expect(await prisma.playtimeSnapshot.count()).toBe(0);
  });

  it('returns 401 with an incorrect x-cron-secret and writes nothing', async () => {
    const res = await post({ 'x-cron-secret': 'wrong-secret' });
    expect(res.status).toBe(401);
    expect(await prisma.playtimeSnapshot.count()).toBe(0);
  });
});

describe('POST /api/cron/snapshot — snapshot run', () => {
  it('returns 200 and records one playtime row per owned game, keyed to the UTC day', async () => {
    const res = await post({ 'x-cron-secret': SECRET });
    expect(res.status).toBe(200);

    const body = (await res.json()) as { gamesProcessed: number; rowsInserted: number };
    expect(body.gamesProcessed).toBe(2);
    expect(body.rowsInserted).toBe(2);

    const rows = await prisma.playtimeSnapshot.findMany({ orderBy: { appId: 'asc' } });
    expect(rows).toHaveLength(2);
    // date is the UTC calendar day (midnight), not a timestamp.
    for (const row of rows) {
      expect(row.date.toISOString()).toMatch(/T00:00:00\.000Z$/);
    }
    // The FK User row was upserted.
    expect(await prisma.user.findUnique({ where: { steamId: STEAM_ID } })).not.toBeNull();
  });

  it('is idempotent: a second run on the same day inserts no new rows', async () => {
    await post({ 'x-cron-secret': SECRET });
    const countAfterFirst = await prisma.playtimeSnapshot.count();

    const res2 = await post({ 'x-cron-secret': SECRET });
    expect(res2.status).toBe(200);
    const body2 = (await res2.json()) as { rowsInserted: number };
    expect(body2.rowsInserted).toBe(0);
    expect(await prisma.playtimeSnapshot.count()).toBe(countAfterFirst);
  });

  it('clamps playtime up to the previous value on a Steam-side decrease and warns', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await prisma.user.create({
      data: { steamId: STEAM_ID, personaName: 'x', avatarUrl: 'x', createdAt: new Date(0) },
    });
    // A prior snapshot whose playtime (99999) exceeds what Steam now reports (23410).
    await prisma.playtimeSnapshot.create({
      data: {
        steamId: STEAM_ID,
        appId: 730,
        date: new Date(Date.UTC(2020, 0, 1)),
        playtimeForever: 99999,
      },
    });

    const res = await post({ 'x-cron-secret': SECRET });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { clamped: number };
    expect(body.clamped).toBe(1);

    const today = await prisma.playtimeSnapshot.findFirst({
      where: { appId: 730, date: { gt: new Date(Date.UTC(2020, 0, 2)) } },
    });
    expect(today?.playtimeForever).toBe(99999); // clamped up, not the lower 23410
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('records a JobRun row with status "ok" and a payload', async () => {
    await post({ 'x-cron-secret': SECRET });
    const job = await prisma.jobRun.findFirst({ where: { name: 'snapshot' } });
    expect(job?.status).toBe('ok');
    expect(job?.finishedAt).not.toBeNull();
    expect(job?.payload).toBeTruthy();
  });

  it('populates Game.priceRefreshedAt and genres for owned games (proves refreshGameStoreData ran)', async () => {
    const res = await post({ 'x-cron-secret': SECRET });
    expect(res.status).toBe(200);

    // refreshGameStoreData always writes priceRefreshedAt (even when the Store
    // API degrades gracefully) and genres as a JSON string.  If that call were
    // removed from runSnapshot(), both fields would be absent and this test fails.
    const game730 = await prisma.game.findUnique({ where: { appId: 730 } });
    expect(game730).not.toBeNull();
    expect(game730?.priceRefreshedAt).toBeInstanceOf(Date);
    expect(typeof game730?.genres).toBe('string');

    const game570 = await prisma.game.findUnique({ where: { appId: 570 } });
    expect(game570).not.toBeNull();
    expect(game570?.priceRefreshedAt).toBeInstanceOf(Date);
    expect(typeof game570?.genres).toBe('string');
  });
});

describe('getFirstSeenDates — inferred acquiredAt (#26)', () => {
  it('returns the earliest snapshot date per app as YYYY-MM-DD', async () => {
    await prisma.user.create({
      data: { steamId: STEAM_ID, personaName: 'x', avatarUrl: 'x', createdAt: new Date(0) },
    });
    await prisma.playtimeSnapshot.createMany({
      data: [
        {
          steamId: STEAM_ID,
          appId: 12345,
          date: new Date(Date.UTC(2021, 5, 20)),
          playtimeForever: 100,
        },
        {
          steamId: STEAM_ID,
          appId: 12345,
          date: new Date(Date.UTC(2021, 2, 15)),
          playtimeForever: 50,
        },
      ],
    });

    const firstSeen = await getFirstSeenDates(STEAM_ID);
    expect(firstSeen.get(12345)).toBe('2021-03-15'); // the earlier of the two
  });

  it('omits apps that were never snapshotted (acquiredAt stays null)', async () => {
    const firstSeen = await getFirstSeenDates(STEAM_ID);
    expect(firstSeen.has(99999)).toBe(false);
  });
});
