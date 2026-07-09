# Plan — Theme 4: Client payload and DOM size

- **Theme:** 4 — Client payload and DOM size (FE-1..FE-5, COMP-7)
- **Branch:** `altan/optimization` · investigation HEAD `13023e3` · 2026-07-09
- **Phase:** planning (docs-only; no application code changes in this phase)
- Status: DRAFT — pending adversarial review

Sequencing note (binding, from `investigation/SUMMARY.md`): Theme 3 (RSC-1/2 shell
streaming) sequences **first** — until the shell stops gating first paint, LCP-level
before/after numbers for this theme are confounded. FE-1's primary metric here is
**transferred bytes** (network-level), which is measurable independently of shell
timing, so implementation need not block on Theme 3 — only LCP claims do.
Cross-theme note: Theme 2 (STEAM-1) also concerns the `/library` route but fences
`app/library/page.tsx` as untouched (it rewrites `server/repositories/multiplayer.ts`
internals only, keeping the `getMultiplayerAppIds` interface) — shared route, no
shared file, no sequencing conflict; recorded for the sequencing record.

---

## Root causes addressed

| ID | Reviewer verdict | Receipt justification | Named gated check |
|---|---|---|---|
| FE-1 | **CONFIRMED** | Whole filtered library serialized across the `'use client'` boundary (`app/library/page.tsx:148` → `LibraryResults.tsx:1`); client `slice(0, visible)` bounds DOM only. Receipt strengthened it: **three** dead fields per game (`iconUrl` ~115 chars, `lastPlayed`, `acquiredAt`) — `GameCard`/`GameRow` consume none of them — and the re-ship-on-nav mechanism is `export const dynamic = 'force-dynamic'` (page.tsx:33), **not** the remount `key` (which only resets client paging; `view`/`multiplayer` changes re-ship without remounting). | `payload-size` (settles absolute KB, not the mechanism — mechanism is settled from code) |
| COMP-7 | **CONFIRMED** (negligible) | Per-unlock `new Date()` in `aggregateLibrary`'s nested loop at drifted anchor `lib/achievements/aggregate.ts:161`, re-parse in the recent-unlocks sort comparator at `:171–172`. Receipt corrected blast radius: `aggregateLibrary` is **not** cache-wrapped and runs ~twice per dashboard render (two dashboard sections call `getAchievementProgress`) — per-nav, not cold-only. Cost still low-ms; right-sized here as a trivial cleanup task, not inflated. | none (cost settled as trivial) |
| FE-2 | **PLAUSIBLE** — gated | Uncapped achievement rows on `/game/[appId]` (`AchievementList.tsx:159–161`), ~8–11 DOM nodes/row, images lazy so network is viewport-bounded; unbounded cost is DOM/HTML. | `achievement-count-distribution` — task T3 is **conditional** on a fat tail |
| FE-3 | **PLAUSIBLE** — gated | Uncapped shared-games rows on `/compare` (`SharedGamesTable.tsx:58`), server-rendered HTML (no serialization tax), rare route. | `shared-intersection-distribution` — **no task unless the check confirms**; stays in the measurement plan |
| FE-4 | **PLAUSIBLE** — gated | Uncapped friends list (`FriendsList.tsx:24`); ceiling ~2000 (Steam cap), typical low hundreds; lowest priority. | `friend-count-distribution` — **no task unless the check confirms**; stays in the measurement plan |

### Folded / excluded

| ID | Disposition | Reason |
|---|---|---|
| FE-5 | **REFUTED — no task** | lucide-react named imports tree-shake correctly under Next 14.2's built-in `optimizePackageImports` default (`next.config.mjs` has no override) + per-icon ESM authoring. Receipt upheld the refutation (5 route icons, not 4 — immaterial). |
| FE-3 | Gated, dormant | Cheap cap only if `shared-intersection-distribution` shows thousands-sized intersections are real; rare route, server HTML, lazy images. Kept as a measurement-plan gated check, not a task. |
| FE-4 | Gated, dormant | Same treatment; hard Steam ceiling (~2000) and typical low-hundreds make it the lowest-priority DOM finding. Measurement-plan gated check only. |
| (durable cache backend) | Out of lane | Any Redis/durable-cache decision belongs to bug-3's fix lane per SUMMARY.md; this plan neither depends on nor decides it. |
| (limiter partitioning) | Out of lane | Theme 2/Phase 6 concern; this plan touches no limiter code. |

---

## Chosen fix

### FE-1 — server-side projection + URL-state pagination (kill the boundary tax at the mechanism)

The verified root cause has two parts: (a) the RSC→client Flight serialization ships the
**entire** filtered array including three dead fields, and (b) `force-dynamic` re-runs
the RSC — and therefore re-serializes the full array — on every navigation and every
filter/sort/view/multiplayer change. The fix removes both mechanisms rather than
trimming symptoms:

