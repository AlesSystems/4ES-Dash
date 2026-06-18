# workstreams/

Per-feature, file-based state for the agentic loop. **Agents are stateless
between calls — so the durable record of what a feature is, how it's built, and
what's done lives here, not in a chat transcript.**

## Why this exists

The loop only works if there's an external, deterministic record of intent and
progress. This folder is that record:

- It separates **who decides intent** (you, the human, in `00-brief.md`) from
  **who plans** (the orchestrator) from **who implements** (the implementer
  agent) from **who judges** (the reviewer agent). That separation is what
  breaks correlated errors.
- It gives every task its own **acceptance criteria** — the unfakeable target
  the gate and the reviewer measure against.
- It tracks status machine-readably in `state.json`, so no task is "done" on an
  agent's say-so.

## Layout of one workstream

Copy `_template/` to `workstreams/<feature-slug>/` to start:

```
workstreams/<feature-slug>/
  00-brief.md        # HUMAN-WRITTEN. Intent, acceptance criteria, non-goals, constraints.
  01-plan.md         # Orchestrator writes from the brief. Approach, sequencing, risks.
  02-architecture.md # Orchestrator writes from the brief. Data shapes, boundaries, files touched.
  03-tasks/          # One .md per independently-verifiable task, each with its own acceptance criteria.
    01-<task>.md
    02-<task>.md
  state.json         # Machine-readable status per task. The source of truth for progress.
```

## Lifecycle

1. **You** write `00-brief.md` — what you want, how you'll know it's done
   (acceptance criteria), what's explicitly out of scope, and any constraints.
   This is the only file the orchestrator should not author.
2. **Orchestrator** turns the brief into `01-plan.md` + `02-architecture.md`,
   then decomposes it into `03-tasks/*.md` — each task small enough to verify on
   its own, with disjoint file sets where possible, and its own acceptance
   criteria. Seeds `state.json` with every task at `"todo"`.
3. **Implementer agent** (sonnet, test-first) takes ONE task, writes failing
   tests for its criteria, implements to green, and sets that task to
   `"in-review"` in `state.json`. It makes no architecture decisions — if a task
   is ambiguous it stops and reports back to the orchestrator.
4. **Reviewer agent** (opus, read-only, separate context) adversarially checks
   the diff against the task's acceptance criteria and runs the tooling. Writes
   `VERDICT: APPROVE | REJECT`. On REJECT, the blockers feed back to step 3.
5. **You** review the PR and merge. **The merge is the only thing that sets a
   task to `"done"`.** No agent marks its own work done.

## state.json contract

```json
{
  "feature": "<feature-slug>",
  "brief": "00-brief.md",
  "updated": "<ISO-8601 date>",
  "tasks": [
    {
      "id": "01",
      "title": "<short title>",
      "file": "03-tasks/01-<task>.md",
      "status": "todo | in-progress | in-review | approved | done | blocked",
      "owner": "implementer | reviewer | human | null",
      "tests": ["tests/unit/<file>.test.ts"],
      "verdict": "approve | reject | null",
      "notes": "<blockers, links, or why blocked>"
    }
  ]
}
```

Status meanings:

| status | who sets it | meaning |
|---|---|---|
| `todo` | orchestrator | decomposed, not started |
| `in-progress` | implementer | actively being built |
| `in-review` | implementer | green locally, awaiting reviewer |
| `approved` | reviewer | reviewer returned APPROVE; awaiting human PR merge |
| `done` | human (PR merge) | merged to `main` — the ONLY way to reach done |
| `blocked` | any | ambiguous task or external blocker; see `notes` |

`_template/` holds a filled-in example so the shape is unambiguous. The example
feature ("recently-played streak") is illustrative only — not a roadmap
commitment.
