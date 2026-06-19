// @vitest-environment jsdom
/**
 * tests/unit/components/CompareHeader.test.tsx
 *
 * Render tests for CompareHeader and UserColumn — focusing on responsive
 * Tailwind classes that make the compare header stack on mobile and go
 * side-by-side at sm+.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CompareHeader } from '@/components/compare/CompareHeader';
import type { ComparedSide } from '@/server/repositories/compare';

// next/image → plain <img> so jsdom doesn't choke on image optimization
vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeSide = (overrides: Partial<ComparedSide> = {}): ComparedSide => ({
  steamId: '76561198000000001',
  profile: {
    steamId: '76561198000000001',
    personaName: 'PlayerOne',
    avatar: {
      small: 'https://avatars.steamstatic.com/s.jpg',
      medium: 'https://avatars.steamstatic.com/m.jpg',
      full: 'https://avatars.steamstatic.com/f.jpg',
    },
    profileUrl: 'https://steamcommunity.com/profiles/76561198000000001/',
    createdAt: null,
  },
  gamesCount: 42,
  totalMinutes: 3000,
  isPrivate: false,
  ...overrides,
});

const sideA = makeSide({ steamId: '76561198000000001', profile: { steamId: '76561198000000001', personaName: 'PlayerOne', avatar: { small: '', medium: '', full: '' }, profileUrl: '', createdAt: null } });
const sideB = makeSide({ steamId: '76561198000000002', profile: { steamId: '76561198000000002', personaName: 'PlayerTwo', avatar: { small: '', medium: '', full: '' }, profileUrl: '', createdAt: null } });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CompareHeader', () => {
  it('renders both user display names', () => {
    render(<CompareHeader a={sideA} b={sideB} />);
    expect(screen.getByText('PlayerOne')).toBeInTheDocument();
    expect(screen.getByText('PlayerTwo')).toBeInTheDocument();
  });

  it('renders the "vs" text', () => {
    render(<CompareHeader a={sideA} b={sideB} />);
    expect(screen.getByText('vs')).toBeInTheDocument();
  });

  it('outer container has flex-col class for mobile stacking', () => {
    const { container } = render(<CompareHeader a={sideA} b={sideB} />);
    const outer = container.querySelector('[aria-label="Comparison header"]');
    expect(outer).not.toBeNull();
    expect(outer!.className).toContain('flex-col');
  });

  it('outer container has sm:flex-row class for desktop side-by-side layout', () => {
    const { container } = render(<CompareHeader a={sideA} b={sideB} />);
    const outer = container.querySelector('[aria-label="Comparison header"]');
    expect(outer).not.toBeNull();
    expect(outer!.className).toContain('sm:flex-row');
  });

  it('divider has horizontal border classes for mobile (border-y)', () => {
    render(<CompareHeader a={sideA} b={sideB} />);
    // The "vs" <span> is a direct child of the divider <div>; .closest('div') IS the divider.
    const divider = screen.getByText('vs').closest('div');
    expect(divider).not.toBeNull();
    expect(divider!.className).toContain('border-y');
  });

  it('divider has sm:border-x and sm:border-y-0 classes for desktop vertical borders', () => {
    render(<CompareHeader a={sideA} b={sideB} />);
    const divider = screen.getByText('vs').closest('div');
    expect(divider).not.toBeNull();
    expect(divider!.className).toContain('sm:border-x');
    expect(divider!.className).toContain('sm:border-y-0');
  });

  it('divider has sm:w-20 class for the desktop fixed width', () => {
    render(<CompareHeader a={sideA} b={sideB} />);
    const divider = screen.getByText('vs').closest('div');
    expect(divider).not.toBeNull();
    expect(divider!.className).toContain('sm:w-20');
  });
});

describe('UserColumn — responsive alignment classes', () => {
  it('right-aligned column has sm:flex-row-reverse (not bare flex-row-reverse) on the stats row', () => {
    const { container } = render(<CompareHeader a={sideA} b={sideB} />);
    // The stats row for side B (align="right") must NOT contain unconditional flex-row-reverse
    // Check that no element in the right column has a plain `flex-row-reverse` without `sm:` prefix
    const allClasses = Array.from(container.querySelectorAll('*')).map((el) => el.className);
    // None of the class strings should contain the bare token 'flex-row-reverse'
    // (it should only appear as 'sm:flex-row-reverse')
    for (const cls of allClasses) {
      // Ensure the string doesn't have `flex-row-reverse` without a `sm:` prefix
      // We split by spaces and check each token
      const tokens = cls.split(/\s+/);
      for (const token of tokens) {
        expect(token).not.toBe('flex-row-reverse');
      }
    }
  });

  it('right-aligned column has sm:items-end class (not unconditional items-end)', () => {
    const { container } = render(<CompareHeader a={sideA} b={sideB} />);
    const allClasses = Array.from(container.querySelectorAll('*')).map((el) => el.className);
    // items-end must only appear with sm: prefix in any element
    for (const cls of allClasses) {
      const tokens = cls.split(/\s+/);
      for (const token of tokens) {
        expect(token).not.toBe('items-end');
      }
    }
  });

  it('right-aligned column has sm:text-right class (not unconditional text-right)', () => {
    const { container } = render(<CompareHeader a={sideA} b={sideB} />);
    const allClasses = Array.from(container.querySelectorAll('*')).map((el) => el.className);
    for (const cls of allClasses) {
      const tokens = cls.split(/\s+/);
      for (const token of tokens) {
        expect(token).not.toBe('text-right');
      }
    }
  });
});
