/**
 * Integration tests for the snapshot pipeline (#25, #26). These open the real
 * SQLite test DB (migrated by tests/global-setup.ts) — all DB-touching tests
 * live in this single file so no two test files write the database concurrently
 * (Prisma's SQLite connector has no skipDuplicates / weak concurrent-write story).
 *
 * Owned games are served by MSW (tests/mocks/steam-server.ts): appid 730
 * (playtime 23410, has stats) and 570 (playtime 5000).
 */

import { describe, it, expect, beforeEach, afterAll, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { POST, maxDuration } from '@/app/api/cron/snapshot/route';
import { prisma } from '@/server/db';
import { clearCache } from '@/server/cache';
import { getFirstSeenDates } from '@/server/repositories/snapshots';
import { steamServer } from '@/tests/mocks/steam-server';

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

describe('POST /api/cron/snapshot — route config', () => {
  it('exports an explicit maxDuration (theme-5 T3; provisional 300, platform-tier gated)', () => {
    // Pin: the nightly window is intentional, never the platform default.
    // The value itself is provisional — drops to 60 if the platform-tier
    // gated check reports Hobby (see route comment / docs/DEPLOYMENT.md).
    expect(maxDuration).toBe(300);
  });
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

  it('JobRun.payload round-trips timings', async () => {
    // Theme-5 T3: per-pass wall-clock timings are recorded per user and
    // surfaced through the persisted JobRun.payload (additive — top-level
    // summed keys unchanged).
    const res = await post({ 'x-cron-secret': SECRET });
    expect(res.status).toBe(200);

    const job = await prisma.jobRun.findFirst({ where: { name: 'snapshot' } });
    const payload = JSON.parse(job?.payload ?? 'null') as {
      usersProcessed: number;
      results: Array<{ timings?: Record<string, unknown> }>;
    } | null;
    expect(payload).not.toBeNull();
    expect(payload?.usersProcessed).toBe(1);

    const timings = payload?.results[0]?.timings;
    expect(timings).toBeDefined();
    for (const key of [
      'playtimeMs',
      'achievementSnapshotMs',
      'unlockRecordingMs',
      'libraryValueMs',
      'gameStoreMs',
    ]) {
      const value = timings?.[key];
      expect(typeof value, `timings.${key}`).toBe('number');
      expect(value as number, `timings.${key}`).toBeGreaterThanOrEqual(0);
    }
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

// ---------------------------------------------------------------------------
// Bug-03: multi-user snapshot fan-out (AC1, AC2, AC3)
// ---------------------------------------------------------------------------

const STEAM_ID_B = '76561198111111111';

/** Seed user B as onboarded so runSnapshot finds them. */
async function seedOnboardedUser(steamId: string): Promise<void> {
  await prisma.user.upsert({
    where: { steamId },
    create: {
      steamId,
      personaName: 'UserB',
      avatarUrl: 'https://avatars.steamstatic.com/b.jpg',
      createdAt: new Date(0),
      onboardedAt: new Date(),
    },
    update: { onboardedAt: new Date() },
  });
}

describe('POST /api/cron/snapshot — multi-user (bug-03)', () => {
  afterEach(() => {
    steamServer.resetHandlers();
  });

  it('AC1: snapshots every onboarded user, not only STEAM_ID', async () => {
    // Seed user B as onboarded.
    await seedOnboardedUser(STEAM_ID_B);

    // Override GetPlayerSummaries to echo whichever steamid is requested.
    steamServer.use(
      http.get('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/', ({ request }) => {
        const url = new URL(request.url);
        const steamids = url.searchParams.get('steamids') ?? STEAM_ID;
        const id = steamids.split(',')[0];
        return HttpResponse.json({
          response: {
            players: [{
              steamid: id,
              communityvisibilitystate: 3,
              profilestate: 1,
              personaname: 'User',
              profileurl: 'https://steamcommunity.com/id/user/',
              avatar: 'https://avatars.steamstatic.com/abc123_small.jpg',
              avatarmedium: 'https://avatars.steamstatic.com/abc123_medium.jpg',
              avatarfull: 'https://avatars.steamstatic.com/abc123_full.jpg',
              avatarhash: 'abc123',
              personastate: 1,
              timecreated: 1208044800,
            }],
          },
        });
      }),
    );

    const res = await post({ 'x-cron-secret': SECRET });
    expect(res.status).toBe(200);

    const body = (await res.json()) as { usersProcessed: number };
    expect(body.usersProcessed).toBe(2);

    const distinct = await prisma.playtimeSnapshot.groupBy({
      by: ['steamId'],
    });
    expect(distinct.length).toBe(2);
  });

  it('AC2: one user failure does not abort batch; cron returns 200 with other user rows present', async () => {
    await seedOnboardedUser(STEAM_ID_B);

    // STEAM_ID (featured) gets 500 from GetPlayerSummaries; STEAM_ID_B echoes normally.
    steamServer.use(
      http.get('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/', ({ request }) => {
        const url = new URL(request.url);
        const steamids = url.searchParams.get('steamids') ?? '';
        const id = steamids.split(',')[0];
        if (id === STEAM_ID) {
          return HttpResponse.error();
        }
        return HttpResponse.json({
          response: {
            players: [{
              steamid: id,
              communityvisibilitystate: 3,
              profilestate: 1,
              personaname: 'UserB',
              profileurl: 'https://steamcommunity.com/id/userb/',
              avatar: 'https://avatars.steamstatic.com/abc123_small.jpg',
              avatarmedium: 'https://avatars.steamstatic.com/abc123_medium.jpg',
              avatarfull: 'https://avatars.steamstatic.com/abc123_full.jpg',
              avatarhash: 'abc123',
              personastate: 1,
              timecreated: 1208044800,
            }],
          },
        });
      }),
    );

    const res = await post({ 'x-cron-secret': SECRET });
    expect(res.status).toBe(200);

    // B's rows are present; A's are absent.
    const bRows = await prisma.playtimeSnapshot.findMany({ where: { steamId: STEAM_ID_B } });
    expect(bRows.length).toBeGreaterThan(0);
    const aRows = await prisma.playtimeSnapshot.findMany({ where: { steamId: STEAM_ID } });
    expect(aRows.length).toBe(0);
  });

  it('AC3: featured-also-onboarded user is processed exactly once (dedup)', async () => {
    // Seed the env STEAM_ID (from .env.test) as onboarded — it appears in both
    // getEnv().STEAM_ID and the findMany results; the Set union must deduplicate.
    const { getEnv } = await import('@/server/env');
    const envSteamId = getEnv().STEAM_ID ?? STEAM_ID;
    await prisma.user.upsert({
      where: { steamId: envSteamId },
      create: {
        steamId: envSteamId,
        personaName: 'Ales',
        avatarUrl: 'https://avatars.steamstatic.com/abc123_full.jpg',
        createdAt: new Date(0),
        onboardedAt: new Date(),
      },
      update: { onboardedAt: new Date() },
    });

    const res = await post({ 'x-cron-secret': SECRET });
    expect(res.status).toBe(200);

    const body = (await res.json()) as { usersProcessed: number };
    expect(body.usersProcessed).toBe(1);

    const distinct = await prisma.playtimeSnapshot.groupBy({ by: ['steamId'] });
    expect(distinct.length).toBe(1);
  });
});
