---
name: backend
description: Use when working on the server side of 4ES-Dash — the Steam client, caching, database access, Prisma schema, background jobs, server actions, route handlers as data sources for RSCs. Trigger on requests like "add a snapshot job", "cache this endpoint", "write a Prisma migration", "fix the rate limiter", "model the achievements table", or anything that touches lib/steam, server/, or prisma/. Enforces docs/BACKEND.md and docs/DATA_MODEL.md.
---

# Backend skill

Sources of truth: [`docs/BACKEND.md`](../../../docs/BACKEND.md) and [`docs/DATA_MODEL.md`](../../../docs/DATA_MODEL.md). API contract lives in [`docs/API.md`](../../../docs/API.md). Read what you're about to change.

## Non-negotiables

1. **One Steam client.** All Steam HTTP goes through `lib/steam/client.ts`. Never `fetch('https://api.steampowered.com/...')` directly from a route or repository.
2. **Validate at every boundary.** Inbound: Zod parse the request. Outbound: Zod parse Steam's response. Anything that crosses a wire gets a schema.
3. **Cache, then DB, then Steam.** Read-through in that order. Writes invalidate the relevant cache key explicitly.
4. **Server-only stays server-only.** The Steam API key must never reach a client bundle. `server/` is not importable from `app/**/*Client.tsx` or `components/`.
5. **Idempotent jobs.** Snapshot jobs must be safe to re-run on the same day. Compound unique keys on `(steamId, appId, date)` enforce it; use `createMany({ skipDuplicates: true })`.
6. **Errors are typed.** Throw `SteamApiError` with a `kind`; let `withErrorBoundary` map it to a problem-details response.

## Adding a new Steam-backed endpoint

1. Add or extend a method on `SteamClient` with input/output Zod schemas.
2. Add a repository function in `server/repositories/` that wraps it with `cache(...)` and any DB upsert.
3. Add a route handler under `app/api/<thing>/route.ts` that:
   - validates input with Zod
   - calls the repository
   - returns the response via `Response.json(outputSchema.parse(payload))`
   - is wrapped in `withErrorBoundary`
4. Add the cache TTL to `server/cache/ttl.ts` (no magic numbers inline).
5. Update `docs/API.md`.
6. Add a Vitest covering happy path + at least one error case (using `msw/node` Steam fixtures).

## Schema changes

- Edit `prisma/schema.prisma`.
- `pnpm prisma migrate dev --name <descriptive>`.
- Commit the generated migration with the PR.
- Once merged, the migration is immutable. To fix, write a follow-up migration.
- Destructive migrations (DROP, type change) must be flagged in the PR description.

## Caching rules

- Keys: `steam:<endpoint>:<steamId>[:<appid>]`. Lowercase, colon-separated.
- TTLs live in one place (`server/cache/ttl.ts`).
- Stale-while-revalidate: on retry exhaustion, return the previous value if it exists, mark `stale: true`.
- Invalidate explicitly on writes. Don't rely on TTL alone.

## Job runbook

- Each job has a route handler under `/api/jobs/<name>`.
- The handler:
  1. `timingSafeEqual`s the `x-cron-secret` header against `CRON_SECRET`. 401 on mismatch.
  2. Writes a `JobRun` row, runs, updates status.
  3. Returns `202 { queued: true, jobId }` immediately for long jobs; do work via `waitUntil` / queue if needed.

## Definition of done

- [ ] Inputs and outputs Zod-validated
- [ ] Wrapped in `withErrorBoundary`
- [ ] Cache TTL added if read-through; invalidation added if mutating
- [ ] Migration committed if schema changed
- [ ] Vitest covers happy path + one error case
- [ ] Structured logs include `requestId`, `ms`, `cacheHit`
- [ ] `docs/API.md` and/or `docs/DATA_MODEL.md` updated if surface changed
- [ ] No secret leaks; nothing prefixed `NEXT_PUBLIC_` is sensitive

## Common pitfalls

- Treating `steamId` as a JS `number` — it's a 17-digit string. Don't lose precision.
- Forgetting that `GetOwnedGames` returns `{}` for private profiles. The client maps this to `SteamApiError({ kind: "private" })`; don't re-handle.
- Snapshotting playtime decreases as actual decreases. They aren't — clamp to previous and log.
- Mixing route-handler request validation with body-mutation. Parse first, then act.

## What to deliver

A backend change should ship as: schema + migration (if needed), repository, route handler, tests, doc updates, in that order. Don't ship code that the data layer can't support.
