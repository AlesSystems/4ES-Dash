# Evidence — Theme 4 (Client payload & DOM size): full-library RSC→client serialization confirmed; three DOM-size findings gated on runtime data; lucide tree-shaking refutation upheld; per-achievement Date churn real but trivial

> Read-only **adversarial** verification · branch `altan/optimization` · HEAD `13023e335764daed73900fabc0d88eab4d190eff` · 2026-07-09
>
> **Reviewer:** independent second context. Every cited file opened this run.
>
> **Verdict summary:** FE-1 **CONFIRMED** · FE-2 **PLAUSIBLE** · FE-3 **PLAUSIBLE** · FE-4 **PLAUSIBLE** · FE-5 **REFUTED** (upheld — not a defect) · COMP-7 **CONFIRMED**
>
> Scout's own verdicts map cleanly: its "needs-measurement" (FE-2/3/4) = my **PLAUSIBLE** (mechanism verified in code, magnitude gated on runtime data neither of us can read); its "confirmed" (FE-1, COMP-7) = my **CONFIRMED**; its "refuted" (FE-5) I uphold. No verdict overturned. Corrections and drift below.

---

## FE-1 — Full filtered library serialized into the `'use client'` payload — **CONFIRMED**

Independently reproduced. `app/library/page.tsx` is `dynamic = 'force-dynamic'` (line 33). It computes the **entire** filtered+sorted list into `shown` (line 101), then passes `games={shown}` (line 148) to `<LibraryResults>`, which is `'use client'` (LibraryResults.tsx:1). Crossing the RSC→client boundary serializes the whole `games: LibraryGame[]` array into the Flight payload; pagination is client-only (`useState(PAGE_SIZE=24)` → `games.slice(0, visible)`, LibraryResults.tsx:28–29), so it bounds **DOM nodes only**, never the transferred payload. Mechanism is fully code-derivable and holds.

**Dead-weight fields confirmed and understated by the scout.** `GameCard`/`GameRow` receive only `appId, name, headerUrl, playtimeMinutes, twoWeeksMinutes, hasAchievements, playtimeHidden` (LibraryResults.tsx:41–48, 56–64; grep of `GameCard.tsx`/`GameRow.tsx` props shows **no `iconUrl` prop at all**). So the serialized `LibraryGame` ships **three** unused fields per game, not one: `iconUrl` **and** `lastPlayed` **and** `acquiredAt` are all dead weight in the tiles. The scout flagged only `iconUrl`. This strengthens FE-1.

**Byte math holds / is if anything conservative.** `buildIconUrl` (lib/steam/client.ts:102–105) emits `https://media.steampowered.com/steamcommunity/public/images/apps/{appId}/{40-hex-hash}.jpg` ≈ **~115 chars**, not the scout's "~90". `buildHeaderUrl` (client.ts:106–108) ≈ 63 chars. Two URLs ≈ 178 chars + keys + `name` + `playtime{}` + ISO `lastPlayed`(~24) + `acquiredAt`(~24) ⇒ the scout's ~300–380 B/game raw is reasonable-to-conservative. Absolute KB is the one gated variable (see Gated checks) but the *directional* claim — dominant, unbounded, re-shipped per filter/sort — is settled from code.

### Evidence
| File | Line | Finding |
|------|------|---------|
| app/library/page.tsx | 33 | `export const dynamic = 'force-dynamic';` — every nav re-runs the RSC and re-serializes. |
| app/library/page.tsx | 98–101 | `const base = filterByStatus(filterGames(games, q), status);` … `const shown = sortGames(filtered, sort);` — `shown` is the **whole** filtered list. |
| app/library/page.tsx | 148 | `games={shown}` passed into the client component. |
| components/library/LibraryResults.tsx | 1 | `'use client';` — the serialization boundary. |
| components/library/LibraryResults.tsx | 28–29 | `const [visible, setVisible] = useState(PAGE_SIZE);` / `const shown = games.slice(0, visible);` — client-only paging, bounds DOM not payload. |
| components/library/LibraryResults.tsx | 41–48, 56–64 | `GameRow`/`GameCard` props — **no `iconUrl`, `lastPlayed`, or `acquiredAt`** consumed. |
| lib/steam/schemas.ts | 66–79 | `OwnedGameSchema` = `{ appId, name, iconUrl(nullable), headerUrl, playtime{total,twoWeeks}, lastPlayed(nullable), hasAchievements }`. |
| lib/games/sort.ts | 24 | `export type LibraryGame = OwnedGame & { acquiredAt?: string \| null };` — the serialized shape. |
| lib/steam/client.ts | 102–108 | `buildIconUrl` (~115-char media URL) + `buildHeaderUrl` (~63-char CDN URL). |

