# Backend Guide

The backend lives inside the same Next.js app: route handlers, server actions, server components, and the `server/` module. There is no separate service.

## Boundaries

| Concern               | Location                       | Notes                                       |
| --------------------- | ------------------------------ | ------------------------------------------- |
| HTTP entry            | `app/api/**/route.ts`          | Public JSON API; see `docs/API.md`          |
| Server components     | `app/**/page.tsx`              | Internal callers of the data layer          |
| Data layer            | `server/repositories/*.ts`     | DB + cache, returns domain models           |
| External API          | `lib/steam/*`                  | Steam Web API client + Zod schemas          |
| Background jobs       | `server/jobs/*`                | Cron-triggered                              |
| Schema                | `prisma/schema.prisma`         | Source of truth for persistent state        |

## Steam client

`lib/steam/client.ts` is the single place that knows how to talk to the **official Steam Web API** (`api.steampowered.com`).

- One `SteamClient` instance per process. Reads `STEAM_API_KEY` from env on construction; fails fast if missing.
- All endpoints return Zod-parsed types. If Steam returns a shape we don't expect, we throw `SteamApiError({ kind: "schema" })` — never silently coerce.
- Built-in token-bucket limiter (1 req / 250 ms) prevents Steam rate-limit responses.
- Retries: 3 attempts with backoff 250 ms / 1 s / 4 s on transient (5xx, network) errors. No retry on 4xx.
- Empty arrays from Steam are normalized — `IPlayerService` returns `{}` instead of `{ games: [] }` for private profiles; the client maps that to `SteamApiError({ kind: "private" })`.

## Store API client

`lib/steam/store-client.ts` handles calls to the **undocumented Store JSON API** (`store.steampowered.com/api`). This is a separate module from `client.ts` to make the boundary explicit and mocking easy.

Used for: game genres, community tags, description, release date, current price, category flags (multiplayer, co-op, etc.), and wishlist data.

Rules:

- **No `STEAM_API_KEY`** on any Store API request.
- **`User-Agent: 4ES-Dash/<version>`** header on every request.
- Batch in groups of **≤ 50 app IDs** with a **500 ms delay between batches** to avoid triggering rate limits.
- All Store API responses are Zod-parsed. An unexpected shape logs a warning and returns `null` for that game — the UI shows the game without metadata rather than crashing.
- Retries: 2 attempts with 1 s backoff on transient errors only.
- No private data is sent to `store.steampowered.com` (only app IDs and the configured Steam ID for wishlist lookups, which is already public information).

Rate limit notes for the Store API:

| Endpoint | Observed limit | Our strategy |
|----------|----------------|--------------|
| `appdetails` | ~200 req/5 min per IP | Batch ≤ 50 IDs, 500 ms between batches, 7-day cache |
| `wishlistdata` | ~60 req/min | 1 req per cron run, 24-hour cache |

## Data layer

> **Session-scoped (Phase 6).** Every repository function takes `steamId: string`
> as a **required** argument — there is no global owner. A blank/missing
> `steamId` throws the typed `MissingSteamIdError` (`server/repositories/require-steam-id.ts`),
> never a silent fallback. `env.STEAM_ID` is **optional** and lives ONLY at call
> sites (pages / route handlers / jobs) as the dev / featured-profile default
> (passed as `getEnv().STEAM_ID ?? ''`); it is never read inside
> `server/repositories/**`. The authenticated session user (`getSessionUser()`)
> is the real source of the `steamId` — see ADR 0002 and Task 05's authz layer.
> Cache keys stay `steam:<endpoint>:<steamId>[:<appid>]`, so two SteamIDs are
> cache-isolated (proven by `tests/unit/repositories-isolation.test.ts`).

