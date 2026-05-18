# Architecture

4ES-Dash is a Next.js app that aggregates data from the Steam Web API, caches it locally, and renders a personal dashboard. This document describes the moving pieces and how they fit together.

## High-level diagram

```
┌──────────────┐    HTTPS    ┌────────────────────────────────────┐
│   Browser    │ ──────────▶ │  Next.js (App Router)              │
│   (React)    │ ◀────────── │  - RSC pages  /app                 │
└──────────────┘             │  - Route handlers  /app/api        │
                             │  - Server actions                   │
                             └────────┬───────────────┬───────────┘
                                      │               │
                              ┌───────▼───┐   ┌───────▼─────────┐
                              │  Cache    │   │ Steam client    │
                              │  (Redis / │   │ /lib/steam      │
                              │  memory)  │   └───────┬─────────┘
                              └───────┬───┘           │
                                      │               │ HTTPS
                              ┌───────▼───┐   ┌───────▼─────────┐
                              │ Database  │   │ Steam Web API   │
                              │ (Prisma / │   │ api.steampowered│
                              │  SQLite)  │   │ .com            │
                              └───────────┘   └─────────────────┘
                                      ▲
                                      │ writes snapshots
                              ┌───────┴───┐
                              │ Cron      │
                              │ jobs      │
                              └───────────┘
```

## Tech stack

| Layer        | Choice                              | Why                                              |
| ------------ | ----------------------------------- | ------------------------------------------------ |
| Framework    | Next.js 14+ (App Router)            | RSC, route handlers, single deploy unit          |
| Language     | TypeScript (strict)                 | Confidence at boundaries                         |
| Styling      | Tailwind CSS + CSS variables        | Theming, design tokens                           |
| Components   | shadcn/ui (Radix primitives)        | Accessible, copy-in, easy to customize           |
| Charts       | Tremor (Recharts under the hood)    | Sensible defaults for dashboards                 |
| Data         | Prisma ORM + SQLite (dev) / Postgres (prod) | Type-safe queries, simple migrations     |
| Cache        | Redis (prod) / in-memory LRU (dev)  | Rate-limit-friendly                              |
| Validation   | Zod                                 | Parse-don't-validate at every boundary           |
| Jobs         | `node-cron` (self-host) / Vercel Cron | Periodic snapshots                              |
| Auth (v2)    | Steam OpenID via `next-auth`        | Steam-native identity                            |
| Testing      | Vitest + Playwright                 | Fast unit, real-browser e2e                      |

## Directory layout

```
4es-dash/
├── app/                      # Next.js App Router
│   ├── (dashboard)/          # Authenticated routes
│   │   ├── library/
│   │   ├── games/[appid]/
│   │   └── friends/
│   ├── api/                  # Route handlers
│   │   └── steam/
│   └── layout.tsx
├── components/               # Reusable presentational components
│   ├── ui/                   # shadcn primitives
│   └── charts/
├── lib/                      # Pure utilities, shared between client + server
│   ├── steam/                # Steam Web API client + types
│   ├── format/               # Number/duration/date formatters
│   └── zod/                  # Shared Zod schemas
├── server/                   # Server-only code (DB, jobs, secrets)
│   ├── db.ts                 # Prisma client
│   ├── cache.ts
│   └── jobs/
├── prisma/
│   └── schema.prisma
├── public/
├── docs/
├── .claude/                  # Skills + agent config
├── ROADMAP.md
└── README.md
```

## Data flow

1. A user navigates to `/library`.
2. The page is a React Server Component; it calls `getOwnedGames(steamId)`.
3. `getOwnedGames` first hits the cache. On miss, it calls `lib/steam/client.ts`, which fetches `IPlayerService/GetOwnedGames/v1` with the configured API key.
4. The response is Zod-parsed into `OwnedGame[]` and written back to the cache with a TTL.
5. The RSC renders the grid; the HTML streams to the browser.
6. Client components (filters, sort) re-render locally without re-fetching.

## Caching strategy

| Endpoint                  | TTL       | Rationale                              |
| ------------------------- | --------- | -------------------------------------- |
| `GetPlayerSummaries`      | 5 min     | Profile rarely changes                 |
| `GetOwnedGames`           | 1 hour    | Library updates are infrequent         |
| `GetRecentlyPlayedGames`  | 15 min    | The freshness people actually want     |
| `GetPlayerAchievements`   | 1 hour    | Bounded by per-game playtime           |
| `GetFriendList`           | 24 hours  | Almost static                          |
| Store metadata            | 7 days    | Effectively immutable                  |

Cache keys are namespaced `steam:<endpoint>:<steamId>[:<appid>]`. The nightly snapshot job invalidates the long-TTL entries it depends on so historical data is always fresh.

## Persistence

Prisma manages two kinds of data:

- **Reference data** — owned games, app metadata. Upserted on fetch.
- **Time-series snapshots** — playtime, achievement counts. Append-only, one row per (steamId, appid, day).

See `docs/DATA_MODEL.md` for the schema.

## Background jobs

| Job                  | Schedule        | Job                                              |
| -------------------- | --------------- | ------------------------------------------------ |
| `snapshot:playtime`  | Daily 04:00 UTC | Snapshot owned games + playtime                  |
| `snapshot:achievements` | Daily 04:15 UTC | Snapshot achievement counts                     |
| `refresh:store-meta` | Weekly Sunday   | Re-pull store metadata for owned games           |
| `cache:warm`         | Hourly          | Warm hot caches for the configured user          |

In dev these run via `node-cron`. On Vercel they run via `vercel.json` cron triggers hitting protected route handlers.

## Security model

- The Steam API key is **server-only**. It is never serialized to the client. Route handlers and RSCs are the only callers.
- Client components fetch from our own `/api/*` routes, never directly from Steam.
- Cron route handlers require a shared secret header (`x-cron-secret`).
- Multi-user (Phase 3+) uses Steam OpenID; we store only the 64-bit `steamid`.
- No PII beyond the Steam handle and avatar is persisted.

## Performance budget

- TTFB < 200 ms (cached) / < 1.5 s (cold)
- LCP < 2.5 s on mid-tier mobile
- JS bundle < 200 KB gzipped for the dashboard route
- Lighthouse Performance ≥ 90

## Error handling

- Steam API failures are surfaced as typed `SteamApiError`s with `kind: "rate_limit" | "auth" | "private" | "transient" | "unknown"`.
- Transient errors retry with exponential backoff (250 ms, 1 s, 4 s) capped at 3 attempts.
- A request that exhausts retries falls back to the last successful cache entry if one exists, marked stale in the UI.
- Errors that escape route handlers return RFC 7807-shaped JSON.

## Deployment topologies

- **Local dev**: `pnpm dev`, SQLite file, in-memory cache.
- **Self-hosted Docker**: single container + sidecar Redis + volume-mounted SQLite or external Postgres.
- **Vercel**: serverless functions, Vercel KV for cache, Vercel Postgres.

## Trade-offs taken

- **Server Components by default**: cuts client JS and keeps the API key off the wire. Cost: a learning curve for contributors used to pages-router data fetching.
- **Prisma over raw SQL**: faster to iterate. Cost: opaque queries; we'll drop to raw SQL when the snapshot table grows past a few million rows.
- **Tremor over a hand-rolled chart layer**: looks like a dashboard from day one. Cost: less control over micro-interactions.

## Future architectural decisions

Tracked as ADRs in `docs/adr/` once we accumulate enough of them. For now this document is the single source of truth.
