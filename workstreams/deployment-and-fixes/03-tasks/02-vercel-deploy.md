# Task 02 — deploy to Vercel (#86, absorbs #45)

**Status owner:** implementer · **Depends on:** Task 01 (snapshot/cache stable) and
Task 07 (snapshot.ts) — **serialize `server/jobs/snapshot.ts` + `server/cache.ts`** ·
**Blocks:** none (ship) · **Tier:** 3

## Scope (exactly these files)

- New `vercel.json` — `crons` schedule for `/api/cron/snapshot`
- `prisma/schema.prisma` (`provider = "postgresql"`) +
  `prisma/migrations/migration_lock.toml`
- `app/api/cron/snapshot/route.ts` — accept `Authorization: Bearer`; add `GET`
- `package.json` — `vercel-build` running `prisma generate && prisma db push`
- `server/cache.ts` — optional Upstash Redis branch (gated on env) **or** documented
  in-memory limitation (**merge point** with Task 01)
- `server/jobs/snapshot.ts` — iterate onboarded users **or** document single-`STEAM_ID`
- `server/auth.ts` — confirm callback derives from `NEXTAUTH_URL`; host trust
- `README.md` + `docs/DEPLOYMENT.md` — Deploy-to-Vercel button + Vercel section + env
  table; `.env.example` notes `NEXTAUTH_URL` must be the deployed HTTPS URL
- Corresponding `tests/**` (cron auth, env/callback)

## Deploy-readiness gaps (already traced)

SQLite can't run on Vercel serverless; SQLite-authored migrations can't replay on
Postgres (use `db push`); no `vercel.json`/cron; cron reads `x-cron-secret`/POST but
Vercel sends `Authorization: Bearer`/GET; build doesn't provision the DB; "Redis in
prod" is unimplemented (`REDIS_URL` parsed, never consumed); `NEXTAUTH_URL`/callback
localhost fallbacks; cron snapshots only the single `STEAM_ID`.

## Acceptance criteria

1. `vercel.json` exists with a schema-valid `crons` entry for `/api/cron/snapshot`.
2. Cron route → 200 for `Authorization: Bearer <CRON_SECRET>` **and** legacy
   `x-cron-secret`, 401 for neither; method matches Vercel (GET) — unit-tested.
3. `schema.prisma` provider is `postgresql`; `prisma db push` against Postgres
   creates all tables with no SQLite-only DDL errors (CI vs throwaway Postgres);
   `Privacy` enum, `genres String` (JSON-as-text), `Int @id`, `DateTime` defaults
   verified.
4. Env validation passes with the deployed set; missing `NEXTAUTH_URL` fails fast;
   the OpenID callback derives from `NEXTAUTH_URL` (no localhost when set).
5. Build provisions the schema; a fresh DB serves a page without "relation does not
   exist".
6. README has a working **Deploy-to-Vercel button** with the full required-env prompt
   list (**closes #45**); `docs/DEPLOYMENT.md` has a real Vercel section.

## Degraded / unavailable-data behavior

Missing optional env (no `REDIS_URL`) → fall back to in-memory cache, documented as a
known v1 limitation; never crash on a missing optional. Multi-user cron with no
`STEAM_ID` → iterate onboarded users (or skip cleanly with a logged reason), never
throw nightly.

## Definition of done for this task

- Failing tests first (cron auth, env/callback); gate passes. Use a pooled Postgres
  connection string. **Do not edit any merged migration.**
- `docs/DEPLOYMENT.md` + `README.md` + `.env.example` updated (Documentation Rule).
- `state.json` task `02` → `in-review` with cron-auth + env/callback tests listed.
  Reviewer returns APPROVE. (Real production deploy + env set in the Vercel dashboard
  is the human's step.)
