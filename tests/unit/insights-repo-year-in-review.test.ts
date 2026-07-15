import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAvailableReviewYears,
  getYearInReview,
} from '@/server/repositories/insights/year-in-review';

const mockPrisma = vi.hoisted(() => ({
  playtimeSnapshot: { findMany: vi.fn(), groupBy: vi.fn() },
  achievementSnapshot: { findMany: vi.fn() },
  achievementUnlock: { findMany: vi.fn() },
  game: { findMany: vi.fn() },
}));

vi.mock('@/server/db', () => ({ prisma: mockPrisma }));
vi.mock('@/server/env', () => ({ getEnv: () => ({ STEAM_ID: '76561198000000000' }) }));

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no pre-year baseline rows. Tests that need a baseline seed it via
  // seedSnapshots (faithful two-query mock) below.
  mockPrisma.playtimeSnapshot.groupBy.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// Faithful query mocks (Theme 1 / T1)
//
// getYearInReview issues DB-bounded queries: a {gte,lt} year-windowed main
// playtime scan, an lt-only pre-year baseline groupBy + keyed fetch, and a
// {gte,lt}-bounded unlock scan. These mocks answer exactly what a real Prisma
// query would return for the seeded rows given the captured `where` bounds, so
// a test can never accidentally feed pre-year rows through the main scan (the
// mistake that masked the merged-tree baseline starvation, ERR-0019/ERR-0020).
// ---------------------------------------------------------------------------

interface SeededPlaytimeRow {
  appId: number;
  date: Date;
  playtimeForever: number;
}

interface SeededUnlockRow {
  steamId: string;
  appId: number;
  apiName: string;
  unlockedAt: Date;
}

interface DateBound {
  gte?: Date;
  lt?: Date;
}

interface PlaytimeWhere {
  steamId?: string;
  date?: DateBound;
  OR?: { appId: number; date: Date }[];
}

interface UnlockWhere {
  steamId?: string;
  unlockedAt?: DateBound;
}

const inRange = (t: Date, bound?: DateBound): boolean =>
  (!(bound?.gte instanceof Date) || t.getTime() >= bound.gte.getTime()) &&
  (!(bound?.lt instanceof Date) || t.getTime() < bound.lt.getTime());

function seedSnapshots(rows: SeededPlaytimeRow[], unlocks: SeededUnlockRow[] = []): void {
  mockPrisma.playtimeSnapshot.findMany.mockImplementation(
    async (args?: { where?: PlaytimeWhere }) => {
      const where = args?.where;
      const orPairs = where?.OR;
      if (Array.isArray(orPairs)) {
        // Keyed baseline fetch: exact (appId, date) pairs.
        return rows
          .filter((r) =>
            orPairs.some((p) => p.appId === r.appId && p.date.getTime() === r.date.getTime()),
          )
          .map((r) => ({ appId: r.appId, playtimeForever: r.playtimeForever }));
      }
      return rows
        .filter((r) => inRange(r.date, where?.date))
        .map((r) => ({ appId: r.appId, date: r.date, playtimeForever: r.playtimeForever }));
    },
  );
  mockPrisma.playtimeSnapshot.groupBy.mockImplementation(
    async (args?: { where?: PlaytimeWhere }) => {
      const latest = new Map<number, Date>();
      for (const r of rows) {
        if (!inRange(r.date, args?.where?.date)) continue;
        const cur = latest.get(r.appId);
        if (cur === undefined || r.date.getTime() > cur.getTime()) latest.set(r.appId, r.date);
      }
      return Array.from(latest, ([appId, date]) => ({ appId, _max: { date } }));
    },
  );
  mockPrisma.achievementUnlock.findMany.mockImplementation(
    async (args?: { where?: UnlockWhere }) =>
      unlocks.filter((u) => inRange(u.unlockedAt, args?.where?.unlockedAt)),
  );
}

const snap = (appId: number, ms: number, playtimeForever: number): SeededPlaytimeRow => ({
  appId,
  date: new Date(ms),
  playtimeForever,
});

const unlock = (appId: number, apiName: string, ms: number): SeededUnlockRow => ({
  steamId: '76561198000000000',
  appId,
  apiName,
  unlockedAt: new Date(ms),
});

