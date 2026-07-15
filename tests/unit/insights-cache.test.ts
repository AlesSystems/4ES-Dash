/**
 * T5 (DATA-4) — aggregate caching (PLAN-theme-1-snapshot-reads, TDD #14–#17).
 *
 * The REAL server/cache module is used (spy-wrapped so call args are
 * observable): caching behavior, stale-while-revalidate, and single-flight are
 * the actual implementation, never a pass-through fake. Prisma is mocked via
 * vi.hoisted — no I/O.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getIdleFlags } from '@/server/repositories/insights/idle';
import {
  getAvailableReviewYears,
  getYearInReview,
} from '@/server/repositories/insights/year-in-review';
import { getCostPerHour } from '@/server/repositories/insights/cost-per-hour';
import { getGenreBreakdown } from '@/server/repositories/insights/genres';
import { getPlaytimeSnapshots } from '@/server/repositories/snapshots';
import { cache, clearCache, TTL } from '@/server/cache';
import { DEFAULT_IDLE_THRESHOLD_MINUTES } from '@/lib/insights';

const mockPrisma = vi.hoisted(() => ({
  playtimeSnapshot: { findMany: vi.fn(), groupBy: vi.fn() },
  idleDismissal: { findMany: vi.fn() },
  achievementUnlock: { findMany: vi.fn() },
  ownedGame: { findMany: vi.fn() },
  game: { findMany: vi.fn() },
}));

vi.mock('@/server/db', () => ({ prisma: mockPrisma }));
vi.mock('@/server/env', () => ({
  getEnv: () => ({ STEAM_ID: '76561198000000000', ENABLE_STEAMSPY: false }),
}));
// Spy-wrap the REAL cache module: behavior is untouched (same store, same SWR
// contract), but every cache(key, ttl, loader) call is observable (TDD #17).
vi.mock('@/server/cache', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/cache')>();
  return { ...actual, cache: vi.fn(actual.cache) };
});

const S1 = '76561198000000000';
const S2 = '76561198111111111';

/** Two snapshots for one app producing a single idle spike of `delta` minutes. */
function spikeRows(appId: number, delta: number) {
  return [
    { appId, date: new Date('2026-06-01T00:00:00.000Z'), playtimeForever: 0 },
    { appId, date: new Date('2026-06-02T00:00:00.000Z'), playtimeForever: delta },
  ];
}

