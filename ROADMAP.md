# 4ES-Dash Roadmap

A personal stats dashboard for Steam. This roadmap is a guide, not a contract — milestones can shift as we learn.

## Vision

A fast, beautiful single-user dashboard that surfaces meaningful insights from a Steam library: playtime trends, achievement progress, friends activity, library value, and unplayed-game accountability. Self-hostable, open-source, no telemetry.

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
- [ ] Game detail page: playtime, achievements, store metadata
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
- [ ] Library value: sum of current store prices vs. paid (if known)

## Phase 3 — Social & comparison (Weeks 6–7)

Goal: surface what makes Steam social.

- [ ] Friends list + online status
- [ ] Compare two users: shared games, playtime delta
- [ ] Multiplayer-eligible games filter (own + friends)
- [ ] Activity feed across friends

## Phase 4 — Insights (Weeks 8–9)

Goal: derived analytics that feel like a personal Wrapped.

- [ ] "Year in Review" page (annual playtime, top games, achievements)
- [ ] Genre / tag breakdown using IStoreService metadata
- [ ] Cost-per-hour ranking
- [ ] Idle-detection heuristic (flag inflated playtime)

## Phase 5 — Polish & ship (Week 10)

- [ ] Loading skeletons everywhere
- [ ] Error boundaries with retry
- [ ] Lighthouse > 90 on all categories
- [ ] Docker image + docker-compose
- [ ] One-click Vercel deploy button
- [ ] Documentation pass: README, setup, screenshots

## Stretch goals (post-1.0)

- [ ] Multi-user support with OpenID login (Steam)
- [ ] Wishlist tracker with price-drop alerts
- [ ] Browser extension that injects stats on the Steam store
- [ ] Mobile PWA install
- [ ] Public profile sharing with privacy controls
- [ ] Export to JSON / CSV
- [ ] Plugin system for community-contributed widgets

## Out of scope

- Scraping (we use the official Steam Web API only)
- Game cracking / DRM bypass
- Anything that violates Steam's API Terms of Use

## Open questions

- Postgres vs. SQLite for the v1 default? (Leaning SQLite for self-host simplicity.)
- Charting library: Recharts, Visx, or Tremor? (Leaning Tremor for speed.)
- Auth for the multi-user phase: Steam OpenID directly, or NextAuth?
