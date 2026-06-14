# Acceptance Criteria

This document defines what "done" means for every phase and task in the 4ES-Dash roadmap. GitHub issues link to the phase anchors below (e.g. `docs/ACCEPTANCE.md#phase-0--foundations`). Every criterion is concrete and testable — "works" is never sufficient.

---

## Definition of Done (applies to every task)

These gates apply to every PR regardless of phase. A task is not done until all boxes are checked.

- [ ] Type-checks pass (`pnpm typecheck` exits 0)
- [ ] Lints pass (`pnpm lint` exits 0)
- [ ] Tests added or updated and passing (`pnpm test` exits 0)
- [ ] Storybook story added for every new component
- [ ] Docs updated in `docs/` if a public surface or behavior changed
- [ ] Manually exercised in the browser against a real Steam account
- [ ] No `console.log`, no commented-out code, no TODO without an owner (`// TODO(username): ...`)

---

## Phase 0 — Foundations

**Goal:** a runnable Next.js app talking to the Steam Web API for a single user.

- [ ] **Bootstrap Next.js 14+ (App Router, TypeScript, Tailwind)**
  - `pnpm dev` starts without errors and `http://localhost:3000` returns HTTP 200.
  - `pnpm typecheck` and `pnpm lint` both exit 0 on a clean checkout.
  - Tailwind is active: a Tailwind utility class applied to any element is reflected in the rendered output.
  - TypeScript `strict: true` is set in `tsconfig.json`.

- [ ] **Project structure: `app/`, `components/`, `lib/`, `server/`, `docs/`**
  - Each directory exists and contains at least one file (index, placeholder, or real module).
  - No source files exist outside the defined directories (i.e. no stray `.ts` files at the repo root).

- [ ] **ESLint + Prettier + Husky pre-commit**
  - Introducing a lint violation (e.g. unused variable) causes `pnpm lint` to exit non-zero.
  - Introducing a formatting violation causes `pnpm lint` to exit non-zero (Prettier via ESLint plugin).
  - Attempting to commit with a lint violation is blocked by Husky (the hook runs `pnpm lint` and the commit is rejected).

- [ ] **`.env.example` with `STEAM_API_KEY`, `STEAM_ID`**
  - `.env.example` exists at the repo root and contains both `STEAM_API_KEY=` and `STEAM_ID=` keys (with empty or placeholder values).
  - Neither key is prefixed with `NEXT_PUBLIC_`.
  - `server/env.ts` (Zod parse of `process.env`) throws a clear error at boot if either variable is missing — verified by temporarily unsetting one and running `pnpm dev`.

- [ ] **`lib/steam` client wrapper around `ISteamUser`, `IPlayerService`**
  - `lib/steam/client.ts` exports typed functions for at minimum `GetPlayerSummaries` and `GetOwnedGames`.
  - All responses are Zod-parsed at the boundary; a response with an unexpected shape throws `SteamApiError({ kind: "schema" })`, not a runtime type error.
  - The client enforces a token-bucket rate limit of 1 request per 250 ms — a test or integration check confirms no burst of more than 4 requests fires within 1 second.
  - Transient errors (5xx, network timeout) are retried up to 3 times with exponential backoff; a 4th failure throws `SteamApiError({ kind: "transient" })`.
  - The `STEAM_API_KEY` is never included in any client-side bundle — `grep -r "STEAM_API_KEY" .next/static` finds nothing after a production build.
  - **Private profile (T1 edge case):** `GetOwnedGames` returning `{}` (empty object, not `{ games: [] }`) is mapped to `SteamApiError({ kind: "private" })`, not a schema error or crash.
  - **Stale-while-revalidate (T1 edge case):** if all retries are exhausted, the cache layer returns the previous cached value with `stale: true`; no exception propagates to the caller.

- [ ] **`/api/profile` endpoint returning summary + owned games**
  - `GET /api/profile` returns HTTP 200 with a JSON body containing `profile` (player summary fields) and `games` (array of owned games with playtime).
  - All fields are Zod-validated on the way out; an unexpected Steam shape returns HTTP 400 with an RFC 7807 body (`type`, `title`, `status`, `detail`).
  - A request with a missing or invalid Steam API key returns HTTP 401 with an RFC 7807 body.
  - Response is wrapped by `withErrorBoundary`; no raw `Error` objects leak to the client.

