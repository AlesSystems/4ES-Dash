# Design System

The product is a personal dashboard. It should feel calm, fast, and information-dense without being noisy. This document is the source of truth for visual decisions.

## Principles

1. **Content over chrome.** Data is the hero; UI gets out of its way.
2. **Calm by default.** Saturated color is reserved for state and emphasis, not decoration.
3. **Information density with breathing room.** Tight enough to compare at a glance, loose enough to scan.
4. **Steam-aware, not Steam-imitative.** We acknowledge the source (avatars, header art) without copying the storefront aesthetic.
5. **Dark-first.** Most people use this at night.
6. **Editorial warmth ("Wrapped").** The visual system is the warm, year-in-review-flavoured direction from the `docs/design/` handoff bundle: paper-warm surfaces, a single amber/brick accent, and big Source Serif 4 numerals as the headline. Light mode is a designed paper theme, not an inversion.

## Color

Tokens are defined in `app/globals.css` as CSS variables and consumed via Tailwind's `theme.extend`. Values implement the warm "Wrapped" palette (`docs/design/project/wrapped.jsx`). Light = paper-warm (`:root`); dark = warm-ink (`[data-theme='dark']`).

### Brand / accent

| Token             | Light       | Dark        | Use                                |
| ----------------- | ----------- | ----------- | ---------------------------------- |
| `--brand-500`     | `#B8541F`   | `#E8A05C`   | Primary accent (actions, emphasis) |
| `--brand-600`     | `#9C4419`   | `#DB8A40`   | Hover                              |
| `--accent-2`      | `#3E5562`   | `#7E9BA8`   | Secondary accent (slate)           |
| `--accent-ink`    | `#FFF8EB`   | `#1A120A`   | Text/icon on accent fills          |

### Surfaces

| Token             | Light       | Dark        | Use                       |
| ----------------- | ----------- | ----------- | ------------------------- |
| `--bg`            | `#F4EDE1`   | `#141211`   | Page background           |
| `--bg-grad`       | warm 2-stop | warm 2-stop | Page wash (`bg-grad`)     |
| `--surface`       | `#FDF8ED`   | `#1C1816`   | Cards / panels            |
| `--surface-2`     | `#F9F1E1`   | `#221D1A`   | Raised / hover            |
| `--border`        | `#E3D8C4`   | `#2C2622`   | Dividers, card edges      |
| `--border-2`      | `#CDC0A8`   | `#3A322C`   | Stronger / hover borders  |

### Text

| Token             | Light       | Dark        | Use                       |
| ----------------- | ----------- | ----------- | ------------------------- |
| `--text-1`        | `#1F1A14`   | `#F4ECE2`   | Primary                   |
| `--text-2`        | `#5A4F42`   | `#C8BDB0`   | Secondary                 |
| `--text-3`        | `#8C7F6E`   | `#8B8278`   | Tertiary, hints           |

### State

| Token             | Light       | Dark        | Use                       |
| ----------------- | ----------- | ----------- | ------------------------- |
| `--success`       | `#2F7A34`   | `#7FBF7A`   | Achievement unlocked / up |
| `--warning`       | `#B8541F`   | `#E8A05C`   | Backlog warning           |
| `--danger`        | `#A8392C`   | `#E07B6A`   | Errors / down             |
| `--info`          | `--brand-500` | `--brand-500` | Notices                 |

### Charts

