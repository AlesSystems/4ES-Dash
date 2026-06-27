# Plan 02 — Library shows all games as "untouched" despite playtime

> Phase-2 fix plan. Worker (Plan, opus, low) → adversarial reviewer (reviewer, opus, xhigh), READ-ONLY.
> **Verdict: `approve` · readyForImplementation = `true`** (approved round 1 of the revision pass).
> Source of truth: [bug-02-library-untouched-games.md](bug-02-library-untouched-games.md).

| Field | Value |
|---|---|
| Fix classification | **ux-degradation** (reviewer upheld) |
| Effort | **M** |
| Worker confidence | 5/5 |
| Reviewer verdict | approve · ready=true · classOk · testMapOk · redFirstOk · scopeOk · nonNegOk · priorAddressed |
| Rounds to approval | revise (initial) → approve (revision round 1) |

## Root cause (recap)

A game is classified "untouched" purely as `playtime.total === 0`, derived at **three independent sites**:
`app/library/page.tsx:104-105` (header counts), `lib/games/sort.ts:63` (status filter), and **per-game** in
`components/library/GameCard.tsx:31` (label at `:56`/`:71`) and `components/library/GameRow.tsx:24`
(label at `:42`). `playtime.total` is sourced **live** from Steam `GetOwnedGames` `playtime_forever` with
no transform (`lib/steam/client.ts:201`) through the cache-only `getProfile`
(`server/repositories/profile.ts:23-34`, no DB read-through). An account that is profile/game-list public
but has **"Game details" privacy not public** still returns a present, non-empty `games` array with every
`playtime_forever` literally `0` — slipping past the `private` branch (`client.ts:187-192`, which only
fires when the `games` key is absent) and rendering every game "untouched" across header, tiles, and the
status filter. Crucially, `OwnedGame` already carries `lastPlayed` (`schemas.ts:77` ← `rtime_last_played`
at `client.ts:204`): a **non-null `lastPlayed` with `total===0` is near-conclusive privacy evidence** (a
never-played game cannot have a last-played timestamp) — this disambiguates the new-account false positive.
The symptom requires Steam to emit literal `playtime_forever: 0`; if omitted, `schemas.ts:32` (required)
throws → 500, a different bug.

## Classification & strategy

**ux-degradation** — the data is legitimately **absent** (hidden by the viewed account's Steam Game-details
privacy), not corrupted by repo code. No isolated computation is wrong (`total === 0` correctly reflects
what Steam returned); the bug is presentational — the UI fabricates "never played" over withheld data,
violating **degrade-never-fabricate**. Not code-fix (nothing computes wrongly), not data-ops-fix (re-sync
only re-writes the same zeros while privacy is set), not mixed (the corrective code is pure UX; the only
Steam step is a one-shot gated evidence check), not wont-fix (an honest state is achievable).

**Strategy — one honest signal at the shared seam, threaded to every fabrication site:**
- Add an optional `playtimeHidden: boolean` to `getProfile` (`server/repositories/profile.ts`):
  `games` non-empty **AND** every game `playtime.total === 0` **AND** at least one game `lastPlayed !== null`.
  The `lastPlayed` corroboration is the repo's own conclusive disambiguator — a genuinely-new/never-played
  all-`null` account yields `false` and is left alone.
- In the **library** (the only UI in scope): (1) new in-context banner `PlaytimeHiddenBanner.tsx` above the
  grid; (2) suppress the header's fabricated unplayed/Untouched counts; (3) degrade the **per-game**
  "Untouched" label in `GameCard`/`GameRow` so tiles don't contradict the banner; (4) relabel the
  "Untouched" status-filter chip. The grid still lists owned games (the list is real).
- The identical violation on game/dashboard/`/u` pages is an **explicit documented waiver + filed
  follow-up**. The banner link target is resolved to `https://steamcommunity.com/my/edit/settings`.

**Why it beats alternatives:** the shared seam derives the signal once for all consumers and avoids touching
the Steam client schema / `private` branch (which would collide with bug-01 on `client.ts`/`schemas.ts`); a
library-page-local derivation would leave blast-radius pages wrong; fabricating any playtime is forbidden.

## Files to change

