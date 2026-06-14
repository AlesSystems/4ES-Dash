# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for 4ES-Dash.

## What is an ADR?

An ADR is a short document that captures a significant architectural decision: what was chosen, why, and what the trade-offs are. It is not documentation of how something works — that lives in `docs/ARCHITECTURE.md`. It is documentation of *why* it was built that way.

## When to write one

Write an ADR when a decision meets one or more of these criteria:

- **Costly to reverse** — changing it later would require touching many files, a data migration, or a redeployment strategy.
- **Affects multiple modules** — the choice constrains how unrelated parts of the codebase are written.
- **A future contributor would ask "why?"** — if you can imagine a new developer opening a PR to undo the decision, write the ADR so they understand the reasoning first.

Decisions that do *not* need an ADR: library version bumps, formatting rules, naming conventions, anything easily changed in a single PR with no downstream impact.

## Format

We use a lightweight [MADR](https://adr.github.io/madr/) variant. Copy `0000-template.md` and fill it in. Keep each section concise — ADRs should be skimmable in two minutes.

## Numbering

Files are named `NNNN-kebab-case-title.md`, zero-padded to four digits, sequential. The next ADR is `0002-...`.

## Statuses

| Status | Meaning |
| --- | --- |
| `Proposed` | Under discussion; not yet binding. |
| `Accepted` | The team agreed; this is the current approach. |
| `Superseded by NNNN` | A later ADR replaced this one. The old ADR is kept for historical context. |
| `Deprecated` | No longer applicable (e.g. the feature was removed), but not replaced by a specific new ADR. |

**Never edit the Decision section of an Accepted ADR in place.** If the decision changes, write a new ADR that supersedes the old one and update the status field in the old ADR to `Superseded by NNNN`.

## Index

| ADR | Title | Status | Date |
| --- | --- | --- | --- |
| [0001](0001-single-nextjs-deployment.md) | Single Next.js deployment, no separate backend | Accepted | 2026-06-14 |
