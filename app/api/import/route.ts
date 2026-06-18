import { withErrorBoundary } from '@/server/api';
import { problemResponse } from '@/server/api/problem';
import { ManualGameImportSchema, parseManualImportCsv } from '@/lib/zod/api/import';
import { importManualGameData } from '@/server/repositories/manual-import';
import { getSessionUser } from '@/server/auth';

export const dynamic = 'force-dynamic';

export const POST = withErrorBoundary(async (request: Request) => {
  // State-changing write: scope to the authenticated session user only. This
  // route is OUTSIDE the middleware matcher (/api/* is excluded), so it must
  // enforce auth itself — an anonymous POST must NOT mutate any account's data.
  const session = await getSessionUser();
  if (!session) {
    return problemResponse({
      type: 'https://4es-dash/errors/unauthorized',
      title: 'Unauthorized',
      status: 401,
      detail: 'You must be signed in to import data.',
      instance: new URL(request.url).pathname,
    });
  }

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

  // Import is scoped to the authenticated user — never the featured/global owner.
  const result = await importManualGameData(session.steamId, validated.rows);
  return Response.json({ imported: result.imported });
});
