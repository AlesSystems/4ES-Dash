# Investigation Loop — 4ES‑Dash critical bugs (Phase 1: Investigate)

> Orchestrator artifact. Read‑only, adversarially reviewed root‑cause investigation
> of four user‑reported production bugs. This file **is** the loop prompt: it carries
> the route, the contract, the grounded per‑bug briefs, the runnable Workflow script,
> the output schemas, and the stop rules. **Run it from the 4ES‑Dash repo root** — all
> paths are repo‑relative. Launching it is a separate, gated step.

---

## MISSION CONTROL

```text
TASK      Root-cause 4 critical 4ES-Dash production bugs (read-only), each adversarially reviewed
ROUTE     workflow  (Claude Code Workflow tool — pipeline of Explore subagents)
AUTH      Local read-only investigation under existing session authorization.
          MISSING GATE: launching the Workflow (spawns subagents, spends tokens) needs explicit go-ahead.
          OUT OF SCOPE this phase: any code edit, any live Supabase/Vercel mutation, deploy, commit, push.
CONTRACT  loop-admission  (4 items × 2 stages: investigate → adversarial review)
TRUST     filesystem: read repo root only; write only under wayline/ (done post-run by orchestrator)
          network/cloud: NONE — workers must not query live Supabase/Vercel; they emit evidence requests instead
          secrets: none read (no .env values quoted in outputs)
          writes: none by the workflow (Explore agents physically lack Edit/Write)
          cost: 4 low-effort workers + 4 xhigh-effort reviewers, one pass
          acceptance: human reads verdicts; planning phase is a separate workflow
PROOF     Each bug yields a structured FINDINGS object (file:line evidence + falsification tests),
          independently re-checked by a VERDICT object (verdict ∈ confirmed|plausible|refuted|insufficient).
          Deterministic gate: every hypothesis cites a real file:line; reviewer upholds/weakens/refutes each.
STOP      success     — all 4 bugs have a reviewer verdict of confirmed|plausible with readyForPlanning=true
          exhausted   — a bug stays insufficient-evidence after the review pass (needs DB/log evidence lane)
          blocked     — a required file/path is unreadable
RISKS     (1) worker "solves" from a guess → reviewer xhigh refutes uncited claims → re-run that item
          (2) root cause is in DATA not CODE (empty snapshot table, null columns) → workers emit
              evidenceRequests (exact SQL / Vercel log checks); a gated DB lane runs them, not the workflow
          (3) over-reach into fixes → Explore agentType blocks Edit/Write; briefs forbid fix implementation
CONF      5/5 — every bug's mechanism is traced to a confirmed file:line (see "Repo grounding"); the
          data-vs-code split is not a residual unknown but an explicit branch each brief resolves via
          evidenceRequests + adversarial review.
STATUS    proposal-only → needs-approval to launch
```

---

## Why this shape

- **Route = `workflow`.** Four independent bugs, each needing a find→verify chain against a
  checkable signal (does every claim cite real code?). That is exactly the pipeline the Workflow
  tool models. A barrier is *not* needed — each bug's review fires the moment its investigation
  finishes (`pipeline`, not `parallel`).
- **Contract = `loop-admission`.** Repeated work (4×) against an objective scoreboard (cited
  evidence + adversarial verdict) with a budget (one pass) and a hard authority boundary (read‑only).
- **Read‑only enforced, not promised.** Both stages use `agentType: 'Explore'`, so the subagents
  **physically lack Edit/Write**. Investigation cannot drift into fixing.
- **Phase isolation.** This is Phase 1 only. Plan and Execute are separate future workflows so the
  human gate between *diagnosis* and *change* survives.
- **Worker = opus, low effort. Reviewer = opus, xhigh effort.** The briefs ship confirmed mechanisms,
  so a low‑effort worker reliably *verifies + resolves the branch*; the xhigh reviewer is the skeptic.

---

## Loop‑admission rubric (filled)

