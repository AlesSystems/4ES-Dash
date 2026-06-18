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
- **64-bit Steam ID** — 17-digit numeric string (e.g. `76561198000000000`).
  Find yours at [steamidfinder.com](https://www.steamidfinder.com) or by
  looking at your Steam profile URL. Must be a string — JavaScript's `Number`
  cannot hold it precisely.

## Local setup

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment variables
cp .env.example .env
```

Open `.env` and fill in the required values:

| Variable        | Required | Description |
| --------------- | -------- | ----------- |
| `STEAM_API_KEY` | yes      | Your Steam Web API key (server-only, never exposed to the browser) |
| `STEAM_ID`      | yes      | Your 17-digit 64-bit Steam ID as a string |
| `DATABASE_URL`  | yes      | SQLite path for local dev: `file:./dev.db` (already in `.env.example`) |
| `CRON_SECRET`   | optional | Required only to call the cron routes (`/api/cron/*`); authenticates the request. Generate with `openssl rand -hex 32` |

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

Phases 0–4 shipped (foundation, Steam data layer, snapshots, friends, and
insights). Phase 5 (polish) and Phase 6 (multi-user auth) in progress.
See the [roadmap](./ROADMAP.md) for details.

## License

Private - AlesSystems
