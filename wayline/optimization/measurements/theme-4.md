# Theme 4 — Client payload and DOM size: measurements

- **Branch:** `fix/opt-theme-4-client-payload` (base `d419850` = theme-1 final)
- **Commits:** T1 `ed0e124` (LibraryTileGame projection), T3 `dba2a47` (single-parse recent-unlock sort), T2 `e2cbb02` (server-side slice + URL-state Load more, LibraryResults → RSC). **T4 not implemented — gate unmeasurable locally (see below).**
- **Date:** 2026-07-16. Location note: the plan names `wayline/optimization/plan/measurements-theme-4.md`; this file follows the repo-wide `wayline/optimization/measurements/<theme>.md` convention established by themes 1–3.

## Full gate (orchestrator-run receipts)

- After T1+T3: `pnpm typecheck` clean, `pnpm lint` clean, `pnpm test` → 114 files / 1031 tests passed.
- After T2: `pnpm typecheck` clean, `pnpm lint` clean, `pnpm test` → **115 files / 1044 tests passed**.

## Secondary metric (T2): `/library` route JS — RUN locally, PROVEN

`pnpm build` route table, identical machine, same lockfile:

| | Route size | First Load JS |
|---|---|---|
| Before (`d419850`) | 4.15 kB | 113 kB |
| After (`e2cbb02`) | **3.06 kB** | **112 kB** |

Flat-to-smaller as the plan predicted (client component converted to RSC, `useState` paging removed; only client file added is the `LoadMoreButton` leaf). Budget `< 200 kB gz` holds with wide margin.

## Primary metric (FE-1): transferred bytes for `/library` — `handoff: manual`

Requires an authenticated runtime render with DevTools network observation; not simulated here. Manual steps (from the plan):

1. DevTools → Network on an authenticated `/library` render: (a) document response size (Flight payload embedded), (b) RSC payload on a client-side nav. Record raw + gzip.
2. Repeat after a filter change (`?status=in-progress`) — first verify the post-filter URL contains **no** `limit` param (the T2 `updateUrl` reset; without it the number is invalid).
3. Repeat after one "Load more" (`?limit=48`).
4. Page to the end clicking "Load more" repeatedly; record the *cumulative* transferred bytes across all clicks vs HEAD's one-shot O(N) transfer (validates the disclosed O(limit²/PAGE_SIZE) worst case; record as accepted trade-off if it exceeds).

What is already machine-proven structurally (unit suite): the boundary ships at most `limit` tiles (default 24) — exactly-24-of-100 fixture; dead fields `iconUrl`/`lastPlayed`/`acquiredAt` cannot serialize (`Object.keys` equality pin on `toLibraryTile`); filter changes drop `limit` while `view` toggles preserve it.

- Gated check `payload-size` (real large account: confirm games array dominates transfer at HEAD; settles real N): `handoff: manual` — needs a real large-account render; local library is N=67.

## Gated checks that gate task scope

| Check | Local result (2026-07-16) | Disposition |
|---|---|---|
| `achievement-count-distribution` (gates T4/FE-2) | `SELECT appId, COUNT(*) FROM Achievement GROUP BY appId …` on local `ci.db` → **0 rows** (`Achievement` table empty; `OwnedGame` = 67 rows — real library, achievements reference never populated locally) | **`approval-required` — T4 skipped.** The decision rule (p95 ≥ ~300 or any ≥ 1000) needs a populated (prod) DB. FE-2 is neither implemented nor demoted: no honest evidence in either direction. |
| `shared-intersection-distribution` (FE-3, no task) | Not measurable locally — needs real `/compare` traffic or two seeded large libraries | `handoff: manual`; FE-3 stays dormant |
| `friend-count-distribution` (FE-4, no task) | Plan's query targets a `Friend` table that does **not exist** in the current schema/local DB (verified via `.tables`) — friends data is not persisted | `handoff: manual` (and the plan's query is stale against the shipped schema — flagged for the reviewer); FE-4 stays dormant |

## COMP-7 (T3) micro-check — optional per plan, not run

The plan marks this optional with no claim beyond "negligible stays negligible." Behavior is pinned by tests (newest-first ordering, inclusive 7-day boundary, null-skip); the comparator no longer constructs `Date` objects (verified by diff review). No wall-time number recorded.

## T2 AC6 (Playwright e2e) — environment-blocked, not applicable

The repo has no Playwright suite (no `playwright.config.*`, no `*.spec.ts`, no `playwright` entry in `package.json`), so AC6's self-conditioning e2e clause ("if the e2e suite covers `/library`") does not apply; the click→`limit=48`→48-tiles behavior is covered by unit TDD rows 3/5/5b instead. Recorded per reviewer round-1 MINOR issue 1.

## docs/API.md — verified, no change

Theme 4 touches no public `/api/*` surface (rejected alternative 1 avoided exactly this); verified against the diff `d419850...e2cbb02`. Recorded here per the theme-1 review nit that no-change verifications should live in a committed doc, not only a commit message.
