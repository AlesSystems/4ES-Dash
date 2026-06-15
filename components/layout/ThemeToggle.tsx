'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

/**
 * Dark/light theme toggle (#21).
 *
 * Source of truth is the `data-theme` attribute on <html>, which the no-flash
 * inline script in app/layout.tsx sets before first paint from localStorage.
 * This control flips that attribute and persists the choice. Colors come only
 * from CSS-variable tokens, so the whole UI re-themes with the attribute — no
 * per-component logic. The icon is rendered only after mount to avoid an
 * SSR/client hydration mismatch (the server can't know the persisted choice).
 */
export function ThemeToggle(): JSX.Element {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'light' ? 'light' : 'dark');
  }, []);

  function toggle(): void {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('theme', next);
    } catch {
      // Private mode / storage disabled — toggle still applies for this session.
    }
  }

  const isDark = theme !== 'light';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle color theme"
      title="Toggle color theme"
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 text-text-2 transition-colors hover:text-text-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
    >
      {/* Hidden until mounted so server and client first render match. */}
      {theme === null ? (
        <span className="h-[18px] w-[18px]" aria-hidden />
      ) : isDark ? (
        <Sun size={18} strokeWidth={1.75} aria-hidden />
      ) : (
        <Moon size={18} strokeWidth={1.75} aria-hidden />
      )}
    </button>
  );
}
