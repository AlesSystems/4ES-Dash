# Deployment

The supported local-dev path is documented below. Docker support is planned (see Fix 6 below).

## Environment variables

See `.env.example` for the canonical list. The server validates `process.env`
at first use via Zod; missing or invalid values crash immediately with a clear
error message.

| Var               | Local dev       | What it means |
| ----------------- | --------------- | ------------- |
| `STEAM_API_KEY`   | required        | Steam Web API key — get one at [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey). **Server-only** — never prefix with `NEXT_PUBLIC_`. |
| `STEAM_ID`        | required        | Your 17-digit 64-bit Steam ID as a string (e.g. `76561198000000000`). JavaScript `Number` cannot hold this precisely; always treat it as a string. |
| `DATABASE_URL`    | `file:./dev.db` | Prisma connection string. SQLite file path for local dev; a `postgresql://` URL for self-hosted Postgres. |
| `CRON_SECRET`     | optional        | Shared secret for cron route handlers (`/api/cron/*`). Compared with `crypto.timingSafeEqual`. Generate with `openssl rand -hex 32`. |
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

## Docker (planned)

Docker support is tracked in issue #44 and is not yet available. The only
supported deployment path today is the local dev setup described above.

## CI

GitHub Actions (`ci.yml`): install → typecheck → lint → test → build on every
PR. See `.github/workflows/ci.yml`.

---

> **Vercel:** planned for Phase 7.