| File | Edit | Rationale |
|---|---|---|
| `server/repositories/profile.ts` *(shared w/ bug-01)* | Add optional `playtimeHidden: boolean` to the return type/object: `g.length>0 && g.every(x=>x.playtime.total===0) && g.some(x=>x.lastPlayed!==null)`. Docstring: privacy-concealment signal; all-null new account → false. No cache/Steam change. | Single shared seam; high-confidence signal that disambiguates the new-account false positive with the repo's own evidence. Additive optional field keeps all consumers compiling. |
| `app/library/page.tsx` | Destructure `playtimeHidden` (default false). When true: render `<PlaytimeHiddenBanner/>` above `LibraryControls`; pass `playtimeHidden` to `LibraryHeader`, `LibraryControls`, and `LibraryResults`. | The page is the single composition point owning the signal and wiring it to header, controls, banner, and the grid. |
| `components/library/PlaytimeHiddenBanner.tsx` *(new)* | Left-aligned in-context banner (`role=status`) mirroring `StaleBanner` tokens (`border-border`, `bg-surface-2`, `text-text-2`, caption — **no hex**). Copy: "Playtime is hidden by this account's Steam Game-details privacy." External anchor (`target=_blank rel=noopener noreferrer`) to `https://steamcommunity.com/my/edit/settings`. No fabricated number. | A concrete, named, in-context banner distinct from the centered `EmptyState`. |
| `components/library/LibraryHeader.tsx` | Optional `playtimeHidden?` prop. When true, replace `{untouchedCount} unplayed` (`:45`) and the `Untouched {untouchedCount}` stat (`:58-65`) with a neutral em-dash (`text-text-3`). Keep `gamesCount`/`totalHours`. | One of three fabrication sites; must not assert a numeric never-played count over withheld data. |
| `components/library/GameCard.tsx` | Optional `playtimeHidden?` prop. When true, suppress the corner pill (`:48-59`) and the italic "Untouched" body label (`:70-71`); render neutral `—` (`text-text-3`); aria-label playtime segment → "playtime hidden". | **Blocker fix:** the literal "Untouched" label that *is* the bug title is rendered per tile here. |
| `components/library/GameRow.tsx` | Optional `playtimeHidden?` prop. When true, render `—` in place of "Untouched" (`:42`); aria-label playtime → "playtime hidden" (`:29`). | List-view sibling renders the same literal label and must degrade identically. |
| `components/library/LibraryResults.tsx` | Optional `playtimeHidden?` prop, forwarded to each `<GameCard>`/`<GameRow>`. | The only path from page to per-game components; prop-forwarding only. |
| `components/library/LibraryControls.tsx` | Optional `playtimeHidden?` prop. When true, relabel the "Untouched" status chip → "Playtime hidden" (filter still works on real data). **Localize** the relabel (do not mutate the shared `STATUS_LABELS` map) and cover the active-filter count line too (see nit). | The Untouched filter matches all games when hidden; the chip must not assert "never played". |

## Tests (red-first → acceptance criteria)

| Test file | Asserts | Proves AC | Red-first condition (fails today) |
|---|---|---|---|
| `tests/unit/profile-playtime-hidden.test.ts` *(new)* | `playtimeHidden=true` when all `total===0` & some `lastPlayed!==null`; `false` when any `total>0`; `false` when all `total===0` & all `lastPlayed===null`; `false` for empty list. (Steam mocked at the lib boundary; function-level, no RSC render — ERR-0006-safe.) | AC1 | `getProfile` has no `playtimeHidden` key today → `undefined !== true` fails. |
| `tests/unit/profile-playtime-hidden.test.ts` *(same file, distinct case)* | all-null fixture → `false` (new account NOT flagged); one-`lastPlayed`-present fixture → `true` (privacy flagged). Replaces the prior **vacuous** test. | AC2 | No `playtimeHidden` field exists today; a genuine behavioral assertion (not docs/naming). |
| `tests/unit/GameCard.test.tsx` *(extend)* | `playtimeMinutes=0` + `playtimeHidden=true` → no literal "Untouched", renders `—`; prop absent → still "Untouched". | AC3 | `GameCard` has no prop today; unconditionally renders "Untouched" for `===0` (`:31,56,71`) → absence assertion fails. |
| `tests/unit/GameRow.test.tsx` *(new)* | Same as GameCard for list view (`:42`). | AC4 | `GameRow` has no prop today; always renders "Untouched" for `===0`. |
| `tests/unit/LibraryHeader.test.tsx` *(new)* | `playtimeHidden=true`, `untouchedCount=50` → no "50 unplayed"/numeric Untouched stat (renders `—`); false → "50 unplayed" + count 50. | AC5 | No prop today; always renders `{untouchedCount} unplayed` (`:45,62`). |
| `tests/unit/PlaytimeHiddenBanner.test.tsx` *(new)* | Renders the privacy copy + anchor `href==='https://steamcommunity.com/my/edit/settings'`, `target=_blank`, `rel` contains `noopener`; renders **no digit** (no fabricated number). | AC6 | Component does not exist today → reds at module resolution. |
| `tests/unit/LibraryControls.test.tsx` *(extend)* | `playtimeHidden=true` → no button labeled exactly "Untouched" (relabeled "Playtime hidden"); false → "Untouched" chip present. | AC7 | No prop today; always renders `STATUS_LABELS.untouched` chip. |