- [ ] **Minimal homepage rendering profile + top 10 games by playtime**
  - The homepage (`/`) renders the authenticated user's Steam display name and avatar.
  - Exactly 10 games are shown, sorted descending by `playtimeForever`.
  - If the user owns fewer than 10 games, all games are shown (no crash, no empty slots).
  - **Private profile (degraded state):** if the Steam profile is private, the homepage renders a designed empty state ("Profile is private") rather than an error page or uncaught exception.
  - **Stale data indicator:** if the Steam API is unreachable and cached data is served, a visible "Data may be outdated" indicator appears on the page.

---

## Phase 1 — Core Dashboard

**Goal:** useful at-a-glance view of a library.

- [ ] **Library page: sortable/filterable owned-games grid**
  - Navigating to `/library` renders a grid of all owned games with cover art, name, and playtime.
  - `sort=playtime` orders the grid descending by `playtimeForever` (highest first); ties are broken by name ascending.
  - `sort=name` orders the grid ascending by game name, case-insensitive.
  - `sort=recent` orders the grid by `rtu_last_two_weeks` (recently played minutes) descending; games not played in the last two weeks appear after games that were.
  - Sort state is stored in the URL (`?sort=playtime`) so the page is bookmarkable and the back button works correctly.
  - A text filter input narrows the grid to games whose name contains the query (case-insensitive); the URL reflects the filter (`?q=...`).
  - The grid is responsive: single column on mobile (≤ 640 px), ≥ 3 columns on desktop.
  - **`sort=added` (T4 — acquisition date unavailable):** `sort=added` places games with a known `acquiredAt` (set from first snapshot) at the top in ascending date order, then appends games where `acquiredAt` is `null` sorted by name. A visible note in the UI explains that dates are inferred from snapshots and may be missing for games owned before tracking began.

- [ ] **Game detail page: playtime, achievements, store metadata**
  - Navigating to `/game/[appId]` renders the game name, total playtime in hours (rounded to one decimal place), and a list of achievements with unlock status and global unlock percentage.
  - Achievement schema names and descriptions come from `GetSchemaForGame/v2`; player unlock state comes from `GetPlayerAchievements/v1`.
  - **Store metadata (T2 — undocumented Store API):** genres, community tags, short description, and current store price are shown when the Store API responds with the expected shape.
  - **Store API unavailable or unexpected shape (T2 degraded):** if `store.steampowered.com/api/appdetails` is unreachable, returns a non-200 status, or returns an unexpected JSON shape, the game detail page renders without metadata (playtime and achievements still appear) and shows a subtle "Store metadata unavailable" notice. No crash, no unhandled exception.
  - **Private profile (T1 edge case):** if `GetPlayerAchievements` returns a private-profile error, the achievement section shows "Achievements hidden (private profile)" rather than an error.
  - **Game with no achievements:** the achievement section renders an appropriate empty state ("This game has no achievements") rather than an empty list or crash.

- [ ] **Achievement progress aggregate (total %, recent unlocks)**
  - A summary section (on the library or profile page) displays the total achievement completion percentage: `(total unlocked across all games) / (total available across all games) × 100`, formatted as a percentage.
  - A "Recent Unlocks" section lists achievements unlocked in the last 7 days, ordered by unlock timestamp descending.
  - If no achievements have been unlocked recently, a designed empty state is shown (not an empty container).
  - The percentage is recalculated on each page load (or per the cache TTL); it does not require a snapshot job.

- [ ] **Recently played widget (last 2 weeks)**
  - The widget displays up to 10 games played in the last 2 weeks, sourced from `GetRecentlyPlayedGames/v1`.
  - Each entry shows the game name, cover art, and playtime in the last 2 weeks (in hours, rounded to one decimal).
  - If no games have been played in the last 2 weeks, a designed empty state is shown.
  - **T1 fetch failure (stale-while-revalidate):** if the API call exhausts retries, the previously cached list is shown with a "Data may be outdated" indicator.

