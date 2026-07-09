# Optimization scout findings — "app is slow" (user-reported)

> **Phase 0: Scout.** Breadth-first flagging only — nothing here is root-caused or measured.
> Next phase is the investigation loop (verify, measure, rank), then plan/fix.
>
> Method: 5 parallel read-only scout agents (Opus 4.8, low effort, flag-don't-investigate),
> one per domain: RSC data flow (`RSC-*`), DB/cache (`DATA-*`), Steam I/O (`STEAM-*`),
> client bundle (`FE-*`), computation/jobs (`COMP-*`). Findings deduped and grouped below;
> orchestrator spot-checked the high-impact claims against source (see Verification notes).
> Branch `altan/optimization` · 2026-07-09.

## Theme 1 — Unbounded snapshot reads, uncached insights (extends known bug-3)

The append-only `PlaytimeSnapshot` table grows daily per game, and every insights/history
surface reads **all-time rows for the user with no date bound**, recomputes aggregates in JS
per request, and is wrapped in **no `cache(...)`** — on `force-dynamic` pages with no Suspense.
Gets worse every day the app runs.

| ID | Location | Problem | Impact | Conf. |
|---|---|---|---|---|
| DATA-2 / COMP-2 / RSC-4 | `server/repositories/insights/idle.ts:33` | `getIdleFlags` scans the whole snapshot table (no date bound), recomputes idle spikes in JS every request | high | high |
| DATA-3 / COMP-1 / RSC-7 | `server/repositories/insights/year-in-review.ts:37` | `getYearInReview` reads ALL playtime + achievement-unlock history to render one year (year filtered in JS) | high | high |
| DATA-6 / COMP-3 / RSC-5 | `server/repositories/snapshots.ts:73` | `getPlaytimeSnapshots` (history page) unbounded scan, full re-bucket per request | high | high |
| DATA-4 | `insights/{genres,cost-per-hour,idle,year-in-review}.ts` entrypoints | None of the four insights repositories wrap work in `cache(...)` — full recompute per visit | high | med |
| DATA-5 / COMP-4 | `server/repositories/insights/year-in-review.ts:19` | `getAvailableReviewYears` loads every snapshot date to derive a handful of distinct years in JS | med | high |
| DATA-7 | `prisma/schema.prisma:113` | Only index is `@@index([steamId, date])`; hot queries filter on `steamId` alone with no date bound, so nothing is bounded | med | med |
| COMP-8 | `lib/insights/year-in-review.ts:104` | Per-row `getUTCFullYear()` over full history to discard non-year rows (symptom of COMP-1) | low | med |

## Theme 2 — Per-game external fan-outs on request paths

Request-path code fans out one Steam/Store/SteamSpy call **per owned game**, serialized by
token-bucket limiters (250 ms–1 s floor per call). Cold cache on a large library = seconds to minutes.

| ID | Location | Problem | Impact | Conf. |
|---|---|---|---|---|
| STEAM-1 | `server/repositories/multiplayer.ts:47` (called `app/library/page.tsx:88`) | `/library` render fans out one Store `appdetails` call per owned game (`Promise.all`, but storeLimiter serializes: N × 250 ms cold) | high | high |
| STEAM-2 / DATA-8 | `server/repositories/achievements.ts:111` (dashboard sections) | Home page fans out `getGameAchievements` per appId — up to 3 Web API calls each through steamLimiter (single-flight cache dedupes the two callers, but cold cache is N × up-to-3 × 250 ms) | high | high |
| STEAM-3 / DATA-1 / RSC-3 | `server/repositories/insights/genres.ts:96` | `/insights/genres` loops all owned games with a per-game SteamSpy fetch at 1 req/s (`known:bug-3`) | high | high |
| STEAM-4 | `lib/steam/limiter.ts:85` | `steamLimiter` is one process-global bucket shared by all users/endpoints — one user's fan-out starves every other request. (Store API correctly has its own bucket; this applies to the Web API only.) | high | med |
| STEAM-5 | `lib/steam/retry.ts:6` | 3 retries at 250/1000/4000 ms backoff layered on top of fan-outs — transient failures add ~5 s each while holding the limiter | med | med |
| STEAM-9 | `server/repositories/store.ts:34` | Store metadata/price fetched one appId at a time (no multi-id endpoint exists) — feeds every fan-out above; argues for precompute/DB, not live | med | med |

## Theme 3 — Blocking shell and un-streamed pages

| ID | Location | Problem | Impact | Conf. |
|---|---|---|---|---|
| RSC-1 | `components/layout/Sidebar.tsx:18` via `app/layout.tsx:68` | Root layout awaits `getViewerSteamId` + `getProfile` (full owned-games fetch) in the Sidebar on EVERY navigation, no Suspense — shell blocks on it | high | high |
| RSC-2 | `components/layout/AppHeader.tsx:36` via `app/layout.tsx:66` | Second per-navigation profile + level fetch in the header, also un-streamed | high | high |
| RSC-6 | `app/insights/cost-per-hour/page.tsx:42` | Whole page blocks on repo work, `force-dynamic`, no Suspense (`known:bug-3`) | med | high |
| RSC-8 | `app/u/[steamId]/page.tsx:60` | 4 serial awaits (session → user lookup → authz → profile) before any data fetch | med | med |
| RSC-9 | `app/game/[appId]/page.tsx:54,105` | `getGameStoreMetadata` awaited in both `generateMetadata` and page body — duplicate store fetch on cold cache | low | med |

## Theme 4 — Client payload and DOM size (bundle itself is clean)

Tremor is properly lazy-loaded, RSC-by-default holds, all imagery is `next/image` with `sizes`,
no first-paint `useEffect` fetching. The risks are big lists:

| ID | Location | Problem | Impact | Conf. |
|---|---|---|---|---|
| FE-1 | `components/library/LibraryResults.tsx:33` | Full filtered `games[]` serialized into the client-component payload; DOM is sliced (show-more) but payload and re-renders scale with whole library | high | med |
| FE-2 | `components/game/AchievementList.tsx:159` | All achievements rendered with per-item `next/image` — hundreds of DOM nodes + image requests | med | med |
| FE-3 | `components/compare/SharedGamesTable.tsx:58` | Shared-games rows unpaginated/unvirtualized (can be thousands) | med | med |
| FE-4 | `components/friends/FriendsList.tsx:24` | Friends list unvirtualized, avatar per card | med | low |
| FE-5 | `components/library/LibraryControls.tsx:1` | Verify lucide-react named imports stay tree-shaken | low | low |
| COMP-7 | `lib/achievements/aggregate.ts:157` | `new Date(...)` per achievement in hot loop + re-parse in sort comparator | low | med |

## Theme 5 — Background jobs (off request path; wall-clock + limiter pressure)

| ID | Location | Problem | Impact | Conf. |
|---|---|---|---|---|
| STEAM-7 / COMP-6 | `server/jobs/snapshot.ts:280,350` | Achievement recording loops games strictly serially through the shared limiter; unbounded when no limit passed | med | high |
| STEAM-8 / COMP-5 | `server/jobs/onboarding-backfill.ts:123` | Backfill iterates games serially (Steam calls + 3 per-game upserts in one transaction — 3×N DB round-trips) (`known:bug-04`-adjacent) | med | med |
| STEAM-6 | `server/repositories/library-value.ts:80` | Nightly library-value pass: one Store price call per game (by design off request path, but shares job window) | med | high |

## Verification notes (orchestrator spot-check)

Confirmed against source: RSC-1/RSC-2 (layout renders async `AppHeader`/`Sidebar` with no
Suspense; both await `getProfile`), STEAM-1 (`Promise.all` over `getGameStoreMetadata` for all
games on `/library`; code comment acknowledges the limiter serializes it), STEAM-2 (per-appId
`Promise.all` in `getAchievementProgress`, called by both dashboard achievement sections),
DATA-2/DATA-3/DATA-5 (unbounded `findMany` with no date filter), FE-1 (full array as client prop,
DOM bounded by show-more).

Corrections applied to raw scout output:
- STEAM-4 originally claimed store fan-outs starve the Web API limiter — false; `storeLimiter`
  is a deliberate separate bucket (limiter.ts:87-95, #85). Claim narrowed to the Web API bucket.
- STEAM-1 is a `Promise.all`, not a serial loop — effective behavior (limiter serialization) unchanged.

## Suggested investigation order (by user-visible payoff)

1. **Theme 3 shell blocking (RSC-1/2)** — hits every page load for every user.
2. **Theme 2 request-path fan-outs (STEAM-1/2/3)** — worst absolute latencies, cold-cache cliffs.
3. **Theme 1 unbounded snapshot reads** — degrades over time; overlaps confirmed bug-3.
4. Themes 4–5 after the above are measured.
