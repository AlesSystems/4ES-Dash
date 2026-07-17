# Theme 3 — Blocking shell and un-streamed pages

> Read-only performance root-cause investigation
>
> **Branch:** `altan/optimization` · **HEAD:** `13023e335764daed73900fabc0d88eab4d190eff` · **Date:** 2026-07-09 · **Phase:** investigation
>
> Scope: does the root layout await data with no Suspense so every navigation pays that latency before paint? Establish exactly what the shell awaits, whether Next.js/the repo cache dedupes the duplicate fetches, and whether any Suspense boundary sits between layout and children.

## TL;DR mechanism (shared across RSC-1 / RSC-2)

`app/layout.tsx` renders `<AppHeader />` and `<Sidebar />` as direct children of `<body>` with **no `<Suspense>` boundary** between the shell and `{children}`. Both are `async` RSCs that each `await getViewerSteamId()` then `await getProfile(viewerId)`. `getProfile` fires **two** Steam Web API calls (`getPlayerSummaries` + `getOwnedGames`) behind the 250 ms token-bucket limiter (`server/repositories/profile.ts:32-43`). Because there is no Suspense wrapping them, the **entire HTML document response blocks on the slower of those two fetches** before anything streams — the header, the sidebar, and the page body all wait together.

Two important corrections to the scout claims, both verified this run:

1. **The duplicate profile fetch is de-duplicated, not doubled.** There is **no React `cache()` / `fetch` memoization** anywhere (grep: zero `import { cache } from 'react'`; the only `cache` symbol is the repo's own `server/cache.ts`). Dedup instead comes from the repo cache's **single-flight `inFlight` map** (`server/cache.ts:36,93-107`): AppHeader and Sidebar render concurrently, miss the same `owned-games:<id>` / `player-summaries:<id>` keys at the same instant, and collapse onto **one** loader invocation each. So cold-cache cost is ~2 Steam calls total for the shell, not ~4. The cost is **latency-to-first-paint**, not fetch count.
2. **"EVERY navigation" is overstated.** In the App Router the **root layout persists across soft (client-side) navigations** — `AppHeader`/`Sidebar` re-execute on hard loads / full refreshes, not on in-app link clicks between sibling pages. On soft nav only the changed segment re-renders. The shell-blocking tax is therefore paid on **every cold document load** (first visit, refresh, direct URL, cache-cold serverless instance), and the `getProfile` result is TTL-cached (owned-games 1 h, summaries 5 min) so warm loads skip the Steam round-trip but still pay the synchronous `await` + cache lookup before paint.

---

## RSC-1 — Sidebar awaits getViewerSteamId + getProfile in the shell, no Suspense

**Verdict:** confirmed (mechanism); **needs-measurement** for the real wall-clock number.

**Mechanism:** `Sidebar` (`components/layout/Sidebar.tsx:13-24`) is an async RSC mounted in the layout at `app/layout.tsx:68`, inside a plain `<div className="flex">` with no `<Suspense>`. It `await`s `getViewerSteamId()` (a session read) then `await getProfile(viewerId)` purely to compute `games.length` and an untouched-count. `getProfile` resolves two limiter-gated Steam calls. Since React cannot flush the shell until every non-suspended async child of the tree settles, this `await` chain gates the whole document's first byte of streamed body. The waterfall is 2-deep: session → profile (they are sequential, not `Promise.all`'d, because the profile call needs the id).

**Cost:** Cold cache, dominant term = the two Steam fetches. Limiter floor is 1 req / 250 ms (`lib/steam/limiter.ts`), so best case ~250-500 ms of limiter queueing **plus** network RTT to `api.steampowered.com` (typically 150-600 ms each) — realistically **~0.4-1.2 s added to first paint** on a cold instance, shared (via single-flight) with AppHeader and any page that also calls `getProfile`. Warm cache: a synchronous Map hit, sub-millisecond, but still an `await` boundary before paint. Exact number is runtime-dependent → measurement needed (see open questions). Payload note: `getProfile` pulls the **full owned-games array** (all N games with playtime) just to read `.length` and filter `total === 0` — for a 65-game library that is the entire library object materialised in the shell for two integers.

**Blast radius:** Every route in the app — the root layout wraps all pages. Paid on every cold document load / refresh / new serverless instance, once per load (persists across soft nav). Grows mildly with library size N (array length + filter is O(N) in JS, trivial vs the fetch).

**Cross-refs:** Shares the exact `getProfile` shell dependency with **RSC-2** (AppHeader) — same fetch, deduped. Overlaps **bug-3** finding #2 ("no `<Suspense>` streaming") but **extends it**: bug-3 scoped the missing-Suspense defect to `app/insights/*` page bodies; this finding is the **shell-level** instance one layer up, which bug-3 did not analyse (its receipt only inspected `app/insights/` and `components/insights/`). Related to any Theme covering `getProfile` fan-out / owned-games payload size.

