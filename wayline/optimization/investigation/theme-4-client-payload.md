# Theme 4 — Client payload and DOM size — investigation

- **Branch:** altan/optimization
- **HEAD:** 13023e335764daed73900fabc0d88eab4d190eff
- **Date:** 2026-07-09
- **Phase:** investigation
- **Scope:** read-only root-cause of scout-flagged findings FE-1..FE-5, COMP-7

Note on the dev DB: `prisma/test.db` and `prisma/ci.db` exist but hold only tiny CI
fixtures (OwnedGame: 0, AchievementUnlock: 6, Game: 2). There is no realistic library
to measure against, so payload/DOM costs below are computed from the **actual serialized
object shapes** (Zod schemas in `lib/steam/schemas.ts`) with a stated N, not from live rows.

---

## FE-1 — Full filtered library serialized into the client-component payload

**Verdict: confirmed**

### Mechanism
`app/library/page.tsx` is an RSC. It computes `shown = sortGames(filterByStatus(filterGames(games,q),status), sort)`
(page.tsx:98–101) — despite the name, `shown` is the **entire filtered+sorted list**, not a page of it.
It passes `games={shown}` (page.tsx:148) to `<LibraryResults>`, which is `'use client'`
(LibraryResults.tsx:1). Crossing an RSC→client boundary means React serializes the whole
`games` array into the RSC Flight payload embedded in the streamed HTML and re-hydrated on the
client. Pagination lives entirely inside the client component (`useState(PAGE_SIZE)`, `games.slice(0, visible)`,
LibraryResults.tsx:28–29), so it only bounds **DOM nodes**, never the payload. Every LibraryGame
object is shipped in full even though `GameCard`/`GameRow` read only a subset of fields — the
serializer doesn't project. Any filter/sort change also re-serializes the full array (the `key`
on line 147 forces a remount).

### Cost
Per-game object = `LibraryGame` = `OwnedGame & { acquiredAt? }` (schemas.ts:66–81):
`appId`, `name`, `iconUrl` (~90-char Steam CDN URL), `headerUrl` (~80-char URL), `playtime{total,twoWeeks}`,
`lastPlayed` (ISO string), `hasAchievements`, `acquiredAt`. Serialized ≈ **300–380 bytes/game** raw JSON
(keys + two long URLs dominate). Assume ~350 B/game:
- **200 games** → ~70 KB raw ≈ ~18–22 KB gzipped
- **1000 games** → ~350 KB raw ≈ ~90–110 KB gzipped

The route budget is <200 KB **JS** gzipped; this is data payload on top of JS, and at 1000 games it
is the single largest transfer on the route while only 24 cards paint. `iconUrl` in particular is
dead weight — no library tile renders it (GameCard/GameRow use `headerUrl`).

### Blast radius
`/library` route, every visit (the primary page after dashboard). Grows linearly with library size;
worst for power users (multi-thousand-game accounts). Hit on every filter/sort/search change too,
since each re-renders the RSC and re-ships the array.

### Cross-refs
Ties to backend theme cost of building the list; no ERR-XXXX entry. Fix direction: server-side
slice to the visible page (or project to only the fields tiles use) and drop `iconUrl` from the
library payload; keep "load more" as a server round-trip or streamed segment.

### Evidence
| file:line | quote |
|---|---|
| app/library/page.tsx:98–101 | `const base = filterByStatus(filterGames(games, q), status);` … `const shown = sortGames(filtered, sort);` |
| app/library/page.tsx:148 | `games={shown}` |
| components/library/LibraryResults.tsx:1 | `'use client';` |
| components/library/LibraryResults.tsx:28–29 | `const [visible, setVisible] = useState(PAGE_SIZE);` / `const shown = games.slice(0, visible);` |
| lib/steam/schemas.ts:66–81 | `OwnedGameSchema = z.object({ appId, name, iconUrl, headerUrl, playtime{...}, lastPlayed, hasAchievements })` |

---

## FE-2 — All achievements rendered with per-item next/image

**Verdict: needs-measurement** (mechanism confirmed; per-game count unknown)

### Mechanism
`AchievementList` is an RSC (no `'use client'`, pure render). When achievements are available it maps
`items` with no cap: `{items.map((item) => <AchievementRow …/>)}` (AchievementList.tsx:159–161).
Each row emits a `next/image` with `unoptimized` (AchievementList.tsx:38–45). So DOM node count and
`<img>` count both scale 1:1 with the game's total achievement count. `unoptimized` means the src is
the raw Steam CDN URL (no Next image proxy/resize), but Next still emits `loading="lazy"` by default,
so **off-screen images are not fetched until scrolled into view** — the network cost is bounded by the
viewport, not by total count. The unbounded cost is DOM nodes (each row is ~8 elements) and initial
HTML size.