| # | Answer |
|---|---|
| 1 Outcome | Each bug has a cited, reviewer‑validated root cause + falsification tests, ready for a planning phase. |
| 2 Scoreboard | Every hypothesis cites a real `file:line`; reviewer marks each claim upheld/weakened/refuted and sets a verdict. |
| 3 State boundary | Read the 4ES‑Dash checkout you launch from; write only under `wayline/` (post‑run). |
| 4 Authority | Workers/reviewers may read + reason. No run‑with‑side‑effects, no write, no live DB/deploy. |
| 5 Trust boundary | fs read‑only · network none · no secrets quoted · no writes · one pass · human accepts verdicts. |
| 6 Tools | Read/Grep/Glob/Bash(read‑only) on repo. **Forbidden:** Edit/Write, live Supabase/Vercel calls, `git` mutations. |
| 7 Isolation | None needed (read‑only) — no worktree. |
| 8 Budget | 4 workers (opus, low) + 4 reviewers (opus, xhigh); one pass; re‑run only items that come back `insufficient`. |
| 9 Verifier | The xhigh reviewer per bug; durable receipt = structured output → `wayline/bug-0N-*.md`. |
| 10 Stop | success · exhausted (insufficient after review) · blocked (unreadable path). |
| 11 Human boundary | Choosing the fix, running the DB/log evidence lane, and approving any code change stay human. |

---

## Repo grounding (mechanisms confirmed by direct read — verify + resolve the branch)

Stack: Next.js 14 App Router · Prisma + Postgres (Supabase) · NextAuth + Steam · Tremor charts.
Data is live Steam API per request **plus** daily snapshots (`vercel.json` cron `/api/cron/snapshot` at 03:00).

### Bug 1 — Dashboard: Achievements & hours played show "—"
- **Confirmed:** the literal is em‑dash `—`. Two render sites exist:
  (a) `components/layout/AppHeader.tsx:16` `PLACEHOLDER_VALUE = '—'`, shown when the header's
  profile/level fetch degrades on *any* error; (b) `components/dashboard/KpiRow.tsx` renders
  `value="—"` when `achievementPercent === null`, and `getAchievementProgress`
  (`server/repositories/achievements.ts`) returns `unavailable('no-achievements')` when *every*
  game's `getPlayerAchievements` is unavailable (private profile / no achievements / empty `appIds`).
- **Note that narrows it:** `KpiRow` "Hours played" (`Math.round(min/60)`) and `ProfileStrip`
  `formatHours` *always* return a number — **neither can emit "—"**. So the "hours played → —"
  the user sees is a *different* surface (almost certainly `AppHeader`'s degraded placeholder).
- **Branch to resolve:** which component renders "hours played → —", and what single upstream
  condition makes both it and Achievements degrade together (private profile? swallowed Steam
  rate‑limit/error? empty top‑N `appIds`?).

### Bug 2 — Library: all games show "untouched" despite playtime
- **Confirmed:** "untouched" = `playtime.total === 0` (`lib/games/sort.ts` `filterByStatus`;
  `app/library/page.tsx` `untouchedCount`). `playtime.total` is mapped from Steam `playtime_forever`
  at `lib/steam/client.ts:201` (`total: game.playtime_forever`).
- **Branch to resolve:** does `app/library/page.tsx` → `getProfile`
  (`server/repositories/profile.ts`) read **live Steam** (so all‑zero ⇒ Steam itself returns
  `playtime_forever: 0`, i.e. the user's *game‑details* privacy is not public even when the profile
  is) or **persisted DB** `ownedGame` rows (so a sync wrote 0)? "Some users" strongly fits the
  Steam game‑details‑private case.

### Bug 3 — History: week & month filters show no data despite years of play
- **Confirmed:** the `week|month` toggle is *pure aggregation* — `getPlaytimeSnapshots`
  (`server/repositories/snapshots.ts:73`) filters by `steamId` **only, no date range**. So "no data"
  ⇒ the `playtimeSnapshot` table has < 2 usable points for that user. History is seeded
  **forward‑only**: onboarding seeds *one* snapshot for "today"
  (`server/jobs/onboarding-backfill.ts:160`), then the daily cron adds one/day. Cumulative
  `playtime_forever` cannot reconstruct past per‑period play (delta = `MAX − MIN` needs ≥2 snapshots
  in a period; `lib/history/aggregate.ts`).
- **Branch to resolve:** (a) data‑model reality — a recently onboarded user simply has no history; or
  (b) the cron isn't firing / snapshots aren't being written. EvidenceRequest: count
  `playtimeSnapshot` rows per user over time + verify cron execution in Vercel logs.

### Bug 4 — Settings: Re‑sync button spins forever
- **Confirmed root cause:** **no `maxDuration` is set anywhere** (grep found none) → Vercel's default
  function timeout (~10–15 s) applies. `resyncNow` (`app/settings/actions.ts`, no try/catch) →
  `resyncAccount` (`server/repositories/account.ts:79`) → `runOnboardingBackfill(force:true)`, which
  re‑fetches the whole library and loops **per game**: upsert Game+OwnedGame
  (`server/jobs/onboarding-backfill.ts:121`), seed snapshot (`:164`), and `recordAchievementUnlocks`
  over *all* games (`:179`, rate‑limited Steam calls). The repo's own ERR notes put a real library at
  16–65 s — past the timeout. `ResyncButton`'s `useTransition` holds `isPending` (spinner
  "Re‑syncing…") for the whole run, then the action is killed and rejects with **no UI feedback**
  (`setDone` never runs; no `.catch`).