1. **Project at the boundary.** Introduce a client-safe projected type in
   `lib/games/sort.ts` (co-located with `LibraryGame`):

   ```ts
   /** Exactly the fields the library tiles render — nothing else crosses the boundary. */
   export type LibraryTileGame = Pick<OwnedGame, 'appId' | 'name' | 'headerUrl' | 'hasAchievements'> & {
     playtime: { total: number; twoWeeks: number };
   };
   export function toLibraryTile(g: LibraryGame): LibraryTileGame { ... }
   ```

   `iconUrl`, `lastPlayed`, `acquiredAt` never serialize. (They remain on the
   server-side `LibraryGame` — sorting by `recent`/`added` still uses them **before**
   projection, in the RSC.) Per-game serialized weight drops from ~300–380 B to
   ~150–180 B (headerUrl + name dominate what's left).

2. **Move the slice server-side; make "Load more" URL state.** The page already parses
   `sort`/`q`/`status`/`view`/`multiplayer` from `searchParams` — add `limit`
   (validated: positive int, multiple of `PAGE_SIZE = 24`, hard max e.g. 960, default 24).
   The RSC computes `shown.slice(0, limit).map(toLibraryTile)` and passes **only the
   visible page** across the boundary. `LibraryResults` loses `useState` and, with it,
   its reason to be a client component: it becomes an RSC that renders the tiles plus a
   "Load more" control. The control is a small `'use client'` leaf
   (`LoadMoreButton.tsx`) that does `router.replace` with `limit + PAGE_SIZE` and
   `{ scroll: false }` — URL state per the repo's filter/sort convention, no new client
   state store. The page-level `key` remount hack becomes unnecessary (paging state is
   the URL).

   **Filter changes must explicitly reset `limit` — this does not happen for free.**
   The only navigation surface on `/library` is `LibraryControls.updateUrl`
   (`LibraryControls.tsx:57–69`), which copies the current `searchParams` and
   set/deletes only the one changed key, so it would **preserve** a stale
   `limit=480` across any status/sort/q/view/multiplayer change. T2 therefore
   modifies `updateUrl`: when the changed key is one of the **set-changing keys**
   — `q`, `status`, `sort`, `multiplayer` — delete `limit` from the params before
   `router.replace`. **`view` is explicitly excluded**: a grid/list toggle does
   not change the visible result set (`filterGames`/`filterByStatus`/
   `filterToMultiplayer`/`sortGames` key off status/q/sort/multiplayer only —
   page.tsx:98–101; `view` only picks the tile markup), and at HEAD a view toggle
   preserves the loaded pagination count (the remount `key` is
   `${status}-${sort}-${q}`, page.tsx:147). Resetting on `view` would regress
   HEAD: grid→list after several "Load more" clicks would collapse back to 24.
   This restores — and extends — HEAD's reset semantics (HEAD reset on
   status/sort/q; the new mechanism also resets on `multiplayer`, which *does*
   change the visible set and was a reset gap at HEAD).

   Net effect on the receipt's two verified mechanisms:
   - Dead fields: eliminated (projection).
   - Re-ship on nav / filter change: what re-ships is now **bounded by `limit`**
     (default 24 tiles ≈ ~4 KB raw, ~1–2 KB gz) instead of the whole library
     (~350 KB raw / ~90–110 KB gz at 1000 games). `force-dynamic` itself stays —
     the page reads env + live Steam data per request by design (page.tsx:32–33
     comment); changing the render mode is not this theme's call (render-mode /
     caching strategy for pages is Theme 3 / bug-3 territory).

   Trade-off, stated honestly: "Load more" becomes a server round-trip (RSC
   re-render at the new `limit`) instead of a free client slice. The re-render
   re-ships `limit` tiles, so worst case (user pages to the very end) total bytes
   are O(limit²/PAGE_SIZE) across clicks — but the default visit, the filter
   change (with the explicit `updateUrl` reset above), and every navigation
   (the overwhelmingly common paths) drop from O(N) to O(24). Server cost of
   the round-trip: cheap **on a warm instance** (`getProfile` hits the
   in-process cache). Per SUMMARY.md's binding dependency note, `server/cache.ts`
   is a pure in-process Map that resets on every serverless cold start, so a
   "Load more" landing on a cold instance pays a full `getProfile` Steam fetch
   through the shared 250 ms limiter (RSC-1/2 territory). Not a first-paint
   cost; a durable cache stays in bug-3's lane.

3. **Counts stay correct — and "of Y" is the FILTERED count, not the library total.**
   `LibraryControls` already receives `total` and `shown` from the RSC
   (`shown.length` computed **before** slicing), so its copy and the
   `LibraryEmpty`/`EmptyState` branches are unchanged. `LibraryResults`' own
   "X of Y · N remaining" copy at HEAD derives Y from the length of the array it
   receives (`games.length` at LibraryResults.tsx:81), which **is the filtered
   set** (page var `shown`), *not* the page's all-games `games.length`
   (page.tsx:130) — these differ whenever a filter is active. Under this plan
   `LibraryResults` receives only `limit` tiles, so it can no longer derive Y:
   T2 must pass the **filtered count** (page `shown.length`, computed pre-slice)
   as an explicit `filteredTotal` prop, and `remaining = filteredTotal - tiles.length`.
   Wiring the page's `games.length` instead would mis-state the copy under any
   active filter — a dedicated filtered-fixture test (TDD row 3b) pins this.

### COMP-7 — parse once, compare cheaply (trivial cleanup, right-sized)

In `aggregateLibrary` (`lib/achievements/aggregate.ts:154–174`): compute
`unlockedMs` once per surviving item and carry it — push `{ item, ms }` pairs into
the recent list and sort by `b.ms - a.ms`, mapping back to items after the sort
(or equivalently compare ISO-8601 `unlockedAt` strings lexicographically, which
sorts correctly for same-format ISO timestamps — implementer's choice; the
pair-carry is the safer of the two since it makes no format assumption). Removes
the double parse and the per-item throwaway `Date` allocation in the sort. One
small task; no API/type change (`LibrarySummary.recentUnlocks` stays
`MergedAchievement[]`).

### FE-2 — conditional cheap cap (only if the gated check confirms)