**Scout imprecision (verdict unchanged):** the report attributes per-filter re-serialization to the remount `key` on page.tsx:147 (`${status}-${sort}-${q}`). The `key` only resets *client pagination*; re-serialization happens because the `force-dynamic` RSC re-renders on every navigation (line 33). Consequence: changing `view` or `multiplayer` — which are **absent from the key** — still re-ships the full array without remounting. The scout's conclusion ("re-shipped on every filter/sort change") holds; the cited cause is wrong.

---

## FE-2 — All achievements rendered, one `next/image` per row — **PLAUSIBLE**

Mechanism verified: `AchievementList` is an RSC (comment line 12, no `'use client'`), maps `items` with **no cap** (lines 159–161), each `AchievementRow` emits an `<Image … unoptimized />` (lines 38–45). `unoptimized` bypasses the Next resize proxy but Next still emits `loading="lazy"` by default, so network is viewport-bounded; the unbounded cost is DOM nodes + initial HTML, scaling 1:1 with a game's total achievement count. Row is ~8–11 DOM elements. All anchors match exactly.

**Why PLAUSIBLE not CONFIRMED:** the blast size is `items.length` = total achievements for the one opened game, a runtime distribution neither of us can read (dev DB holds 2 games / 6 unlocks — no realistic sample). ~100 achievements ⇒ ~800–1100 nodes (fine); pathological grind titles (1000+) ⇒ ~8–11k nodes on one `/game/[appId]` page. Bounded to one game per view, render-cost only (cold==warm).

### Evidence
| File | Line | Finding |
|------|------|---------|
| components/game/AchievementList.tsx | 12 | `RSC: pure render, no 'use client'.` |
| components/game/AchievementList.tsx | 159–161 | `{items.map((item) => (<AchievementRow key={item.apiName} item={item} />))}` — uncapped. |
| components/game/AchievementList.tsx | 38–45 | `<Image src={item.iconUrl} … width={48} height={48} … unoptimized />` — one per row, lazy by default. |

---

## FE-3 — Shared-games rows unpaginated / unvirtualized — **PLAUSIBLE**

Mechanism verified: `SharedGamesTable` (RSC) maps `rows` with no limit (line 58); each row is a `grid` row (~10 elements) with a lazy `<Image … fill sizes="40px" />` (lines 67–74). `rows` is `computeSharedGames`'s inner-join of the two libraries (lib/compare/shared-games.ts:31–72); length is bounded by `min(|a de-duped|, |b|)` — the join pushes one row per shared appId (line 55). Server-rendered HTML (no client-serialization tax, unlike FE-1). All anchors match.

**Why PLAUSIBLE:** intersection size for real compared pairs is unknowable from code; can be thousands for two large accounts (⇒ ~10k nodes + 1000 lazy imgs) or a handful. Confined to `/compare`, only when two users are compared.

### Evidence
| File | Line | Finding |
|------|------|---------|
| components/compare/SharedGamesTable.tsx | 58 | `{rows.map((row) => (` — uncapped. |
| components/compare/SharedGamesTable.tsx | 67–74 | `<Image src={row.iconUrl} alt="" fill sizes="40px" … />` — one lazy img per shared game. |
| lib/compare/shared-games.ts | 31–72 | `computeSharedGames` inner-joins A×B on `appId`, `shared.push(...)` per common game (line 55); length = size of the intersection. |

---

## FE-4 — Friends list unvirtualized, avatar per card — **PLAUSIBLE** (lowest priority)

Mechanism verified: `FriendsList` (RSC) maps `friends` with no cap (line 24) into a 2-col grid of `FriendCard`; each card renders one `<Image src={avatar.full} fill sizes="56px" />` (FriendCard.tsx:36, lazy by default). DOM scales with friend count. `FriendCard` also emits an internal `next/link` per card (line 50), so node count per card is a touch higher than the scout's estimate — immaterial.

**Why PLAUSIBLE (and lowest priority):** ceiling is Steam's hard ~2000-friend cap (⇒ ~2000 cards); typical accounts are tens-to-low-hundreds where this is a non-issue. Real friend-count distribution is the gated variable.

