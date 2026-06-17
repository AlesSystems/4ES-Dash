import { withErrorBoundary } from '@/server/api';
import { ManualGameImportSchema, parseManualImportCsv } from '@/lib/zod/api/import';
import { importManualGameData } from '@/server/repositories/manual-import';

export const dynamic = 'force-dynamic';

export const POST = withErrorBoundary(async (request: Request) => {
  const contentType = request.headers.get('content-type') ?? '';

  let rawData: unknown;
  if (contentType.includes('text/csv')) {
    const text = await request.text();
    const parsed = parseManualImportCsv(text);
    rawData = { rows: parsed };
  } else {
    // application/json (default)
    rawData = await request.json();
  }

  // ZodError thrown here → caught by withErrorBoundary → 400
  const validated = ManualGameImportSchema.parse(rawData);

  const result = await importManualGameData(validated.rows);
  return Response.json({ imported: result.imported });
});
