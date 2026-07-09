# Evidence — Insights genre breakdown folds empty-genre games into an "Unknown" slice

> Read-only adversarial root-cause verification · branch `docs/bug-waylines` · 2026-06-30
>
> **Bug ID:** `bug-5` · **Classification:** `needs-product-decision` · **Confidence:** 5/5
>
> **Reviewer verdict:** `approve` · **Ready for planning:** ✅ yes · **Revise rounds:** 1

## Root cause

The genre breakdown deliberately buckets every owned game whose Game.genres column is the empty JSON array '[]' (or missing/malformed) into a slice labeled "Unknown". The repo getGenreBreakdown (server/repositories/insights/genres.ts) parses Game.genres per appId; any game with zero labels increments unknownFromUnavailable and is pushed as an empty-labels BreakdownItem (lines 87-92). aggregateBreakdown (lib/insights/genres.ts:61) maps empty labels to [unknownLabel], whose default is 'Unknown' (line 54). The empty '[]' originates because Steam Store appdetails omits genres for software/F2P/demos/soundtracks/delisted apps — getStoreMetadata maps (data.genres ?? []).map(...) (store-client.ts:208) and refreshGameStoreData persists JSON.stringify(genres) or '[]' on unavailable (game-store.ts:43-45). onboarding-backfill seeds genres:'[]' and its update branch never touches genres (onboarding-backfill.ts:132,135-139), so the value stays '[]' until the nightly refresh. ENABLE_STEAMSPY (env.ts:33, default off) gates only TAGS, not the genre fold — genre enrichment runs unconditionally. This is working-as-designed graceful degradation; the real fork is the product decision of how to present no-genre apps. Confirmed (a): when ALL games have empty genres, hasAnyRealGenre is false (line 113) and the repo returns empty slices, so the page shows the "No genre data yet" EmptyState (page.tsx:58-62) rather than a 100%-Unknown slice. Confirmed (b): unknownFromUnavailable is the exact count of empty-genre owned games and is surfaced numerically in the page note (page.tsx:110-114). Shares its upstream cause with bug 4: software titles like OBS are exactly the apps that land here.

## Evidence — every item grounded in a file:line opened this run

| File | Line | Finding |
|------|------|---------|
| `lib/insights/genres.ts` | 54 | aggregateBreakdown(items, unknownLabel = 'Unknown') — the literal 'Unknown' default label lives here, not at the repo call site. |
| `lib/insights/genres.ts` | 61 | const effectiveLabels = item.labels.length > 0 ? item.labels : [unknownLabel]; — empty-label games are folded into the Unknown bucket. |
| `server/repositories/insights/genres.ts` | 89 | if (labels.length === 0) { unknownFromUnavailable++; } then genreItems.push({labels, minutes}) — empty-genre owned games counted and pushed as empty-label items. |
| `server/repositories/insights/genres.ts` | 113 | hasAnyRealGenre = genreItems.some(item => item.labels.length > 0); when false (all empty) returns {slices: [], ...} so UI shows the empty state — confirms claim (a). |
| `server/repositories/insights/genres.ts` | 67 | JSON.parse(row.genres) with try/catch and Array/string validation; malformed or missing → [], feeding the Unknown fold. |
| `app/insights/genres/page.tsx` | 60 | EmptyState title="No genre data yet" rendered when !hasGenres (genres.slices.length === 0) — the all-empty suppression path. |
| `app/insights/genres/page.tsx` | 110 | unknownFromUnavailable count surfaced as a note: 'N games folded into "Unknown" because store metadata was unavailable' — confirms claim (b) and renders slice.label 'Unknown' at line 96. |
| `server/repositories/game-store.ts` | 43 | const genres = isAvailable(metaResult) ? JSON.stringify(metaResult.data.genres) : '[]'; — unavailable Store metadata persists as empty array (the upstream source of Unknown). |
| `lib/steam/store-client.ts` | 208 | genres: (data.genres ?? []).map(g => g.description) — appdetails with no genres field yields an empty genres array. |
| `server/jobs/onboarding-backfill.ts` | 132 | create writes genres: '[]'; the update branch (lines 135-139) does NOT touch genres, so it stays '[]' until nightly refresh. |
| `server/env.ts` | 33 | ENABLE_STEAMSPY enum default off, gates only the SteamSpy tag breakdown; genre enrichment is unconditional — confirms the fold is not behind a disabled flag. |

## Stale anchors (seed line numbers that drifted vs HEAD)

