# Task 04 — compare: fix "shared games can't be computed" (#88)

**Status owner:** implementer · **Depends on:** none · **Blocks:** none ·
**Ships with Task 05 in ONE PR** (shared root cause, same file) · **Tier:** 1

## Scope (exactly these files)

- `app/compare/page.tsx` — resolve side A from the session, not `env.STEAM_ID`
- `.env` / `.env.ci` / `.env.test` — config hygiene (blank the placeholder
  `STEAM_ID`) **only after** auditing `env.test` + `prisma/seed.ts`
- `tests/integration/compare-repo.test.ts` (extend) + a compare page test
- (No change to `server/repositories/compare.ts` — its degrade logic is correct;
  it's being fed a bad id. No change to `server/auth.ts` — use `getViewerSteamId`.)

## Root cause (already traced — fix the cause)

`app/compare/page.tsx` defaults side A to `getEnv().STEAM_ID`, which is the
placeholder `76561190000000000` (a non-existent account). `getOwnedGames` for it
always fails → `games = null` → `shared = null` → the page renders the
`sharedSkipped = 'unavailable'` "Try again shortly" branch (neither side is
`isPrivate`). The page was **missed in the Phase 6 #81 session migration**.

## Acceptance criteria

1. Authenticated user opens `/compare?b=<valid>` with no `?a=` → side A resolves to
   the **session** SteamID (not `env.STEAM_ID`); side A's profile + library load.
2. With both libraries present, shared games compute — the "Try again shortly"
   message is **not** rendered.
3. Unauthenticated request to `/compare` with no `?a=` → renders the input
   `EmptyState`; it **never** fetches the placeholder account.
4. Regression: render with `env.STEAM_ID = 76561190000000000` set and assert the
   string `76561190000000000` never appears and no "couldn't be loaded" error shows.
5. `app/compare/page.tsx` no longer reads `getEnv().STEAM_ID` directly (grep/import
   assertion) — `getViewerSteamId` is the only source of side A.

## Degraded / unavailable-data behavior

`/compare` is **public**: `getViewerSteamId()` must degrade for anonymous visitors
(no thrown `MissingSteamIdError`). A genuinely private/failed side still renders the
designed locked/unavailable state — but that path must no longer be reachable via the
placeholder default.

## Definition of done for this task

- Failing tests first; gate passes. `docs/ERROR.md` gets an ERR-XXXX for the
  compare-defaults-to-placeholder class of bug.
- `state.json` task `04` → `in-review` with the isolation/regression tests listed.
  Reviewer returns APPROVE.
