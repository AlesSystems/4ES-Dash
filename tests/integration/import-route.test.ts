/**
 * Integration tests for POST /api/import.
 */
import { describe, it, expect, beforeEach } from 'vitest';
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