**Evidence:**

| File | Line | Quote |
|------|------|-------|
| `app/layout.tsx` | 66-69 | `<AppHeader />` … `<div className="flex"><Sidebar />` — no `<Suspense>` around either or around `{children}` |
| `components/layout/Sidebar.tsx` | 18-19 | `const viewerId = await getViewerSteamId(); const { games } = await getProfile(viewerId);` |
| `components/layout/Sidebar.tsx` | 20-21 | `libraryCount = games.length; untouchedCount = games.filter((game) => game.playtime.total === 0).length;` |
| `server/repositories/profile.ts` | 32-43 | `const [summary, games] = await Promise.all([ cache(... getPlayerSummaries(id)), cache(... getOwnedGames(id)) ])` — two Steam calls per `getProfile` |

---

## RSC-2 — AppHeader second profile + level fetch in the shell, un-streamed

**Verdict:** confirmed (mechanism); **needs-measurement** for wall-clock.

**Mechanism:** `AppHeader` (`components/layout/AppHeader.tsx:28-59`) is the sibling async RSC at `app/layout.tsx:66`. It `await`s `getViewerSteamId()` then `Promise.all([getProfile(featuredId), getLevel(featuredId)])`. Unlike the Sidebar it *does* parallelise its two calls, and it wraps each in `.catch()` for graceful degradation — but it is still un-suspended, so it too gates the shell flush. `getProfile` here hits the **same cache keys** as the Sidebar's call, so on a concurrent cold miss the single-flight map (`server/cache.ts:93-107`) makes both share one loader — the header does **not** add a second owned-games fetch. `getLevel` is an **additional distinct** Steam call (`GetSteamLevel`), so the header adds one genuinely new limiter-gated request to the shell's critical path.

**Cost:** Marginal added cost over RSC-1 = the single `getLevel` call (one more limiter slot + RTT, ~0.25-0.7 s cold). The shared `getProfile` is free (deduped). The header also does an O(N) `reduce` over all games for total playtime (`AppHeader.tsx:50`) — trivial. Combined, RSC-1+RSC-2 make the shell's cold critical path ≈ max(profile fetch, level fetch) rather than either alone; because they run concurrently across the two components the wall-clock is the slowest single Steam call, not the sum. Needs measurement to pin the real number per environment.

**Blast radius:** Identical to RSC-1 — every route, every cold document load. The header is arguably worse because it is the very first element in `<body>` and `getLevel` has no other cache warmer, so it is often the long pole.

**Cross-refs:** Deduplicated `getProfile` shared with **RSC-1**. `getLevel` is header-unique. Same shell-Suspense gap as RSC-1; **extends bug-3** #2 the same way. No overlap with the bug-3 SteamSpy fan-out (that is genres-only).

**Evidence:**

| File | Line | Quote |
|------|------|-------|
| `app/layout.tsx` | 66 | `<AppHeader />` — rendered before `{children}`, no Suspense |
| `components/layout/AppHeader.tsx` | 36-46 | `const featuredId = await getViewerSteamId(); const [profileResult, levelResult] = await Promise.all([ getProfile(featuredId)..., getLevel(featuredId)... ])` |
| `components/layout/AppHeader.tsx` | 50 | `profileResult.games.reduce((sum, game) => sum + game.playtime.total, 0)` — O(N) over full library |
| `server/cache.ts` | 93-107 | single-flight `inFlight` join — collapses AppHeader+Sidebar concurrent misses to one loader |

---

## RSC-6 — cost-per-hour page blocks on repo work, force-dynamic, no Suspense

**Verdict:** confirmed (already covered by bug-3).

**Mechanism:** `app/insights/cost-per-hour/page.tsx` sets `export const dynamic = 'force-dynamic'` (`:21`) and, in the page body, `await`s `getViewerSteamId()` then `await getCostPerHour(viewerId)` (`:41-42`) with no in-page `<Suspense>`. The whole page blocks on the repo call before any markup renders; `loading.tsx` only covers the route-transition, not in-page streaming. This is exactly bug-3's finding #2 + #5 for this specific page. Per the bug-3 receipt, `getCostPerHour` itself does **zero** Store network calls post-ERR-0011 (reads `ownedGame` + `Game` from DB), so the cost here is the un-streamed blocking `await` + `force-dynamic` (no ISR) + ephemeral cache, **not** a rate-limited fan-out.

