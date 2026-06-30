# Evidence — Year in Review under-counts/zeroes current-year hours: in-year cumulative floor used as baseline, no pre-year reach-back

> Read-only adversarial root-cause verification · branch `docs/bug-waylines` · 2026-06-30
>
> **Bug ID:** `bug-2-year-in-review-zero-hours` · **Classification:** `confirmed-code-bug` · **Confidence:** 5/5
>
> **Reviewer verdict:** `approve` · **Ready for planning:** ✅ yes · **Revise rounds:** 1

## Root cause

deltasByApp (lib/insights/year-in-review.ts:89-113) drops every row whose UTC year != target year at line 97 BEFORE computing per-app min/max. As a result min becomes the cumulative playtimeForever recorded on the FIRST in-year snapshot — a within-year lifetime floor — not the last pre-year snapshot or 0. The per-game delta at line 110 (max(0, max-min)) therefore subtracts away all hours accumulated before the first in-year snapshot, and is exactly 0 when a game has only one in-year snapshot. computeYearInReview (line 149) sums these into totalMinutes (153-155), so the page shows tiny/zero hours for the current year of a freshly-launched tracker. The repository getYearInReview (server/repositories/insights/year-in-review.ts:37-48) compounds this by fetching ALL snapshots with no date filter and no prior-year reach-back, then passing them straight into computeYearInReview — there is no baseline mechanism anywhere. playtimeForever is monotonic/cumulative, so the correct baseline is the last snapshot strictly before Jan 1 (or 0), which is exactly what the line-97 filter discards. Achievements were already moved off snapshot-deltas onto real unlockedAt events (lines 70-79, countUnlocksInYear) and are immune — that is the fix template.

## Evidence — every item grounded in a file:line opened this run

| File | Line | Finding |
|------|------|---------|
| `lib/insights/year-in-review.ts` | 97 | `if (row.date.getUTCFullYear() !== year) continue;` discards all out-of-year rows before min/max accumulation, so no pre-year baseline can ever enter the computation. |
| `lib/insights/year-in-review.ts` | 110 | `deltas.set(appId, Math.max(0, max - min));` — min is the first in-year cumulative floor; delta under-counts and is 0 when only one in-year snapshot exists (min===max). |
| `lib/insights/year-in-review.ts` | 101 | On first sight of an appId, `minMax.set(row.appId, { min: v, max: v })` seeds min from the in-year value itself, confirming the in-year floor as baseline. |
| `lib/insights/year-in-review.ts` | 153 | totalMinutes is the plain sum of these clamped in-year deltas, so the page total inherits the under-count directly. |
| `server/repositories/insights/year-in-review.ts` | 38 | `prisma.playtimeSnapshot.findMany({ where: { steamId: id }, select: { appId, date, playtimeForever } })` — no date filter and no separate query for the last pre-year snapshot; no baseline is ever fetched or supplied to computeYearInReview (line 60). |
| `tests/unit/insights-year-in-review.test.ts` | 131 | Test asserts totalMinutes===150 for a 2024-12-31:100 / 2025:200->350 fixture (350-200), proving the 2024 baseline of 100 is intentionally ignored; correct cross-boundary diff would be 250 (350-100). |
| `tests/unit/insights-year-in-review.test.ts` | 139 | Test 'single snapshot in-year produces delta 0' asserts totalMinutes===0 and topGames===[] for one owned/played game — enshrines the zero-hours symptom as expected behavior. |
| `lib/insights/year-in-review.ts` | 76 | countUnlocksInYear counts real unlockedAt events by UTC year (not a snapshot delta) — the already-immune sibling and the correct fix pattern to mirror for playtime. |

## Stale anchors (seed line numbers that drifted vs HEAD)

| File | Claimed line | Note |
|------|--------------|------|
| `tests/unit/insights-year-in-review.test.ts` | 122-133 | The '150 not 250' baseline-discard test is the describe block 'computeYearInReview — year filtering' at 121-133, target year 2025 (seed prose paraphrased it as a 2026 case with 200->350 over a 2024-12-31:100 baseline; the actual fixture uses 2025 as the in-year and 2024-12-31 as the discarded baseline). Behavior matches the seed's claim; only the year label in the prose differs. |
| `server/repositories/insights/year-in-review.ts` | 38-41 | findMany spans lines 38-41 as claimed, but it sits inside a Promise.all at 37-48 alongside the achievementUnlock query; substance (no date filter, no reach-back) is exactly as claimed. |

## Blast radius

- lib/history/aggregate.ts:145-172 — History uses the identical filter-then-(max-min) per (period,game) convention (line 156 seeds min from the in-year/period value, line 169 total += max-min). The FIRST bucket of any range is under-counted the same way: its min is the first within-bucket cumulative floor, not the prior bucket's end. Same latent defect, bucket-scoped (this is bug #1).
- server/repositories/insights/idle.ts — flagged by seed as also reading playtimeSnapshot; needs opening to confirm whether it diffs cumulative playtime with the same in-window-floor assumption (not opened this run).
- lib/insights/year-in-review.ts:70-79 (countUnlocksInYear) — NOT in blast radius: already correct (counts real unlockedAt events, no snapshot delta). Serves as the fix template, not an affected sibling.

## Gated checks — human live lane (read-only; never run inside this verification)

