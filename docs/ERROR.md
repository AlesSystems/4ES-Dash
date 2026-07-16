# Error log

This file is the canonical record of every error discovered in 4ES-Dash — whether found by a developer, a CI run, or an agent. Append a new entry for every bug fixed, every agent-discovered issue, and every notable failure in infrastructure or documentation. **Never delete entries.** IDs are sequential (`ERR-0001`, `ERR-0002`, …). Update the index table whenever you add an entry.

Rules:

- One entry per distinct root cause. If a bug manifests in multiple places, document all affected locations inside a single entry.
- IDs are assigned at the time the entry is written, not at the time the bug occurred.
- Entries are append-only. Close an entry by changing its status; do not rewrite or remove it.
- Agent-discovered issues (e.g. found during a code review or refactor run) are logged here exactly like developer-discovered ones.

---

## Index

| ID | Date | Module | Severity | Title | Status |
|----|------|--------|----------|-------|--------|
| ERR-0001 | 2026-06-14 | docs | Low | docs/ERROR.md not created during bootstrap | Fixed |
| ERR-0002 | 2026-06-16 | steam-client | High | GetPlayerAchievements 403 mislabeled "Steam API key rejected", crashing the dashboard | Fixed |
| ERR-0003 | 2026-06-16 | frontend | Medium | Dashboard cold load ~38s — achievement summary fans out 3 Steam calls across the entire library | Fixed |
| ERR-0004 | 2026-06-16 | db | Low | Prisma 7 breaking changes + SQLite-migrations can't replay on Postgres (`migrate deploy` acceptance) | Won't-fix |
| ERR-0005 | 2026-06-16 | jobs | Medium | `createMany({ skipDuplicates })` unsupported on SQLite — snapshot idempotency needed a different write | Fixed |
| ERR-0006 | 2026-06-17 | frontend | Low | Async server component inside the dashboard tree broke `@testing-library` jsdom render | Fixed |
| ERR-0007 | 2026-06-18 | frontend | Medium | `/compare` side A defaulted to the placeholder `STEAM_ID`, breaking shared games and rendering a raw SteamID as a name | Fixed |
| ERR-0008 | 2026-06-18 | frontend | Medium | Genre breakdown showed "No genre data yet" for a signed-in-but-not-onboarded user until a manual re-sync | Fixed |
| ERR-0009 | 2026-06-18 | jobs | Medium | Year-in-Review "achievements unlocked" was always 0 — counted as a cumulative-snapshot delta with ≤1 snapshot/year | Fixed |
| ERR-0010 | 2026-06-19 | frontend | High | Dashboard cold load scaled O(N games) — library value priced every game live behind the shared limiter; no cache single-flight | Fixed |
| ERR-0011 | 2026-06-19 | frontend | High | Insights pages (genres, cost-per-hour) don't load — O(N) live Store/SteamSpy fan-out on render | Fixed |
| ERR-0012 | 2026-06-19 | db | High | History page showed fake (seeded) playtime under a real user's account | Fixed |
| ERR-0013 | 2026-06-19 | api | Critical | Anonymous visitors served the owner's private data in production (homepage + `/api/profile` + `/api/friends`) | Fixed |
| ERR-0014 | 2026-06-28 | frontend | High | Dashboard Achievements KPI shows "—" permanently — `recordAchievementUnlocks` fetched all games but `AchievementKpiSection` never passed the real steamId | Fixed |
| ERR-0015 | 2026-06-28 | frontend | High | Library shows all games as "untouched" when Steam "Game details" privacy hides real playtime (heuristic: all zero + some lastPlayed) | Fixed |
| ERR-0016 | 2026-06-28 | jobs | High | History week/month filters always empty — snapshot cron only targeted `STEAM_ID` env var, not all onboarded users | Fixed |
| ERR-0017 | 2026-06-28 | frontend,jobs | High | Re-sync button spins forever: no try/catch on client; unbounded achievement fan-out on server; writes not atomic | Fixed |
| ERR-0018 | 2026-07-06 | frontend | Medium | History page empty until snapshots span ≥2 week/month periods — single-period spans collapsed to 1 point and were discarded; page not onboarding-gated | Fixed |
| ERR-0019 | 2026-07-06 | backend | High | Year-in-Review zeroes/under-counts current-year hours — playtime gain derived from the in-year (max − min) spread with no pre-year baseline | Fixed |
| ERR-0020 | 2026-07-06 | frontend,db | High | Insights pages slow: whole page blocks on slowest await; duplicate getSessionUser waterfall on genres; unbounded PlaytimeSnapshot scans bypassed `@@index([steamId, date])` | Fixed |
| ERR-0021 | 2026-07-15 | frontend | High | First paint of every route gated on the un-suspended shell — 3 limiter-serialized Steam calls (~500 ms cold floor, +5.25 s on a transient) blocked document flush | Fixed |
| ERR-0022 | 2026-07-15 | frontend,db | High | `/library?multiplayer=1` recomputed slow-changing Store reference data live on the request path — one `appdetails` call per owned game, limiter-serialized (~16.3 s cold @ N=65, linear in library size) | Fixed |
| ERR-0023 | 2026-07-15 | db,frontend | High | Insights/history read paths issued unbounded steamId-only snapshot scans (composite indexes never pruned) and recomputed every aggregate per request; post-merge, the bounded YiR scan silently starved bug-2's pre-year baseline | Fixed |
| ERR-0024 | 2026-07-16 | jobs | High | Nightly/onboarding `recordAchievementUnlocks` fanned out over the ENTIRE achievement library (up to 3 rate-limited calls/game) inside a platform-capped function window — silent stream/job truncation as libraries grow | Fixed |

**Allowed values**

- **Module** — `steam-client`, `store-client`, `cache`, `db`, `jobs`, `api`, `frontend`, `infra`, `docs`
- **Severity** — `Critical`, `High`, `Medium`, `Low`
- **Status** — `Open`, `Investigating`, `Fixed`, `Won't-fix`

---

## Entry template

Copy this block when adding a new entry. Replace every placeholder including the `ERR-XXXX` ID.

````markdown
### ERR-XXXX — <title>

**Date:** YYYY-MM-DD
**Module:** <module>
**Severity:** <Critical | High | Medium | Low>
**Status:** <Open | Investigating | Fixed | Won't-fix>

**Symptom:** What a developer or user would observe — error message, wrong output, missing behaviour.

**Root cause:** One sentence explaining the underlying cause.

**Fix:** What was changed to resolve the issue, including file paths where relevant.

**Generalized rule:** The broader rule that prevents this class of error across the codebase.

**Where else this assumption may be wrong:** Other modules or files where the same faulty assumption could exist.

**Prevented by:** Process, tooling, or checklist that would have caught this before it reached production.
````

---

## Entries

### ERR-0001 — docs/ERROR.md not created during bootstrap

**Date:** 2026-06-14
**Module:** docs
**Severity:** Low
**Status:** Fixed

**Symptom:** `docs/ERROR.md` did not exist despite CLAUDE.md requiring every error to be appended to it using the `ERR-XXXX` template.

**Root cause:** The error-log file mandated by CLAUDE.md was never created during documentation bootstrap.

**Fix:** Created `docs/ERROR.md` with the full structure (intro, index table, entry template, seed entry) as part of a follow-up documentation pass. No source code was affected.

**Generalized rule:** Any process document or artifact referenced as mandatory by CLAUDE.md must be created during bootstrap, not lazily on first use.

**Where else this assumption may be wrong:**

- `docs/openapi.yaml` is referenced as a future deliverable but does not yet exist; if CLAUDE.md or another doc starts treating it as present, the same gap will occur.
- Any other CLAUDE.md-referenced file that is described in the present tense but not yet on disk (check the doc map in CLAUDE.md against actual directory contents).

**Prevented by:** A bootstrap checklist (or a CI link-check step) that fails if any file listed as mandatory in CLAUDE.md is absent from the repository.

---