**Acceptance criteria** (7) map 1:1 to the tests above: the heuristic + its `lastPlayed` disambiguation;
per-game `GameCard`/`GameRow` no-"Untouched"; header no fabricated count; the honest banner with concrete
link & no number; the relabeled status chip.

## Data-ops actions (gated human lane — verification only, no fix)

1. **Live Steam (closes the branch):** `GET .../IPlayerService/GetOwnedGames/v1/?key=$STEAM_API_KEY&steamid=<AFFECTED_ID>&include_appinfo=1&include_played_free_games=1` — confirm (a) `games` present & non-empty, (b) each entry has literal `playtime_forever:0` (present, not omitted), (c) at least one non-zero `rtime_last_played` (the corroboration the heuristic relies on). If `playtime_forever` is omitted → it's a Zod/500, this plan is moot.
2. **Sanity check** the real account shows nonzero playtime in the Steam UI (details-private-hides-real-play vs genuinely-new).
3. **No data mutation / no re-sync** — re-syncing re-writes the same zeros while privacy is set.
4. **File a follow-up task** (reviewer change 5): "Wire `playtimeHidden` into game/dashboard/`/u` pages" — `app/game/[appId]/page.tsx` (`~:115`), dashboard, `app/u/[steamId]/page.tsx` still render a fabricated 0-hours for hidden libraries. **Explicitly waived** for this task (scope = library only).

## Shared files, dependencies & non-negotiables

- **Shared:** `server/repositories/profile.ts` (also **bug-01**, which only *reads* it) → serialize; this change is additive.
- **Dependencies:** bug-01 also edits `profile.ts` — coordinate merge order (additive optional field should rebase cleanly).
- **Non-negotiables engaged:** degrade-never-fabricate (honest banner + neutral em-dash, no silent zero, no fabricated count/playtime); Steam boundary & schema untouched (no bug-01 collision); Tailwind tokens only; no new try/catch (handlers stay `withErrorBoundary`); test-first with the prior vacuous test replaced by a real behavioral one; ERR-0006 respected (all assertions function-level or pure-component); `steamId` stays a string.

## Blast radius / rollback / regression risks

- **Blast radius:** adding the optional field touches `getProfile`'s return type (consumed by `app/page.tsx`, `app/u/[steamId]/page.tsx`, `app/game/[appId]/page.tsx`, `app/api/profile/route.ts`, `snapshots.ts`, `multiplayer.ts`, `snapshot.ts`, `onboarding-backfill.ts`) — additive, none break. UI scoped to the library (8 files). Adjacent-page violation is an explicit waiver + filed follow-up.
- **Rollback:** revert the 8 edits + delete the new banner. All additive (default false), pure code revert, no DB/config touched.
- **Regression risks:** new/never-played accounts now NOT flagged (eliminates the prior false positive); every UI change gated on `playtimeHidden===true` (false-branch test cases pin unchanged behavior); merge conflict with bug-01 (additive, serialized); prop-forwarding non-behavioral when undefined; consumers asserting `getProfile`'s exact shape may need snapshot updates.

## Open questions

None — all 7 round-1 open questions were resolved into decisions (banner component named, link resolved,
heuristic strengthened, waiver filed).

## Reviewer notes

Approved after independent verbatim re-verification of every cited line and a green run of the targeted
suites (`GameCard` 8, `LibraryControls` 21, `repositories-isolation` 7; typecheck clean) — confirming the
new absence-assertions red today for the right reason. **Non-blocking nits to carry into implementation:**
(a) `STATUS_LABELS` is consumed in **two** places in `LibraryControls` — the chip (`~:135`) **and** the
active-filter count line (`~:220`); the relabel must be a **local conditional** (not a mutation of the
shared `STATUS_LABELS` in `sort.ts`, which `app/library`'s count line also reads) and should cover the
`:220` span too. (b) The resolved link is the general Steam privacy page, not the game-details sub-section —
acceptable and honest, not a placeholder.