function seedCostPerHourGame(): void {
  mockPrisma.ownedGame.findMany.mockResolvedValue([{ appId: 730, playtimeForever: 60 }]);
  mockPrisma.game.findMany.mockResolvedValue([
    {
      appId: 730,
      name: 'CS2',
      priceFinalCents: 1499,
      priceCurrency: 'USD',
      priceIsFree: false,
      priceRefreshedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  ]);
}

beforeEach(() => {
  vi.clearAllMocks();
  clearCache();
  mockPrisma.playtimeSnapshot.findMany.mockResolvedValue([]);
  mockPrisma.playtimeSnapshot.groupBy.mockResolvedValue([]);
  mockPrisma.idleDismissal.findMany.mockResolvedValue([]);
  mockPrisma.achievementUnlock.findMany.mockResolvedValue([]);
  mockPrisma.ownedGame.findMany.mockResolvedValue([]);
  mockPrisma.game.findMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// TDD #14 — each aggregate hits Prisma once across two calls (warm cache)
// ---------------------------------------------------------------------------

describe('warm-cache: second call performs zero Prisma calls for the cached stage (TDD #14)', () => {
  it('getIdleFlags: snapshot scan runs once; dismissal fetch stays per-request', async () => {
    mockPrisma.playtimeSnapshot.findMany.mockResolvedValue(spikeRows(730, 800));
    mockPrisma.game.findMany.mockResolvedValue([{ appId: 730, name: 'CS2' }]);

    const first = await getIdleFlags(S1);
    const second = await getIdleFlags(S1);

    expect(first).toHaveLength(1);
    expect(second).toEqual(first);
    // Cached stage: the snapshot scan ran exactly once.
    expect(mockPrisma.playtimeSnapshot.findMany).toHaveBeenCalledTimes(1);
    // Per-request stage: dismissals (and the name lookup) run every call.
    expect(mockPrisma.idleDismissal.findMany).toHaveBeenCalledTimes(2);
  });

  it('getYearInReview: main scan, baseline groupBy, and unlock scan run once', async () => {
    await getYearInReview(S1, 2025);
    await getYearInReview(S1, 2025);

    expect(mockPrisma.playtimeSnapshot.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.playtimeSnapshot.groupBy).toHaveBeenCalledTimes(1);
    expect(mockPrisma.achievementUnlock.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.game.findMany).toHaveBeenCalledTimes(1);
  });

  it('getAvailableReviewYears: distinct-date scan runs once', async () => {
    mockPrisma.playtimeSnapshot.findMany.mockResolvedValue([
      { date: new Date('2025-06-15T00:00:00.000Z') },
    ]);
    expect(await getAvailableReviewYears(S1)).toEqual([2025]);
    expect(await getAvailableReviewYears(S1)).toEqual([2025]);
    expect(mockPrisma.playtimeSnapshot.findMany).toHaveBeenCalledTimes(1);
  });

  it('getCostPerHour: ownedGame + game reads run once', async () => {
    seedCostPerHourGame();
    const first = await getCostPerHour(S1);
    const second = await getCostPerHour(S1);
    expect(second.result).toEqual(first.result);
    expect(mockPrisma.ownedGame.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.game.findMany).toHaveBeenCalledTimes(1);
  });

  it('getGenreBreakdown: ownedGame + game reads run once', async () => {
    mockPrisma.ownedGame.findMany.mockResolvedValue([{ appId: 730, playtimeForever: 300 }]);
    mockPrisma.game.findMany.mockResolvedValue([{ appId: 730, genres: '["Action"]' }]);
    const first = await getGenreBreakdown(S1);
    const second = await getGenreBreakdown(S1);
    expect(second).toEqual(first);
    expect(mockPrisma.ownedGame.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.game.findMany).toHaveBeenCalledTimes(1);
  });

  it('getPlaytimeSnapshots (since-parameterized /history path): scan runs once', async () => {
    const since = new Date('2026-01-05T00:00:00.000Z');
    await getPlaytimeSnapshots(S1, { since });
    await getPlaytimeSnapshots(S1, { since });
    expect(mockPrisma.playtimeSnapshot.findMany).toHaveBeenCalledTimes(1);
  });

  it('getPlaytimeSnapshots WITHOUT since stays uncached (pinned: full-history path)', async () => {
    await getPlaytimeSnapshots(S1);
    await getPlaytimeSnapshots(S1);
    expect(mockPrisma.playtimeSnapshot.findMany).toHaveBeenCalledTimes(2);
    const keys = vi.mocked(cache).mock.calls.map((c) => c[0]);
    expect(keys.some((k) => k.includes('history-snapshots'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TDD #15 — idle dismissal visible immediately despite warm cache
// ---------------------------------------------------------------------------

describe('idle dismissal freshness (TDD #15)', () => {
  it('a dismissal is reflected on the immediately following call, snapshot stage still cached', async () => {
    const [fromRow, toRow] = spikeRows(730, 800);
    mockPrisma.playtimeSnapshot.findMany.mockResolvedValue([fromRow!, toRow!]);
    mockPrisma.game.findMany.mockResolvedValue([{ appId: 730, name: 'CS2' }]);

    const before = await getIdleFlags(S1);
    expect(before).toHaveLength(1);

    // User dismisses the flag — only the IdleDismissal table changes.
    mockPrisma.idleDismissal.findMany.mockResolvedValue([
      { appId: 730, fromDate: fromRow!.date, toDate: toRow!.date },
    ]);

    const after = await getIdleFlags(S1);
    expect(after).toEqual([]);
    // The cached snapshot→detectIdleSpikes stage was NOT re-run…
    expect(mockPrisma.playtimeSnapshot.findMany).toHaveBeenCalledTimes(1);
    // …but the dismissal filter ran outside the cache, per-request.
    expect(mockPrisma.idleDismissal.findMany).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// TDD #16 — key isolation: steamId, year, history window, idle threshold
// ---------------------------------------------------------------------------

describe('cache key isolation (TDD #16)', () => {
  it('different steamIds never share an entry', async () => {
    await getAvailableReviewYears(S1);
    await getAvailableReviewYears(S2);
    expect(mockPrisma.playtimeSnapshot.findMany).toHaveBeenCalledTimes(2);
    expect(mockPrisma.playtimeSnapshot.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: { steamId: S1 } }),
    );
    expect(mockPrisma.playtimeSnapshot.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: { steamId: S2 } }),
    );

    await getCostPerHour(S1);
    await getCostPerHour(S2);
    expect(mockPrisma.ownedGame.findMany).toHaveBeenCalledTimes(2);
  });

  it('different years never share an entry', async () => {
    await getYearInReview(S1, 2024);
    await getYearInReview(S1, 2025);
    // Two loader runs → two main scans (plus two baseline groupBys).
    expect(mockPrisma.playtimeSnapshot.findMany).toHaveBeenCalledTimes(2);
    expect(mockPrisma.playtimeSnapshot.groupBy).toHaveBeenCalledTimes(2);
  });

  it('different history windows never share an entry', async () => {
    await getPlaytimeSnapshots(S1, { since: new Date('2026-01-05T00:00:00.000Z') });
    await getPlaytimeSnapshots(S1, { since: new Date('2025-06-01T00:00:00.000Z') });
    expect(mockPrisma.playtimeSnapshot.findMany).toHaveBeenCalledTimes(2);
  });

  it('two idle thresholds → two loader runs with threshold-correct flags', async () => {
    // Single spike of 60 min: flagged at threshold 30 (60 > 30), NOT at 120.
    mockPrisma.playtimeSnapshot.findMany.mockResolvedValue(spikeRows(730, 60));
    mockPrisma.game.findMany.mockResolvedValue([{ appId: 730, name: 'CS2' }]);

    const low = await getIdleFlags(S1, 30);
    const high = await getIdleFlags(S1, 120);

    expect(low).toHaveLength(1);
    expect(low[0]!.deltaMinutes).toBe(60);
    expect(high).toEqual([]);
    expect(mockPrisma.playtimeSnapshot.findMany).toHaveBeenCalledTimes(2);
  });

  it('omitted vs explicit-default threshold share ONE entry (default resolved before keying)', async () => {
    mockPrisma.playtimeSnapshot.findMany.mockResolvedValue(spikeRows(730, 800));
    mockPrisma.game.findMany.mockResolvedValue([{ appId: 730, name: 'CS2' }]);

    const omitted = await getIdleFlags(S1);
    const explicit = await getIdleFlags(S1, DEFAULT_IDLE_THRESHOLD_MINUTES);

    expect(explicit).toEqual(omitted);
    expect(mockPrisma.playtimeSnapshot.findMany).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// TDD #17 — TTL.insightsAggregate exists and every wrap uses it
// ---------------------------------------------------------------------------

describe('TTL.insightsAggregate wiring (TDD #17)', () => {
  it('the TTL key exists and is a positive number of seconds', () => {
    // Type-level assertion: fails tsc if the key is missing from the TTL map.
    const ttl: number = TTL.insightsAggregate;
    expect(typeof ttl).toBe('number');
    expect(ttl).toBeGreaterThan(0);
  });

  it('every aggregate wrap calls cache() with TTL.insightsAggregate and its documented key shape', async () => {
    const since = new Date('2026-01-05T00:00:00.000Z');
    await getIdleFlags(S1);
    await getYearInReview(S1, 2025);
    await getAvailableReviewYears(S1);
    await getCostPerHour(S1);
    await getGenreBreakdown(S1);
    await getPlaytimeSnapshots(S1, { since });

    const calls = vi.mocked(cache).mock.calls;
    const expectedKeys = [
      `steam:insights-idle:${S1}:${DEFAULT_IDLE_THRESHOLD_MINUTES}`,
      `steam:insights-year-in-review:${S1}:2025`,
      `steam:insights-review-years:${S1}`,
      `steam:insights-cost-per-hour:${S1}`,
      `steam:insights-genres:${S1}`,
      // windowCode = epoch-ms of the (bucket-floored) window start.
      `steam:history-snapshots:${S1}:${since.getTime()}`,
    ];

    for (const key of expectedKeys) {
      const call = calls.find((c) => c[0] === key);
      expect(call, `expected a cache() call with key ${key}`).toBeDefined();
      expect(call![1]).toBe(TTL.insightsAggregate);
    }
  });
});

// ---------------------------------------------------------------------------
// Stale-while-revalidate preserved through the wrap (T5 acceptance)
// ---------------------------------------------------------------------------

describe('stale-while-revalidate is not bypassed by the wrap', () => {
  it('loader throw after expiry returns the prior value with stale: true', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T00:00:00.000Z'));
    seedCostPerHourGame();

    const first = await getCostPerHour(S1);
    expect(first.stale).toBe(false);
    expect(first.result.ranked).toHaveLength(1);

    // Expire the entry, then break the DB — the wrap must surface the prior
    // value with stale semantics per the existing cache() contract.
    vi.setSystemTime(new Date(Date.now() + (TTL.insightsAggregate + 1) * 1000));
    mockPrisma.ownedGame.findMany.mockRejectedValue(new Error('db down'));

    const second = await getCostPerHour(S1);
    expect(second.stale).toBe(true);
    expect(second.result).toEqual(first.result);
  });
});