### ERR-0002 — GetPlayerAchievements 403 mislabeled "Steam API key rejected", crashing the dashboard

**Date:** 2026-06-16
**Module:** steam-client
**Severity:** High
**Status:** Fixed

**Symptom:** The dashboard (`app/page.tsx`) rendered `app/error.tsx` with "Steam API key rejected" for a user whose API key was valid — the same user could load `/library` and `/game/[appId]` (owned games) without error. Only the dashboard, which additionally aggregates achievements, failed.

**Root cause:** Steam's `ISteamUserStats/GetPlayerAchievements` returns **HTTP 403** (`{"playerstats":{"error":"Profile is not public","success":false}}`) when the profile privacy is not Public — even while `GetOwnedGames` returns 200 for the same account. The achievements client's `fetchJson` maps every 401/403 to `SteamApiError({ kind: 'auth', message: 'Steam API key rejected' })`, and the 403 was thrown before the `success:false` private-handling branch could run, so a privacy condition was reported as a rejected key and propagated up to crash the whole page instead of degrading the achievement widget.

**Fix:** `lib/steam/achievements.ts` — `getPlayerAchievements` now catches a `kind:'auth'` error with `status === 403` and returns `unavailable('private', …)` (the designed empty state); a 401 (genuine bad/missing key) still throws. Regression test added in `tests/unit/achievements.test.ts` (`getPlayerAchievements – HTTP 403 forbidden`). Verified against the live Steam API: owned-games 200, recently-played 200, player-achievements 403.

**Generalized rule:** HTTP status codes are not portable across Steam endpoints. A 403 means "this resource is forbidden for this caller," which on per-user endpoints (`GetPlayerAchievements`) signals *privacy*, not a bad key. Map status → error kind **per endpoint's documented/observed semantics**, and never let a degradable per-widget condition throw past the data layer — the degradation contract (return `{ available: false, reason }`) must hold for every T2/T4 feature.

**Where else this assumption may be wrong:** The shared `fetchJson` pattern is copied into `lib/steam/client.ts`, `lib/steam/level.ts`, and `lib/steam/recently-played.ts`. Those endpoints (`GetOwnedGames`, `GetSteamLevel`, `GetRecentlyPlayedGames`) return **200 with `{}`** for private profiles, so their 403 → `auth` mapping is correct (a 403 there really is a key problem). `GetPlayerAchievements` is the lone endpoint that uses 403 for privacy; if future per-user endpoints are added (e.g. `GetUserStatsForGame`), audit their 403 semantics before reusing the `fetchJson` copy.

**Prevented by:** A test matrix that exercises each Steam client against the *documented status codes for that specific endpoint* (not a shared assumption), plus a degradation-contract check that no `Availability`-returning data function throws on a privacy/no-data condition.

---

### ERR-0003 — Dashboard cold load ~38s from library-wide achievement fan-out

**Date:** 2026-06-16
**Module:** frontend
**Severity:** Medium
**Status:** Fixed

**Symptom:** The dashboard (`app/page.tsx`) took ~30–40 seconds to render on a cold cache for a real library (65 owned games, 51 with achievements).

**Root cause:** `getAchievementProgress` aggregated **every** owned game that exposes achievements, and `getGameAchievements` fetched **3** Steam endpoints per game (schema + global + player) in parallel — but the token-bucket limiter serializes all Steam I/O at 250 ms/request. 51 games × 3 calls = 153 serialized requests ≈ 38 s. The per-game metadata calls were made even when the player's data was private/absent, so their results were fetched and then discarded.

**Fix:** Two changes. (1) `app/page.tsx` now bounds the summary to the top 20 most-played achievement games via `topGamesByPlaytime(...)` instead of the whole library. (2) `server/repositories/achievements.ts` `getGameAchievements` fetches the per-user progress **first** and short-circuits (skips schema + global) when the result is unavailable — 3 calls/game → 1 for every private/empty game. Regression test in `tests/unit/achievements-repo.test.ts` asserts the metadata calls are skipped on a 403. Net cold load: ~38 s → ~5 s while the profile is private, ~12 s once public; warm cache is instant (1 h TTL).

**Generalized rule:** A glanceable widget must bound its fan-out — never iterate the full dataset through a rate-limited dependency on a request-path render. Fetch the gating/cheapest signal first and short-circuit dependent calls when it is absent. Cost = items × calls-per-item × limiter-interval; keep that product inside the route's load budget.

**Where else this assumption may be wrong:** Any future RSC that loops over the whole library through `lib/steam` on the request path — e.g. a "rarest achievements across all games" view, per-game store-price aggregation, or a friends-activity feed. The durable fix is Phase 2 DB snapshots + a cron pre-warm so the request path reads pre-computed data instead of fanning out live.

**Prevented by:** A per-route performance budget check (LCP / server render time) in review, and treating "N× a rate-limited call on first paint" as a design smell that must be bounded or moved to a background job.

---

### ERR-0004 — Prisma 7 breaking changes + SQLite migrations can't replay on Postgres

**Date:** 2026-06-16
**Module:** db
**Severity:** Low
**Status:** Won't-fix (deliberate, documented deferral)

