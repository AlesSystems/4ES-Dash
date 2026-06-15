/**
 * Unit tests for lib/steam/store-client.ts
 *
 * MSW intercepts all HTTP — no live requests.
 * STEAM_ID is provided per convention (tests/setup.ts loads .env.test).
 */

import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { getStoreMetadata, getStorePrice } from '@/lib/steam/store-client';
import { steamServer } from '../mocks/steam-server';

import appdetailsFixture from '../fixtures/steam/appdetails.json';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORE_APPDETAILS_URL = 'https://store.steampowered.com/api/appdetails';
const APP_ID = 620; // Portal 2 — matches the fixture

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Register a per-test handler that inspects query params to serve fixture data. */
function serveFixture(fixture: Record<string, unknown>, opts?: { priceOnly?: boolean }) {
  steamServer.use(
    http.get(STORE_APPDETAILS_URL, ({ request }) => {
      const url = new URL(request.url);
      const appids = url.searchParams.get('appids');
      const filters = url.searchParams.get('filters');

      if (opts?.priceOnly && filters !== 'price_overview') {
        // Unexpected path in price-only test — return 404 to fail fast
        return new HttpResponse(null, { status: 404 });
      }

      // Return only the key matching the requested appId (mirrors Steam behaviour)
      if (appids !== null && appids in fixture) {
        return HttpResponse.json({ [appids]: fixture[appids] });
      }
      return HttpResponse.json({});
    }),
  );
}

// ---------------------------------------------------------------------------
// getStoreMetadata — happy path
// ---------------------------------------------------------------------------

describe('getStoreMetadata – happy path', () => {
  it('maps genres and categories from fixture, returns available result', async () => {
    serveFixture(appdetailsFixture as Record<string, unknown>);

    const result = await getStoreMetadata(APP_ID);

    expect(result.available).toBe(true);
    if (!result.available) return; // type narrowing

    const meta = result.data;
    expect(meta.name).toBe('Portal 2');
    expect(meta.shortDescription).toBe('Use a portal gun to solve puzzles. With your friend.');
    expect(meta.headerImage).toContain('header.jpg');
    expect(meta.genres).toEqual(['Free to Play', 'Puzzle']);
    expect(meta.categories).toEqual(['Multi-player', 'Co-op', 'Steam Achievements']);
    expect(meta.developers).toEqual(['Valve']);
    expect(meta.publishers).toEqual(['Valve']);
    expect(meta.releaseDate).toBe('19 Apr, 2011');
    expect(meta.platforms).toEqual({ windows: true, mac: true, linux: true });
  });
});

// ---------------------------------------------------------------------------
// getStorePrice — paid game
// ---------------------------------------------------------------------------

describe('getStorePrice – paid game', () => {
  it('maps price_overview fields and returns available StorePrice', async () => {
    serveFixture(appdetailsFixture as Record<string, unknown>, { priceOnly: true });

    const result = await getStorePrice(APP_ID);

    expect(result.available).toBe(true);
    if (!result.available) return;

    const price = result.data;
    expect(price).not.toBeNull();
    if (price === null) return;

    expect(price.currency).toBe('USD');
    expect(price.initialCents).toBe(999);
    expect(price.finalCents).toBe(999);
    expect(price.discountPercent).toBe(0);
    expect(price.formatted).toBe('$9.99');
  });
});

// ---------------------------------------------------------------------------
// getStorePrice — free game (no price_overview)
// ---------------------------------------------------------------------------

describe('getStorePrice – free game', () => {
  it('returns available(null) when price_overview is absent', async () => {
    const freeGameFixture = {
      [APP_ID]: {
        success: true,
        data: {
          name: 'Dota 2',
          short_description: 'Free to play MOBA',
          header_image: 'https://cdn.akamai.steamstatic.com/steam/apps/570/header.jpg',
          genres: [{ id: '37', description: 'Free to Play' }],
          categories: [],
          developers: ['Valve'],
          publishers: ['Valve'],
          release_date: { coming_soon: false, date: '9 Jul, 2013' },
          platforms: { windows: true, mac: true, linux: true },
          // no price_overview
        },
      },
    };

    steamServer.use(http.get(STORE_APPDETAILS_URL, () => HttpResponse.json(freeGameFixture)));

    const result = await getStorePrice(APP_ID);

    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.data).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// success: false → unavailable
// ---------------------------------------------------------------------------

describe('getStoreMetadata – success:false', () => {
  it('returns unavailable("metadata-unavailable") when success is false', async () => {
    steamServer.use(
      http.get(STORE_APPDETAILS_URL, () => HttpResponse.json({ [APP_ID]: { success: false } })),
    );

    const result = await getStoreMetadata(APP_ID);

    expect(result.available).toBe(false);
    if (result.available) return;
    expect(result.reason).toBe('metadata-unavailable');
  });
});

// ---------------------------------------------------------------------------
// Non-200 HTTP response → unavailable
// ---------------------------------------------------------------------------

describe('getStoreMetadata – non-200 response', () => {
  it('returns unavailable("metadata-unavailable") on HTTP 500', async () => {
    steamServer.use(http.get(STORE_APPDETAILS_URL, () => new HttpResponse(null, { status: 500 })));

    const result = await getStoreMetadata(APP_ID);

    expect(result.available).toBe(false);
    if (result.available) return;
    expect(result.reason).toBe('metadata-unavailable');
  });
});

// ---------------------------------------------------------------------------
// Malformed JSON shape → unavailable
// ---------------------------------------------------------------------------

describe('getStoreMetadata – malformed response shape', () => {
  it('returns unavailable("metadata-unavailable") when response is not the expected object shape', async () => {
    steamServer.use(
      http.get(STORE_APPDETAILS_URL, () =>
        // A string at the top-level will fail RawAppDetailsResponse.parse() which
        // expects a Record<string, { success, data? }>. We send an array to
        // force the Zod schema mismatch path.
        HttpResponse.json([{ broken: true }]),
      ),
    );

    const result = await getStoreMetadata(APP_ID);

    expect(result.available).toBe(false);
    if (result.available) return;
    expect(result.reason).toBe('metadata-unavailable');
  });
});

// ---------------------------------------------------------------------------
// getStorePrice – non-200 HTTP response → unavailable
// ---------------------------------------------------------------------------

describe('getStorePrice – non-200 response', () => {
  it('returns unavailable("metadata-unavailable") on HTTP 403', async () => {
    steamServer.use(http.get(STORE_APPDETAILS_URL, () => new HttpResponse(null, { status: 403 })));

    const result = await getStorePrice(APP_ID);

    expect(result.available).toBe(false);
    if (result.available) return;
    expect(result.reason).toBe('metadata-unavailable');
  });
});
