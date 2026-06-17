import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { getItadHistoricalLow } from '@/lib/steam/itad-client';
import { steamServer } from '../mocks/steam-server';

// ---------------------------------------------------------------------------
// URLs under test
// ---------------------------------------------------------------------------

const ITAD_BASE = 'https://api.isthereanydeal.com';
const LOOKUP_URL = `${ITAD_BASE}/games/lookup/v1`;
const STORELOW_URL = `${ITAD_BASE}/games/storelow/v2`;

const APP_ID = 620;
const GAME_UUID = '018d937f-590c-714b-8b46-4dc799061a9a';
const API_KEY = 'test-itad-api-key-12345';

// ---------------------------------------------------------------------------
// Helper fixtures
// ---------------------------------------------------------------------------

const FOUND_LOOKUP = {
  found: true,
  game: {
    id: GAME_UUID,
    slug: 'portal-2',
    title: 'Portal 2',
    type: 'game',
    mature: false,
    assets: {},
  },
};

const STORELOW_RESPONSE = [
  {
    id: GAME_UUID,
    storelow: [
      {
        shop: { id: 61, name: 'Humble Store' },
        price: { amount: 2.49, amountInt: 249, currency: 'USD' },
        regular: { amount: 9.99, amountInt: 999, currency: 'USD' },
        cut: 75,
        timestamp: '2023-11-22T18:00:00Z',
      },
      {
        shop: { id: 1, name: 'Steam' },
        price: { amount: 1.99, amountInt: 199, currency: 'USD' },
        regular: { amount: 9.99, amountInt: 999, currency: 'USD' },
        cut: 80,
        timestamp: '2022-06-30T17:00:00Z',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe('getItadHistoricalLow – happy path', () => {
  it('resolves game via lookup then returns the lowest price across shops', async () => {
    steamServer.use(
      http.get(LOOKUP_URL, () => HttpResponse.json(FOUND_LOOKUP)),
      http.post(STORELOW_URL, () => HttpResponse.json(STORELOW_RESPONSE)),
    );

    const result = await getItadHistoricalLow(APP_ID, API_KEY);

    expect(result.available).toBe(true);
    if (!result.available) return;

    // Steam shop has lower price: $1.99 = 199 cents
    expect(result.data.lowestCents).toBe(199);
    expect(result.data.currency).toBe('USD');
    expect(result.data.shop).toBe('Steam');
  });

  it('uses amountInt directly (minor units, no rounding needed)', async () => {
    steamServer.use(
      http.get(LOOKUP_URL, () => HttpResponse.json(FOUND_LOOKUP)),
      http.post(STORELOW_URL, () =>
        HttpResponse.json([
          {
            id: GAME_UUID,
            storelow: [
              {
                shop: { id: 1, name: 'Steam' },
                price: { amount: 0.99, amountInt: 99, currency: 'USD' },
                regular: { amount: 9.99, amountInt: 999, currency: 'USD' },
                cut: 90,
                timestamp: '2021-01-01T00:00:00Z',
              },
            ],
          },
        ]),
      ),
    );

    const result = await getItadHistoricalLow(APP_ID, API_KEY);

    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.data.lowestCents).toBe(99);
  });

  it('falls back to Math.round(amount * 100) when amountInt is absent', async () => {
    steamServer.use(
      http.get(LOOKUP_URL, () => HttpResponse.json(FOUND_LOOKUP)),
      http.post(STORELOW_URL, () =>
        HttpResponse.json([
          {
            id: GAME_UUID,
            storelow: [
              {
                shop: { id: 1, name: 'Steam' },
                price: { amount: 3.49, currency: 'USD' },
                regular: { amount: 9.99, currency: 'USD' },
                cut: 65,
                timestamp: '2021-01-01T00:00:00Z',
              },
            ],
          },
        ]),
      ),
    );

    const result = await getItadHistoricalLow(APP_ID, API_KEY);

    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.data.lowestCents).toBe(349);
  });

  it('sends the API key in the lookup request URL', async () => {
    let capturedKey: string | null = null;

    steamServer.use(
      http.get(LOOKUP_URL, ({ request }) => {
        const url = new URL(request.url);
        capturedKey = url.searchParams.get('key');
        return HttpResponse.json(FOUND_LOOKUP);
      }),
      http.post(STORELOW_URL, () => HttpResponse.json(STORELOW_RESPONSE)),
    );

    await getItadHistoricalLow(APP_ID, API_KEY);

    expect(capturedKey).toBe(API_KEY);
  });

  it('sends the API key in the storelow request URL', async () => {
    let capturedKey: string | null = null;

    steamServer.use(
      http.get(LOOKUP_URL, () => HttpResponse.json(FOUND_LOOKUP)),
      http.post(STORELOW_URL, ({ request }) => {
        const url = new URL(request.url);
        capturedKey = url.searchParams.get('key');
        return HttpResponse.json(STORELOW_RESPONSE);
      }),
    );

    await getItadHistoricalLow(APP_ID, API_KEY);

    expect(capturedKey).toBe(API_KEY);
  });
});

// ---------------------------------------------------------------------------
// Not-found case
// ---------------------------------------------------------------------------

describe('getItadHistoricalLow – game not found in ITAD', () => {
  it('returns unavailable when lookup found:false', async () => {
    steamServer.use(http.get(LOOKUP_URL, () => HttpResponse.json({ found: false })));

    const result = await getItadHistoricalLow(APP_ID, API_KEY);

    expect(result.available).toBe(false);
    if (result.available) return;
    expect(result.reason).toBe('metadata-unavailable');
  });
});

// ---------------------------------------------------------------------------
// Non-200 responses
// ---------------------------------------------------------------------------

describe('getItadHistoricalLow – non-200 responses', () => {
  it('returns unavailable when lookup returns HTTP 401', async () => {
    steamServer.use(http.get(LOOKUP_URL, () => new HttpResponse(null, { status: 401 })));

    const result = await getItadHistoricalLow(APP_ID, API_KEY);

    expect(result.available).toBe(false);
    if (result.available) return;
    expect(result.reason).toBe('metadata-unavailable');
  });

  it('returns unavailable when lookup returns HTTP 500', async () => {
    steamServer.use(http.get(LOOKUP_URL, () => new HttpResponse(null, { status: 500 })));

    const result = await getItadHistoricalLow(APP_ID, API_KEY);

    expect(result.available).toBe(false);
  });

  it('returns unavailable when storelow returns HTTP 429', async () => {
    steamServer.use(
      http.get(LOOKUP_URL, () => HttpResponse.json(FOUND_LOOKUP)),
      http.post(STORELOW_URL, () => new HttpResponse(null, { status: 429 })),
    );

    const result = await getItadHistoricalLow(APP_ID, API_KEY);

    expect(result.available).toBe(false);
    if (result.available) return;
    expect(result.reason).toBe('metadata-unavailable');
  });
});

// ---------------------------------------------------------------------------
// Bad shape / schema mismatch
// ---------------------------------------------------------------------------

describe('getItadHistoricalLow – bad shape', () => {
  it('returns unavailable when lookup response is not an object', async () => {
    steamServer.use(http.get(LOOKUP_URL, () => HttpResponse.json('not-an-object')));

    const result = await getItadHistoricalLow(APP_ID, API_KEY);

    expect(result.available).toBe(false);
    if (result.available) return;
    expect(result.reason).toBe('metadata-unavailable');
  });

  it('returns unavailable when storelow response is not an array', async () => {
    steamServer.use(
      http.get(LOOKUP_URL, () => HttpResponse.json(FOUND_LOOKUP)),
      http.post(STORELOW_URL, () => HttpResponse.json({ error: 'unexpected' })),
    );

    const result = await getItadHistoricalLow(APP_ID, API_KEY);

    expect(result.available).toBe(false);
    if (result.available) return;
    expect(result.reason).toBe('metadata-unavailable');
  });

  it('returns unavailable when storelow response is empty array', async () => {
    steamServer.use(
      http.get(LOOKUP_URL, () => HttpResponse.json(FOUND_LOOKUP)),
      http.post(STORELOW_URL, () => HttpResponse.json([])),
    );

    const result = await getItadHistoricalLow(APP_ID, API_KEY);

    expect(result.available).toBe(false);
    if (result.available) return;
    expect(result.reason).toBe('metadata-unavailable');
  });

  it('returns unavailable when storelow entries have no price', async () => {
    steamServer.use(
      http.get(LOOKUP_URL, () => HttpResponse.json(FOUND_LOOKUP)),
      http.post(STORELOW_URL, () =>
        HttpResponse.json([
          {
            id: GAME_UUID,
            storelow: [{ shop: { id: 1, name: 'Steam' } }],
          },
        ]),
      ),
    );

    const result = await getItadHistoricalLow(APP_ID, API_KEY);

    expect(result.available).toBe(false);
    if (result.available) return;
    expect(result.reason).toBe('metadata-unavailable');
  });
});
