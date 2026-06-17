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

## Phase 1 data layer

Endpoints added in Phase 1 (each Zod-parsed, rate-limited, cached via `server/repositories/*`):

| Function (`lib/steam`)              | Steam endpoint                              | Repository                          | TTL (`ttl.ts`)        |
| ----------------------------------- | ------------------------------------------- | ----------------------------------- | --------------------- |
| `getRecentlyPlayedGames`            | `GetRecentlyPlayedGames/v1`                 | `repositories/recently-played.ts`   | `recentlyPlayed` 15 m |
| `getSteamLevel`                     | `GetSteamLevel/v1`                          | `repositories/level.ts`             | `steamLevel` 24 h     |
| `getPlayerAchievements`             | `GetPlayerAchievements/v0001`               | `repositories/achievements.ts`      | `playerAchievements`  |
| `getSchemaForGame`                  | `GetSchemaForGame/v2`                       | `repositories/achievements.ts`      | `playerAchievements`  |
| `getGlobalAchievementPercentages`   | `GetGlobalAchievementPercentagesForApp/v2`  | `repositories/achievements.ts`      | `playerAchievements`  |
| `getStoreMetadata` / `getStorePrice`| Store `appdetails` (undocumented)           | `repositories/store.ts`             | `storeMetadata` 7 d / `storePrice` 1 h |

## Phase 3 data layer

Endpoints added in Phase 3 (Friends):

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

## Caching

`server/cache.ts` exposes a `cache<T>(key, ttl, loader)` helper.

- Redis in prod, in-memory LRU in dev. The interface is identical.
- Keys are lowercase, colon-separated, namespaced: `steam:owned-games:76561198000000000`.
- TTLs come from a single map in `server/cache/ttl.ts`. Don't sprinkle magic numbers.
- Stale-while-revalidate: a fetch that throws after retries returns the previous value if one exists, with a `stale: true` flag the UI can show.
- Invalidation on writes uses `revalidateTag` for RSC and explicit `cache.del(key)` for the API.

## Database

- Prisma 6.x (`prisma-client-js`). SQLite for dev/CI, Postgres for prod (Vercel Postgres / Supabase / self-hosted).
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
- `/api/health` returns DB + cache liveness for uptime probes.

## Configuration

- All config is via env vars; loaded once through `server/env.ts`, which Zod-parses `process.env` at boot. Misconfiguration crashes the process immediately.
- `.env.example` enumerates every variable with a comment.

| Var               | Required | Notes                                |
| ----------------- | -------- | ------------------------------------ |
| `STEAM_API_KEY`   | yes      | https://steamcommunity.com/dev/apikey |
| `STEAM_ID`        | yes (v1) | 17-digit 64-bit Steam ID             |
| `DATABASE_URL`    | yes      | Prisma connection string             |
| `REDIS_URL`       | no       | Falls back to in-memory cache        |
| `CRON_SECRET`     | yes      | Shared secret for `/api/jobs/*`      |
| `NEXTAUTH_SECRET` | v2+      | NextAuth session secret              |

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