### `db`
- ```
  SELECT "appId", MIN("date"), MIN("playtimeForever"), MAX("playtimeForever") FROM "PlaytimeSnapshot" WHERE "steamId" = '<steamId>' AND date_part('year', "date" AT TIME ZONE 'UTC') = 2026 GROUP BY "appId";
  ```
  **Expect:** For affected games, MIN(playtimeForever) is a large lifetime total (hundreds/thousands of minutes) rather than near 0, and MAX-MIN is far smaller than the game's true lifetime — confirming the in-year floor is being subtracted. Games with a single 2026 row will have MIN===MAX (delta 0).
- ```
  SELECT "appId", MAX("date") AS last_pre_2026, MAX("playtimeForever") AS baseline FROM "PlaytimeSnapshot" WHERE "steamId" = '<steamId>' AND "date" < '2026-01-01T00:00:00Z' GROUP BY "appId";
  ```
  **Expect:** Returns zero rows (or rows only for users onboarded in 2025) — confirms no pre-2026 baseline snapshot exists for a project that began snapshotting in 2026, which is the precondition that makes the line-97 filter destructive.

### `http`
- ```
  curl -s 'http://localhost:3000/review/2026' -H 'Cookie: <session>' | grep -iE 'No data for 2026|hours'
  ```
  **Expect:** Renders 'No data for 2026' or a small hours figure, matching the reported symptom, even though the user has substantial lifetime playtime.

## Product decision required

When no pre-year baseline snapshot exists (snapshotting genuinely began mid-year), the value of in-year hours is real but partial. The product must decide between: (a) show the available partial-year range with a 'tracking began {date}' caveat, or (b) fall back to first-ever snapshot as baseline silently. This is a UX decision, not the root cause — the code defect (discarding the prior-year baseline at line 97 even when one DOES exist) is unambiguous and independent of this choice.

## Reviewer (adversarial, opus 4.8 · effort xhigh)

**Verdict:** `approve`

**Suite baseline:** GREEN but encodes the bug. `pnpm test tests/unit/insights-year-in-review.test.ts` => "Test Files  1 passed (1)" / "Tests  21 passed (21)" (vitest 2.1.9, 4ms). The suite is green only because two tests assert the buggy behavior as expected: line 130-132 expects totalMinutes===150 (in-year max-min, baseline 100 ignored; cross-boundary-correct is 250) and line 135-141 'single snapshot in-year produces delta 0' expects totalMinutes===0 and topGames===[]. The sibling repo suite tests/unit/insights-repo-year-in-review.test.ts also passes and confirms the repo fetches all snapshots with no date filter and no pre-year reach-back (only the #91 achievement-unlock path is exercised, not a playtime baseline). Any correct fix MUST update these two assertions, so they are the canary for the regression.

**Reasons / findings:**

- All cited anchors match HEAD exactly: lib/insights/year-in-review.ts:97 (filter discards out-of-year rows before min/max), :101 (seeds min from in-year value), :110 (Math.max(0, max-min)), :153 (totalMinutes plain sum), :76 (countUnlocksInYear immune sibling); server/repositories/insights/year-in-review.ts:38-48 (findMany, no date filter, no reach-back) and :60 (passes raw rows to computeYearInReview).
- Root cause is verified directly from code, not inferred: deltasByApp filters out every pre-year row at line 97 BEFORE accumulating min/max, so min becomes the first in-year cumulative playtimeForever (a within-year lifetime floor), and the per-game delta subtracts away all pre-year hours; with one in-year snapshot min===max so delta is exactly 0. Because playtimeForever is monotonic/cumulative, the correct baseline is the last snapshot strictly before Jan 1 (or 0), which is precisely what line 97 discards.
- Classification 'confirmed-code-bug' is honest and the symptom is fully explained by the code path. Two tests enshrine the defect: tests/unit/insights-year-in-review.test.ts:130-132 asserts totalMinutes===150 (350-200) when the cross-boundary-correct value is 250 (350-100, discarding the 2024-12-31:100 baseline), and :135-141 'single snapshot in-year produces delta 0' asserts totalMinutes===0 / topGames===[].
- Evidence vs gatedChecks separation is clean: every 'evidence' entry is a static code or test-assertion fact requiring no live call; all runtime/db/http assertions (in-year MIN being a large floor, no pre-2026 baseline rows, 'No data for 2026' rendering) are correctly quarantined in gatedChecks.
- Blast radius is complete and accurate: grep over lib/ and server/ (excluding tests) finds exactly two filter-then-(max-min) production sites — year-in-review.ts:110 (this bug) and history/aggregate.ts:169 (correctly attributed to sibling bug #1, verified at lines 154-156/168-169 seeding min from the first in-bucket value). The idle repository was flagged-not-asserted by the worker; on inspection it uses detectIdleSpikes (consecutive-pair deltas), a genuinely different algorithm that does NOT discard a baseline, so it is correctly excluded from the same defect.
- The countUnlocksInYear sibling (lib/insights/year-in-review.ts:70-79) is genuinely immune — it counts real unlockedAt events by UTC year, not a snapshot delta — and is the correct fix template, exactly as the worker states; confirmed by repo test :71-92.
- Product decision is correctly isolated: the mid-year-onboarding partial-year case is a real UX choice (caveat vs first-ever-snapshot fallback), cleanly separated from the unambiguous code defect of discarding a prior-year baseline that DOES exist.
- The worker proactively documented the only two anchor imprecisions in staleAnchors and both are accurate: the seed prose paraphrased the year-filtering test as a 2026/200->350 case but the actual fixture uses target year 2025 with a 2024-12-31:100 discarded baseline (behavior identical, only the year label differs); and findMany spans 38-41 inside a Promise.all at 37-48. Neither is a behavioral mismatch.
