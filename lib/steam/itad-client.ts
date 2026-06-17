/**
 * IsThereAnyDeal (ITAD) enrichment client (T2 — free opt-in, best-effort).
 *
 * VERIFIED against the IsThereAnyDeal OpenAPI spec at
 *   https://raw.githubusercontent.com/IsThereAnyDeal/API/master/dist/openapi.yaml
 * (verified 2026-06-17 via WebFetch):
 *
 *   Step 1 — Lookup game by Steam appid:
 *     GET https://api.isthereanydeal.com/games/lookup/v1?key=<KEY>&appid=<APPID>
 *     Response: { found: boolean, game?: { id: string (uuid), slug, title, type, mature, assets } }
 *     NOTE: The lookup endpoint is v1 (not v2) — verified from the OpenAPI spec.
 *
 *   Step 2 — Historical store low:
 *     POST https://api.isthereanydeal.com/games/storelow/v2?key=<KEY>&country=US
 *     Body: JSON array of game UUIDs, e.g. ["018d937f-590c-714b-8b46-4dc799061a9a"]
 *     Response: Array of { id, storelow: [{ shop: { id, name }, price: { amount, amountInt, currency }, ... }] }
 *     price.amountInt is already in minor units (cents for USD). We use amountInt directly.
 *     If amountInt is absent, we fall back to Math.round(amount * 100).
 *
 * Authentication: API key sent as `key` query parameter (or ITAD-API-Key header; we use query param).
 * NEVER send STEAM_API_KEY to ITAD.
 *
 * Rules (matches store-client.ts discipline):
 *   - Client-safe: no process.env, no server/ imports. apiKey passed in by the repository.
 *   - Custom User-Agent header on every request.
 *   - Rate-limited with steamLimiter.acquire() before each fetch.
 *   - Single attempt (no retry) — best-effort; degrades to unavailable on any failure.
 *   - All failures → Availability { available: false, reason: 'metadata-unavailable' }.
 *   - Schemas are LENIENT (.passthrough() / optional) so API drift degrades, not crashes.
 *
 * Gating on ITAD_API_KEY being set and the opt-in flag happens in the repository, not here.
 */

import { z } from 'zod';
import { available, unavailable, type Availability } from '@/lib/result';
import { steamLimiter } from './limiter';

// ---------------------------------------------------------------------------
// Domain types (exported for consumers)
// ---------------------------------------------------------------------------

export interface ItadHistoricalLow {
  /** Lowest price ever seen, in integer cents (e.g. 199 for $1.99). */
  lowestCents: number;
  /** ISO 4217 currency code (e.g. "USD"). */
  currency: string;
  /** Name of the shop that recorded the lowest price, or null if unknown. */
  shop: string | null;
}

// ---------------------------------------------------------------------------
// Zod schemas — lenient: only assert what we read
// ---------------------------------------------------------------------------

/** Step 1: Lookup response */
const RawLookupGame = z
  .object({
    id: z.string(),
    slug: z.string().optional(),
    title: z.string().optional(),
    type: z.string().nullable().optional(),
    mature: z.boolean().optional(),
  })
  .passthrough();

const RawLookupResponse = z
  .object({
    found: z.boolean(),
    game: RawLookupGame.optional(),
  })
  .passthrough();

/** Step 2: Storelow response — array of per-game entries */
const RawPrice = z
  .object({
    amount: z.number().optional(),
    amountInt: z.number().int().optional(),
    currency: z.string().optional(),
  })
  .passthrough();

const RawShop = z
  .object({
    id: z.number().optional(),
    name: z.string().optional(),
  })
  .passthrough();

const RawStoreLowEntry = z
  .object({
    shop: RawShop.optional(),
    price: RawPrice.optional(),
  })
  .passthrough();

const RawStoreLowItem = z
  .object({
    id: z.string(),
    storelow: z.array(RawStoreLowEntry).optional(),
  })
  .passthrough();

const RawStoreLowResponse = z.array(RawStoreLowItem);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ITAD_BASE_URL = 'https://api.isthereanydeal.com';
const USER_AGENT = '4ES-Dash/0.0.0 (+https://github.com/AlesSystems/4ES-Dash)';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Convert a storelow price entry to integer cents.
 * Uses amountInt (already minor-unit) if present, otherwise rounds amount * 100.
 * Returns undefined when the entry carries neither field — callers must skip it
 * rather than treat a missing price as a $0.00 historical low (which would win
 * the min-price comparison and corrupt downstream cost-per-hour figures).
 */
