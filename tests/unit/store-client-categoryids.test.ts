/**
 * Unit tests for the `categoryIds` field added to StoreMetadata (issue #32).
 *
 * MSW intercepts all HTTP — no live requests.
 */

import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { getStoreMetadata } from '@/lib/steam/store-client';
import { steamServer } from '../mocks/steam-server';

const STORE_APPDETAILS_URL = 'https://store.steampowered.com/api/appdetails';
const APP_ID = 620;

// ---------------------------------------------------------------------------
// categoryIds — mixed string/numeric ids, non-numeric ids dropped
// ---------------------------------------------------------------------------

describe('getStoreMetadata – categoryIds', () => {
  it('maps string and numeric category ids to numbers', async () => {
    steamServer.use(
      http.get(STORE_APPDETAILS_URL, () =>
        HttpResponse.json({
          [APP_ID]: {
            success: true,
            data: {
              name: 'Portal 2',
              short_description: 'Portals.',
              header_image: 'https://example.com/header.jpg',
              categories: [
                { id: '1', description: 'Multi-player' }, // string id
                { id: 9, description: 'Co-op' }, // numeric id
              ],
              genres: [],
              developers: ['Valve'],
              publishers: ['Valve'],
              release_date: { coming_soon: false, date: '19 Apr, 2011' },
              platforms: { windows: true, mac: false, linux: false },
            },
          },
        }),
      ),
    );

    const result = await getStoreMetadata(APP_ID);

    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.data.categoryIds).toEqual([1, 9]);
  });

  it('drops non-numeric / garbage category ids and keeps valid ones', async () => {
    steamServer.use(
      http.get(STORE_APPDETAILS_URL, () =>
        HttpResponse.json({
          [APP_ID]: {
            success: true,
            data: {
              name: 'Test Game',
              short_description: 'desc',
              header_image: 'https://example.com/header.jpg',
              categories: [
                { id: 27, description: 'Cross-Platform Multiplayer' },
                { id: 'not-a-number', description: 'Garbage' }, // coerces to NaN → dropped
              ],
              genres: [],
              developers: [],
              publishers: [],
              release_date: { coming_soon: false, date: '' },
              platforms: { windows: false, mac: false, linux: false },
            },
          },
        }),
      ),
    );

    const result = await getStoreMetadata(APP_ID);

    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.data.categoryIds).toEqual([27]);
  });

  it('returns empty categoryIds when categories array is absent', async () => {
    steamServer.use(
      http.get(STORE_APPDETAILS_URL, () =>
        HttpResponse.json({
          [APP_ID]: {
            success: true,
            data: {
              name: 'Minimal Game',
              short_description: '',
              header_image: 'https://example.com/header.jpg',
              // categories intentionally omitted
              genres: [],
              developers: [],
              publishers: [],
              platforms: { windows: true, mac: false, linux: false },
            },
          },
        }),
      ),
    );

    const result = await getStoreMetadata(APP_ID);

    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.data.categoryIds).toEqual([]);
  });

  it('still populates categories (descriptions) alongside categoryIds', async () => {
    steamServer.use(
      http.get(STORE_APPDETAILS_URL, () =>
        HttpResponse.json({
          [APP_ID]: {
            success: true,
            data: {
              name: 'Portal 2',
              short_description: 'desc',
              header_image: 'https://example.com/header.jpg',
              categories: [
                { id: 1, description: 'Multi-player' },
                { id: 9, description: 'Co-op' },
                { id: 22, description: 'Steam Achievements' },
              ],
              genres: [],
              developers: ['Valve'],
              publishers: ['Valve'],
              release_date: { coming_soon: false, date: '19 Apr, 2011' },
              platforms: { windows: true, mac: true, linux: true },
            },
          },
        }),
      ),
    );

    const result = await getStoreMetadata(APP_ID);

    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.data.categories).toEqual(['Multi-player', 'Co-op', 'Steam Achievements']);
    expect(result.data.categoryIds).toEqual([1, 9, 22]);
  });
});
