# Architecture

4ES-Dash is a Next.js app that aggregates data from the Steam Web API, caches it locally, and renders a personal dashboard. This document describes the moving pieces and how they fit together.

## High-level diagram

```
┌──────────────┐    HTTPS    ┌────────────────────────────────────────────────┐
│   Browser    │ ──────────▶ │  Next.js (App Router)                          │
│   (React)    │ ◀────────── │  - RSC pages  /app                             │
└──────────────┘             │  - Route handlers  /app/api                    │
        │                    │  - Server actions                               │
   next-auth JWT             └────────┬──────────────────┬─────────────────────┘
   cookie (HttpOnly)                  │                  │
                             ┌────────▼────────┐  ┌──────▼──────────────────────┐
                             │  Auth layer     │  │ Steam clients  /lib/steam   │
                             │  server/auth.ts │  │  client.ts  ──▶ api.steam   │
                             │  server/authz.ts│  │  store-client.ts▶ store.s   │
                             └────────┬────────┘  └─────────────────────────────┘
                                      │
                              ┌───────▼───┐
                              │  Cache    │
                              │  (Redis / │
                              │  memory)  │
                              └───────┬───┘
                                      │
                              ┌───────▼───┐
                              │ Database  │
                              │ (Prisma / │
                              │  SQLite)  │
                              └───────────┘
                                      ▲
                                      │ writes snapshots
                              ┌───────┴───┐
                              │ Cron      │
                              │ jobs      │
                              └───────────┘
```

Two external data sources are used:

- **`api.steampowered.com`** — the official, key-authenticated Steam Web API. Used for player profiles, owned games, achievements, friends, and playtime. Covered by Steam's published API Terms of Use.
- **`store.steampowered.com/api`** — the undocumented but stable Store JSON API. Used for game metadata (genres, tags, description, price, categories). No API key required. Accessed only through `lib/steam/store-client.ts` with aggressive caching and graceful degradation. See [`docs/STEAM_DATA_SOURCES.md`](STEAM_DATA_SOURCES.md) for the full breakdown.

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
| Jobs         | `node-cron` (self-host)             | Periodic snapshots                              |
| Auth (Phase 6) | Steam OpenID via `next-auth` + `next-auth-steam` | Steam-native identity, JWT sessions (shipped)  |
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
│   ├── steam/                # Steam API clients + types
│   │   ├── client.ts         # Official Web API (api.steampowered.com)
│   │   └── store-client.ts   # Undocumented Store API (store.steampowered.com)
│   ├── format/               # Number/duration/date formatters
│   └── zod/                  # Shared Zod schemas
├── server/                   # Server-only code (DB, jobs, secrets, auth)
│   ├── auth.ts               # next-auth config, getSessionUser, getViewerSteamId
│   ├── authz.ts              # canViewProfile — per-user data isolation gate
│   ├── db.ts                 # Prisma client
│   ├── cache.ts
│   ├── repositories/
│   │   └── account.ts        # deleteAccountData, resyncAccount
│   └── jobs/
│       └── onboarding-backfill.ts # First-login data seed
├── prisma/
│   └── schema.prisma
├── public/
├── docs/
├── .claude/                  # Skills + agent config
├── ROADMAP.md
└── README.md
```

## Auth layer

Authentication and per-user data isolation were introduced in Phase 6.
See [ADR 0002](adr/0002-multi-tenant-steam-openid-auth.md) for the binding
architectural decisions.

**Session strategy:** Stateless JWT sessions via `next-auth` + `next-auth-steam`.
The encrypted JWT cookie stores `{ steamId, name, image }` — no DB session table,
no extra write per request. `NEXTAUTH_SECRET` signs the cookie; rotation invalidates
all sessions.

**Identity provider:** Steam OpenID 2.0. The `claimed_id` returned by Steam is
verified via a `check_authentication` re-POST (`verifySteamOpenId()` in
`server/auth.ts`) before any JWT is minted — without this step an attacker could
forge a `claimed_id` for any SteamID.

**Route protection:** `middleware.ts` uses `next-auth`'s `withAuth` helper to
redirect unauthenticated requests on private routes (`/library`, `/friends`,
`/settings`, etc.) to sign-in. Public routes (`/u/:steamId`, `/compare`) are
excluded from the matcher and handle authorization in-page.

**Per-user data isolation:**
- `getSessionUser()` reads the JWT and returns `{ steamId }` or `null`.
- `getViewerSteamId()` resolves the session user, then falls back to the optional
  `env.STEAM_ID` (dev/featured-profile fallback) — never to another user's data.
- `canViewProfile(viewerSteamId, { steamId, privacy })` in `server/authz.ts`
  enforces the `public` / `friendsOnly` / `private` privacy setting. It **fails
  closed**: a `friendsOnly` profile whose friends list is unavailable is treated
  as `private` — data is never exposed when friendship cannot be confirmed.

## Per-user data flow

```
HTTP request
  → next-auth middleware (JWT token check — redirect if absent on protected route)
  → RSC / route handler
  → getSessionUser() / getViewerSteamId()   [server/auth.ts]
  → canViewProfile()                         [server/authz.ts]   (cross-user reads)
  → repository(steamId)                      [server/repositories/]
  → cache(key = steam:<ep>:<steamId>, ttl)   [server/cache.ts]
  → lib/steam client (rate-limited, Zod-parsed)
  → api.steampowered.com / store.steampowered.com
