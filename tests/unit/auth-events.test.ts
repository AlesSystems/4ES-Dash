/**
 * tests/unit/auth-events.test.ts
 *
 * Tests the next-auth `events.signIn` handler wired into buildAuthOptions
 * (server/auth.ts). Acceptance (Task 06):
 *   - on sign-in, the User row is upserted with lastLoginAt (lightweight; does
 *     NOT run the full backfill, so it never blocks the auth callback)
 *   - it is resilient: a DB failure is swallowed and never breaks sign-in.
 *
 * Prisma is mocked — no DB I/O.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

const upsert = vi.hoisted(() => vi.fn());
vi.mock('@/server/db', () => ({ prisma: { user: { upsert } } }));

import { buildAuthOptions } from '@/server/auth';

type SignInHandler = NonNullable<NonNullable<ReturnType<typeof buildAuthOptions>['events']>['signIn']>;

function signInHandler(): SignInHandler {
  const opts = buildAuthOptions(new Request('http://localhost:3000/api/auth/callback/steam'));
  const handler = opts.events?.signIn;
  if (!handler) throw new Error('events.signIn not defined');
  return handler;
}

// next-auth's signIn event message is a wide union; the handler only reads
// `user.id`, so a minimal object is sufficient for these tests.
async function call(handler: SignInHandler, userId: string | undefined): Promise<void> {
  await handler({ user: { id: userId } } as unknown as Parameters<SignInHandler>[0]);
}

describe('events.signIn', () => {
  beforeEach(() => {
    upsert.mockReset();
  });

  it('upserts the User row with lastLoginAt on sign-in', async () => {
    upsert.mockResolvedValue({});
    await call(signInHandler(), '76561198000000000');

    expect(upsert).toHaveBeenCalledTimes(1);
    const arg = upsert.mock.calls[0]![0] as {
      where: { steamId: string };
      update: { lastLoginAt: unknown };
      create: { steamId: string; lastLoginAt: unknown };
    };
    expect(arg.where).toEqual({ steamId: '76561198000000000' });
    expect(arg.update.lastLoginAt).toBeInstanceOf(Date);
    expect(arg.create.steamId).toBe('76561198000000000');
    expect(arg.create.lastLoginAt).toBeInstanceOf(Date);
  });

  it('does nothing when there is no steamId on the user', async () => {
    await call(signInHandler(), undefined);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('never throws when the DB write fails — sign-in must not break', async () => {
    upsert.mockRejectedValue(new Error('db down'));
    await expect(call(signInHandler(), '76561198000000000')).resolves.toBeUndefined();
  });
});
