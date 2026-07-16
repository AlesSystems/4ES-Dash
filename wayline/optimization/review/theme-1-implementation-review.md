# Theme 1 — Snapshot Reads: Implementation Review (Round 1)

- **Theme:** 1 — Unbounded snapshot reads, uncached insights (DATA-2/3/4/5/6/7, COMP-1/2/3/4/8, RSC-4/5/7)
- **Branch:** `fix/opt-theme-1-snapshot-reads`
- **Range:** `a9a2d0d...5483fc0` (T1 `a07a921`, T2 `2f8bd17`, T3 `c5ffd69`, T4 `681c06f`, T5 `a2467b6`, T6 `5483fc0`)
- **Date:** 2026-07-16 · **Reviewer:** adversarial reviewer, round 1 (read-only)
- **Contract:** `wayline/optimization/plan/PLAN-theme-1-snapshot-reads.md` (REVISED round 2) + `wayline/optimization/investigation/SUMMARY.md`

## Full gate (run by reviewer, not trusted from claims)

```
pnpm lint       → ✔ No ESLint warnings or errors
pnpm typecheck  → tsc --noEmit, clean (exit 0)
pnpm test       → Test Files 113 passed (113) · Tests 1026 passed (1026)
```

Matches the closeout claim in `wayline/optimization/measurements/theme-1.md` (113 / 1026) exactly.

## Red-first (TDD) empirical receipt

I built a throwaway worktree at base `a9a2d0d`, copied the HEAD test files in, and ran them against the base implementation: **23 tests fail on base** — including the faithful-mock ERR-0019 test (`reaches back to the pre-year baseline snapshot`), every bound-capture test (`{gte,lt}` + groupBy baseline, `unlockedAt` window, `distinct`), all flooring tests, and all 12 cache tests. This proves (a) the tests were written against real prior behavior, not retrofitted, and (b) **the merge-latent bug-2 baseline starvation was a real production bug on the merged tree** — the base ERR-0019 test only passed because its old mock ignored the `where` bounds. The T1 rewrite of that test to a faithful mock is a strengthening, not a weakening. Tests that pass on base (`unlock boundary`, `game name lookup`, key-isolation-without-cache) are honestly labeled "pinned tripwire — green from start" in the test source, matching the plan's own green-from-start rows.

## Findings against the mandatory hunt list

**1. Acceptance criteria / TDD rows.** All T1, T2, T4, T5, T6 acceptance criteria verified met with regression-catching tests (details per item below). TDD rows #1–#6, #8–#17 realized; #1 realized per the round-2 text, not the stale round-1 row (see Notes). **Row #7 (idle pin) is under-realized — the sole blocker, below.**

**2. Round-2 `{gte,lt}` adjudication.** Compliant. `server/repositories/insights/year-in-review.ts:79` keeps bug-3's full `date: { gte: yearStart, lt: yearEnd }` on the main scan, byte-preserved; the baseline is sourced **exclusively** from a separate `groupBy` bounded `lt: yearStart` (`:87-91`) plus a keyed `OR` fetch (`:110-116`); the in-memory derivation from main-scan rows is deleted. Test `preserves bug-2 baseline semantics under bounding` pins the bug-2-derived expected object (250 = 350−100, not 150; latest-pre-year-wins; `Dec 31 23:59:59.999` vs `Jan 1 00:00` boundary; partial-year caveat) and asserts exactly 2 `findMany` calls with the baseline arriving only via the keyed fetch. Unlock scan bounded `unlockedAt: { gte, lt }` (`:98`). `lib/insights/year-in-review.ts` has zero diff (pure-module contract intact).

**3. Faithful mocks.** Strong. `tests/unit/insights-repo-year-in-review.test.ts:29-116` implements mocks that answer only what the captured `where` bounds would return (range filtering for scans, per-app `_max.date` for groupBy, exact-pair matching for the keyed fetch, `distinct` dedupe applied only when requested). Verified empirically: the faithful mocks make the base implementation fail. The T5 suite uses the **real** cache module (spy-wrapped via `importOriginal`), so warm-hit/SWR/single-flight behavior is the actual implementation, not a fake.

