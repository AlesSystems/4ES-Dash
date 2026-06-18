# Task 08 — add a browser/tab icon (favicon) (#92)

**Status owner:** implementer · **Depends on:** none · **Blocks:** none · **Tier:** 0

## Scope (exactly these files)

- New `app/icon.svg` (primary) reproducing the brand mark — **or** `app/icon.tsx`
  (`ImageResponse`) if a type-checked/generated icon is preferred
- Optional: `app/apple-icon.png` (180×180), `app/opengraph-image.png` (1200×630)
- `app/layout.tsx` — only if choosing explicit `metadata.icons` (not recommended with
  the file convention)
- A `<head>`/asset test (recommended, since `app/icon.svg` escapes the `*.ts(x)` gate)

## Root cause (already traced)

**No favicon exists** — no `app/favicon.ico`, `app/icon.*`, `app/apple-icon.*`, no
`public/`; the root `metadata` in `app/layout.tsx` has no `icons` key. The brand mark
is the app-bar wordmark in `components/layout/AppHeader.tsx`: an **amber dot logo**
(a `brand-500` filled circle with a small centered hole). `metadataBase` is already
set, so file-based icons/OG resolve absolute URLs automatically.

## Acceptance criteria

1. An icon file exists under `app/` (`icon.svg` or `icon.tsx`) and the rendered
   `<head>` includes a `<link rel="icon">` pointing at the generated `/icon…` URL.
2. The favicon reproduces the amber-dot brand mark (filled brand circle with a
   centered hole), using a fixed `#e8a05c` (a static asset can't follow the
   light/dark toggle — one palette).
3. `pnpm build` succeeds; the icon is served (`GET /icon.svg` → 200, correct
   content-type).
4. If SVG: valid standalone SVG with a fixed `viewBox` and no CSS-var color
   dependency.

## Degraded / unavailable-data behavior

N/A — static asset.

## Definition of done for this task

- If `app/icon.tsx`: the gate type-checks it. If `app/icon.svg`: add the head/asset
  test (the gate fires only on `*.ts(x)` edits, so the SVG is otherwise unverified).
- `state.json` task `08` → `in-review`. Reviewer returns APPROVE.
