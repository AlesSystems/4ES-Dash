# Task 05 — route protection + data isolation (authz) (#63)

**Status owner:** implementer · **Depends on:** Task 02 (session), Task 04 (session-scoped data) · **Blocks:** Task 08

## Scope (exactly these files)

- `middleware.ts` (new or extended — protected-route redirect)
- `server/authz.ts` (new — `canViewProfile` gate; see `02-architecture.md`)
- `app/u/[steamId]/page.tsx` (new — public profile route)
- Protected RSC pages / `/api/*` handlers wired to the authz gate (the "my" views)
- `tests/**` for the two required cases

## Goal

Enforce authorization and per-user data isolation: protect private routes,
prevent IDOR (one user reading another's private data), and allow public profile
pages for public Steam profiles.

## Acceptance criteria

1. Middleware / route guards: `/dashboard` (and any "my" view) require a session;
   unauthenticated → redirect to sign-in.
2. Public profile pages (`/u/<steamId>`) render **public** Steam data for any
   visitor; a private Steam profile renders the designed locked state.
3. Authorization enforced server-side: a logged-in user can only access their
   **own** private/derived data; requesting another user's private view returns
   the locked/unavailable state, never their data.
4. `/api/*` handlers scope to the session user (or a validated public `steamId`
   param); covered by `withErrorBoundary` (no extra try/catch unless it yields a
   *different* error).
5. CSRF protection confirmed for any state-changing route (document next-auth
   defaults).
6. Tests: (a) unauthenticated access to a protected route redirects; (b) user A
   cannot read user B's private data via the API (IDOR).

## Degraded / unavailable-data behavior

Private/unavailable profile → `{ available: false, reason }` → designed
empty/locked state. Auth required but missing → redirect, not 500. Friends-only
that can't verify friendship → fail closed (deny).

## Definition of done for this task

- Failing tests first (incl. the IDOR test); gate passes.
- `docs/API.md` / `docs/FRONTEND.md` updated if a route contract changed.
- `state.json` task `05` set to `in-review` with both tests listed.
- Reviewer returns APPROVE.