**Symptom:** Two coupled issues surfaced while bootstrapping persistence (Phase 2, #24): (1) `pnpm add prisma@latest` installed Prisma **7.8.0**, whose `prisma-client-js` generator is deprecated in favour of a new `prisma-client` generator that requires a custom `output` path and mandatory driver adapters — a large, risky change for a foundational PR. (2) `docs/ACCEPTANCE.md` asks that both `prisma migrate dev` (SQLite) **and** `prisma migrate deploy` against Postgres succeed, but a single committed migration history is engine-specific — SQLite-authored migration SQL will not replay on Postgres.

**Root cause:** Prisma migrations are authored against one datasource provider; the DDL they emit (and the `migration_lock.toml` provider) is engine-specific. There is no free, single-history way to serve both SQLite (dev/CI) and Postgres (prod). Independently, "always use latest" is wrong for a foundation dependency where a new major's breaking changes outweigh its benefits.

**Fix:** (1) **Pinned Prisma to `^6.19.3`** (`prisma-client-js`, client in `node_modules`, `binaryTargets` for Vercel) — the well-trodden path the data model already assumed. (2) Adopted **SQLite for dev/CI with committed migrations**, and **Postgres prod via `prisma db push`** (schema-driven sync, no replay), documented in `docs/DEPLOYMENT.md` and `docs/DATA_MODEL.md`. The schema is kept Postgres-compatible (no SQLite-only types; JSON as `String`). The acceptance line "`migrate deploy` against Postgres" is consciously **re-scoped** to `db push`; a dual Postgres migration history is deferred to a later phase.

**Generalized rule:** Pin foundational dependencies to a stable major and only adopt a new major deliberately, after weighing its breaking changes — "latest" is a default for app-level models, not for the DB layer everything builds on. And a migration history belongs to exactly one database engine; if dev and prod engines differ, either keep two histories or use `db push` for the engine without a committed history — never assume one history replays on both.

**Where else this assumption may be wrong:** Any future doc/CI that assumes `migrate deploy` works against prod Postgres; the Docker target in `docs/DEPLOYMENT.md` (Postgres) also uses `migrate deploy` today and should move to `db push` or gain a Postgres migration history before it is exercised. A later Prisma 7 upgrade must revisit the `server/db.ts` import path and add a driver adapter.

**Prevented by:** Reading the installed major's upgrade guide before building on it (caught here via Context7), and treating any acceptance criterion that spans two database engines as a flag to choose the migration strategy explicitly up front.

---

### ERR-0005 — `createMany({ skipDuplicates })` unsupported on SQLite

**Date:** 2026-06-16
**Module:** jobs
**Severity:** Medium
**Status:** Fixed

**Symptom:** The snapshot job (#25) was specified (docs/BACKEND.md, docs/DATA_MODEL.md) to write snapshots with `prisma.playtimeSnapshot.createMany({ data, skipDuplicates: true })` for idempotency under retry. On the SQLite datasource this throws at query-build time: `Unknown argument 'skipDuplicates'`. Verified empirically against the generated Prisma 6 client before writing the job.

**Root cause:** Prisma's `skipDuplicates` option for `createMany` is only implemented on connectors whose engine supports a bulk "insert-or-ignore" (PostgreSQL, MySQL/MariaDB, CockroachDB). The SQLite connector does not expose it, so the argument is rejected by the query validator.

**Fix:** `server/jobs/snapshot.ts` writes each row with `prisma.playtimeSnapshot.upsert({ where: { steamId_appId_date }, create: {...}, update: {} })` inside a single `prisma.$transaction([...])`. The empty `update` makes a same-day re-run a no-op, giving the exact idempotency `skipDuplicates` would have (a second run inserts 0 rows). Integration test `tests/integration/snapshot.test.ts` asserts `COUNT(*)` is unchanged across two runs. docs/BACKEND.md updated to describe the upsert approach.

**Generalized rule:** Prisma features are connector-specific — a method/option that works on Postgres may be absent on SQLite (and vice-versa). When dev/CI runs SQLite but prod runs Postgres, verify any non-trivial Prisma call on **SQLite** before relying on it, and prefer portable constructs (`upsert`, explicit transactions) over connector-gated options for cross-engine code.

**Where else this assumption may be wrong:** Any future bulk-write path (achievement backfills, friend snapshots, reference-table seeding) that reaches for `createMany({ skipDuplicates })`, plus case-insensitive `mode: 'insensitive'` filters (also Postgres-only) — both will pass on a Postgres-only assumption and fail on SQLite dev/CI.

**Prevented by:** The SQLite-first dev/CI gate (ERR-0004) actually catches this class of bug before prod; treat "works on Postgres" as unproven until the SQLite test suite is green.

---

### ERR-0006 — Async server component in the dashboard tree broke jsdom tests

**Date:** 2026-06-17
**Module:** frontend
**Severity:** Low
**Status:** Fixed

**Symptom:** After adding the library-value widget (#29) to the dashboard as an inline `async function LibraryValueSection()` wrapped in `<Suspense>`, the existing homepage tests (`tests/integration/homepage.test.tsx`, `homepage-stale.test.tsx`) failed with `Objects are not valid as a React child (found: [object Promise])`.

**Root cause:** Those tests render the dashboard with `render(await HomePage())` under `@testing-library/react` in jsdom. `@testing-library` uses the standard react-dom renderer, which does NOT understand async function components — it calls the component, gets a Promise back, and tries to render the Promise as a child. Only the React Server Components renderer awaits async components; jsdom unit tests don't have it.

**Fix:** Extracted the async component into its own module (`components/dashboard/LibraryValueSection.tsx`) so the dashboard tests can `vi.mock` it with a synchronous stub. Production keeps the real streaming Suspense boundary (non-blocking cold load). The two homepage tests now stub `LibraryValueSection`/`LibraryValueSkeleton`.

**Generalized rule:** Async server components can't be rendered by `@testing-library` in jsdom. Keep any async server component that sits inside a unit-tested page in its OWN module (never inline in the page) so tests can mock it with a sync stub; test the async component's data logic separately at the repository/function level. Reserve `render(await Page())` for trees whose children are all synchronous.

**Where else this assumption may be wrong:** Any future page that composes an inline `async` child and is also unit-tested — e.g. streaming friends-activity, achievements timelines, or year-in-review sections. The same extraction pattern applies.

**Prevented by:** A convention (now in docs/FRONTEND.md): async server components used by a tested page live in their own file. Caught here by the orchestrator's full-suite gate, which the parallel sub-agents' per-file test runs did not exercise.

---

### ERR-0007 — `/compare` side A defaulted to the placeholder `STEAM_ID`

**Date:** 2026-06-18
**Module:** frontend
**Severity:** Medium
**Status:** Fixed

**Symptom:** Opening `/compare?b=<valid>` while signed in rendered "Shared games can't be computed — one of the libraries couldn't be loaded. Try again shortly." (#88) and, where a profile was missing, displayed a raw 17-digit SteamID as the player's name (#89).

**Root cause:** `app/compare/page.tsx` defaulted side A to `getEnv().STEAM_ID`, which in every non-featured deployment is the placeholder `76561190000000000` (a non-existent account). Every Steam fetch for it failed → `games = null` → `shared = null` → the "Try again shortly" branch; `profile = null` → the display fell back to `profile?.personaName ?? steamId`, rendering the raw id. The page was missed in the Phase 6 (#81) session migration.

**Fix:** Side A now resolves from the session via `getSessionUser()` (NOT `getViewerSteamId()`, which itself falls back to `env.STEAM_ID`); anonymous visitors with no `?a=` get the input `EmptyState` instead of a placeholder fetch (`app/compare/page.tsx`). A `friendlyName(steamId)` / `friendlyFallbackName(steamId)` helper replaces the raw-id fallback in both `app/compare/page.tsx` and `components/compare/UserColumn.tsx`, so a name never matches `/^\d{17}$/`.

**Generalized rule:** A "current user" default must come from the authenticated session, never from a config placeholder that doubles as a featured/dev fallback — a placeholder that passes shape validation (a 17-digit string) silently fetches a dead account. And a raw identifier is never a display name: every name fallback must degrade to a human-readable token.

**Where else this assumption may be wrong:** Any other route that resolved "my" data via `getEnv().STEAM_ID` or `getViewerSteamId()`'s env fallback (audited: dashboard self-gates; genres uses the gate in ERR-0008); any UI that renders `profile?.personaName ?? steamId` (e.g. `/u/[steamId]`, friends columns).

**Prevented by:** A compare page + UserColumn test asserting the session id drives side A, that the placeholder is never fetched and never appears in output, and that a null profile never renders a 17-digit name. The regression test sets `STEAM_ID` to the placeholder explicitly.

---

### ERR-0008 — Genre breakdown empty until a manual re-sync (onboarding not gated)

**Date:** 2026-06-18
**Module:** frontend
**Severity:** Medium
**Status:** Fixed

**Symptom:** A user who signed in but never visited `/onboarding` saw "No genre data yet" on `/insights/genres` until they triggered a settings re-sync, even though sign-in succeeded.

**Root cause:** `ownedGame` rows are written only by `runOnboardingBackfill` (via `/onboarding` or settings re-sync). The auth `signIn` event upserts a bare `User` row (`lastLoginAt` only) and does NOT backfill, and nothing gated a signed-in-but-not-onboarded user toward `/onboarding`. So `/insights/genres`, which derives slices from `prisma.ownedGame.findMany`, rendered the empty state for a user whose library simply had not been synced yet.

**Fix:** Added `server/onboarding-gate.ts#getOnboardingStatus()` — a cheap single-column read of `User.onboardedAt` returning `'no-session' | 'not-onboarded' | 'onboarded'`. `app/insights/genres/page.tsx` redirects a `'not-onboarded'` viewer to `/onboarding`; "No genre data yet" is now reachable only for an onboarded user with a genuinely empty library. The gate never calls `runOnboardingBackfill` (no Steam fan-out on the render path).

**Generalized rule:** Distinguish "data not provisioned yet" from "data genuinely empty." A protected "my" view must gate on the provisioning signal (`onboardedAt`) before showing an empty state, and the gate must stay off the rate-limited request path (DB read only, never a live backfill).

**Where else this assumption may be wrong:** Every other onboarding-dependent "my" view that reads `ownedGame`/snapshot tables directly (history, year in review, library, insights/*). Each should consult `getOnboardingStatus()` rather than inferring "empty" from zero rows.

**Prevented by:** A genres-page test covering all three states (not-onboarded → redirect; onboarded+data → slices; onboarded+empty → empty state) plus the gate's own unit tests; the empty-state copy is asserted to appear only on the onboarded-empty path.

---

### ERR-0009 — Year-in-Review "achievements unlocked" stuck at 0

**Date:** 2026-06-18
**Module:** jobs
**Severity:** Medium
**Status:** Fixed

**Symptom:** The Year-in-Review page reported "0 achievements unlocked" for a year even when the user had clearly unlocked achievements (and the dashboard's live achievement summary, counting the same data, was non-zero — the two surfaces disagreed).

**Root cause:** `achievementsUnlocked` was computed as `max(unlockedCount) − min(unlockedCount)` among the year's `AchievementSnapshot` rows. With ≤1 snapshot in the year — the common case, since onboarding seeds no achievement baseline and only the top-20 games are snapshotted — the delta is 0. The real per-achievement `unlockedAt` (parsed in `lib/steam/achievements.ts` as unix seconds × 1000) was discarded by the job. The existing test never asserted a non-zero count, so CI missed it.

**Fix:** New `AchievementUnlock` event table (one new migration `20260618233552_add_achievement_unlocks`) recording one row per unlocked achievement keyed by its real `unlockedAt`. `server/jobs/snapshot.ts#recordAchievementUnlocks` writes these for ALL achievement-bearing games (not just the top-N-played, so unlocks outside the most-played set still count — criterion #6) via the cached, single-flighted achievement repository, so games already fetched for the cumulative-count pass are not re-fetched; `server/jobs/onboarding-backfill.ts` seeds them on first run so prior years populate retroactively. `lib/insights/year-in-review.ts#countUnlocksInYear` counts events by UTC year (seconds→ms guarded, `unlocktime 0`/epoch excluded), and `server/repositories/insights/year-in-review.ts` feeds it the unlock rows instead of the snapshot delta.

**Generalized rule:** To count *occurrences within a window*, store and count the events (timestamped), never a delta of a cumulative counter — a delta needs ≥2 samples bracketing the window and silently returns 0 when the history is sparse. And every "count > 0" requirement needs a test that asserts a *non-zero* result, not just shape.

**Where else this assumption may be wrong:** Any other "in this period" metric derived from snapshot deltas — e.g. playtime-gained for a year/month with a single snapshot (the playtime delta has the same ≤1-sample blind spot, mitigated only because playtime is snapshotted daily for all games).

**Prevented by:** Tests asserting a non-zero, history-independent count (single day of data → count > 0), UTC year-boundary cases both directions, the seconds→ms conversion, exclusion of `unlocktime 0`, contribution from games outside the top-played set, and a sum-over-years cross-check.

---

### ERR-0010 — Dashboard cold load scaled with library size (O(N) live Store pricing)

**Date:** 2026-06-19
**Module:** frontend
**Severity:** High
**Status:** Fixed

**Symptom:** The dashboard's cold (cache-empty) render got slower the larger the library — seconds-to-tens-of-seconds — because rendering it priced every owned game live. (Closes the open item flagged in ERR-0003, which only bounded the achievement fan-out.)

**Root cause:** `server/repositories/library-value.ts#getLibraryValue` priced the whole library via `Promise.all(games.map(getGameStorePrice))`, all serialized behind the **shared** 250 ms limiter (cold = `N × 250 ms`); the achievement summary was awaited inside `app/page.tsx`'s blocking `Promise.all` rather than streamed; the Store and Web APIs shared one limiter; and `server/cache.ts` had no in-flight de-dup, so concurrent misses each ran the loader.

**Fix:** (1) Pre-compute the library value in the nightly job (`refreshLibraryValueAggregate` → `LibraryValueAggregate` row, one new migration); the dashboard READS the row (`getLibraryValue` → `Availability<LibraryValue>`, `unavailable('not-tracked')` before the first run → "value pending" state) with zero Store fan-out. (2) Both the library-value and achievement-summary sections stream in their own `<Suspense>` boundary (`LibraryValueSection`, `AchievementSummarySection`), resolved with a `steamId` passed once from the page so neither re-runs `getViewerSteamId`/`getProfile`. (3) A dedicated `storeLimiter` separates Store calls from the Web API limiter. (4) `cache()` single-flights concurrent misses.

**Generalized rule:** Never put an O(N-resource) rate-limited fan-out on an interactive render path — precompute it in a job and read an aggregate, and stream secondary widgets behind `<Suspense>`. Independent upstreams need independent rate limiters, and a read-through cache must single-flight to avoid a thundering herd on a cold key.

**Where else this assumption may be wrong:** Any page that aggregates a per-game/per-resource Steam call on render (genres, multiplayer, cost-per-hour). Each should read a precomputed aggregate or run behind Suspense with a bounded fan-out, never a synchronous library-wide loop.

**Prevented by:** A test asserting `getLibraryValue` performs zero `getGameStorePrice` calls (reads the aggregate), a cache single-flight test (N misses → 1 loader call), and a store-limiter separation test (a store flood does not delay a Web API acquire).

---

### ERR-0011 — Insights pages (genres, cost-per-hour) don't load — O(N) live Store/SteamSpy fan-out on render

**Date:** 2026-06-19
**Module:** frontend
**Severity:** High
**Status:** Fixed

**Symptom:** `/insights/genres` (the "Insights" nav target) never finishes loading; `/insights/cost-per-hour` is similarly slow. Measured with a real 65-game account: `getGenreBreakdown` took **64.8 s** and `getCostPerHour` **16.3 s** on a cold cache, versus < 3 ms for the DB-only history/idle pages. On Vercel this exceeds the serverless function timeout → the page never renders.

**Root cause:** The exact O(N) live-fan-out pattern flagged (but not fixed) under ERR-0010's "Where else this assumption may be wrong: genres, cost-per-hour". `server/repositories/insights/genres.ts` called `getGameStoreMetadata(appId)` **per owned game** on the render path — plus `getSteamSpyData(appId)` per game when `ENABLE_STEAMSPY` was on (130 serialized calls @ 1 req/250 ms ≈ 65 s). `server/repositories/insights/cost-per-hour.ts` called `getGameStorePrice(appId)` per game. Because the pages are `force-dynamic` and prod has no shared cache (`REDIS_URL` unset → per-instance in-memory LRU lost on cold start), every visit re-fanned-out. The `Game.genres` column existed specifically to hold this data but was written as `'[]'` by `onboarding-backfill.ts` and never populated.

**Fix:** Migrated both pages to the precompute-in-job / read-aggregate pattern (same as ERR-0010). The nightly snapshot job + onboarding backfill now persist per-game genres into `Game.genres` and per-game price into new `Game.priceFinalCents`/`priceCurrency`/`priceIsFree`/`priceRefreshedAt` columns (additive migration), reusing the job's existing Store fan-out. `getGenreBreakdown` and `getCostPerHour` now read these from the `Game` table — zero Store calls on the render path, independent of library size. SteamSpy enrichment defaults off (`ENABLE_STEAMSPY=0`); when enabled it remains a known render-path fan-out (follow-up: persist tags).

**Generalized rule:** (Restates ERR-0010.) No interactive render path may contain an O(N-resource) rate-limited fan-out. When an ERR entry names sibling pages under "where else this may be wrong", treat that as a defect list — fix or ticket them, don't leave them latent.

**Where else this assumption may be wrong:** `/insights` SteamSpy tag breakdown when `ENABLE_STEAMSPY=1` still fans out per game on render (tags are not yet persisted). Any future per-game Steam aggregate page must read a precomputed column/row.

**Prevented by:** Tests asserting `getGenreBreakdown`/`getCostPerHour` issue **zero** `getGameStoreMetadata`/`getGameStorePrice` calls (read from DB), and that the nightly job populates `Game.genres`/price columns.

---

### ERR-0012 — History page showed fake (seeded) playtime under a real user's account

**Date:** 2026-06-19
**Module:** db
**Severity:** High
**Status:** Fixed

**Symptom:** The playtime history chart showed ~2 months of daily playtime for exactly 5 games (Counter-Strike 2, Dota 2, Team Fortress 2, The Witcher 3, Baldur's Gate 3) that did not reflect the user's real activity — "fake data".

**Root cause:** `prisma/seed.ts` writes synthetic 60-day history under `process.env.STEAM_ID ?? '76561190000000000'`. It was run while `STEAM_ID` was set to a **real** SteamID (`76561198848120642`), injecting 220 fake `PlaytimeSnapshot` rows into that real account. The real onboarding produced exactly one baseline snapshot per game (2026-06-18); the 5 seed games additionally had 20–61 days of synthetic history (2026-04-19 → 2026-06-17), which dominated the chart. (Compounding config smell: `.env` `STEAM_ID` was left as the seed placeholder, so the nightly job also targeted a non-existent account and real history never accrued — cf. ERR-0007, placeholder STEAM_ID leaking into a user-facing surface.)

**Fix:** (1) Data: deleted the 220 pre-onboarding fake rows (`date < onboarding day`), keeping the 65 real baseline rows (DB backed up first). (2) Code: `prisma/seed.ts` hardened to write only under a dedicated synthetic SteamID, never `process.env.STEAM_ID`, so it can never pollute a real account regardless of env. (3) Config: `.env` `STEAM_ID` set to the real account so the featured-profile fallback and nightly job target it.

**Generalized rule:** A dev/demo seed must write only to an isolated, clearly-synthetic identity that can never collide with real data — never key synthetic rows off an ambient env var that may hold a real identifier. Snapshot tables are append-only and trusted by every time-series; polluting them corrupts every derived view.

**Where else this assumption may be wrong:** Any script that mutates per-user tables keyed off `process.env.STEAM_ID` (other seeds, backfills, one-off migrations). The featured-profile fallback (`getViewerSteamId` → `getEnv().STEAM_ID`) surfaces whatever STEAM_ID points at, so a wrong value shows wrong/empty data on every "my" view when logged out.

**Prevented by:** A test asserting `seed.ts` targets the synthetic ID even when `process.env.STEAM_ID` is set to a different value, plus the production-refusal guard.

---

### ERR-0013 — Anonymous visitors served the owner's private data in production

**Date:** 2026-06-19
**Module:** api
**Severity:** Critical
**Status:** Fixed

**Symptom:** On the deployed Vercel site, a visitor who had not signed in still saw the owner's full dashboard (profile, library, level, playtime) on `/`, and could fetch the owner's data directly from `GET /api/profile` and `GET /api/friends`.

**Root cause:** `getViewerSteamId()` (`server/auth.ts`) fell back to `getEnv().STEAM_ID` for unauthenticated requests. `STEAM_ID` is set to the owner's account on Vercel as a dev/featured-profile fallback. The homepage `/` (self-gating, intentionally outside the middleware matcher) and the public `/api/profile` + `/api/friends` routes (matcher excludes `/api/*`) therefore resolved every anonymous request to the owner's SteamID, so the `if (!featuredId)` Landing gate never fired and the API routes returned the owner's data — a cross-tenant privacy leak. Foreshadowed in ERR-0012's "Where else this assumption may be wrong".

**Fix:** (1) `server/auth.ts` — gate the `STEAM_ID` fallback in `getViewerSteamId()` to non-production (`getEnv().NODE_ENV !== 'production'`); in production an unauthenticated request resolves to `''`, so the homepage renders `<Landing/>`. (2) `app/api/profile/route.ts` and `app/api/friends/route.ts` — read `getSessionUser()` directly and return `401 { error: 'unauthorized' }` (with `Cache-Control: private, no-store`) when there is no session, instead of substituting the fallback identity. Tests in `tests/unit/auth.test.ts`, `tests/integration/api-profile.test.ts`, `tests/integration/api-friends.test.ts` assert anon → 401 / Landing and that the data loaders are never reached.

**Generalized rule:** A "featured/dev fallback" identity must never resolve for an anonymous request in production. Gate such fallbacks on `NODE_ENV`, and make public (non-middleware-protected) API routes return `401` for anonymous callers rather than silently substituting a fallback identity.

**Where else this assumption may be wrong:** Any caller of `getViewerSteamId()` reachable without the auth middleware. The middleware-protected pages (`/library`, `/history`, `/insights/*`, `/friends`, `/game/*`, `/review/*`, `/settings`, `/onboarding`) are safe because anonymous requests are redirected to sign-in before they run; the unprotected surfaces (`/`, `/api/profile`, `/api/friends`) were the leak. Any future public route or API handler that calls `getViewerSteamId()` must explicitly handle the empty-string (anonymous) result.

**Prevented by:** Integration tests that hit each public route unauthenticated and assert no owner data is returned, plus a rule that the middleware matcher and the set of `getViewerSteamId()` callers are reviewed together whenever either changes.

---

## ERR-0014

**Date:** 2026-06-28
**Module:** frontend
**Severity:** High
**Status:** Fixed

**Title:** Dashboard Achievements KPI shows "—" permanently

**Symptom:** `AchievementKpiSection` always rendered `—` (unavailable) because `recordAchievementUnlocks` was called without a valid steamId — the component never received the real user's steamId.

**Root cause:** The KPI section fetched achievements using a placeholder/empty steamId, so the Steam API returned no results and the section fell back to `{ available: false }` on every render.

**Fix:** Passed the session user's steamId through to `AchievementKpiSection` so it fetches the correct player's data.

**Generalized rule:** Any server component that queries user-specific Steam data must receive the authenticated steamId explicitly — never assume a module-level default or placeholder will be replaced at runtime.

**Prevented by:** Unit test that stubs the achievement fetch and asserts the KPI renders a real number when the steamId is set.

---

## ERR-0015

**Date:** 2026-06-28
**Module:** frontend
**Severity:** High
**Status:** Fixed

**Title:** Library shows all games as "untouched" when Steam "Game details" privacy hides real playtime

**Symptom:** Users with Steam's "Game details" privacy set to "Private" saw every game marked "Untouched" and 0 hours, even games they had played extensively.

**Root cause:** The Steam `IPlayerService/GetOwnedGames` endpoint returns `playtime_forever = 0` for all games when the user's "Game details" are private, while `last_played` is still present. The library page treated all zero-playtime games as genuinely untouched.

**Fix:** Added a `playtimeHidden` heuristic: if ALL games have `playtime.total === 0` AND at least one has `lastPlayed !== null`, the profile is privacy-hidden. The library header, controls, and cards degrade gracefully (show `—` instead of "Untouched").

**Generalized rule:** Steam's privacy settings can return structurally valid but semantically misleading data. Any feature that derives state from playtime zero must also consider the privacy-hidden scenario.

**Prevented by:** Unit tests on `LibraryHeader`, `LibraryControls`, and `GameCard` covering the `playtimeHidden` prop.

---

## ERR-0016

**Date:** 2026-06-28
**Module:** jobs
**Severity:** High
**Status:** Fixed

**Title:** History week/month filters always empty — snapshot cron only targeted `STEAM_ID` env var

**Symptom:** The history chart was empty for all non-env-var users, and week/month filters showed no data for any user.

**Root cause:** `runSnapshot()` in `server/jobs/snapshot.ts` only targeted the single `STEAM_ID` env var. When multi-user onboarding was added, the cron job was never updated to fan out to all onboarded users in the database.

**Fix:** Rewrote `runSnapshot()` to build a deduped Set of steamIds (env var + all users with `onboardedAt != null`), run per-user with individual try/catch, and return a `SnapshotBatchResult` with `usersProcessed` and per-user `results[]`.

**Generalized rule:** Any background job that targets "all users" must query the user table, not a single environment variable. Env var fallbacks are for the developer's solo install only.

**Prevented by:** Integration tests that seed a second onboarded user and assert both users get snapshot rows; separate test for dedup when the env var user is also in the DB.

---

## ERR-0017

**Date:** 2026-06-28
**Module:** frontend, jobs
**Severity:** High
**Status:** Fixed

**Title:** Re-sync button spins forever; unbounded achievement fan-out on re-sync; writes not atomic

**Symptoms:**
1. `ResyncButton` had no try/catch — if `resyncNow()` threw, `isPending` stayed true and the spinner never cleared.
2. `resyncNow` action called `runOnboardingBackfill` with no achievement limit, causing it to fan out to all owned games (potentially hundreds of Steam API calls) on every manual re-sync.
3. `runOnboardingBackfill` executed User/Game/OwnedGame/Snapshot writes as separate awaits — a mid-flight failure left partial data with `onboardedAt` unset.

**Root cause:** Three independent gaps: (1) missing error boundary on the client, (2) no per-call limit passed from the resync path, (3) writes never wrapped in a single `$transaction`.

**Fix:**
1. `ResyncButton` now wraps `await resyncNow()` in try/catch; on catch it sets an error string rendered with `aria-live="polite"`.
2. `resyncNow` action defines `ACHIEVEMENT_RESYNC_LIMIT = 20` and passes it through `resyncAccount → runOnboardingBackfill → recordAchievementUnlocks`.
3. All User/Game/OwnedGame/Snapshot writes (plus the `onboardedAt` update) are wrapped in `prisma.$transaction(async (tx) => { ... })`. `recordAchievementUnlocks` stays outside (best-effort).

**Generalized rule:** Client islands that call server actions must always handle rejection — `useTransition` does not catch throws. Long-running background fan-outs must be bounded when called from interactive paths. Multi-table write sequences that must succeed atomically belong in `$transaction`.

**Prevented by:** Unit tests on `ResyncButton` (error message + spinner-cleared); `account-settings` test for achievement limit arg; `onboarding-backfill` test asserting `$transaction` is called with a callback.

---

## ERR-0018

**Date:** 2026-07-06
**Module:** frontend
**Severity:** Medium
**Status:** Fixed

**Title:** History page empty until snapshots span ≥2 week/month periods (the period cliff)

**Symptoms:**
1. A user with real recent play (e.g. 3 daily snapshots inside one ISO week) saw the "History is still building" empty state instead of a chart, even though play clearly happened.
2. A signed-in-but-not-onboarded user (no snapshot rows) landed on "No history yet" instead of being routed to onboarding.

**Root cause:** `aggregatePlaytime` (`lib/history/aggregate.ts`) bucketed only by ISO week or calendar month; a span that fell inside a single period produced exactly one point. `app/history/page.tsx` then discarded any `< 2`-point series as the empty state, so any short span (and every span inside one week/month) hit the cliff. Separately, the page did not gate on onboarding status like the genres page (ERR-0008), so a not-onboarded user saw a misleading empty state rather than `/onboarding`.

**Fix:**
1. `aggregatePlaytime` now falls back to **day-granularity** points when the requested week/month bucket collapses to `< 2` points and there are ≥2 distinct snapshot days. Day deltas are computed as `max(0, cumulative[day] − cumulative[prevDay])` per game (cumulative playtime is snapshotted ~once/day, so within-day MAX−MIN is 0), zero-filled across the day range. The summed minutes equal the bucketed total — no fabrication.
2. `app/history/page.tsx` calls `getOnboardingStatus()` and `redirect('/onboarding')` for a `not-onboarded` viewer, before any snapshot read (ERR-0008 pattern).

**Generalized rule:** A time-series aggregation whose UI requires ≥2 points must not let its bucket granularity be coarser than the data's own cadence — provide a finer-grained fallback for short spans so real activity is always drawable, and reserve the empty state for genuinely absent data. Any "my data" page that can render an empty state must first distinguish "not onboarded" (→ `/onboarding`) from "onboarded but empty" (ERR-0008).

**Prevented by:** Data-layer unit tests in `tests/unit/history-aggregate.test.ts` (single-week and single-month spans yield ≥2 points with the total preserved) and page tests in `tests/unit/app/history-empty-state.test.tsx` (3 daily rows in one ISO week render a chart; not-onboarded viewer redirects to `/onboarding` without fetching snapshots).

---

### ERR-0019 — Year-in-Review zeroes/under-counts current-year hours

**Date:** 2026-07-06
**Module:** backend
**Severity:** High
**Status:** Fixed

**Symptom:** The Year in Review page reported far fewer hours than the user actually played that year (and 0 for a game with a single in-year snapshot), even though the dashboard's totals were correct. A game with pre-year playtime 100 min and in-year snapshots 200 → 350 showed a 2025 total of 150 min instead of the real 250 min.

**Root cause:** `lib/insights/year-in-review.ts#deltasByApp` computed each game's yearly playtime gain as `(max − min)` among only the snapshots whose UTC year matched the review year. `playtimeForever` is a cumulative monotonic counter, so the year's true gain is `(in-year max) − (the value at the last snapshot strictly before Jan 1)`. Deriving the floor from the in-year *minimum* silently discards every hour accrued before the first in-year sample and returns 0 when there is a single in-year snapshot — the exact ERR-0009 class (a cumulative-counter delta needs a sample bracketing the lower edge of the window). `getYearInReview` never fetched or passed a pre-year baseline.

**Fix:** `computeYearInReview` now takes a `baselineByApp: Map<appId, playtimeForever>` (the last snapshot strictly before the year). New `playtimeDeltasByApp` computes `gain = max(0, inYearMax − (baseline ?? firstInYearSample))`, keeping the monotonic ≥0 clamp. `server/repositories/insights/year-in-review.ts` derives that baseline in-memory from the already-fetched snapshot rows (latest row per app dated before the UTC year boundary) — no extra query. When a contributing game has NO pre-year baseline (onboarded mid-year), the first in-year snapshot is used as a best-effort floor and the result carries a new `partialYear: boolean` caveat instead of a silent fabricated number (degrade-never-fabricate). The dead `deltasByApp` helper was removed.

**Generalized rule:** To measure the *change* of a cumulative counter over a window, the floor must come from a sample taken at or before the window's start — never from the minimum sample *inside* the window, which under-counts and returns 0 with a single in-window sample. When the bracketing sample is missing, surface an explicit caveat, don't fabricate a value. (Same class as ERR-0009; the fixed `countUnlocksInYear` event-count is the sibling pattern.)

**Where else this assumption may be wrong:** Any other "gained within period" metric from snapshot deltas that filters to the period before taking min/max — monthly/weekly playtime gain, achievement-count deltas, library-value change. Each needs a baseline sample from before the window's start.

**Prevented by:** Pure-function tests asserting a positive year total from a pre-year baseline (200→350 with baseline 100 → 250), a single in-year snapshot with a baseline yielding a positive delta (not 0), and the `partialYear` caveat surfacing when no baseline exists; a repository test proving the baseline is derived from pre-Jan-1 rows and that a mid-year onboard flags `partialYear`.

---

## ERR-0020 — Insights pages slow: page-wide await block, duplicate session waterfall, unbounded snapshot scans

**Date:** 2026-07-06 · **Module:** frontend, db · **Severity:** High · **Status:** Fixed

**Symptom:** The `/insights/*` pages (genres, idle, cost-per-hour) were slow to first paint. Three flag-independent causes:

1. Each page did a single top-level `await` for its slowest data source, so the entire page (heading, disclaimers, caveats) blocked until that query resolved — no streaming.
2. The genres page ran the session lookup twice per render: `getOnboardingStatus() → getSessionUser()` then `getViewerSteamId() → getSessionUser()` — a duplicate `getServerSession` waterfall.
3. `getIdleFlags`, `getYearInReview`, and `getAvailableReviewYears` queried `PlaytimeSnapshot` with `findMany({ where: { steamId } })` and no date bound, forcing a full-table steamId scan that never used `@@index([steamId, date])`.

**Root cause:** The interactive render path awaited slow, unbounded work synchronously and re-resolved the session per helper. Snapshot reads were unbounded because the query shape never expressed a date range the composite index could serve.

**Fix:**
1. Each insights page keeps its static shell (heading + disclaimer/caveat) and streams its slow section inside its own `<Suspense fallback={<Skeleton/>}>` where the skeleton mirrors final layout geometry (no CLS).
2. The genres page resolves `getSessionUser()` once and passes it through; `getOnboardingStatus(sessionUser?)` and `getViewerSteamId(sessionUser?)` accept an optional pre-fetched session and skip the fresh lookup when given one.
3. Added the tightest date bound that preserves semantics: `getYearInReview` bounds the playtime scan to `[Jan 1 year, Jan 1 year+1)` UTC (the pure compute already filters to that year); `getIdleFlags` bounds to `IDLE_LOOKBACK_DAYS` (365) via `date: { gte }`. `getAvailableReviewYears` was intentionally left unbounded — a distinct-years query has no semantics-preserving date bound.

Part (a) — moving the flag-gated SteamSpy-tag enrichment off the render path into the nightly job — was NOT done here; it is gated on an unattached Phase-1 human check (ENABLE_STEAMSPY prod value + timing).

**Generalized rule:** On an interactive render path, never let the whole page block on its slowest data source — stream each slow section behind its own Suspense boundary with a geometry-matched skeleton. Resolve the session once per request and thread it through helpers instead of re-fetching. Every repository read against a snapshot table must express a date bound so the composite `(steamId, date)` index is usable — an unbounded `where: { steamId }` is a full-table scan.

**Prevented by:** Repo unit tests asserting the mocked prisma `findMany` call includes a `where.date` bound (idle + year-in-review); auth/onboarding-gate tests asserting a passed session short-circuits the fresh lookup; a structural test asserting each insights page imports and renders a `<Suspense>` boundary with a fallback.

---

### ERR-0021 — First paint of every route gated on the un-suspended shell (3 limiter-serialized Steam calls)

**Date:** 2026-07-15
**Module:** frontend
**Severity:** High
**Status:** Fixed

**Symptom:** Every route showed a blank tab until the shell's Steam I/O settled. Cold, the floor was ≈ 500 ms (three `steamLimiter` acquires serialized at 250 ms spacing) plus the last call's RTT; a single Steam transient added up to 5.25 s of retry backoff to first paint — on every route, since all routes inherit the root layout.

**Root cause:** `app/layout.tsx` mounted async server components (`AppHeader`, `Sidebar` — plus `AuthControls`, a third async node embedded in the header) with no `<Suspense>` boundary anywhere in the shell. React cannot flush any byte of the document while un-suspended async children of the root layout are pending, so the shell's `getProfile`/`getLevel`/`getViewerSteamId` awaits sat on the first-paint critical path of every route (RSC-1/RSC-2, `wayline/optimization/plan/PLAN-theme-3-blocking-shell.md`).

**Fix:** Geometry-matched `HeaderSkeleton`/`SidebarSkeleton` (sync server components; the async `AuthControls` slot is a static pulse placeholder — rendering it for real inside a fallback would make the fallback itself suspend and reinstate the coupling). `app/layout.tsx` wraps each shell component in its own `<Suspense>` with `{children}` outside both boundaries. Additionally, `/u/[steamId]` parallelizes the one sheddable pre-authz pair (`getSessionUser` ∥ privacy lookup) while `canViewProfile` still completes before any target-data fetch (RSC-8).

**Generalized rule:** No un-suspended async component in a layout above `{children}` — every async RSC in a shell/layout must sit behind its own geometry-matched `<Suspense>` boundary, and a Suspense fallback must never contain an async server component. First paint must be structurally independent of upstream API health, not merely fast when caches are warm.

**Where else this assumption may be wrong:** Insights pages — already fixed in bug-3's lane (ERR-0020, per-page Suspense); `/game/[appId]` — already correct (per-section boundaries; the repo's reference pattern). Any future layout-level async component (e.g. a Phase-6 account switcher) inherits this rule.

**Prevented by:** Structural wiring test `tests/unit/shell-streaming.test.tsx` (exactly two boundaries, `{children}` outside — fails on any regression to direct mounts); geometry-equality tests (`tests/unit/header-skeleton.test.tsx`, `tests/unit/sidebar-skeleton.test.tsx`) pinning skeleton↔real class parity from both sides; degrade pin `tests/unit/shell-degrade.test.tsx` (Steam rejection → `—` placeholders, never a crash or fabricated zero).

---

### ERR-0022 — Multiplayer filter recomputed slow-changing Store reference data live on the request path

**Date:** 2026-07-15
**Module:** frontend, db
**Severity:** High
**Status:** Fixed

**Symptom:** `/library?multiplayer=1` fired one live Store `appdetails` call per owned game via `Promise.all` in `getMultiplayerAppIds`; each call drained the capacity-1 / 250 ms `storeLimiter` serially — ~16.3 s cold at N=65 games, linear in library size (STEAM-1, `wayline/optimization/plan/PLAN-theme-2-external-fanouts.md`). The filter also contended with the nightly library-value pass on the same limiter.

**Root cause:** Multiplayer classification was computed from **live** Store data on the request path even though its input (`categoryIds`) is slow-changing reference data the nightly job's `refreshGameStoreData` pass *already fetched* per game — and threw away. There is no batch `appdetails` endpoint (STEAM-9), so any request-path fan-out serializes at the limiter regardless of `Promise.all`.

**Fix:** The repo's twice-proven precompute pattern (ERR-0010, ERR-0011): (1) nullable `Game.categoryIds` column (additive follow-up migration); (2) `refreshGameStoreData` persists `categoryIds` from the metadata it already holds — zero extra Store calls (pinned by a call-count tripwire test); on unavailable metadata the update **omits** the field (last-known-good; `null` on create; never `'[]'`, which would fabricate a positive non-multiplayer classification — a deliberate divergence from the genres `'[]'` reset); (3) `getMultiplayerAppIds` reads the DB in one `findMany` + the existing pure classifier — zero Store calls, `stale` pinned `false`, `null`/malformed rows into `missingCount`. Also in this lane: dedicated reference TTLs `achievementSchema` (7 d) / `achievementGlobal` (24 h) for the two `'global'`-scoped achievement caches (STEAM-2 residual — warm-instance win only, pending the bug-3 durable-cache decision).

**Before/after:** Before — ~16.3 s cold at N=65 (receipt-verified expectation: N × 250 ms limiter floor), unbounded in N. After — one indexed DB read + the retained `getProfile` (typically a same-render cache hit); target < 100 ms, independent of N; zero Store calls proven by the rewritten integration suite (`tests/integration/multiplayer-repo.test.ts` asserts 0 `appdetails` requests on every test). Live wall-clock confirmation is a manual measurement (`wayline/optimization/measurements/theme-2-fanouts.md`) — not fabricated here.

**Generalized rule:** Any per-game external field consumed library-wide on a request path must be persisted by the nightly job and read from the DB — the ERR-0010/0011 precompute rule, now closing its own "where else" note that named multiplayer. When persisting a *classification input*, an empty value on unavailable data is a fabricated classification, not a safe default — omit the write (last-known-good) and route missing data to the designed `missingCount`/unavailable state.

**Where else this assumption may be wrong:** STEAM-2's durable per-user achievement-totals precompute remains a **deferred, currently-unowned residual** (this lane shipped only the cheap TTL right-sizing; the nightly aggregate mirroring `LibraryValueAggregate` is not owned by any theme — recorded here so it cannot be silently dropped). Limiter partitioning (STEAM-4) is explicitly deferred to Phase 6 with the instance-concurrency measurement. First post-deploy nightly run populates `categoryIds` — until then all games are "uncategorized" (designed state); run the guarded cron once manually after deploy.

**Prevented by:** Tripwire tests — Store call count unchanged in the job (`tests/unit/game-store.test.ts`), zero Store calls in the reader on every integration test, `stale === false` pinned; the ERR-0010/0011 suites green throughout.

---

### ERR-0023 — Unbounded snapshot scans, uncached insights aggregates, and the merge-latent baseline starvation

**Date:** 2026-07-15
**Module:** db, frontend
**Severity:** High
**Status:** Fixed

**Symptom:** Every `/insights/*`, `/review/[year]`, and `/history` visit re-scanned the user's **entire lifetime snapshot partition** and re-ran the JS aggregation from scratch: `getAvailableReviewYears` hydrated one row per snapshot to derive ≤ ~6 integers; `getYearInReview` scanned all unlock events ever recorded; `/history` fetched all history to render a 53-week chart. Costs grow monotonically with account age. Separately, the bug-2+bug-3 take-both merge left a latent regression: bug-3's `{gte,lt}` year bound excluded every pre-year row, so bug-2's in-memory baseline derivation (ERR-0019) always came up empty — every review year silently read `partialYear` with a first-in-year floor.

**Root cause:** Snapshot-reading queries passed no `date`/`unlockedAt` bound, so the existing composite indexes (`@@index([steamId, date])`, `@@index([steamId, unlockedAt])`) never pruned (the DATA-7 "missing index" finding dissolved on inspection — the indexes existed; the queries were the defect). No insights aggregate was cached (exactly one `cache(` existed in the insights repositories, and it was the inner SteamSpy lookup). The baseline starvation was a semantic interaction invisible to both branches' own test suites, whose mocks fed pre-year rows through a single mocked query that the real bounded scan would never return.

**Fix (Theme 1, `wayline/optimization/plan/PLAN-theme-1-snapshot-reads.md`):** (T1) main YiR scan keeps bug-3's full `{gte,lt}` bound; `baselineByApp` now comes from its **own bounded fetch** (`groupBy` `lt: yearStart` + keyed read, ≤ 1 row per app) — byte-identical to bug-2's full-history semantics; unlock scan bounded by `unlockedAt`. (T2) `getAvailableReviewYears` uses DB-side `distinct: ['date']` (hydration win everywhere; SQL-transfer win on Postgres). (T3) bug-3's shipped idle bound adopted, verification-only; window-edge margin question handed to bug-3's lane (`wayline/optimization/handoffs/idle-margin-bug3-lane.md`). (T4) `/history` fetches only the rendered window (53 w / 25 mo, `since` floored to the bucket boundary), with an existence probe distinguishing "no data ever" from "no data in window". (T5) every aggregate cached under the single new `TTL.insightsAggregate` (6 h) key with threshold/year/window discriminators; idle dismissals outside the cache.

**Generalized rule:** Never issue a steamId-only `findMany` on an append-only snapshot table — always pass the rendering window so composite indexes prune; when a computation needs context beyond its window (a baseline), fetch it with its own bounded query rather than unbounding the main scan; cache the bounded aggregate (bound+cache are complements — caching alone hides full scans until every cold start); and when a window empties a result, distinguish "no data ever" from "no data in window" before choosing empty-state copy. Test mocks must answer faithfully to the query's captured bounds — a mock that returns rows the real query can't see will mask exactly this class of regression.

**Where else this assumption may be wrong:** Any future reader of `PlaytimeSnapshot`/`AchievementSnapshot`/`AchievementUnlock` (the rule is now in docs/BACKEND.md "Bounded snapshot reads"); nightly-precompute escalation stays available if the `db-rowcount` gated check ever shows multi-second bounded scans. Cross-refs: ERR-0019 (baseline semantics preserved), ERR-0020 (bug-3's bounds adopted), ERR-0010/0011 (precompute lineage).

**Prevented by:** Mock-capture tests pinning every bound (`{gte,lt}` + separate baseline fetch, `unlockedAt` window, `distinct`, windowed `since` + flooring); the faithful two-query mock in `tests/unit/insights-repo-year-in-review.test.ts` (pre-year rows reachable only via the baseline path); bucket-completeness test (red if `since` is unfloored); `tests/unit/insights-cache.test.ts` (warm-cache zero-Prisma, key isolation incl. threshold, dismissal immediacy, SWR preserved); bug-1/2/3 suites green throughout.

---

### ERR-0024 — Unbounded achievement-unlock fan-out in a platform-capped job window (silent truncation)

**Date:** 2026-07-16
**Module:** jobs
**Severity:** High
**Status:** Fixed

**Symptom:** The nightly snapshot job and the first-login onboarding backfill both call `recordAchievementUnlocks` with no `limit`, which selected **every** achievement-bearing game as a candidate (`candidates = all`). Each cold game costs up to 3 `steamLimiter.acquire()` calls at 250 ms each, so the tail grows linearly and unboundedly with library size (~75 s @ M=100) inside a function window that is hard-capped by the platform. The failure mode is **silent truncation**: the serverless window expires mid-loop, later games are simply never recorded that night (nightly) or the onboarding stream is cut with partial data — no error, no signal (STEAM-7/COMP-6, shared tail of STEAM-8/COMP-5; `wayline/optimization/plan/PLAN-theme-5-background-jobs.md`).

**Root cause:** Issue #91 criterion #6 ("records unlock events for ALL achievement games") was implemented as *single-run* completeness, so the omitted-`limit` path had no per-invocation budget at all — the one library-linear external fan-out left after ERR-0003/ERR-0017 bounded the interactive paths, sitting in exactly the place (a background job window) where nothing surfaces the overrun.

**Fix (theme-5 T1):** The unbounded code path is removed. `recordAchievementUnlocks` without an explicit `limit` now processes the union of a **hot set** (top-20 by two-week playtime via the new pure `topGamesByTwoWeekPlaytime` — recent activity is recorded every night) and one **deterministic day-keyed rotation window** of ≤ `ACHIEVEMENT_UNLOCK_NIGHTLY_LIMIT` (40) remaining games (`rotationWindowForDay`: remaining games sorted by `appId`, `ceil(R/40)` windows, index = `dayOfYear(utcDayKey()) mod windowCount` — stateless, no migration, idempotent same-day). Criterion #6 is explicitly weakened to **eventual completeness** (full coverage every `ceil(R/40)` nights; rows carry Steam's real `unlockedAt`, so late recording writes identical rows — delayed, never lost; nothing fabricated). The explicit-`limit` resync path is byte-identical to before (ERR-0017's bound not regressed). Docstring, `docs/ACCEPTANCE.md` (#6 companion note incl. the fresh-user convergence window), `docs/BACKEND.md`, and `docs/DATA_MODEL.md` updated in the open.

**Generalized rule (class rule, generalizing ERR-0003 to jobs):** Unbounded background fan-out in a platform-capped window truncates **silently** — every job fan-out must carry an explicit per-invocation budget (a constant, not a function of dataset size) and its invoking route/page an explicit `maxDuration`; completeness requirements that exceed the budget must be met by *provable convergence across runs* (deterministic rotation/cursor), never by hoping one run fits the window.

**Where else this assumption may be wrong:** The same job window still runs the 2N store passes (`refreshLibraryValueAggregate` + `refreshGameStoreData`) — library-linear, explicitly deferred to the gated STEAM-6 fold decision (theme-5 plan, T3 timings decide); the onboarding invocation cap + `maxDuration` land in theme-5 T2/T3. Any future per-user job pass (friends sync, rarity refresh) inherits this rule.

**Prevented by:** `tests/unit/snapshot-achievement-unlocks.test.ts` — budget cap (≤ 20 + 40 fetches on the no-limit path), hot-set inclusion regardless of window, pure-helper cycle-coverage/idempotence proofs, the rewritten criterion-#6 pin (eventual completeness over one simulated cycle; red if anyone restores single-run semantics or breaks rotation), and the explicit-limit characterization pin (red if the resync bound regresses).

---

## Per-module logs

CLAUDE.md notes that error entries "can be found in each module specifically." `docs/ERROR.md` is the **central, canonical log**. If a module gains its own inline error notes (e.g. a `## Known errors` section in `docs/BACKEND.md`), those notes are a convenience reference only — every entry must still be mirrored here with a full `ERR-XXXX` record. The ID assigned here is the authoritative identifier across all references.
