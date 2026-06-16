/**
 * Dev-only seed: synthesize ~60 days of playtime history so the time-series
 * chart (#27), `sort=added` (#26), and the backlog "oldest unplayed" (#28) are
 * demoable on a fresh database. NOT run in CI (tests create their own rows) and
 * refuses to run in production.
 *
 * Run with: `pnpm prisma db seed`
 */

import { prisma } from '../server/db';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to seed a production database.');
}

const STEAM_ID = process.env.STEAM_ID ?? '76561190000000000';
const DAYS = 60;

// A handful of synthetic games. `dailyMinutes` drives how fast each accrues
// playtime; `firstDayOffset` staggers when each first appears (so acquiredAt and
// "oldest unplayed" have something to show). A 0-playtime game models the backlog.
const GAMES = [
  { appId: 730, name: 'Counter-Strike 2', dailyMinutes: 45, firstDayOffset: 0 },
  { appId: 570, name: 'Dota 2', dailyMinutes: 30, firstDayOffset: 10 },
  { appId: 440, name: 'Team Fortress 2', dailyMinutes: 12, firstDayOffset: 25 },
  { appId: 292030, name: 'The Witcher 3', dailyMinutes: 20, firstDayOffset: 40 },
  { appId: 1086940, name: "Baldur's Gate 3", dailyMinutes: 0, firstDayOffset: 5 },
];

function utcDayKey(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function main(): Promise<void> {
  await prisma.user.upsert({
    where: { steamId: STEAM_ID },
    create: {
      steamId: STEAM_ID,
      personaName: 'Dev User',
      avatarUrl:
        'https://avatars.steamstatic.com/0000000000000000000000000000000000000000_full.jpg',
      createdAt: new Date('2014-01-01T00:00:00.000Z'),
    },
    update: {},
  });

  // Clear prior synthetic history for an idempotent re-seed.
  await prisma.playtimeSnapshot.deleteMany({ where: { steamId: STEAM_ID } });

  const today = utcDayKey(new Date());
  const rows: Array<{ steamId: string; appId: number; date: Date; playtimeForever: number }> = [];

  for (let dayBack = DAYS - 1; dayBack >= 0; dayBack -= 1) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - dayBack);
    const dayIndex = DAYS - 1 - dayBack; // 0 = oldest, DAYS-1 = today

    for (const game of GAMES) {
      if (dayIndex < game.firstDayOffset) continue; // not yet "acquired"
      const elapsed = dayIndex - game.firstDayOffset;
      rows.push({
        steamId: STEAM_ID,
        appId: game.appId,
        date,
        playtimeForever: elapsed * game.dailyMinutes,
      });
    }
  }

  await prisma.playtimeSnapshot.createMany({ data: rows });
  console.log(`Seeded ${rows.length} playtime snapshots for ${STEAM_ID} across ${DAYS} days.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
