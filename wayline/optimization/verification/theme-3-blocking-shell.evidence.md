# Evidence — Theme 3: Blocking shell and un-streamed pages

> Read-only **adversarial** verification of the scout's Theme-3 investigation.
>
> **Branch:** `altan/optimization` · **HEAD:** `13023e335764daed73900fabc0d88eab4d190eff` · **Date:** 2026-07-09 · **Phase:** verification
>
> **Reviewer:** adversarial second-pass (separate context from scout). Every file:line below was re-opened this run.

## Reviewer verdict summary

| Finding | Scout verdict | Reviewer verdict | One-line |
|---------|---------------|------------------|----------|
| RSC-1 | needs-measurement | **CONFIRMED** (mechanism); magnitude gated | Shell blocks first paint on 2 limiter-gated Steam calls, no Suspense — code-certain. Wall-clock ms is runtime-gated. |
| RSC-2 | needs-measurement | **CONFIRMED** (mechanism), with **cost-model correction** | `getLevel` is a genuinely new call, but the scout's "wall-clock = slowest single call" UNDERSTATES: all 3 Web API calls share one `steamLimiter` token bucket → ≥500 ms serialized acquire floor. |
| RSC-6 | confirmed | **CONFIRMED** | force-dynamic + serial awaits + no in-page Suspense; already settled by bug-3 #2/#5. |
| RSC-8 | confirmed (low) | **CONFIRMED** (low, mostly mandated) | 4 serial awaits real; the authz ordering is a required IDOR boundary. Only steps 1/2 are sheddable. |
| RSC-9 | refuted | **REFUTED upheld** (and strengthened) | At most one Store fetch on cold cache. Scout under-counted the call *sites* (3, not 2), all collapsing to one key — refutation is stronger, not weaker. |

No stale line anchors found — every anchor the scout cited is accurate at HEAD (rare; noted below). Two scout **cost errors** flagged on findings I still confirm (RSC-2 limiter model; RSC-9 call-site count).

---

## RSC-1 — Sidebar awaits getViewerSteamId + getProfile in the shell, no Suspense

**Verdict: CONFIRMED (mechanism). Wall-clock magnitude → gated.**

The mechanism is code-certain. `app/layout.tsx` mounts `<AppHeader />` then `<Sidebar />` as direct children of `<body>` with **no `<Suspense>`** anywhere in the shell (grep `Suspense` over `app/layout.tsx` + `components/layout/` returned *"none in shell"*). React cannot flush the document until every non-suspended async child settles, so the two sequential awaits in `Sidebar` gate the first streamed byte. `getViewerSteamId` is a **session read only** (`server/auth.ts:281-288` → `getSessionUser`, no Steam call), and `getProfile` fires two limiter-gated Steam calls via `Promise.all` (`server/repositories/profile.ts:32-43`). The scout's single-flight dedup correction is verified: there is **no** `import { cache } from 'react'` in source (grep returned only the wayline doc itself), so dedup is solely the repo cache's `inFlight` map (`server/cache.ts:36`, `93-107`).

**Evidence:**

| File | Line | Finding (opened this run) |
|------|------|---------|
| `app/layout.tsx` | 66-69 | `<AppHeader />` … `<div className="flex"><Sidebar />` … `{children}` — no `<Suspense>` around any of them (confirmed by grep: no Suspense in shell). |
| `components/layout/Sidebar.tsx` | 18-19 | `const viewerId = await getViewerSteamId();` then `const { games } = await getProfile(viewerId);` — sequential (id needed before profile). |
| `components/layout/Sidebar.tsx` | 20-21 | `libraryCount = games.length;` / `untouchedCount = games.filter((game) => game.playtime.total === 0).length;` — full owned-games array materialised for two integers. |
| `server/repositories/profile.ts` | 32-43 | `const [summary, games] = await Promise.all([ cache(...getPlayerSummaries(id)), cache(...getOwnedGames(id)) ])` — two Steam calls per `getProfile`. |
| `server/auth.ts` | 281-288 | `getViewerSteamId` = `await getSessionUser()` + env fallback — a session read, **not** a Steam/network call. Scout's "session read" claim confirmed. |
| `server/cache.ts` | 93-107 | single-flight `inFlight.get(key)` join — concurrent misses collapse to one loader. Dedup mechanism confirmed. |

**Scout accuracy:** anchors exact; single-flight and "no React cache()" corrections both independently reproduced. The "persists across soft nav / paid per cold document load" nuance is correct (App Router root layouts are not re-rendered on soft navigation).

---

## RSC-2 — AppHeader second profile + level fetch in the shell, un-streamed

