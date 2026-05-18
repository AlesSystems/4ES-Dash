---
name: frontend
description: Use when building or modifying anything that ships HTML / CSS / client JS in 4ES-Dash — React components, pages, layouts, Tailwind styling, client-side state, accessibility, loading and error states. Trigger on requests like "build the library grid", "add a filter", "fix this hydration warning", "make this responsive", "write a Storybook story", or any UI implementation work. Enforces the rules in docs/FRONTEND.md (RSC-first, Tailwind tokens, a11y, performance budgets).
---

# Frontend skill

Source of truth: [`docs/FRONTEND.md`](../../../docs/FRONTEND.md), with visual rules from [`docs/DESIGN.md`](../../../docs/DESIGN.md). Read both before implementing.

## Non-negotiables

1. **Server Components by default.** Only `"use client"` when you need state, refs, effects, or browser APIs. If you reach for it, leave a one-line comment explaining why.
2. **Fetch where you render.** Server components call `lib/steam/...` or repositories directly. Client components never `fetch('/api/...')` unless the data has to refresh in-place.
3. **No data fetching in `useEffect`** for first paint — that's what RSC + Suspense are for.
4. **Tailwind tokens only.** No raw hex; no arbitrary `[13px]` unless documented.
5. **Every async boundary gets a skeleton.** Match the final layout's geometry so there's no CLS.
6. **Every interactive control is keyboard-reachable** with a visible focus ring.

## File layout for a new feature

```
app/(dashboard)/<feature>/
  page.tsx           # RSC, async, loads data
  loading.tsx        # skeleton
  error.tsx          # error boundary
  <Feature>Client.tsx  # "use client" — interactive bits only
  components/
    <Bit>.tsx
```

- One component per file. PascalCase filename matches the export.
- Co-locate component + test + story.
- Anything in `lib/` must be safe to bundle (no `process.env` access, no Node-only APIs).

## Definition of done

- [ ] Renders correctly at 360 / 768 / 1280 / 1920 widths
- [ ] Works with keyboard only; focus order is logical
- [ ] No console errors or warnings (including hydration)
- [ ] Has skeleton + error + empty states
- [ ] Storybook story added (for new components)
- [ ] No `any`; no `@ts-ignore` without a linked issue
- [ ] Images via `next/image` with `sizes`
- [ ] Lighthouse Perf/A11y/Best Practices ≥ 90 on the route

## Common pitfalls to avoid

- Importing a server-only module into a client component — Next.js will yell, but the error is cryptic. Keep `server/` strictly server-side.
- Forgetting `revalidatePath` / `revalidateTag` after a mutation — UI stays stale.
- Reaching for global state libraries. Use URL state for filters, RSC props for server state, `useState` for local.
- Long client bundles from a chart library — lazy-load with `next/dynamic` below the fold.
- Decorative animation without `prefers-reduced-motion` fallback.

## When the design isn't fully specified

Don't invent — apply the `design` skill (or ask). Reach for existing components in the inventory before building bespoke.

## What to deliver

When asked to build something, deliver:

1. The minimal set of files (server page, client island, skeleton, error).
2. Inline tests or a Storybook story for any non-trivial component.
3. A note in the PR description if you introduced a new pattern or new dependency.

Don't add features the task didn't ask for.
