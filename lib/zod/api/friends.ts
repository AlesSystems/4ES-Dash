import { z } from 'zod';
// Import the pure schema module, not the @/lib/steam barrel: the barrel pulls in
// client.ts -> @/server/env (server-only), which must never reach a client bundle.
import { FriendSummarySchema } from '@/lib/steam/schemas';

/**
 * Zod schema for the GET /api/friends response body.
 */
export const FriendsResponse = z.object({
  friends: z.array(FriendSummarySchema),
});

export type FriendsResponse = z.infer<typeof FriendsResponse>;
