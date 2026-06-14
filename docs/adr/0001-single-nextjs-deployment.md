# 0001. Single Next.js deployment, no separate backend

**Status:** Accepted

**Date:** 2026-06-14

## Context

4ES-Dash is a personal Steam stats dashboard — a single configured user, self-hostable, with an optional Vercel deployment path. The data layer calls two external sources: the authenticated Steam Web API (`api.steampowered.com`) and the undocumented Store API (`store.steampowered.com/api`). Data must be cached aggressively to respect Steam's rate limits and avoid redundant fetches.

The core product requirements at Phase 0 are:

- Render rich, data-dense pages with minimal client JS.
- Keep the Steam API key strictly server-side; never expose it to the browser.
- Run periodic snapshot jobs (daily playtime, achievements) without a separate job runner host.
- Support SQLite locally and Postgres in production without changing application code.
- Stay deployable by a single developer with one `docker compose up` or one Vercel project.

## Decision

We use a single Next.js 14+ App Router deployment with no separate backend service.

- **RSC pages** in `app/` call the data layer directly via repository functions; no HTTP hop is needed for first paint.
- **Client components** that need dynamic data fetch from our own `/api/*` route handlers — never directly from Steam.
- **`lib/steam/`** is the sole module allowed to call Steam APIs. It token-bucket-limits requests, retries transient failures with exponential backoff, and throws typed `SteamApiError` values. All other code reaches Steam through this layer.
- **`server/cache.ts`** exposes a single `cache(key, ttl, loader)` interface backed by Redis in production and an in-memory LRU in development. TTLs are centralized in `server/cache/ttl.ts`.
- **Prisma** with SQLite in development and Postgres in production handles persistence. Reference data is upserted; time-series snapshots are append-only with compound unique keys.
- **Background jobs** run via `node-cron` locally and via Vercel Cron (protected route handlers) in production — no separate worker process.

## Consequences

### Positive

- One deployable artifact: simpler CI, simpler ops, no cross-service auth or network latency between layers.
- RSC eliminates a round-trip for first paint and keeps the API key off the wire by construction.
- The same TypeScript types are shared across the data layer, route handlers, and React components — no schema duplication or code-gen step.
- Stale-while-revalidate and retry logic live in one place (`lib/steam/`) and benefit every consumer.
- SQLite dev / Postgres prod parity is transparent to the application; Prisma abstracts the difference.

### Negative

- Compute and data concerns share one deployment unit. A CPU-intensive snapshot job competes with request-serving; there is no independent scaling axis for the API surface vs. the job runner.
- Long-running snapshot jobs run inside the Next.js runtime. On Vercel this is bounded by function timeout limits; very large libraries (thousands of games) may require pagination or chunked job design earlier than expected.
- Scaling horizontally (multiple instances) requires Redis for the cache and an external Postgres — the in-process defaults do not work in a multi-instance setup.
- A bug in the Steam client or cache layer can affect the UI, the API routes, and the cron jobs simultaneously — there is no blast-radius boundary between them.

### Neutral

- Route handler test setup requires a running Next.js environment (or mocking of `next/server`); pure repository functions are easier to unit-test in isolation.
- The App Router / RSC model has a steeper learning curve than the Pages Router for contributors unfamiliar with it.
- Adding a second data source (e.g. a different gaming platform) requires extending `lib/steam/` conventions to a parallel `lib/<platform>/` module — the pattern is clear but the isolation is by convention, not by process boundary.

## Alternatives considered

| Alternative | Why not chosen |
| --- | --- |
| Separate Node/Express or NestJS backend | Extra deployment target, duplicated TypeScript types across two repos, and unnecessary operational complexity for a single-user-first app with no public API surface. |
| Serverless functions only (no persistent process) | Cron/snapshot jobs require either a managed scheduler or a persistent process; connection pooling (Prisma + Postgres) is awkward without a warm process; cold starts hurt the low-latency UX goal. |
| tRPC layer between server and client components | RSC pages call data functions directly — no network layer needed. Route handlers cover the client-component fetch cases. tRPC would add indirection without removing the underlying data functions. |
