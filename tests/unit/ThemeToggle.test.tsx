// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

describe('ThemeToggle (#21)', () => {
  beforeEach(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.clear();
  });
  afterEach(() => localStorage.clear());

  it('renders an accessible toggle button', () => {
    render(<ThemeToggle />);
    expect(screen.getByRole('button', { name: /toggle color theme/i })).toBeInTheDocument();
  });

  it('flips data-theme on <html> and persists the choice', () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: /toggle color theme/i });

    fireEvent.click(button);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('theme')).toBe('light');

    fireEvent.click(button);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('adopts the current data-theme on mount (starts from light)', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button', { name: /toggle color theme/i }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
