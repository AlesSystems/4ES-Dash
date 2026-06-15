import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { isSteamApiError } from '@/lib/steam/errors';
import { getSteamLevel } from '@/lib/steam/level';
import { steamServer } from '../mocks/steam-server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STEAM_ID = '76561198000000000';
const STEAM_LEVEL_URL = 'https://api.steampowered.com/IPlayerService/GetSteamLevel/v1/';

// ---------------------------------------------------------------------------
// Happy path — player_level present
// ---------------------------------------------------------------------------

describe('getSteamLevel – happy path', () => {
  it('returns the numeric player_level when present in response', async () => {
    steamServer.use(
      http.get(STEAM_LEVEL_URL, () => HttpResponse.json({ response: { player_level: 42 } })),
    );

    const level = await getSteamLevel(STEAM_ID);
    expect(level).toBe(42);
  });

  it('returns 0 when player_level is 0 (valid level)', async () => {
    steamServer.use(
      http.get(STEAM_LEVEL_URL, () => HttpResponse.json({ response: { player_level: 0 } })),
    );

    const level = await getSteamLevel(STEAM_ID);
    expect(level).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Private / missing player_level → null
// ---------------------------------------------------------------------------

describe('getSteamLevel – private / missing level', () => {
  it('returns null when player_level is absent (private profile)', async () => {
    steamServer.use(http.get(STEAM_LEVEL_URL, () => HttpResponse.json({ response: {} })));

    const level = await getSteamLevel(STEAM_ID);
    expect(level).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Transient (5xx) + retry exhaustion
// ---------------------------------------------------------------------------

describe('getSteamLevel – transient / 5xx', () => {
  it('retries then throws kind:transient after 4 attempts (1 initial + 3 retries)', async () => {
    let callCount = 0;
    steamServer.use(
      http.get(STEAM_LEVEL_URL, () => {
        callCount++;
        return new HttpResponse(null, { status: 500 });
      }),
    );

    vi.useFakeTimers();
    try {
      const promise = getSteamLevel(STEAM_ID);
      const assertion = expect(promise).rejects.toSatisfy(
        (err: unknown) => isSteamApiError(err) && err.kind === 'transient',
      );
      await vi.runAllTimersAsync();
      await assertion;
    } finally {
      vi.useRealTimers();
    }

    expect(callCount).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Auth (401) — must NOT retry
// ---------------------------------------------------------------------------

describe('getSteamLevel – auth error', () => {
  it('throws kind:auth and does not retry on 401', async () => {
    let callCount = 0;
    steamServer.use(
      http.get(STEAM_LEVEL_URL, () => {
        callCount++;
        return new HttpResponse(null, { status: 401 });
      }),
    );

    await expect(getSteamLevel(STEAM_ID)).rejects.toSatisfy(
      (err: unknown) => isSteamApiError(err) && err.kind === 'auth',
    );

    expect(callCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Rate limit (429) — must NOT retry
// ---------------------------------------------------------------------------

describe('getSteamLevel – rate limit', () => {
  it('throws kind:rate_limit and does not retry on 429', async () => {
    let callCount = 0;
    steamServer.use(
      http.get(STEAM_LEVEL_URL, () => {
        callCount++;
        return new HttpResponse(null, { status: 429, headers: { 'Retry-After': '30' } });
      }),
    );

    await expect(getSteamLevel(STEAM_ID)).rejects.toSatisfy(
      (err: unknown) => isSteamApiError(err) && err.kind === 'rate_limit',
    );

    expect(callCount).toBe(1);
  });
});
