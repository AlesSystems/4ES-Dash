/**
 * next-auth module augmentation.
 *
 * Extends the default Session and JWT types so that TypeScript knows
 * session.user.steamId is a string everywhere in the codebase.
 *
 * See: https://next-auth.js.org/getting-started/typescript#module-augmentation
 * Architecture contract: workstreams/multi-user-auth/02-architecture.md §Task 02
 */

import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  /**
   * The shape of the session object returned by `useSession`, `getSession`, and
   * the `session` callback. `steamId` is the 64-bit SteamID64 as a string.
   */
  interface Session {
    user: {
      steamId: string;
      name?: string | null;
      image?: string | null;
    } & Pick<DefaultSession['user'], 'email'>;
  }
}

declare module 'next-auth/jwt' {
  /**
   * The shape of the JWT stored in the encrypted cookie.
   * `steamId` is set in the `jwt` callback on sign-in and carried forward.
   */
  interface JWT {
    steamId?: string;
  }
}