### Evidence
| File | Line | Finding |
|------|------|---------|
| components/friends/FriendsList.tsx | 24 | `{friends.map((friend) => (` — uncapped. |
| components/friends/FriendCard.tsx | 36 | `<Image src={avatar.full} alt={personaName} fill sizes="56px" … />` — one lazy avatar per card. |
| components/friends/FriendCard.tsx | 50 | `<Link href={\`/compare?b=${steamId}\`} …>` — extra per-card node (scout's ~10/card is slightly low). |

---

## FE-5 — lucide-react named imports tree-shaking — **REFUTED** (scout's refutation upheld)

Not a defect. Confirmed both of the scout's reasons: (1) `next@^14.2.15` (package.json:33) ships `lucide-react` on its built-in `optimizePackageImports` default list, so the barrel import is rewritten to per-icon deep imports at build regardless of config — and `next.config.mjs` (opened in full, 22 lines) has **no** `modularizeImports`/`optimizePackageImports` override, so the default applies. (2) `lucide-react` is per-icon ESM, tree-shaking under any modern bundler even without the Next optimization. Only referenced icons bundle.

**Scout imprecision (verdict unchanged):** the report says "only the four referenced icons." Across the `/library` route there are **five** lucide icons — `LibraryControls.tsx:5` imports 4 (`LayoutGrid, List, Search, Users`) and `LibraryResults.tsx:4` imports `ChevronDown`. Immaterial to the refutation; per-icon tree-shaking still lands exactly the used set.

### Evidence
| File | Line | Finding |
|------|------|---------|
| components/library/LibraryControls.tsx | 5 | `import { LayoutGrid, List, Search, Users } from 'lucide-react';` |
| components/library/LibraryResults.tsx | 4 | `import { ChevronDown } from 'lucide-react';` — a 5th route icon the scout omitted. |
| package.json | 32–33 | `"lucide-react": "^1.18.0"`, `"next": "^14.2.15"` (lucide-react on Next's default optimizePackageImports list). |
| next.config.mjs | 1–22 | No `modularizeImports`/`optimizePackageImports` override present. |

---

## COMP-7 — `new Date(...)` per unlocked achievement in nested loop + sort re-parse — **CONFIRMED** (trivial cost)

Reproduced. In `aggregateLibrary` (lib/achievements/aggregate.ts:143–179): the nested loop constructs a `Date` for each **unlocked, non-null-`unlockedAt`** achievement across the whole library at line 161 (guarded by the `continue` at line 159), discarding it after the cutoff compare; the last-7-days survivors are then **re-parsed** in the `recentUnlocks.sort` comparator at lines 171–172. The scout's original `:157` anchor drifted to `:161`/`:171` — the scout already corrected this in its own report; I re-confirm.

**Scout's self-refutation upheld:** the `mergeGameAchievements` comparator (lines 112–122) sorts by `unlocked` then `globalPercent` and parses **no dates** — so the scout's earlier "re-parse in the sort comparator of mergeGameAchievements" claim is correctly withdrawn. The only double-parse is in `aggregateLibrary`.

**Cost is trivial and CONFIRMED as such.** `new Date(iso).getTime()` is sub-microsecond; even the scout's high estimate (~25k allocations for 500 games × 50 unlocked) ≈ a few ms. Note the loop only allocates for *unlocked* achievements (line 159 guard), so 25k is an upper bound. Server-side, not user-facing.

**Correction to the scout's "behind the cache" / "not per-nav" blast-radius claim.** `aggregateLibrary` is called from `getAchievementProgress` (achievements.ts:124), which is **not itself wrapped in `cache()`** — only the per-game `getGameAchievements` fetches are cached (achievements.ts:98 comment, :111). `getAchievementProgress` is invoked by **two** dashboard sections independently — `AchievementSummarySection.tsx:26` and `AchievementKpiSection.tsx:24` — so `aggregateLibrary` (and its Date churn) **recomputes on every dashboard render, roughly twice per render**, not "only on cold cache." Immaterial to severity (still low-ms), but the scout's caching characterization is wrong.

### Evidence
| File | Line | Finding |
|------|------|---------|
| lib/achievements/aggregate.ts | 159 | `if (!item.unlocked \|\| item.unlockedAt === null) continue;` — Date alloc is guarded to unlocked items only. |
| lib/achievements/aggregate.ts | 161 | `const unlockedMs = new Date(item.unlockedAt).getTime();` — per-item alloc in the nested loop. |
| lib/achievements/aggregate.ts | 171–172 | `const aTime = a.unlockedAt != null ? new Date(a.unlockedAt).getTime() : 0;` — re-parse in the recent-window sort. |
| lib/achievements/aggregate.ts | 112–122 | `items.sort(...)` in `mergeGameAchievements` — sorts by unlocked/globalPercent, **no date parse** (refutes the scout's withdrawn claim). |
| server/repositories/achievements.ts | 124 | `const summary = aggregateLibrary(availableResults.map((r) => r.data));` — caller; **not** cache-wrapped. |
| components/dashboard/AchievementSummarySection.tsx | 26 | `const result = await getAchievementProgress(steamId, appIds);` — dashboard caller #1. |
| components/dashboard/AchievementKpiSection.tsx | 24 | `const result = await getAchievementProgress(steamId, appIds);` — dashboard caller #2 (⇒ recompute per render). |

---

## Stale anchors (claimed vs actual at HEAD)

| Finding | File | Claimed | Actual | Note |
|---------|------|---------|--------|------|
| FE-1 | lib/steam/schemas.ts | 66–81 | schema object 66–79; `export type OwnedGame` at 81 | Off-by-two on the range; content correct. |
| FE-4 | components/friends/FriendCard.tsx | 1 (import) | import at 1; `<Image>` at 36; extra `<Link>` at 50 | Import anchor correct; the actual avatar render is line 36. |
| COMP-7 | lib/achievements/aggregate.ts | 157 (original scout) → 161/171 (scout-corrected) | 161 and 171–172 | Scout already corrected 157→161 in its report; re-confirmed. |
| FE-1 (cause) | app/library/page.tsx | 147 (`key` blamed for re-serialization) | 147 key exists but only resets client paging | Re-serialization is caused by `force-dynamic` re-render (line 33), not the key. |

All other cited anchors (FE-1 page.tsx 98–101/148, LibraryResults 1/28–29; FE-2 AchievementList 12/38–45/159–161; FE-3 SharedGamesTable 58/67–74, shared-games.ts join; FE-4 FriendsList 24; FE-5 LibraryControls 5; COMP-7 caller achievements.ts 124) match HEAD exactly.

## Blast-radius corrections

- **FE-1:** dead-weight surface is larger than reported — `iconUrl` **+ `lastPlayed` + `acquiredAt`** are all serialized-but-unused by the tiles. Re-serialization also fires on `view`/`multiplayer` changes (absent from the remount `key`), not just `status`/`sort`/`q`.
- **FE-4:** ~10 nodes/card understates slightly — each `FriendCard` also emits a `next/link` (line 50). Ceiling still Steam's ~2000 cap; verdict unchanged.
- **FE-5:** route uses **5** lucide icons (LibraryControls 4 + LibraryResults `ChevronDown`), not 4. Refutation unaffected.
- **COMP-7:** `aggregateLibrary` is **not** cached and runs ~twice per dashboard render (two dashboard sections call `getAchievementProgress`), so it is effectively per-nav, not cold-cache-only. Cost still negligible.

## Gated checks — human/runtime lane (read-only; not run in this verification)

### FE-1 — `payload-size` (settles absolute magnitude, not the mechanism)
```
# On a real authenticated /library render for a large account:
# 1. DevTools → Network → the RSC/document response for /library
# 2. Search the Flight payload for a games array; measure transferred (gzip) bytes,
#    or: count LibraryGame entries × observed per-game serialized length.
# 3. Confirm iconUrl/lastPlayed/acquiredAt strings are present per game (schema says yes).
```
**Expect:** payload grows linearly with library size; at ~1000 games the games array is the single largest transfer on the route while only 24 tiles paint. Confirms the ~90–110 KB-gz-at-1000-games order of magnitude (or refines it — iconUrl is ~115 chars, so likely at/above the scout's estimate).

### FE-2 — `achievement-count-distribution`
```
SELECT appId, COUNT(*) AS achievements
FROM Achievement            -- or the populated achievement table once seeded
GROUP BY appId ORDER BY achievements DESC LIMIT 20;
```
**Expect:** the tail (grind titles with 500–1000+ achievements) determines whether a single `/game/[appId]` render blows past a few thousand DOM nodes. A thin tail ⇒ demote to non-issue; a fat tail ⇒ confirm cap/paginate.

### FE-3 — `shared-intersection-distribution`
```
# For representative compared pairs, size min(|libraryA|, |libraryB|) and the actual
# computeSharedGames output length. No live table exists; needs real /compare traffic
# or two seeded large libraries.
```
**Expect:** median intersection size. Thousands ⇒ confirm (~10k nodes on /compare); low hundreds ⇒ demote.

### FE-4 — `friend-count-distribution`
```
SELECT steamId, COUNT(*) AS friends FROM Friend GROUP BY steamId ORDER BY friends DESC LIMIT 10;
```
**Expect:** if >~500-friend accounts are common, virtualize; otherwise leave (ceiling capped at ~2000 by Steam). Lowest priority.

## Notes on the dev DB
`prisma/test.db` / `prisma/ci.db` hold only CI fixtures (per the scout: OwnedGame 0, AchievementUnlock 6, Game 2). No realistic library exists to measure against, which is exactly why FE-2/3/4 magnitudes are gated rather than settled. Consistent with the bug-3 receipt's discipline of quarantining every runtime-dependent number into a Gated-checks section.