If `achievement-count-distribution` shows a fat tail (games with ≥ ~500
achievements are real in the data): cap `AchievementList` at the first
`ACHIEVEMENT_PAGE = 100` rows with a "Show all N achievements" expander driven by a
URL param (`?achievements=all`) — the list is an RSC, so URL state keeps it an RSC
(no `'use client'` conversion, no serialization boundary created). The existing
sort (unlocked first, then rarity) means the cap shows the most meaningful rows.
Empty state (`available: false` branch) untouched. If the tail is thin, the check
is recorded and **no code ships** (FE-2 demoted, like FE-3/FE-4).

### Rejected alternatives

1. **Client-side fetch pagination (`/api/library?offset=`)** — keep `LibraryResults`
   as a client component and have "Load more" fetch the next page from a route
   handler. Rejected: violates the repo's "fetch where you render — no client-side
   fetch to our own routes unless the data must refresh in place" rule
   (docs/FRONTEND.md / CLAUDE.md), adds a new public API surface + Zod schemas +
   RFC 7807 handling for what URL-state RSC pagination gives for free, and splits
   the filter/sort source of truth between URL (filters) and fetch params (paging).
2. **Projection only, keep client slicing** — ship the whole filtered array but
   projected (~45% smaller). Rejected as the *whole* fix: it leaves the payload O(N)
   and unbounded in library size, so the CONFIRMED "grows linearly, re-ships per
   filter change" mechanism survives; at 1000 games still ~50–60 KB gz per nav.
   (The projection *is* retained as step 1 of the chosen fix.)
3. **Virtualization (react-window etc.)** — rejected: adds a client dependency and JS
   weight against the <200 KB budget, fixes DOM only (FE-1 is a payload problem;
   DOM was never the confirmed issue — the slice already bounds it), and fights RSC.
4. **Dropping `force-dynamic` / route segment caching** — would remove the re-ship
   trigger, but the page genuinely reads env + per-request live data, staleness
   semantics are a Theme 3 / bug-3 (durable cache) decision, and it would not fix
   the O(N) first-load payload anyway. Out of lane; explicitly not decided here.

---

## Invariants compliance

| Invariant | How respected |
|---|---|
| RSC by default; prefer server-side filtering/serialization | The fix **converts** `LibraryResults` from client to RSC and moves the slice server-side; the only remaining client code is a leaf `LoadMoreButton` (needs `router.replace`). Net `'use client'` surface shrinks. |
| URL state for filters/sort/pagination; no new stores | `limit` joins `sort`/`q`/`status`/`view`/`multiplayer` in `searchParams`; the `useState(visible)` store is deleted. FE-2's expander is `?achievements=all`. No Zustand/Redux/context. |
| Zod/validation at I/O boundaries | `limit` and `achievements` params are parsed with the same defensive pattern as `parseSortKey`/`parseStatusKey` (invalid → default, never throw); no Steam I/O shape changes, so no new `SteamApiError` surface. |
| Degrade, never crash or fabricate; designed empty states | `EmptyState`/`LibraryEmpty` branches and the `private`-profile catch in `app/library/page.tsx:59–71` are untouched; `AchievementList`'s `available: false` empty state untouched. Counts (`total`, `shown`) still computed pre-slice — no fabricated totals. |
| Skeletons match final geometry (no CLS) | Grid/list geometry, `PAGE_SIZE = 24`, and tile markup are unchanged; existing `/library` loading skeleton stays valid. "Load more" keeps identical footprint. `{ scroll: false }` on replace prevents scroll jump. |
| < 200 KB gz JS per route | JS shrinks (client component → RSC, `useState` removed); data payload drops from O(N) to O(limit). No new dependency. |
| Cache TTLs only in `server/cache/ttl.ts` | No cache calls added or changed; no TTLs introduced anywhere. |
| `withErrorBoundary` owns error mapping | No route handlers touched (rejected alternative 1 was rejected partly for this). |
| `steamId` is a string | Untouched; no boundary code changes involving steamId. |
| No migrations | None proposed. No schema change (SUMMARY.md: DATA-7 receipt confirms existing indexes suffice; this theme touches no DB shape at all). |
| Monotonic playtime / snapshot keys / cron secret / API key server-only / SWR | No contact — this theme changes no jobs, no Steam client code, no snapshot writes. `stale` banner plumbing in the library page is untouched. |

---

## Task breakdown

Ordered. Each is one implementer session, independently verifiable.

### T1 — FE-1a: `LibraryTileGame` projection at the RSC→client boundary

- **Scope in:** `lib/games/sort.ts` (add `LibraryTileGame` + `toLibraryTile`),
  `app/library/page.tsx` (map before passing), `components/library/LibraryResults.tsx`
  (prop type becomes `LibraryTileGame[]`), tests.
- **Scope out:** pagination mechanics (T2), `GameCard.tsx`/`GameRow.tsx` (their props
  already match the projection — no change), any other route.
- **Acceptance criteria:**
  1. `toLibraryTile` output contains exactly `appId, name, headerUrl, hasAchievements, playtime.total, playtime.twoWeeks` — a unit test asserts `Object.keys` equality (no `iconUrl`, `lastPlayed`, `acquiredAt`).
  2. `LibraryResults` props type no longer includes `LibraryGame`; `tsc` (`pnpm typecheck`) proves no consumer needs the dead fields.
  3. Sorting by `recent` and `added` still works (uses full `LibraryGame` pre-projection) — existing sort tests stay green.
  4. `pnpm test` green; `/library` renders identically (grid + list views) in dev.

### T2 — FE-1b: server-side slice + URL-state "Load more"; `LibraryResults` → RSC

