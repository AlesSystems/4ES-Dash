# Deployment

Three supported targets: local dev, self-hosted Docker, and Vercel.

## Environment variables

See `.env.example` for the canonical list. The server validates `process.env` at boot via Zod; missing or invalid values crash immediately.

| Var               | Dev    | Docker | Vercel |
| ----------------- | ------ | ------ | ------ |
| `STEAM_API_KEY`   | ✓      | ✓      | ✓      |
| `STEAM_ID`        | ✓      | ✓      | ✓      |
| `DATABASE_URL`    | `file:./dev.db` | Postgres URL | Vercel Postgres |
| `REDIS_URL`       | optional | recommended | Vercel KV |
| `CRON_SECRET`     | optional | ✓ | ✓ |

## Local dev

```bash
pnpm install
cp .env.example .env  # edit
pnpm prisma migrate dev
pnpm dev
```

SQLite at `dev.db`. In-memory cache. No cron — invoke `/api/cron/snapshot` manually (with the
`x-cron-secret` header) if you want to populate snapshots, or run `pnpm prisma db seed` for synthetic history.

## Self-hosted Docker

`docker-compose.yml` brings up the app, Postgres, and Redis:

```bash
docker compose up -d --build
docker compose exec app pnpm prisma db push   # Postgres: schema-driven sync, no migration replay (see ERR-0004)
```

The container exposes port `3000`. A separate `cron` service hits `/api/jobs/snapshot` on its schedule, authenticating with `CRON_SECRET`.

Volumes:
- `postgres-data` — DB persistence.
- `redis-data` — cache persistence (AOF).

Backups: a daily `pg_dump` is written to `backups/` and uploaded to S3 if `BACKUP_S3_BUCKET` is set.

## Vercel

1. Import the repo into Vercel.
2. Add env vars in Project Settings → Environment Variables.
3. Provision Vercel Postgres + KV from the marketplace; their URLs autopopulate.
4. **Build command:** `prisma generate && prisma db push && next build`. Committed migrations are
   SQLite-authored and are **not** replayed on Postgres; `db push` syncs the Postgres schema from
   `prisma/schema.prisma` directly. (`prisma generate` also runs via the `postinstall` script.)
5. Cron is wired via `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/snapshot", "schedule": "0 4 * * *" }
  ]
}
```

Cron requests carry a Vercel-signed header; our handler accepts the `x-cron-secret` shared secret.

## CI/CD

GitHub Actions:

- `ci.yml`: install → typecheck → lint → test → build. Runs on every PR.
- `deploy.yml`: on push to `main`, build and deploy to Vercel (or push the Docker image to GHCR).
- `lighthouse.yml`: weekly Lighthouse run on production, fails if any score < 90.

## Database migrations

- Dev / CI (SQLite): `pnpm prisma migrate dev` (creates + applies); CI runs `pnpm prisma migrate deploy`
  to replay committed migrations against a fresh `ci.db`.
- Prod (Postgres): `pnpm prisma db push` syncs the schema directly. Committed migrations are
  SQLite-authored and are **not** replayed on Postgres (a single migration history can't serve both
  engines). A dual Postgres migration history is deferred — see `docs/ERROR.md` (ERR-0004).
- Destructive migrations require a manual gate: an env var `ALLOW_DESTRUCTIVE_MIGRATIONS=1` must be set for the deploy.

## Rollback

- Vercel: redeploy the previous build from the dashboard.
- Docker: `docker compose pull && docker compose up -d` with the previous image tag.
- DB: roll forward with a new migration; never edit a migration that has shipped.

## Monitoring

- `/api/health` returns `200` with `{ db, cache }` liveness. Point an uptime probe at it.
- Logs ship to stdout in JSON; aggregate with your log provider of choice.
- Errors should surface via Sentry (DSN in `SENTRY_DSN`, optional).
