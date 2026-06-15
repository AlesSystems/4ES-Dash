/**
 * Steam Store API client (T2 — undocumented, best-effort).
 *
 * Talks to store.steampowered.com/api, NOT api.steampowered.com.
 * Rules (docs/STEAM_DATA_SOURCES.md §Undocumented Store API — usage rules):
 *   - NEVER sends STEAM_API_KEY.
 *   - Sends a descriptive User-Agent header.
 *   - Rate-limited with steamLimiter.acquire() before each fetch.
 *   - Single attempt — Store API is best-effort; no withRetry.
 *   - All failures (network, non-200, success:false, bad shape) degrade to
 *     Availability<T> { available: false, reason: 'metadata-unavailable' }.
 *     They are never thrown to callers.
 */

import { z } from 'zod';
import { available, unavailable, type Availability } from '@/lib/result';
import { steamLimiter } from './limiter';

// ---------------------------------------------------------------------------
// Domain types (exported for consumers)
// ---------------------------------------------------------------------------

export interface StoreMetadata {
  name: string;
  shortDescription: string;
  headerImage: string;
  genres: string[];
  categories: string[];
  developers: string[];
  publishers: string[];
  releaseDate: string | null;
  platforms: {
    windows: boolean;
    mac: boolean;
    linux: boolean;
  };
}

/**
 * null = free game (no price_overview in the Store API response).
 */
export type StorePrice = {
  currency: string;
  initialCents: number;
  finalCents: number;
  discountPercent: number;
  formatted: string;
} | null;

// ---------------------------------------------------------------------------
// Zod schemas — lenient: only assert what we read
// ---------------------------------------------------------------------------

const RawGenre = z.object({
  id: z.union([z.string(), z.number()]),
  description: z.string(),
});

const RawCategory = z.object({
  id: z.union([z.string(), z.number()]),
  description: z.string(),
});

const RawPriceOverview = z.object({
  currency: z.string(),
  initial: z.number(),
  final: z.number(),
  discount_percent: z.number(),
  final_formatted: z.string(),
});

const RawPlatforms = z.object({
  windows: z.boolean().optional(),
  mac: z.boolean().optional(),
  linux: z.boolean().optional(),
});

const RawReleaseDate = z.object({
  coming_soon: z.boolean().optional(),
  date: z.string().optional(),
});

const RawAppData = z.object({
  name: z.string().optional(),
  short_description: z.string().optional(),
  header_image: z.string().optional(),
  genres: z.array(RawGenre).optional(),
  categories: z.array(RawCategory).optional(),
  developers: z.array(z.string()).optional(),
  publishers: z.array(z.string()).optional(),
  price_overview: RawPriceOverview.optional(),
  release_date: RawReleaseDate.optional(),
  platforms: RawPlatforms.optional(),
});

/** The outer envelope: `{ "<appId>": { success, data? } }` */
const RawAppDetailsEntry = z.object({
  success: z.boolean(),
  data: RawAppData.optional(),
});

// We parse the whole top-level object as a record and then read the key we care about.
const RawAppDetailsResponse = z.record(z.string(), RawAppDetailsEntry);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORE_BASE_URL = 'https://store.steampowered.com/api/appdetails';
const USER_AGENT = '4ES-Dash/0.0.0 (+https://github.com/AlesSystems/4ES-Dash)';

// ---------------------------------------------------------------------------
// Internal fetch helper (no API key, custom User-Agent)
// ---------------------------------------------------------------------------

async function fetchStoreJson(url: string): Promise<unknown> {
  // A network/DNS rejection propagates to fetchEntry, which maps it to null.
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!res.ok) {
    throw new Error(`Store API responded with HTTP ${res.status}`);
  }

  return res.json() as Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Internal shared fetch+parse
// ---------------------------------------------------------------------------

/**
 * Fetches appdetails for `appId`, returns the parsed entry or null on any
 * failure (network, non-200, bad shape, success:false).
 */
async function fetchEntry(
  appId: number,
  extraParams?: string,
): Promise<z.infer<typeof RawAppDetailsEntry> | null> {
  const params = `appids=${appId}&l=english&cc=us${extraParams !== undefined ? `&${extraParams}` : ''}`;
  const url = `${STORE_BASE_URL}?${params}`;

  await steamLimiter.acquire();

  let raw: unknown;
  try {
    raw = await fetchStoreJson(url);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[store-client] fetch failed for appId=%d: %o', appId, err);
    return null;
  }

  // Parse outer envelope
  let parsed: z.infer<typeof RawAppDetailsResponse>;
  try {
    parsed = RawAppDetailsResponse.parse(raw);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[store-client] schema mismatch for appId=%d: %o', appId, err);
    return null;
  }

  const entry = parsed[String(appId)];
  if (entry === undefined) {
    // eslint-disable-next-line no-console
    console.warn('[store-client] appId=%d missing from response keys', appId);
    return null;
  }

  if (!entry.success) {
    // eslint-disable-next-line no-console
    console.warn('[store-client] success:false for appId=%d', appId);
    return null;
  }

  return entry;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns game metadata from the Store API for `appId`.
 * Degrades to `unavailable('metadata-unavailable')` on any failure; never throws.
 */
export async function getStoreMetadata(appId: number): Promise<Availability<StoreMetadata>> {
  const entry = await fetchEntry(appId);

  if (entry === null || entry.data === undefined) {
    return unavailable('metadata-unavailable');
  }

  const { data } = entry;

  const metadata: StoreMetadata = {
    name: data.name ?? '',
    shortDescription: data.short_description ?? '',
    headerImage: data.header_image ?? '',
    genres: (data.genres ?? []).map((g) => g.description),
    categories: (data.categories ?? []).map((c) => c.description),
    developers: data.developers ?? [],
    publishers: data.publishers ?? [],
    releaseDate: data.release_date?.date ?? null,
    platforms: {
      windows: data.platforms?.windows ?? false,
      mac: data.platforms?.mac ?? false,
      linux: data.platforms?.linux ?? false,
    },
  };

  return available(metadata);
}

/**
 * Returns the current store price for `appId`.
 * Returns `available(null)` for free games (no price_overview).
 * Degrades to `unavailable('metadata-unavailable')` on any fetch/parse failure.
 */
export async function getStorePrice(appId: number): Promise<Availability<StorePrice>> {
  const entry = await fetchEntry(appId, 'filters=price_overview');

  if (entry === null) {
    return unavailable('metadata-unavailable');
  }

  // success:true but no data or no price_overview → free game
  if (entry.data === undefined || entry.data.price_overview === undefined) {
    return available(null);
  }

  const po = entry.data.price_overview;

  const price: StorePrice = {
    currency: po.currency,
    initialCents: po.initial,
    finalCents: po.final,
    discountPercent: po.discount_percent,
    formatted: po.final_formatted,
  };

  return available(price);
}