- [ ] **Header with profile avatar, level, total playtime**
  - The persistent site header displays the user's Steam avatar (via `next/image`, domain allow-listed in `next.config`), display name, Steam level, and total library playtime in hours.
  - Avatar `src` is served only from `avatars.steamstatic.com`; any other domain is rejected by the CSP and `next/image` config.
  - **T1 fetch failure:** if profile data is unavailable, the header renders a placeholder avatar and "—" for numeric fields rather than crashing.

- [ ] **Dark / light theme toggle**
  - A toggle control switches between dark and light themes; the selection persists across page navigation and browser refreshes (stored in `localStorage` or a cookie).
  - No Tailwind utility in any component file uses a hardcoded hex color; all colors reference CSS variable tokens defined in `app/globals.css`.
  - In dark mode, the page passes a WCAG AA contrast check (4.5:1 for body text, 3:1 for large text) — verified with a browser accessibility tool or automated test.

- [ ] **Responsive layout (mobile + desktop)**
  - Every page defined in Phases 0 and 1 passes Chrome DevTools responsive mode at 375 px (iPhone SE) and 1280 px (desktop) without horizontal overflow or hidden interactive elements.
  - The JS bundle for any single route is under 200 KB gzipped — verified with `next build && next analyze` (or `@next/bundle-analyzer`).

---

## Phase 2 — Persistence & History

**Goal:** trends over time, not just snapshots.

- [ ] **SQLite (dev) / Postgres (prod) via Prisma**
  - `pnpm prisma migrate dev` on a clean SQLite file succeeds without errors.
  - `pnpm prisma migrate deploy` against a Postgres connection string (provided via `DATABASE_URL`) succeeds without errors.
  - All migrations in `prisma/migrations/` are immutable — no existing migration file is modified after it has been committed to `main`.
  - `server/db.ts` exports a single Prisma client instance; no other file instantiates `new PrismaClient()`.

- [ ] **Nightly snapshot job (playtime + achievement state)**
  - `POST /api/cron/snapshot` with the correct `x-cron-secret` header triggers the job and returns HTTP 200.
  - `POST /api/cron/snapshot` without the header or with an incorrect header returns HTTP 401.
  - The job is idempotent: calling it twice for the same calendar day inserts no duplicate rows — verified by running the route twice and asserting `SELECT COUNT(*)` on the snapshot table returns the same value both times.
  - The job records a `(steamId, appId, date)` snapshot for every owned game; the `date` field is the UTC calendar day (not a timestamp).
  - `playtimeForever` in a new snapshot is never less than the previous snapshot value; if Steam returns a lower number (a Steam-side correction), the job clamps to the previous value and logs a warning.
  - The job processes all owned games within a single run; it does not require multiple invocations to complete.

- [ ] **Time-series chart: playtime per week / month**
  - The chart renders on `/history` (or equivalent) and shows playtime aggregated by ISO week or calendar month, selectable via a toggle.
  - Weeks with zero playtime (no snapshot delta) are rendered as zero-height bars, not gaps.
  - Tremor chart components are lazy-loaded (below the fold or via `next/dynamic`); they do not appear in the initial JS bundle for the page.
  - The chart requires at least 2 snapshot data points to render; with fewer, an informational message ("Not enough history yet — check back tomorrow") is shown instead of an empty chart.

- [ ] **Backlog score (unplayed games count, oldest unplayed)**
  - The backlog score widget shows: total unplayed games (games where `playtimeForever === 0`), and the name + acquisition date of the oldest unplayed game (by `acquiredAt` where known, otherwise by first-seen snapshot date).
  - **`acquiredAt` unavailable (T4):** if no acquisition date is known for any unplayed game, "Date unknown" is shown for the oldest unplayed game field; no crash.
  - The count updates when new games are added (i.e. after the next snapshot run).

