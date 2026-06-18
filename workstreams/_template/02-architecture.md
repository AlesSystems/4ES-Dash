# Architecture — recently-played streak (EXAMPLE)

> Orchestrator-authored. Illustrative shape only. Defines the contracts so the
> implementer makes zero architecture decisions.

## Data flow

```
Game Detail RSC page
  → server/repositories/streak.ts  (Task 02)
    → server/db.ts  (Prisma: snapshot rows for (steamId, appId), ordered by date)
    → lib/stats/streak.ts          (Task 01, pure)
  → returns { available: true, longest, current } | { available: false, reason }
```

No new Steam API call. No new Prisma table. Reads existing append-only snapshots.

## Contracts (write these first)

**Task 01 — `lib/stats/streak.ts`**

```ts
export interface SnapshotDay {
  date: string;            // ISO yyyy-mm-dd
  playtimeForever: number; // minutes, monotonic
}

export interface StreakResult {
  longest: number; // max consecutive days with an increase
  current: number; // streak ending on the most recent day
}

// Pure. Input MUST be ascending by date. A day counts if playtimeForever >
// previous day's. Equal or missing-prior day does not extend a streak.
export function computeStreak(days: SnapshotDay[]): StreakResult;
```

**Task 02 — `server/repositories/streak.ts`**

```ts
import type { StreakResult } from "@/lib/stats/streak";

export type StreakAvailability =
  | ({ available: true } & StreakResult)
  | { available: false; reason: "no-snapshots" | "single-day" };

export function getGameStreak(steamId: string, appId: number): Promise<StreakAvailability>;
```

## Decisions (locked — not for the implementer to revisit)

- **Missing day = streak break.** Do not interpolate gaps; a skipped cron looks
  like no play. Simpler and honest; matches "degrade, never fabricate".
- **`steamId` is a string** at every boundary (CLAUDE.md).
- **Degrade, don't throw.** < 2 snapshot days → `{ available: false, reason }`,
  rendered as a designed empty state, never an error to the user.

## Boundary / safety notes the reviewer will check

- Task 01 is pure: no imports from `server/`, no I/O — keeps it client-safe and
  trivially testable.
- Task 02 is server-only (`server/`), imports Prisma; must not leak into a
  client bundle.
- Task 03 stays RSC (no `"use client"` — it's static stats).
