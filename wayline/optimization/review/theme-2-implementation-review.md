# Theme 2 implementation review — per-game external fan-outs

**Date:** 2026-07-15
**Reviewer:** adversarial reviewer (read-only, separate context)
**Branch:** `fix/opt-theme-2-fanouts` · **Base:** `21060a4` (fix/opt-theme-3-shell HEAD, Theme 3 approved)
**Contract:** `wayline/optimization/plan/PLAN-theme-2-external-fanouts.md` · `wayline/optimization/investigation/SUMMARY.md`

**Reviewed commits:**

| Commit | Task | Files |
|---|---|---|
| `7468c6c` | T1 | `prisma/schema.prisma`, `prisma/migrations/20260715153528_add_game_category_ids/migration.sql` |
| `bba85e6` | T2 | `server/repositories/game-store.ts`, `tests/unit/game-store.test.ts` |
| `c36be6d` | T3 | `server/repositories/multiplayer.ts`, `tests/integration/multiplayer-repo.test.ts` |
| `95e9b9b` | T4 | `server/cache/ttl.ts`, `server/repositories/achievements.ts`, `tests/unit/achievements-repo.test.ts` |
| `4e21c58` | closeout | `docs/BACKEND.md`, `docs/DATA_MODEL.md`, `docs/ERROR.md`, `docs/STEAM_DATA_SOURCES.md`, `wayline/optimization/measurements/theme-2-fanouts.md` |

## GATE (run by reviewer, this machine)

```
pnpm typecheck  → tsc --noEmit, exit 0, no output (clean)
pnpm lint       → ✔ No ESLint warnings or errors
pnpm test       → Test Files  111 passed (111) · Tests  991 passed (991) · Duration 20.44s
```

Matches the measurements file's closeout claim (111 files / 991 tests) exactly.

## Findings per hunt item

**1. Acceptance criteria / TDD rows 1–7.** All seven TDD rows realized in the named files with the planned test names. Red phases independently verified by reading base code at `21060a4` (implementer red-output reports are not committed as repo files; verification here is from base source):
- #1 red at base: base `refreshGameStoreData` upsert contains no `categoryIds` in `create`/`update` (`git show 21060a4:server/repositories/game-store.ts`), so `call.create.categoryIds` is `undefined` ≠ `'[1,36]'`.
- #2 red at base: the key-absence half (`'categoryIds' in call.update === false`) passes vacuously at base, but `expect(call.create.categoryIds).toBeNull()` fails on `undefined` — genuine red.
- #3 is the plan-sanctioned green-throughout tripwire (pins mocked `getGameStoreMetadata` count === games.length) — correctly exempted per the plan's TDD intro.
- #4/#5/#6 red at base: base `multiplayer.ts` imports and calls `getGameStoreMetadata` per game; the rewritten suite `vi.mock`s `@/server/repositories/store`, so the file-wide `afterEach` (`not.toHaveBeenCalled()`) fails at base, on top of behavioral mismatches.
- #7 red at base: `TTL.achievementSchema`/`achievementGlobal` don't exist at base (all three call sites used `TTL.playerAchievements` — confirmed in base `achievements.ts`), so both the `toHaveBeenCalledWith` and the `toBeGreaterThan` anti-aliasing assertions fail.
- Test #7 is not vacuous: it additionally asserts `TTL.achievementSchema > TTL.playerAchievements` and `TTL.achievementGlobal > TTL.playerAchievements`, so aliasing the new keys to 3600 would fail.

**2. Binding unavailable rule.** Implemented exactly: `categoryIds = isAvailable(...) ? JSON.stringify(...) : undefined`, then `update: { ...(categoryIds !== undefined ? { categoryIds } : {}) }` and `create: { categoryIds: categoryIds ?? null }` (`server/repositories/game-store.ts:58-61,93,101-103`). The test asserts literal key absence — `expect('categoryIds' in call.update).toBe(false)` — not undefined-ignoring, plus `create` null and `not.toBe('[]')`. `'[]'` is written only on *available* metadata (a positive classification — correct). The genres `'[]'`-on-unavailable behavior is preserved verbatim; the `tests/unit/game-store.test.ts` diff contains **zero deleted lines** (verified), so the pinning test `writes genres=[] when metadata is unavailable` (line 118) is byte-unchanged. The divergence rationale is documented at length in the Column-mapping doc comment (game-store.ts:30-41) and at the write site.

**3. T3 reader.** Zero Store calls enforced three ways, applying to every test in the file: `vi.mock` of the store repository with `afterEach` never-called assertions on both `getGameStoreMetadata` and `getGameStorePrice`, plus an MSW HTTP tripwire counting `appdetails` requests (asserted 0 in `afterEach`). `MultiplayerLibrary` shape unchanged; `stale` hard-pinned `false` at the return and asserted in the suite (dedicated test plus repeats). `parseCategoryIds` defensively handles null, unparseable JSON, non-array, and non-number-element shapes → `missingCount`, never the set — all four covered, including the valid-JSON-wrong-shape case `'[1, "x"]'`. Pre-T3 case enumeration (old suite via `git show 21060a4:tests/integration/multiplayer-repo.test.ts` vs new):