- [ ] **Library value: sum of current store prices**
  - The library value widget shows the total current store price of all owned games (sum of `price_overview.final` from the Store API, converted to the correct currency unit).
  - Prices are cached for 1 hour per the Store API usage rules; the cache TTL is defined in `server/cache/ttl.ts`, not hardcoded in the widget.
  - **Price paid unavailable (T4):** the widget explicitly notes "Based on current store prices — purchase prices are not available via Steam" adjacent to the total. No "vs. paid" comparison field is shown.
  - **Store API unavailable (T2 degraded):** if the Store API is unreachable or returns an unexpected shape for a game, that game's price is treated as 0 and a note "Some prices unavailable" is shown. The widget does not crash or show NaN.
  - Free-to-play games (price = 0) are counted in the library but do not inflate the total.

---

## Phase 3 — Social & Comparison

**Goal:** surface what makes Steam social.

- [ ] **Friends list + online status**
  - `/friends` renders a list of all Steam friends for the authenticated user, sourced from `GetFriendList/v1` + `GetPlayerSummaries/v2`.
  - Each friend entry shows avatar, display name, and online status (Online / Away / Offline).
  - Currently-playing friends show the name of the game they are playing.
  - The list is sorted: online friends first, then offline, each group sorted by name ascending.
  - **Private friend list:** if `GetFriendList` returns a privacy error, the page renders "Friend list is private" rather than an error.
  - **T1 fetch failure:** if the API call exhausts retries, the stale cached list is shown with a "Data may be outdated" indicator.

- [ ] **Compare two users: shared games, playtime delta**
  - `/compare?a=<steamId>&b=<steamId>` renders a side-by-side comparison of two users.
  - The shared games section lists only games owned by both users, sorted by the absolute playtime delta descending.
  - For each shared game, the playtime delta is shown as `User A: X h vs User B: Y h (Δ Z h)`.
  - If the two Steam IDs are identical, the page shows an informational message rather than a degenerate comparison.
  - **Private profile (T1 edge case):** if either user's game list is private, that user's section shows "Library is private"; shared-games computation is skipped with a note.

- [ ] **Multiplayer-eligible games filter**
  - The library page (or a dedicated filter) supports a "multiplayer" toggle that narrows the grid to games where the Store API `categories` array includes ID 1 (Multi-player), ID 9 (Co-op), or ID 27 (Cross-Platform Multiplayer).
  - Category data is sourced from `lib/steam/store-client.ts` and cached for 7 days per the Store API usage rules.
  - **Store API unavailable (T2 degraded):** if category data is missing for a game, that game is excluded from the multiplayer filter and a note "Some games could not be categorized" appears. The filter does not crash.

- [ ] **Activity feed (descoped to current game + online status)**
  - The friends page shows each online friend's current game (from `personastate` + `gameextrainfo` in `GetPlayerSummaries`).
  - No historical activity stream (past games played, achievements unlocked) is shown anywhere in the UI.
  - **T4 explicit absence:** there is no placeholder, "coming soon" stub, or empty section implying a future historical activity feed. The friends page communicates only current status.

---

## Phase 4 — Insights

**Goal:** derived analytics that feel like a personal Wrapped.

- [ ] **Year in Review page**
  - `/review/[year]` renders an annual summary for the given year, derived from snapshot data stored in the database.
  - The page shows: total playtime for the year (hours), top 5 games by playtime delta within the year, total achievements unlocked within the year.
  - If no snapshot data exists for the requested year, a designed empty state is shown ("No data for [year] — make sure the nightly job has been running").
  - Navigation between years (previous / next) only links to years that have at least one snapshot.

- [ ] **Genre / tag breakdown**
  - `/insights/genres` renders a breakdown of library playtime by genre and community tag, expressed as both absolute hours and percentage of total library playtime.
  - Genre and tag data come from `store.steampowered.com/api/appdetails` via `lib/steam/store-client.ts`, cached for 7 days.
  - **Store API unavailable (T2 degraded):** games for which genre/tag data is unavailable are grouped under "Unknown" rather than omitted or causing a crash.
  - The chart (Tremor) is lazy-loaded; it is not included in the initial JS bundle for the page.