### Cost
No thrown-away math possible without a real schema — achievement counts vary wildly (0 to 5000+ for
some games). At a plausible 100 achievements: ~800 DOM nodes + 100 lazy `<img>` (only ~10–15 fetched
above the fold). At a pathological 1000+ (e.g. some grind titles), ~8000 nodes on one page — that is
where layout/hydration cost bites. Measurement to close it: query `AchievementSchema` count distribution
per game once a populated DB exists, or just cap the visible list.

### Blast radius
`/game/[appId]` detail page only, one game at a time. Not every-nav; bounded to whichever single game
the user opens. Cold-cache and warm-cache identical (render cost, not fetch).

### Cross-refs
Related to COMP-7 (same achievement data pipeline). Fix direction: paginate / "show all" toggle the
achievement list (render first ~50), same pattern FE-1 needs.

### Evidence
| file:line | quote |
|---|---|
| components/game/AchievementList.tsx:12 | `RSC: pure render, no 'use client'.` |
| components/game/AchievementList.tsx:159–161 | `{items.map((item) => (<AchievementRow key={item.apiName} item={item} />))}` |
| components/game/AchievementList.tsx:38–45 | `<Image src={item.iconUrl} … width={48} height={48} … unoptimized />` |

---

## FE-3 — Shared-games rows unpaginated / unvirtualized

**Verdict: needs-measurement** (mechanism confirmed; intersection size unknown)

### Mechanism
`SharedGamesTable` is an RSC that maps `rows` with no limit (SharedGamesTable.tsx:58). `rows` is the
inner-join intersection of two users' libraries (`lib/compare/shared-games.ts`), so its length is
bounded by `min(|libraryA|, |libraryB|)` and can be thousands for two large accounts. Each row emits a
grid row (~10 elements) plus a `next/image fill` (SharedGamesTable.tsx:67–74), which is lazy by default
— so, like FE-2, network is viewport-bounded but DOM nodes scale with the full intersection. Being an
RSC, the whole table is server-rendered HTML shipped in the document (no client-component serialization
overhead, unlike FE-1).

### Cost
At an intersection of 1000 shared games: ~10k DOM nodes + 1000 lazy `<img>`. HTML weight ~ a few hundred
KB before gzip. Measurement to close: distribution of shared-library sizes for real compared pairs.

### Blast radius
`/compare` route only, and only when two users are actually compared. Rare relative to `/library`.
One-shot per comparison; grows with both users' library sizes.

### Cross-refs
Sibling of FE-1/FE-2 (same "render the whole list" class). Fix direction: cap to top-N by |delta| with
a "show more", consistent with the pre-sorted order the repo already guarantees.

### Evidence
| file:line | quote |
|---|---|
| components/compare/SharedGamesTable.tsx:58 | `{rows.map((row) => (` |
| components/compare/SharedGamesTable.tsx:67–74 | `<Image src={row.iconUrl} alt="" fill sizes="40px" … />` |
| lib/compare/shared-games.ts:22 | `Inner-join two libraries on appId → the games BOTH users own.` |

---

## FE-4 — Friends list unvirtualized, avatar per card

**Verdict: needs-measurement** (mechanism confirmed; low real-world ceiling)

### Mechanism
`FriendsList` is an RSC mapping `friends` with no cap (FriendsList.tsx:24) into a 2-col grid of
`FriendCard`, each rendering a `next/image` avatar (FriendCard.tsx:1). DOM nodes scale with friend
count. Steam's hard friend cap is ~2000, so the ceiling is far lower than FE-3's; avatars are lazy so
network is viewport-bounded.

### Cost
At the 2000-friend ceiling: ~2000 cards (~20k nodes). Typical accounts have tens-to-low-hundreds of
friends, where this is a non-issue. Measurement to close: real friend-count distribution — but the
capped ceiling makes this the lowest-priority DOM finding.

### Blast radius
`/friends` route only, once per visit. Bounded by Steam's 2000-friend limit.

### Cross-refs
Same class as FE-2/FE-3. Fix direction: only worth virtualizing if profiling shows >~500-friend accounts
are common; otherwise leave.

### Evidence
| file:line | quote |
|---|---|
| components/friends/FriendsList.tsx:24 | `{friends.map((friend) => (` |
| components/friends/FriendCard.tsx:1 | `import Image from 'next/image';` |

---

## FE-5 — lucide-react named imports tree-shaking

**Verdict: refuted** (not a concern)

### Mechanism / why it's fine
`LibraryControls.tsx:5` uses named imports (`import { LayoutGrid, List, Search, Users } from 'lucide-react'`),
which the scout flagged as a potential barrel-file bloat risk. Two independent reasons make it a non-issue:
(1) `next@^14.2.15` (package.json) ships **`lucide-react` in its built-in `optimizePackageImports`
default list**, so Next rewrites the barrel import into per-icon deep imports at build time regardless of
config — `next.config.mjs` doesn't need (and doesn't have) an explicit entry. (2) `lucide-react` is authored
as per-icon ESM modules, so named imports tree-shake under any modern bundler even without the Next
optimization. Only the four referenced icons land in the bundle.

### Cost
Effectively zero incremental — 4 icons × ~1 KB each. No barrel pull-in.

