# wayline/evidence/

Artifacts for **bug batch 2** (bugs 1–5), organized by phase. Batch 1 lives in
[../archive/](../archive/). Documentation only — no application code.

## Layout

| Path | Phase | Contents |
|---|---|---|
| [reports/](reports/) | Investigation | One wayline report per bug (`bug-N-*.md`) — symptom, root cause, fix direction. Reports cross-link each other. |
| [verification/](verification/) | Verification (read-only, adversarial) | Per-bug evidence receipts (`bug-N-*.evidence.md`) + [SUMMARY.evidence.md](verification/SUMMARY.evidence.md) cross-bug synthesis. Run `wf_d8d169b9-378`. |
| [IMPLEMENTATION.md](IMPLEMENTATION.md) | Implementation | Ship-readiness receipt for the test-first implementation loop (run `wf_2e75ce84-1bf`). Local commits only; merge/deploy human-gated. |

## Status at a glance

- 5/5 bugs root-caused and reviewer-approved.
- 4/5 ready for planning; **bug-4** held for the human live-evidence lane (`needs-live-evidence`).
- Implementation receipts exist per bug; nothing merged, pushed, deployed, or migrated.
