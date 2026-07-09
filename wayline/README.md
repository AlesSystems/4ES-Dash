# wayline/

Investigation and planning workspace for 4ES‑Dash defect workstreams.

This folder holds the orchestration artifacts for diagnosing and (later) fixing
critical bugs in the deployed (Vercel) 4ES dashboard. It is **documentation only**
— no application code lives here.

## Layout

| Path | Purpose |
|---|---|
| `SUMMARY.md` | Batch‑1 cross‑bug synthesis + planning hand‑off. |
| `PLAN.md` | Planning artifact for the active batch. |
| `evidence/` | **Batch 2** (bugs 1–5): investigation reports (`reports/`), adversarial verification receipts (`verification/`), and the implementation ship‑readiness receipt. See [evidence/README.md](evidence/README.md). |
| `archive/` | **Batch 1** (bugs 01–04): original investigation reports and fix plans. `SUMMARY.md` links refer to these files. |
| `optimization/` | **Performance workstream** ("app is slow"): scout-phase findings in [optimization/FINDINGS.md](optimization/FINDINGS.md); investigation loop to follow. |

## Phases (one workflow per phase, run in sequence)

1. **Investigate** ← *this artifact* — read‑only root‑cause analysis, adversarially reviewed.
2. **Plan** — fix design per confirmed root cause (future).
3. **Execute** — implement + verify (future, mutating, gated).

The human decision gate between phases is deliberate: each phase is its own
workflow so findings are reviewed before any plan is committed, and any plan is
approved before code changes.
