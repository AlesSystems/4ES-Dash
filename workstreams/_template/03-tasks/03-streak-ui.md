# Task 03 — Game Detail streak UI (EXAMPLE)

**Status owner:** implementer · **Depends on:** Task 02 return type · **Blocks:** none

## Scope (exactly these files)

- `components/game/StreakStat.tsx` (new)
- `tests/unit/StreakStat.test.tsx` (new)
- Wiring into the Game Detail RSC page — confirm the exact path with the
  orchestrator before editing it (it may be a serialized assembly file).

## Acceptance criteria

1. Given `{ available: true, longest, current }`, renders both values with
   clear labels.
2. Given `{ available: false, reason }`, renders the **designed empty state**
   (no thrown error, no fabricated `0`).
3. Stays an RSC — **no `"use client"`** (static stats, no interactivity).
4. Uses Tailwind tokens only; no hardcoded hex. `lucide-react` icon at stroke
   1.75 if any icon is used.
5. No layout shift: the empty state occupies the same geometry as the populated
   state.

## Definition of done

TDD (render tests via the jsdom opt-in); gate green; `state.json` task `03` →
`in-review`; reviewer APPROVE. Update `docs/` if a core route changed.
