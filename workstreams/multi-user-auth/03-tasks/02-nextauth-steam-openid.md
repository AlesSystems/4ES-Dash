# Task 02 — next-auth + Steam OpenID provider (#60)

**Status owner:** implementer · **Depends on:** Task 01 (ADR session decision) · **Blocks:** Tasks 04, 05, 06, 07

## Scope (exactly these files)

- `app/api/auth/[...nextauth]/route.ts` (new)
- `server/auth.ts` (new — config + `getSessionUser()` helper)
- `server/env.ts` (add `NEXTAUTH_SECRET`, `NEXTAUTH_URL` to the Zod schema)
- `.env.example`, `.env.ci`, `.env.test` (add placeholders)
- `types/next-auth.d.ts` (new — session/JWT type augmentation)
- `tests/unit/auth.test.ts` (new)
- `package.json` (add the `next-auth` dependency)

If you need to touch a repository or page, STOP — that's Task 04/05/07.

## Goal

Add authentication: next-auth (Auth.js) with a Steam OpenID provider.
Establishes the session every other Phase 6 task depends on. (next-auth is not
currently a dependency.)

## Acceptance criteria

1. next-auth wired with a Steam OpenID provider; sign-in returns the user's
   64-bit **SteamID as a string** and persists it on the session
   (`session.user.steamId`).
2. `app/api/auth/[...nextauth]/route.ts` added; callbacks map the OpenID claimed
   id → `steamId` (string). Session strategy matches the ADR (Task 01).
3. New env vars (`NEXTAUTH_SECRET`, `NEXTAUTH_URL`; `STEAM_API_KEY` already
   present) added to `server/env.ts` Zod schema and `.env.example`; boot
   validation crashes on missing config; placeholders in `.env.ci` / `.env.test`
   so build + tests pass with no real secrets.
4. Server helper (`getSessionUser()`) reads the session user, usable from RSCs
   and route handlers; returns `null` (not an error) when unauthenticated.
5. `STEAM_API_KEY` stays server-only — no `NEXT_PUBLIC_` exposure of secrets.
6. Unit/integration test for the session→`steamId` mapping, with Steam mocked via
   MSW (`onUnhandledRequest: 'error'`).

## Degraded / unavailable-data behavior

Unauthenticated session resolves to "no user" (`null`), not an error. Auth
provider / network failure surfaces a typed error mapped by `withErrorBoundary`,
never a stack trace to the client.

## Definition of done for this task

- Failing test first (TDD), then green; gate passes (related tests + `tsc --noEmit`).
- `state.json` task `02` set to `in-review` with the test file listed.
- Reviewer returns APPROVE.
