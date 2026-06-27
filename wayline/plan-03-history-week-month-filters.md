# Plan 03 — History week & month filters show no data despite years of play

> Phase-2 fix plan. Worker (Plan, opus, low) → adversarial reviewer (reviewer, opus, xhigh), READ-ONLY.
> **Verdict: `approve` · readyForImplementation = `true`** (approved round 1 of the revision pass).
> Source of truth: [bug-03-history-week-month-filters.md](bug-03-history-week-month-filters.md).

| Field | Value |
|---|---|
| Fix classification | **mixed** (code-fix + ux-degradation; reviewer upheld) |
| Effort | **M** |
| Worker confidence | 5/5 |
| Reviewer verdict | approve · ready=true · classOk · testMapOk · redFirstOk · scopeOk · nonNegOk · priorAddressed |
| Rounds to approval | revise (initial) → approve (revision round 1) |

## Root cause (recap)

The week/month toggle is **aggregation granularity, not a date filter**: `getPlaytimeSnapshots`
(`server/repositories/snapshots.ts:73-79`) has no date predicate, and `aggregatePlaytime` needs ≥2
snapshots spanning ≥2 distinct period keys to emit ≥2 points (`lib/history/aggregate.ts:166-189`).
Snapshots are forward-only, written at two sites: onboarding seeds one row dated today
(`server/jobs/onboarding-backfill.ts:164-171`), and the nightly cron's `runSnapshot` writes more — but
`runSnapshot` only ever targets the **single featured user** `getEnv().STEAM_ID`
(`server/jobs/snapshot.ts:76-87`), with **no `user.findMany`/loop**. So every non-featured user is
permanently stuck at one onboarding-day row and sees the empty state for both toggles forever, regardless of
years of real cumulative `playtime_forever` (which is **not** a time-series and cannot be reconstructed).
The page also conflates "no snapshots at all" with "only one period so far" behind a single
`points.length < 2` guard at `app/history/page.tsx:56`.

## Classification & strategy

**mixed** — two distinct defects, two lanes:
- **CODE defect:** `runSnapshot` snapshots only `getEnv().STEAM_ID` instead of all onboarded users
  (`snapshot.ts:76`) — a coverage bug fixed by code + red-first test.
- **UX-degradation:** the page shows one misleading "not enough history yet" message for both "no snapshots
  exist" and "history still building" — warranting an honest designed empty state, while **never**
  fabricating a time-series from cumulative `playtime_forever` (Phase-1 confirmed it is unreconstructable).

Pure code-fix ignores the misleading UI; pure ux-degradation leaves the structural defect; pure data-ops-fix
is wrong because the non-featured-user root cause is **repo code** (the missing loop), not production
data/config. A data-ops **verify** lane (cron firing / `CRON_SECRET` / capacity) is retained as
verification-only, not the remedy.

**Strategy — two parts:**
1. **CODE:** Extract the per-user body of `runSnapshot` into a new exported
   `runSnapshotForUser(steamId: string): Promise<SnapshotResult>` (mechanical move of `snapshot.ts:81-203`,
   parameterizing `getProfile(steamId)`). Rewrite `runSnapshot()` to build a **de-duplicated** target set
   (`new Set<string>()`: union `getEnv().STEAM_ID` if set with `prisma.user.findMany({ where: { onboardedAt:
   { not: null } }, select: { steamId: true } })`), iterate calling `runSnapshotForUser` inside a **try/catch
   best-effort fan-out** (mirroring `recordAchievementUnlocks` at `:304-317`) so one user's failure logs and
   does not abort the batch.
2. **UX:** Split the single `points.length < 2` guard into **three honest branches**: (a) `rows.length===0`
   → "No history yet"; (b) `rows.length>0 && points.length<2` → distinct "History is still building";
   (c) ≥2 points → `HistoryToggle` + `PlaytimeChart`. Tailwind tokens only. **No backfill from cumulative
   playtime.**

### Decision — return shape (resolved the round-1 open question)

