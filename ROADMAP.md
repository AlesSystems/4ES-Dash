# 4ES-Dash Roadmap

A personal stats dashboard for Steam. This roadmap is a guide, not a contract — milestones can shift as we learn.

## Vision

A fast, beautiful dashboard that surfaces meaningful insights from a Steam library: playtime trends, achievement progress, friends activity, library value, and unplayed-game accountability. Any Steam account holder can sign in and see their own dashboard. Self-hostable, open-source, no telemetry.

## Status legend

- [ ] Not started
- [~] In progress
- [x] Done

---

## Phase 0 — Foundations (Week 1)

Goal: a runnable Next.js app talking to the Steam Web API for a single user.

- [ ] Bootstrap Next.js 14+ (App Router, TypeScript, Tailwind)
- [ ] Project structure: `app/`, `components/`, `lib/`, `server/`, `docs/`
- [ ] ESLint + Prettier + Husky pre-commit
- [ ] `.env.example` with `STEAM_API_KEY`, `STEAM_ID`
- [ ] `lib/steam` client wrapper around `ISteamUser`, `IPlayerService`
- [ ] `/api/profile` endpoint returning summary + owned games
- [ ] Minimal homepage rendering profile + top 10 games by playtime

## Phase 1 — Core dashboard (Weeks 2–3)

Goal: useful at-a-glance view of a library.

- [ ] Library page: sortable/filterable owned-games grid
  - Sort by `playtime`, `name`, `recent` → official Steam API
  - Sort by `added` (acquisition date) → **not available via Steam API**; date is inferred from first snapshot and may be `null` for early entries (see [`docs/STEAM_DATA_SOURCES.md`](docs/STEAM_DATA_SOURCES.md))
- [ ] Game detail page: playtime, achievements, store metadata
  - Playtime + achievements → official Steam API
  - Store metadata (genres, tags, description, price) → **undocumented Store API** (`store.steampowered.com/api/appdetails`) via `lib/steam/store-client.ts`
- [ ] Achievement progress aggregate (total %, recent unlocks)
- [ ] Recently played widget (last 2 weeks)
- [ ] Header with profile avatar, level, total playtime
- [ ] Dark / light theme toggle
- [ ] Responsive layout (mobile + desktop)

## Phase 2 — Persistence & history (Weeks 4–5)

Goal: trends over time, not just snapshots.

- [ ] SQLite (or Postgres for prod) via Prisma
- [ ] Nightly job snapshotting playtime + achievement state
- [ ] Time-series chart: playtime per week / month
- [ ] "Backlog score" — unplayed games count, oldest unplayed
- [ ] Library value: sum of **current** store prices (from undocumented Store API)
  - ⚠️ "vs. paid" comparison is **out of scope** — Steam does not expose purchase history via any API

## Phase 3 — Social & comparison (Weeks 6–7)

Goal: surface what makes Steam social.

- [ ] Friends list + online status
- [ ] Compare two users: shared games, playtime delta
- [ ] Multiplayer-eligible games filter (own + friends)
  - Categories fetched from undocumented Store API (`appdetails` → `categories` array)
- [ ] Activity feed across friends
  - ⚠️ **No official or unofficial Steam API exists for a friends activity stream.** This feature is **descoped** to showing friends' current game + online status only (available via `GetPlayerSummaries`)

## Phase 4 — Insights (Weeks 8–9)

Goal: derived analytics that feel like a personal Wrapped.

- [ ] "Year in Review" page (annual playtime, top games, achievements)
- [ ] Genre / tag breakdown using undocumented Store API metadata
  - Note: there is no public `IStoreService` in the official Steam Web API; genres and tags come from `store.steampowered.com/api/appdetails`
- [ ] Cost-per-hour ranking (uses current store price; price-paid is unavailable)
- [ ] Idle-detection heuristic (flag inflated playtime)

## Phase 5 — Polish & ship (Week 10)

- [x] Loading skeletons everywhere
- [x] Error boundaries with retry
- [x] Lighthouse > 90 on all categories
- [ ] Docker image + docker-compose
- [x] Documentation pass: README, setup, screenshots (local + Docker paths)

## Phase 6 — Multi-user & Auth (shipped)

Goal: any Steam account holder can sign in with Steam OpenID, own their data, and control who sees their profile.

- [x] ADR: multi-tenancy + Steam OpenID auth strategy ([ADR 0002](docs/adr/0002-multi-tenant-steam-openid-auth.md))
- [x] next-auth + Steam OpenID provider (`NEXTAUTH_SECRET`, `NEXTAUTH_URL`; JWT sessions, no DB session table)
- [x] Prisma: `User` table extended with `lastLoginAt`, `privacy @default(private)`, `onboardedAt`
- [x] Session-scoped data layer: `env.STEAM_ID` demoted to optional dev/featured-profile fallback; repositories take explicit `steamId` param
- [x] Route protection + data isolation: middleware guards private routes; `canViewProfile()` fails closed for friends-only
- [x] First-login onboarding backfill: seeds profile + owned games + baseline snapshot on first sign-in; idempotent
- [x] Auth UI: "Sign in with Steam" entry point, signed-in user menu, logged-out landing
- [x] Privacy controls + account settings: `public` / `friends-only` / `private`; re-sync; atomic account & data deletion

## Phase 7 — Deployment & hosting

Goal: a frictionless managed-hosting path on top of the self-host (Docker) story shipped in Phase 5.

- [ ] One-click Vercel deploy button (pre-fills `STEAM_API_KEY`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `DATABASE_URL`, `CRON_SECRET`)
- [ ] `docs/DEPLOYMENT.md` Vercel section (env vars, cron, managed Postgres)

## Stretch goals (post-1.0)

- [ ] Wishlist tracker with price-drop alerts
  - Wishlist data: `store.steampowered.com/wishlist/profiles/<steamid>/wishlistdata/` (undocumented Store API, public wishlists only)
  - Price alerts: polled nightly via `store.steampowered.com/api/appdetails?filters=price_overview`
- [ ] Browser extension that injects stats on the Steam store
- [ ] Mobile PWA install
- [ ] Public profile sharing with privacy controls
- [ ] Export to JSON / CSV
- [ ] Plugin system for community-contributed widgets

## Out of scope

- Unauthorized HTML scraping of Steam community / store pages (we rely on Steam's official Web API and the documented-in-practice `store.steampowered.com` JSON endpoints only)
- Game cracking / DRM bypass
- Anything that violates Steam's API Terms of Use
- Purchase history / price-paid data (Steam does not expose this programmatically)
- Real-time friends activity feed (no Steam API provides this)

## Open questions

- Postgres vs. SQLite for the v1 default? (SQLite for self-host simplicity; Postgres for prod — see `docs/DEPLOYMENT.md`.)
- DB snapshot pruning strategy for operators running many users on a free-tier DB (ADR 0002 §7).

## Data sources

See [`docs/STEAM_DATA_SOURCES.md`](docs/STEAM_DATA_SOURCES.md) for a full feature-by-feature breakdown of which Steam API tier each planned feature relies on, known limitations, and the rules governing use of the undocumented Store API.
