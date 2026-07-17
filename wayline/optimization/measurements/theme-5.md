# Theme 5 — Background jobs: measurements

- **Branch:** `fix/opt-theme-5-jobs` (base `92b79ef` = theme-4 final)
- **Commits:** T1 `76ebba3` (nightly budget + day-keyed rotation), T2 `b967de0` (onboarding bound + `/onboarding` maxDuration), T3 `d477cb4` (cron maxDuration + per-pass timings). **T4 not implemented — `db-rtt` gate unmeasurable locally (see below).**
- **Date:** 2026-07-16. Location note: the plan names `wayline/optimization/plan/measurements/theme-5.md`; this file follows the repo-wide `wayline/optimization/measurements/<theme>.md` convention.

## Full gate (orchestrator-run receipts)

- After T1: 115 files / 1050 tests passed; typecheck + lint clean.
- After T2: 115 files / 1054 tests passed; typecheck + lint clean.
- After T3: **115 files / 1058 tests passed**; typecheck + lint clean.

## Primary metric — nightly per-user job wall-clock and per-pass split

- **Unconditional (T1's own metric): PROVEN structurally.** With `limit` omitted, per-invocation candidates ≤ hot-set 20 + `ACHIEVEMENT_UNLOCK_NIGHTLY_LIMIT` 40 = 60, pinned by a red-first test (120-game fixture → ≤ 60 processed). Worst-case limiter cost of the unlock pass is therefore constant: `≤ 60 × 3 × 250 ms = 45 s`, independent of library size. Absolute wall-clock numbers await real `JobRun.payload.timings` rows (below).
- **Contingent (whole-window ≥ 25 % margin): NOT CLAIMED.** Explicitly contingent on (a) the `platform-tier` check confirming a 300 s tier AND (b) the deferred STEAM-6 store-pass fold — both open. On a 60 s tier the ~2N store passes alone can truncate the window; the fold is then promoted from deferred to required (plan, STEAM-6 row). `handoff: manual`.
- **Before-number source (`jobrun` SQL check):** local `JobRun` table is **empty** (0 rows, verified 2026-07-16) — no local before-lane exists. Pre-T3 wall-clock must come from prod `JobRun` rows; post-T3, every cron run self-records `results[*].timings`. `handoff: manual/prod`.

## Onboarding metric — first-login wall-clock

Structural bound PROVEN: first login now passes `ONBOARDING_UNLOCK_LIMIT = 20` to `recordAchievementUnlocks` (spy-pinned, red-first), so worst-case achievement work is `≤ 20 × 3 × 250 ms ≈ 15 s` inside the new `maxDuration = 60` window. The absolute wall-clock measurement (fresh test user, prod-shaped library, before vs after) requires a live onboarding run with real Steam I/O: `handoff: manual`. Target from the plan: ≤ ~20 s at M=100.

## Convergence metric — nights until full unlock coverage

Unit-PROVEN: rotation windows cover every achievement game exactly once per cycle (union over `windowCount` simulated consecutive day-keys = full set; same-day idempotent; rewritten criterion-#6 pin asserts a low-playtime game outside night 1's window is covered by cycle end). At the local library (M = 52: hot set 20 + remaining 32 → windowCount = 1) convergence is 1 night; horizon formula `ceil(R/40)` nights. One real multi-night observation: `handoff: manual`.

## Gated checks (from the plan's human live lane)

| Check | Local result (2026-07-16) | Disposition |
|---|---|---|
| `db-rowcount` / real `M` | `SELECT COUNT(*) FROM OwnedGame og JOIN Game g ON og.appId = g.appId WHERE g.hasStats = 1` on `ci.db` → **52** (67 owned total; real featured library, local) | Local receipt recorded; prod M unknown. `ACHIEVEMENT_UNLOCK_NIGHTLY_LIMIT = 40` stays provisional per plan; at local M the bound formula has ample margin. |
| `platform-tier` (sets cron `maxDuration` 300 vs 60; SUMMARY gated check #4) | Vercel tier not readable locally | **`approval-required`/handoff.** T3 ships provisional 300 with the dependency named in the route comment, exactly as the plan directs. |
| `jobrun` / `jobrun-timing` (promotes/dismisses the deferred STEAM-6 fold) | Local `JobRun` table empty (0 rows) | `handoff` — post-T3 cron runs self-collect `timings`; decision on the store-pass fold belongs to the human lane once real rows exist. |
| `db-rtt` (gates T4 seed batching) | Deployed DB unreachable locally; local dev/test DB is SQLite (sub-ms class, but the gate concerns the **deployed** Postgres-over-network RTT) | **`approval-required` — T4 skipped.** Not fabricated in either direction; the 3N-round-trip seed loop ships unchanged until the gate is measured. |
| `ENABLE_STEAMSPY` prod value | Not readable locally | Out-of-lane input (bug-3 carryover), recorded as unknown; no Theme-5 action. |

## docs/API.md — updated (additive)

`/api/cron/snapshot` response documentation gained the additive optional `results[*].timings` block (T3); the stale pre-batch response example was corrected in the same edit. No other public API surface touched by this theme.