- **Scope in:** `app/library/page.tsx` (parse `limit`, slice server-side, drop the
  remount `key`, pass `total`/`remaining` down), `components/library/LibraryResults.tsx`
  (remove `'use client'` + `useState`; render from props), new
  `components/library/LoadMoreButton.tsx` (`'use client'` leaf: `useRouter`,
  `useSearchParams`, `router.replace(..., { scroll: false })`), a `parseLimitParam`
  helper beside the other parsers in `lib/games/sort.ts`,
  `components/library/LibraryControls.tsx` (**one targeted change**: `updateUrl`
  deletes `limit` when the changed key is a set-changing key — `q`/`status`/
  `sort`/`multiplayer`, **not** `view` — so filter changes reset paging while a
  view toggle preserves it, matching HEAD), tests. `LibraryPageProps.searchParams`
  (page.tsx:38) gains `limit?: string`. `LoadMoreButton` derives the current
  limit via `parseLimitParam(searchParams.get('limit'))` (null → 24 → next click
  48) — never raw `searchParams.get('limit')` arithmetic, which is `null` on a
  fresh `/library` visit (the default 24 is applied server-side only and never
  written to the URL until the first click).
- **Scope out:** render mode (`force-dynamic` stays), everything else in
  `LibraryControls` (search debounce, controlled input, all other keys),
  headers, banners, empty states (already receive pre-slice counts — verify only).
- **Acceptance criteria:**
  1. `parseLimitParam`: unit tests — missing/garbage/negative/non-numeric → 24; clamps to max (960); rounds to a multiple of 24.
  2. The array passed to `LibraryResults` has length ≤ `limit` (component test with a 100-game fixture and `limit=24` renders exactly 24 tiles).
  3. `LibraryResults.tsx` contains no `'use client'` directive and no `useState`; the only client file added is `LoadMoreButton.tsx`.
  4. "Load more" sets `?limit=48` (preserving `sort`/`q`/`status`/`view`/`multiplayer` params) and does not scroll to top — including on a fresh visit with **no** `limit` param (first click goes 24 → 48 via `parseLimitParam`); with `?limit=480` in the URL, changing `q`/`status`/`sort`/`multiplayer` via `LibraryControls` produces a URL **without** `limit` (next render ships 24 tiles), while toggling `view` **preserves** `limit=480` (matches HEAD's view-toggle behavior).
  5. "X of Y · N remaining" copy matches pre-change behavior for the same fixture, where Y is the **filtered** count (page `shown.length` pre-slice, passed as a prop) — verified with an active-filter fixture where filtered ≠ total (100 total, 40 filtered, `limit=24` → "24 of 40 · 16 remaining"), so wiring the page's all-games `games.length` fails the test.
  6. Playwright (if the e2e suite covers `/library`): load `/library`, click "Load more", assert 48 tiles and URL contains `limit=48`. `pnpm test`, `pnpm typecheck`, `pnpm lint` green.

### T3 — COMP-7: single-parse recent-unlock aggregation (trivial)

- **Scope in:** `lib/achievements/aggregate.ts` (`aggregateLibrary` only, lines
  ~154–174), its unit tests.
- **Scope out:** `mergeGameAchievements` (its comparator parses no dates — receipt),
  `server/repositories/achievements.ts`, any caching of `getAchievementProgress`
  (a cache-wrap would need a TTL decision → Theme 1/bug-3 lane; explicitly not here).
- **Acceptance criteria:**
  1. `new Date(` appears at most once per unlocked item in `aggregateLibrary` (no parse inside the sort comparator) — verified by reading the diff, and behaviorally by tests.
  2. Existing `aggregateLibrary` tests green unchanged: same `recentUnlocks` ordering (newest first), same 7-day cutoff semantics, same handling of `unlockedAt === null` (skipped).
  3. New test: two unlocks 1 minute apart inside the window sort newest-first; an unlock exactly at the cutoff boundary behaves as before (`>= cutoff` inclusive).

### T4 — FE-2: capped achievement list with URL-state "Show all" — **CONDITIONAL**

- **Gate:** proceed only if `achievement-count-distribution` (measurement plan) shows
  a material tail (p95 per-game achievement count ≥ ~300, or any owned game ≥ 1000).
  Otherwise record the numbers in the measurement log and close FE-2 as demoted —
  no code.
- **Scope in:** `components/game/AchievementList.tsx` (slice to
  `ACHIEVEMENT_PAGE = 100` unless expanded), `app/game/[appId]/page.tsx` (thread the
  `achievements` search param — verify exact plumbing at implementation time),
  a `parseShowAllParam`-style helper, tests.
- **Scope out:** FE-3 (`SharedGamesTable`), FE-4 (`FriendsList`) — these stay
  measurement-only; `AchievementRow` markup; the aggregation pipeline.
- **Acceptance criteria:**
  1. With 250 fixture achievements and no param: exactly 100 rows + a "Show all 250 achievements" link preserving other params; with `?achievements=all`: 250 rows, no link.
  2. With ≤ 100 achievements: no expander rendered (no dead UI).
  3. Component remains an RSC (no `'use client'` added anywhere in the diff).
  4. Empty/`available:false` states and the unlocked-first ordering unchanged (existing tests green).

---

## TDD test plan

Write these failing tests first; each goes red at HEAD and green after its task.

All tests live in the repo's centralized `tests/unit/` suite (there are **no**
co-located test files in this repo). Existing files verified at HEAD:
`tests/unit/sort.test.ts`, `tests/unit/achievements-aggregate.test.ts`,
`tests/unit/AchievementList.test.tsx`, `tests/unit/LibraryControls.test.tsx`.