- [ ] **Cost-per-hour ranking (current prices only)**
  - `/insights/cost-per-hour` renders a ranked list of games by cost-per-hour, calculated as `currentStorePrice / playtimeForever` (in hours, minimum 0.1 h to avoid division-by-zero).
  - Games with zero playtime are excluded from the ranking (they would produce an infinite cost-per-hour).
  - **Price paid unavailable (T4):** the ranking uses current store price only. A persistent note reads "Prices reflect current store prices, not what you paid." No price-paid column or "vs. paid" metric is shown.
  - **Store API unavailable (T2 degraded):** games without a retrievable price are excluded from the ranking with a count shown ("X games excluded — price unavailable").
  - Free-to-play games (price = 0) are listed separately as "Free to play" and not included in the paid-games ranking.

- [ ] **Idle-detection heuristic**
  - `/insights/idle` flags games where the playtime delta between two consecutive snapshots exceeds a configurable threshold (default: 12 hours in a single 24-hour window), indicating potential idle farming.
  - The heuristic is derived entirely from local snapshot data; no external API call is made.
  - Flagged games are listed with the suspect date range and the anomalous delta.
  - The heuristic is documented as a heuristic, not a guarantee — the UI copy does not assert cheating, only "unusual playtime spike detected."
  - A user can dismiss a flag; the dismissal persists (stored in the database) and the game does not re-appear in the idle list unless a new spike occurs.

---

## Phase 5 — Polish & Ship

**Goal:** production-ready, self-hostable, documented.

- [ ] **Loading skeletons everywhere**
  - Every page and every async data section has a skeleton component that matches the final layout geometry (same height, width, and column structure as the loaded state).
  - No Cumulative Layout Shift (CLS) is produced by skeleton-to-content transitions — verified with Lighthouse or a CLS-specific test.
  - Skeletons are implemented with Suspense boundaries (`<Suspense fallback={<Skeleton />}>`), not `useEffect`-driven loading states.

- [ ] **Error boundaries with retry**
  - Every RSC page and every client component tree that fetches data is wrapped in an error boundary that displays a user-facing error message and a "Retry" button.
  - Clicking "Retry" re-attempts the failed operation (router refresh or re-fetch) without a full page reload.
  - Unhandled exceptions do not surface raw stack traces to the user in production builds (`NODE_ENV=production`).
  - Error boundaries are tested: a test simulates a thrown error inside a boundary and asserts the fallback UI renders.

- [ ] **Lighthouse > 90 on all categories**
  - Running `pnpm exec lighthouse http://localhost:3000 --output=json` (or equivalent CI step) against a production build (`pnpm build && pnpm start`) produces scores ≥ 90 for Performance, Accessibility, Best Practices, and SEO.
  - The Accessibility score must be ≥ 90 for at minimum the homepage, `/library`, and `/game/[appId]`.
  - Any score below 90 blocks the Phase 5 milestone; scores are recorded in the PR description.

- [ ] **Docker image + docker-compose**
  - `docker build -t 4es-dash .` completes without error from a clean checkout.
  - `docker-compose up` starts the app and database; `http://localhost:3000` returns HTTP 200 after the containers are healthy.
  - The `docker-compose.yml` includes a `healthcheck` for the Next.js service.
  - Environment variables are injected via `.env` file and not baked into the image — confirmed by inspecting the image with `docker inspect` and finding no `STEAM_API_KEY` in the environment layer.

- [ ] **One-click Vercel deploy button**
  - The README contains a "Deploy to Vercel" badge/button with a working URL that pre-fills the required environment variables (`STEAM_API_KEY`, `STEAM_ID`, `DATABASE_URL`, `CRON_SECRET`) in the Vercel onboarding flow.
  - Clicking the button and completing the form deploys a working instance of the app to a Vercel preview URL (manually verified by the maintainer before tagging the release).

- [ ] **Documentation pass (README, setup, screenshots)**
  - `README.md` contains: project description, prerequisites, local setup steps (`pnpm install`, `.env` config, `pnpm dev`), a screenshot of the homepage and library page, and a link to `docs/DEPLOYMENT.md`.
  - `docs/DEPLOYMENT.md` covers local, Docker, and Vercel deployment paths with all required environment variables documented.
  - All links within `docs/` resolve (no 404s) — verified with a link-checker script or CI step.
  - `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/BACKEND.md`, `docs/FRONTEND.md`, and `docs/DATA_MODEL.md` reflect the final implemented state (no stale references to planned-but-not-shipped features).
