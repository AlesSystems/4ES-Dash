import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1');
  });

  it('lets the last conflicting Tailwind utility win', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('ignores falsy values', () => {
    expect(cn('a', false, undefined, null, 'c')).toBe('a c');
  });
});
