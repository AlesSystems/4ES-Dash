# Error log

This file is the canonical record of every error discovered in 4ES-Dash — whether found by a developer, a CI run, or an agent. Append a new entry for every bug fixed, every agent-discovered issue, and every notable failure in infrastructure or documentation. **Never delete entries.** IDs are sequential (`ERR-0001`, `ERR-0002`, …). Update the index table whenever you add an entry.

Rules:

- One entry per distinct root cause. If a bug manifests in multiple places, document all affected locations inside a single entry.
- IDs are assigned at the time the entry is written, not at the time the bug occurred.
- Entries are append-only. Close an entry by changing its status; do not rewrite or remove it.
- Agent-discovered issues (e.g. found during a code review or refactor run) are logged here exactly like developer-discovered ones.

---

## Index

| ID | Date | Module | Severity | Title | Status |
|----|------|--------|----------|-------|--------|
| ERR-0001 | 2026-06-14 | docs | Low | docs/ERROR.md not created during bootstrap | Fixed |

**Allowed values**

- **Module** — `steam-client`, `store-client`, `cache`, `db`, `jobs`, `api`, `frontend`, `infra`, `docs`
- **Severity** — `Critical`, `High`, `Medium`, `Low`
- **Status** — `Open`, `Investigating`, `Fixed`, `Won't-fix`

---

## Entry template

Copy this block when adding a new entry. Replace every placeholder including the `ERR-XXXX` ID.

````markdown
### ERR-XXXX — <title>

**Date:** YYYY-MM-DD
**Module:** <module>
**Severity:** <Critical | High | Medium | Low>
**Status:** <Open | Investigating | Fixed | Won't-fix>

**Symptom:** What a developer or user would observe — error message, wrong output, missing behaviour.

**Root cause:** One sentence explaining the underlying cause.

**Fix:** What was changed to resolve the issue, including file paths where relevant.

**Generalized rule:** The broader rule that prevents this class of error across the codebase.

**Where else this assumption may be wrong:** Other modules or files where the same faulty assumption could exist.

**Prevented by:** Process, tooling, or checklist that would have caught this before it reached production.
````

---

## Entries

### ERR-0001 — docs/ERROR.md not created during bootstrap

**Date:** 2026-06-14
**Module:** docs
**Severity:** Low
**Status:** Fixed

**Symptom:** `docs/ERROR.md` did not exist despite CLAUDE.md requiring every error to be appended to it using the `ERR-XXXX` template.

**Root cause:** The error-log file mandated by CLAUDE.md was never created during documentation bootstrap.

**Fix:** Created `docs/ERROR.md` with the full structure (intro, index table, entry template, seed entry) as part of a follow-up documentation pass. No source code was affected.

**Generalized rule:** Any process document or artifact referenced as mandatory by CLAUDE.md must be created during bootstrap, not lazily on first use.

**Where else this assumption may be wrong:**

- `docs/openapi.yaml` is referenced as a future deliverable but does not yet exist; if CLAUDE.md or another doc starts treating it as present, the same gap will occur.
- Any other CLAUDE.md-referenced file that is described in the present tense but not yet on disk (check the doc map in CLAUDE.md against actual directory contents).

**Prevented by:** A bootstrap checklist (or a CI link-check step) that fails if any file listed as mandatory in CLAUDE.md is absent from the repository.

---

## Per-module logs

CLAUDE.md notes that error entries "can be found in each module specifically." `docs/ERROR.md` is the **central, canonical log**. If a module gains its own inline error notes (e.g. a `## Known errors` section in `docs/BACKEND.md`), those notes are a convenience reference only — every entry must still be mirrored here with a full `ERR-XXXX` record. The ID assigned here is the authoritative identifier across all references.
