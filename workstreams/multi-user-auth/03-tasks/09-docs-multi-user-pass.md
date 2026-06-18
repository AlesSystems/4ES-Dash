# Task 09 — multi-user security + docs pass (#67)

**Status owner:** implementer · **Depends on:** Tasks 01–08 (describes shipped behavior) · **Blocks:** none

## Scope (exactly these files)

- `docs/SECURITY.md`, `docs/ROADMAP.md` (+ root `ROADMAP.md` if it mirrors),
  `docs/ARCHITECTURE.md`, `README.md`, `docs/ACCEPTANCE.md`

Docs-only. Describe what Phase 6 actually shipped — do not change behavior here.

## Goal

Bring the docs in line with multi-tenancy: rewrite the security threat model for
multiple users and update the planning/architecture docs. Closes the gap where
the docs still describe a single-user app.

## Acceptance criteria

1. `docs/SECURITY.md`: threat model updated from "single-user (Phase 1)" to
   multi-user — session hijack, CSRF, IDOR/profile authorization, secret
   management, account-deletion/PII, rate-budget abuse across users. Document the
   controls (map to Tasks 02 / 05 / 08).
2. `docs/ROADMAP.md`: add Phase 6 (Multi-user & Auth); move Steam OpenID out of
   "stretch goals" into the committed phase.
3. `docs/ARCHITECTURE.md`: replace "the configured user" framing with the
   session-user model; add the auth layer and per-user data flow.
4. `README.md`: setup reflects sign-in (not just a single `STEAM_ID`); note
   `STEAM_ID` is now an optional dev/featured fallback.
5. `docs/ACCEPTANCE.md`: add a **Phase 6 — Multi-user & Auth** section with
   testable criteria (the other Phase 6 issues link to it).
6. Cross-links consistent; the ADR (Task 01) referenced.

## Degraded / unavailable-data behavior

N/A (documentation). Must accurately describe the degraded states implemented
across Phase 6 (private profile, friends-only, transient Steam errors).

## Definition of done for this task

- All five docs updated and cross-consistent; `pnpm build` passes.
- `state.json` task `09` set to `in-review`.
- Reviewer returns APPROVE.