- **Branch to resolve:** confirm the effective Vercel timeout for this deployment and quantify
  worst‑case backfill cost (the per‑game achievement fan‑out dominates); confirm the client never
  receives a success/error signal.

> Each brief is a strong prior, not a verdict — the worker re‑reads the cited `file:line`, may
> overturn it if the code contradicts, and must resolve the named branch with evidence.

---

## The loop prompt (runnable Workflow script)

Pass this inline to the `Workflow` tool when approved, **from the 4ES‑Dash repo root**. It is also
saved here — edit and relaunch with `{scriptPath}` to iterate.

```javascript
export const meta = {
  name: '4es-bug-investigation',
  description: 'Read-only root-cause investigation of 4 critical 4ES-Dash production bugs, each adversarially reviewed',
  phases: [
    { title: 'Investigate', detail: 'one read-only Explore worker per bug (opus, low effort)', model: 'opus' },
    { title: 'Review', detail: 'adversarial Explore reviewer per bug (opus, xhigh effort)', model: 'opus' },
  ],
}

// Launch this from the 4ES-Dash repo root. All file paths are repo-relative;
// agents resolve them against the current working directory.
const GROUND_RULES = `
You are investigating a bug in the 4ES-Dash app (Next.js 14 App Router · Prisma/Postgres on
Supabase · NextAuth+Steam · Tremor). Repo root = your current working directory (the 4ES-Dash repo).

HARD CONSTRAINTS:
- READ-ONLY. Do not edit, write, or run anything with side effects. You have no Edit/Write.
- Do NOT call live Supabase or Vercel. Do not query the production database or fetch runtime logs.
  If the root cause might live in DATA or RUNTIME (empty tables, null columns, timeouts), do not
  guess it — record the EXACT SQL query or Vercel log check a human should run, in evidenceRequests.
- Do NOT propose or write a fix implementation. suggestedFixDirection is one sentence of DIRECTION only.
- Every hypothesis MUST cite concrete evidence as file:line. Uncited speculation is not a finding.

This brief ships a CONFIRMED mechanism already traced from the code. Your job is NOT to re-derive it
from scratch — it is to: (a) RE-READ each cited file:line and confirm it still says what the brief
claims (overturn the prior if the code contradicts it), and (b) RESOLVE the one explicit BRANCH the
brief names, with cited evidence. Trace the real data flow from the rendered UI value back to source.
`

const BUGS = [
  {
    id: 'bug-01-dashboard-achievements-hours',
    title: 'Dashboard shows "—" for Achievements and Hours Played instead of real numbers',
    seed: `CONFIRMED: the literal is em-dash "—". Two render sites: (a) components/layout/AppHeader.tsx:16
