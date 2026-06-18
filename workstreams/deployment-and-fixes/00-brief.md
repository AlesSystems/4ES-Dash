# Brief — deployment & bug fixes (Phase 7)

> **Source of intent: human-authored GitHub issues.** The intent and acceptance
> criteria below are a faithful synthesis of the Phase 7 issues (#85–#92, plus the
> pre-existing #45 which #86 absorbs) under the milestone *"Phase 7 — Deployment &
> bug fixes"*. Those issues are the human-written brief; this file transcribes them
> into the workstream format so the orchestrator can plan against a single record.
> If intent here conflicts with an issue, the issue wins — and that's a brief edit,
> not an agent call.

## Intent

Phase 6 made the app multi-tenant; Phase 7 makes it **shippable and correct**. Two
strands:

1. **Deploy to Vercel** — a frictionless managed-hosting path on top of the Phase 5
   Docker self-host story: managed Postgres, working Vercel Cron, correct env, and a
   one-click Deploy button (#86, absorbing #45).
2. **Fix the user-reported bugs and perf issues** surfaced after Phase 6 dogfooding:
   a slow dashboard (#85), two compare-page failures (#88, #89), genres that stay
   empty until a manual re-sync (#90), a Year-in-Review achievements count stuck at
   0 (#91), missing sidebar links (#87), and a missing favicon (#92).

The bugs are not cosmetic checkups — each has a **root cause already traced to a
specific defect** (see per-task files). The fixes must address the cause, not the
symptom, and ship behind tests that would fail if the behavior regressed.

## Acceptance criteria

> Phase-level, behavioral, testable. Each task in `03-tasks/` carries the
> finer-grained criteria copied from its source issue.

1. **The dashboard renders without an O(N-games) live Steam fan-out.** A dashboard
   render issues at most a bounded number of Steam requests regardless of library
   size; library value and the achievement summary stream via their own `<Suspense>`
   boundaries; Store and Web API calls use separate rate limiters; the cache
   single-flights concurrent misses. (#85)
2. **The app deploys to Vercel and stays correct there.** Prisma runs on managed
   Postgres (provider switched; provisioned via `prisma db push` per the
   immutable-migrations rule); `vercel.json` schedules the snapshot cron; the cron
   route accepts Vercel's `Authorization: Bearer <CRON_SECRET>` (GET) **and** the
   legacy `x-cron-secret`; `NEXTAUTH_URL`-derived callback works; a one-click Deploy
   button + Vercel docs exist. (#86, #45)
3. **History and Friends are reachable from the sidebar** — both links present, in
   order, with correct active state and `lucide-react` icons. (#87)
4. **The compare page works for the signed-in user.** Side A resolves from the
   **session** user (not the placeholder `env.STEAM_ID`), so shared games compute and
   the "Try again shortly" error no longer appears for a valid comparison; a null
   profile never renders a raw 17-digit SteamID as a name. (#88, #89)
5. **Genres are not empty for an onboarded user.** A signed-in but not-yet-onboarded
   user is gated to onboarding (or a "syncing" state) instead of "No genre data yet";
   "No genre data yet" is reserved for a genuinely empty library. (#90)
6. **Year-in-Review counts real achievement unlocks.** "Achievements unlocked" for a
   year is computed from each achievement's `unlockedAt` (UTC year), correct on day
   one with no snapshot history, with correct year-boundary and seconds-vs-ms
   handling. (#91)
7. **The browser tab shows the brand favicon** — a file-based `app/icon` reproducing
   the amber-dot mark, auto-wired into `<head>`. (#92)
8. **Degrade, never crash or fabricate** holds throughout: private/failed Steam I/O
   renders the designed `{ available: false, reason }` state; transient errors use
   stale-while-revalidate; nothing fabricates a zero or throws to the user. (all)

## Non-goals

- Re-architecting the data model beyond the minimal additions the fixes require (a
  pre-computed library-value aggregate for #85; a per-achievement unlock-events shape
  for #91).
- Paid infrastructure. The free/zero-cost constraint still holds — managed Postgres
  and Redis use **free tiers** (Vercel Postgres / Neon / Supabase; Upstash), and
  enrichment stays opt-in/off by default.
- Consolidating the two nav components into one shared source (#87 only adds the
  missing links; the dedupe is a noted follow-up).
- Multi-user cron scale-out beyond what a correct deploy needs (#86 either iterates
  onboarded users or documents the single-`STEAM_ID` limitation — no spend-to-scale).
- New features. Phase 7 is ship + fix only.

## Constraints

- **Migrations are immutable once merged.** The SQLite history cannot replay on
  Postgres; prod provisions via `prisma db push`. Any new table (#85 aggregate, #91
  unlock-events) is one new, correct migration — never an edit to a merged one.
- **Rate limiter is global and load-bearing** (1 req / 250 ms, shared by Steam Web +
  Store clients). The perf and bug fixes must reduce fan-out, not bypass the limiter;
  heavy work belongs in the nightly job / behind Suspense, not on the request path.
- **`steamId` is a string** at every boundary; Steam I/O stays behind the single
  rate-limited client in `lib/steam/` and is Zod-parsed. (CLAUDE.md.)
- **Secrets server-only** (never `NEXT_PUBLIC_`); placeholders in `.env.ci` /
  `.env.test` so build + tests pass with no real secrets; MSW with
  `onUnhandledRequest: 'error'`.
- **`withErrorBoundary` on route handlers** — no extra try/catch unless it yields a
  *different* error. Cache keys stay `steam:<endpoint>:<steamId>[:<appid>]`.
- **Performance budget:** per-route < 200 KB JS gzipped, LCP < 2.5 s mid-tier mobile;
  RSC by default; Tailwind tokens only; `lucide-react` (stroke 1.75); `next/image`
  with `sizes`; Steam images from the allow-listed CDNs.
- **Must honor** TDD + the PostToolUse gate and the Definition of Done in
  `docs/CONTRIBUTING.md`. Every bug fixed gets an `ERR-XXXX` entry in `docs/ERROR.md`.