`runSnapshot()` returns a **backward-compatible** `SnapshotBatchResult` that preserves the existing top-level
keys the cron route returns verbatim (`route.ts:69-70`) and the existing integration test asserts
(`snapshot.test.ts:64-87`): summed top-level `gamesProcessed`, `rowsInserted`, `clamped`,
`achievementRowsInserted`, **plus** new `results: SnapshotResult[]` and `usersProcessed: number`. With the
single featured user (the existing tests' world), `gamesProcessed===2`/`rowsInserted===2` still hold because
the sum over one user equals that user's values — so **no existing assertion changes**. (`date`/`steamId`
move into `results[]`; no existing test reads top-level `date`/`steamId`.)

## Files to change

| File | Edit | Rationale |
|---|---|---|
| `server/jobs/snapshot.ts` *(shared w/ bug-04)* | Extract `:81-203` into exported `runSnapshotForUser(steamId)` (replace `getProfile(featuredId)` → `getProfile(steamId)`). Rewrite `runSnapshot()`: build `new Set<string>()` unioning `STEAM_ID` (if set) with `findMany({ where:{ onboardedAt:{ not:null }}, select:{ steamId:true }})`; iterate calling `runSnapshotForUser` in try/catch (log + continue, no rethrow); accumulate a new exported `SnapshotBatchResult` (summed top-level + `usersProcessed` + `results[]`). Export both. Keep `SnapshotResult` unchanged. | Closes the coverage gap; extraction preserves well-tested per-user logic; try/catch reuses the established best-effort pattern; `Set` dedups featured-also-onboarded; summed shape keeps the route + tests green. |
| `server/jobs/index.ts` | Re-export `runSnapshotForUser` (value) and `SnapshotBatchResult` (type). | Barrel is the public surface; tests import from `@/server/jobs`. |
| `app/history/page.tsx` | Replace the single `points.length<2` guard (`:56`) with three branches on `rows.length` + `points.length` (no-history / still-building / chart). Token classes only, no hex. | Distinguishes "no snapshots yet" from "only one period"; honest empty state, never invented numbers. |

## Tests (red-first → acceptance criteria)

| Test file | Asserts | Proves AC | Red-first condition (fails today) |
|---|---|---|---|
| `tests/integration/snapshot.test.ts` | Seed 2 onboarded users A/B distinct steamIds. **Override MSW** `GetPlayerSummaries` to echo the requested `steamids`. POST `/api/cron/snapshot` (valid secret). Assert `groupBy(['steamId']).length===2` and `body.usersProcessed===2`. | AC1 | Today `runSnapshot` reads only `STEAM_ID` (`:76`), never iterates users → B gets 0 rows → count is 1. (The MSW echo override is what makes this valid — the default handler always echoes one id.) |
| `tests/integration/snapshot.test.ts` | Seed A/B; MSW echoes B but **500s for A**. POST. Assert `status===200`, B's rows present, A's absent. | AC2 | Today one user is processed and a failure rethrows (`:193-203`) → route maps to 500; no second user. Post-fix the per-user try/catch isolates A and returns 200 with B's rows. |
| `tests/integration/snapshot.test.ts` | Seed ONE user that is **both** the featured `STEAM_ID` **and** onboarded. POST. Assert exactly one distinct steamId in `PlaytimeSnapshot` and `body.usersProcessed===1`. | AC3 | `runSnapshotForUser`/`usersProcessed`/the `Set` union don't exist today; guards against a union-without-dedup regression (which would yield `usersProcessed===2`). |
| `tests/unit/app/history-empty-state.test.tsx` *(new)* | RSC page-test (genres-page pattern): `vi.mock` `getViewerSteamId` + `getPlaytimeSnapshots`, stub `PlaytimeChart`. Via `render(await HistoryPage({searchParams:{}}))`: (1) `[]` → "No history yet", no chart; (2) 1 row → "History is still building", no chart; (3) ≥2 rows over ≥2 weeks → chart present. | AC4 | Today `:56` renders ONE message for both 0 and 1 row; the distinct strings "No history yet" / "History is still building" don't exist → cases (1)/(2) fail today. Case (3) passes today (guard, not the red anchor). |

**Acceptance criteria** (5): (1) cron snapshots every onboarded user; (2) one user's failure doesn't abort
the batch, cron still 200; (3) target set deduped (featured-also-onboarded processed once); (4) distinct
honest empty states + chart only at ≥2 points, no fabrication; (5) cron response keeps backward-compatible
summed top-level keys (existing `:64-65` assertions stay green). Each maps to a test above (AC5 = the
existing single-featured-user assertions remain valid).

