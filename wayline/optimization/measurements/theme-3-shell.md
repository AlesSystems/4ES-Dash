# Theme 3 measurements — blocking shell / streamed pages

> Branch: `fix/opt-theme-3-shell` · Theme base: `140821b` (altan/optimization post bug-1/2/3 merge)
> Task commits: `d436fb3` (T1), `d1ef879` (T2), `94c7d97` (T3)
> Plan: `wayline/optimization/plan/PLAN-theme-3-blocking-shell.md` §Measurement plan
> Recorded: 2026-07-15 by the orchestrator. Nothing below is simulated — items that
> require a live runtime or prod access are recorded as `handoff: manual`.

## Primary metric — cold-load first paint decoupled from Steam

| Item | Status | Detail |
|---|---|---|
| `shell-timing` (before, at theme base) | **handoff: manual** | Requires a live cold render with `performance.now()` around the shell awaits (or a Vercel function-duration trace). To capture the *before* trace, check out `140821b` (pre-T2) — the plan specified "capture at HEAD, pre-T2"; the branch has since moved, so use the base SHA. Expected per the receipt: cold shell ≥ ~500 ms (3 serialized `steamLimiter` acquires at 250 ms) + last-call RTT; +up to 5.25 s on one transient. |
| `shell-timing` (after, post-T2) | **handoff: manual** | Same trace on branch HEAD `94c7d97`. Expected: document TTFB/first paint independent of Steam; the same ≥ 500 ms resolves inside the streamed boundaries. Function duration may be unchanged — measure paint timing (TTFB/LCP), not duration alone. |
| Runtime streaming proof (ex-TDD Test 1) | **handoff: manual** (maintainer step, explicitly not CI-gated — no Playwright harness in this repo) | Cold `pnpm dev` load, cache cleared: confirm in DevTools that the initial streamed HTML contains the skeleton fallbacks and `{children}` content paints before/independent of the resolved header/sidebar data. Record TTFB/LCP here alongside the trace. ERR-0006 bars this proof from jsdom. |
| `cold-frequency` | **handoff: manual (prod)** | Deployment metrics: cold-start rate and soft-vs-hard nav mix. Scales aggregate impact only; does not gate any Theme-3 task (fix is structural). |

## What IS proven locally (CI-gated, this session)

| Proof | Where | Result |
|---|---|---|
| Exactly two Suspense boundaries; `AppHeader`/`Sidebar` each direct child with correct skeleton fallback; `{children}` outside both | `tests/unit/shell-streaming.test.tsx` (7 tests) | green |
| Skeleton ↔ real outer geometry byte-identical (CLS-safe), pinned from both sides | `tests/unit/header-skeleton.test.tsx`, `tests/unit/sidebar-skeleton.test.tsx` (12 tests) | green |
| Degrade preserved through the refactor (Steam reject → `Lv —`/`—`, count-less nav; no fabricated zeros) | `tests/unit/shell-degrade.test.tsx` (2 tests) | green |
| Full gate | `pnpm typecheck && pnpm lint && pnpm test` | green — 111 files, 983 tests |

## RSC-8 metric (/u/[steamId] pre-authz pair)

Trivial by design (~one session-read latency, tens of ms). Not worth a prod trace per the
plan. Behavior asserted by tests: concurrency (`tests/unit/app/public-profile-parallel-preauthz.test.tsx`,
RED at base → green) and the authz-before-data invariant pin
(`tests/unit/app/public-profile-authz-order.test.tsx`, green at base and after).

## Environment note

All local results above: darwin dev machine, SQLite dev DB, vitest jsdom. No prod/Vercel
observation was available to this run (recorded as handoffs above, never guessed).
