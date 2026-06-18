# Brief — <feature name>

> **HUMAN-WRITTEN.** This is the only file an agent should not author. Fill in
> every section below before the orchestrator plans. Delete these quote blocks.
> Keep it concrete — the acceptance criteria here become the gate's target.

## Intent

> One or two sentences: what user-facing capability is this, and why now?
> e.g. "Show each game's longest consecutive-day play streak so the dashboard
> rewards habit, not just total hours."

<...>

## Acceptance criteria

> Numbered, testable, behavioral. Each one must be checkable by a test or a
> command — not "looks good". These map 1:1 to tests the implementer writes.

1. <...>
2. <...>
3. <...>

## Non-goals

> What this explicitly does NOT do, so scope can't creep mid-loop.

- <...>

## Constraints

> Data-source limits, performance budget, the relevant docs to honor, anything
> that bounds the design. Reference the project rules that apply.

- Data source / availability: <which Steam endpoint, or "derive from snapshots", or "unavailable → degrade">
- Performance budget: <e.g. route < 200 KB JS gzipped, LCP < 2.5s>
- Must honor: <e.g. docs/STEAM_DATA_SOURCES.md degradation ladder; zod at boundary; RSC by default>
