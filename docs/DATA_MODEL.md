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
  provider      = "prisma-client-js"
  binaryTargets = ["native", "rhel-openssl-3.0.x"] // local/CI + Vercel serverless
}

datasource db {
  provider = "sqlite" // postgres in prod via `db push`; see docs/DEPLOYMENT.md
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
  acquiredAt      DateTime? // ⚠️ NOT returned by GetOwnedGames; inferred from first snapshot only
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

model ManualGameData {
  steamId        String
  appId          Int
  pricePaidCents Int?      // what the user actually paid, in minor units
  currency       String?   // ISO 4217 of pricePaidCents (e.g. "USD")
  acquiredAt     DateTime? // real acquisition date supplied by the user
  importedAt     DateTime  @default(now())

  @@id([steamId, appId])
}

model IdleDismissal {
  steamId     String
  appId       Int
  fromDate    DateTime
  toDate      DateTime
  dismissedAt DateTime @default(now())

  @@id([steamId, appId, fromDate, toDate])
  @@index([steamId, appId])
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
- **`acquiredAt` is inferred, not sourced.** The official Steam Web API (`GetOwnedGames`) does not return when a game was added to the library. `acquiredAt` is populated the first time the game appears in a nightly snapshot run. Games that existed in the library before snapshotting started will have `acquiredAt = null`.
- **`ManualGameData` is separate from `OwnedGame` by design.** User-supplied price-paid and acquisition data (#40) live in their own table so the inferred `OwnedGame.acquiredAt` (first-snapshot date) is never silently overwritten by an import. Cost-per-hour logic prefers the real `pricePaidCents` when present, falling back to current store price. `pricePaidCents` is in minor units (e.g. cents for USD); `currency` is ISO 4217.
- **`IdleDismissal` is keyed by the exact spike window (#37).** The composite PK is `(steamId, appId, fromDate, toDate)`. This means dismissing one idle-detection flag for a specific playtime spike window never suppresses a _different_ spike (different window) on the same game — each new anomaly surfaces independently. The `@@index([steamId, appId])` speeds up the common lookup: "are any dismissals recorded for this game?"

## Derived queries

- **Weekly playtime per game**: `SELECT date_trunc('week', date), MAX(playtimeForever) - MIN(playtimeForever) FROM PlaytimeSnapshot WHERE steamId = $1 AND appId = $2 GROUP BY 1`.
- **Backlog**: `SELECT * FROM OwnedGame WHERE playtimeForever = 0 AND steamId = $1 ORDER BY acquiredAt`.
- **Top genres by playtime**: requires the join table; tracked under Phase 4.

## Migration policy

- Migrations are written via `prisma migrate dev` and committed with the PR that needs them.
- Once merged to `main`, migrations are immutable. To fix a mistake, write a follow-up migration.
- **Phase 4 migration** (`prisma/migrations/20260617101604_phase4_insights/`) added `ManualGameData` and `IdleDismissal`. This migration is immutable.
- Destructive migrations (DROP, type change) require an explicit note in the PR description and a backup step in the deploy runbook.
- **Pinned to Prisma 6.x** (`prisma-client-js` generator). Prisma 7 mandates the new `prisma-client` generator with a required custom output path and driver adapters — deferred to keep the foundation low-risk. See `docs/ERROR.md` (ERR-0004).
- **Committed migrations are SQLite-authored** (dev + CI). Production Postgres is provisioned with `prisma db push` (schema-driven, no migration replay), because a single SQLite migration history cannot replay on Postgres. The schema is kept Postgres-compatible (no SQLite-only types, JSON stored as `String`). See `docs/DEPLOYMENT.md`.

## Retention

- Snapshots: kept indefinitely (they're the product).
- `JobRun`: trimmed to last 90 days by a weekly cleanup job.

## Privacy

- We store the user's `steamId`, `personaName`, and avatar URL. Nothing else identifies them.
- A user can purge their data by deleting their `User` row; cascades wipe everything tied to that `steamId`.
