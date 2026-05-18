# Data Model

The persistent state is small and append-friendly. We separate **reference data** (cheap to re-derive from Steam) from **snapshots** (the actual long-term value of the app).

## Entity overview

```
User ──< OwnedGame >── Game ──< Achievement
                │              │
                │              └─< AchievementSnapshot
                └─< PlaytimeSnapshot
```

## Prisma schema (target)

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite" // postgres in prod
  url      = env("DATABASE_URL")
}

model User {
  steamId      String   @id          // 17-digit string, 64-bit Steam ID
  personaName  String
  avatarUrl    String
  countryCode  String?
  createdAt    DateTime
  firstSeenAt  DateTime @default(now())
  lastSyncedAt DateTime @default(now())

  ownedGames           OwnedGame[]
  playtimeSnapshots    PlaytimeSnapshot[]
  achievementSnapshots AchievementSnapshot[]
}

model Game {
  appId        Int      @id
  name         String
  iconUrl      String?
  headerUrl    String?
  releaseDate  DateTime?
  genres       String   // JSON-encoded array; expand to a join if we need to query by genre
  hasStats     Boolean  @default(false)
  refreshedAt  DateTime @default(now())

  owners       OwnedGame[]
  achievements Achievement[]
}

model OwnedGame {
  steamId         String
  appId           Int
  acquiredAt      DateTime?
  playtimeForever Int     // minutes
  playtimeTwoWeeks Int    // minutes, snapshot of "last 2 weeks"
  lastPlayedAt    DateTime?
  refreshedAt     DateTime @default(now())

  user User @relation(fields: [steamId], references: [steamId])
  game Game @relation(fields: [appId],   references: [appId])

  @@id([steamId, appId])
  @@index([steamId, playtimeForever])
}

model Achievement {
  appId       Int
  apiName     String
  displayName String
  description String?
  iconUrl     String?
  iconGrayUrl String?
  globalUnlockPercent Float?

  game Game @relation(fields: [appId], references: [appId])

  @@id([appId, apiName])
}

model PlaytimeSnapshot {
  steamId        String
  appId          Int
  date           DateTime // truncated to day, UTC
  playtimeForever Int     // minutes, monotonic

  user User @relation(fields: [steamId], references: [steamId])

  @@id([steamId, appId, date])
  @@index([steamId, date])
}

model AchievementSnapshot {
  steamId        String
  appId          Int
  date           DateTime
  unlockedCount  Int

  user User @relation(fields: [steamId], references: [steamId])

  @@id([steamId, appId, date])
}

model JobRun {
  id        String   @id @default(cuid())
  name      String
  startedAt DateTime @default(now())
  finishedAt DateTime?
  status    String   // queued | running | ok | error
  error     String?
  payload   String?  // JSON
}
```

## Key decisions

- **`steamId` is a string, not BigInt.** JavaScript's Number can't hold a 64-bit value precisely, and Prisma + SQLite have inconsistent BigInt support across drivers. We always cast to string at every boundary.
- **Snapshots are keyed by day.** Hourly resolution would balloon the table without adding insight; Steam's playtime updates aren't real-time anyway.
- **Playtime is monotonic.** `playtimeForever` should only increase. A decrease indicates a Steam-side correction; the snapshot job logs it and clamps to the previous value.
- **Genres as JSON for now.** A separate `GameGenre` join table is the right move once we filter by genre, but we ship JSON to keep migrations cheap until then.
- **Achievement snapshots store counts only.** Per-achievement timestamps already live on `GetPlayerAchievements`; we re-fetch on demand for the detail view and don't archive them.

## Derived queries

- **Weekly playtime per game**: `SELECT date_trunc('week', date), MAX(playtimeForever) - MIN(playtimeForever) FROM PlaytimeSnapshot WHERE steamId = $1 AND appId = $2 GROUP BY 1`.
- **Backlog**: `SELECT * FROM OwnedGame WHERE playtimeForever = 0 AND steamId = $1 ORDER BY acquiredAt`.
- **Top genres by playtime**: requires the join table; tracked under Phase 4.

## Migration policy

- Migrations are written via `prisma migrate dev` and committed with the PR that needs them.
- Once merged to `main`, migrations are immutable. To fix a mistake, write a follow-up migration.
- Destructive migrations (DROP, type change) require an explicit note in the PR description and a backup step in the deploy runbook.

## Retention

- Snapshots: kept indefinitely (they're the product).
- `JobRun`: trimmed to last 90 days by a weekly cleanup job.

## Privacy

- We store the user's `steamId`, `personaName`, and avatar URL. Nothing else identifies them.
- A user can purge their data by deleting their `User` row; cascades wipe everything tied to that `steamId`.