| # | File | Test name | Asserts (red → green) |
|---|---|---|---|
| 1 | `tests/unit/sort.test.ts` (extend existing) | `toLibraryTile strips non-tile fields` | Keys of the projected object are exactly `['appId','name','headerUrl','hasAchievements','playtime']` and `playtime` has exactly `total`/`twoWeeks`. Red: function doesn't exist. (T1) |
| 2 | `tests/unit/sort.test.ts` (extend existing) | `parseLimitParam defaults, clamps, and snaps to page size` | `undefined/'abc'/'-5'/'0'` → 24; `'25'` → 24 or 48 per chosen snap rule (document in test); `'99999'` → 960. Red: function doesn't exist. (T2) |
| 3 | `tests/unit/LibraryResults.test.tsx` (**new file**) | `renders only the games it is given (server slice)` | Given 24 projected tiles + `filteredTotal=100` (no active filter: filtered == total), renders 24 `<li>` and the copy `24 of 100 · 76 remaining`. Red at HEAD: component slices internally from a 100-item array and owns state. (T2) |
| 3b | `tests/unit/LibraryResults.test.tsx` (**new file**) | `"of Y" uses the filtered count, not the library total` | Active-filter fixture: library total 100, filtered 40, `limit=24` → 24 tiles + copy `24 of 40 · 16 remaining`. Catches the mis-wire of passing page `games.length` (100) instead of page `shown.length` (40) — row 3's no-filter fixture cannot distinguish them. Red at HEAD (prop doesn't exist). (T2) |
| 4 | `tests/unit/LibraryResults.test.tsx` (**new file**) | `LibraryResults is a server component` | Source-level assertion (read file, no `'use client'` prefix) or render-without-client-runtime harness per repo convention. Red at HEAD. (T2) |
| 5 | `tests/unit/LoadMoreButton.test.tsx` (**new file**) | `load more advances limit in the URL and preserves filters` | With mocked `useRouter`/`useSearchParams` (`?sort=name&limit=24`), click calls `replace` with `sort=name&limit=48` and `{ scroll: false }`. Red: component doesn't exist. (T2) |
| 5b | `tests/unit/LoadMoreButton.test.tsx` (**new file**) | `first click with no limit param goes to 48` | Mocked `useSearchParams` with **no** `limit` key (fresh `/library` visit — the common case): click calls `replace` with `limit=48`. Catches a naive `searchParams.get('limit')` (`null`) arithmetic bug; the component must derive current limit via `parseLimitParam`. Red: component doesn't exist. (T2) |
| 6 | `tests/unit/LibraryControls.test.tsx` (extend existing) | `set-changing filter change drops limit; view toggle keeps it` | With `?sort=name&limit=480` in mocked `useSearchParams`: changing `status`/`sort`/`q`/`multiplayer` calls `replace` with a URL containing the new key and **no** `limit` param; toggling `view` calls `replace` with `limit=480` **preserved**. Red at HEAD: `updateUrl` preserves `limit` on all keys. (T2) |
| 7 | `tests/unit/achievements-aggregate.test.ts` (extend existing) | `recentUnlocks sorts without re-parsing dates` | Behavioral: 3 in-window unlocks return newest-first; boundary-at-cutoff included. Plus a guard test using a spy/counting wrapper if the suite has one, else the ordering tests pin behavior while the diff removes the comparator parse. Green-at-HEAD behavior tests are pins; the projection is verified by diff review. (T3) |
| 8 | `tests/unit/AchievementList.test.tsx` (extend existing; conditional, T4) | `caps at 100 with a show-all expander` / `expands with achievements=all` / `no expander at ≤100` | As in T4 acceptance criteria. Red: no cap exists at HEAD (`items.map` uncapped at line 159). |

---

## Affected files

Verified present at HEAD `13023e3` (read this planning session):

**Modified**
- `app/library/page.tsx` — parse `limit`, project + slice before `LibraryResults`, drop remount `key`; `LibraryPageProps.searchParams` (page.tsx:38) gains `limit?: string` (T1, T2)
- `lib/games/sort.ts` — add `LibraryTileGame`, `toLibraryTile`, `parseLimitParam` (T1, T2)
- `components/library/LibraryResults.tsx` — `'use client'` removed, props become projected page + counts (T1, T2)
- `components/library/LibraryControls.tsx` — `updateUrl` deletes `limit` when a set-changing key (`q`/`status`/`sort`/`multiplayer`) changes; `view` toggles preserve it; nothing else in the component changes (T2)
- `lib/achievements/aggregate.ts` — `aggregateLibrary` single-parse (T3)
- `components/game/AchievementList.tsx` — conditional cap (T4, gated)
- `app/game/[appId]/page.tsx` — conditional: thread the `achievements` search param (the page's searchParams type gains `achievements?: string`) to `AchievementList` (T4, gated; exact component chain `GameAchievementsSection.tsx` → `AchievementList.tsx` to be traced at implementation)

**Added**
- `components/library/LoadMoreButton.tsx` — client leaf (T2)

**Read but deliberately untouched (regression fence)**
- `components/library/GameCard.tsx`, `GameRow.tsx` — props already equal the projection
- `components/library/LibraryHeader.tsx`, `LibraryEmpty.tsx`, `PlaytimeHiddenBanner.tsx` (`LibraryControls.tsx` moved to **Modified** — one targeted `updateUrl` change)
- `components/compare/SharedGamesTable.tsx`, `lib/compare/shared-games.ts` (FE-3 — measurement only)
- `components/friends/FriendsList.tsx`, `FriendCard.tsx` (FE-4 — measurement only)
- `lib/steam/schemas.ts`, `lib/steam/client.ts` (server shape unchanged; projection happens after fetch)
- `server/repositories/achievements.ts` (COMP-7 caller — no caching decision here)
- `next.config.mjs` (FE-5 refuted — no config change)

**Tests** — extended/added per the TDD table above.

---

## Measurement plan

Before/after recorded in `wayline/optimization/plan/measurements-theme-4.md`
(created at implementation time, not in this docs-only phase).

**Primary (FE-1): transferred bytes for `/library`.**
- *How:* DevTools → Network on an authenticated `/library` render: (a) document
  response size (Flight payload embedded), (b) the RSC payload on a client-side nav.
  Record raw + gzip. Repeat after a filter change (`?status=in-progress`), after
  one "Load more", and — to validate the disclosed O(limit²/PAGE_SIZE) worst case
  rather than merely assert it — page **to the end** of the library clicking
  "Load more" repeatedly and record the *cumulative* transferred bytes across all
  clicks, compared against HEAD's one-shot O(N) transfer. If the cumulative
  page-to-end number exceeds HEAD's by more than the theme is comfortable owning
  for power users, that is recorded as an accepted trade-off with the numbers,
  not hidden.
- *Before/after expectation:* payload term drops from O(N)×~350 B to 24×~170 B
  (~4 KB raw). At the receipt's 1000-game reference point that is ~90–110 KB gz → ~1–2 KB gz.
  The filter-change measurement depends on T2's `updateUrl` change (delete
  `limit` on set-changing keys `q`/`status`/`sort`/`multiplayer`; `view` excluded):
  without it, a filter change after "Load more" re-ships up to `limit` tiles,
  not 24 — verify the URL after the filter change contains no `limit` param
  before recording the number.
