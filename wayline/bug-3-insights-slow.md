# Wayline — Bug #3: Webapp slow, especially Insights pages

**Confidence: 4.5/5** · Status: root-caused with one runtime gap to close (see below)

## Symptom

> Webapp is so slow, especially insights pages.

## Root cause(s) — ranked

1. **DOMINANT (conditional): per-game SteamSpy fan-out on the genres render path
   when `ENABLE_STEAMSPY=1`.** `getGenreBreakdown` loops every owned game and
   `await`s a SteamSpy call one-by-one through a **1 req/sec** limiter → N games × 1 s
   serialized. The documented, *unfixed* remnant of ERR-0011. Flag OFF (default) →
   dormant; flag ON → 65-game library ≈ 65 s and exceeds the Vercel function timeout
   (page never renders).
2. **No `<Suspense>` streaming.** All three insights pages `await` their repository
   in the page body, so the *entire* page blocks on the slowest call; `loading.tsx`
   only covers route-transition, not in-page streaming.
3. **Sequential RSC awaits (waterfall) on genres** — `getOnboardingStatus()` →
   `getViewerSteamId()` → `getGenreBreakdown()` in series, and the first two each call
   `getSessionUser()` (duplicate session work per render).
4. **Unbounded snapshot full-table scans + in-memory recompute every request** —
   `idle` and `year-in-review` repos `findMany` the *entire* `PlaytimeSnapshot` table
   (no date filter, no aggregation), then recompute in JS on every load. O(history),
   grows forever.
5. **`force-dynamic` + no shared cache in prod** — all insights pages set
   `dynamic = 'force-dynamic'` and `REDIS_URL` is optional/unset → per-instance LRU
   lost on cold start; every visit recomputes from scratch (no ISR, no cross-instance
   hits).

## Evidence

