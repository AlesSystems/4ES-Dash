import { describe, expect, it } from 'vitest';
import { formatHours, minutesToHours } from '@/lib/format/playtime';

describe('minutesToHours', () => {
  it('renders zero without a decimal', () => {
    expect(minutesToHours(0)).toBe('0');
  });

  it('renders whole hours without a decimal', () => {
    expect(minutesToHours(60)).toBe('1');
  });

  it('renders fractional hours to one decimal', () => {
    expect(minutesToHours(90)).toBe('1.5');
    expect(minutesToHours(23410)).toBe('390.2');
  });
});

describe('formatHours', () => {
  it('appends the hour suffix', () => {
    expect(formatHours(90)).toBe('1.5 h');
  });
});
