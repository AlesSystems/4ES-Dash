import type { Config } from 'tailwindcss';

/**
 * Colors map to CSS variables defined in app/globals.css.
 * Never hardcode hex in JSX — add a token here and a variable there.
 * See docs/DESIGN.md.
 */
const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
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
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      maxWidth: {
        content: '1280px',
      },
    },
  },
  plugins: [],
};

export default config;
