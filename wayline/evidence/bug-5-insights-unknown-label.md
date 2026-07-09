# Wayline — Bug #5: Insights shows an "Unknown" label

**Confidence: 5/5** · Status: root-caused — behavior is *by design*; fix depends on intent

## Symptom

> Insights contains a label called "Unknown".

A slice/row in the Insights → Genre Breakdown chart is literally labeled **"Unknown"**.

## Root cause

`/insights/genres` buckets every owned game whose `Game.genres` column is the empty
JSON array `'[]'` (or missing/malformed) into a slice labeled **"Unknown"**. This is
the **intended graceful-degradation fallback** in `aggregateBreakdown`, triggered for
any game the Steam **Store API** returned no genres for — software, free-to-play
tools, demos, soundtracks, and delisted/region-locked apps (OBS, Wallpaper Engine,
etc.), which legitimately have no `genres` field in `appdetails`. It is a
**partial-metadata** condition, **not** a wiring bug: enrichment *is* fetched (and is
*not* behind a disabled flag), but some apps simply have no genre to fetch.

## Evidence

| Link | Location | Finding |
|---|---|---|
| The `'Unknown'` default | [lib/insights/genres.ts:54,61](../../lib/insights/genres.ts#L54) | `aggregateBreakdown(items, unknownLabel='Unknown')`; `:61` empty-labels game → `[unknownLabel]`. |
| Grouping field (genre, from DB) | [server/repositories/insights/genres.ts:57-92](../../server/repositories/insights/genres.ts#L57) | reads `Game.genres`, `JSON.parse`, `:87` `genreMap.get(appId) ?? []`, `:89-92` empty-label games increment `unknownFromUnavailable`; `:113-116` only all-empty is suppressed. |
| Data source | [server/repositories/game-store.ts:42-45](../../server/repositories/game-store.ts#L42), [lib/steam/store-client.ts:208](../../lib/steam/store-client.ts#L208) | `available → JSON.stringify(meta.genres)`, `unavailable → '[]'`; store maps `(data.genres ?? []).map(g=>g.description)` — no genres field → empty. `:198-199` `success:false` → `unavailable('metadata-unavailable')`. |
| Empty seeded, never backfilled on update | [server/jobs/onboarding-backfill.ts:132,135-139](../../server/jobs/onboarding-backfill.ts#L132) | create writes `genres:'[]'`; update branch does NOT touch `genres` → stays `'[]'` until nightly `refreshGameStoreData` ([snapshot.ts:165-170](../../server/jobs/snapshot.ts#L165)). |
| UI surfaces it twice | [app/insights/genres/page.tsx:96,110-114](../../app/insights/genres/page.tsx#L96) | renders `{slice.label}` (segment reads "Unknown"); plus note "N games folded into 'Unknown' because store metadata was unavailable." |
| Schema | [prisma/schema.prisma:55](../../prisma/schema.prisma#L55) | `genres String // JSON-encoded array`. |
| Tests assert the folding | [tests/unit/insights-repo-genres.test.ts:70-94](../../tests/unit/insights-repo-genres.test.ts#L70), [insights-genres.test.ts:33-36](../../tests/unit/insights-genres.test.ts#L33) | "Unknown" appears only when ≥1 game has a real genre AND ≥1 has empty. |
| Prior incident | [docs/ERROR.md:286-303](../ERROR.md) | **ERR-0011** (Fixed): genres column "written as `'[]'` … and never populated" → fix moved enrichment to nightly job. Related ERR-0008 ("No genre data yet" gate). |

## Data-flow trace (supposed source → actual)

```
Steam Store appdetails → getStoreMetadata parses data.genres[].description   store-client.ts:208
  → nightly refreshGameStoreData writes JSON.stringify(meta.genres) or '[]'    game-store.ts:69-87
  → getGenreBreakdown reads Game.genres from DB ONLY                           genres.ts:57-60
  → empty '[]' → aggregateBreakdown folds into 'Unknown'                       lib/insights/genres.ts:61
```
Genre IS wired through the nightly job. Where it "isn't": any app whose Store
`appdetails` has no `genres` (or returns `success:false`/unavailable) persists as
`'[]'` → **Unknown**.

## Why it fails (the class of error)

Not a disabled flag (only SteamSpy **tags** are gated by `ENABLE_STEAMSPY`, default
off, [server/env.ts:33](../../server/env.ts#L33); Store-metadata fetch runs
unconditionally). The broken assumption is that **every owned app has Store genres.**
Steam's `appdetails` omits `genres` for a large class of entries (software, free
tools, demos, soundtracks, delisted/region-restricted). Those map to `'[]'` → the
**Unknown** bucket by design.

## Scope — SOME items, not all

- ALL games empty → no "Unknown" slice; "No genre data yet" empty state instead
  ([genres.ts:113-116](../../server/repositories/insights/genres.ts#L113)).
- "Unknown" appears **only** when ≥1 game has a real genre AND ≥1 has empty/missing
  genres. Magnitude is already exposed to the user numerically as
  `unknownFromUnavailable` (page.tsx:110-114). The set ≈ the non-game entries in a
  library. Directly connected to **Bug #4 (OBS)** — software titles are exactly the
  apps that land here.

## Blast radius

- **`/insights/cost-per-hour`** — same `Game` enrichment (price columns via the same
  `refreshGameStoreData`); `unavailable` price degrades the same way
  ([tests/unit/insights-cost-per-hour.test.ts:121](../../tests/unit/insights-cost-per-hour.test.ts#L121)).
- **`/library` multiplayer view** — `uncategorizedCount`
  ([app/library/page.tsx:83-94](../../app/library/page.tsx#L83)) is the parallel
  "missing category metadata" bucket from the same Store `categories` data.
- **Community tags** (SteamSpy) — gated by `ENABLE_STEAMSPY`; residual render fan-out
  per ERR-0011:301.
- Any future per-game aggregate reading `Game` enrichment columns inherits this.

## Fix direction (described, not implemented — depends on intent)

The behavior is arguably correct (graceful degradation). Options, least invasive first:

1. **Relabel (cosmetic)** — `'Unknown'` → `'Uncategorized'` or
   `'No genre (software/free apps)'`. Single point:
   [server/repositories/insights/genres.ts:115](../../server/repositories/insights/genres.ts#L115)
   `aggregateBreakdown(genreItems, 'Uncategorized')`. The existing note already
   explains why.
2. **Exclude non-games from the slice** — don't fold empty-genre apps into a segment;
   rely on the `unknownFromUnavailable` count note. Touch
   [genres.ts:89-92](../../server/repositories/insights/genres.ts#L89) (verify the
   `totalMinutes` denominator semantics).
3. **Improve coverage (reduce the count)** — fall back to SteamSpy genres
   ([steamspy-client.ts:144](../../lib/steam/steamspy-client.ts#L144)) or the app
   `type` so software gets a real "Software" label. Most invasive (new enrichment
   wiring in `refreshGameStoreData`).
4. **No-op / document** — if the bucket + explanatory note is acceptable, no change;
   working as designed per ERR-0011.

## → Agentic loop seed

- **Decision needed first (product, not code):** is "Unknown" *wrong* (relabel/hide)
  or *incomplete* (enrich)? This drives which task runs. Recommend pairing with
  Bug #4 since software titles are the shared cause.
- **Brief intent (if relabel/enrich chosen):** "Owned apps without Steam genre
  metadata are presented with an accurate, non-alarming label, and where possible
  enriched from a secondary source instead of falling into 'Unknown'."
- **Acceptance criteria (testable):**
  - Relabel path: the bucket label is the chosen string; test updated from "Unknown".
  - Enrich path: a software title (e.g. OBS, appId 1905180) with no Store genre
    receives a `Software` label from the `type`/SteamSpy fallback; assert it's no
    longer folded into the empty bucket.
- **Task split:** (a) product decision; (b) relabel OR (c) type/SteamSpy fallback in
  `refreshGameStoreData` + repo read.
- **Reviewer checks:** the all-empty "No genre data yet" path still works
  (genres.ts:113-116); `unknownFromUnavailable` count still accurate; no regression in
  `insights-repo-genres` tests.
- **ERROR.md:** if enrichment is added, append `ERR-XXXX`; if relabel/no-op, annotate
  ERR-0011 that "Unknown" is expected partial-metadata behavior.
