# Bug 03 — History week & month filters show no data despite years of play

> Read-only investigation receipt. Worker (opus, low) → adversarial reviewer (opus, xhigh).
> **Verdict: `confirmed` · readyForPlanning = `true`** — code-verified end to end; the strongest
> finding of the batch.

---

## Verdict at a glance

| Field | Value |
|---|---|
| Reviewer verdict | **confirmed** |
| Ready for planning | **yes** |
| Worker confidence | 4/5 |
| Reviewer confidence | 5/5 |

## What is broken (user terms)

The week/month toggle is **pure aggregation granularity, not a date-range filter**. The chart needs
**≥2 snapshots spanning ≥2 distinct week/month periods**, but snapshots are seeded **forward-only** and —
critically — the nightly cron snapshots **only the single featured user** (`getEnv().STEAM_ID`); it never
iterates over all users. So **any non-featured user is permanently stuck at one onboarding snapshot** and
sees no data for *both* toggles forever, no matter how many years they've actually played. "Years of play"
lives in Steam's cumulative `playtime_forever`, not in the snapshot time-series the chart requires.

## Confirmed mechanism (reviewer re-checked each)

- ✅ **Toggle is not a date filter.** `getPlaytimeSnapshots` (`server/repositories/snapshots.ts:75-79`)
  is `findMany({ where: { steamId: id }, orderBy: { date: 'asc' } })` — **no date predicate**. The
  `bucket` param only reaches `aggregatePlaytime` via the URL (`app/history/page.tsx:40,44`;
  `components/history/HistoryToggle.tsx:26-28`).
- ✅ **Empty state at `< 2` points.** `app/history/page.tsx:56` renders *"Not enough history yet —
  check back tomorrow … We need at least two days of snapshot data."*
- ✅ **Aggregation needs ≥2 snapshots/period and ≥2 period keys.** `lib/history/aggregate.ts:166-171`
  delta = `MAX − MIN` (one snapshot/period ⇒ 0 minutes); `:176-189` output length = number of distinct
  period keys (one day ⇒ length 1); `:143` returns `[]` for zero rows.
- ✅ **Forward-only seeding, two write sites only.** Onboarding upserts one row per game dated
  `utcDayKey()` (`server/jobs/onboarding-backfill.ts:164-171`); the cron's `runSnapshot` is the only
  other writer (`server/jobs/snapshot.ts:138`). No historical dates are ever written.
- ✅ **Cron snapshots ONLY the featured user.** `server/jobs/snapshot.ts:76`
  `const featuredId = getEnv().STEAM_ID`; no `user.findMany`/loop anywhere in `server/jobs` or
  `app/api/cron`; comment `:69-71` states multi-user is future work.
- ✅ **History page reads the SESSION user's own snapshots in prod.** `app/history/page.tsx:42` →
  `getViewerSteamId()` → `server/auth.ts:281-287` (the `STEAM_ID` fallback is *suppressed in production*
  at `:286-287`). So a non-featured user reads their *own* (one-row) history → permanent empty state.

## Branch RESOLVED — (a) data-model reality, with a structural amplifier

- **Featured user:** "no data" = not enough calendar days elapsed since onboarding to cross ≥2
  week/month boundaries.
- **Any non-featured user:** the cron contributes **zero** of their rows, so they remain at the single
  onboarding day **indefinitely** — an architecture/coverage gap, not a runtime outage.
- **(b) "cron not firing" is NOT the typical cause:** the cron is scheduled (`vercel.json:3-8`) and runs
  when authorized (`app/api/cron/snapshot/route.ts:58-69`). It is only a possibility for the *single
  featured user* if a runtime failure (CRON_SECRET unset → 401; job exception → error `JobRun`)
  suppresses daily writes — deferred to the evidence requests.

## Missed angles flagged by reviewer

- **Dev/prod divergence masks the bug.** In dev/test, `getViewerSteamId` returns `getEnv().STEAM_ID`
  (`auth.ts:286`), so a local dev *always* views the featured user and never sees the non-featured
  breakage — which only manifests in production.
- **Same-week/month onboarding edge:** even for the featured user with a working cron, if onboarding +
  early ticks land in the same ISO week / calendar month, the toggle stays at length 1 until a boundary
  is crossed — so **week and month toggles can flip on at different times** (month can stay empty ~a month).
- **Resync adds no history.** `runOnboardingBackfill(force:true)` re-upserts *today's* row only
  (`onboarding-backfill.ts:166`, immutable day-key) — a user who "tries resyncing" still sees no chart.
- **Zero-rows sub-case:** a user who onboarded as a *private* profile gets `{onboarded:false}` *before*
  any snapshot is seeded (`onboarding-backfill.ts:86-88`) → **zero** rows, not one.

## Reproduction conditions

Any user whose `playtimeSnapshot` rows don't span ≥2 distinct week (ISO) / month (calendar) periods.
**Guaranteed** for (1) recently-onboarded users and (2) **all non-featured users at any age**. Affects
both toggles. Long-tenured Steam accounts are **not** exempt — snapshot coverage is what matters.

## Evidence requests (gated DB/log lane — not run here)

1. **Is the complainant the featured user?** Compare their `steamId` against deployed `STEAM_ID`
   (Vercel → Project Settings → Environment Variables). Equal ⇒ check elapsed days + cron health;
   not equal ⇒ structurally permanent, no runtime check needed.
2. **Per-user coverage:**
   `SELECT "steamId", COUNT(*) rows, COUNT(DISTINCT "date") distinct_days, MIN("date") first_snap, MAX("date") last_snap FROM "PlaytimeSnapshot" GROUP BY "steamId" ORDER BY distinct_days ASC;`
   (`distinct_days < 2` guarantees the empty state).
3. **Does the complainant span ≥2 weeks AND ≥2 months:**
   `SELECT "date" FROM "PlaytimeSnapshot" WHERE "steamId" = '<ID>' ORDER BY "date";`
4. **Cron health (only if featured):**
   `SELECT date_trunc('day', "startedAt") day, status, COUNT(*) FROM "JobRun" WHERE name = 'snapshot' GROUP BY 1,2 ORDER BY 1 DESC LIMIT 30;`
   (day gaps / `status='error'` ⇒ cron not writing).
5. **Vercel Cron Jobs** execution history for `/api/cron/snapshot`: confirm daily 03:00 UTC returns 200
   (not 401 from unset/mismatched `CRON_SECRET` per `route.ts:35`, nor 500). Confirm `CRON_SECRET` is set.

## Suggested fix direction (one line — not implemented)

Make snapshot coverage match the multi-user reality (snapshot all users on the daily cron, not just the
featured `STEAM_ID`) and/or distinguish "no snapshots yet" from "filter returned nothing" in the UI.

## Affected paths

`app/history/page.tsx` · `lib/history/aggregate.ts` · `server/repositories/snapshots.ts` ·
`server/jobs/snapshot.ts` · `server/jobs/onboarding-backfill.ts` · `app/api/cron/snapshot/route.ts` ·
`server/auth.ts` · `vercel.json`