PLACEHOLDER_VALUE = '—', shown when the header profile/level fetch degrades on ANY error; (b)
components/dashboard/KpiRow.tsx renders value="—" when achievementPercent === null, and
getAchievementProgress (server/repositories/achievements.ts) returns unavailable('no-achievements')
when EVERY game's getPlayerAchievements is unavailable (private profile / no achievements / empty
appIds). NARROWING FACT: KpiRow "Hours played" (Math.round) and ProfileStrip formatHours ALWAYS
return a number and CANNOT emit "—" — so "hours played → —" is a different surface (likely
AppHeader's degraded placeholder).`,
    branch: `Localize which component renders "hours played → —" (it is NOT KpiRow/ProfileStrip), and
identify the single upstream condition that degrades BOTH it and Achievements together (private
profile? swallowed Steam rate-limit/error? empty top-N appIds?).`,
    files: [
      'app/page.tsx',
      'components/layout/AppHeader.tsx',
      'components/dashboard/KpiRow.tsx',
      'components/dashboard/ProfileStrip.tsx',
      'components/dashboard/AchievementSummarySection.tsx',
      'server/repositories/achievements.ts',
      'server/repositories/profile.ts',
      'server/repositories/level.ts',
      'lib/steam/achievements.ts',
      'lib/format/playtime.ts',
    ],
  },
  {
    id: 'bug-02-library-untouched-games',
    title: 'Library shows all games as "untouched" even for games the user has played',
    seed: `CONFIRMED: "untouched" = playtime.total === 0 (lib/games/sort.ts filterByStatus;
app/library/page.tsx untouchedCount). playtime.total is mapped from Steam playtime_forever at
lib/steam/client.ts:201 (total: game.playtime_forever). So all-untouched ⇒ playtime_forever is 0 at
the source for those users.`,
    branch: `Does app/library/page.tsx -> getProfile (server/repositories/profile.ts) read LIVE Steam
(client.ts, so all-zero means Steam itself returns playtime_forever:0 — the user's GAME-DETAILS
privacy is not public even if the profile is) or PERSISTED DB ownedGame rows (so a sync wrote 0)?
Trace getProfile's source. "Some users" fits the Steam game-details-private case; confirm with cited
code and name the evidenceRequest to verify (e.g. count ownedGame rows with playtimeForever>0).`,
    files: [
      'app/library/page.tsx',
      'lib/games/sort.ts',
      'lib/steam/client.ts',
      'lib/steam/schemas.ts',
      'server/repositories/profile.ts',
      'server/jobs/onboarding-backfill.ts',
      'prisma/schema.prisma',
    ],
  },
  {
    id: 'bug-03-history-week-month-filters',
    title: 'History page week & month filters show no data despite years of play',
    seed: `CONFIRMED: the week|month toggle is PURE AGGREGATION granularity — getPlaytimeSnapshots
(server/repositories/snapshots.ts:73) filters by steamId ONLY, no date range. So "no data" ⇒ the
playtimeSnapshot table has < 2 usable points for that user. History is seeded FORWARD-ONLY: onboarding
seeds ONE snapshot for "today" (server/jobs/onboarding-backfill.ts:160) and the daily cron
(/api/cron/snapshot, vercel.json 03:00) adds one/day. Cumulative playtime_forever CANNOT reconstruct
past per-period play (lib/history/aggregate.ts delta = MAX-MIN needs >=2 snapshots in a period).`,
    branch: `Distinguish (a) data-model reality — a recently onboarded user simply lacks history — from
(b) the cron not firing / snapshots not being written. Provide the exact SQL to count playtimeSnapshot
rows per user over time and the Vercel cron-execution log check as evidenceRequests.`,
    files: [
      'app/history/page.tsx',
      'lib/history/aggregate.ts',
      'server/repositories/snapshots.ts',
      'server/jobs/snapshot.ts',
      'app/api/cron/snapshot',
      'server/jobs/onboarding-backfill.ts',
      'vercel.json',
    ],
  },
  {
    id: 'bug-04-settings-resync-stuck',
    title: 'Settings "Re-sync now" button spins forever',
    seed: `CONFIRMED ROOT CAUSE: NO maxDuration is set anywhere (grep found none) → Vercel's default
function timeout (~10-15s) applies. resyncNow (app/settings/actions.ts, no try/catch) -> resyncAccount
(server/repositories/account.ts:79) -> runOnboardingBackfill(force:true), which re-fetches the whole
library and loops PER GAME: upsert Game+OwnedGame (onboarding-backfill.ts:121), seed snapshot (:164),
and recordAchievementUnlocks over ALL games (:179, rate-limited Steam calls). The repo's own ERR notes
put a real library at 16-65s — past the timeout. ResyncButton's useTransition holds isPending (spinner
"Re-syncing…") for the whole run, then the action is killed and rejects with NO UI feedback (setDone
never runs; no .catch in app/settings/ResyncButton.tsx).`,
    branch: `Confirm the effective Vercel timeout for this deployment and quantify worst-case backfill
cost (the per-game achievement fan-out dominates). Confirm the client receives no success/error signal
on timeout. Note any partial-write risk if the function dies mid-loop.`,
    files: [
      'app/settings/ResyncButton.tsx',
      'app/settings/actions.ts',
      'server/repositories/account.ts',
      'server/jobs/onboarding-backfill.ts',
      'server/jobs/snapshot.ts',
      'lib/steam/limiter.ts',
      'lib/steam/retry.ts',
      'vercel.json',
      'next.config.mjs',
    ],
  },
]

