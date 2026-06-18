# Task 05 — compare: don't render a raw SteamID as a name (#89)

**Status owner:** implementer · **Depends on:** Task 04 (shared root cause) ·
**Blocks:** none · **Ships with Task 04 in ONE PR** · **Tier:** 1

## Scope (exactly these files)

- `components/compare/UserColumn.tsx` — null-profile display fallback
- `app/compare/page.tsx` — `aName`/`bName` derivation (same file as Task 04)
- A compare UI test

Keep the fallback-name change **local to compare** unless a shared formatter is
deliberately introduced (a shared one would also touch `/u/[steamId]` + friends).

## Root cause (already traced — fix the cause)

Two layers: the shared origin (Task 04 — side A defaults to the placeholder
`env.STEAM_ID`, so `profile` is null), plus an **independent display fallback** that
renders the raw `steamId` as a name when `profile` is null:
`UserColumn.tsx` → `profile?.personaName ?? steamId`; `page.tsx` →
`cmp.a.profile?.personaName ?? cmp.a.steamId`. Task 04 fixes the normal case; this
task hardens the fallback so a 17-digit id is never shown as a name.

## Acceptance criteria

1. When a side's `profile` is null, the rendered name **does not match** `/^\d{17}$/`
   — fall back to a friendly token (e.g. `"Player " + steamId.slice(-4)`, or
   `"Unknown player"`) and/or a "couldn't load this profile" sub-state.
2. With Task 04 applied, the authenticated user's own side renders their **persona
   name**, not a number.
3. A failed/empty `GetPlayerSummaries` for a side renders the designed fallback, not
   a crash and not a bare id.
4. Regression: render with `env.STEAM_ID = 76561190000000000` and assert
   `76561190000000000` never appears as a displayed name.

## Degraded / unavailable-data behavior

This *is* the degraded-display task: a null/unavailable profile gets a designed,
human-readable placeholder name + sub-state — never a raw SteamID, never a crash.

## Definition of done for this task

- Failing test first; gate passes. Shares the PR + ERR-XXXX with Task 04.
- `state.json` task `05` → `in-review` with the display test listed. Reviewer returns
  APPROVE.
