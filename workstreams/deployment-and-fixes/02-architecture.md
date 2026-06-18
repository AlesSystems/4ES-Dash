# Architecture — deployment & bug fixes (Phase 7)

> Orchestrator-authored. Defines the contracts, the shared touch-points, and the
> locked decisions so each implementer makes zero architecture calls. The bug fixes
> are root-caused below to a specific defect; the implementer's job is to fix the
> cause behind a failing test, not to re-diagnose.

## Shared touch-points (merge points — serialize edits)

| File | Touched by | Rule |
|---|---|---|
| `server/jobs/snapshot.ts` | #91 (achievement unlock events), #85 (library-value pre-compute), #86 (cron auth + multi-user) | Serialize #91 → #85 → #86. Reviewer diffs the cumulative file against all three. |
| `server/cache.ts` | #85 (single-flight), #86 (Redis/Upstash branch) | #85 first; #86 layers the store swap on the same interface. |
| `app/compare/page.tsx` | #88, #89 | One PR. |
| `prisma/schema.prisma` + a new migration | #85 (aggregate), #91 (unlock-events) | One new migration **per task**; never edit a merged migration. |

## The bugs, root-caused (the fix targets the cause)

- **#85 dashboard slow** — `server/repositories/library-value.ts` prices every owned
  game live via `Promise.all(games.map(getGameStorePrice))`, all serialized behind
  the shared 250 ms limiter (cold = `N × 250 ms`); the achievement summary is awaited
  in `app/page.tsx`'s blocking `Promise.all` (not in Suspense); Store + Web API share
  one limiter; `cache.ts` has no single-flight. **Fix:** pre-compute value in the
  nightly job → read the aggregate; Suspense-isolate value + achievements; dedicated
  Store limiter; cache single-flight. DB is **not** the bottleneck (indexes exist);
  bundle is **not** the issue (all RSC).
