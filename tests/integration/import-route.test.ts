/**
 * Integration tests for POST /api/import.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Import is a state-changing write scoped to the authenticated session user.
// Mock getSessionUser so tests control who (if anyone) is signed in.
let mockSession: { steamId: string } | null = { steamId: '76561198000000000' };
vi.mock('@/server/auth', () => ({
  getSessionUser: () => Promise.resolve(mockSession),
}));

import { POST } from '@/app/api/import/route';
import { prisma } from '@/server/db';

async function resetDb(): Promise<void> {
  await prisma.manualGameData.deleteMany();
}

function postJson(body: unknown): Promise<Response> {
  return Promise.resolve(
    POST(
      new Request('http://localhost/api/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
      undefined as never,
    ),
  );
}

function postCsv(text: string): Promise<Response> {
  return Promise.resolve(
    POST(
      new Request('http://localhost/api/import', {
        method: 'POST',
        headers: { 'content-type': 'text/csv' },
        body: text,
      }),
      undefined as never,
    ),
  );
}

beforeEach(async () => {
  await resetDb();
  // Default: an authenticated user. The auth test overrides this to null.
  mockSession = { steamId: '76561198000000000' };
});

describe('POST /api/import — auth (session scoping)', () => {
  it('returns 401 and writes nothing when no session (anonymous POST cannot mutate any account)', async () => {
    mockSession = null;
    const res = await postJson({ rows: [{ appId: 730, pricePaidCents: 2499, currency: 'USD' }] });
    expect(res.status).toBe(401);
    const count = await prisma.manualGameData.count();
    expect(count).toBe(0);
  });

  it('scopes the import to the SESSION user, not a global/featured owner', async () => {
    mockSession = { steamId: '76561198000000099' };
    const res = await postJson({ rows: [{ appId: 730, pricePaidCents: 2499, currency: 'USD' }] });
    expect(res.status).toBe(200);
    const rows = await prisma.manualGameData.findMany({ where: { appId: 730 } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.steamId).toBe('76561198000000099');
  });
});

describe('POST /api/import — validation', () => {
  it('returns 400 when rows is empty array', async () => {
    const res = await postJson({ rows: [] });
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(typeof body['type']).toBe('string');
  });

  it('returns 400 when appId is not a positive int', async () => {
    const res = await postJson({ rows: [{ appId: -1 }] });
    expect(res.status).toBe(400);
  });

  it('returns 400 when body is completely invalid', async () => {
    const res = await postJson({ invalid: true });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/import — happy path JSON', () => {
  it('returns 200 with imported count', async () => {
    const res = await postJson({ rows: [{ appId: 730, pricePaidCents: 2499, currency: 'USD' }] });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { imported: number };
    expect(body.imported).toBe(1);
  });

  it('upserts are idempotent: second call does not double-count', async () => {
    const row = { appId: 730, pricePaidCents: 1999, currency: 'EUR' };
    await postJson({ rows: [row] });
    const res2 = await postJson({ rows: [row] });
    expect(res2.status).toBe(200);
    const count = await prisma.manualGameData.count({ where: { appId: 730 } });
    expect(count).toBe(1);
  });
});

describe('POST /api/import — CSV path', () => {
  it('accepts CSV and returns 200', async () => {
    const csv = 'appId,pricePaidCents,currency,acquiredAt\n730,2499,USD,\n570,,, ';
    const res = await postCsv(csv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { imported: number };
    expect(body.imported).toBe(2);
  });
});