**4. T3 zero-prod-diff.** Confirmed: `c5ffd69` touches only `wayline/optimization/handoffs/idle-margin-bug3-lane.md`. Bug-3's shipped bound verified present at base (`getIdleFlags` `where: { steamId, date: { gte: since } }`, `since = now − IDLE_LOOKBACK_DAYS·86400000`); the current `loadIdleSpikes` body (`server/repositories/insights/idle.ts:91-101`) is byte-equivalent to the base query — T5 only relocated it inside the cache loader. `rg IDLE_LOOKBACK_DAYS`: one definition (`lib/insights/idle.ts:44`), imports only. The +1-day margin is recorded as a bug-3-lane proposal with a reproducing fixture sketch — not implemented; no competing bound exists. **However, see Blocker 1 on the pin test's strength.**

**5. T4 flooring/probe.** Correct. `historyWindowStart` (`lib/history/aggregate.ts:229-240`): month → `Date.UTC(y, m−25, 1)` (month start); week → UTC midnight − 371 d then floor to ISO Monday via `(getUTCDay()+6)%7` — matching `aggregatePlaytime`'s ISO-week bucketing (`isoWeek`, Monday-based, UTC). Boundary no-op case tested (Monday `now` doesn't slide an extra week). Bucket-completeness test (TDD #11) is genuinely red if `since` is unfloored (verified red on base). The probe is `prisma.playtimeSnapshot.count({ where: { steamId } })` (`app/history/page.tsx:74-76`) — the plan's sanctioned `count` alternative (compound PK, no scalar `id`); it fires only when the windowed fetch is empty, and the page renders "No recent playtime … last 53 weeks / 25 months" vs the true "No history yet", both tested (TDD #13, three fixtures). Bug-1's redirect gate and `aggregateByDay` fallback are diff-untouched and their tests green. `getFirstSeenDates`/`getLibraryWithAcquisition` untouched (comment-only mention in the diff); `/history` is the only production caller passing `since`.

**6. T5 caching.** Compliant. Keys via `cacheKey` → `steam:insights-idle:<id>:<threshold>` (default resolved before keying, `idle.ts:43-49`), `steam:insights-year-in-review:<id>:<year>`, `steam:insights-review-years:<id>`, `steam:insights-cost-per-hour:<id>`, `steam:insights-genres:<id>`, `steam:history-snapshots:<id>:<epochMs-of-floored-since>` — all asserted literally with `TTL.insightsAggregate` as the TTL arg (TDD #17). `rg 21600` → only `server/cache/ttl.ts:24`. Theme 2's `achievementSchema`/`achievementGlobal` keys intact (take-both preserved). Genres diff is additions-only — the inner SteamSpy `cache(cacheKey('steamspy','global',appId), TTL.steamSpy, …)` at `genres.ts:112` is untouched. Cost-per-hour propagates the cache's `stale` (`cost-per-hour.ts:44-49`) with an end-to-end SWR test (expire → loader throws → prior value, `stale: true`). Dismissal fetch/filter/name-lookup run outside the cache; dismissal-immediacy tested with the snapshot stage still warm. Unparameterized `getPlaytimeSnapshots` pinned uncached. Key isolation tested for steamId / year / window / threshold + default-sharing. `clearCache()` present in `beforeEach` of all five suites exercising wrapped functions (incl. the new `snapshots-repo.test.ts`); `genres` suite's old pass-through cache fake was replaced with the real module — a strengthening.

**7. Scope.** Clean. All 22 changed files fall within the plan's Affected-files union + sanctioned test-name reconciliation + Required-docs + the two wayline files. **Zero diff** under `app/insights/**`, `app/review/**`, `lib/insights/**`, `prisma/**`, `server/cache.ts`, `server/jobs/**` (verified with targeted `git diff` — empty). No migrations. No test deleted or weakened (the one rewritten test was made stricter, with empirical proof).

**8. Cross-lane regressions.** Bug-2's 250-not-150 baseline test, bug-1's redirect/fallback tests, bug-3's idle/date-bound tests, bug-5's genres suite — all in the green 1026. `ttl.ts` composition intact. Theme 2's persisted category/genre path untouched.

**9. Docs honesty.** ERR-0023 appended with index row; no prior entries edited or renumbered (diff is add-only in `docs/ERROR.md`). BACKEND bounded-reads rule + cache-key table, DATA_MODEL no-schema-change record, FRONTEND window/empty-state semantics all present. Measurements file is honest — the two "PROVEN locally" items are CI-verified facts (I reproduced them), gated prod items are listed as handoffs, gate counts reproduced exactly, nothing simulated. One completeness gap: see Issue 2.

**10. Full gate.** Green, run by me — see above.

**Invariants:** `steamId` string everywhere (all new `where`s use `requireSteamId` output; keys embed the string); TTL literal single-sourced; no route handlers touched (no new try/catch); no new I/O boundaries (Prisma-clause + cache-wrap changes only, so no new Zod surface); degrade-never-fabricate honored (partial-year caveat, quiet-state vs no-data-ever probe); snapshot write path untouched; zero migrations; no secrets; no `"use client"` added.

## Issues

**BLOCKER 1 (Moderate severity, ~75% confidence) — T3 / TDD row #7: the idle regression pin is weaker than the plan specifies, and no compensating test exists.**
The binding TDD row #7 requires: "Mock captures `where.date.gte` **≈ now − IDLE_LOOKBACK_DAYS days**, constant imported from `lib/insights` … pinned so Theme 1 cannot drift it." T3's scope sanctions skipping a new test only "if **not already present** in bug-3's suite." The only pin that exists — `tests/unit/insights-repo-idle.test.ts:93-101` — asserts merely `call.where.date.gte instanceof Date`. It pins *boundedness*, not the *lookback magnitude or source*: Theme 1 could have changed `since` to `now − 30 days` (or days→hours) and every test would stay green. This is not academic — T5 (`a2467b6`) refactored exactly this code path, relocating the `since` computation into `loadIdleSpikes` (`server/repositories/insights/idle.ts:95`). I verified by hand against base that the query is byte-preserved, so **no behavioral regression shipped** — but the plan-mandated tripwire that makes that property machine-checked is absent, and the handoff file (`wayline/optimization/handoffs/idle-margin-bug3-lane.md`) over-claims the existing pin satisfies T3 without recording a sanctioned deviation from row #7's value-level assertion. Fix is one test: fake-timer clock, assert `gte.getTime() === now − IDLE_LOOKBACK_DAYS·86400000` (or within a small tolerance) using the constant imported from `@/lib/insights`.

**Issue 2 (Minor, non-blocking) — Measurement-plan primary metric #2 (repository wall time on the synthetic 73k-row SQLite fixture) was deferred as `handoff: manual` with no receipts.**
The plan designed this metric specifically to be "measurable *today* without prod access" — it is not one of the gated prod checks — yet `wayline/optimization/measurements/theme-1.md` punts it to the manual lane. The file is *honest* about this (nothing simulated), and the Measurement plan is not among the sections my contract enumerates as binding, so I do not block on it — but the human should either require the before/after harness run before merging to `main` or explicitly waive it; the theme's magnitude story currently rests on structural proofs only.

## Nits

- The plan itself contains stale round-1 text contradicting its own round-2 revision: Affected-files says "drop `gte`, keep `lt`" and TDD row #1 says "no `gte`" (`PLAN-theme-1-snapshot-reads.md:179,206`), while the round-2 header, Chosen-fix pt.1, T1 acceptance, and Rejected-alternatives mandate keeping `{gte,lt}`. The implementer correctly followed round-2. The plan doc should be tidied in its own lane so nobody later "fixes" the code toward the stale rows.
- `app/history/page.tsx:13` imports `prisma` directly into a page for the probe. Plan-sanctioned ("the page does a cheap existence check"), but a one-line repository helper (e.g. `hasAnySnapshots(steamId)`) would preserve the page→repository layering and keep `@/server/db` out of `app/`.
- The plan's "T6 verifies and states this" for `docs/API.md` (no contract change) is stated only in the T6 commit message, not in any committed doc. Cheap to add a line to the measurements file.
- `wayline/optimization/` has no machine-readable state file update ("workstream state per convention"); the handoff + measurements files appear to be the operative convention here — confirm that matches the orchestrator's expectation.

## Notes for the human reviewer

- T1 is more than a perf change: it **fixes a real shipped bug** on the merged tree (every Year-in-Review read `partialYear` with in-year-floor totals because bug-3's bound starved bug-2's baseline). The empirical base-run receipt above demonstrates it; ERR-0023 records it accurately.
- The `history-snapshots` cache windowCode is the epoch-ms of the *floored* window start — keys roll over naturally at ISO-week/month boundaries, so no stale-window aliasing is possible within the 6 h TTL.
- `/history` is now a bounded product surface (53 w / 25 mo) by design; the semantic narrowing is documented in `docs/FRONTEND.md` rule 5.

Everything except Blocker 1 verified clean; re-review after the pin-test fix should be fast (the fix touches only `tests/unit/insights-repo-idle.test.ts` and, if desired, a one-line honesty amendment to the handoff/measurements files).

VERDICT: REJECT