- **#88 / #89 compare** — `app/compare/page.tsx` defaults side A to
  `getEnv().STEAM_ID`, which is the placeholder `76561190000000000` (a non-existent
  account). Every fetch for it fails → `games = null` → the "Try again shortly"
  branch (#88); `profile = null` → the UI renders the raw `steamId` as a name (#89).
  The `/compare` page was **missed in the Phase 6 #81 session migration**. **Fix:**
  `getViewerSteamId()` for side A; harden the null-profile display fallback.
- **#90 genres empty until re-sync** — `ownedGame` rows are only written by
  `runOnboardingBackfill` (via `/onboarding` or settings re-sync). The auth `signIn`
  event upserts a bare `User` and does **not** backfill, and nothing gates a
  signed-in-but-not-onboarded user to `/onboarding`, so `/insights/genres` renders
  "No genre data yet" until a manual re-sync. **Fix:** gate protected "my" views on
  `User.onboardedAt` (redirect to `/onboarding` or a "syncing" state).
- **#91 YiR achievements 0** — the count is a delta of cumulative `unlockedCount`
  snapshots (`max − min` within the UTC year); with ≤1 snapshot in the year (the
  common case; onboarding seeds no `AchievementSnapshot` baseline) the delta is 0.
  The real per-achievement `unlockedAt` is parsed but discarded by the job. **Fix:**
  count by `unlockedAt` (UTC year), persisted as unlock events in the nightly job.

## Contracts (write these first; consumers build against them)

**#85 — pre-computed library value** (move the O(N) fan-out into the job)

```ts
// Written by server/jobs/snapshot.ts (nightly), read by the dashboard.
// Either a new snapshot table or an aggregate column on User/a reference row.
type LibraryValueAggregate = {
  steamId: string;
  totalCents: number;       // sum of current store prices, already aggregated
  pricedGames: number;      // how many games contributed (for "+ M more")
  computedAt: Date;
};
// Dashboard reads this row — it does NOT price games on render.
// Render-path Steam fan-out is bounded and independent of library size.
```

**#85 — dedicated Store limiter + cache single-flight**

```ts
// lib/steam/limiter.ts — mirror the existing steamSpyLimiter pattern.
export const storeLimiter: TokenBucket;   // store-client.ts uses THIS, not steamLimiter

// server/cache.ts — collapse concurrent misses onto one loader call.
// cache(key, ttl, loader): N concurrent misses → loader runs once; preserve SWR.
```

**#86 — cron route auth (accept Vercel's Bearer, keep legacy header)**

```ts
// app/api/cron/snapshot/route.ts
// Authorized if EITHER matches CRON_SECRET (constant-time):
//   • Authorization: Bearer <CRON_SECRET>   (Vercel Cron default, GET)
//   • x-cron-secret: <CRON_SECRET>          (manual / back-compat, POST)
export async function GET(req: Request): Promise<Response>;   // NEW — Vercel sends GET
export async function POST(req: Request): Promise<Response>;  // keep
// vercel.json: { "crons": [{ "path": "/api/cron/snapshot", "schedule": "0 3 * * *" }] }
```

**#88 — compare side A from the session**

```ts
// app/compare/page.tsx
import { getViewerSteamId } from '@/server/auth';
const viewerId = await getViewerSteamId();          // session user (dev fallback only)
const aId = (searchParams.a ?? viewerId).trim();    // NEVER getEnv().STEAM_ID directly
// Anonymous + no ?a= → render the input EmptyState, do not fetch a placeholder account.
```

**#90 — onboarding gate** (one guard, reused by protected "my" views)

```ts
// Where a "my" view resolves the viewer: if session exists but onboardedAt == null,
// redirect('/onboarding') (or render the designed "Syncing your library…" state).
// "No genre data yet" is reserved for onboarded users with a genuinely empty library.
```

**#91 — per-achievement unlock events** (count by real time, not snapshot delta)

```prisma
// New table (one new migration). Written by the nightly job from getGameAchievements.
model AchievementUnlock {
  steamId    String
  appId      Int
  apiName    String          // achievement id within the game
  unlockedAt DateTime        // from Steam unlocktime (unix SECONDS × 1000)
  @@id([steamId, appId, apiName])
  @@index([steamId, unlockedAt])
}
// Year count = COUNT(unlockedAt in [Jan 1 Y .. Jan 1 Y+1) UTC). unlocktime 0 → excluded.
```

## Decisions (locked — not for the implementer to revisit)

- **Fix the cause, not the symptom.** Each bug's root cause is named above; a fix
  that only suppresses the message (e.g. lowering the achievement bound for #85, or
  hiding the empty state for #90 without gating onboarding) is rejected.
- **Heavy work stays off the request path.** Per-game Store/achievement fan-out lives
  in the nightly job or behind Suspense — never synchronous on an interactive render.
  This is the shared constraint behind #85, #90, #91.
- **`prisma db push` for prod; provider → `postgresql`.** The SQLite migration history
  cannot replay on Postgres and **migrations are immutable once merged** — so prod
  provisions schema-first via `db push`. New tables (#85, #91) are one new migration
  each for the dev/SQLite history.
- **Cron accepts both auth shapes**, compared with `crypto.timingSafeEqual`; the route
  exports GET (Vercel) **and** POST (manual). `CRON_SECRET` set on Vercel is
  auto-injected as the Bearer token.
- **`env.STEAM_ID` is a dev/featured fallback only** (Phase 6 decision). #88 removes
  the last repository-adjacent direct read in `app/compare/page.tsx`.
- **Free/zero-cost holds.** Managed Postgres and Redis use free tiers (Vercel Postgres
  / Neon / Supabase; Upstash). No paid enrichment; SteamSpy/ITAD stay opt-in/off.
- **`steamId` is a string**; Steam I/O stays behind the rate-limited `lib/steam/`
  client, Zod-parsed; cache keys stay `steam:<endpoint>:<steamId>[:<appid>]`.
- **Favicon is file-based** (`app/icon.svg` or `app/icon.tsx`), one fixed palette
  (brand amber `#e8a05c`); don't hand-set `metadata.icons` when using the file
  convention.
- **Degrade, never throw to the user.** Route handlers stay wrapped by
  `withErrorBoundary`; private/failed Steam I/O → `{ available: false, reason }`.

## Boundary / safety notes the reviewer will check

- **#85:** assert a render's Steam request count is bounded and independent of N (MSW
  counter); value + achievements are in their own `<Suspense>`; Store and Web API use
  **separate** limiters; cache loader runs once under concurrent misses.
- **#86:** cron route 200 for Bearer **and** `x-cron-secret`, 401 for neither, method
  matches Vercel; `schema.prisma` provider is `postgresql` and `db push` creates all
  tables on a throwaway Postgres with no SQLite-only DDL; callback URL derives from
  `NEXTAUTH_URL` (no localhost when set); secrets server-only.
- **#88/#89:** `app/compare/page.tsx` no longer reads `getEnv().STEAM_ID` (grep);
  rendered names never match `/^\d{17}$/`; the literal `76561190000000000` never
  appears in output; anonymous `/compare` never fetches the placeholder.
- **#90:** not-yet-onboarded session user → redirect/syncing, never the bare empty
  state; "No genre data yet" only for an onboarded empty library; gate is idempotent.
- **#91:** non-zero count from real `unlockedAt` with no snapshot history; UTC
  year-boundary both directions; seconds→ms conversion guarded; `unlocktime 0`
  excluded; unlocks outside the top-N still count; degrades on the private path.
- **#92:** `<head>` includes `<link rel="icon">`; `pnpm build` succeeds; SVG has a
  fixed `viewBox` and no CSS-var color.
- Every fixed bug appends an `ERR-XXXX` entry to `docs/ERROR.md`; the Documentation
  Rule applies (update `docs/DEPLOYMENT.md`, `docs/BACKEND.md`, `README.md` as the
  relevant changes land).
