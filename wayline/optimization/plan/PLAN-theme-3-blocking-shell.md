# PLAN — Theme 3: Blocking shell and un-streamed pages

> **Theme:** 3 — Blocking shell and un-streamed pages
> **Branch:** `altan/optimization` · **Investigation HEAD:** `13023e3` · **Date:** 2026-07-09
> **Status: DRAFT — pending adversarial review**
>
> Sequencing note (binding, from `investigation/SUMMARY.md`): this theme is **first repo-wide**.
> Until the shell stops gating first paint, every other theme's before/after LCP measurement is
> confounded — Themes 1/2/4/5 plans should land their measurement baselines *after* T2 below ships.

## Root causes addressed

| ID | Reviewer verdict | Receipt justification | Named gated check |
|----|------------------|------------------------|-------------------|
| RSC-1 | **CONFIRMED** (mechanism; magnitude gated) | `app/layout.tsx:66-69` mounts async `<Sidebar />` with **no `<Suspense>` anywhere in the shell**; `Sidebar.tsx:18-19` awaits `getViewerSteamId()` → `getProfile()` (2 limiter-gated Steam calls, `profile.ts:32-43`); document flush is gated on Steam. Dedup vs AppHeader is single-flight only (`server/cache.ts:93-107`), no React `cache()` exists. | `shell-timing` (cold `performance.now()` around the shell awaits or Vercel function-duration trace); `cold-frequency` (aggregate impact) |
| RSC-2 | **CONFIRMED** (mechanism), cost model **corrected upward** | `AppHeader.tsx:36-46` adds `getLevel` — a 3rd distinct Web API call. All 3 calls acquire the SAME `steamLimiter` (capacity 1, 250 ms refill — `limiter.ts:12,85`; acquires at `client.ts:123,171`, `level.ts:104`): acquires serialize at 0/250/500 ms → cold floor **≈ 500 ms + last-call RTT**, worse than max-of-calls. A single Steam transient adds up to **5.25 s** of retry backoff (`retry.ts:5-6`). | Same `shell-timing` check — expected reading is the serialized-acquire floor, NOT `max(call)` |
| RSC-8 | **CONFIRMED** (low; ordering mostly mandated) | `app/u/[steamId]/page.tsx:60-80`: 4 serial awaits, but the authz-before-data ordering is a **mandated IDOR boundary** (comments `:12-13`, `:67`). Only the session read (`:60`) ∥ target-privacy lookup (`:61-64`) pair is sheddable — ~tens of ms. | None (magnitude is code-bounded: one session read + one indexed unique lookup) |

### Folded / excluded

| ID | Disposition | One-line reason |
|----|-------------|-----------------|
| RSC-6 | **FOLDED** into bug-3 fix lane | cost-per-hour blocking pattern (force-dynamic + serial awaits + no in-page Suspense) is already settled by bug-3 findings #2/#5 (`wayline/evidence/verification/bug-3-insights-slow.evidence.md`); this plan creates **no duplicate task** — bug-3's Suspense/ISR work owns it. Coordination note in T2 acceptance criteria. |
| RSC-9 | **REFUTED — no work planned** | Three `getGameStoreMetadata` call sites on `/game/[appId]` collapse to one `store-metadata:global:<appId>` key via single-flight + 7-day TTL + owned-path guard → ≤1 upstream fetch. The route is the repo's **positive** Suspense-streaming example — this plan cites it as the pattern to imitate (`app/game/[appId]/page.tsx:127-134`). |

## Chosen fix

**Stream the shell: wrap `<AppHeader />` and `<Sidebar />` in `<Suspense>` boundaries with geometry-matched static skeletons, so the document flushes immediately and Steam I/O resolves into an already-painted page. Additionally parallelize the one sheddable pre-authz pair on `/u/[steamId]`.**

### Mechanism — why this removes the verified root cause

The root cause is **not** the number of Steam calls (single-flight already dedupes the shared `getProfile`) and not primarily their RTT — it is that React cannot flush *any* byte of the document while un-suspended async children of the root layout are pending. The three limiter-serialized calls (~500 ms floor + last RTT cold; up to +5.25 s on one transient) therefore sit on the **first-paint critical path of every route**.

Wrapping each shell component in its own `<Suspense>`:

