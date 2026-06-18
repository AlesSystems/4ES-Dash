# Task 08 — privacy controls + account settings (#66)

**Status owner:** implementer · **Depends on:** Task 03 (privacy field), Task 05 (authz), Task 06 (backfill), Task 07 (UI shell) · **Blocks:** none

## Scope (exactly these files)

- `app/settings/**` (new — account settings page, RSC + minimal client islands)
- Server actions for: set privacy, re-sync now, delete account & data
- `server/repositories/account.ts` (new — delete-all + re-sync orchestration)
- `tests/**` (privacy enforcement, delete-all, re-sync idempotency)

Re-sync **reuses** the Task 06 backfill; delete enforces the authz rules from
Task 05. Do not re-implement either.

## Goal

Account settings page with **privacy controls** (who can see my dashboard) and
account actions (re-sync data, sign out, delete account & data).

## Acceptance criteria

1. Privacy setting persisted on the user: `public` / `friends-only` / `private`
   (default per the ADR). Enforced server-side by the authz rules (Task 05) — a
   non-permitted viewer gets the designed locked state.
2. "Re-sync now": manually re-runs the backfill/snapshot fetch (Task 06),
   rate-limited and idempotent.
3. "Delete my account & data": removes the user's rows (auth tables, snapshots,
   reference data) after a confirm step; documented as the data-deletion path.
4. Sign out from settings (and the app bar, Task 07).
5. Settings page is RSC + minimal client islands; Tailwind tokens; accessible
   forms with proper labels and focus management.
6. Tests: privacy enforcement (friends-only hides from a non-friend); delete
   removes all rows; re-sync is idempotent.

## Degraded / unavailable-data behavior

Friends-only when the friends list is unavailable (private friends) → **fail
closed** (treat as private), never expose. Delete must be atomic-ish; partial
failure surfaces a clear error and leaves no orphaned PII silently.

## Definition of done for this task

- Failing tests first (incl. fail-closed + delete-all); gate passes.
- `docs/DATA_MODEL.md` / `docs/SECURITY.md` updated for the deletion path.
- `state.json` task `08` set to `in-review`.
- Reviewer returns APPROVE.
