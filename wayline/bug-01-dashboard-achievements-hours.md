# Bug 01 — Dashboard Achievements KPI shows "—" (Hours render fine)

> Read-only investigation receipt. Worker (opus, low) → adversarial reviewer (opus, xhigh) →
> **disambiguated by user screenshot.**
> **Verdict: `confirmed` · readyForPlanning = `true`** — code-determined wiring bug, no runtime/DB
> evidence needed. The reviewer's "permanent display bug" angle was correct; the original "hours also
> shows —" report was inaccurate.

---

## Verdict at a glance

| Field | Value |
|---|---|
| Reviewer verdict (pre-screenshot) | plausible · readyForPlanning=false |
| **Final verdict (post-screenshot)** | **confirmed** · readyForPlanning=**true** |
| Confidence | 5/5 — code-determined |

## Screenshot evidence (decisive)

User "Cliff" — a fully public profile (67 games · 1,812.2 h · 8 played recently). The KPI row shows:

| KPI | Value |
|---|---|
| HOURS PLAYED | **1,812** ✅ real number |
| GAMES | 67 ✅ |
| PLAYED RECENTLY | 8 ✅ |
| ACHIEVEMENTS | **—** ❌ |

This **refutes** the original report ("Achievements *and* hours played show —"): **hours render fine**.
The only "—" is the **Achievements KPI tile**. The AppHeader/privacy/transient-error theories are moot —
a fully public profile with working hours cannot be the privacy short-circuit case.

## Confirmed root cause (code-determined)

The Achievements KPI tile is **permanently `—` for every user**, regardless of profile privacy or
whether they have achievements, because the value is hardcoded `null` and never wired to the computed result:

1. **`app/page.tsx:133`** passes `achievementPercent={null}` — a literal constant, not derived data.
2. **`components/dashboard/KpiRow.tsx:42-62`** is a **pure server component** (no `"use client"`, no
   state/effects). With `achievementPercent === null` it renders `value="—"` (`:55-59`). There is no
   mechanism — client or server — to ever replace that `null`.
3. The real percentage **is** computed, but by a **different component**:
   `AchievementSummarySection` (`app/page.tsx:153-155`) calls `getAchievementProgress(steamId, appIds)`
   (`components/dashboard/AchievementSummarySection.tsx:26`) and renders the separate `AchievementSummary`
   section lower on the page, inside its own `<Suspense>`. A sibling Suspense child **cannot** update a
   prop already rendered into the `KpiRow` above it.

The page comment (`app/page.tsx:125-128`) calls this the KPI tile's "designed pending state" into which
"the full % streams" — but **nothing streams into the KPI tile**; the deferred work lands in a separate
section. The "pending" state is therefore **permanent**.

## Why the workers' privacy theory was wrong (and the reviewer right)

- The investigator's headline ("Steam profile privacy degrades both Hours and Achievements together")
  was **weakened** by the reviewer on cache grounds, and is now **fully refuted** by the screenshot:
  hours = 1,812 on a public profile.
- The reviewer's **missed-angle #2** named the actual cause: *"the KpiRow Achievements `—` is
  unconditional on first paint and nothing in the code path ever feeds a non-null `achievementPercent`
  back into KpiRow … arguably a permanent display bug for ALL viewers, not a privacy symptom."* ✅

## Reproduction conditions

**Every viewer, always.** Independent of profile privacy, library size, achievement availability, or
cache state. The Achievements KPI tile shows `—` on every dashboard render. (The separate
AchievementSummary section lower on the page does render real progress when data is available — it just
never updates the tile.)

## Evidence requests

**None.** Fully code-determined; no DB/log/Steam check required.

## Suggested fix direction (one line — not implemented)

Wire the computed achievement percentage into the KPI tile — either hoist the deferred aggregate so its
resolved value is passed to `KpiRow`, or give the tile its own streaming boundary that resolves to the
real number — instead of hardcoding `achievementPercent={null}`.

## Affected paths

`app/page.tsx` (:133 the hardcoded `null`; :125-128 the misleading comment; :153-155 the real source) ·
`components/dashboard/KpiRow.tsx` (:42-62, :55-59) ·
`components/dashboard/AchievementSummarySection.tsx` (:26) ·
`components/dashboard/AchievementSummary.tsx` · `server/repositories/achievements.ts`

## Note for planning

The deferred `AchievementSummarySection` still has the *separate*, data-dependent behaviors the original
investigation surfaced (it renders an EmptyState "No achievement data yet" when every game is
unavailable — private game-details or empty top-N `appIds`). That is a distinct, lower-priority concern
from the KPI-tile wiring bug and should be tracked separately if the section ever shows the empty state
for a user who does have achievements.