| Pre-T3 case (MSW) | New DB-seeded equivalent | Status |
|---|---|---|
| mixed library `[1]/[2]/[9]` (3 tests: set membership, missingCount 0, stale false) | Case 1, seeded `'[1]'/'[2]'/'[9]'`, all 3 tests | preserved |
| metadata unavailable (4 tests incl. resolves-without-throwing) | Case 2, seeded `null` row, all 4 tests | preserved |
| non-200 Store response (2 tests, id=27) | Case 2b, no Game row at all, both tests | preserved |
| empty library | Case 5, empty owned set | preserved |
| no-multiplayer library `[2,22]` | Case 5b, seeded `'[2,22]'`, asserts missingCount 0 (positive classification) | preserved |
| — | new: malformed/wrong-shape → missingCount (plan #5); empty Game table (plan #6) | added |

No case silently dropped. `app/library/page.tsx` untouched (zero diff under `app/`); its consumption of `mp.stale`/`mp.missingCount` (lines 88-95) is interface-compatible, and the StaleBanner still receives the profile-data stale signal independently.

**4. T1 migration.** `git diff --stat 21060a4...HEAD -- prisma/migrations/` shows exactly one new file, 2 insertions, zero modifications to existing migrations. `ALTER TABLE "Game" ADD COLUMN "categoryIds" TEXT;` — nullable, no default, no backfill, no index (lookups by `appId` PK per plan). Schema comment mirrors the genres convention. The green integration run (whose global-setup replays `prisma migrate deploy` against `test.db`) proves the migration applies cleanly.

**5. T4.** Exactly two keys added to `TTL` (`achievementSchema: 604800`, `achievementGlobal: 86400` — the plan's 7 d default taken); zero existing keys/values changed (diff is additions-only in `ttl.ts`); `Object.freeze`/`as const` intact and extensible for Theme 1's later `insightsAggregate`. Player cache keeps `TTL.playerAchievements` (achievements.ts:59). No numeric TTL literal in `achievements.ts` (grep clean; the only large numbers are a prose "~38 s → ~13 s" in the pre-existing ERR-0003 comment). ERR-0003 mitigations untouched: `app/page.tsx` and `server/cache.ts` have zero diff; the private-profile short-circuit (achievements.ts:63-68) is intact.

**6. Invariants.** Zod boundary: no new Steam I/O — `categoryIds` rides the already-Zod-parsed `StoreMetadata` (`lib/steam/store-client.ts:210`, untouched); stored-JSON readback is defensively parsed → `null` → `missingCount`, tested including the crash and wrong-shape paths. `steamId` stays a string (`requireSteamId` retained, signature unchanged). `lib/steam/**` has zero diff — `limiter.ts` (STEAM-4 deferred) and `retry.ts` (STEAM-5 gated) untouched, verified via `git diff 21060a4...HEAD -- lib/ | wc -l` → 0. Stale-while-revalidate row honored: `stale: false` pinned and asserted, gaps surface via `missingCount` only. No handler try/catch added (no route handlers touched); the pre-existing RSC `.catch` in the library page is unmodified.

**7. Scope.** `git diff --name-only 21060a4...HEAD` = exactly the plan's Affected-files union + the five closeout docs. Zero diff under `app/insights/**`, `app/`, `lib/`, `server/jobs/`, `server/repositories/store.ts`. Per-task commits are cleanly partitioned (table above). No test weakened or deleted outside the plan-sanctioned integration-suite rewrite.

**8. Cross-lane regressions.** Genres write logic preserved verbatim (base vs HEAD `game-store.ts` compared); test #1 asserts genres on both upsert branches; test #3 pins Store call count; the ERR-0011 surfaces (`game-store.test.ts` legacy tests, snapshot integration "populates Game.priceRefreshedAt and genres") all green in the gate run. Bug-5 genres surface preserved (byte-unchanged pinning test). `ttl.ts` composition intact for Theme 1's disjoint-key rebase.

**9. Docs.** ERR-0022 follows the template (Symptom / Root cause / Fix / Before-after / Generalized rule / Where else / Prevented by), index row added, nothing deleted, numbering correct (follows ERR-0021). Numbers are honest: the ~16.3 s "before" is explicitly labeled a receipt-verified *expectation*, live wall-clock is `handoff: manual` in `wayline/optimization/measurements/theme-2-fanouts.md`, and structural claims are labeled "PROVEN locally (CI-gated)" with the exact test files. The measurements file's gate claim (111/991) matches my run. All five gated checks from the plan's measurement section are preserved as manual handoffs. The deferred, unowned STEAM-2 precompute and the Phase-6 STEAM-4 handoff are both recorded in ERR-0022's "where else" note as the plan demanded. DATA_MODEL/BACKEND/STEAM_DATA_SOURCES updates present and accurate; ARCHITECTURE.md does not enumerate precompute columns, so the plan's conditional update correctly did not fire.

**10. Gate.** Run in full by me; output above. Green.

## Itemized criteria table

| Criterion | Verdict |
|---|---|
| T1: additive migration, no existing migration touched | MET |
| T1: nullable column, typecheck green, Prisma client exposes `string \| null` | MET (gate) |
| T1: no backfill; existing rows null | MET (migration.sql has no UPDATE) |
| T2: available → JSON array persisted (create+update) | MET (test 1) |
| T2: unavailable → update omits key; create null; never `'[]'` | MET (test 2, key-absence asserted) |
| T2: genres pinning test byte-unchanged | MET (zero deletions in file) |
| T2: Store call count unchanged | MET (test 3, green-throughout tripwire) |
| T2: idempotent re-run | MET (modulo `priceRefreshedAt` timestamp — see NITS) |
| T2: divergence rationale in column-mapping comment | MET |
| T3: zero `getGameStoreMetadata`/`storeLimiter` calls, asserted per-test | MET (afterEach + MSW tripwire) |
| T3: shape unchanged; null/malformed → missingCount, never the set | MET (tests 4-5 + wrong-shape case) |
| T3: `stale` always false, asserted | MET |
| T3: every pre-T3 case has DB-seeded equivalent | MET (enumerated above) |
| T3: empty Game table degrades, never throws | MET (test 6) |
| T3: `/library?multiplayer=1` renders against seeded dev DB | SUBSTANTIVELY MET at the data layer; manual render check unrecorded (see NITS) |
| T4: only schema/global caches use new keys; player cache unchanged | MET (test 7, anti-aliasing asserted) |
| T4: no TTL literal in achievements.ts | MET |
| T4: ERR-0003 mitigations untouched | MET (zero diff on their files; short-circuit verified) |
| TDD rows 1-7 realized, genuine red phases (except sanctioned #3) | MET (verified against base source) |
| Scope: diff = plan union + closeout docs; zero `app/insights/**` | MET |
| Invariants table (Zod, steamId, TTL map, stale, degrade, migrations, `lib/steam` untouched) | MET |
| Docs: ERR-0022 template + index, no fabricated numbers, honest measurements | MET |
| Gate: typecheck + lint + test green | MET (run by reviewer) |

## BLOCKERS

None found.

## NITS (non-blocking)

1. **T3 acceptance bullet 5 ("renders correctly against a seeded dev DB") has no recorded evidence.** The behavioral substance (filtered set, `missingCount` surfacing, empty-table no-throw) is fully covered by regression-detecting integration tests and the page is untouched, but the measurements file — which diligently records every other manual handoff — does not record this dev-DB render check being performed. Confidence this matters: low (~30%); recommend the human perform or record a one-time `/library?multiplayer=1` smoke check against a seeded dev DB before merge.
2. **Idempotency test strips `priceRefreshedAt`** before comparing runs, so "identical rows" is literally true only modulo the by-design refresh timestamp. Matches the plan's intent (reference-data idempotency) but worth knowing.
3. **`docs/ARCHITECTURE.md` caching table** (line 162-170) doesn't list the two new achievement TTLs — the table was already non-exhaustive pre-change (steamLevel/steamSpy/itadPrice also absent), and the plan's ARCHITECTURE condition (precompute-column enumeration) correctly didn't fire, so this is a pre-existing docs gap, not a regression.
4. **Unavailable last-known-good survival** is proven at the unit level via key-omission on the mocked upsert (the strongest assertion possible there); an integration-level seeded-row survival assertion would be marginally stronger. The reader-side integration suite does seed real rows, so the composed behavior is covered.

## NOTES

- Implementer red-phase reports were not committed as repo artifacts; red phases were independently re-derived by this reviewer from base source at `21060a4` (details in hunt item 1). All check out.
- `stale: false` pinning removes the multiplayer contribution to the library page's `StaleBanner`; the profile-data stale signal (page line 51) still drives the banner — this is the plan's explicit T3 criterion, not a regression.
- Theme 1 rebase reminder (from the plan's co-edit note): `ttl.ts` gained two keys between `playerAchievements` and `friendList`; `insightsAggregate` remains a disjoint-key addition.
- First-run gap (all `categoryIds` null until the first post-deploy nightly run) is documented in ERR-0022 and the measurements file with the manual-cron instruction, as the plan required.

VERDICT: APPROVE