describe('getAvailableReviewYears', () => {
  it('returns [] when no snapshots', async () => {
    mockPrisma.playtimeSnapshot.findMany.mockResolvedValue([]);
    expect(await getAvailableReviewYears('76561198000000000')).toEqual([]);
  });

  it('returns distinct years DESC from snapshot dates', async () => {
    mockPrisma.playtimeSnapshot.findMany.mockResolvedValue([
      { date: new Date('2024-01-01T00:00:00.000Z') },
      { date: new Date('2025-06-15T00:00:00.000Z') },
      { date: new Date('2024-11-01T00:00:00.000Z') },
    ]);
    const years = await getAvailableReviewYears('76561198000000000');
    expect(years).toEqual([2025, 2024]);
  });

  it('accepts explicit steamId', async () => {
    mockPrisma.playtimeSnapshot.findMany.mockResolvedValue([]);
    await getAvailableReviewYears('76561198111111111');
    expect(mockPrisma.playtimeSnapshot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { steamId: '76561198111111111' } }),
    );
  });
});

describe('getYearInReview', () => {
  it('returns zero totals when no data for the year', async () => {
    mockPrisma.playtimeSnapshot.findMany.mockResolvedValue([]);
    mockPrisma.achievementUnlock.findMany.mockResolvedValue([]);
    mockPrisma.game.findMany.mockResolvedValue([]);
    const result = await getYearInReview('76561198000000000', 2025);
    expect(result).toEqual({
      year: 2025,
      totalMinutes: 0,
      topGames: [],
      achievementsUnlocked: 0,
      partialYear: false,
    });
  });

  it('uses game name from DB and App fallback', async () => {
    mockPrisma.playtimeSnapshot.findMany.mockResolvedValue([
      { appId: 730, date: new Date('2025-01-01T00:00:00.000Z'), playtimeForever: 100 },
      { appId: 730, date: new Date('2025-06-01T00:00:00.000Z'), playtimeForever: 200 },
      { appId: 999, date: new Date('2025-01-01T00:00:00.000Z'), playtimeForever: 50 },
      { appId: 999, date: new Date('2025-06-01T00:00:00.000Z'), playtimeForever: 150 },
    ]);
    mockPrisma.achievementUnlock.findMany.mockResolvedValue([]);
    mockPrisma.game.findMany.mockResolvedValue([{ appId: 730, name: 'Counter-Strike 2' }]);
    const result = await getYearInReview('76561198000000000', 2025);
    const cs2 = result.topGames.find((g) => g.appId === 730);
    const unknown = result.topGames.find((g) => g.appId === 999);
    expect(cs2?.name).toBe('Counter-Strike 2');
    expect(unknown?.name).toBe('App 999');
  });

  it('reaches back to the pre-year baseline snapshot for playtime gain (ERR-0019)', async () => {
    // The year's gain is (in-year max) − (last snapshot strictly before Jan 1).
    // The pre-year row is only reachable through the separate baseline fetch —
    // the {gte,lt}-bounded main scan never returns it (faithful mock).
    seedSnapshots([
      snap(730, Date.UTC(2024, 11, 31), 100),
      snap(730, Date.UTC(2025, 0, 5), 200),
      snap(730, Date.UTC(2025, 11, 20), 350),
    ]);
    mockPrisma.game.findMany.mockResolvedValue([{ appId: 730, name: 'Counter-Strike 2' }]);
    const result = await getYearInReview('76561198000000000', 2025);
    expect(result.totalMinutes).toBe(250); // 350 − 100, not 150
    expect(result.partialYear).toBe(false);
  });

  it('flags partial-year when a game has no pre-year baseline', async () => {
    mockPrisma.playtimeSnapshot.findMany.mockResolvedValue([
      { appId: 730, date: new Date('2025-03-01T00:00:00.000Z'), playtimeForever: 200 },
      { appId: 730, date: new Date('2025-12-01T00:00:00.000Z'), playtimeForever: 350 },
    ]);
    mockPrisma.achievementUnlock.findMany.mockResolvedValue([]);
    mockPrisma.game.findMany.mockResolvedValue([{ appId: 730, name: 'Counter-Strike 2' }]);
    const result = await getYearInReview('76561198000000000', 2025);
    expect(result.totalMinutes).toBe(150);
    expect(result.partialYear).toBe(true);
  });

  it('date-bounds the playtimeSnapshot scan to the review year so @@index([steamId, date]) is usable', async () => {
    mockPrisma.playtimeSnapshot.findMany.mockResolvedValue([]);
    mockPrisma.achievementUnlock.findMany.mockResolvedValue([]);
    mockPrisma.game.findMany.mockResolvedValue([]);
    await getYearInReview('76561198000000000', 2025);
    const call = mockPrisma.playtimeSnapshot.findMany.mock.calls[0]![0]!;
    expect(call.where.steamId).toBe('76561198000000000');
    // The playtime scan must be date-bounded to the review year window.
    expect(call.where.date).toBeDefined();
    expect(call.where.date.gte).toBeInstanceOf(Date);
    expect(call.where.date.gte.getUTCFullYear()).toBe(2025);
    expect(call.where.date.lt).toBeInstanceOf(Date);
    expect(call.where.date.lt.getUTCFullYear()).toBe(2026);
  });

  it('counts achievementsUnlocked from unlock EVENTS, not snapshot deltas (#91)', async () => {
    // The regression case: a single day of playtime data (no snapshot history),
    // but several real unlock events in the year — the old delta logic returned 0.
    mockPrisma.playtimeSnapshot.findMany.mockResolvedValue([
      { appId: 730, date: new Date('2025-05-01T00:00:00.000Z'), playtimeForever: 100 },
    ]);
    mockPrisma.achievementUnlock.findMany.mockResolvedValue([
      { steamId: '76561198000000000', appId: 730, apiName: 'a', unlockedAt: new Date('2025-05-01T00:00:00.000Z') },
      { steamId: '76561198000000000', appId: 730, apiName: 'b', unlockedAt: new Date('2025-05-02T00:00:00.000Z') },
      // An unlock in a game with NO playtime snapshot still counts.
      { steamId: '76561198000000000', appId: 111, apiName: 'c', unlockedAt: new Date('2025-09-09T00:00:00.000Z') },
      // A different year is excluded.
      { steamId: '76561198000000000', appId: 730, apiName: 'd', unlockedAt: new Date('2024-12-31T23:59:59.000Z') },
    ]);
    mockPrisma.game.findMany.mockResolvedValue([{ appId: 730, name: 'Counter-Strike 2' }]);
    const result = await getYearInReview('76561198000000000', 2025);
    expect(result.achievementsUnlocked).toBe(3);
    // queries the unlock table, scoped to the user AND bounded to the review
    // year (T1): in prod the 2024-12-31 event above arrives pre-filtered by the
    // DB bound; computeYearInReview's UTC-year filter stays as the defensive
    // pure-module contract (it excludes it here, same result).
    expect(mockPrisma.achievementUnlock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          steamId: '76561198000000000',
          unlockedAt: { gte: new Date(Date.UTC(2025, 0, 1)), lt: new Date(Date.UTC(2026, 0, 1)) },
        },
      }),
    );
  });

  describe('bounded reads with a decoupled baseline (Theme 1 / T1)', () => {
    const S = '76561198000000000';
    const YEAR_START = new Date(Date.UTC(2025, 0, 1));
    const YEAR_END = new Date(Date.UTC(2026, 0, 1));

    it('keeps the full {gte,lt} bound on the main scan AND sources the baseline from a separate lt-only fetch', async () => {
      seedSnapshots([]);
      mockPrisma.game.findMany.mockResolvedValue([]);
      await getYearInReview(S, 2025);

      // Main playtime scan: bug-3's shipped year bound, byte-preserved.
      const main = mockPrisma.playtimeSnapshot.findMany.mock.calls[0]![0]!;
      expect(main.where.steamId).toBe(S);
      expect(main.where.date).toEqual({ gte: YEAR_START, lt: YEAR_END });

      // Baseline fetch: its own query, bounded strictly-before Jan 1 ONLY
      // (no gte — it must reach back to the latest pre-year row per app).
      expect(mockPrisma.playtimeSnapshot.groupBy).toHaveBeenCalledTimes(1);
      const baseline = mockPrisma.playtimeSnapshot.groupBy.mock.calls[0]![0]!;
      expect(baseline.by).toEqual(['appId']);
      expect(baseline.where).toEqual({ steamId: S, date: { lt: YEAR_START } });
      expect(baseline._max).toEqual({ date: true });
    });

    it('bounds the unlock scan by unlockedAt to the review-year window', async () => {
      seedSnapshots([]);
      mockPrisma.game.findMany.mockResolvedValue([]);
      await getYearInReview(S, 2025);
      const call = mockPrisma.achievementUnlock.findMany.mock.calls[0]![0]!;
      expect(call.where.steamId).toBe(S);
      expect(call.where.unlockedAt).toEqual({ gte: YEAR_START, lt: YEAR_END });
    });

    it('unlock boundary: Jan 1 00:00 UTC of the year counts, Jan 1 00:00 UTC of year+1 does not (tripwire)', async () => {
      // Pinned tripwire: green through the pure filter even before the DB
      // bound existed; with the bound the rows simply arrive pre-filtered.
      seedSnapshots(
        [],
        [
          unlock(730, 'a', Date.UTC(2025, 0, 1)), // gte inclusive — counts
          unlock(730, 'b', Date.UTC(2026, 0, 1)), // lt exclusive — excluded
          unlock(730, 'c', Date.UTC(2024, 11, 31, 23, 59, 59)), // pre-year — excluded
        ],
      );
      mockPrisma.game.findMany.mockResolvedValue([]);
      const result = await getYearInReview(S, 2025);
      expect(result.achievementsUnlocked).toBe(1);
    });

    it('game name lookup only covers the fetched playtime rows appIds (tripwire)', async () => {
      // Pinned regression tripwire: already true at base (appIds derive from
      // the bounded main scan); pinned so the baseline fetch can never leak
      // pre-year-only apps into the name lookup.
      seedSnapshots([
        snap(730, Date.UTC(2025, 1, 1), 100),
        snap(730, Date.UTC(2025, 2, 1), 160),
        snap(999, Date.UTC(2023, 4, 1), 400), // pre-year-only app
      ]);
      mockPrisma.game.findMany.mockResolvedValue([{ appId: 730, name: 'Counter-Strike 2' }]);
      await getYearInReview(S, 2025);
      const call = mockPrisma.game.findMany.mock.calls[0]![0]!;
      expect(call.where.appId.in).toEqual([730]);
    });

    it('preserves bug-2 baseline semantics under bounding (ERR-0019): in-year max − pre-year baseline', async () => {
      seedSnapshots(
        [
          // App 730 — two pre-year rows: the LATEST (Dec 31 23:59:59.999 UTC,
          // strictly before Jan 1) wins as the baseline.
          snap(730, Date.UTC(2024, 5, 1), 50),
          snap(730, Date.UTC(2024, 11, 31, 23, 59, 59, 999), 100),
          snap(730, Date.UTC(2025, 0, 5), 200),
          snap(730, Date.UTC(2025, 11, 20), 350),
          // App 440 — first row exactly Jan 1 00:00 UTC: belongs to the YEAR,
          // not the baseline → no baseline → partial-year caveat.
          snap(440, Date.UTC(2025, 0, 1), 10),
          snap(440, Date.UTC(2025, 6, 1), 70),
          // App 999 — pre-year only: contributes nothing to the review output.
          snap(999, Date.UTC(2023, 4, 1), 400),
        ],
        [
          unlock(730, 'a', Date.UTC(2025, 2, 1)),
          unlock(730, 'b', Date.UTC(2025, 0, 1)), // Jan 1 00:00 of year — counts
          unlock(730, 'c', Date.UTC(2024, 11, 31, 23, 59, 59)), // pre-year — excluded
          unlock(111, 'd', Date.UTC(2026, 0, 1)), // Jan 1 of year+1 — excluded
        ],
      );
      mockPrisma.game.findMany.mockResolvedValue([{ appId: 730, name: 'Counter-Strike 2' }]);

      const result = await getYearInReview(S, 2025);

      // Pinned bug-2-derived expected object: gains are (in-year max) − (pre-year
      // baseline), NOT within-year max−min (which would give 150 for app 730).
      expect(result).toEqual({
        year: 2025,
        totalMinutes: 310, // 730: 350−100=250; 440: 70−10=60 (no baseline)
        topGames: [
          { appId: 730, name: 'Counter-Strike 2', minutesDelta: 250 },
          { appId: 440, name: 'App 440', minutesDelta: 60 },
        ],
        achievementsUnlocked: 2,
        partialYear: true, // 440 lacks a pre-year baseline
      });

      // The baseline arrived exclusively via the keyed fetch of the
      // (appId, latest pre-year date) rows — never via the main scan.
      const calls = mockPrisma.playtimeSnapshot.findMany.mock.calls;
      expect(calls.length).toBe(2);
      const keyed = calls[1]![0]!;
      expect(keyed.where.steamId).toBe(S);
      expect(keyed.where.OR).toEqual(
        expect.arrayContaining([
          { appId: 730, date: new Date(Date.UTC(2024, 11, 31, 23, 59, 59, 999)) },
          { appId: 999, date: new Date(Date.UTC(2023, 4, 1)) },
        ]),
      );
    });
  });
});
