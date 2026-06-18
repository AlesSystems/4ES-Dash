# Task 01 — optimize the slow dashboard (#85)

**Status owner:** implementer · **Depends on:** none (but **serialize
`server/jobs/snapshot.ts` with Task 07** and `server/cache.ts` with Task 02) ·
**Blocks:** Task 02 (deploy lands on the snapshot/cache changes) · **Tier:** 2

## Scope (exactly these files)

- `server/repositories/library-value.ts` — stop pricing every game live on render
- `server/jobs/snapshot.ts` — pre-compute the library-value aggregate nightly
  (**merge point** with Task 07 + Task 02)
- `app/page.tsx` — move the achievement summary into its own `<Suspense>` boundary
- `components/dashboard/LibraryValueSection.tsx` — read the pre-computed aggregate;
  drop the redundant `getViewerSteamId`/`getProfile`
- `lib/steam/limiter.ts` — add a dedicated `storeLimiter`
- `lib/steam/store-client.ts` — use `storeLimiter` (not the shared `steamLimiter`)
- `server/cache.ts` — add in-flight single-flight de-dup (**merge point** with Task 02)
- `prisma/schema.prisma` + one new migration — home for the aggregate
- `server/repositories/achievements.ts` — keep/lower the top-N bound; ensure it's
  Suspense-isolated, not on the blocking path
- Corresponding `tests/**`

## Root cause (already traced — fix the cause)

Cold dashboard latency is server-side Steam fan-out, not bundle/DB:
`library-value.ts` prices every owned game via `Promise.all(... getGameStorePrice)`,
all serialized behind the shared 250 ms limiter (`N × 250 ms`); `app/page.tsx`
awaits the achievement summary (up to ~60 calls) **inside** the blocking
`Promise.all`; Store + Web API share one limiter; `cache.ts` has no single-flight.
(See `docs/ERROR.md` ERR-0003 — flagged, never fully fixed.)

## Acceptance criteria

1. A dashboard render issues **at most K Steam requests regardless of library size**
   (assert with a mocked limiter / MSW counter; K independent of N). The
   library-value path does **not** scale O(N) live calls.
2. First paint is **not blocked** by library value or achievements — both render in
   their own `<Suspense>` boundary; the profile strip + KPI row are in the initial
   RSC payload while those sections show skeletons.
3. Store calls and Web API calls draw from **separate limiters** — a flood of store
   calls does not delay a Web API `acquire()` (tested).
4. `getProfile` / `getViewerSteamId` invoked **at most once** per render.
5. **Cache single-flight:** N concurrent misses on one key invoke the loader exactly
   once; stale-while-revalidate behavior preserved.
6. Cold-cache server render under a fixed budget (e.g. < 3 s for ~250 games with a
   stubbed 250 ms limiter); warm render < 200 ms.

## Degraded / unavailable-data behavior

Pre-computed aggregate missing/stale (e.g. before the first nightly run) → a designed
"value pending" / `{ available: false, reason }` state, never a synchronous live
fan-out as a fallback and never a fabricated `$0`.

## Definition of done for this task

- Failing tests first; gate passes. The new migration is additive and immutable.
- `docs/BACKEND.md` updated (aggregate + limiter + single-flight); `docs/ERROR.md`
  gets the ERR-XXXX closing ERR-0003's open item.
- `state.json` task `01` → `in-review` with the bound/Suspense/limiter/single-flight
  tests listed. Reviewer returns APPROVE.
