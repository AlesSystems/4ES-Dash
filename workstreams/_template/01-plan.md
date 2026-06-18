# Plan — recently-played streak (EXAMPLE)

> Orchestrator-authored from `00-brief.md`. This example is illustrative only —
> it shows the expected shape and altitude, not a real roadmap feature.

## Approach

Derive a per-game "longest consecutive-day play streak" from the append-only
daily snapshots we already store (`playtimeForever` per `(steamId, appId, date)`).
A day "counts" toward a streak if `playtimeForever` increased vs. the prior
stored day. Pure function over snapshot rows → no new Steam calls, no new table.
Surface it on the Game Detail page as a small RSC stat.

## Sequencing (tasks are independently verifiable; file sets disjoint)

1. **Task 01 — streak calculation (pure).** A pure function in `lib/stats/` that
   takes ordered snapshot rows and returns the longest streak + current streak.
   Test-first; no I/O. *(contract for Task 02.)*
2. **Task 02 — repository read.** Server repository function that loads a game's
   snapshot rows and calls Task 01's function, returning `{ available, ... }`.
   Depends on Task 01's signature only.
3. **Task 03 — Game Detail UI.** RSC stat block rendering the streak with a
   designed empty state when `available: false`. Depends on Task 02's return type.

Write Task 01's function signature first (the contract) so Tasks 02/03 build
against a stable import.

## Risks / unknowns

- Snapshots are daily; a gap caused by the cron not running looks like a broken
  streak. Decision recorded in `02-architecture.md` (treat missing day as break;
  do not interpolate). If the human disagrees, that's a brief change, not an
  implementer call.
- `playtimeForever` is monotonic and clamped on decrease (CLAUDE.md) — the
  calc must tolerate equal-value days (no play) vs. increase (play).

## Out of scope (from brief non-goals)

- No backfill of missing historical days.
- No achievement/session-level streaks — daily granularity only.
