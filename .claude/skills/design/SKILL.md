---
name: design
description: Use when designing UI for 4ES-Dash — picking colors, spacing, components, type, motion, or copy tone. Trigger on requests like "design the library page", "what should this empty state look like", "pick a color for the warning state", "review this layout", or any visual / UX decision. The skill enforces the project's design system defined in docs/DESIGN.md and keeps the dashboard feeling calm, dark-first, and information-dense.
---

# Design skill

Source of truth: [`docs/DESIGN.md`](../../../docs/DESIGN.md). Read it before answering — don't re-derive principles from memory.

## How to work

1. **Anchor in principles.** Every decision should ladder back to the five principles in DESIGN.md: content over chrome, calm by default, dense + breathing room, Steam-aware not Steam-imitative, dark-first.
2. **Use tokens, never raw values.** If you need a color, point at `--brand-500` / `--surface` / `--text-2` etc. If a needed token doesn't exist, propose adding it to `app/globals.css` rather than hardcoding hex.
3. **Compose from the inventory.** Before inventing a new component, check the inventory section of DESIGN.md (`Card`, `Stat`, `Kpi`, `GameTile`, `EmptyState`, etc.). New screens are 90% composition.
4. **Specify the four states.** Every interactive surface gets default / hover / focus / disabled, plus loading and empty for data-bearing surfaces.
5. **Mobile-up, dark-first.** Show the dark-mode mockup first; the light-mode pass is a derivative.
6. **Tabular figures for numbers.** Any column or KPI of digits uses `font-variant-numeric: tabular-nums`.

## Default checklist for a new screen

- [ ] Identifies the primary user question the screen answers in one sentence
- [ ] Uses existing tokens (color, spacing, radius) — no raw hex
- [ ] Composes from the component inventory; lists any new components needed
- [ ] Defines empty, loading, and error states alongside the happy path
- [ ] Specifies behavior at 360, 768, 1280 widths
- [ ] Calls out the focus order for keyboard users
- [ ] Notes any motion (duration, easing) and a `prefers-reduced-motion` fallback
- [ ] Hits 4.5:1 contrast for body text, 3:1 for large text + UI

## Voice & copy

- Direct, second-person, no jargon. "You haven't played 178 games" not "178 unplayed titles detected."
- No exclamation marks. Let the number be the celebration.
- Numbers in the headline, sentences for context.

## When in doubt

- Density vs. clarity: clarity wins.
- Color vs. shape: shape wins (color isn't the only signal).
- New component vs. composition: composition wins until it stops working.

## What to deliver

When asked to design something, return:

1. A one-sentence statement of intent.
2. A wireframe-level description of the layout (regions, components, responsive behavior).
3. The tokens and components it uses, named explicitly.
4. The non-happy states (empty / loading / error).
5. Any open questions worth confirming before implementation.

Avoid handing the implementer a pile of pixels with no rationale — the rationale is half the deliverable.