| File | Claimed line | Note |
|------|--------------|------|
| `server/repositories/insights/genres.ts` | 115 | Seed's fix-option 1 cites line 115 as the single relabel point 'aggregateBreakdown(genreItems, \'Uncategorized\')'. At HEAD line 115 is '? aggregateBreakdown(genreItems)' with NO label argument — the 'Unknown' default actually lives in lib/insights/genres.ts:54. A relabel must change the default at lib/insights/genres.ts:54 or pass an explicit arg at server/repositories/insights/genres.ts:115. |

## Blast radius

- server/repositories/insights/genres.ts — same getGenreBreakdown; tag breakdown (ENABLE_STEAMSPY) deliberately does NOT fold empty into Unknown (line 106 skips), so genre vs tag handling diverge
- /insights/cost-per-hour — same Game enrichment columns (price) via refreshGameStoreData; unavailable price degrades the same way for the same software/no-data apps
- app/library/page.tsx:83-94 — uncategorizedCount is the parallel 'missing Store category metadata' bucket from the same Store data, same flawed 'every app has Store metadata' assumption
- components/insights/GenreChart — renders genres.slices including the 'Unknown' slice label visually
- lib/insights/genres.ts:54 — the single source of the 'Unknown' default string; any relabel or exclude affects every aggregateBreakdown caller

## Gated checks — human live lane (read-only; never run inside this verification)

### `db`
- ```
  npx prisma studio  # then filter Game where genres = '[]' and count rows; OR via psql: SELECT count(*) FROM "Game" WHERE genres = '[]';
  ```
  **Expect:** Returns the number of owned games with no Store genres (software/F2P/demos). A non-zero count confirms live 'Unknown' folding; correlate with bug-4 software titles like appId 1905180 (OBS).
- ```
  psql "$DATABASE_URL" -c "SELECT g.\"appId\", g.name, g.genres FROM \"Game\" g JOIN \"OwnedGame\" o ON o.\"appId\"=g.\"appId\" WHERE g.genres='[]';"
  ```
  **Expect:** Lists exactly which owned titles land in 'Unknown'; expected to be software/free tools/delisted apps, confirming partial-metadata (not a wiring bug).

### `render`
- ```
  curl -s http://localhost:3000/insights/genres | grep -c 'Unknown'
  ```
  **Expect:** >0 when at least one owned game has a real genre AND at least one has empty genres; 0 when all-empty (the page shows 'No genre data yet' instead).

## Product decision required

The "Unknown" slice is working-as-designed graceful degradation, so the next step is a product decision on how to present owned apps that have no Steam Store genre metadata. Options (least invasive first): (1) RELABEL — change the default 'Unknown' to 'Uncategorized' or 'No genre (software/free apps)' at lib/insights/genres.ts:54 (or pass an explicit label at server/repositories/insights/genres.ts:115); cosmetic, the explanatory note already exists. (2) EXCLUDE — do not fold empty-genre apps into a chart segment at all; rely solely on the unknownFromUnavailable count note (touch server/repositories/insights/genres.ts:89-92 and verify totalMinutes denominator semantics). (3) ENRICH — fall back to SteamSpy genres or the Store app 'type' so software gets a real 'Software' label; most invasive (new wiring in refreshGameStoreData + the repo read), reduces the Unknown count. (4) NO-OP/DOCUMENT — keep the bucket plus note as acceptable graceful degradation. Recommend pairing with bug 4 since software titles (e.g. OBS) are the shared upstream cause.

## Reviewer (adversarial, opus 4.8 · effort xhigh)

**Verdict:** `approve`

**Suite baseline:** tests/unit/insights-repo-genres.test.ts: Test Files 1 passed (1), Tests 8 passed (8), Duration 758ms. (Also ran tests/unit/insights-genres.test.ts which covers the fold: Test Files 1 passed (1), Tests 10 passed (10), Duration 812ms.)

**Reasons / findings:**

- All 11 evidence anchors re-opened at HEAD match exactly: lib/insights/genres.ts:54 (unknownLabel='Unknown' default) and :61 (empty->[unknownLabel] fold); server/repositories/insights/genres.ts:67 (JSON.parse try/catch), :89-92 (unknownFromUnavailable++ and push), :113-116 (hasAnyRealGenre suppression to empty slices); app/insights/genres/page.tsx:60 (EmptyState) and :110/:96 (count note + slice.label render); server/repositories/game-store.ts:43-45 ('[]' on unavailable); lib/steam/store-client.ts:208 ((data.genres ?? []).map); onboarding-backfill.ts:132/135-139 (create writes '[]', update omits genres); env.ts:33 (ENABLE_STEAMSPY default off, gates only tags).
- Classification 'needs-product-decision' is honest. The symptom is fully explained by designed graceful degradation: the genre fold is unconditional (not gated by a disabled flag), the all-empty path returns empty slices and renders the 'No genre data yet' EmptyState rather than a 100%-Unknown slice (genres.ts:113-116, page.tsx:58-62), and the count is surfaced numerically (page.tsx:110-114). No residual latent code defect beyond the labeling/presentation choice.
- Evidence/gatedChecks separation is correct. No runtime fact requiring a live DB or HTTP call leaked into the 'evidence' array; all live row counts, psql queries, and the curl Unknown-grep are correctly confined to gatedChecks.
- The staleAnchor is correctly flagged and not papered over: the seed's fix-option-1 cites repo genres.ts:115 as aggregateBreakdown(genreItems, 'Uncategorized'), but HEAD line 115 is aggregateBreakdown(genreItems) with NO label arg — the worker correctly redirects any relabel to lib/insights/genres.ts:54 (default) or an explicit arg at the repo call site.
- Blast radius is complete and verified: captures the genre-vs-tag divergence (genres.ts:106 skips folding tags into Unknown), the cost-per-hour price sibling on the same enrichment columns, the library uncategorizedCount sibling (confirmed at app/library/page.tsx:83-94, parallel missing-Store-metadata bucket), GenreChart visual render, and the single-source label at lib/insights/genres.ts:54.
- Baseline suites are green and directly cover the fold: insights-repo-genres.test.ts (8 passed) includes 'folds game with empty genres into Unknown when other real genres exist' (line 70) and 'returns empty slices when ALL owned games have empty genres' (line 96); insights-genres.test.ts (10 passed) covers the Unknown bucket and custom unknownLabel (lines 33/39/86). A behavior regression on the fold would fail these tests.
