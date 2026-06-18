'use server';

/**
 * Server actions for the idle-flag page (issue #37).
 *
 * dismissIdleFlagAction delegates to the repository layer (which handles the
 * actual DB upsert and is unit-tested there) then invalidates the RSC cache for
 * the idle page so the updated flag list re-renders.
 */

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getViewerSteamId } from '@/server/auth';
import { dismissIdleFlag } from '@/server/repositories/insights/idle';

const DismissInputSchema = z.object({
  appId: z.number().int().positive(),
  fromDate: z.string().datetime(),
  toDate: z.string().datetime(),
});

export async function dismissIdleFlagAction(input: {
  appId: number;
  fromDate: string;
  toDate: string;
}): Promise<void> {
  const validated = DismissInputSchema.parse(input);
  const viewerId = await getViewerSteamId();
  await dismissIdleFlag(viewerId, {
    appId: validated.appId,
    fromDate: new Date(validated.fromDate),
    toDate: new Date(validated.toDate),
  });
  revalidatePath('/insights/idle');
}
