# Theme 1 measurements — snapshot reads / insights caching

> Branch: `fix/opt-theme-1-snapshot-reads` (stacked on `fix/opt-theme-2-fanouts` @ `a9a2d0d`)
> Task commits: `a07a921` (T1), `2f8bd17` (T2), `c5ffd69` (T3 verification record), `681c06f` (T4), `a2467b6` (T5)
> Plan: `wayline/optimization/plan/PLAN-theme-1-snapshot-reads.md` §Measurement plan
> Recorded: 2026-07-15 by the orchestrator. Live/prod items are `handoff: manual`; nothing simulated.
> Confound note honored: Theme 3 (shell streaming) landed before this theme, so route-level
> LCP/TTFB deltas taken after this branch are attributable. The metrics below are server-side.

## Primary metrics

| Item | Status | Detail |
|---|---|---|
| Rows hydrated per render — structural | **PROVEN locally (CI-gated)** | Mock-capture tests pin every bound: YiR main scan `{gte,lt}` + baseline fetch ≤1 row/app (`insights-repo-year-in-review.test.ts`); unlock scan `unlockedAt {gte,lt}`; review-years `distinct: ['date']` (hydrated rows = days, not games×days — asserted on a 3-games×4-days fixture: 4 rows not 12); `/history` windowed `since` floored to bucket boundary. |
| Rows hydrated — live numbers (`log: ['query']` harness) | **handoff: manual** | Expected: review playtime `games×days_total` → `games×days_year + ≤games` baseline rows; unlocks all-time → in-year; history `games×days_total` → `games×days_window`. SQLite caveat (binding): `distinct` may dedupe in Prisma's query engine — record hydrated-row reduction (guaranteed) separately from DB-transfer reduction (verify on Postgres); do NOT report a SQLite table-scan claim. |
| Repository wall time (synthetic 67 games × 3 y daily ≈ 73k rows, scratch SQLite) | **handoff: manual** | `performance.now()` around `getYearInReview`+`getAvailableReviewYears`, `getPlaytimeSnapshots` before (base `a9a2d0d`) vs after (HEAD). `getIdleFlags` timing is bug-3's shipped win — measure only T5's cache delta on it. |
| Cache hit behavior | **PROVEN locally (CI-gated)** | `tests/unit/insights-cache.test.ts`: second call per wrapped aggregate = zero Prisma calls; key isolation (steamId/year/window/threshold); dismissal immediacy; SWR preserved through the wrap. |

## Interaction note (Theme 5)

Theme 5's T1 will bound `recordAchievementUnlocks` with day-keyed rotation, which can delay
`AchievementUnlock` rows for cold games for up to ceil(R/LIMIT) nights after onboarding.
Theme 1's equality tests seed unlock rows directly and are unaffected — but live before/after
unlock-count measurements taken during that rotation window are confounded. Note the window
when running the manual harness.

## Gated checks carried forward (human/live lane — set urgency, not correctness)

1. **`db-rowcount`** — `SELECT "steamId", COUNT(*) FROM "PlaytimeSnapshot" GROUP BY 1 ORDER BY 2 DESC LIMIT 5;` (same for `"AchievementUnlock"`) on prod/staging. Calibrates whether the 73k-row synthetic fixture is realistic; gates only the nightly-precompute escalation, never these shipped fixes. `handoff: manual (prod)`.
2. **`timing`** — Vercel function-duration traces for `/insights/idle`, `/review/[year]`, `/history` before/after vs ERR-0011's recorded figures. Run after Theme 3's shell fix (already landed below this branch) or read repository-scoped timings. `handoff: manual (prod)`.
3. **`prod-cache-durability`** (inherited from bug-3) — whether prod is single-instance Map-only; determines T5's real-world hit rate. The wrap is correct either way and upgrades for free when bug-3's lane lands a durable backend. `handoff: manual (prod)`.
4. Context values: `ENABLE_STEAMSPY` prod value, platform tier / function timeout, real library N. `handoff: manual (prod)`.

## Lane handoff

The idle window-edge margin observation (+1-day fetch margin proposal) is filed to bug-3's
lane at `wayline/optimization/handoffs/idle-margin-bug3-lane.md` with a reproducing fixture
sketch. The docs/ERROR.md cross-ref lands only if bug-3's lane confirms.

## Environment note

Local: darwin dev machine, SQLite dev DB, vitest. Full gate at closeout: typecheck clean,
lint clean, 113 files / 1026 tests green.
