# 4ES-Dash

Personal Steam stats dashboard — track playtime, achievements, library value,
and trends, all self-hosted with your own data.

![Dashboard homepage](docs/screenshots/home.png)

![Game library](docs/screenshots/library.png)

## Prerequisites

- **Node.js 20+** (the `engines` field enforces this)
- **pnpm** — install with `npm install -g pnpm` or via [pnpm.io](https://pnpm.io)
- **Steam Web API key** — get one at
  [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey)

## Local setup

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment variables
cp .env.example .env
```

Open `.env` and fill in the required values:

| Variable          | Required | Description |
| ----------------- | -------- | ----------- |
| `STEAM_API_KEY`   | yes      | Your Steam Web API key (server-only, never exposed to the browser) |
| `NEXTAUTH_SECRET` | yes      | Signs/encrypts the JWT session cookie. Generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL`    | yes      | Canonical origin, e.g. `http://localhost:3000` for local dev |
| `DATABASE_URL`    | yes      | SQLite path for local dev: `file:./dev.db` (already in `.env.example`) |
| `STEAM_ID`        | optional | 17-digit 64-bit Steam ID. **No longer required** — this is now an optional dev / featured-profile fallback. Signed-in users are identified by their Steam session, not this variable. |
| `CRON_SECRET`     | optional | Required only to call the cron routes (`/api/cron/*`); authenticates the request. Generate with `openssl rand -hex 32` |

> **Sign in with Steam.** Once the app is running, visit
> [http://localhost:3000](http://localhost:3000) and click **Sign in with Steam**.
> Signing in with your Steam account establishes a session and seeds your library
> data. You do not need to set `STEAM_ID` unless you want a pre-seeded featured
> profile on the landing page.

```bash
# 3. Create the database and run migrations
pnpm prisma migrate dev

# 4. Start the development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the local dev setup guide,
including all required environment variables and what each means. Docker
support is planned but not yet available.

## Documentation

- [ROADMAP](./ROADMAP.md) — what we're building, in what order
- [Architecture](./docs/ARCHITECTURE.md) — how the pieces fit together
- [API reference](./docs/API.md) — the JSON surface
- [Frontend guide](./docs/FRONTEND.md) — RSC, Tailwind, components
- [Backend guide](./docs/BACKEND.md) — Steam client, cache, jobs
- [Data model](./docs/DATA_MODEL.md) — Prisma schema and decisions
- [Steam data sources](./docs/STEAM_DATA_SOURCES.md) — what comes from the
  official API, what requires the Store API, and what is unavailable
- [Design system](./docs/DESIGN.md) — colors, type, spacing, tone
- [Deployment](./docs/DEPLOYMENT.md) — local dev setup and environment variables
- [Security](./docs/SECURITY.md) — threat model and controls
- [Contributing](./docs/CONTRIBUTING.md) — branches, PRs, definition of done

## Status

Phases 0–6 shipped (foundation, Steam data layer, snapshots, friends, insights,
polish, and multi-user auth with Steam OpenID). See the [roadmap](./ROADMAP.md)
for the full phase breakdown.

## License

Private - AlesSystems
