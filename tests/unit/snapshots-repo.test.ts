/**
 * Unit tests for server/repositories/snapshots.ts — getPlaytimeSnapshots
 * windowing (Theme 1 / T4, DATA-6). Prisma is mocked via vi.hoisted — no I/O.
 *
 * getFirstSeenDates / getLibraryWithAcquisition keep full-history semantics and
 * are deliberately NOT exercised here (acquiredAt inference depends on the
 * unwindowed groupBy — see PLAN-theme-1-snapshot-reads.md T4 scope-out).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPlaytimeSnapshots } from '@/server/repositories/snapshots';
import { clearCache } from '@/server/cache';

const mockPrisma = vi.hoisted(() => ({
  playtimeSnapshot: { findMany: vi.fn() },
}));

vi.mock('@/server/db', () => ({ prisma: mockPrisma }));

const STEAM_ID = '76561198000000000';

beforeEach(() => {
  vi.clearAllMocks();
  // The since-parameterized path is cached (T5) — clear between cases so a
  // warm hit never breaks Prisma call-count expectations (plan: binding).
  clearCache();
  mockPrisma.playtimeSnapshot.findMany.mockResolvedValue([]);
});

describe('getPlaytimeSnapshots — windowed read (T4)', () => {
  it('passes date gte when since is provided (TDD #8)', async () => {
    const since = new Date('2025-07-07T00:00:00.000Z');
    await getPlaytimeSnapshots(STEAM_ID, { since });

    const call = mockPrisma.playtimeSnapshot.findMany.mock.calls[0]![0]!;
    expect(call.where).toEqual({ steamId: STEAM_ID, date: { gte: since } });
    // orderBy and select are preserved on the windowed path.
    expect(call.orderBy).toEqual({ date: 'asc' });
    expect(call.select).toEqual({ appId: true, date: true, playtimeForever: true });
  });

  it('without since is unchanged — where is steamId only (TDD #9, pinned regression)', async () => {
    await getPlaytimeSnapshots(STEAM_ID);

    const call = mockPrisma.playtimeSnapshot.findMany.mock.calls[0]![0]!;
    // Byte-identical to the pre-T4 behavior: no date bound sneaks in.
    expect(call.where).toEqual({ steamId: STEAM_ID });
    expect(call.orderBy).toEqual({ date: 'asc' });
    expect(call.select).toEqual({ appId: true, date: true, playtimeForever: true });
  });
});