1. **Removes Steam from the critical path structurally.** The layout's static markup (fonts, theme script, skeleton header/sidebar, and — crucially — `{children}` as they resolve) streams at once. `AppHeader`/`Sidebar` hydrate their real content whenever their awaits settle. The 500 ms limiter floor and the 5.25 s retry tail still exist, but they now cost a skeleton→content swap inside an interactive page, not a blank tab.
2. **Attacks the mechanism, not the symptom.** Shrinking the payload (e.g. a count-only query) or caching harder would only shorten the block; any cold instance, cache expiry, or Steam transient would re-block first paint. Suspense makes first paint **independent** of Steam health — which is also the degrade-never-crash posture the repo already mandates for data.
3. **Two boundaries, not one.** Header and Sidebar suspend independently, so the faster one (usually Sidebar, whose `getProfile` may be warmed) paints without waiting for `getLevel` (the header's unique long pole, per the receipt).
4. **Covers a third async node the investigation under-counted.** The receipt names AppHeader + Sidebar, but the header subtree contains a THIRD async server component: `AuthControls` (`components/auth/AuthControls.tsx:17`), which awaits `getSessionUser()` + a single-flight-deduped `getProfile()`. It adds no new Steam call (dedup; the session read is not Steam), so the ~500 ms serialized-limiter floor stands — but it also comes off the critical path once AppHeader is Suspense-wrapped, and its data awaits are exactly why `HeaderSkeleton` must NOT reuse it (see T1 binding rule).
5. **Preserves single-flight dedup.** Both components still render concurrently within the same request; concurrent cold misses on `player-summaries:<id>` / `owned-games:<id>` still collapse via `server/cache.ts` `inFlight`. No fetch-count regression.

Deliberately **out of scope** (dependencies stated, not decided — per lane rules):

- **Durable cache backend** (`server/cache.ts` in-process Map, REDIS_URL unread): owned by bug-3's fix lane. This plan's warm-path behavior *improves* if that lands but does not depend on it.
- **Limiter partitioning** (STEAM-4, Phase 6 amplification): Theme 2/5 lane. This plan does not touch `lib/steam/limiter.ts`. Explicitly deferred: shell streaming reduces the *user-visible* cost of limiter serialization but does not change bucket semantics.
- **Reducing `getProfile`'s full owned-games materialization** for two integers (Sidebar) / one sum (AppHeader): a real but secondary inefficiency; the receipt notes reducing the array read does NOT remove limiter serialization. Left as a candidate follow-up (would require a count-shaped repository read), not tasked here to keep the change surgical and CLS-safe.

### Rejected alternatives

1. **Demote AppHeader/Sidebar to client components fetching `/api/*` after mount.** Rejected: violates the RSC-by-default rule (explicitly named in the theme constraints), adds client JS against the <200 KB budget, introduces a second render/fetch waterfall from the browser, and would need new `/api` endpoints (API-surface churn) for data the server already has. Suspense achieves the same "paint first, data later" with zero new JS and zero API changes.
2. **Hoist the fetches into `app/layout.tsx` and pass promises down (or add React `cache()` memoization).** Rejected: still blocks the document unless the consumers are Suspense-wrapped (so it adds complexity without removing the need for this plan's core change), and the receipt verified dedup already works via single-flight — React `cache()` would be redundant machinery.
3. **Cache harder / precompute the counts nightly so the shell awaits are always warm.** Rejected as a *substitute*: `server/cache.ts` is an in-process Map that resets on every serverless cold start (settled in the bug-3 receipt), so "always warm" is unachievable without the durable-cache decision that belongs to bug-3's lane; and even a warm hit leaves first paint structurally coupled to whatever the shell awaits next. Complements welcome later; not a fix.
4. **For RSC-8, `Promise.all` more of the chain (e.g. prefetch `getProfile` alongside authz).** Rejected outright: fetching target data before `canViewProfile` resolves breaks the mandated IDOR boundary ("decided BEFORE any of the target's data is fetched", `page.tsx:67`). Only the viewer-session ∥ target-privacy pair is independent; everything downstream stays serial.

## Invariants compliance

| Invariant | How this plan respects it |
|-----------|---------------------------|
| RSC by default | `AppHeader`/`Sidebar` remain async RSCs; skeletons are static server components. Zero new `"use client"`. |
| Suspense skeletons match final geometry (no CLS) | `HeaderSkeleton` reproduces the exact `h-14 sticky top-0` header bar (wordmark and static nav can render for real inside the skeleton — only the data badges are placeholder); `SidebarSkeleton` reproduces `w-60 sticky top-14 h-[calc(100vh-3.5rem)] hidden lg:block`. Acceptance criteria assert identical box dimensions. |
| Degrade, never crash or fabricate | Unchanged and preserved: `Sidebar`'s try/catch renders nav without counts; `AppHeader`'s `.catch(() => null)` → `—` placeholders. Skeleton→degraded-content is still a designed state, never a thrown error or fabricated number. |
| TTLs only in `server/cache/ttl.ts` | No TTL is added, moved, or inlined. Cache keys/TTLs untouched. |
| withErrorBoundary owns error mapping | No route handlers are touched. |
| Zod at I/O boundaries | No I/O shapes change; no new I/O. |
| `steamId` is a string | Untouched; `getViewerSteamId(): Promise<string>` signatures unchanged. |
| Migrations immutable / none proposed | **No migrations** in this plan. |
| Performance budget (<200 KB JS, LCP <2.5 s) | Net JS delta ≈ 0 (server-rendered skeletons); LCP strictly improves — that is the point. |
| Tailwind tokens only / lucide 1.75 / designed empty states | Skeletons use existing tokens (`bg-surface-2`, `border-border`, etc.); no hex, no new icon sets. |
| IDOR/authz ordering on `/u/[steamId]` | T3 parallelizes ONLY `getSessionUser()` ∥ `prisma.user.findUnique()`; `canViewProfile` still completes before `getProfile(steamId)` is invoked, verified by test. |

## Task breakdown

### T1 — Shell skeletons: `HeaderSkeleton` + `SidebarSkeleton`

**Scope in:** new `components/layout/HeaderSkeleton.tsx`, new `components/layout/SidebarSkeleton.tsx`. Both are synchronous, presentational server components (no data access, no `"use client"`).
**Scope out:** `app/layout.tsx` (T2), any data code, `SidebarNav.tsx`/`NavLinks.tsx` internals (may be *reused* inside skeletons — note they are `"use client"` components calling `usePathname()`, not static server markup; rendering them inside a server skeleton is permitted and CLS-positive since nav geometry is identical across the Suspense swap).

Design: the skeletons render the real static chrome where it needs no data — `HeaderSkeleton` renders the wordmark, `<MobileNav />`-sized spacer or the real static nav, a real `ThemeToggle`, and pulse blocks where the level badge / total-playtime / `AuthControls` cluster sits, inside the identical `<header className="sticky top-0 z-40 border-b border-border bg-bg">` + `h-14` row. `SidebarSkeleton` renders the identical `<aside>` box with `SidebarNav`-shaped placeholder rows (nav labels may render for real via the client `SidebarNav`; only the count chip pulses).

**Binding rule — `AuthControls` is a STATIC placeholder in `HeaderSkeleton`, never rendered for real.** `AuthControls` (`components/auth/AuthControls.tsx:17`) is an ASYNC server component: `export async function AuthControls(): Promise<JSX.Element>` awaiting `getSessionUser()` and `getProfile()`. If it were rendered for-real inside the Suspense `fallback`, the fallback itself would suspend; with no other boundary in the shell that suspension propagates upward and re-couples document flush to Steam — silently reinstating the exact coupling T2 removes, with `getProfile` (the very call this theme takes off the critical path) as the culprit. `HeaderSkeleton` therefore renders a fixed-size pulse block (avatar-circle + name-bar geometry matching both the `<UserMenu>` and `<SignInButton>` footprints as closely as one static shape allows) in the `AuthControls` slot. For-real reuse inside skeletons is reserved for **genuinely synchronous or `"use client"` components only**: `ThemeToggle`, `NavLinks`, `MobileNav`, `SidebarNav` (all `"use client"`). Implementer verifies every skeleton import is sync/client and drags no server data access into the fallback.

**Swap-inertness note:** any client component reused for-real in a fallback (e.g. `ThemeToggle`, `NavLinks`/`SidebarNav`) unmounts from the fallback and remounts in the resolved shell on the Suspense swap — geometry is identical (no CLS) but a brief visual flash is possible; the implementer must verify the swap is visually inert (identical markup/appearance in both trees) or fall back to a pulse placeholder for that slot.

**Acceptance criteria:**
- Both skeletons are server components with **no** async/await, no imports from `server/**` or `@/server/*`, and **no import of `AuthControls` or any other async server component** (the `AuthControls` slot is a static placeholder — see binding rule above).
- Rendered skeleton boxes have byte-identical layout-affecting classes to the real components' outer elements (header: `sticky top-0 z-40 border-b border-border bg-bg` + inner `h-14`; sidebar: `sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 ... lg:block`) — asserted by test.
- No hardcoded hex; tokens only. `pnpm typecheck && pnpm lint` green.

### T2 — Wrap shell in Suspense in `app/layout.tsx`

**Scope in:** `app/layout.tsx` only.
**Scope out:** `AppHeader.tsx`/`Sidebar.tsx` internals (their awaits are now fine where they are), everything under `app/insights/**` (bug-3 lane owns RSC-6 — do not touch, do not duplicate).

Change: `<Suspense fallback={<HeaderSkeleton />}><AppHeader /></Suspense>` and `<Suspense fallback={<SidebarSkeleton />}><Sidebar /></Suspense>`; `{children}` stays outside both boundaries.

Note on `{children}` streaming: children stream via the existing route-level `loading.tsx` mechanism. Be aware `app/loading.tsx` is homepage-shaped geometry (`HomeLoading`: profile-header + game-grid skeleton) and serves as the ROOT fallback for every child route lacking its own `loading.tsx` — so non-homepage routes without their own `loading.tsx` fall back to a homepage-shaped skeleton. That is **pre-existing behavior, out of Theme-3 scope, and not a regression introduced by these boundaries**; noted so it isn't mistaken for one.

**Acceptance criteria:**
- `app/layout.tsx` contains exactly two `<Suspense>` boundaries, one per shell component; `{children}` is NOT inside either boundary — **proven structurally** (TDD Test 2, the binding proof for this task): walk the synchronous `RootLayout({children})` element tree (or assert on source text, per the `tests/unit/page-wiring.test.ts` precedent) without ever invoking the async `AppHeader`/`Sidebar` children. Per ERR-0006 (docs/ERROR.md), jsdom `@testing-library` CANNOT render async server components — no runtime Suspense-fallback render is attempted in vitest.
- Runtime proof that first paint no longer gates on Steam (skeletons visible while Steam I/O pends, `{children}` painted) is a **manual maintainer step, not CI-gated** (there is no Playwright harness in this repo — no `playwright.config.*`, no `@playwright/test` in `package.json`, `tests/` is vitest-only): on a cold `pnpm dev` load, record DevTools TTFB/LCP and visually confirm skeleton-then-content, plus the `shell-timing` `performance.now()` trace from the Measurement plan. This mirrors how `tests/unit/section-suspense-geometry.test.tsx` marks un-automatable live checks as maintainer steps. If the repo later adds a Playwright harness (explicitly NOT scoped in this theme), a cold-load skeleton-then-content smoke is the first candidate spec — optional follow-up, not an acceptance criterion here.
- Existing degrade behavior intact: with `getProfile` rejecting, resolved header shows `—` placeholders and sidebar shows nav without counts (existing tests stay green; verified via the `render(await AppHeader())` pattern **with `AuthControls` mocked to a sync stub** — see TDD Test 5).
- No changes under `app/insights/**` or `app/game/**` (RSC-6 folded to bug-3; RSC-9 is the reference pattern, untouched).
- `pnpm test` full suite green; `pnpm typecheck`, `pnpm lint` green.

### T3 — Parallelize the pre-authz pair on `/u/[steamId]` (RSC-8)

**Scope in:** `app/u/[steamId]/page.tsx` lines ~60-64 only.
**Scope out:** `canViewProfile`, `server/authz.ts`, the `getProfile` call and its ordering, the `LockedProfile` degrade path, `dynamic = 'force-dynamic'` (page-level streaming/ISR for this rare visitor route is not worth a lane conflict; leave as-is).

Change: `const [viewer, user] = await Promise.all([getSessionUser(), prisma.user.findUnique({ where: { steamId }, select: { privacy: true } })]);` — then the existing serial `canViewProfile` → `getProfile` chain, unchanged. The file's IDOR comments (`:12-13`, `:67`) must be preserved and extended with one line stating that only the pre-authz pair is parallel **by design**.

**Acceptance criteria:**
- `canViewProfile` is still awaited before `getProfile(steamId)` is *called* — asserted by a call-order test (mock all three; assert `getProfile` not invoked until `canViewProfile` resolved, and never invoked when it resolves `false`).
- Locked/invalid/private behavior unchanged: invalid id → `notFound()`, disallowed → locked state with zero target-data fetches, Steam failure → locked state.
- Comment explicitly documents the authz-before-data invariant surviving the parallelization.

Order: T1 → T2 (depends on T1) · T3 independent (can run in parallel with T1/T2).

## Per-task acceptance criteria

Consolidated above inside each task (kept adjacent for implementer sessions). Global exit criteria for the theme: full vitest suite green, `pnpm typecheck`/`pnpm lint` green, the manual runtime streaming check performed and recorded (maintainer step — no Playwright harness exists in this repo), no diff outside the files listed in "Affected files", and the measurement plan's before/after captured.

## TDD test plan

Write these RED first (they fail at HEAD), then implement:

| # | File (new/extended) | Test name | Asserts (red → green) |
|---|---------------------|-----------|------------------------|
| 2 (**binding proof for T2**) | `tests/unit/shell-streaming.test.tsx` (new) | `layout has exactly two Suspense boundaries and children outside them` | Structural assertion, no runtime render of async children (ERR-0006): either source-text assertion per the `tests/unit/page-wiring.test.ts` precedent, or walk the element tree returned by calling the synchronous `RootLayout({children: sentinel})` — `AppHeader` and `Sidebar` each direct child of a `<Suspense>` with `HeaderSkeleton`/`SidebarSkeleton` as fallback; the `{children}` sentinel is not a descendant of either boundary. RED at HEAD: zero Suspense boundaries. |
| 3 | `tests/unit/header-skeleton.test.tsx` (new) | `HeaderSkeleton matches AppHeader outer geometry classes` | Skeleton root/classlist equals real header's layout-affecting classes (`sticky top-0 z-40 …`, `h-14` row). Model: `tests/unit/section-suspense-geometry.test.tsx` (renders skeleton and loaded component separately, compares structural classes/tag — the sanctioned CLS-proof shape). RED: module does not exist. |
| 4 | `tests/unit/sidebar-skeleton.test.tsx` (new) | `SidebarSkeleton matches Sidebar aside geometry classes` | Same for `w-60`/`sticky top-14`/`h-[calc(100vh-3.5rem)]`/`hidden lg:block`; same `section-suspense-geometry` model. RED: module does not exist. |
| 5 | `tests/unit/shell-degrade.test.tsx` (new or extend existing header/sidebar tests) | `shell degrades, never fabricates, when Steam rejects` | Mock surface (all four, or the render half-degrades or throws): (a) `vi.mock('@/components/auth/AuthControls')` with a **sync stub** — mandatory per ERR-0006's generalized rule, because `AuthControls` is itself an ASYNC server component (`components/auth/AuthControls.tsx:17`, awaits `getSessionUser` + `getProfile`) embedded in AppHeader's returned JSX (`AppHeader.tsx:114`); without the stub, `render(await AppHeader())` throws `Objects are not valid as a React child (found: [object Promise])` (docs/ERROR.md:190) — the exact ERR-0006 class this plan eliminates; (b) `getViewerSteamId` mocked to resolve a fixed id; (c) `getProfile` rejecting (`SteamApiError kind:"private"`); (d) `getLevel` rejecting (or resolving `null`) — required to actually reach `Lv —`, not just the playtime `—`. Then `render(await AppHeader())` shows `Lv —` and `—` total; `render(await Sidebar())` shows nav with `libraryCount === null`, no shelf note — Sidebar needs NO AuthControls stub (its only child nav is the `'use client'` `SidebarNav`, so its caught return really is synchronous). Pattern: `await Component()` per `tests/unit/achievement-kpi-section.test.tsx:38-39` — but note that precedent is ERR-0006-safe only because its return is genuinely synchronous; AppHeader's is NOT (async child), hence the mandatory stub. Guards the degrade invariant through the refactor (should be GREEN pre-change if equivalents exist; keep as regression pin). |
| 6 | `tests/unit/app/public-profile-authz-order.test.tsx` (new) | `getProfile is never called before canViewProfile resolves` | Via `await PublicProfilePage({params})` (pattern: `tests/unit/app/game-detail-hero-fallback.test.tsx:41`): mock `getSessionUser`, `prisma.user.findUnique`, `canViewProfile` (deferred), `getProfile`; assert `getProfile` uncalled while authz pending, uncalled forever when authz → false. GREEN at HEAD and must stay GREEN after T3 (invariant pin). |
| 7 | `tests/unit/app/public-profile-parallel-preauthz.test.tsx` (new) | `session read and target privacy lookup start concurrently` | Same `await PublicProfilePage({params})` pattern; instrument both mocks with start-order recording; assert both invoked before either resolves. RED at HEAD (serial: `findUnique` not invoked until `getSessionUser` resolves). |

Former Test 1 (runtime "children render while shell pends" via never-resolving mocks) is **deleted from the vitest plan**: per ERR-0006 (docs/ERROR.md:181-198, encoded in docs/FRONTEND.md), jsdom cannot render async server components — `render(<RootLayout/>)` throws `Objects are not valid as a React child (found: [object Promise])`, so neither the stated RED failure mode nor the green assertion is achievable. Its intent (runtime proof of streaming) is relocated to the **manual maintainer step** in the Measurement plan (there is no Playwright harness in this repo): cold `pnpm dev` load, DevTools TTFB/LCP, visual skeleton-then-content check, plus the `shell-timing` `performance.now()` trace.

Test paths above use the real repo convention — `tests/unit/*.test.tsx` for components/layout and `tests/unit/app/*.test.tsx` for page-level tests (verified: `tests/unit/section-suspense-geometry.test.tsx`, `tests/unit/achievement-kpi-section.test.tsx`, `tests/unit/app/game-detail-hero-fallback.test.tsx`, `tests/unit/page-wiring.test.ts`). Do NOT create a `tests/layout/` root. Implementer must not reinvent an async-RSC render harness (re-triggering ERR-0006); the two sanctioned patterns are `await Component()` for internally-catching async RSCs and static/structural assertions for wiring.

## Affected files

Verified to exist at HEAD `13023e3` (read this session) unless marked NEW:

**Modified:**
- `/Users/altanesmer/Desktop/AlesSystems/4ES-Dash/app/layout.tsx` — add `Suspense` import + two boundaries (currently none; `AppHeader`/`Sidebar` at :66-68).
- `/Users/altanesmer/Desktop/AlesSystems/4ES-Dash/app/u/[steamId]/page.tsx` — `Promise.all` the pre-authz pair (:60-64); comment update.

**New:**
- `/Users/altanesmer/Desktop/AlesSystems/4ES-Dash/components/layout/HeaderSkeleton.tsx`
- `/Users/altanesmer/Desktop/AlesSystems/4ES-Dash/components/layout/SidebarSkeleton.tsx`
- Test files listed in the TDD plan — under the existing `tests/unit/` and `tests/unit/app/` roots (real repo convention; do not create `tests/layout/`).

**Read-only context (must NOT change):**
- `components/layout/AppHeader.tsx`, `components/layout/Sidebar.tsx` (async RSCs stay as-is; exports `AppHeader`, `Sidebar` verified)
- `server/repositories/profile.ts` (`getProfile`), `server/repositories/level.ts` (`getLevel`), `server/auth.ts` (`getViewerSteamId` :281)
- `server/cache.ts` (single-flight), `server/cache/ttl.ts`, `lib/steam/limiter.ts`, `lib/steam/retry.ts`
- `app/game/[appId]/page.tsx` (RSC-9 reference pattern), `app/insights/**` (bug-3 lane), `app/loading.tsx`

## Measurement plan

**Primary metric: cold-load time-to-first-byte-of-body / first paint for any route** (all routes inherit the shell).

- **Before (capture at HEAD, pre-T2):** run the receipt's gated `shell-timing` check — temporary `performance.now()` around `getViewerSteamId → getProfile` in `Sidebar` and around `Promise.all([getProfile, getLevel])` in `AppHeader` on a real COLD render (`clearCache()` / fresh instance), or read the Vercel function-duration trace for any route. **Expected per the receipt:** cold shell ≥ ~500 ms (three serialized `steamLimiter` acquires at 250 ms spacing) + last-call RTT — NOT max-of-calls; +up to 5.25 s if a transient fires. Local proxy: `pnpm dev`, hard reload with cache cleared, record TTFB + LCP in DevTools.
- **After (post-T2):** same trace. Expected: document TTFB/first paint decoupled from Steam — shell skeleton paints immediately; the same 500 ms+ resolves inside the streamed boundaries. The *function duration* may be unchanged (calls still happen); the win is **paint timing**, so measure TTFB/LCP, not function duration alone.
- **Runtime streaming proof (relocated from the vitest plan, ex-Test 1) — MANUAL MAINTAINER STEP, not CI-gated:** the repo has no Playwright harness (no `playwright.config.*`, no `@playwright/test` dependency, `tests/` holds only vitest `unit/`, `integration/`, `mocks/`, `setup.ts`), so this proof is performed by hand, mirroring how `tests/unit/section-suspense-geometry.test.tsx` treats un-automatable live checks: cold `pnpm dev` load with cache cleared, confirm in DevTools that the initial streamed HTML contains the skeleton fallbacks and `{children}` content paints before (or independent of) the resolved header/sidebar data content; record TTFB/LCP alongside the `shell-timing` trace. Result goes in `wayline/optimization/measurements/theme-3-shell.md`. (Standing up a Playwright harness is a possible separate prerequisite task for future themes, deliberately NOT scoped here.) This is the only lane where "children render while the shell pends" can be observed at runtime (ERR-0006 bars it from jsdom).
- **Recorded in:** `wayline/optimization/measurements/theme-3-shell.md` (created by the implementer at measurement time), before/after side by side, with environment noted (local vs Vercel, warm vs cold).
- **Gated checks carried from the receipt** (human/live lane, gate magnitude not task scope — all tasks proceed regardless):
  - `shell-timing` — settles the real RSC-1/2 ms number (SUMMARY.md calls it the single highest-payoff measurement).
  - `cold-frequency` — deployment metrics for cold-start rate / soft-vs-hard nav mix; scales aggregate impact (root layout persists across soft nav, so the tax is per cold document load).
  - Not gating this theme but noted for cross-lane consistency: prod row counts (Theme 1), `ENABLE_STEAMSPY` prod value (bug-3/STEAM-3), platform tier & library N (Themes 4/5) — none change Theme-3 task scope since the fix is structural, not magnitude-tuned.
- **RSC-8 metric:** trivial — the parallel pair saves ~one session-read latency (~tens of ms); assert behavior via tests, optionally confirm with a local timing log. Not worth a prod trace.

## Risk & rollback

**Regression surface — the 5 shipped bug fixes:**

| Bug fix | Exposure | Why safe |
|---------|----------|----------|
| bug-1 history-no-data | None — no `app/history` or snapshot-repo changes. | Files untouched. |
| bug-2 year-in-review-zero-hours | None — `playtimeHidden` logic lives in `getProfile` (`profile.ts:46-49`), which this plan calls unchanged. | Repository untouched; only *where* consumers suspend changes. |
| bug-3 insights-slow | Adjacent — RSC-6 is folded INTO bug-3's lane; this plan must not touch `app/insights/**`. | Explicit scope-out in T2; acceptance criterion asserts zero diff under `app/insights/**`. |
| bug-4 obs-software-title | None — no library/title-classification code touched. | Files untouched. |
| bug-5 insights-unknown-label | None — genres/labels untouched. | Files untouched. |

**Other risks:**
- *CLS from skeleton mismatch* — mitigated by geometry-class-equality tests (TDD #3/#4) and the no-CLS invariant; skeletons reuse the real outer class strings.
- *SEO/streaming semantics* — header/sidebar content arrives in the same HTML stream (still SSR), just later chunks; no metadata is moved (metadata export untouched).
- *Sticky/z-index interplay* — skeleton header must keep `sticky top-0 z-40` or the sidebar's `top-14` anchor visually jumps; covered by geometry tests.
- *Authz regression on `/u/[steamId]`* — the highest-severity theoretical risk in this plan; pinned by TDD #6 (order test) before any code change.
- *Double-render of shell fetches* — none: Suspense does not change call counts; single-flight dedup verified in the receipt.

**Per-task rollback:**
- T1: delete the two skeleton files (nothing imports them until T2). Zero blast.
- T2: revert `app/layout.tsx` to the two-line direct mounts (single-file revert restores HEAD behavior exactly).
- T3: revert `app/u/[steamId]/page.tsx` to the serial pair (single-file revert). The authz-order pin test (TDD #6) is valid at HEAD and stays after rollback.
All three are independent single-file (or file-pair) reverts; no migrations, no config, no data shape changes — `git revert` per task commit suffices.

## Required docs/ updates

- **`docs/FRONTEND.md`** — document the shell-streaming rule: root-layout async RSCs MUST sit behind their own geometry-matched `<Suspense>`; cite `/game/[appId]` (per-section boundaries) and the new shell boundaries as the canonical patterns.
- **`docs/ARCHITECTURE.md`** — one-paragraph amendment to the data-flow section: shell components stream independently of `{children}`; first paint is decoupled from Steam Web API availability.
- **`docs/ERROR.md`** — append one ERR-XXXX entry (per the Error Logging rule) recording the RSC-1/2 blocking-shell defect: root cause (un-suspended async shell gating document flush on 3 limiter-serialized Steam calls), the generalized rule ("no un-suspended async component in a layout above `{children}`"), and where else the assumption was checked (insights pages — bug-3 lane; `/game/[appId]` — already correct).
- **`docs/SECURITY.md`** — only if the reviewer wants the RSC-8 note formalized: one line that `/u/[steamId]` parallelizes viewer-session ∥ target-privacy reads by design while `canViewProfile` remains strictly before target-data fetch. (Comment in the page may suffice; reviewer's call.)
- **Not required:** `docs/BACKEND.md`, `docs/API.md`, `docs/DATA_MODEL.md` — no server data-layer, API-surface, or schema changes in this plan.

## Review record

### Round 1 — adversarial review (required change + 3 non-blocking objections)

**Required change (blocking): unimplementable flagship test violating ERR-0006 — ACCEPTED and fixed.**
The reviewer is correct: `RootLayout` mounts async server components, and per ERR-0006 (docs/ERROR.md:181-198; encoded in docs/FRONTEND.md) jsdom `@testing-library` cannot render them — `render(<RootLayout/>)` throws `Objects are not valid as a React child (found: [object Promise])`, so ex-Test 1's stated RED failure mode ("render suspends / children absent") was fictional and its green assertion unreachable. Fix applied: TDD Test 2 (structural Suspense-wiring proof, no async-child invocation, per the `tests/unit/page-wiring.test.ts` precedent) is now the **binding proof** for T2's primary acceptance criterion; Test 1 is deleted from the vitest plan and its runtime intent relocated out of jsdom (initially phrased as a "Playwright/live measurement lane" — corrected in the round-1 revision below to a manual maintainer step, since no Playwright harness exists in this repo).

**Non-blocking objections — all folded in (none left unresolved):**
1. *Test paths* — TDD table and Affected-files now use the real `tests/unit/` / `tests/unit/app/` roots; explicit "do not create `tests/layout/`" note added.
2. *"Static" nav framing* — T1 corrected: `NavLinks`/`SidebarNav` are `"use client"` components (`usePathname()`), reuse permitted and CLS-positive; added implementer swap-inertness note for client components reused in fallbacks (`AuthControls`/`ThemeToggle` remount flash risk).
3. *Cite harness precedents* — TDD Tests 5/6/7 now name the sanctioned patterns and files: `render(await Component())` per `tests/unit/achievement-kpi-section.test.tsx:38-39`, `await PublicProfilePage({params})` per `tests/unit/app/game-detail-hero-fallback.test.tsx:41`; Tests 3/4 point at the `tests/unit/section-suspense-geometry.test.tsx` model.

### Round 1 revision — adversarial review of the revised plan (3 required changes + 3 non-blocking objections)

All three required changes ACCEPTED and applied (verified against source at HEAD this session — `AuthControls.tsx:17` is async, `AppHeader.tsx:114` embeds it, no `playwright.config.*` / `@playwright/test` / spec files exist):

1. **TDD Test 5 reintroduced ERR-0006.** Correct: `render(await AppHeader())` fails under jsdom because AppHeader's returned JSX embeds the ASYNC `<AuthControls />` — the prior rationale ("AppHeader/Sidebar catch internally and return synchronous JSX") was FALSE for AppHeader, and the `achievement-kpi-section` precedent is safe only because its return is genuinely synchronous. Fixed: Test 5 now mandates `vi.mock('@/components/auth/AuthControls')` with a sync stub and enumerates the full four-mock surface; the Sidebar half needs no stub (`SidebarNav` is `'use client'`).
2. **T1 could silently re-block first paint.** Correct: rendering `AuthControls` for-real inside `HeaderSkeleton` would make the Suspense fallback itself suspend and propagate upward, re-coupling document flush to Steam. Fixed: T1 now carries a binding rule — `AuthControls` is a static placeholder in the skeleton, never for-real; for-real reuse restricted to genuinely sync/`'use client'` components (`ThemeToggle`, `NavLinks`, `MobileNav`, `SidebarNav`); T1 acceptance adds "no import of AuthControls or any async server component".
3. **Playwright lane did not exist.** Correct: the T2 acceptance bullet, TDD relocation note, Measurement plan and Round-1 record all pinned the runtime streaming proof to a nonexistent harness. Fixed: reframed everywhere as a **manual maintainer step (not CI-gated)** — cold `pnpm dev` DevTools TTFB/LCP + skeleton-then-content visual check + the `shell-timing` `performance.now()` trace, recorded in the measurements file — mirroring the `section-suspense-geometry` precedent; harness setup explicitly noted as a possible separate future task, not scoped here.

Non-blocking objections — all folded in: (1) `AuthControls` documented as the THIRD async node in the shell subtree (Mechanism point 4; no new Steam call, ~500 ms floor stands, and its awaits are why the skeleton must not reuse it); (2) Test 5's mock surface enumerated in full (`AuthControls` sync stub, `getViewerSteamId`, `getProfile`, `getLevel` — the last required to actually reach `Lv —`); (3) one-line acknowledgement added under T2 that `app/loading.tsx` is homepage-shaped and serves as the root fallback for child routes lacking their own `loading.tsx` — pre-existing, out of Theme-3 scope, not a Theme-3 regression.

### Unresolved objections

None — all required changes and all non-blocking objections from both review passes were accepted and folded into the plan.

### Revision history

- **Round 1 (first pass):** deleted unimplementable runtime TDD Test 1 and its T2 acceptance bullet (ERR-0006); made structural Test 2 the binding T2 proof; relocated runtime streaming proof out of the vitest plan; corrected all test paths to `tests/unit/` / `tests/unit/app/`; corrected the "static nav" framing in T1 and added a swap-inertness implementer note; cited the sanctioned test-harness precedents (`achievement-kpi-section`, `game-detail-hero-fallback`, `section-suspense-geometry`, `page-wiring`) in the TDD plan.
- **Round 1 (revision):** fixed TDD Test 5's ERR-0006 regression — mandatory sync `vi.mock` stub for async `AuthControls` in the `render(await AppHeader())` path, corrected the false "synchronous JSX" rationale, and enumerated all four mocks (`AuthControls` stub, `getViewerSteamId`, `getProfile` reject, `getLevel` reject/null).
- **Round 1 (revision):** made T1's skeleton composition safe — binding rule that `AuthControls` is a static placeholder in `HeaderSkeleton` (never rendered for-real, or the fallback suspends and re-couples first paint to Steam); for-real reuse restricted to sync/`'use client'` components; T1 acceptance criterion added.
- **Round 1 (revision):** removed the nonexistent Playwright lane — runtime streaming proof reframed as a manual maintainer step (cold-load DevTools TTFB/LCP + skeleton-then-content check + `shell-timing` trace, recorded in the measurements file) across T2 acceptance, global exit criteria, the TDD relocation note, the Measurement plan, and the Round-1 record; Playwright harness setup noted as a possible future task, not scoped.
- **Round 1 (revision):** folded the three non-blocking objections — `AuthControls` documented as the third async shell node (Mechanism), Test 5 mock surface fully enumerated, and the homepage-shaped `app/loading.tsx` root-fallback behavior acknowledged as pre-existing/out-of-scope under T2.
