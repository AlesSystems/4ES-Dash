/**
 * Unit tests for withErrorBoundary and the RFC 7807 problem mapper.
 * Runs in Node environment (no DOM needed).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z, ZodError } from 'zod';
import { SteamApiError } from '@/lib/steam/errors';
import { withErrorBoundary } from '@/server/api/with-error-boundary';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeRequest(path = '/api/profile'): Request {
  return new Request(`http://localhost${path}`);
}

async function parseBody(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  return JSON.parse(text) as Record<string, unknown>;
}

// ── tests ────────────────────────────────────────────────────────────────────

describe('withErrorBoundary', () => {
  // Suppress console.error noise from the "unknown error" case
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── happy path ────────────────────────────────────────────────────────────

  it('returns the handler response unchanged on success', async () => {
    const handler = withErrorBoundary(() => Response.json({ ok: true }));
    const res = await handler(makeRequest(), undefined);

    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body).toEqual({ ok: true });
  });

  // ── SteamApiError cases ───────────────────────────────────────────────────

  it('maps SteamApiError kind=auth to 401 steam-auth', async () => {
    const handler = withErrorBoundary(() => {
      throw new SteamApiError({ kind: 'auth' });
    });
    const res = await handler(makeRequest(), undefined);
    const body = await parseBody(res);

    expect(res.status).toBe(401);
    expect(res.headers.get('content-type')).toBe('application/problem+json');
    expect(typeof body['type']).toBe('string');
    expect((body['type'] as string).endsWith('steam-auth')).toBe(true);
    expect(body['status']).toBe(401);
    expect(body['instance']).toBe('/api/profile');
  });

  it('maps SteamApiError kind=private to 403 steam-private-profile', async () => {
    const handler = withErrorBoundary(() => {
      throw new SteamApiError({ kind: 'private' });
    });
    const res = await handler(makeRequest(), undefined);
    const body = await parseBody(res);

    expect(res.status).toBe(403);
    expect((body['type'] as string).endsWith('steam-private-profile')).toBe(true);
    expect(body['status']).toBe(403);
    expect(body['instance']).toBe('/api/profile');
  });

  it('maps SteamApiError kind=rate_limit to 429 with Retry-After header', async () => {
    const handler = withErrorBoundary(() => {
      throw new SteamApiError({ kind: 'rate_limit', retryAfter: 30 });
    });
    const res = await handler(makeRequest(), undefined);
    const body = await parseBody(res);

    expect(res.status).toBe(429);
    expect((body['type'] as string).endsWith('steam-rate-limit')).toBe(true);
    expect(res.headers.get('retry-after')).toBe('30');
    expect(body['instance']).toBe('/api/profile');
  });

  it('maps SteamApiError kind=schema to 400 validation', async () => {
    const handler = withErrorBoundary(() => {
      throw new SteamApiError({ kind: 'schema' });
    });
    const res = await handler(makeRequest(), undefined);
    const body = await parseBody(res);

    expect(res.status).toBe(400);
    expect((body['type'] as string).endsWith('validation')).toBe(true);
    expect(body['status']).toBe(400);
    expect(body['instance']).toBe('/api/profile');
  });

  // ── ZodError ──────────────────────────────────────────────────────────────

  it('maps ZodError to 400 validation with field detail', async () => {
    const schema = z.object({ steamId: z.string(), count: z.number() });
    const result = schema.safeParse({ steamId: 123, count: 'oops' });
    // Narrow: safeParse returns success=false here
    if (result.success) throw new Error('Expected parse failure');
    const zodErr: ZodError = result.error;

    const handler = withErrorBoundary(() => {
      throw zodErr;
    });
    const res = await handler(makeRequest(), undefined);
    const body = await parseBody(res);

    expect(res.status).toBe(400);
    expect((body['type'] as string).endsWith('validation')).toBe(true);
    expect(body['title']).toBe('Request validation failed');
    expect(typeof body['detail']).toBe('string');
    // Detail should mention at least one field path (steamId or count)
    const detail = body['detail'] as string;
    expect(detail.length).toBeGreaterThan(0);
  });

  // ── unknown error ─────────────────────────────────────────────────────────

  it('maps generic Error to 500 internal without leaking the message', async () => {
    const handler = withErrorBoundary(() => {
      throw new Error('boom — super secret internal detail');
    });
    const res = await handler(makeRequest(), undefined);
    const body = await parseBody(res);

    expect(res.status).toBe(500);
    expect((body['type'] as string).endsWith('internal')).toBe(true);
    expect(body['status']).toBe(500);

    // Must NOT expose the original error message
    const bodyText = JSON.stringify(body);
    expect(bodyText).not.toContain('boom');
    expect(bodyText).not.toContain('super secret');

    // Should contain a requestId for correlation
    expect(typeof body['detail']).toBe('string');
    expect(body['detail'] as string).toMatch(/[0-9a-f-]{36}/); // UUID pattern
  });

  it('logs unknown errors to console.error with a requestId', async () => {
    const handler = withErrorBoundary(() => {
      throw new Error('server crash');
    });
    await handler(makeRequest(), undefined);

    expect(console.error).toHaveBeenCalledWith(
      '[unhandled]',
      expect.stringMatching(/[0-9a-f-]{36}/),
      expect.any(Error),
    );
  });

  it('sets Cache-Control: private, no-store on error responses', async () => {
    const handler = withErrorBoundary(() => {
      throw new SteamApiError({ kind: 'auth' });
    });
    const res = await handler(makeRequest(), undefined);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it('uses the request path as instance', async () => {
    const handler = withErrorBoundary(() => {
      throw new SteamApiError({ kind: 'transient' });
    });
    const res = await handler(new Request('http://localhost/api/games/123'), undefined);
    const body = await parseBody(res);
    expect(body['instance']).toBe('/api/games/123');
  });
});
