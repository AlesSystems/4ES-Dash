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
## Caching

`server/cache.ts` exposes a `cache<T>(key, ttl, loader)` helper.

- Redis in prod, in-memory LRU in dev. The interface is identical.
- Keys are lowercase, colon-separated, namespaced: `steam:owned-games:76561198000000000`.
- TTLs come from a single map in `server/cache/ttl.ts`. Don't sprinkle magic numbers.
- Stale-while-revalidate: a fetch that throws after retries returns the previous value if one exists, with a `stale: true` flag the UI can show.
- Invalidation on writes uses `revalidateTag` for RSC and explicit `cache.del(key)` for the API.

## Database

- Prisma. SQLite for dev, Postgres for prod (Vercel Postgres / Supabase / self-hosted).
- Migrations are checked in (`prisma/migrations/`). Never edit a migration after merge — create a new one.
- Two flavors of table:
  - **Reference**: `Game`, `Achievement`, `User`. Upserted on read-through.
  - **Snapshot**: `PlaytimeSnapshot`, `AchievementSnapshot`. Append-only, one row per (steamId, appid, date).
- All snapshot writes use `createMany({ skipDuplicates: true })` to be safe under retry.

## Background jobs

- Registered in `server/jobs/index.ts` and invoked by `/api/jobs/*` route handlers.
- Each handler verifies `x-cron-secret` header against `CRON_SECRET`.
- Jobs are idempotent — re-running the same day's snapshot must not create dupes (compound unique on `(steamId, appId, date)`).
- Long-running jobs stream progress to a `JobRun` table for observability.

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