| # | Location | Finding |
|---|---|---|
| 1 | [server/repositories/insights/genres.ts:85-108](../../server/repositories/insights/genres.ts#L85) | `for (const game of ownedGames) { … await cache(…, () => getSteamSpyData(appId)) }` — sequential await in loop. |
| 1 | [lib/steam/limiter.ts:101](../../lib/steam/limiter.ts#L101) | `steamSpyLimiter = new TokenBucketLimiter(1, 1000)` — **1 req/sec**; acquired at [steamspy-client.ts:113](../../lib/steam/steamspy-client.ts#L113). |
| 2 | [app/insights/genres/page.tsx:35,40,41](../../app/insights/genres/page.tsx#L35), [cost-per-hour/page.tsx:41-42](../../app/insights/cost-per-hour/page.tsx#L41), [idle/page.tsx:34-35](../../app/insights/idle/page.tsx#L34) | Three serial awaits in body; **no `<Suspense>`** anywhere in `app/insights/` or `components/insights/`. |
| 3 | [app/insights/genres/page.tsx:35,40](../../app/insights/genres/page.tsx#L35) | `getOnboardingStatus()` then `getViewerSteamId()`; both call `getSessionUser()` (`server/onboarding-gate.ts`, [server/auth.ts:281](../../server/auth.ts#L281)). |
| 4 | [server/repositories/insights/idle.ts:33-36](../../server/repositories/insights/idle.ts#L33) | `playtimeSnapshot.findMany({ where:{ steamId } })` — no `date` bound; `detectIdleSpikes` recomputes ([lib/insights/idle.ts:53-91](../../lib/insights/idle.ts#L53)). Same in `year-in-review.ts`. |
| 4 | [prisma/schema.prisma:114](../../prisma/schema.prisma#L114) | `@@index([steamId, date])` exists but queries pass only `steamId` → index not used to bound the scan. |
| 5 | [genres/page.tsx:25](../../app/insights/genres/page.tsx#L25), [cost-per-hour/page.tsx:21](../../app/insights/cost-per-hour/page.tsx#L21), [idle/page.tsx:22](../../app/insights/idle/page.tsx#L22) | `export const dynamic = 'force-dynamic'`. |
| 5 | [server/env.ts:27](../../server/env.ts#L27) | `REDIS_URL: z.string().url().optional()` — not set in `.env`. |
| ✓ | [components/insights/GenreChart.tsx:20](../../components/insights/GenreChart.tsx#L20) | Tremor IS lazy-loaded (`dynamic(… { ssr:false })`) — **not** a bottleneck. |
| hist | [docs/ERROR.md:286-303](../ERROR.md) | ERR-0011 measured genres **64.8 s** / cost-per-hour **16.3 s** cold; `:301` names SteamSpy-tag fan-out as the remaining latent defect. ERR-0010/ERR-0003 establish "no O(N) rate-limited fan-out on render." |

## Data-flow trace (genres render)

```
getOnboardingStatus()  → getSessionUser() + user.findUnique        (~1 DB read)
getViewerSteamId()     → getSessionUser()  AGAIN                    (redundant)
getGenreBreakdown(id):
   ownedGame.findMany                                               (1 query, scoped — fine)
   game.findMany({ appId:{ in }})                                   (1 query, scoped — fine)
   JSON.parse genres                                                (cheap)
   IF ENABLE_STEAMSPY: loop N games × await getSteamSpyData()       ← N × 1000 ms SERIAL
   aggregateBreakdown                                               (JS)
render GenreChart (Tremor lazy chunk)                               (good)
```
Flag OFF → ~3 DB reads, few ms. Flag ON → DB + **N × 1000 ms** SteamSpy serial.

## Why it's slow (mechanism)

- **Rate limiter × fan-out:** textbook `items × calls-per-item × limiter-interval`
  blow-up. 65 games × 1 s = ~65 s; the **limiter**, not the network, is the wall.
  Dominant *whenever the flag is on*.
- **Waterfall + no streaming:** even on the fast path the page can't paint until the
  slowest await resolves — no `<Suspense>` boundary.
- **No durable cache + force-dynamic:** every visit re-does the work; 24 h SteamSpy
  TTL defeated by ephemeral per-instance LRU on serverless cold starts.

## ⚠️ Confidence gap → how to reach 5/5

Scout reached **4.5/5**. The unresolved variable is **runtime**, not code:

1. **Is `ENABLE_STEAMSPY` actually on in the slow environment?** It's absent from
   `.env` (defaults OFF, [server/env.ts:33](../../server/env.ts#L33)). If the user
   sees slowness *with the flag off today*, the dominant cause shifts to #2/#4/#5.
   → **Close it:** check the deployed env var (Vercel project settings) — a 30-second check.
2. **Which page is actually slowest, and have snapshot scans grown large?**
   → **Close it:** wrap `getGenreBreakdown` / the idle+YIR `findMany` in a
   `performance.now()` timing (or read a Vercel function-duration trace) on a real
   render.

The ranked fix list below is robust **either way** — precompute + Suspense + bounded
scans help under both the flag-on and flag-off scenarios.

## Blast radius

- **`/review/[year]`** shares `year-in-review.ts`'s unbounded snapshot scan +
  per-request recompute.
- **All `/insights/*` and every "my-data" RSC** share `force-dynamic` + ephemeral
  cache + duplicate `getSessionUser`. ERR-0011 `:280/:301` + ERR-0010 list genres,
  cost-per-hour, multiplayer, and "any future per-game aggregate page."
- **`steamSpyLimiter` is a global singleton** — one flag-on genres render starves any
  other concurrent SteamSpy consumer.

## Fix direction (described, not implemented — highest leverage first)

1. **Eliminate the SteamSpy render-path fan-out (closes ERR-0011's open item).**
   Persist SteamSpy tags into a `Game` column / `GameTag` table in the **nightly job**
   (as genres/price already are); `getGenreBreakdown` reads that column → zero per-game
   calls on render. *The single change that removes the timeout-causing bottleneck.*
   (If kept on render at all, at minimum `Promise.all` — but the limiter still
   serializes, so precompute is the real fix.)
2. **Add in-page `<Suspense>` boundaries** so the data section streams behind a
   skeleton and a slow section never blocks the shell (mirror the dashboard's
   `LibraryValueSection` pattern from ERR-0010).
3. **De-dupe session + parallelize** — resolve `getSessionUser()` once, pass `steamId`
   down; `Promise.all` the independent reads.
4. **Bound the snapshot scans** — add `where: { date: { gte: … } }` + `select` so
   `@@index([steamId, date])` is used and the JS recompute set stays small; or
   precompute idle flags / yearly aggregates nightly.
5. **Durable shared cache in prod** (`REDIS_URL`) and/or relax `force-dynamic` to
   ISR/`revalidate` for these read-mostly aggregates so TTLs survive cold starts.

## → Agentic loop seed

- **Brief intent:** "Insights pages render in < 2.5 s LCP with no per-game
  rate-limited fan-out on the request path; heavy sections stream via Suspense."
- **Acceptance criteria (testable):**
  - `getGenreBreakdown` makes **0** Steam/SteamSpy network calls on render (tags read
    from DB); assert with a mocked client call-count of 0.
  - Each insights page wraps its data section in `<Suspense>` with a skeleton.
  - Idle/YIR snapshot queries carry a `date` bound; assert the Prisma `where` includes it.
- **Prereq task (do FIRST):** the 5/5-gap verification — record `ENABLE_STEAMSPY`'s
  prod value and a one-render timing; attach to the brief so the implementer targets
  the real dominant cost.
- **Task split:** (a) nightly SteamSpy-tag precompute + column; (b) Suspense
  boundaries; (c) session de-dupe; (d) bounded scans; (e) prod cache/ISR.
- **Reviewer checks:** network-call-count assertions; no `force-dynamic` regressions
  to correctness; confirm ERR-0011's open item is closed, not re-deferred.
- **ERROR.md:** update ERR-0011 (or append a follow-up) once the render-path fan-out
  is removed.
