import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Cron route auth (#86): the snapshot route must accept BOTH Vercel Cron's
 * `Authorization: Bearer <CRON_SECRET>` (GET) and the legacy `x-cron-secret`
 * header, and reject everything else with 401 — before the job runs.
 */

const CRON_SECRET = 'test_placeholder_secret';

// Keep the job a no-op so the test isolates the auth gate (and never hits Steam/DB).
const mockRunSnapshot = vi.hoisted(() => vi.fn(async () => ({ ok: true })));
vi.mock('@/server/jobs', () => ({ runSnapshot: mockRunSnapshot }));
vi.mock('@/server/env', () => ({ getEnv: () => ({ CRON_SECRET }) }));

import { GET, POST } from '@/app/api/cron/snapshot/route';

const URL_STR = 'https://app.example.com/api/cron/snapshot';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('cron snapshot auth', () => {
  it('GET with a valid Authorization: Bearer (Vercel Cron) → 200 and runs the job', async () => {
    const res = await GET(
      new Request(URL_STR, { headers: { authorization: `Bearer ${CRON_SECRET}` } }),
    );
    expect(res.status).toBe(200);
    expect(mockRunSnapshot).toHaveBeenCalledTimes(1);
  });

  it('POST with a valid x-cron-secret (legacy/manual) → 200 and runs the job', async () => {
    const res = await POST(
      new Request(URL_STR, { method: 'POST', headers: { 'x-cron-secret': CRON_SECRET } }),
    );
    expect(res.status).toBe(200);
    expect(mockRunSnapshot).toHaveBeenCalledTimes(1);
  });

  it('GET with a valid x-cron-secret also works (method-agnostic auth)', async () => {
    const res = await GET(new Request(URL_STR, { headers: { 'x-cron-secret': CRON_SECRET } }));
    expect(res.status).toBe(200);
  });

  it('rejects a wrong Bearer token with 401 and does not run the job', async () => {
    const res = await GET(new Request(URL_STR, { headers: { authorization: 'Bearer nope' } }));
    expect(res.status).toBe(401);
    expect(mockRunSnapshot).not.toHaveBeenCalled();
  });

  it('rejects a wrong x-cron-secret with 401', async () => {
    const res = await POST(
      new Request(URL_STR, { method: 'POST', headers: { 'x-cron-secret': 'wrong' } }),
    );
    expect(res.status).toBe(401);
    expect(mockRunSnapshot).not.toHaveBeenCalled();
  });

  it('rejects a request with no credentials with 401', async () => {
    const res = await GET(new Request(URL_STR));
    expect(res.status).toBe(401);
    expect(mockRunSnapshot).not.toHaveBeenCalled();
  });
});
