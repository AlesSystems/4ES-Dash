# Task 04 — session-scoped data layer (retire env.STEAM_ID) (#62)

**Status owner:** implementer · **Depends on:** Task 02 (session helper), Task 03 (schema) · **Blocks:** Tasks 05, 06

## Scope (exactly these files)

- `server/repositories/profile.ts`, `level.ts`, `recently-played.ts`, `friends.ts`,
  `achievements.ts` (still hard-code `getEnv().STEAM_ID` — make `steamId` a required arg)
- `server/repositories/snapshots.ts`, `manual-import.ts`, `insights/idle.ts`,
  `insights/genres.ts`, `insights/year-in-review.ts`, `insights/cost-per-hour.ts`
  (already `steamId ?? getEnv().STEAM_ID` — drop the silent fallback, require the arg)
- `server/env.ts` (mark `STEAM_ID` optional / dev-fallback)
- `.env.example` (document `STEAM_ID` as optional)
- Call sites that relied on the global default (e.g. `app/compare/page.tsx`) —
  pass the session/explicit `steamId` instead
- Corresponding `tests/**` updated; add a two-SteamID isolation test

The RSC pages' own auth wiring belongs to Task 05 — here, only thread `steamId`
through the data layer. If a page needs the session and it isn't available yet,
coordinate via the orchestrator rather than inventing auth here.

## Goal

Retire the global single-owner assumption: every data-layer read is scoped to
the authenticated session user's SteamID (or an explicitly-requested public
profile), not `env.STEAM_ID`.

## Acceptance criteria

1. All `env.STEAM_ID` usages in `server/repositories/`, RSC pages, route
   handlers, and jobs replaced with the session user's `steamId` (Task 02) or an
   explicit `steamId` param for public-profile views.
2. `env.STEAM_ID` demoted to **dev-only / featured-profile fallback**; documented
   as optional in `server/env.ts` and `.env.example`.
3. Cache keys remain `steam:<endpoint>:<steamId>[:<appid>]`; verify no key is
   ever built from a global owner id — each user gets isolated cache entries.
4. Repositories accept `steamId` as an argument (no hidden global). A
   missing/blank `steamId` is a **typed error**, never a silent fallback to
   someone else's data.
5. Tests updated to pass `steamId` explicitly; a test proves two different
   SteamIDs get isolated cache + query results.

## Degraded / unavailable-data behavior

No session and no requested profile → render the logged-out landing (Task 07),
not owner data. Requested private profile → `{ available: false, reason:
'private' }` (designed empty state), never a thrown error or fabricated zero.

## Definition of done for this task

- Failing tests first; gate passes. Grep the diff: **no `getEnv().STEAM_ID`
  inside `server/repositories/**`** after this task.
- `docs/BACKEND.md` updated if the repository contract changed (Documentation Rule).
- `state.json` task `04` set to `in-review` with the isolation test listed.
- Reviewer returns APPROVE.