**Cost:** Not the genres-class blow-up. Cost = a couple of scoped DB reads plus the fixed "no streaming" penalty (page waits for the slowest await instead of painting a skeleton). Materially cheaper than genres/idle; bounded by library size, not snapshot history. On a cold serverless instance the ephemeral in-process Map cache (`server/cache.ts:32`) means the DB work re-runs (bug-3 #5).

**Blast radius:** This one page `/insights/cost-per-hour`; shares `force-dynamic` + ephemeral-cache + no-in-page-Suspense with the other `app/insights/*` pages, as bug-3 documents. Unlike RSC-1/RSC-2 this is a **page-level** block (one route), not a shell-level one (all routes).

**Cross-refs:** **Already settled by bug-3** — see `wayline/evidence/reports/bug-3-insights-slow.md` findings #2 and #5 and evidence rows for `cost-per-hour/page.tsx:21` and `:41`. bug-3 also confirms the ERR-0011 Store fan-out was already migrated away for this page. Nothing new here; cited for completeness. Distinct from the shell blocking of RSC-1/RSC-2 (that dominates because it is global; this is one page).

**Evidence:**

| File | Line | Quote |
|------|------|-------|
| `app/insights/cost-per-hour/page.tsx` | 21 | `export const dynamic = 'force-dynamic';` |
| `app/insights/cost-per-hour/page.tsx` | 41-42 | `const viewerId = await getViewerSteamId(); const { result, stale } = await getCostPerHour(viewerId);` — serial awaits, no in-page `<Suspense>` in the file |

---

## RSC-8 — /u/[steamId] runs 4 serial awaits before any data fetch

**Verdict:** confirmed (mechanism); low impact.

**Mechanism:** `app/u/[steamId]/page.tsx` runs a strict serial chain before it even fetches profile data: (1) `await getSessionUser()` (`:60`, session read), (2) `await prisma.user.findUnique({ where:{ steamId } })` (`:61-64`, one DB read), (3) `await canViewProfile(...)` (`:68`, authorization — may itself do DB/session work), then only if allowed (4) `await getProfile(steamId)` (`:80`). These are genuinely sequential and mostly **data-dependent** — the authz gate is an intentional IDOR boundary that must complete *before* target data is fetched (comment `:67`, `:11-13`), so 1→2→3→4 cannot simply be `Promise.all`'d without breaking the security invariant. The only latency that is arguably sheddable is that steps 1 and 2 are independent of each other (session vs. target privacy lookup) yet run serially; they could be parallelised. There is no in-page Suspense and `dynamic = 'force-dynamic'` (`:27`).

**Cost:** Small and fixed: one session read + one indexed `user.findUnique` (unique on `steamId`) + the authz call, then the profile fetch (two Steam calls, cached). The serial-vs-parallel waste is only the overlap of the session read and the user lookup — tens of ms at most, both cheap. The authz gate is required serial work, not waste. This is a correctness-shaped ordering, not a hot loop.

**Blast radius:** Only the public-profile route `/u/[steamId]`, hit when a visitor views someone else's dashboard — comparatively rare vs. the owner's own pages. Does not scale with N or with history.

**Cross-refs:** Shares `getProfile` (two Steam calls) with RSC-1/RSC-2 but for a **different** steamId (the target, not the viewer) so single-flight does **not** dedup it against the shell. Shares `force-dynamic` + ephemeral cache with the bug-3 cohort but is not an insights page. Not previously covered by bug-3. Lowest-leverage finding in this theme — the serial chain is largely mandated by the authorization boundary.

**Evidence:**

| File | Line | Quote |
|------|------|-------|
| `app/u/[steamId]/page.tsx` | 60 | `const viewer = await getSessionUser();` |
| `app/u/[steamId]/page.tsx` | 61-64 | `const user = await prisma.user.findUnique({ where: { steamId }, select: { privacy: true } });` |
| `app/u/[steamId]/page.tsx` | 68 | `const allowed = await canViewProfile(viewer?.steamId ?? null, { steamId, privacy });` |
| `app/u/[steamId]/page.tsx` | 80 | `const data = await getProfile(steamId);` |
| `app/u/[steamId]/page.tsx` | 67 | comment: "Authorization gate — decided BEFORE any of the target's data is fetched." (serial ordering is intentional) |

---

## RSC-9 — getGameStoreMetadata awaited in both generateMetadata and page body

**Verdict:** refuted (as a duplicate-fetch cost); the mechanism exists but the cost the scout claims does not.

**Mechanism:** `getGameStoreMetadata(appIdNum)` is awaited in `generateMetadata` (`app/game/[appId]/page.tsx:54`) and again in the page body (`:105`) — but the page-body call is **guarded**: it only runs on the `!name || !headerUrl` path, i.e. when the game is **not** in the viewer's owned library (`:104`). Both calls hit the **identical cache key** `store-metadata:global:<appId>` (`server/repositories/store.ts:22`). Next.js runs `generateMetadata` and the page render concurrently for the same request; on a cold cache the two calls miss simultaneously and the repo cache's **single-flight map collapses them onto one loader** (`server/cache.ts:93-107`). If they happen to run slightly staggered, the second is a straight cache hit against the **7-day** `storeMetadata` TTL (`server/cache/ttl.ts:12`). Either way the number of upstream Store fetches on cold cache is **1, not 2**. The scout's "duplicate store fetch on cold cache" does not occur.

**Cost:** Effectively zero incremental — one Store fetch at most, and only on the non-owned-game path (owned games already have `name`+`headerUrl` from the profile, so the page body skips the call entirely). Warm cache: 7-day TTL, near-permanent hit. The page also already uses **proper in-page `<Suspense>`** for its two independent sections (`:127-134`), so unlike the insights pages this route is the *good* streaming pattern, not a blocking one.

**Blast radius:** `/game/[appId]` only, and only the metadata call — negligible. This route is a positive example (independent sections each behind their own geometry-matched skeleton), the opposite of the shell/insights blocking pattern.

**Cross-refs:** Single-flight dedup mechanism is the same one that rescues RSC-1/RSC-2 from double-fetching. Demonstrates the streaming pattern that RSC-1/RSC-2 (shell) and RSC-6 (insights) are missing — a useful contrast/target. Not a bug-3 item.

**Evidence:**

| File | Line | Quote |
|------|------|-------|
| `app/game/[appId]/page.tsx` | 54 | `const meta = await getGameStoreMetadata(appIdNum);` (inside `generateMetadata`) |
| `app/game/[appId]/page.tsx` | 104-105 | `if (!name || !headerUrl) { const meta = await getGameStoreMetadata(appIdNum).catch(() => null);` — guarded, non-owned path only |
| `server/repositories/store.ts` | 22-23 | `const key = cacheKey('store-metadata', 'global', appId); const result = await cache(key, TTL.storeMetadata, () => getStoreMetadata(appId));` — same key both call sites |
| `server/cache/ttl.ts` | 12 | `storeMetadata: 604800, // 7 days` |
| `app/game/[appId]/page.tsx` | 127-134 | `<Suspense fallback={<GameAchievementsSkeleton />}>` … `<Suspense fallback={<GameStoreSkeleton />}>` — this route streams correctly |

---

## Theme-level ranking

1. **RSC-1 + RSC-2 (shell blocking) — DOMINANT for this theme.** They are the only findings that tax **every route on every cold load**. No Suspense sits between `app/layout.tsx`'s async header/sidebar and `{children}`, so the whole document's first paint waits on `getViewerSteamId` → `getProfile` (+`getLevel`). This is a genuinely **new** shell-level finding that bug-3 did not cover (bug-3 scoped its no-Suspense analysis to insights page bodies). Fix direction: wrap `<AppHeader/>` and `<Sidebar/>` in `<Suspense>` (with skeletons) so the shell streams and the page body is never gated on shell data; and/or have them read only the counts they need rather than the full owned-games array.
2. **RSC-6 (cost-per-hour blocking) — already settled by bug-3.** Real but page-scoped and cheaper than genres/idle; cite bug-3 #2/#5, do not re-litigate. Fix direction: in-page `<Suspense>` + relax `force-dynamic` to ISR for read-mostly aggregates.
3. **RSC-8 (/u serial chain) — low, mostly mandated.** The serial order is an intentional IDOR authz boundary; only the session-read/user-lookup overlap is sheddable. Fix direction: `Promise.all` the two independent pre-authz reads; leave the gate serial.
4. **RSC-9 (game metadata "duplicate") — refuted.** Single-flight + 7-day TTL + the owned-game guard mean at most one Store fetch; the route is actually a model of correct Suspense streaming. No action.

## Open questions (need runtime measurement)

- **What is the real added first-paint latency from the shell awaits?** Code confirms the mechanism; the wall-clock depends on Steam RTT and cold-instance frequency. Close it with a `performance.now()` around `getProfile`/`getLevel` in `AppHeader`/`Sidebar` on a real cold render, or a Vercel function-duration trace for any route (they all inherit the shell). Expect the shell cold-path ≈ the slowest single Steam call (~0.4-1.2 s).
- **How often are instances cold in prod?** The persist-across-soft-nav nuance means the tax is per cold document load, not per click. The frequency (and thus aggregate impact) depends on serverless concurrency/traffic — read deployment metrics.
- **Confirm no `fetch`-level memoization is silently helping.** Verified no React `cache()`; the Steam client uses a raw limiter, not Next's patched `fetch` cache, so dedup is solely the repo single-flight map (concurrent-miss only). A staggered (non-concurrent) cold miss between shell components would NOT dedup — worth confirming the render is concurrent in practice.
