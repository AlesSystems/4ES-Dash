/**
 * Dev-only seed: synthesize ~60 days of playtime history so the time-series
 * chart (#27), `sort=added` (#26), and the backlog "oldest unplayed" (#28) are
 * demoable on a fresh database. NOT run in CI (tests create their own rows) and
 * refuses to run in production.
 *
 * Run with: `pnpm prisma db seed`
 *
 * All writes go exclusively to SEED_STEAM_ID — a synthetic placeholder that
 * can never be a real Steam account. process.env.STEAM_ID is intentionally
 * ignored for writes to prevent injecting fake data into a real user's history
 * (see ERR-0012 in docs/ERROR.md).
 */

import { prisma } from '../server/db';
import { SEED_DAYS, SEED_STEAM_ID, buildSeedRows, utcDayKey } from './seed-data';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to seed a production database.');
}

// Guard: warn the developer if their real STEAM_ID is set — their real account
// will NOT be touched; the seed always uses the synthetic SEED_STEAM_ID.
if (process.env.STEAM_ID !== undefined && process.env.STEAM_ID !== SEED_STEAM_ID) {
  console.warn(
    `[seed] WARNING: process.env.STEAM_ID is set to "${process.env.STEAM_ID}" but the seed` +
      ` IGNORES it. All rows are written only under the synthetic SEED_STEAM_ID` +
      ` (${SEED_STEAM_ID}). Your real account will NOT be touched.`,
  );
}

async function main(): Promise<void> {
  await prisma.user.upsert({
    where: { steamId: SEED_STEAM_ID },
    create: {
      steamId: SEED_STEAM_ID,
      personaName: 'Dev User',
      avatarUrl:
        'https://avatars.steamstatic.com/0000000000000000000000000000000000000000_full.jpg',
      createdAt: new Date('2014-01-01T00:00:00.000Z'),
    },
    update: {},
  });

  // Clear prior synthetic history for an idempotent re-seed.
  await prisma.playtimeSnapshot.deleteMany({ where: { steamId: SEED_STEAM_ID } });

  const rows = buildSeedRows(utcDayKey(new Date()));

  await prisma.playtimeSnapshot.createMany({ data: rows });
  console.log(
    `Seeded ${rows.length} playtime snapshots for ${SEED_STEAM_ID} across ${SEED_DAYS} days.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
