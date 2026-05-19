# 4ES-Dash

Personal stats dashboard for Steam. Built with Next.js, the Steam Web API, and a small amount of charm.

## Quick start

```bash
pnpm install
cp .env.example .env   # set STEAM_API_KEY and STEAM_ID
pnpm prisma migrate dev
pnpm dev
```

Open http://localhost:3000.

## Documentation

- [ROADMAP](./ROADMAP.md) — what we're building, in what order
- [Architecture](./docs/ARCHITECTURE.md) — how the pieces fit together
- [API reference](./docs/API.md) — the JSON surface
- [Frontend guide](./docs/FRONTEND.md) — RSC, Tailwind, components
- [Backend guide](./docs/BACKEND.md) — Steam client, cache, jobs
- [Data model](./docs/DATA_MODEL.md) — Prisma schema and decisions
- [Steam data sources](./docs/STEAM_DATA_SOURCES.md) — what comes from the official API, what requires the Store API, and what is unavailable
- [Design system](./docs/DESIGN.md) — colors, type, spacing, tone
- [Deployment](./docs/DEPLOYMENT.md) — local, Docker, Vercel
- [Security](./docs/SECURITY.md) — threat model and controls
- [Contributing](./docs/CONTRIBUTING.md) — branches, PRs, definition of done

## Status

Pre-alpha. Following the [roadmap](./ROADMAP.md) — currently in Phase 0.

## License

Private - AlesSystems
