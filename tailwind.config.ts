import type { Config } from 'tailwindcss';

/**
 * Colors map to CSS variables defined in app/globals.css.
 * Never hardcode hex in JSX — add a token here and a variable there.
 * See docs/DESIGN.md.
 */
const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          500: 'var(--brand-500)',
          600: 'var(--brand-600)',
        },
        bg: 'var(--bg)',
        surface: {
          DEFAULT: 'var(--surface)',
          2: 'var(--surface-2)',
        },
        border: 'var(--border)',
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
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
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
