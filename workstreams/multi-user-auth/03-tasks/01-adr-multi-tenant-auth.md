# Task 01 — ADR: multi-tenancy + Steam OpenID auth (#59)

**Status owner:** implementer · **Depends on:** none · **Blocks:** Task 02, Task 03

## Scope (exactly these files)

- `docs/adr/0002-multi-tenant-steam-openid-auth.md` (new — next sequential number)
- `docs/adr/README.md` (update the index table only)

Docs-only. Touch nothing else.

## Goal

Record the decision to convert 4ES-Dash from single-owner to **multi-tenant**,
authenticated with **Steam OpenID** (next-auth / Auth.js). This ADR is the
source of truth the rest of Phase 6 builds against — it finalizes the
*ADR-to-confirm* items in `02-architecture.md`.

## Acceptance criteria

1. New ADR follows the existing MADR format (copy `0000-template.md`:
   Context / Decision / Consequences / Alternatives) and is `Proposed` or
   `Accepted` per `docs/adr/README.md`.
2. Captures the **identity model**: SteamID (returned by Steam OpenID) is the
   account key, a string.
3. Decides and justifies the **session strategy** (JWT vs DB sessions) — this is
   the input Task 03 needs to know whether to add the next-auth `Session` table.
4. Documents the **per-user data-isolation** approach and what happens to the
   legacy single `STEAM_ID` env var (dev / featured fallback, no longer "the user").
5. States the key Steam constraint explicitly: **OpenID establishes identity,
   not data access** — the Web API still returns only public data regardless of
   who is logged in.
6. Notes the **free/zero-cost** impact (DB growth, snapshot rate budget across N
   users) and the retention / scaling stance.
7. Picks the **default privacy level** (input for Task 03's `@default`).
8. Lists **alternatives considered** (email+password+link, no-login profile
   viewer) and why rejected.
9. `docs/adr/README.md` index table updated with the new row.

## Degraded / unavailable-data behavior

N/A (documentation). Must explicitly state the degraded paths other tasks
implement: private profile → designed locked state, never a thrown error or
fabricated zero.

## Definition of done for this task

- ADR written; index updated; cross-links to SECURITY/ARCHITECTURE/STEAM_DATA_SOURCES.
- The PostToolUse gate is N/A for `.md`, but `pnpm build` must still pass.
- `state.json` task `01` set to `in-review`.
- Reviewer returns APPROVE.
