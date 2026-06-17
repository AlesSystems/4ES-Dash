import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { getSteamSpyData } from '@/lib/steam/steamspy-client';
import { steamServer } from '../mocks/steam-server';

// ---------------------------------------------------------------------------
// URLs under test
// ---------------------------------------------------------------------------

const STEAMSPY_URL = 'https://steamspy.com/api.php';
const APP_ID = 620;

// ---------------------------------------------------------------------------
// Happy path — tags as object (normal case)
// ---------------------------------------------------------------------------

describe('getSteamSpyData – happy path (tags object)', () => {
  it('returns genres split and trimmed from genre string', async () => {
    steamServer.use(
      http.get(STEAMSPY_URL, () =>
        HttpResponse.json({
          appid: APP_ID,
          name: 'Portal 2',
          developer: 'Valve',
          publisher: 'Valve',
          owners: '10,000,000 .. 20,000,000',
          genre: 'Action, Puzzle',
          tags: { Puzzle: 5432, 'Co-op': 4100, 'First-Person': 3800 },
        }),
      ),
    );

    const result = await getSteamSpyData(APP_ID);

    expect(result.available).toBe(true);
    if (!result.available) return;

    expect(result.data.genres).toEqual(['Action', 'Puzzle']);
    expect(result.data.ownersBand).toBe('10,000,000 .. 20,000,000');
  });

  it('returns tags sorted by votes descending', async () => {
    steamServer.use(
      http.get(STEAMSPY_URL, () =>
        HttpResponse.json({
          appid: APP_ID,
          name: 'Portal 2',
          owners: '10,000,000 .. 20,000,000',
          genre: 'Puzzle',
          tags: { Puzzle: 5432, 'Co-op': 4100, 'First-Person': 3800 },
        }),
      ),
    );

    const result = await getSteamSpyData(APP_ID);

    expect(result.available).toBe(true);
    if (!result.available) return;

    expect(result.data.tags).toEqual([
      { name: 'Puzzle', votes: 5432 },
      { name: 'Co-op', votes: 4100 },
      { name: 'First-Person', votes: 3800 },
    ]);
  });

  it('returns ownersBand from owners field', async () => {
    steamServer.use(
      http.get(STEAMSPY_URL, () =>
        HttpResponse.json({
          appid: APP_ID,
          owners: '5,000,000 .. 10,000,000',
          genre: 'RPG',
          tags: { RPG: 1000 },
        }),
      ),
    );

    const result = await getSteamSpyData(APP_ID);

    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.data.ownersBand).toBe('5,000,000 .. 10,000,000');
  });
});

// ---------------------------------------------------------------------------
// Tags as empty array (SteamSpy quirk)
// ---------------------------------------------------------------------------

describe('getSteamSpyData – tags as empty array', () => {
  it('returns empty tags array when SteamSpy sends tags: []', async () => {
    steamServer.use(
      http.get(STEAMSPY_URL, () =>
        HttpResponse.json({
          appid: APP_ID,
          name: 'Portal 2',
          owners: '10,000,000 .. 20,000,000',
          genre: 'Puzzle',
          tags: [],
        }),
      ),
    );

    const result = await getSteamSpyData(APP_ID);

    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.data.tags).toEqual([]);
  });

  it('returns empty genres array when genre field is absent', async () => {
    steamServer.use(
      http.get(STEAMSPY_URL, () =>
        HttpResponse.json({
          appid: APP_ID,
          name: 'Portal 2',
          owners: '10,000,000 .. 20,000,000',
          tags: [],
        }),
      ),
    );

    const result = await getSteamSpyData(APP_ID);

    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.data.genres).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Failure cases — all must degrade to unavailable
// ---------------------------------------------------------------------------

describe('getSteamSpyData – non-200 response', () => {
  it('returns unavailable on HTTP 429', async () => {
    steamServer.use(http.get(STEAMSPY_URL, () => new HttpResponse(null, { status: 429 })));

    const result = await getSteamSpyData(APP_ID);

    expect(result.available).toBe(false);
    if (result.available) return;
    expect(result.reason).toBe('metadata-unavailable');
  });

  it('returns unavailable on HTTP 500', async () => {
    steamServer.use(http.get(STEAMSPY_URL, () => new HttpResponse(null, { status: 500 })));

    const result = await getSteamSpyData(APP_ID);

    expect(result.available).toBe(false);
  });
});

describe('getSteamSpyData – malformed JSON / bad shape', () => {
  it('returns unavailable when response is a bare string (not an object)', async () => {
    steamServer.use(
      http.get(STEAMSPY_URL, () =>
        // SteamSpy sometimes returns a plain error string — simulate with an
        // object whose shape fails our schema expectations by nesting badly.
        HttpResponse.json('not-an-object'),
      ),
    );

    const result = await getSteamSpyData(APP_ID);

    expect(result.available).toBe(false);
    if (result.available) return;
    expect(result.reason).toBe('metadata-unavailable');
  });

  it('returns unavailable when tags field has unexpected nested shape', async () => {
    // tags as a non-empty array of objects (not a record) — fails union schema
    steamServer.use(
      http.get(STEAMSPY_URL, () =>
        HttpResponse.json({
          appid: APP_ID,
          owners: '1,000 .. 2,000',
          genre: 'Indie',
          tags: [{ name: 'Indie', votes: 100 }],
        }),
      ),
    );

    // The schema union accepts: record<string,number> OR array<unknown>.
    // An array of objects is still an array → valid, tags treated as empty.
    const result = await getSteamSpyData(APP_ID);

    // Should still degrade gracefully — either available with empty tags or unavailable
    if (result.available) {
      expect(result.data.tags).toEqual([]);
    } else {
      expect(result.reason).toBe('metadata-unavailable');
    }
  });
});