const FINDINGS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['bugId','summary','dataFlow','rootCauseHypotheses','mostLikelyRootCause',
    'branchResolution','affectedPaths','reproConditions','evidenceRequests','openQuestions','suggestedFixDirection','confidence'],
  properties: {
    bugId: { type: 'string' },
    summary: { type: 'string', description: 'One-paragraph plain statement of what is broken and why, in user terms.' },
    dataFlow: { type: 'array', items: { type: 'string' },
      description: 'Ordered file:symbol trail from the rendered UI value back to its data source.' },
    rootCauseHypotheses: {
      type: 'array', minItems: 1,
      items: {
        type: 'object', additionalProperties: false,
        required: ['hypothesis','evidence','confidence','falsificationTest'],
        properties: {
          hypothesis: { type: 'string' },
          evidence: { type: 'array', items: { type: 'string' }, description: 'file:line references' },
          confidence: { type: 'string', enum: ['low','medium','high'] },
          falsificationTest: { type: 'string', description: 'A concrete check that would prove this hypothesis WRONG.' },
        },
      },
    },
    mostLikelyRootCause: { type: 'string' },
    branchResolution: { type: 'string', description: 'How you resolved the explicit BRANCH named in the brief, with cited evidence (or why it is unresolved without an evidenceRequest).' },
    affectedPaths: { type: 'array', items: { type: 'string' } },
    reproConditions: { type: 'string', description: 'Which users / data shapes trigger it (e.g. private game-details, large library, recent onboarding).' },
    evidenceRequests: { type: 'array', items: { type: 'string' },
      description: 'Exact SQL queries or Vercel log checks a human should run to confirm a data/runtime root cause. Empty if fully code-determined.' },
    openQuestions: { type: 'array', items: { type: 'string' } },
    suggestedFixDirection: { type: 'string', description: 'ONE sentence of direction only — no implementation.' },
    confidence: { type: 'integer', minimum: 1, maximum: 5 },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['bugId','verdict','rootCauseAssessment','challengedClaims','branchVerdict','missedAngles',
    'additionalEvidenceNeeded','readyForPlanning','confidence'],
  properties: {
    bugId: { type: 'string' },
    verdict: { type: 'string', enum: ['confirmed','plausible','refuted','insufficient-evidence'] },
    rootCauseAssessment: { type: 'string' },
    challengedClaims: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['claim','status','reasoning'],
        properties: {
          claim: { type: 'string' },
          status: { type: 'string', enum: ['upheld','weakened','refuted'] },
          reasoning: { type: 'string', description: 'Cite the file:line you independently re-checked.' },
        },
      },
    },
    branchVerdict: { type: 'string', description: 'Is the worker\'s branchResolution correct? Re-check it yourself and state which side of the branch the evidence supports.' },
    missedAngles: { type: 'array', items: { type: 'string' }, description: 'Paths/causes the worker did not check.' },
    additionalEvidenceNeeded: { type: 'array', items: { type: 'string' } },
    readyForPlanning: { type: 'boolean' },
    confidence: { type: 'integer', minimum: 1, maximum: 5 },
  },
}