A categorical palette of 8 hues (`--chart-1` … `--chart-8`), tuned to the warm palette. (No chart components ship yet — the dashboard's 12-week trend is deferred to a later phase with snapshot history.)

## Typography

- **UI sans**: `Inter` via `next/font`. (The mockup's body face "Söhne" is a paid font; Inter is its documented fallback.)
- **Display / editorial**: `Source Serif 4` via `next/font` (`font-serif`). Used for headlines and the big numerals; italics for accent words in headlines.
- **Mono**: `JetBrains Mono` for numbers in tables (tabular figures) and code.

| Class               | Size / Line   | Use                                  |
| ------------------- | ------------- | ------------------------------------ |
| `text-numeral`      | 88 / 76       | Hero KPI / backlog numerals (serif)  |
| `text-display-lg`   | 56 / 1        | Library page title (serif)           |
| `text-display-md`   | 28 / 1.1      | Profile / section headline (serif)   |
| `text-stat`         | 22 / 1        | Tile hours, inline stat numbers      |
| `text-display`      | 32 / 40       | Hero numbers (legacy)                |
| `text-h1`           | 24 / 32       | Page titles                          |
| `text-h2`           | 20 / 28       | Card titles                          |
| `text-h3`           | 16 / 24       | Section headings / tile titles       |
| `text-body`         | 14 / 20       | Default                              |
| `text-caption`      | 12 / 16       | Labels, metadata                     |
| `text-mono`         | 13 / 20 mono  | Numeric columns                      |

Use tabular-nums (`font-variant-numeric: tabular-nums`) for any column of numbers. The big serif numerals are part of the visual identity — pair `font-serif` + `tabular-nums`.

## Spacing

Stick to the Tailwind default 4 px scale: `0 1 2 3 4 6 8 10 12 16 20 24`. Common patterns:

- Card padding: `p-4` (mobile), `p-6` (desktop)
- Stack gap: `gap-3` between related items, `gap-6` between sections
- Page gutter: `px-4 sm:px-6 lg:px-8`

## Layout

- Max content width `1280 px`, centered.
- 12-column grid on `lg+`, 4-column on `sm`, single-column on `xs`.
- Sticky header, 56 px tall, with a single 1 px bottom border.
- Sidebar (desktop): 240 px, collapsible to 64 px icon-only.

## Radii & elevation

- Radius scale: `sm 4`, `md 8`, `lg 12`, `xl 16`, `full`.
- Cards: `rounded-lg` + `border` + `bg-surface`. No drop shadows by default; we use borders for separation and rely on `surface-2` for hover.
- Modal / popovers: `rounded-xl` + a single soft shadow `shadow-md`.

## Motion

- Easing: `cubic-bezier(0.2, 0, 0, 1)` for entrances, `cubic-bezier(0.4, 0, 0.2, 1)` for transitions.
- Durations: `120 ms` (hover), `200 ms` (open/close), `320 ms` (page transitions).
- Respect `prefers-reduced-motion`: disable non-essential animations entirely.

## Iconography

- `lucide-react` only. 16 px in buttons, 20 px standalone, 24 px in nav.
- Stroke width 1.75. Never mix icon sets.

## Imagery

- Game header art lives at `cdn.akamai.steamstatic.com/.../header.jpg` (460×215). Always render at 2:1 with `next/image` + `object-cover`.
- Avatars: square with `rounded-full`. Use the medium variant in lists, large in headers.
- Fall back to a generated gradient placeholder if Steam returns 404.

## Components inventory

The components below are the design-system primitives. New screens should compose these before reaching for bespoke markup.

- `Card`, `CardHeader`, `CardBody`, `CardFooter`
- `Stat` (label + value + delta)
- `Kpi` (large number with subtitle)
- `Sparkline`, `BarChart`, `LineChart`, `Donut`
- `DataTable` (sortable, virtualized)
- `GameTile` (header art + title + meta)
- `AchievementRow`
- `EmptyState`, `ErrorState`, `LoadingSkeleton`
- `Badge`, `Tag`, `Avatar`, `Tooltip`, `Popover`, `Dialog`
- `Button` (`primary`, `secondary`, `ghost`, `danger`), `IconButton`
- `Input`, `Select`, `Combobox`, `Toggle`, `Checkbox`

## Voice

- Direct, second-person, no jargon. "You haven't played 178 games" beats "178 unplayed titles detected."
- Numbers are the headline; sentences explain.
- No exclamation points. Celebrate with data, not punctuation.

## Accessibility

- Minimum contrast: 4.5:1 for body, 3:1 for large text and UI elements.
- Focus rings are never removed — they use `--brand-500` with a 2 px offset.
- All controls have an accessible name; icon-only buttons get `aria-label`.
- Hit targets ≥ 32 × 32 on desktop, ≥ 44 × 44 on touch.

## Examples / references

- Linear (dark, calm density)
- Steam Year-in-Review (subject-matter tone)
- Vercel dashboard (loading states, empty states)
- Tremor's chart defaults (color, gridlines)

## Process

- New screens start in Figma; share a link in the PR.
- Net-new components require a Storybook story before merge.
- Tokens are the source of truth: if you find yourself writing a hex value, add a token instead.