- *Gated check `payload-size` (from the receipt):* on a **real large account**, confirm
  the games array is the dominant transfer at HEAD and that `iconUrl`/`lastPlayed`/
  `acquiredAt` strings appear per game — this settles absolute magnitude and the
  real library size N (SUMMARY.md open question #6; all repo cost math assumes 65–67 games).
- *Confound (binding):* do **not** claim LCP wins until Theme 3's RSC-1/2 shell fix
  lands — the document doesn't flush until the shell's Steam calls resolve
  (SUMMARY.md dependency note). Shell timing is Theme 3's gated check; bytes are ours.

**Secondary (T2): route JS.** `next build` output for `/library` first-load JS,
before/after — expected flat-to-smaller (client component removed). Must stay
< 200 KB gz.

**COMP-7 (T3):** optional micro-check only — a `performance.now()` pair around
`aggregateLibrary` on a seeded library, before/after. Expected low-ms → lower;
recorded for honesty, no claim beyond "negligible stays negligible."

**Gated checks that gate task scope (from the receipt, run before T4 / any FE-3/FE-4 revival):**

| Check | Query / method | Decision rule |
|---|---|---|
| `achievement-count-distribution` (gates T4) | `SELECT appId, COUNT(*) FROM Achievement GROUP BY appId ORDER BY 2 DESC LIMIT 20;` on a populated DB (dev DB is CI fixtures only: 2 games / 6 unlocks) | Fat tail (p95 ≥ ~300 or any game ≥ 1000) → run T4. Thin → demote FE-2, no code. |
| `shared-intersection-distribution` (FE-3, no task) | Size `computeSharedGames` output for representative compared pairs (needs real `/compare` traffic or two seeded large libraries) | Median in the thousands → open a follow-up task (cheap cap, same pattern as T4). Low hundreds → close as demoted. |
| `friend-count-distribution` (FE-4, no task) | `SELECT steamId, COUNT(*) FROM Friend GROUP BY steamId ORDER BY 2 DESC LIMIT 10;` | >~500-friend accounts common → follow-up cap. Else close (Steam ~2000 ceiling). |
| Environment context (out-of-lane inputs, recorded not decided) | `ENABLE_STEAMSPY` prod value, platform tier / function timeout, prod row counts — SUMMARY.md open questions #1/#2/#4 | These belong to Themes 1/2/5 and bug-3's lane; this theme records them if available but takes no dependency beyond the Theme-3 sequencing note. |

---

## Risk & rollback

**Regression surface — the 5 shipped bug fixes** (receipts in `wayline/evidence/`):

| Bug fix | Contact with this plan | Risk & mitigation |
|---|---|---|
| bug-1 history-no-data | None — `/history`, `server/repositories/snapshots.ts` query paths untouched. `getFirstSeenDates` **call** in `app/library/page.tsx:57` is preserved verbatim (still feeds `sort=added` pre-projection). Test: existing sort=added tests green. | Low |
| bug-2 year-in-review-zero-hours | None — `/review` untouched. | None |
| bug-3 insights-slow | Adjacent: bug-3 owns render-mode/caching/Suspense decisions. This plan deliberately does **not** touch `force-dynamic`, adds no cache calls, changes no Suspense boundaries. T3 explicitly refuses to cache-wrap `getAchievementProgress`. | Low; fenced by scope-out lines |
| bug-4 obs-software-title | None — Steam client/name handling untouched; projection copies `name` as-is. | None |
| bug-5 insights-unknown-label | None — insights label paths untouched. | None |

**Functional risks per task + rollback** (each task is one commit; rollback = `git revert <commit>`, no migrations so reverts are always clean):

- **T1** — risk: a consumer of `LibraryResults`'s old prop shape breaks. Mitigation: `pnpm typecheck` catches all consumers (strict TS, named exports). Rollback: revert commit; page falls back to shipping `LibraryGame[]`.
- **T2** — highest-risk task. (a) "Load more" now costs a server round-trip — perceived latency where a client slice was instant; mitigated by cached `getProfile` and `{ scroll: false }`; if UX is unacceptable, rollback re-instates client paging *keeping T1's projection* (partial win preserved). (b) Filter-change paging reset semantics change from key-remount to the explicit `updateUrl` `limit`-delete on set-changing keys (`q`/`status`/`sort`/`multiplayer`); `view` is excluded, so a view toggle preserves the loaded count exactly as HEAD does (view was never in the remount key and never changes the visible set). Verify the `updateUrl` change breaks nothing else in `LibraryControls` (its existing suite `tests/unit/LibraryControls.test.tsx` plus the new row-6 test — which asserts both the delete on set-changing keys and the preserve on `view` — cover this). (c) Scroll restoration on browser back with `?limit=` in history. Rollback: revert T2 alone; T1 stands independently.
- **T3** — near-zero risk (pure function, pinned by tests). Rollback: revert.
- **T4** — gated; risk is hiding rows a user expects — mitigated by the "Show all N" expander and unlocked-first ordering (capped view shows earned + rarest first). Rollback: revert; list returns to uncapped.

**Rollout order:** T1 → T2 (T1 verified green first, so T2's revert never strands the projection) → T3 anytime → T4 only after its gate.

---

## Required docs/ updates

Per the repo Documentation Rule (changes shipped with the implementing task, not this phase):

- **docs/FRONTEND.md** — document the library pagination pattern: URL-state `limit`, server-side slice, projected tile type as the canonical "big list crosses an RSC→client boundary" recipe; note `LibraryResults` is now an RSC with a `LoadMoreButton` client leaf. (T2; T4 adds the capped-list/`?…=all` expander variant if it ships.)
- **docs/API.md** — no change (no public `/api/*` surface touched; rejected alternative 1 avoided exactly this).
- **docs/BACKEND.md / docs/DATA_MODEL.md** — no change (no server/repository/schema edits; T3 is a pure `lib/` function). If the reviewer disagrees on T3, the note belongs in BACKEND.md's aggregation section.
- **docs/ERROR.md** — no runtime error is being fixed (these are performance findings, not ERR-class failures); however, if any error is *encountered* during implementation it gets an ERR-XXXX entry per the standing rule. If the team treats FE-1 as an error-class regression risk, add an ERR entry documenting the "unbounded array across a `'use client'` boundary" rule — reviewer's call.
- **wayline/optimization/plan/measurements-theme-4.md** — created at implementation with the before/after numbers and gated-check results (FE-2/3/4 dispositions recorded there even when the answer is "demoted, no code").
- **CLAUDE.md** — no change proposed (the FRONTEND.md pattern suffices; avoid CLAUDE.md bloat).

---

## Review record

### Round 1 — adversarial review addressed

**Required change 1 (T2 filter-reset mechanism)** — accepted, resolved via the
reviewer's option (a): `LibraryControls.updateUrl` is now **in T2 scope** with one
targeted change (delete `limit` whenever a non-limit key changes), removed from the
regression fence, covered by a new red-first test (TDD row 6), and the chosen-fix
text, T2 AC4, and the measurement plan now name the explicit mechanism instead of
the false "naturally resets" claim. Option (a) was chosen over (b) because HEAD's
remount `key` already reset paging on status/sort/q; dropping the reset (option b)
would have been a silent behavior regression and would have gutted the
O(24)-per-filter-change benefit.

**Required change 2 (TDD test paths)** — accepted. All TDD-table paths retargeted
to the repo's centralized `tests/unit/` convention (verified at HEAD: no co-located
suites exist; `tests/unit/sort.test.ts`, `tests/unit/achievements-aggregate.test.ts`,
`tests/unit/AchievementList.test.tsx`, `tests/unit/LibraryControls.test.tsx` all
present). New files are `tests/unit/LibraryResults.test.tsx` and
`tests/unit/LoadMoreButton.test.tsx`. The misleading "extend the co-located suite
if present" hedge is deleted.

**Non-blocking objections — disposition**
- *Warm-cache assumption on "cheap round-trip"* — **folded in**: the chosen-fix
  trade-off paragraph now qualifies the round-trip as warm-instance-only and notes
  the in-process-Map cold-start cost; durable cache stays bug-3's lane.
- *`searchParams` type additions* — **folded in**: `LibraryPageProps.searchParams`
  gains `limit?: string` (T2) and the game page's searchParams gains
  `achievements?: string` (T4), now named in T2 scope-in and the Affected-files list.

### Round 1 (second pass) — required changes addressed

**Required change 1 (view-toggle limit reset built on a false premise)** — accepted,
resolved via the reviewer's option (a): the `updateUrl` `limit`-delete is narrowed
to the set-changing keys only (`q`/`status`/`sort`/`multiplayer`), explicitly
excluding `view`. Verified against source this session: `view` does not feed
`filterGames`/`filterByStatus`/`filterToMultiplayer`/`sortGames` (page.tsx:98–101),
and HEAD's remount `key` is `${status}-${sort}-${q}` (page.tsx:147), so a view
toggle preserves the loaded count at HEAD — the previous blanket delete would have
regressed that (grid→list after "Load more" collapsing to 24). Option (a) was
chosen over (b) because there is no payload upside worth the UX change: the view
toggle re-ships the same `limit` tiles either way under `force-dynamic`; resetting
buys nothing but a scroll-depth loss. The false "changes the visible set" claim is
deleted from chosen-fix step 2 and the T2(b) risk row; T2 AC4 and TDD row 6 now
assert both directions (delete on set-changing keys, preserve on `view`).

**Required change 2 (filtered-count wiring undetectable by the no-filter fixture)** —
accepted. Chosen-fix step 3 now states explicitly that `LibraryResults`' "of Y" is
the **filtered** count (page `shown.length` computed pre-slice, passed as a
`filteredTotal` prop; `remaining = filteredTotal - tiles.length`), verified against
LibraryResults.tsx:81 (HEAD derives Y from the received filtered array, not
all-games `games.length` at page.tsx:130). T2 AC5 and new TDD row 3b add an
active-filter fixture (100 total, 40 filtered, `limit=24` → "24 of 40 · 16
remaining") that fails if the page's `games.length` is mis-wired.

**Non-blocking objections — disposition (second pass)**
- *Page-to-end cumulative bytes* — **folded in**: the measurement plan now records
  cumulative transfer across repeated "Load more" clicks to the end of the library
  vs HEAD's one-shot O(N), so the O(limit²/PAGE_SIZE) trade-off is validated, not
  asserted.
- *LoadMoreButton first click with no `limit` param* — **folded in**: T2 scope-in
  now specifies deriving the current limit via `parseLimitParam` (null → 24 → 48),
  and new red-first TDD row 5b covers the no-param first click.
- *Zod-at-boundary* — reviewer concurrence recorded in unresolved objection #1
  below; stays flagged for explicit implementer/reviewer reconciliation, not
  ambiguous.
- *COMP-7 borderline make-work* — **recorded, no change**: T3 stands as an accepted
  trivial cleanup (reviewer concurs it is right-sized, not a challenge); the plan
  makes no performance claim beyond "negligible stays negligible".
- *Theme 2 shares the `/library` route* — **folded in**: one-line cross-theme note
  added to the sequencing section (shared route, no shared file, no conflict).

### Unresolved objections

1. **Zod-at-boundary vs hand-rolled parsers** (reviewer, non-blocking; reviewer
   **concurs** in round 1 second pass that it must be reconciled explicitly, not
   left ambiguous): `parseLimitParam`
   / `parseShowAllParam` follow the shipped non-Zod `parseSortKey`/`parseStatusKey`
   pattern (`lib/games/sort.ts:49–72`), which does not literally satisfy CLAUDE.md's
   "all inbound query I/O is Zod-parsed" invariant. Position: consistency with the
   established, shipped searchParams convention wins here; changing the parsing
   convention for all library params is out of this theme's scope. Disposition
   required of the T2 implementer/reviewer: either accept the precedent explicitly
   (one line in the T2 PR description) or Zod-parse the two new params (one-line
   schema each) — do not merge T2 without one of the two.
2. **T2 bundling several structural changes** (reviewer, non-blocking): T2 is kept as
   one task. Reasoning: the pieces are not independently verifiable — a server-side
   slice without the `LoadMoreButton` leaf ships a page with no way to see past 24
   games (user-visible regression at the intermediate commit), and the RSC conversion
   is only meaningful once `useState` paging is replaced by URL state. T1 already
   peeled off the independently-shippable projection. If the implementer session
   stalls, the pre-agreed internal order is: `parseLimitParam` + server slice +
   `LoadMoreButton` first, `updateUrl` reset + RSC conversion second — but both halves
   land in one reviewed unit.

### Revision history

- **Round 1:** (1) Adopted reviewer option (a) — `LibraryControls.updateUrl` into T2
  scope-in with an explicit delete-`limit`-on-filter-change; removed it from the
  regression fence; rewrote chosen-fix step 2, T2 AC4, and the measurement plan to
  name the mechanism and drop the false "naturally resets" claim; noted the reset now
  also covers `view`/`multiplayer` (extension of HEAD's key-based reset). (2) Retargeted
  the entire TDD table to `tests/unit/*` (extend `sort.test.ts`,
  `achievements-aggregate.test.ts`, `AchievementList.test.tsx`,
  `LibraryControls.test.tsx`; new `LibraryResults.test.tsx`, `LoadMoreButton.test.tsx`);
  added TDD row 6 for the `updateUrl` reset; deleted the co-located-suite hedge.
  (3) Qualified the "cheap round-trip" claim as warm-instance-only (in-process Map
  cache, cold-start caveat). (4) Named the `limit?: string` / `achievements?: string`
  searchParams type additions in scope and Affected files. (5) Recorded Zod-vs-precedent
  and T2-split objections as unresolved with reasoning.
- **Round 1 (second pass):** (1) Narrowed the `updateUrl` `limit`-delete to
  set-changing keys (`q`/`status`/`sort`/`multiplayer`), excluding `view` —
  deleted the false "view changes the visible set" justification from chosen-fix
  step 2 and the T2(b) risk row; T2 AC4 and TDD row 6 now assert delete-on-filter
  AND preserve-on-view (matches HEAD's view-toggle behavior). (2) Made the
  filtered-count wiring explicit: `LibraryResults` gets `filteredTotal` = page
  `shown.length` (pre-slice), never all-games `games.length`; T2 AC5 and new TDD
  row 3b add an active-filter fixture (24 of 40 · 16 remaining) that catches the
  mis-wire. (3) Measurement plan now captures page-to-end cumulative bytes to
  validate the multi-click trade-off. (4) Specified `LoadMoreButton` derives limit
  via `parseLimitParam` (null → 24 → 48); added red-first TDD row 5b for the
  no-`limit`-param first click. (5) Added Theme-2 shared-route cross-theme note.
  (6) Recorded reviewer concurrence on the Zod objection and COMP-7 as accepted
  trivial cleanup.
