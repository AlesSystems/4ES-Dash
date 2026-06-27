# wayline/

Investigation and planning workspace for 4ES‑Dash defect workstreams.

This folder holds the orchestration artifacts for diagnosing and (later) fixing
critical bugs in the deployed (Vercel) 4ES dashboard. It is **documentation only**
— no application code lives here.

## Layout

| File | Purpose |
|---|---|
| `00-investigation-loop.md` | The investigation **loop prompt** — route, contract, per‑bug briefs, the runnable Workflow script, schemas, and stop rules. Phase 1 (Investigate). |
| `bug-0N-*.md` | One investigation report per bug, rendered from the loop's validated structured output. Created when the loop runs. |
| `SUMMARY.md` | Cross‑bug synthesis + planning hand‑off. Created after the loop runs. |

## Phases (one workflow per phase, run in sequence)

1. **Investigate** ← *this artifact* — read‑only root‑cause analysis, adversarially reviewed.
2. **Plan** — fix design per confirmed root cause (future).
3. **Execute** — implement + verify (future, mutating, gated).

The human decision gate between phases is deliberate: each phase is its own
workflow so findings are reviewed before any plan is committed, and any plan is
approved before code changes.
