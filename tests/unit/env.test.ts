import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const KEYS = ['STEAM_API_KEY', 'STEAM_ID', 'DATABASE_URL', 'CRON_SECRET'] as const;

describe('getEnv', () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    vi.resetModules(); // drop the memoized cache so each test re-parses
    saved = {};
    for (const key of KEYS) saved[key] = process.env[key];
    process.env.STEAM_API_KEY = 'unit_test_key';
    process.env.STEAM_ID = '76561190000000000';
    process.env.DATABASE_URL = 'file:./unit.db';
  });

  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('parses a valid environment', async () => {
    const { getEnv } = await import('@/server/env');
    const env = getEnv();
    expect(env.STEAM_ID).toBe('76561190000000000');
    expect(env.DATABASE_URL).toBe('file:./unit.db');
  });

  it('throws a clear error when STEAM_API_KEY is missing', async () => {
    delete process.env.STEAM_API_KEY;
    const { getEnv } = await import('@/server/env');
    expect(() => getEnv()).toThrow(/STEAM_API_KEY/);
  });

  it('treats STEAM_ID as optional (dev/featured fallback) — does not throw when missing', async () => {
    // Since Phase 6 the session user is "the user"; STEAM_ID is only a
    // dev/featured-profile fallback, so its absence must NOT crash boot.
    delete process.env.STEAM_ID;
    const { getEnv } = await import('@/server/env');
    expect(() => getEnv()).not.toThrow();
    expect(getEnv().STEAM_ID).toBeUndefined();
  });

  it('throws when STEAM_ID is not a 17-digit string', async () => {
    process.env.STEAM_ID = '12345';
    const { getEnv } = await import('@/server/env');
    expect(() => getEnv()).toThrow(/STEAM_ID/);
  });
});
