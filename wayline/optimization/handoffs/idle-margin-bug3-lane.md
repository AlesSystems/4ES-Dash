# Handoff — idle window-edge margin question → bug-3 lane

> From: Theme 1 T3 (verification-only task, PLAN-theme-1-snapshot-reads.md)
> Date: 2026-07-15 · Recorded by the orchestrator on `fix/opt-theme-1-snapshot-reads`
> Status: **observation filed, NOT implemented** — single-implementation rule: the idle
> bound is bug-3's shipped surface; Theme 1 ships no competing bound.

## Verification result (T3 acceptance)

- `server/repositories/insights/idle.ts:44` carries bug-3's shipped bound:
  `where: { steamId: id, date: { gte: since } }` with
  `since = new Date(Date.now() - IDLE_LOOKBACK_DAYS * 24*60*60*1000)` (`idle.ts:40`).
- `IDLE_LOOKBACK_DAYS` has exactly one definition — `lib/insights/idle.ts:44` (`= 365`) —
  and is imported (never redefined) in the repository. Verified via repo-wide grep.
- Regression pin present in bug-3's own suite:
  `tests/unit/insights-repo-idle.test.ts:89` `date-bounds the playtimeSnapshot scan so
  @@index([steamId, date]) is usable` (asserts `where.date.gte instanceof Date`). Green.
- **Correction (2026-07-16, theme-1 repair round):** the round-1 claim above was an
  over-claim against TDD row #7 — the `instanceof Date` assertion pins only
  *boundedness*, not the lookback's magnitude or its source constant; the lookback
  could have drifted (e.g. to 30 days, or days→hours) with the suite still green.
  A value-level pin was added in the repair round:
  `tests/unit/insights-repo-idle.test.ts` `pins the lookback magnitude to
  IDLE_LOOKBACK_DAYS from lib/insights (pinned tripwire — green from start)` asserts,
  under a fake clock, `gte.getTime() === now − IDLE_LOOKBACK_DAYS·86400000` with the
  constant imported from `@/lib/insights`. Red-proofed against a local 30-day
  perturbation, then reverted; green on the real code.
- Theme 1 makes zero changes to the idle query or `lib/insights/idle.ts` (T5 later adds
  only a cache wrap in the repository file, query untouched).

## The observation (for bug-3's lane to confirm or refute)

`gte: since` is a hard cutoff: a snapshot **pair straddling the cutoff** loses its
predecessor row, so a spike whose `fromDate` falls on the cutoff day may go undetected —
a potential one-day detection gap at the window edge, recurring as the window slides.

**Reproducing fixture sketch:** with `IDLE_LOOKBACK_DAYS = 365` and `now = D`, seed
`(appId 730, date = D − 365 d − 1 h, playtimeForever = 0)` and
`(appId 730, date = D − 364 d, playtimeForever = 800)`. Full-history detection pairs the
two rows → spike (delta 800 over the idle threshold gap). The bounded fetch drops the
first row; `detectIdleSpikes` sees a single row → no pair → no spike. Expected-if-real:
flag present unbounded, absent bounded.

**Proposed fix (bug-3's lane, if confirmed):** widen only the FETCH margin by +1 day
(`since = now − (IDLE_LOOKBACK_DAYS + 1) days`) so the first in-window snapshot keeps its
predecessor; `detectIdleSpikes` semantics unchanged. Exactly one implementation of the
idle bound should ever exist — do not fork it in any other lane.

## Cross-refs

- ERR-0020 (bug-3's insights-perf entry — owns the bound)
- Theme 1 T6 carries this into a docs/ERROR.md cross-ref **only if** bug-3's lane confirms.
