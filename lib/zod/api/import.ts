import { z } from 'zod';

export const ManualGameImportRowSchema = z.object({
  appId: z.number().int().positive(),
  pricePaidCents: z.number().int().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  acquiredAt: z.string().datetime().optional(), // ISO 8601
});

export const ManualGameImportSchema = z.object({
  rows: z.array(ManualGameImportRowSchema).min(1).max(5000),
});

export type ManualGameImportRow = z.infer<typeof ManualGameImportRowSchema>;

/**
 * Parses a CSV text with headers: appId, pricePaidCents, currency, acquiredAt.
 * Returns raw objects to be Zod-validated by the caller.
 */
export function parseManualImportCsv(text: string): unknown[] {
  const lines = text.split('\n').filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = lines[0]!.split(',').map((h) => h.trim());
  const results: unknown[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i]!.split(',').map((v) => v.trim());
    const row: Record<string, string | number | undefined> = {};

    for (let j = 0; j < headers.length; j++) {
      const header = headers[j]!;
      const val = values[j] ?? '';

      if (val === '') continue; // omit keys with empty values so optional fields work with Zod

      if (header === 'appId') {
        row[header] = Number(val);
      } else if (header === 'pricePaidCents') {
        row[header] = Number(val);
      } else if (header === 'currency') {
        row[header] = val;
      } else if (header === 'acquiredAt') {
        row[header] = val;
      } else {
        row[header] = val;
      }
    }

    results.push(row);
  }

  return results;
}