### Blast radius
None.

### Cross-refs
None. No change recommended. (If a future config drops Next's default optimizePackageImports, re-check.)

### Evidence
| file:line | quote |
|---|---|
| components/library/LibraryControls.tsx:5 | `import { LayoutGrid, List, Search, Users } from 'lucide-react';` |
| package.json | `"next": "^14.2.15"` (lucide-react on Next's default optimizePackageImports list) |
| next.config.mjs:1–24 | no `modularizeImports`/`optimizePackageImports` override present |

---

## COMP-7 — `new Date(...)` per achievement in hot loop + sort re-parse

**Verdict: confirmed** (anchor drifted; low cost)

### Mechanism
The scout cited `aggregate.ts:157`. Current source: the per-item date parse is at
**aggregate.ts:161** inside `aggregateLibrary`'s nested loop (`for (const game …) for (const item …)
new Date(item.unlockedAt).getTime()`), and a **re-parse** of the same field is in the `recentUnlocks.sort`
comparator at **aggregate.ts:171** (`new Date(a.unlockedAt).getTime()`). Note the scout's claim of a
re-parse "in the sort comparator" of `mergeGameAchievements` is **wrong** — that comparator (lines
112–122) sorts by `unlocked`/`globalPercent` only and parses no dates. The real double-parse is in
`aggregateLibrary`. The loop constructs a `Date` object for every unlocked achievement across the whole
library to compare against the 7-day cutoff, discarding it immediately; the survivors (only last-7-days
unlocks, a small set) are then sorted by re-parsing their timestamps.

### Cost
Server-side, pure CPU, runs inside `server/repositories/achievements.ts:124`
(`aggregateLibrary(availableResults.map(r => r.data))`). For a library of 500 games × ~50 achievements
= ~25k `new Date()` allocations per aggregation. `new Date(iso)` is ~sub-microsecond; ~25k calls ≈ a few
ms — negligible and behind the cache. The sort re-parse is over only the recent-window subset (typically
< a few dozen), so trivial. Both are microseconds-to-low-ms, not a user-visible cost.

### Blast radius
Dashboard/library-summary path that computes recent unlocks, only on cold cache (result is cached).
Not per-nav. Scales with total achievements owned but stays in the low-ms range.

### Cross-refs
Feeds the same data as FE-2. No ERR-XXXX entry. Fix direction (optional): compare `unlockedAt` strings
lexicographically (ISO-8601 sorts correctly as strings) or parse once into a number alongside the filter,
avoiding the double parse — but the payoff is negligible; lowest priority in this theme.

### Evidence
| file:line | quote |
|---|---|
| lib/achievements/aggregate.ts:161 | `const unlockedMs = new Date(item.unlockedAt).getTime();` |
| lib/achievements/aggregate.ts:171 | `const aTime = a.unlockedAt != null ? new Date(a.unlockedAt).getTime() : 0;` |
| lib/achievements/aggregate.ts:112–122 | `items.sort((a, b) => { … return bGp - aGp; })` (no date parse — refutes scout's mergeGameAchievements claim) |
| server/repositories/achievements.ts:124 | `const summary = aggregateLibrary(availableResults.map((r) => r.data));` |

---

## Theme-level ranking

1. **FE-1 (confirmed, high)** — dominates. The only finding that inflates a *client-component
   serialization payload*, ships the whole filtered library (incl. an unused `iconUrl` URL per game)
   on every `/library` visit and every filter change, and grows unbounded with library size. ~90–110 KB
   gzipped of data at 1000 games while 24 cards paint. This is the one worth fixing first.
2. **FE-3 (needs-measurement, med)** — largest *DOM* blow-up potential (intersection can be thousands),
   but confined to the rarely-hit `/compare` route and it's server HTML (no serialization tax). Lazy
   images cap the network cost.
3. **FE-2 (needs-measurement, med)** — big single-page DOM for achievement-heavy games; `/game/[appId]`
   only, one game at a time, lazy images.
4. **FE-4 (needs-measurement, low)** — real ceiling capped by Steam's ~2000-friend limit; typical
   accounts are fine.
5. **COMP-7 (confirmed, low)** — real but microsecond-scale, server-side, cached. Anchor corrected to
   lines 161/171; scout's mergeGameAchievements re-parse claim refuted.
6. **FE-5 (refuted)** — Next 14.2 auto-optimizes lucide-react; no action.

### Open questions (need a populated DB / runtime to close)
- FE-1: confirm per-game serialized byte size empirically and whether `iconUrl`/`headerUrl` are both
  truly present in the payload for every game (schema says yes).
- FE-2/FE-3/FE-4: real distributions of achievement-count-per-game, shared-library intersection size,
  and friend counts — these move the needs-measurement verdicts to confirmed/refuted.
- Whether the RSC Flight payload for FE-1 is double-counted (embedded in HTML *and* re-fetched on client
  nav) — depends on how users reach `/library` (fresh load vs. client-side nav).
