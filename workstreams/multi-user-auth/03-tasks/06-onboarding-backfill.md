# Task 06 — first-login onboarding backfill (#64)

**Status owner:** implementer · **Depends on:** Task 02 (session), Task 03 (schema), Task 04 (session-scoped repos) · **Blocks:** Task 08

## Scope (exactly these files)

- `server/jobs/onboarding-backfill.ts` (new — or a server action)
- `app/onboarding/**` (new — "setting up your library" progress/skeleton state)
- Hook into the sign-in flow (next-auth `events.signIn` / `events.createUser`)
- `tests/**` (first-login seeds baseline; second login no duplicate)

Reuse the existing rate-limited `lib/steam/` client and snapshot repository —
do not inline a new fetch or a new limiter.

## Goal

On a user's **first sign-in**, bootstrap their dashboard: fetch profile summary
+ owned games and seed a baseline snapshot so history starts immediately.

## Acceptance criteria

1. First successful sign-in (no existing `User` row, or no snapshots) triggers a
   backfill: `ISteamUser` summary + `IPlayerService` owned games → upsert
   reference rows + initial snapshot via `createMany({ skipDuplicates: true })`.
2. Idempotent: re-running (or concurrent logins) inserts no duplicates; respects
   the token-bucket limiter (1 req / 250 ms) and retry/backoff.
3. Backfill runs server-side (server action or onboarding route), **not blocking
   first paint** — show a designed "setting up your library" progress/skeleton.
4. Private profile at onboarding → mark the account and render the locked state
   with a prompt to make the profile public; no crash, no fabricated data.
5. `lastLoginAt` (and the onboarding flag `onboardedAt`) updated.
6. Test: first login seeds baseline; second login does not duplicate.

## Degraded / unavailable-data behavior

Private profile → `{ available: false, reason: 'private' }` onboarding state.
Steam transient failure → stale-while-revalidate / retry; partial data renders
what's available with the rest in designed empty states.

## Definition of done for this task

- Failing tests first; gate passes. Idempotency proven by test, not assertion.
- `docs/BACKEND.md` / `docs/DATA_MODEL.md` updated if the job contract changed.
- `state.json` task `06` set to `in-review`.
- Reviewer returns APPROVE.
