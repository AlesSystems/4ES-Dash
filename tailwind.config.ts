import type { Config } from 'tailwindcss';
import colors from 'tailwindcss/colors';

/**
 * Colors map to CSS variables defined in app/globals.css.
 * Never hardcode hex in JSX — add a token here and a variable there.
 * See docs/DESIGN.md.
 *
 * The `tremor`/`dark-tremor` tokens + safelist below are required by
 * @tremor/react (the time-series chart, #27). They map Tremor's design tokens
 * onto our warm CSS variables so charts inherit the app theme. The safelist
 * keeps Tremor's dynamically-applied data-series color classes from being
 * purged. See https://npm.tremor.so and docs/FRONTEND.md.
 */
const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './node_modules/@tremor/**/*.{js,ts,jsx,tsx}',
  ],
  safelist: [
    {
      // Tremor applies bg-/text-/border-/ring-/fill-/stroke-<color>-<shade> at
      // runtime for chart series — keep the warm palette we actually use.
      pattern:
        /^(bg|text|border|ring|fill|stroke)-(amber|orange|rose|emerald|sky|violet|stone|slate)-(50|100|200|300|400|500|600|700|800|900|950)$/,
      variants: ['hover', 'ui-selected'],
    },
    ...['fill-amber-500', 'fill-orange-500', 'fill-rose-500', 'fill-emerald-500'],
  ],
  theme: {
    extend: {
      colors: {
        // ── Tremor tokens → warm theme (light) ──────────────────────────────
        tremor: {
          brand: {
            faint: 'var(--surface-2)',
            muted: 'var(--surface-2)',
            subtle: 'var(--brand-500)',
            DEFAULT: 'var(--brand-500)',
            emphasis: 'var(--brand-600)',
            inverted: 'var(--accent-ink)',
          },
          background: {
            muted: 'var(--surface-2)',
            subtle: 'var(--surface-2)',
            DEFAULT: 'var(--surface)',
            emphasis: 'var(--text-2)',
          },
          border: { DEFAULT: 'var(--border)' },
          ring: { DEFAULT: 'var(--border)' },
          content: {
            subtle: 'var(--text-3)',
            DEFAULT: 'var(--text-3)',
            emphasis: 'var(--text-2)',
            strong: 'var(--text-1)',
            inverted: 'var(--accent-ink)',
          },
        },
        'dark-tremor': {
          brand: {
            faint: 'var(--surface-2)',
            muted: 'var(--surface-2)',
            subtle: 'var(--brand-500)',
            DEFAULT: 'var(--brand-500)',
            emphasis: 'var(--brand-600)',
            inverted: 'var(--accent-ink)',
          },
          background: {
            muted: 'var(--surface-2)',
            subtle: 'var(--surface-2)',
            DEFAULT: 'var(--surface)',
            emphasis: 'var(--text-2)',
          },
          border: { DEFAULT: 'var(--border)' },
          ring: { DEFAULT: 'var(--border)' },
          content: {
            subtle: 'var(--text-3)',
            DEFAULT: 'var(--text-3)',
            emphasis: 'var(--text-2)',
            strong: 'var(--text-1)',
            inverted: 'var(--accent-ink)',
          },
        },
        // Tailwind palette used by Tremor chart series (referenced via safelist).
        amber: colors.amber,
        orange: colors.orange,
        rose: colors.rose,
        emerald: colors.emerald,
        brand: {
          500: 'var(--brand-500)',
          600: 'var(--brand-600)',
        },
        accent: {
          2: 'var(--accent-2)',
          ink: 'var(--accent-ink)',
        },
        bg: 'var(--bg)',
        surface: {
          DEFAULT: 'var(--surface)',
          2: 'var(--surface-2)',
        },
        border: {
          DEFAULT: 'var(--border)',
          2: 'var(--border-2)',
        },
        text: {
          1: 'var(--text-1)',
          2: 'var(--text-2)',
          3: 'var(--text-3)',
        },
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        info: 'var(--info)',
        chart: {
          1: 'var(--chart-1)',
          2: 'var(--chart-2)',
          3: 'var(--chart-3)',
          4: 'var(--chart-4)',
          5: 'var(--chart-5)',
          6: 'var(--chart-6)',
          7: 'var(--chart-7)',
          8: 'var(--chart-8)',
        },
      },
      backgroundImage: {
        // Warm two-stop page gradient (the "paper" wash). See app/globals.css.
        grad: 'var(--bg-grad)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        // Editorial display face — Source Serif 4. See docs/DESIGN.md.
        serif: ['var(--font-source-serif)', 'Georgia', 'Cambria', 'serif'],
        mono: ['var(--font-jetbrains-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // Editorial numeral scale (Wrapped). Use font-serif for the big numerals.
        numeral: ['88px', { lineHeight: '76px', letterSpacing: '-0.04em' }],
        'display-lg': ['56px', { lineHeight: '1', letterSpacing: '-0.025em' }],
        'display-md': ['28px', { lineHeight: '1.1', letterSpacing: '-0.01em' }],
        stat: ['22px', { lineHeight: '1', letterSpacing: '-0.02em' }],
        display: ['32px', { lineHeight: '40px' }],
        h1: ['24px', { lineHeight: '32px' }],
        h2: ['20px', { lineHeight: '28px' }],
        h3: ['16px', { lineHeight: '24px' }],
        body: ['14px', { lineHeight: '20px' }],
        caption: ['12px', { lineHeight: '16px' }],
        mono: ['13px', { lineHeight: '20px' }],
        // Tremor type scale (charts, #27).
        'tremor-label': ['0.75rem', { lineHeight: '1rem' }],
        'tremor-default': ['0.875rem', { lineHeight: '1.25rem' }],
        'tremor-title': ['1.125rem', { lineHeight: '1.75rem' }],
        'tremor-metric': ['1.875rem', { lineHeight: '2.25rem' }],
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        // Tremor radius scale.
        'tremor-small': '0.375rem',
        'tremor-default': '0.5rem',
        'tremor-full': '9999px',
      },
      boxShadow: {
        'tremor-input': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'tremor-card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'tremor-dropdown': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      },
      maxWidth: {
        content: '1280px',
      },
    },
  },
  plugins: [],
};

export default config;
