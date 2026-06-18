# Plan — deployment & bug fixes (Phase 7)

> Orchestrator-authored from `00-brief.md` (which synthesizes issues #85–#92, plus
> #45 absorbed by #86). Approach, sequencing, and risks. Contracts and the shared
> touch-points live in `02-architecture.md`.

## Approach

Eight tasks map 1:1 to the eight reported items. They are **not** all independent —
three of them touch the same two hot files, which drives the sequencing:

- `server/jobs/snapshot.ts` is touched by **#85** (pre-compute library value off the
  request path), **#91** (record per-achievement unlock events), and **#86** (cron
  auth + optional multi-user iteration).
- `server/cache.ts` is touched by **#85** (single-flight in-flight de-dup) and **#86**
  (optional Redis/Upstash branch).
- `app/compare/page.tsx` is touched by **#88** and **#89** — same root cause, **one
  PR**.

So the plan front-loads the trivially-independent UI fixes, then the correctness
bugs (mostly disjoint), then performance (which lands the snapshot/cache changes the
bugs and the deploy build on), then the deploy itself last so we ship a fixed, fast
app. Where two tasks share a file, the architecture doc names the file a **merge
point** and the tier serializes edits to it.

The two genuinely new bits of schema — a pre-computed library-value aggregate (#85)
and a per-achievement unlock-events table (#91) — are **one new migration each**,
not edits to merged migrations (immutable rule). They also unblock the deploy story:
once aggregation lives in the nightly job, the request path stops fanning out, which
is what makes the app behave on Vercel's cold-per-invocation serverless cache.

## Sequencing (by dependency tier → one PR per tier)

Grouped into PR tiers per the CLAUDE.md orchestration playbook (group by dependency
tier, not one-PR-per-issue; merge each tier to `main` before the next branches off
it). Tasks within a tier have disjoint file sets and can run in parallel.

- **Tier 0 — quick independent UI** (parallel; disjoint)
  - **Task 03 (#87)** — History + Friends in `components/layout/SidebarNav.tsx`.
  - **Task 08 (#92)** — `app/icon.svg` (brand favicon). New file; no shared surface.

- **Tier 1 — correctness bugs** (parallel; near-disjoint)
  - **Task 04 + 05 (#88, #89)** — compare page: wire side A to the session user
    (fixes the "shared games" error **and** the persona name), plus harden the
    null-profile display fallback. **Same PR** — shared root cause, same file.
  - **Task 06 (#90)** — genres onboarding gate (redirect not-yet-onboarded users
    instead of showing the bare empty state).
  - **Task 07 (#91)** — Year-in-Review achievements by `unlockedAt`. *Touches
    `server/jobs/snapshot.ts` (achievement unlock events) — coordinate with #85.*

- **Tier 2 — performance** (Task 01, #85)
  - **Task 01 (#85)** — move library-value aggregation into the nightly job, add
    Suspense boundaries, a dedicated Store limiter, and cache single-flight. *Lands
    the `snapshot.ts` and `cache.ts` changes the deploy build on; serialize
    `snapshot.ts` with #91 and `cache.ts` with #86.*

- **Tier 3 — deployment** (Task 02, #86, absorbs #45)
  - **Task 02 (#86)** — Postgres provider + `db push` provisioning, `vercel.json`
    cron, cron-auth Bearer path + GET, env/callback wiring, optional Upstash cache,
    Deploy button + docs. Ships the fixed, fast app.

Dependency graph (also encoded in each task's "Depends on / Blocks" header):

```
Tier 0:  03(sidebar)   08(favicon)        ── independent, ship first
Tier 1:  04+05(compare)  06(genres)  07(YiR achievements)
                                            │ (snapshot.ts)
Tier 2:  01(dashboard perf) ─────────────── ┤ (snapshot.ts + cache.ts merge point)
                                            │
Tier 3:  02(vercel deploy) ──────────────── ┘ (cron/snapshot + cache + prisma)
```

## Risks / unknowns

- **`server/jobs/snapshot.ts` is a 3-way merge point** (#85, #91, #86). A missed
  coordination silently breaks nightly snapshots. Sequence #91 → #85 → #86 and have
  the reviewer diff the cumulative `snapshot.ts` against all three tasks' criteria.
- **SQLite → Postgres is the highest-risk move** (#86). `db push` drops Prisma's
  migration safety net; the schema must be proven Postgres-safe (the `Privacy` enum,
  `genres String` JSON-as-text, `Int @id` autoincrement, `DateTime` defaults). Dev
  (SQLite) / prod (Postgres) drift is a standing hazard — CI should exercise a
  throwaway Postgres.
- **Cron-auth mismatch fails silently** (#86). Vercel Cron sends
  `Authorization: Bearer` via GET; the route only knows `x-cron-secret`/POST.
  Shipping without the Bearer+GET path means the snapshot never runs and no error
  surfaces — manual `x-cron-secret` calls still pass, so it's easy to miss.
- **Rate-limiter fan-out is the through-line** of #85, #90, and #91. Every fix must
  keep the per-game Store/achievement fan-out **off the request path** (nightly job
  or behind Suspense). "Fix" a bug by adding a synchronous library-wide fan-out and
  you've created the #85 problem somewhere new — reviewers must reject that.
- **Compare is a public route** (#88/#89). `getViewerSteamId()` must degrade for
  anonymous visitors (no thrown `MissingSteamIdError`); decide explicitly whether
  anonymous `/compare` requires both `?a=` and `?b=`.
- **Config hygiene vs. test fixtures** (#88). Blanking the placeholder `STEAM_ID` in
  `.env.test`/`.env.ci` may break tests/jobs/seed that rely on it as a featured
  fallback — audit before changing.
- **The favicon escapes the test gate** (#92). `app/icon.svg` is not `*.ts(x)`, so
  the PostToolUse gate won't verify it; use `app/icon.tsx` or add a head/asset test
  if gated coverage is wanted.

## Out of scope (from brief non-goals)

- Data-model rewrites beyond the #85 aggregate and #91 unlock-events shapes.
- Paid infra; enrichment stays opt-in/off by default.
- Consolidating `NavLinks` + `SidebarNav` into one source (noted follow-up).
- Multi-user cron scale-out beyond a correct deploy; no spend-to-scale.
- New features.
