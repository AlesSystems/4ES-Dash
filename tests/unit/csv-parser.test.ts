/**
 * Unit tests for parseManualImportCsv in lib/zod/api/import.ts
 */
import { describe, it, expect } from 'vitest';
import { parseManualImportCsv } from '@/lib/zod/api/import';

describe('parseManualImportCsv', () => {
  it('returns empty array for header-only CSV', () => {
    expect(parseManualImportCsv('appId,pricePaidCents,currency,acquiredAt')).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(parseManualImportCsv('')).toEqual([]);
  });

  it('parses a single row with all fields', () => {
    const csv = 'appId,pricePaidCents,currency,acquiredAt\n730,2499,USD,2021-01-01T00:00:00.000Z';
    const rows = parseManualImportCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      appId: 730,
      pricePaidCents: 2499,
      currency: 'USD',
      acquiredAt: '2021-01-01T00:00:00.000Z',
    });
  });

  it('omits keys with empty values so optional Zod fields work', () => {
    const csv = 'appId,pricePaidCents,currency,acquiredAt\n730,,,';
    const rows = parseManualImportCsv(csv);
    const row = rows[0] as Record<string, unknown>;
    expect(row['appId']).toBe(730);
    expect('pricePaidCents' in row).toBe(false);
    expect('currency' in row).toBe(false);
    expect('acquiredAt' in row).toBe(false);
  });

  it('handles CRLF line endings', () => {
    const csv = 'appId,pricePaidCents,currency,acquiredAt\r\n730,1000,USD,';
    const rows = parseManualImportCsv(csv);
    expect(rows).toHaveLength(1);
    const row = rows[0] as Record<string, unknown>;
    expect(row['appId']).toBe(730);
  });

  it('skips blank lines', () => {
    const csv = 'appId,pricePaidCents,currency,acquiredAt\n730,,,\n\n570,,,';
    const rows = parseManualImportCsv(csv);
    expect(rows).toHaveLength(2);
  });

  it('parses multiple rows', () => {
    const csv =
      'appId,pricePaidCents,currency,acquiredAt\n' +
      '730,2499,USD,\n' +
      '570,0,EUR,2022-05-01T00:00:00.000Z';
    const rows = parseManualImportCsv(csv);
    expect(rows).toHaveLength(2);
    const r0 = rows[0] as Record<string, unknown>;
    const r1 = rows[1] as Record<string, unknown>;
    expect(r0['appId']).toBe(730);
    expect(r1['appId']).toBe(570);
    expect(r1['acquiredAt']).toBe('2022-05-01T00:00:00.000Z');
  });

  it('converts appId and pricePaidCents to numbers', () => {
    const csv = 'appId,pricePaidCents,currency,acquiredAt\n440,999,USD,';
    const rows = parseManualImportCsv(csv);
    const row = rows[0] as Record<string, unknown>;
    expect(typeof row['appId']).toBe('number');
    expect(typeof row['pricePaidCents']).toBe('number');
  });
});
