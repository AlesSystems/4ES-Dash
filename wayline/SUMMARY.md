# Investigation SUMMARY — 4ES-Dash critical bugs (Phase 1: Investigate)

> Durable receipt of the read-only, adversarially-reviewed root-cause investigation run from the
> `Buggy` branch. Workflow: 4 Explore workers (opus, low) → 4 adversarial Explore reviewers (opus, xhigh),
> pipeline. **No app code was edited; no live Supabase/Vercel call was made.**
>
> Run: `wf_e00d3740-b7b` · 8 agents · 123 tool calls · ~437.9k tokens · ~6.5 min.

---

## Verdict table

| Bug | Verdict | Ready for planning | Conf. | One-line root cause |
|---|---|---|---|---|
| [01 — Dashboard Achievements KPI "—"](bug-01-dashboard-achievements-hours.md) | **confirmed** | ✅ yes | 5/5 | **Code-determined wiring bug** (disambiguated by user screenshot — *hours render fine; only the Achievements KPI is "—"*). `app/page.tsx:133` hardcodes `achievementPercent={null}`; `KpiRow` is a pure RSC so it renders "—" forever. The real % is computed by a *separate* Suspense sibling (`AchievementSummarySection`) that never feeds the tile. Permanent for **all** users. |
| [02 — Library all "untouched"](bug-02-library-untouched-games.md) | **plausible** | ✅ yes | 4/5 | Library reads **live Steam** `playtime_forever` (not DB); a *game-details-private* account returns the games list with all-zero playtime → all "untouched". Code path confirmed; the *cause of the zeros* needs one live Steam check. |
| [03 — History week/month empty](bug-03-history-week-month-filters.md) | **confirmed** | ✅ yes | 5/5 | Toggle is aggregation granularity, not a date filter. Chart needs ≥2 snapshots over ≥2 periods, but seeding is forward-only **and the cron snapshots only the featured `STEAM_ID`** — so every non-featured user is permanently stuck at one onboarding row. |
| [04 — Settings re-sync spins forever](bug-04-settings-resync-stuck.md) | **confirmed** | ✅ yes | 5/5 | Unbounded, rate-limited (1 req/250ms) whole-library + uncapped per-game achievement backfill runs inside `resyncNow` with **no `maxDuration`** → exceeds platform default timeout; client `useTransition` has no `.catch`, so the spinner never clears. In-repo precedent: **ERR-0011 = 64.8s**. |

**Stop state: SUCCESS — 4/4 ready for planning.**
All four bugs are `confirmed`/`plausible` with `readyForPlanning=true`. Bug 01 was upgraded from
`plausible`/not-ready after the **user screenshot** disambiguated it: hours render fine (1,812 on a
public profile), so the privacy/transient/empty-appIds theories are refuted and the cause is a pure
code-determined wiring bug — no evidence lane needed for it. The reviewer's "permanent display bug"
missed-angle was correct. Bugs 02–04 retain optional confirm-the-data evidence requests below, but each
already has a single named check or is code-confirmed.

---

## Consolidated evidence lane (gated — run separately, NOT by the workflow)

These are the **exact** read-only checks to confirm the data/runtime half of each root cause. Two
lanes: **(A) live Steam Web API** (read-only HTTP), **(B) Supabase SQL + Vercel logs/dashboard**.
None were executed here — workers physically lack network/DB access. Run them under a separately-gated
session, then re-review any item still open (`resumeFromRunId: wf_e00d3740-b7b`).

> **Bug 01 needs no evidence** — code-determined after the screenshot. Items below cover bugs 02–04.
> (The only *optional* bug-01-adjacent check is for the **separate** `AchievementSummarySection`, not the
> KPI-tile bug: confirm whether top owned games have `has_community_visible_stats=true` so that section
> doesn't show "No achievement data yet" for a user who does have achievements.)

### A. Live Steam Web API (read-only)

1. **Bug 02 — owned games / playtime:**
   `GET https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=$STEAM_API_KEY&steamid=<AFFECTED_ID>&include_appinfo=1&include_played_free_games=1`
   — confirm `response.games` present & non-empty **and** each entry has literal `playtime_forever: 0`
   (present, not omitted — if omitted it's a Zod/500, a different bug).

### B. Supabase SQL + Vercel (read-only)

4. **Bug 03 — per-user snapshot coverage:**
   `SELECT "steamId", COUNT(*) rows, COUNT(DISTINCT "date") distinct_days, MIN("date") first_snap, MAX("date") last_snap FROM "PlaytimeSnapshot" GROUP BY "steamId" ORDER BY distinct_days ASC;`
   (`distinct_days < 2` guarantees the empty state).
5. **Bug 03 — complainant period span:**
   `SELECT "date" FROM "PlaytimeSnapshot" WHERE "steamId" = '<ID>' ORDER BY "date";` (≥2 ISO weeks & ≥2 calendar months?)
6. **Bug 03 — is the complainant the featured user?** Compare `<ID>` against deployed `STEAM_ID`
   (Vercel → Project Settings → Environment Variables). Not equal ⇒ structurally permanent.
7. **Bug 03 — cron health (if featured):**
   `SELECT date_trunc('day', "startedAt") day, status, COUNT(*) FROM "JobRun" WHERE name='snapshot' GROUP BY 1,2 ORDER BY 1 DESC LIMIT 30;`
   Plus Vercel Cron Jobs history for `/api/cron/snapshot` (daily 03:00 UTC → 200, not 401/500) and confirm `CRON_SECRET` is set.
8. **Bug 04 — deployment timeout:** Vercel dashboard → plan (Hobby/Pro) + effective *unset-default* function
   timeout for the settings server-action route. (Single remaining unknown for bug 04.)
9. **Bug 04 — timeout fingerprint:** Vercel Runtime Logs for a `resyncNow` execution ending in *Task timed
   out* / duration at the plan ceiling with no final `onboardedAt`-update line.
10. **Bug 04 — partial-write fingerprint:**
    `SELECT "onboardedAt", "lastSyncedAt" FROM "User" WHERE "steamId"='<id>';`
    (fresh `lastSyncedAt` + today's partial `OwnedGame`/`PlaytimeSnapshot`/`AchievementUnlock` rows) and
    count `OwnedGame` / achievement-bearing games to quantify N (the `~3 × 250ms`/game floor).

---

## What's next (human-gated)

- **All four bugs** → ready for a **planning** workflow (separate phase). Each has a one-line fix
  direction and a confirmed/single-evidence root cause.
- **Bug 01** is code-determined (no evidence lane); **bugs 02–04** carry the optional confirm-the-data
  checks above but each is already code-confirmed or reduced to one named check.
- Choosing the fix, running the evidence lane, and approving any code change remain **human** decisions.
  This phase produced diagnosis only — no edits, no migrations, no deploy.
