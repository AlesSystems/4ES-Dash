import { z } from 'zod';
import { OwnedGameSchema, PlayerSummarySchema } from '@/lib/steam';

/**
 * Zod schema for the GET /api/profile response body.
 * Composes the Steam domain schemas — no extra fields in Phase 0.
 * `level` is added in Phase 1 (requires GetSteamLevel).
 */
export const ProfileResponse = z.object({
  profile: PlayerSummarySchema,
  games: z.array(OwnedGameSchema),
});

export type ProfileResponse = z.infer<typeof ProfileResponse>;
