# Frontend Guide

This document is the contract for everything that ships HTML, CSS, or client JS.

## Stack

- Next.js App Router (RSC by default)
- React 18+ with Suspense
- TypeScript, `strict: true`
- Tailwind CSS with a shared token config
- shadcn/ui (Radix primitives) for accessible building blocks
- Tremor for charts and KPI cards
- `next/image` for all imagery
- `lucide-react` for icons

## Rendering rules

1. **Default to Server Components.** Only mark a file `"use client"` when you need state, refs, effects, or browser APIs.
2. **Fetch where you render.** Server components call `lib/steam/...` directly. No client-side `fetch` to our own routes unless the data has to refresh in-place.
3. **No data fetching in `useEffect`** for first paint. Use RSC + Suspense.
4. **Stream**: wrap slow boundaries in `<Suspense>` with a skeleton.

## File conventions

```
app/
  (dashboard)/
    library/
      page.tsx            # RSC, async, fetches data
      LibraryGrid.tsx     # "use client", interactive filters
      loading.tsx         # Suspense fallback
      error.tsx           # error boundary
```

- One component per file. PascalCase filename matches the export.
- Co-locate component, styles, test, and story.
- Server-only helpers go in `server/`; pure helpers in `lib/`. Anything imported by a client component must be safe to bundle.

## Styling

- Tailwind utilities first. Extract a class with `cn(...)` only when it repeats 3+ times or has logical naming value.
- Tokens live in `tailwind.config.ts` and as CSS variables in `app/globals.css`. Never hardcode hex colors in JSX.
- Spacing scale: stick to Tailwind defaults (4 px base). No arbitrary `[13px]` unless absolutely necessary.
- Typography is centralized in `components/ui/typography.tsx`.

## State management

- URL state: filters, sort, pagination → `useSearchParams` + `router.replace`.
- Server state: RSC props + `revalidatePath` / `revalidateTag` on mutations.
- Local UI state: `useState`. Don't reach for Zustand/Redux unless a need actually appears.
- Form state: `react-hook-form` + Zod resolver.

## Accessibility

- Every interactive element must be reachable by keyboard and have a visible focus ring.
- Color is never the only signal — pair it with text or an icon.
- All images have meaningful `alt` text; decorative images use `alt=""`.
- Tooltips never carry information that isn't already in the DOM.
- Run `axe` in dev; the Storybook a11y addon is the second line of defense.
- Target WCAG 2.2 AA.

## Performance

- Budget per route: < 200 KB JS gzipped, LCP < 2.5 s on a Moto G4-equivalent.
- Use `next/dynamic` with `ssr: false` only when the component truly needs the DOM.
- Charts are heavy — lazy-load them below the fold.
- Images: always `next/image`, always with `sizes`.
- Fonts: `next/font` with `display: swap`.

## Loading & error UX

- Every async boundary has a skeleton that matches the final layout's geometry (no layout shift).
- Errors render an inline `ErrorState` with a "Try again" button. No raw stack traces in prod.
- Empty states are designed, not afterthought ("No games found — adjust your filters." + illustration).

## Theming

- Dark mode is the default; light mode is supported. Toggle persists in `localStorage` and respects `prefers-color-scheme` on first load.
- Theme is delivered via `data-theme` on `<html>`; CSS variables switch under it.

## Testing

- Unit: Vitest + `@testing-library/react` for component logic.
- Visual: Storybook stories double as fixtures.
- E2E: Playwright covers the golden paths (`/`, `/library`, `/games/:id`).
- Lint: `eslint-config-next` + `eslint-plugin-jsx-a11y`.

## Definition of done (frontend)

- [ ] Renders correctly at 360, 768, 1280, 1920 widths
- [ ] Works with keyboard only
- [ ] No console errors or warnings
- [ ] Lighthouse Perf/A11y/Best Practices ≥ 90 in CI
- [ ] Storybook story added for new components
- [ ] Skeleton + error state implemented
- [ ] No untyped `any`; no `// @ts-ignore` without a linked issue
