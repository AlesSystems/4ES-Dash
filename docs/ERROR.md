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

## Per-module logs

CLAUDE.md notes that error entries "can be found in each module specifically." `docs/ERROR.md` is the **central, canonical log**. If a module gains its own inline error notes (e.g. a `## Known errors` section in `docs/BACKEND.md`), those notes are a convenience reference only — every entry must still be mirrored here with a full `ERR-XXXX` record. The ID assigned here is the authoritative identifier across all references.
