# Task 06 — genres empty until re-sync: gate on onboarding (#90)

**Status owner:** implementer · **Depends on:** none · **Blocks:** none · **Tier:** 1

## Scope (exactly these files)

- A shared onboarding gate where "my" views resolve the viewer — preferred home:
  `server/auth.ts` (around `getViewerSteamId` callers) or a small guard helper used by
  protected pages
- `app/insights/genres/page.tsx` — distinguish "not yet onboarded" from "empty
  library" (if not handled by the shared gate)
- `middleware.ts` — optional: route not-yet-onboarded sessions toward `/onboarding`
- Corresponding `tests/**`
- (No fan-out added to render — see Risks.)

## Root cause (already traced — fix the cause)

`ownedGame` rows are only written by `runOnboardingBackfill` (via `/onboarding` or
the settings re-sync). The auth `signIn` event upserts a bare `User` with
`lastLoginAt` and does **not** backfill, and nothing gates a signed-in-but-not-
onboarded user to `/onboarding`. So `/insights/genres` (which derives slices from
`prisma.ownedGame.findMany`) renders "No genre data yet" until a manual re-sync.

## Acceptance criteria

1. Session user with `onboardedAt == null` and zero `ownedGame` rows visiting
   `/insights/genres` does **not** render "No genre data yet" — redirects to
   `/onboarding` (or renders a designed "Syncing your library…" state).
2. A user who completed onboarding (≥1 `ownedGame`) sees genre slices **without** a
   manual re-sync.
3. "No genre data yet" is reachable **only** for a genuinely empty library (onboarded,
   0 games) — two distinct tests.
4. Regression: fresh sign-in (auth `signIn` fired, no `/onboarding` visit) → direct
   `/insights/genres` yields populated data or a syncing state, never the bare empty
   state.
5. The onboarding gate/backfill stays idempotent (`onboardedAt` guard) — no duplicate
   rows.

## Degraded / unavailable-data behavior

Not-yet-onboarded → designed "syncing" / onboarding redirect, never a fabricated empty
state. Store API down after onboarding → games fold into an "Unknown" slice (non-empty),
not the empty state. Private profile → existing `{ available: false }` locked state.

## Definition of done for this task

- Failing tests first; gate passes. **Do not** call `runOnboardingBackfill` on page
  render (keeps the rate-limited Store fan-out off the interactive path).
- `docs/BACKEND.md` updated if the onboarding-gate contract is added;
  `docs/ERROR.md` gets an ERR-XXXX for the empty-until-resync class.
- `state.json` task `06` → `in-review` with the gate tests listed. Reviewer returns
  APPROVE.