> **Onboarding gate (Phase 7, #90).** A signed-in user is not "ready" until
> `runOnboardingBackfill` has run and set `User.onboardedAt`. Protected "my"
> views must distinguish *not provisioned yet* from *genuinely empty* before
> rendering an empty state. `server/onboarding-gate.ts#getOnboardingStatus()`
> returns `'no-session' | 'not-onboarded' | 'onboarded'` from a single
> `User.onboardedAt` read — it does **not** trigger a backfill (no Steam fan-out
> on the render path). Pages redirect a `'not-onboarded'` viewer to
> `/onboarding`; reserve empty states for `'onboarded'` viewers with no rows.

The following endpoints are Zod-parsed, rate-limited, and cached via `server/repositories/*`:

| Function (`lib/steam`)              | Steam endpoint                              | Repository                          | TTL (`ttl.ts`)        |
| ----------------------------------- | ------------------------------------------- | ----------------------------------- | --------------------- |
| `getRecentlyPlayedGames`            | `GetRecentlyPlayedGames/v1`                 | `repositories/recently-played.ts`   | `recentlyPlayed` 15 m |
| `getSteamLevel`                     | `GetSteamLevel/v1`                          | `repositories/level.ts`             | `steamLevel` 24 h     |
| `getPlayerAchievements`             | `GetPlayerAchievements/v0001`               | `repositories/achievements.ts`      | `playerAchievements`  |
| `getSchemaForGame`                  | `GetSchemaForGame/v2`                       | `repositories/achievements.ts`      | `playerAchievements`  |
| `getGlobalAchievementPercentages`   | `GetGlobalAchievementPercentagesForApp/v2`  | `repositories/achievements.ts`      | `playerAchievements`  |
| `getStoreMetadata` / `getStorePrice`| Store `appdetails` (undocumented)           | `repositories/store.ts`             | `storeMetadata` 7 d / `storePrice` 1 h |

### Friends (Phase 3)

Endpoints for the friends feature:

| Function (`lib/steam/friends`)                       | Steam endpoint                          | Repository                       | TTL (`ttl.ts`)            |
| ---------------------------------------------------- | --------------------------------------- | -------------------------------- | ------------------------- |
| `getFriendList`                                      | `ISteamUser/GetFriendList/v0001`        | `repositories/friends.ts`        | `friendList` 24 h         |
| `getPlayerSummariesBatch` (friend summaries)         | `ISteamUser/GetPlayerSummaries/v2`      | `repositories/friends.ts`        | `playerSummaries` 5 m     |

The `getFriends()` repository function:
1. Fetches the owner's friend list (steamIds + `friendSince` timestamps) via `getFriendList`, cached for 24 h.
2. Fetches enriched player summaries for all friend IDs in one batch call to `getPlayerSummariesBatch`, cached for 5 min.
3. Overlays `friendSince` from the friend-list onto each `FriendSummary` (the batch call returns `friendSince: null`).
4. Sorts the merged list via `sortFriends` (non-offline first, then alphabetical by `personaName` within each group).
5. Returns `{ friends, stale }` — `stale` is ORed across both cached results.

Private friend-list handling: if `getFriendList` throws `SteamApiError({ kind: 'private' })` it propagates untouched; `withErrorBoundary` maps it to a 403 RFC 7807 response (`steam-private-profile`).

### Compare two users (`repositories/compare.ts`, #31)

`getComparison(aId, bId)` powers the RSC-only `/compare?a=&b=` page (no public API route). For each side it fetches the player summary and owned games through the **same** cache keys as the dashboard (`cacheKey('player-summaries', id)` / `cacheKey('owned-games', id)`, TTLs `playerSummaries` / `ownedGames`), so the configured user's data is shared, not refetched. Each side degrades independently: a private library sets `isPrivate: true` with null counts; a failed summary sets `profile: null`. Shared games are computed (`lib/compare/computeSharedGames`, inner-join by `appId`, sorted by `|playtime delta|` desc) only when both libraries are available and `aId !== bId`; otherwise `shared` is `null` with `sharedSkipped` set to `'same-user'` or `'unavailable'`. The function never throws for private/unavailable input — the page renders designed states from the returned flags. The page defaults side A to `env.STEAM_ID` when `?a=` is absent (forward-compatible with the Phase 6 session user).

### Graceful degradation — `Availability<T>` (`lib/result.ts`)

T2/T4 features that Steam may not expose return `Availability<T>` instead of throwing:
`available(data, stale?)` or `unavailable(reason)` where `reason` is one of
`private | no-achievements | metadata-unavailable | not-tracked | empty | unknown`.
The UI renders the matching `<UnavailableState reason=… />` empty state — never a crash or a
silent zero. Store API failures (network/non-200/`success:false`/bad shape) degrade to
`unavailable('metadata-unavailable')`; private achievements → `unavailable('private')`; a game
with no achievement schema → `unavailable('no-achievements')`. See
[docs/STEAM_DATA_SOURCES.md](STEAM_DATA_SOURCES.md#data-availability--degradation-strategy).

### Insights / enrichment (Phase 4)

Shipped in Phase 4:

| Client module | Service | Gated by | Rate discipline | TTL key | Supplements |
| ----------------------------- | ------------------- | -------------------- | --------------- | ------------ | ----------------------------- |
| `lib/steam/steamspy-client.ts` | SteamSpy (free) | `ENABLE_STEAMSPY=1` | ≤ 1 req/sec | `steamSpy` | Genres, tags, ownership bands |
| `lib/steam/itad-client.ts` | IsThereAnyDeal v2 (free key) | `ITAD_API_KEY` set | Per-key quota | `itadPrice` | Historical-low price |

Both clients follow the **store-client T2 pattern**: custom `User-Agent` header, no Steam API key, never throw (degrade to `unavailable('metadata-unavailable')` on any failure). If the controlling env var is absent the client is not called and the feature degrades immediately.

Two new TTL constants were added to `server/cache/ttl.ts`:

| Key | Value | Rationale |
| ----------- | --------- | -------------------------------------------- |
| `steamSpy` | `86400` s | Matches SteamSpy's requested ≥ 24 h cache policy |
| `itadPrice` | `86400` s | Historical-low data changes slowly; 24 h is safe |

Two new Prisma models added in migration `prisma/migrations/20260617101604_phase4_insights/`:

- **`ManualGameData`** — user-supplied `pricePaidCents` (minor currency units) + `currency` (ISO 4217) + `acquiredAt` for T4 gaps that no API exposes. PK `(steamId, appId)`. Separate from `OwnedGame` to preserve the inferred `acquiredAt` (first-snapshot date).
- **`IdleDismissal`** — records dismissed idle-detection spikes. PK `(steamId, appId, fromDate, toDate)`; the window-scoped key ensures a new anomaly on the same game resurfaces rather than being permanently suppressed. `@@index([steamId, appId])` for fast per-game lookups.

## Caching

`server/cache.ts` exposes a `cache<T>(key, ttl, loader)` helper.

- Redis in prod, in-memory LRU in dev. The interface is identical.
- Keys are lowercase, colon-separated, namespaced: `steam:owned-games:76561198000000000`.
- TTLs come from a single map in `server/cache/ttl.ts`. Don't sprinkle magic numbers.
- Stale-while-revalidate: a fetch that throws after retries returns the previous value if one exists, with a `stale: true` flag the UI can show.
- **Single-flight (#85):** N concurrent misses on the same key collapse onto ONE loader invocation (an `inFlight` promise map). Joiners await the leader's result; SWR is preserved (a failed shared load returns the prior value as `stale`, or rethrows when there is no prior value). `clearCache()` resets both the store and the in-flight map.
- Invalidation on writes uses `revalidateTag` for RSC and explicit `cache.del(key)` for the API.

### Rate limiters (#85)

`lib/steam/limiter.ts` exports two **separate** token buckets (1 req / 250 ms each):

- `steamLimiter` — the Steam Web API (`api.steampowered.com`).
- `storeLimiter` — the undocumented Store API (`store.steampowered.com`), a different host. Keeping them separate means a flood of store-price calls (e.g. the nightly library-value pass over the whole library) never starves a Web API `acquire()` on the interactive request path.

### Pre-computed library value (#85)

Pricing every owned game is O(N) rate-limited Store calls. Doing it on the dashboard render made cold loads scale with library size. Now the **nightly job** calls `refreshLibraryValueAggregate(steamId, games)` (off the request path) which prices the library via `storeLimiter` and upserts a single `LibraryValueAggregate` row. The dashboard's `getLibraryValue(steamId)` only **reads** that row — its Steam fan-out is zero and independent of N. Before the first nightly run the row is absent → `getLibraryValue` returns `unavailable('not-tracked')` and the UI shows a designed "value pending" state (never a synchronous live fan-out, never a fabricated $0). The dashboard's library-value and achievement-summary sections each stream in their own `<Suspense>` boundary so neither blocks first paint.

## Database

- Prisma 6.x (`prisma-client-js`). SQLite for dev/CI, Postgres for prod (Supabase / self-hosted Docker).
- **`server/db.ts` exports the single `prisma` client** — a `globalThis`-guarded singleton so dev hot-reload
  doesn't leak connections. It is the only place that calls `new PrismaClient()`; repositories and jobs
  import `{ prisma } from '@/server/db'`.
- The client is generated by the `postinstall` script (`prisma generate`), so it exists before lint/typecheck in CI.
- Migrations are checked in (`prisma/migrations/`), SQLite-authored. Never edit a migration after merge — create
  a new one. Prod Postgres uses `prisma db push` (no migration replay); see `docs/DEPLOYMENT.md`.
- Two flavors of table:
  - **Reference**: `Game`, `Achievement`, `User`, `OwnedGame`. Upserted on read-through.
  - **Snapshot**: `PlaytimeSnapshot`, `AchievementSnapshot`. Append-only, one row per (steamId, appid, date).
- Snapshot writes are idempotent via per-row `upsert` on the compound `(steamId, appId, date)` PK
  inside a single `$transaction`. (Prisma's `createMany({ skipDuplicates })` is **not supported on
  SQLite** — see ERR-0005 — so we use upserts with an empty `update`, which a same-day re-run no-ops.)

## Background jobs

- Registered in `server/jobs/index.ts` (`runSnapshot`) and invoked by `/api/cron/*` route handlers.
- The cron route verifies the `x-cron-secret` header against `CRON_SECRET` with a **timing-safe** SHA-256
  digest comparison; a missing/invalid/unconfigured secret returns `401`.
- Jobs are idempotent — re-running the same day's snapshot must not create dupes (compound unique on `(steamId, appId, date)`).
- `playtimeForever` is monotonic: a reported decrease is clamped up to the latest prior value and logged.
- Each run writes a `JobRun` row (`running` → `ok`/`error`) with a JSON payload for observability.
- The nightly run also (a) records per-achievement **unlock events** (`AchievementUnlock`) for all achievement-bearing games via the cached achievement repository, so Year-in-Review counts by real `unlockedAt` (#91) and unlocks outside the most-played set still count, and (b) refreshes the **library-value aggregate** (`LibraryValueAggregate`) so the dashboard reads one row instead of pricing live (#85). Both are per-game fan-outs that belong in the job, never on the request path; both are best-effort (a failure in either is logged and never fails the snapshot).
- `refreshGameStoreData` (the job's Store metadata pass) persists **genres, price fields, and — since ERR-0022 — `categoryIds`** from the same per-game `StoreMetadata` fetch: zero additional Store calls, zero added limiter pressure. The multiplayer repository (`server/repositories/multiplayer.ts`) then classifies from the persisted `Game.categoryIds` with **one DB read and zero request-path Store calls** — `/library?multiplayer=1` is O(1) in external calls instead of N×250 ms limiter-serialized `appdetails` fetches. `categoryIds: null`/malformed rows land in `missingCount` (designed "could not be categorized" state); the returned `stale` flag is pinned `false` (nightly-refreshed reference data carries no stale-while-revalidate signal — never fabricate freshness).
- Achievement reference caches use dedicated TTL keys (`achievementSchema` 7 d, `achievementGlobal` 24 h in `server/cache/ttl.ts`): game schemas and global unlock percentages are slow-moving per-app reference data, so they no longer expire with the per-user 1 h `playerAchievements` TTL. Warm-instance improvement only, pending the durable-cache decision (bug-3 lane) — the in-process cache still empties on cold start.

## Validation

- Every route handler parses its input with Zod. No request body or query string is touched until it's validated.
- Output schemas are also Zod-defined and used to type the API response. `Response.json(schema.parse(payload))` in dev only.

## Error handling

- A single `withErrorBoundary(handler)` wraps every route. It catches:
  - `SteamApiError` → maps `kind` to RFC 7807 problem.
  - `z.ZodError` → 400 with details.
  - Anything else → 500, logs `{ requestId, error }`, returns generic body.
- No `try/catch` inside handlers unless it can produce a *different* error than the wrapper would.

## Logging & observability

- `pino` for structured logs. One line per request: `{ method, path, status, ms, requestId }`.
- Steam outbound calls log `{ endpoint, ms, cacheHit, retries }`.
- Errors include a `requestId` propagated to the client for support.
- Structured logs include `requestId` propagated to the client for support.

## Configuration

- All config is via env vars; loaded once through `server/env.ts`, which Zod-parses `process.env` at boot. Misconfiguration crashes the process immediately.
- `.env.example` enumerates every variable with a comment.

| Var                | Required | Notes                                |
| ------------------ | -------- | ------------------------------------ |
| `STEAM_API_KEY`    | yes      | https://steamcommunity.com/dev/apikey |
| `STEAM_ID`         | yes (v1) | 17-digit 64-bit Steam ID             |
| `DATABASE_URL`     | yes      | Prisma connection string             |
| `REDIS_URL`        | no       | Falls back to in-memory cache        |
| `CRON_SECRET`      | yes      | Shared secret for `/api/cron/*`      |
| `ENABLE_STEAMSPY`  | no       | Phase 4 opt-in (#38). Set to `1` or `true` to enable SteamSpy genre/tag/ownership enrichment. Off by default — enabling adds outbound calls to `steamspy.com`. |
| `ITAD_API_KEY`     | no       | Phase 4 opt-in (#39). Free API key from IsThereAnyDeal. Enables historical-low price client. Disabled (and no calls made) when unset. |

## Security

- API key never reaches the client (no `NEXT_PUBLIC_` prefix).
- All route handlers set `Cache-Control: private, no-store` unless they explicitly opt in.
- CORS: same-origin only. No `Access-Control-Allow-Origin: *`.
- Rate-limit middleware in `middleware.ts` (token bucket, 60 req/min/IP).
- Inputs validated → no SQL injection surface via Prisma. Raw queries (when used) are parameterized.
- Secrets loaded only from env; never hardcoded; `.env` is git-ignored.

## Testing

- Unit: Vitest. Mock the Steam HTTP client with `msw/node` returning recorded fixtures in `tests/fixtures/steam/`.
- Integration: hit real route handlers against an in-memory SQLite + mock Steam.
- E2E: Playwright (see frontend guide) covers the whole stack.

## Definition of done (backend)

- [ ] Route is wrapped by `withErrorBoundary`
- [ ] Inputs and outputs Zod-validated
- [ ] Cached where it should be, with documented TTL
- [ ] Snapshot job (if applicable) is idempotent
- [ ] Logged with structured fields
- [ ] Covered by a Vitest test for happy + at least one error case
- [ ] `docs/API.md` updated if the public surface changed