## Data-ops actions (gated human lane — verification only)

1. **VERIFY** the production cron fires: Vercel → Cron Jobs, `/api/cron/snapshot` runs daily → 200 (not 401 from unset/mismatched `CRON_SECRET`, not 500).
2. **VERIFY** `CRON_SECRET` is set in Vercel env (production).
3. **Coverage query (read-only):** `SELECT "steamId", COUNT(*) rows, COUNT(DISTINCT "date") distinct_days, MIN("date"), MAX("date") FROM "PlaytimeSnapshot" GROUP BY "steamId" ORDER BY distinct_days ASC;` (expect most non-featured users at `distinct_days=1` pre-fix).
4. **Cron-health query (read-only):** `SELECT date_trunc('day',"startedAt") day, status, COUNT(*) FROM "JobRun" WHERE name='snapshot' GROUP BY 1,2 ORDER BY 1 DESC LIMIT 30;`
5. **No backfill** — do NOT synthesize historical rows from cumulative `playtime_forever`; history accrues forward from the first post-fix nightly run.
6. **Capacity check (gated):** confirm the per-user fan-out (rate-limited Steam calls × onboarded-user count) fits the Vercel function timeout for `/api/cron/snapshot`; if the user count is large, a follow-up may need batching/queueing. **(Overlaps bug-04's timeout concern.)**

## Shared files, dependencies & non-negotiables

- **Shared:** `server/jobs/snapshot.ts` (also **bug-04**) and `server/jobs/onboarding-backfill.ts` (also bug-04). This plan modifies **`snapshot.ts`** but **not** `onboarding-backfill.ts` → serialize the `snapshot.ts` edit with bug-04.
- **Dependencies:** bug-04 also touches `snapshot.ts` — coordinate to avoid merge collisions.
- **Non-negotiables engaged:** degrade-never-fabricate (honest distinct empty states; no fabricated time-series); never leak owner data (`getViewerSteamId` still suppresses the `STEAM_ID` fallback in production; no cross-user read introduced); Steam access via `getProfile` (cached + limiter), no inline fetch; `steamId` stays a string (`Set<string>`, `select` strings); cron route auth/error mapping unchanged (per-user try/catch lives inside `runSnapshot`, not the handler); Tailwind tokens only; test-first.

## Blast radius / rollback / regression risks

- **Blast radius:** `snapshot.ts` (multi-user driver + extracted per-user path + new batch result), `index.ts` (exports), `app/history/page.tsx` (three-way branching). The cron route returns `runSnapshot`'s value verbatim — summed top-level shape keeps it JSON-serializable & back-compatible. **Runtime:** the nightly cron now does N× the work — Steam rate-limiter + function timeout are the operational constraints (covered by the gated capacity check, shared with bug-04).
- **Rollback:** revert the 3 code files; no schema/migration change; snapshots written for non-featured users during the fix remain valid and harmless.
- **Regression risks:** function timeout / rate-limit exhaustion for many users (mitigated by per-user isolation + gated capacity check); return-shape change (mitigated by summed top-level keys); union without dedup (mitigated by `Set` + dedup test); empty-state branching must not regress the ≥2-point path (guarded by case 3); per-request MSW override leaking into sibling tests (mitigated by `resetHandlers` in `afterEach`).

## Open questions

Should `HistoryToggle` be visible in the empty states (flip week/month before a chart exists)? **Default
decision:** keep it in the chart branch only (current behavior); cosmetic, product can revisit — no test
maps to it.

## Reviewer notes

Approved after independent verbatim re-verification and a green baseline run (lint/typecheck clean; 21/21
relevant tests pass). Confirmed: the MSW echo override makes test #1 a valid red→green (default fixture
would stay count=1 post-fix); `server/cache.ts` rethrows on **cold** failure so test #2's 500-today is real;
`app/history/page.tsx` is a flat async page (no inline async child) so `render(await HistoryPage())` is
ERR-0006-safe (matches the green `genres-page` pattern); `onboardedAt` already exists in the schema (no
migration). **Non-blocking nit:** test #2's `body.usersProcessed` assertion is slightly under-specified, but
its load-bearing assertions (200, B present, A absent) are solid red anchors.
