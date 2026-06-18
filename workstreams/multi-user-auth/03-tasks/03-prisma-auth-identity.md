# Task 03 — Prisma: next-auth tables + per-user identity (#61)

**Status owner:** implementer · **Depends on:** Task 01 (ADR session decision) · **Blocks:** Tasks 04, 06, 08

## Scope (exactly these files)

- `prisma/schema.prisma` (extend `User`; add next-auth tables if the ADR picks DB sessions; add `Privacy` enum)
- `prisma/migrations/**` (one NEW migration — never edit a merged one)
- `docs/DATA_MODEL.md` (document the new tables, relations, reasoning)
- `tests/unit/*` only if a schema-derived helper needs coverage

## Goal

Extend the Prisma schema for multi-tenancy: next-auth persistence + a per-user
identity, and confirm the existing snapshot/reference tables work for **many**
users. The `User` model is already keyed by `steamId: String @id` and snapshot
tables already relate by `steamId` — this builds on that, it does not rewrite it.

## Acceptance criteria

1. next-auth tables added (`Account`, `Session`, `VerificationToken`) **or** a
   documented JWT-session decision that omits the DB `Session` table — **must
   match the ADR (Task 01)**.
2. App-user identity: the existing `User` table (keyed by `steamId: String`)
   doubles as the authenticated account; add `lastLoginAt`, the privacy field
   (`Privacy` enum, default per ADR), and an onboarding flag (`onboardedAt`)
   used by Task 06/08. (`createdAt` already exists.)
3. Snapshot tables keep their append-only `(steamId, appId, date)` compound key;
   confirm they are usable for **many** SteamIDs. Add relations/indexes as needed
   for per-user queries.
4. One new immutable Prisma migration. `pnpm prisma migrate dev` clean on SQLite;
   schema valid for Postgres prod.
5. `docs/DATA_MODEL.md` updated to document the new tables, relations, reasoning.

## Degraded / unavailable-data behavior

N/A (schema). Must not break existing single-user data: include the migration
path for the legacy `STEAM_ID` row (it becomes a normal `User`). **Coordinate
with #24** per the issue note so the two migrations don't collide.

## Definition of done for this task

- Migration applies cleanly; `pnpm prisma migrate dev` + gate (`tsc --noEmit`) pass.
- `docs/DATA_MODEL.md` updated (Documentation Rule).
- `state.json` task `03` set to `in-review`.
- Reviewer returns APPROVE.
