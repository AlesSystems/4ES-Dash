import { z } from 'zod';
// Import the pure schema module, not the @/lib/steam barrel: the barrel pulls in
// client.ts -> @/server/env (server-only), which must never reach a client bundle.
import { OwnedGameSchema, PlayerSummarySchema } from '@/lib/steam/schemas';

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