```

Cache keys are namespaced `steam:<endpoint>:<steamId>[:<appid>]` — two concurrent
sessions for different users never share a cache entry.

## Data flow (example: /library)

1. A signed-in user navigates to `/library`.
2. `middleware.ts` confirms a valid JWT cookie; unauthenticated requests redirect to sign-in.
3. The RSC calls `getViewerSteamId()` → returns the session user's `steamId`.
4. The page calls `getOwnedGames(steamId)`.
5. `getOwnedGames` hits the per-steamId cache. On miss, it calls `lib/steam/client.ts`, which fetches `IPlayerService/GetOwnedGames/v1`.
6. The response is Zod-parsed into `OwnedGame[]` and written back to the cache with a TTL.
7. The RSC renders the grid; the HTML streams to the browser.
8. Client components (filters, sort) re-render locally without re-fetching.

## Caching strategy

| Endpoint                  | TTL       | Rationale                              |
| ------------------------- | --------- | -------------------------------------- |
| `GetPlayerSummaries`      | 5 min     | Profile rarely changes                 |
| `GetOwnedGames`           | 1 hour    | Library updates are infrequent         |
| `GetRecentlyPlayedGames`  | 15 min    | The freshness people actually want     |
| `GetPlayerAchievements`   | 1 hour    | Bounded by per-game playtime           |
| `GetFriendList`           | 24 hours  | Almost static                          |
| Store metadata (appdetails) | 7 days  | Genres/description rarely change       |
| Store price overview      | 1 hour    | Price changes are infrequent enough    |

Cache keys are namespaced `steam:<endpoint>:<steamId>[:<appid>]`. The nightly snapshot job invalidates the long-TTL entries it depends on so historical data is always fresh.

## Persistence

Prisma manages two kinds of data:

- **Reference data** — owned games, app metadata. Upserted on fetch.
- **Time-series snapshots** — playtime, achievement counts. Append-only, one row per (steamId, appid, day).

See `docs/DATA_MODEL.md` for the schema.

## Background jobs

| Job                       | Schedule           | Description                                         |
| ------------------------- | ------------------ | --------------------------------------------------- |
| `snapshot:playtime`       | Daily 04:00 UTC    | Snapshot owned games + playtime for the featured user¹ |
| `snapshot:achievements`   | Daily 04:15 UTC    | Snapshot achievement counts for the featured user¹  |
| `refresh:store-meta`      | Weekly Sunday      | Re-pull store metadata for owned games              |
| `cache:warm`              | Hourly             | Warm hot caches for the featured user¹              |
| `onboarding-backfill`     | On first sign-in   | Seed profile + owned games + baseline snapshot      |

> ¹ As shipped, `runSnapshot()` (and the warm/refresh jobs) still operate on the
> single featured/dev `STEAM_ID` only — `server/jobs/snapshot.ts` snapshots one
> user. Fanning the daily snapshot out across **all** signed-in users (sequential,
> respecting the shared token bucket) is future work tracked in ADR 0002 §7. The
> per-user `onboarding-backfill` already seeds each new user's baseline on sign-in.

These run via `node-cron` in dev. In production, an external scheduler (e.g. a system cron or a hosted cron service) hits the protected route handlers with the `CRON_SECRET` header. Docker support (including a bundled cron sidecar) is planned but not yet shipped — see issue #44.

## Security model

- The Steam API key is **server-only**. It is never serialized to the client. Route handlers and RSCs are the only callers.
- Client components fetch from our own `/api/*` routes, never directly from Steam.
- Cron route handlers require a shared secret header (`x-cron-secret`).
- Authentication uses Steam OpenID (Phase 6, shipped) via `next-auth` + JWT cookies; we store only the 64-bit `steamId` as a string. No email, no password hash, no session table.
- Per-user data isolation: `getSessionUser()` is the sole source of the "current user's" `steamId` on protected routes. `canViewProfile()` guards cross-user reads.
- See [`docs/SECURITY.md`](SECURITY.md) for the full multi-user threat model and controls, and [ADR 0002](adr/0002-multi-tenant-steam-openid-auth.md) for the session strategy rationale.

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

- **Local dev**: `pnpm dev`, SQLite file, in-memory LRU cache. This is the primary supported path.
- **Self-hosted (Postgres + Redis)**: point `DATABASE_URL` at a Postgres instance and optionally set `REDIS_URL`; see `docs/DEPLOYMENT.md`.
- **Docker**: planned (issue #44) — not yet available.

## Trade-offs taken

- **Server Components by default**: cuts client JS and keeps the API key off the wire. Cost: a learning curve for contributors used to pages-router data fetching.
- **Prisma over raw SQL**: faster to iterate. Cost: opaque queries; we'll drop to raw SQL when the snapshot table grows past a few million rows.
- **Tremor over a hand-rolled chart layer**: looks like a dashboard from day one. Cost: less control over micro-interactions.

## Architectural decision records

Significant architectural decisions are recorded as ADRs in `docs/adr/`:

- [ADR 0002 — Multi-tenant authentication with Steam OpenID](adr/0002-multi-tenant-steam-openid-auth.md):
  JWT session strategy, SteamID-as-account-key, data-isolation approach, rate-budget stance,
  and the fate of `env.STEAM_ID`.
