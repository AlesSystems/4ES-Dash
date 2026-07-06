# Bug 04 — Settings "Re-sync now" button spins forever

> Read-only investigation receipt. Worker (opus, low) → adversarial reviewer (opus, xhigh).
> **Verdict: `confirmed` · readyForPlanning = `true`** — mechanism code-confirmed end to end, with an
> in-repo precedent (ERR-0011) measuring 64.8s. One unknown remains (the deployment's default timeout).

---

## Verdict at a glance

| Field | Value |
|---|---|
| Reviewer verdict | **confirmed** |
| Ready for planning | **yes** |
| Worker confidence | 5/5 |
| Reviewer confidence | 5/5 |

## What is broken (user terms)

The "Re-sync now" button spins forever because the server action behind it runs an **unbounded,
rate-limited backfill** that exceeds Vercel's serverless function timeout for any non-trivial library.
`resyncNow → resyncAccount → runOnboardingBackfill(force:true)` re-fetches the whole library, loops
per-game (upsert Game/OwnedGame, seed snapshot), then calls `recordAchievementUnlocks` over **every**
achievement-bearing game — each a Steam call paced at **1 req / 250 ms**. **No `maxDuration` is set
anywhere**, so the platform default timeout kills the function mid-run. The client uses `useTransition`
with **no `.catch`** and never observes a result, so `setDone` never runs and the spinner never clears.

## Confirmed mechanism (reviewer re-checked each)

- ✅ **No `maxDuration` anywhere.** grep = zero hits; `vercel.json:1-9` is crons-only; `next.config.mjs:1-22`
  has no function config; `app/settings/actions.ts:67-76` has no try/catch. (Only segment config is
  `dynamic = force-dynamic` in `settings/page.tsx:23`.) ⇒ platform default timeout applies.
- ✅ **Per-game achievement fan-out is uncapped.** `recordAchievementUnlocks` (`server/jobs/snapshot.ts:301-308`)
  iterates **all** `hasAchievements` games with no limit — unlike the count snapshot capped at
  `ACHIEVEMENT_SNAPSHOT_LIMIT = 20` (`snapshot.ts:26,230-233`), proving the unlock pass is intentionally uncapped.
- ✅ **Strict 1 req / 250 ms pacing.** `steamLimiter = TokenBucketLimiter(1, 250)` (`lib/steam/limiter.ts:12,85`),
  acquired before each fetch (`achievements.ts:207,274,312`), wrapped in `withRetry` (250ms/1s/4s backoff,
  `lib/steam/retry.ts:25-64`).
- ✅ **Plus two full-library DB upsert loops** (`onboarding-backfill.ts:121-157`, `164-171`) and the initial
  `getProfile` (`onboarding-backfill.ts:79`).
- ✅ **No client signal on timeout.** `app/settings/ResyncButton.tsx:19-22` awaits `resyncNow()` with no
  try/catch; spinner/disabled bound solely to `isPending` (`:30,33-38`); the "Synced" confirmation is
  gated on `done` (`:40-44`), unreachable if the promise never resolves. **No error UI exists.**
- ✅ **Partial-write risk is real.** No `$transaction` in `onboarding-backfill.ts` (contrast `account.ts:50-61`);
  independent commits at `:99,140,156,166,179,187`. A mid-loop kill leaves a partially-updated library;
  idempotent via upsert + day-key, so a later run reconciles, but `onboardedAt`/completion may not update.

## Strengthened beyond the worker's estimate (reviewer)

- ⚠️ **Cost is understated, not overstated.** Per *available* game ≈ **3 limiter acquires** (~750 ms) —
  `getGameAchievements` acquires at `achievements.ts:207` then `274,312`; unavailable games short-circuit
  to 1 acquire (`:64-66`). So the worker's `N × 250ms` is a **lower bound**.
- ⚠️ **Cold cache is the norm in prod.** `REDIS_URL` unset ⇒ per-instance in-memory cache lost on cold
  start (`server/cache.ts:32`; `DEPLOYMENT.md:19,78`). Single-flight (`cache.ts:36,95-107`) only de-dups
  concurrent misses within one instance — no relief for a fresh resync.
- ✅ **In-repo precedent:** **ERR-0011** (`docs/ERROR.md:289-291`) measured **64.8 s** on a 65-game account
  for the identical 1-req/250ms cold-cache fan-out, exceeding the serverless timeout. `DEPLOYMENT.md:89-94`
  says this fan-out runs for minutes and to raise `maxDuration` — which `resyncNow` never does.
- ⚠️ **Timeout terminology caveat:** `DEPLOYMENT.md:92-93`'s "Hobby 60s / Pro 300s" are the *maximums*
  configurable via `maxDuration`, **not** the unset defaults (~10s Hobby / ~15s Pro). Since `maxDuration`
  is unset, the lower default bites.
- ℹ️ **Not every path hangs:** a private/transient `getProfile` returns `{onboarded:false}` without
  throwing (`onboarding-backfill.ts:86-91`), so the spinner clears — the stuck-forever symptom is
  *specifically* the timeout/kill path. Also `fetchJson` (`achievements.ts:34-37`) uses raw `fetch` with
  no `AbortSignal`, so a slow Steam upstream can stall a single call up to the platform kill.

## Reproduction conditions

Any signed-in user whose library is large enough that the cold-cache per-game achievement fan-out plus
full-library upserts exceed the platform default timeout — i.e. tens of achievement-bearing games and/or
cold caches. Small/warm libraries finish under the timeout and resolve normally.

## Branch RESOLVED (per reviewer)

1. **Effective timeout:** not readable from code (no `maxDuration`) — platform default applies; exact
   value (Hobby ~10s / Pro ~15s) must be read from the Vercel dashboard.
2. **Worst-case cost:** dominated by the uncapped per-game achievement fan-out (≈3 acquires/available
   game) + two DB loops + `getProfile`; ERR-0011's 64.8s is a direct precedent.
3. **Client signal on timeout:** confirmed **none**.
4. **Partial-write risk:** confirmed **real** (no single transaction).

## Evidence requests (gated dashboard/log/DB lane — not run here)

1. **Vercel dashboard:** confirm plan (Hobby vs Pro) and the effective *unset-default* function timeout
   for the settings server-action route. **This is the single remaining unknown.**
2. **Vercel Runtime Logs:** find a `resyncNow` execution ending in *Task timed out* / duration at the plan
   ceiling, with no final `onboardedAt`-update log line.
3. **SQL (read-only):** `SELECT onboardedAt, lastSyncedAt FROM "User" WHERE steamId='<id>';` — fresh
   `lastSyncedAt` + today's *partial* `OwnedGame`/`PlaytimeSnapshot`/`AchievementUnlock` rows is the
   partial-kill fingerprint.
4. **SQL (read-only):** count `OwnedGame` for the user and count games with achievements to quantify N and
   estimate the ~`3 × 250ms`-per-available-game floor.

## Suggested fix direction (one line — not implemented)

Move the heavy backfill off the interactive request path (enqueue/background it) and/or bound + time-box
it, and give `ResyncButton` explicit success/error handling.

## Affected paths

`app/settings/ResyncButton.tsx` · `app/settings/actions.ts` · `server/repositories/account.ts` ·
`server/jobs/onboarding-backfill.ts` · `server/jobs/snapshot.ts` · `lib/steam/limiter.ts` ·
`lib/steam/retry.ts` · `lib/steam/achievements.ts` · `server/cache.ts` · `vercel.json` · `next.config.mjs`

## Related error log

**ERR-0011** (`docs/ERROR.md:289-291`) — 64.8s achievement fan-out exceeding serverless timeout. Direct precedent.
