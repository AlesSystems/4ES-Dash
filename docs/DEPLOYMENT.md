# Deployment

The supported local-dev path is documented below. Docker support is planned (see Fix 6 below).

## Environment variables

See `.env.example` for the canonical list. The server validates `process.env`
at first use via Zod; missing or invalid values crash immediately with a clear
error message.

| Var               | Local dev       | What it means |
| ----------------- | --------------- | ------------- |
| `STEAM_API_KEY`   | required        | Steam Web API key — get one at [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey). **Server-only** — never prefix with `NEXT_PUBLIC_`. |
| `STEAM_ID`        | optional        | A 17-digit 64-bit Steam ID as a string (e.g. `76561198000000000`). Since Phase 6 the signed-in session user is "the user"; `STEAM_ID` is only a dev / featured-profile fallback (and the nightly cron's target — see the single-`STEAM_ID` note below). JavaScript `Number` cannot hold this precisely; always treat it as a string. |
| `NEXTAUTH_SECRET` | required        | Signs/encrypts the JWT session cookie. Generate with `openssl rand -base64 32`. **Server-only.** |
| `NEXTAUTH_URL`    | required        | The deployment's canonical origin (e.g. `https://your-app.vercel.app`). The Steam OpenID callback derives from this, so in production it MUST be the deployed HTTPS URL — not `localhost`. Validation fails fast if missing/malformed. |
| `DATABASE_URL`    | `file:./dev.db` | Prisma connection string. SQLite file path for local dev; a `postgresql://` URL for self-hosted/managed Postgres (use a **pooled** connection string on serverless). |
| `CRON_SECRET`     | optional (required on Vercel) | Shared secret for cron route handlers (`/api/cron/*`). Vercel auto-injects it as `Authorization: Bearer <CRON_SECRET>`; the route also accepts a legacy `x-cron-secret` header. Compared with `crypto.timingSafeEqual`. Generate with `openssl rand -hex 32`. |
| `REDIS_URL`       | optional        | Redis connection URL. Falls back to an in-memory LRU cache when unset (suitable for local dev). |
| `ENABLE_STEAMSPY` | optional        | Set to `1` to enable SteamSpy genre/tag/ownership enrichment (Phase 4 opt-in). Off by default — enabling adds outbound calls to `steamspy.com`. |
| `ITAD_API_KEY`    | optional        | Free API key from [IsThereAnyDeal](https://isthereanydeal.com/apps/my/). Enables historical-low price data (Phase 4 opt-in). Disabled (no calls made) when unset. |

## Local dev

```bash
pnpm install
cp .env.example .env   # fill in STEAM_API_KEY, STEAM_ID, DATABASE_URL, CRON_SECRET
pnpm prisma migrate dev
pnpm dev
```

SQLite at `dev.db`. In-memory LRU cache (no Redis needed). No cron daemon —
invoke `/api/cron/snapshot` manually with the `x-cron-secret` header if you
want to populate snapshots, or run `pnpm prisma db seed` for synthetic history.

### Database migrations (self-hosted Postgres)

Committed migrations are SQLite-authored (dev + CI). Production Postgres is
provisioned with `prisma db push` (schema-driven sync, no migration replay),
because a single SQLite migration history cannot replay on Postgres. The schema
is kept Postgres-compatible (no SQLite-only types; JSON stored as `String`).
See `docs/ERROR.md` (ERR-0004) for background.

## Vercel (managed hosting)

The fastest path to a live instance. One-click via the **Deploy** button in the
[README](../README.md#deployment), or manually:

1. **Provision a free Postgres database.** Vercel Postgres, [Neon](https://neon.tech),
   or [Supabase](https://supabase.com) all have a free tier. Copy its **pooled**
   connection string (serverless functions open many short-lived connections).
2. **Import the repo** into Vercel.
3. **Set the environment variables** (Project → Settings → Environment Variables):
   `STEAM_API_KEY`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (your `https://<project>.vercel.app`
   origin), `DATABASE_URL` (the pooled Postgres URL), `CRON_SECRET`. Optionally
   `STEAM_ID` (the nightly cron target — see below), `REDIS_URL`, and the Phase-4
   enrichment keys.
4. **Deploy.** The `vercel-build` script runs
   `use-postgres-schema → prisma generate → prisma db push → next build`:
   - `scripts/use-postgres-schema.mjs` flips the datasource `provider` to
     `postgresql` on the ephemeral build container. The committed
     `prisma/schema.prisma` stays `sqlite` so local dev and CI run zero-setup on
     a SQLite file and the full test suite stays green.
   - `prisma db push` provisions the schema directly (no migration replay). The
     SQLite-authored migration history **cannot** replay on Postgres and
     migrations are immutable once merged, so prod is schema-first. The schema is
     Postgres-safe: the `Privacy` enum, `genres`/JSON stored as `String`,
     `Int @id` autoincrement, and `DateTime` defaults all map cleanly.
5. **Cron.** `vercel.json` schedules `GET /api/cron/snapshot` daily at `03:00 UTC`.
   Vercel sends `Authorization: Bearer <CRON_SECRET>`; the route accepts that and
   the legacy `x-cron-secret` header (timing-safe). No `CRON_SECRET` → the route
   returns 401 and the snapshot never runs, so set it.

### Known v1 limitations

- **Cache is in-memory per instance.** `server/cache.ts` is an in-process LRU
  with single-flight de-dup. On Vercel each serverless invocation may be a cold
  instance, so the cache does not persist across invocations. `REDIS_URL` is
  parsed by the env schema but a shared Redis/Upstash store is **not yet wired**;
  correctness is unaffected (every miss just re-fetches through the rate-limited
  client). A persistent self-host should front it with Redis — tracked as
  follow-up.
- **Nightly cron snapshots a single `STEAM_ID`.** The scheduled job runs
  `runSnapshot()` for the configured featured `STEAM_ID`. Multi-user
  scale-out (iterating every onboarded user nightly) is intentionally deferred to
  stay within the free/zero-cost constraint; until then, set `STEAM_ID` to the
  account whose history you want captured. Per-user history still populates on
  demand via the first-login onboarding backfill.
- **The nightly job does per-game fan-out** (one library-value price + one
  achievement-unlock pass per game, both rate-limited at 1 req / 250 ms and both
  best-effort). For a very large library this can run for minutes — fine for a
  background cron, but on serverless raise the function's `maxDuration` (Vercel
  Hobby allows up to 60 s, Pro up to 300 s) or the run may be cut short and simply
  resume on the next night (writes are idempotent, so nothing is corrupted).

## Docker (planned)

Docker support is tracked in issue #44 and is not yet available. The only
supported self-hosted path today is the local dev setup described above.

## CI

GitHub Actions (`ci.yml`): install → typecheck → lint → test → build on every
PR. See `.github/workflows/ci.yml`.