**Verdict: CONFIRMED (mechanism). COST-MODEL CORRECTION: scout understates the limiter floor.**

Mechanism confirmed: `AppHeader` awaits `getViewerSteamId()` then `Promise.all([getProfile(...).catch, getLevel(...).catch])` un-suspended at `app/layout.tsx:66`. `getProfile` shares the Sidebar's `player-summaries:<id>` / `owned-games:<id>` keys → deduped via single-flight (no second owned-games fetch — confirmed). `getLevel` is a **genuinely new** limiter-gated call (`server/repositories/level.ts:22-30` → `lib/steam/level.ts:104` `await steamLimiter.acquire()`), TTL 24 h (`ttl.ts:9`).

**Correction (scout error, finding still confirmed):** The scout writes *"the wall-clock is the slowest single Steam call, not the sum"* (report line 49). That understates the cold floor. **All three distinct Web API calls acquire the SAME `steamLimiter` singleton** — capacity 1, refill 250 ms (`lib/steam/limiter.ts:12,85`):
- `getPlayerSummaries` → `client.ts:123` `await steamLimiter.acquire()`
- `getOwnedGames` → `client.ts:171` `await steamLimiter.acquire()`
- `getSteamLevel` → `level.ts:104` `await steamLimiter.acquire()`

With one token and 250 ms refill, the three acquisitions are **serialized at the bucket**: token grants at ≈ t=0, t=250 ms, t=500 ms. So on a fully cold shell the limiter alone imposes a **~500 ms floor before the third call's network even starts**, plus that call's RTT. The true cold wall-clock is therefore *between* "slowest single call" (scout's floor, too low) and "sum of all RTTs" (too high): **≈ 500 ms limiter spacing + last-call RTT**, not `max(call)`. The finding is thus slightly **worse** than the scout stated, not better. Retry schedule compounds the tail: a transient failure adds up to `250+1000+4000 = 5.25 s` of backoff per call (`lib/steam/retry.ts:5-6`) before the cache serves a stale value or throws.

**Evidence:**

| File | Line | Finding (opened this run) |
|------|------|---------|
| `app/layout.tsx` | 66 | `<AppHeader />` — first element in `<body>`, no Suspense. |
| `components/layout/AppHeader.tsx` | 36-46 | `const featuredId = await getViewerSteamId(); const [profileResult, levelResult] = await Promise.all([ getProfile(featuredId).catch(...), getLevel(featuredId).catch(...) ])`. |
| `components/layout/AppHeader.tsx` | 50 | `profileResult.games.reduce((sum, game) => sum + game.playtime.total, 0)` — O(N) over full library (trivial). |
| `server/repositories/level.ts` | 22-30 | `getLevel` → `cache(cacheKey('steam-level', id), TTL.steamLevel, () => getSteamLevel(id))` — distinct call/key. |
| `lib/steam/limiter.ts` | 12, 85 | `const REFILL_INTERVAL_MS = 250;` / `export const steamLimiter = new TokenBucketLimiter(1, REFILL_INTERVAL_MS)` — **one shared** bucket, capacity 1. |
| `lib/steam/client.ts` | 123, 171 | `getPlayerSummaries` and `getOwnedGames` each `await steamLimiter.acquire()` — same singleton. |
| `lib/steam/level.ts` | 104 | `getSteamLevel` `await steamLimiter.acquire()` — same singleton → 3-way serialization. |
| `lib/steam/retry.ts` | 5-6 | `DEFAULT_ATTEMPTS = 4`, `DEFAULT_BACKOFF_MS = [250, 1000, 4000]` — worst-case per-call tail ≈ 5.25 s. |

---

## RSC-6 — cost-per-hour page blocks on repo work, force-dynamic, no Suspense

**Verdict: CONFIRMED. Already settled by bug-3 (#2/#5); no re-litigation.**

`export const dynamic = 'force-dynamic'` (`:21`) and two serial page-body awaits (`getViewerSteamId` → `getCostPerHour`) with **no `<Suspense>` in the file** (only route-level `app/loading.tsx` exists — confirmed present, but it covers the route transition, not in-page streaming). The bug-3 receipt already establishes `getCostPerHour` does **zero** Store network calls post-ERR-0011 (reads `ownedGame` + `Game` from DB), so the residual cost is the un-streamed blocking await + `force-dynamic` (no ISR) + ephemeral in-process Map cache (`server/cache.ts:32`) that re-runs the DB work on cold instances. Cross-checked against `docs/ERROR.md:295-303` (ERR-0011, Status: Fixed) — the O(N) Store fan-out was migrated away for this page; consistent.

**Evidence:**

| File | Line | Finding (opened this run) |
|------|------|---------|
| `app/insights/cost-per-hour/page.tsx` | 21 | `export const dynamic = 'force-dynamic';` |
| `app/insights/cost-per-hour/page.tsx` | 41-42 | `const viewerId = await getViewerSteamId(); const { result, stale } = await getCostPerHour(viewerId);` — serial; no `Suspense` import/usage anywhere in file. |

---

## RSC-8 — /u/[steamId] runs 4 serial awaits before any data fetch

**Verdict: CONFIRMED (mechanism); low impact, ordering mostly mandated.**

The four serial awaits reproduce exactly: `getSessionUser` (`:60`), `prisma.user.findUnique` on target steamId (`:61-64`), `canViewProfile` (`:68`), then `getProfile` (`:80`) only if `allowed`. The scout's core defense holds: the ordering is an intentional **IDOR authz boundary** — the comment at `:12-13` ("a viewer can never see another user's private / derived data — canViewProfile decides before any data is fetched") and `:67` make 3→4 a mandated serial gate, not sheddable waste. The only independent pair is steps 1 (session read) and 2 (target-privacy `user.findUnique`, indexed unique on `steamId`), which could be `Promise.all`'d for a tens-of-ms overlap. `dynamic = 'force-dynamic'` (`:27`), no in-page Suspense — but this is a rarely-hit visitor route, not on the owner's hot path, and does not scale with N or history.

**Evidence:**

| File | Line | Finding (opened this run) |
|------|------|---------|
| `app/u/[steamId]/page.tsx` | 60 | `const viewer = await getSessionUser();` |
| `app/u/[steamId]/page.tsx` | 61-64 | `const user = await prisma.user.findUnique({ where: { steamId }, select: { privacy: true } });` — independent of step 1. |
| `app/u/[steamId]/page.tsx` | 68 | `const allowed = await canViewProfile(viewer?.steamId ?? null, { steamId, privacy });` — authz gate. |
| `app/u/[steamId]/page.tsx` | 80 | `const data = await getProfile(steamId);` — only reached when `allowed`. |
| `app/u/[steamId]/page.tsx` | 12-13, 67 | Comments confirming the serial order is a deliberate IDOR boundary ("decided BEFORE any of the target's data is fetched"). |
| `app/u/[steamId]/page.tsx` | 27 | `export const dynamic = 'force-dynamic';` |

Note: `getProfile(steamId)` here is for the **target** steamId, not the viewer's, so single-flight does **not** dedup it against the shell's `getProfile` — scout correct.

---

## RSC-9 — getGameStoreMetadata awaited in generateMetadata and page body

**Verdict: REFUTED (scout's refutation upheld — and strengthened).**

The scout refuted its own seed's "duplicate store fetch on cold cache" claim, and that refutation is correct. The page-body call is guarded to the `!name || !headerUrl` (non-owned) path (`:104-105`); both call sites hit the identical key `store-metadata:global:<appId>` (`server/repositories/store.ts:22`); single-flight (`cache.ts:93-107`) collapses concurrent misses and the 7-day TTL (`ttl.ts:12`) makes any staggered second call a hit. Upstream Store fetches on cold cache = **1, not 2**.

**Strengthening (scout under-count):** the scout said "two call sites." There are actually **three** call sites for `getGameStoreMetadata(appId)` reachable on a `/game/[appId]` render — `generateMetadata` (`:54`), the guarded body (`:105`), **and** `GameStoreSection.tsx:20` inside the `<Suspense>` boundary (`page.tsx:132-133`). All three share the same `store-metadata:global:<appId>` key, so they still collapse to **at most one** upstream fetch. The refutation is therefore *more* robust than the scout argued, not less. This route is also the correct streaming pattern (per-section Suspense with geometry-matched skeletons, `:127-134`) — the positive contrast to RSC-1/RSC-2/RSC-6.

**Evidence:**

| File | Line | Finding (opened this run) |
|------|------|---------|
| `app/game/[appId]/page.tsx` | 54 | `const meta = await getGameStoreMetadata(appIdNum);` (inside `generateMetadata`). |
| `app/game/[appId]/page.tsx` | 104-105 | `if (!name || !headerUrl) { const meta = await getGameStoreMetadata(appIdNum).catch(() => null);` — guarded, non-owned path. |
| `components/game/GameStoreSection.tsx` | 20 | `getGameStoreMetadata(appId)` — **third** call site, inside the Suspense-wrapped section; same cache key. |
| `server/repositories/store.ts` | 22-23 | `const key = cacheKey('store-metadata', 'global', appId); const result = await cache(key, TTL.storeMetadata, () => getStoreMetadata(appId));` — one key, all sites. |
| `server/cache/ttl.ts` | 12 | `storeMetadata: 604800, // 7 days`. |
| `app/game/[appId]/page.tsx` | 127-134 | Two independent `<Suspense fallback={...}>` sections — correct streaming pattern. |

---

## Stale anchors (claimed vs actual)

| Finding | File | Claimed | Actual | Status |
|---------|------|---------|--------|--------|
| RSC-1 | `components/layout/Sidebar.tsx` | 18-19, 20-21 | 18-19, 20-21 | ✅ exact |
| RSC-1 | `app/layout.tsx` | 66-69 | 66-69 | ✅ exact |
| RSC-1 | `server/repositories/profile.ts` | 32-43 | 32-43 | ✅ exact |
| RSC-2 | `components/layout/AppHeader.tsx` | 36-46, 50 | 36-46, 50 | ✅ exact |
| RSC-2 | `server/cache.ts` | 93-107 | 93-107 | ✅ exact |
| RSC-6 | `app/insights/cost-per-hour/page.tsx` | 21, 41-42 | 21, 41-42 | ✅ exact |
| RSC-8 | `app/u/[steamId]/page.tsx` | 60, 61-64, 68, 80, 67 | 60, 61-64, 68, 80, 67 | ✅ exact |
| RSC-9 | `app/game/[appId]/page.tsx` | 54, 104-105, 127-134 | 54, 104-105, 127-134 | ✅ exact |
| RSC-9 | `server/repositories/store.ts` | 22-23 | 22-23 | ✅ exact |
| RSC-9 | `server/cache/ttl.ts` | 12 | 12 | ✅ exact |

**No stale anchors.** Every line the scout cited resolves correctly at HEAD `13023e33`.

## Scout errors flagged (on otherwise-confirmed findings)

1. **RSC-2 cost model (material):** "wall-clock is the slowest single Steam call, not the sum" understates. All three Web API calls (`summaries`, `owned-games`, `level`) share the single `steamLimiter` (capacity 1, 250 ms refill), so their `acquire()`s serialize → ~500 ms limiter floor before the third call's network begins. Real cold floor ≈ `500 ms + last-call RTT`, i.e. worse than the scout's estimate. Does not change the verdict (mechanism/blocking is real), but the number the scout would report is too low.
2. **RSC-9 call-site count (minor):** scout counted two `getGameStoreMetadata` sites; there are three (`generateMetadata:54`, body `:105`, `GameStoreSection.tsx:20`). All share the same key, so the "≤1 upstream fetch" refutation is unaffected — actually reinforced.

## Blast-radius corrections

- **RSC-1/RSC-2 blast radius is accurate but the *mechanism* of the tax is the shared limiter, not independent network latency.** The scout frames the shell cost as parallel Steam RTTs; because all shell calls share one token bucket the true cost is serialized-acquire spacing. Correct fix direction unchanged (wrap `<AppHeader/>`/`<Sidebar/>` in `<Suspense>` so the shell streams; and/or read only the needed counts rather than the full owned-games array — but note that reducing the array read does NOT remove the limiter serialization of the underlying calls).
- **RSC-6 blast radius** correctly scoped to one page; the ephemeral-cache / force-dynamic cohort is fully documented in the bug-3 receipt — no new blast radius.
- **RSC-8** correctly scoped to the `/u/[steamId]` visitor route; the target-`getProfile` is not deduped against the shell (different steamId) — verified.

## Gated checks — human live lane (read-only; never run inside this verification)

These settle the magnitude of the two mechanism-CONFIRMED findings whose ms cost depends on runtime data neither agent can read.

### `shell-timing` (settles RSC-1 + RSC-2 wall-clock)
```
Add performance.now() around getViewerSteamId → getProfile in components/layout/Sidebar.tsx
and around Promise.all([getProfile, getLevel]) in components/layout/AppHeader.tsx on a real
COLD render (clearCache() first / fresh serverless instance). OR read the Vercel function-duration
trace for any route — all routes inherit the shell.
```
**Expect:** cold shell duration ≥ ~500 ms (three `steamLimiter` acquisitions at 250 ms spacing) **plus** the last call's Steam RTT — NOT `max(single call)`. Warm cache: sub-ms Map hits, but still a pre-paint `await` boundary. If a transient Steam failure occurs, add up to 5.25 s of retry backoff per affected call (`retry.ts:6`).

### `cold-frequency` (settles aggregate impact)
```
Read deployment/serverless metrics for cold-start rate and soft-vs-hard navigation mix.
```
**Expect:** the shell tax is paid per **cold document load** (first visit, refresh, direct URL, cold instance), not per in-app soft navigation (root layout persists across soft nav). Aggregate impact scales with cold-load frequency.
