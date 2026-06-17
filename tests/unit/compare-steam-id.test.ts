import { describe, expect, it } from 'vitest';
import { isValidSteamId } from '@/lib/compare/steam-id';

// ---------------------------------------------------------------------------
// isValidSteamId — SteamID64 is always a string of exactly 17 decimal digits.
// See CLAUDE.md: JS Number cannot hold a 17-digit 64-bit ID precisely.
// ---------------------------------------------------------------------------

describe('isValidSteamId', () => {
  // ---- valid ---------------------------------------------------------------

  it('returns true for a valid 17-digit string', () => {
    expect(isValidSteamId('76561198000000000')).toBe(true);
  });

  it('returns true for another valid SteamID64', () => {
    expect(isValidSteamId('76561197960287930')).toBe(true);
  });

  // ---- wrong length --------------------------------------------------------

  it('returns false for a 16-digit string', () => {
    expect(isValidSteamId('7656119800000000')).toBe(false);
  });

  it('returns false for an 18-digit string', () => {
    expect(isValidSteamId('765611980000000000')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isValidSteamId('')).toBe(false);
  });

  // ---- non-numeric ---------------------------------------------------------

  it('returns false for a string with non-numeric characters', () => {
    expect(isValidSteamId('7656119800000000a')).toBe(false);
  });

  it('returns false for a string with special characters', () => {
    expect(isValidSteamId('7656119800000000!')).toBe(false);
  });

  it('returns false for a string of letters', () => {
    expect(isValidSteamId('aaaaaaaaaaaaaaaaa')).toBe(false);
  });

  // ---- null / undefined ----------------------------------------------------

  it('returns false for null', () => {
    expect(isValidSteamId(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isValidSteamId(undefined)).toBe(false);
  });

  // ---- whitespace ----------------------------------------------------------

  it('trims surrounding whitespace before validating (leading)', () => {
    expect(isValidSteamId('  76561198000000000')).toBe(true);
  });

  it('trims surrounding whitespace before validating (trailing)', () => {
    expect(isValidSteamId('76561198000000000  ')).toBe(true);
  });

  it('trims surrounding whitespace before validating (both sides)', () => {
    expect(isValidSteamId('  76561198000000000  ')).toBe(true);
  });

  it('returns false for whitespace-only string', () => {
    expect(isValidSteamId('   ')).toBe(false);
  });
});