const investigatePrompt = (bug) => `${GROUND_RULES}

BUG: ${bug.title}
BUG ID: ${bug.id}

CONFIRMED MECHANISM (re-read the cited file:line; overturn only if the code contradicts it):
${bug.seed}

THE BRANCH YOU MUST RESOLVE:
${bug.branch}

START BY READING THESE FILES (then follow the real data flow wherever it leads):
${bug.files.map((f) => `  - ${f}`).join('\n')}

Produce the FINDINGS object. Every hypothesis cites file:line. Fill branchResolution with cited
evidence. If the true root cause is in DATA or RUNTIME, do not guess the values — put the exact
query/log check in evidenceRequests.`

const reviewPrompt = (bug, finding) => `${GROUND_RULES}

You are an ADVERSARIAL reviewer. A worker investigated this bug; your job is to REFUTE weak claims,
not to agree. Independently re-open the cited files and verify each claim yourself. Default to
skepticism: a claim with no real file:line behind it is 'refuted' or 'weakened'. Pay special attention
to the BRANCH — re-check the worker's branchResolution against the actual code and state which side
the evidence supports in branchVerdict.

BUG: ${bug.title}
BUG ID: ${bug.id}

THE BRANCH AT ISSUE:
${bug.branch}

WORKER FINDINGS (JSON):
${JSON.stringify(finding, null, 2)}

Re-check every rootCauseHypothesis and the branchResolution against the real code. Mark each
challenged claim upheld/weakened/refuted with the file:line you verified. List angles the worker
missed (other code paths, edge cases like private game-details / large libraries / sparse snapshots).
Set verdict and readyForPlanning. readyForPlanning=true ONLY if the root cause is cited and either
code-confirmed or reduced to a single named evidenceRequest. Produce the VERDICT object.`

// --- Run: pipeline so each bug's review fires as soon as its investigation completes ---
phase('Investigate')
const results = await pipeline(
  BUGS,
  (bug) => agent(investigatePrompt(bug), {
    label: `investigate:${bug.id}`, phase: 'Investigate',
    agentType: 'Explore', model: 'opus', effort: 'low', schema: FINDINGS_SCHEMA,
  }),
  (finding, bug) => agent(reviewPrompt(bug, finding), {
    label: `review:${bug.id}`, phase: 'Review',
    agentType: 'Explore', model: 'opus', effort: 'xhigh', schema: VERDICT_SCHEMA,
  }).then((verdict) => ({ bugId: bug.id, title: bug.title, finding, verdict })),
)

const clean = results.filter(Boolean)
log(`Investigated ${clean.length}/${BUGS.length} bugs`)
for (const r of clean) {
  log(`${r.bugId}: ${r.verdict?.verdict ?? 'no-verdict'} (readyForPlanning=${r.verdict?.readyForPlanning})`)
}
return clean
```

---

## After the run (orchestrator, with approval)

The workflow is read‑only and returns structured data. Once it returns, the orchestrator renders
the durable receipts into this folder — **no edits to app code**:

- `wayline/bug-01-dashboard-achievements-hours.md`
- `wayline/bug-02-library-untouched-games.md`
- `wayline/bug-03-history-week-month-filters.md`
- `wayline/bug-04-settings-resync-stuck.md`
- `wayline/SUMMARY.md` — verdict table + the consolidated `evidenceRequests` (the DB/log lane to run next).

Any bug returning `insufficient-evidence` ⇒ run its `evidenceRequests` via a separately‑gated
Supabase/Vercel‑logs lane, then re‑review that one item (`resumeFromRunId`).

## Stop states (honest)

- **success** — all 4 bugs `confirmed|plausible`, `readyForPlanning=true`.
- **exhausted** — a bug stays `insufficient-evidence` after review → needs the DB/log evidence lane.
- **blocked** — a required file/path is unreadable.
- Never report exhausted/blocked as success.

## Launch authority

This artifact is **proposal‑only**. Running the Workflow spawns 8 subagents and spends tokens —
that needs the user's explicit go‑ahead. Code changes, the live DB/log lane, deploy, commit, and push
remain outside this phase.