function toCents(price: z.infer<typeof RawPrice>): number | undefined {
  if (price.amountInt !== undefined) return price.amountInt;
  if (price.amount !== undefined) return Math.round(price.amount * 100);
  return undefined;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch the ITAD historical store low for one Steam app.
 *
 * - `apiKey` is passed in by the (server-side) repository; never read from env here.
 * - Degrades to `unavailable('metadata-unavailable')` on any failure.
 * - Two HTTP round-trips per call (lookup → storelow), each acquires a token
 *   from the shared steamLimiter; ITAD's per-key quota is mitigated by the 24h
 *   cache (TTL.itadPrice) in the repository, not by this limiter.
 */
export async function getItadHistoricalLow(
  appId: number,
  apiKey: string,
): Promise<Availability<ItadHistoricalLow>> {
  // ---- Step 1: Resolve the ITAD game UUID from the Steam appid ----
  const lookupUrl = `${ITAD_BASE_URL}/games/lookup/v1?key=${encodeURIComponent(apiKey)}&appid=${appId}`;

  await steamLimiter.acquire();

  let lookupRaw: unknown;
  try {
    const res = await fetch(lookupUrl, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn('[itad-client] lookup HTTP %d for appId=%d', res.status, appId);
      return unavailable('metadata-unavailable');
    }

    lookupRaw = (await res.json()) as unknown;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[itad-client] lookup fetch failed for appId=%d: %o', appId, err);
    return unavailable('metadata-unavailable');
  }

  let lookup: z.infer<typeof RawLookupResponse>;
  try {
    lookup = RawLookupResponse.parse(lookupRaw);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[itad-client] lookup schema mismatch for appId=%d: %o', appId, err);
    return unavailable('metadata-unavailable');
  }

  if (!lookup.found || lookup.game === undefined) {
    // Game not indexed by ITAD — not an error, just unavailable.
    return unavailable('metadata-unavailable');
  }

  const gameId = lookup.game.id;

  // ---- Step 2: Fetch historical store low ----
  const storelowUrl = `${ITAD_BASE_URL}/games/storelow/v2?key=${encodeURIComponent(apiKey)}&country=US`;

  await steamLimiter.acquire();

  let storelowRaw: unknown;
  try {
    const res = await fetch(storelowUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
      },
      body: JSON.stringify([gameId]),
    });

    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn(
        '[itad-client] storelow HTTP %d for appId=%d gameId=%s',
        res.status,
        appId,
        gameId,
      );
      return unavailable('metadata-unavailable');
    }

    storelowRaw = (await res.json()) as unknown;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[itad-client] storelow fetch failed for appId=%d: %o', appId, err);
    return unavailable('metadata-unavailable');
  }

  let storelowItems: z.infer<typeof RawStoreLowResponse>;
  try {
    storelowItems = RawStoreLowResponse.parse(storelowRaw);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[itad-client] storelow schema mismatch for appId=%d: %o', appId, err);
    return unavailable('metadata-unavailable');
  }

  // Find the item for our game (match by id)
  const item = storelowItems.find((i) => i.id === gameId);
  if (item === undefined || item.storelow === undefined || item.storelow.length === 0) {
    return unavailable('metadata-unavailable');
  }

  // Pick the entry with the lowest price across all shops
  let lowestEntry: z.infer<typeof RawStoreLowEntry> | undefined;
  let lowestCents = Infinity;

  for (const entry of item.storelow) {
    if (entry.price === undefined) continue;
    const cents = toCents(entry.price);
    if (cents === undefined) continue; // skip price-less entries; never treat as 0
    if (cents < lowestCents) {
      lowestCents = cents;
      lowestEntry = entry;
    }
  }

  if (lowestEntry === undefined || !Number.isFinite(lowestCents)) {
    return unavailable('metadata-unavailable');
  }

  const result: ItadHistoricalLow = {
    lowestCents: Math.round(lowestCents),
    currency: lowestEntry.price?.currency ?? 'USD',
    shop: lowestEntry.shop?.name ?? null,
  };

  return available(result);
}
