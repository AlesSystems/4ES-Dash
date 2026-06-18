# Architecture — multi-user & auth (Phase 6)

> Orchestrator-authored. Defines the contracts and locked decisions so each
> implementer makes zero architecture calls. Where a decision is owned by the
> ADR (Task 01), this doc records the **recommended** stance and marks it
> *ADR-to-confirm*; the implementer of Task 01 finalizes it, and Tasks 02/03
> build against the finalized ADR.

## Data flow (after Phase 6)

```
Request
  → next-auth session (Task 02): { user: { steamId: string } } | null
  → middleware / route guard (Task 05): protected route + no session → redirect /
  → RSC page / route handler
      → getSessionUser()  (Task 02)          ── the viewer
      → resolve target steamId:
          • "my" view      → session.user.steamId
          • public profile → validated /u/<steamId> param
      → authz check (Task 05): viewer may see target's data? (privacy, friendship)
      → server/repositories/* (Task 04: steamId is an explicit arg, no global)
          → cache("steam:<endpoint>:<steamId>[:<appid>]", ttl, loader)
          → lib/steam/* (rate-limited, Zod-parsed)
      → returns data | { available: false, reason: 'private' | ... }
```

First sign-in additionally triggers the **onboarding backfill** (Task 06):
`ISteamUser` summary + `IPlayerService` owned games → upsert reference rows +
initial snapshot via `createMany({ skipDuplicates: true })`, idempotent and
rate-limited.

## Contracts (write these first; consumers build against them)

**Task 02 — session + helper** (`app/api/auth/[...nextauth]/route.ts`, `server/auth.ts`)

```ts
// Session shape — steamId is the 64-bit id as a STRING.
declare module "next-auth" {
  interface Session { user: { steamId: string; name?: string; image?: string } }
}

// Server-side accessor, usable from RSCs, route handlers, and server actions.
// Returns null when unauthenticated — never throws for "no user".
export function getSessionUser(): Promise<{ steamId: string } | null>;
```

**Task 03 — Prisma `User` additions** (extends the existing model, keyed by `steamId`)

```prisma
model User {
  steamId      String   @id            // already the account key
  // ...existing fields (personaName, avatarUrl, createdAt, lastSyncedAt, ...)
  lastLoginAt  DateTime?               // NEW — set on each sign-in
  privacy      Privacy  @default(...)  // NEW — default chosen by the ADR
  onboardedAt  DateTime?               // NEW — null until first backfill completes
  // + next-auth tables (Account/Session/VerificationToken) IF the ADR picks DB sessions
}

enum Privacy { public friendsOnly private }
```

**Task 04 — repository signature rule** (applies to every repo function)

```ts
// BEFORE (global owner — to be removed):
//   const { STEAM_ID } = getEnv();   ...getOwnedGames(STEAM_ID)
// AFTER (explicit, required):
export function getProfile(steamId: string): Promise<...>;
// Blank/missing steamId → typed error (never a silent getEnv().STEAM_ID fallback).
// env.STEAM_ID survives ONLY as the dev/featured-profile default at the call
// site (e.g. the landing/compare default), never inside a repository.
```

**Task 05 — authorization gate** (`server/authz.ts`)

```ts
// Decides whether `viewer` (or anon) may see `target`'s private/derived data.
// Public Steam data is visible to anyone; this gates the private/derived layer.
export function canViewProfile(
  viewerSteamId: string | null,
  target: { steamId: string; privacy: Privacy },
): Promise<boolean>;
// friends-only with an unavailable friends list → false (FAIL CLOSED).
```

## Decisions (locked — not for the implementer to revisit)

- **Steam OpenID only.** Identity = the SteamID returned by the OpenID claimed
  id. No email/password, no other provider. (Brief non-goal; ADR records why.)
- **`steamId` is a string** at every boundary. It is the `User` `@id` and the
  account key. *(CLAUDE.md non-obvious convention.)*
- **OpenID = identity, not data access.** Logging in does **not** unlock another
  user's private Steam data — the Web API still returns only public data. Private
  → `{ available: false, reason: 'private' }`, rendered as a designed locked
  state. *(Issue #59/#62/#63.)*
- **One new immutable migration** (Task 03). Coordinate with #24 per its note so
  the two don't collide; never edit a merged migration.
- **`env.STEAM_ID` is demoted, not deleted.** Optional in `server/env.ts`;
  dev / featured-profile fallback only; never read inside a repository.
- **Cache stays per-steamId.** Keys remain `steam:<endpoint>:<steamId>[:<appid>]`;
  no key is ever built from a global owner id, so users are cache-isolated.
- **Degrade, never throw to the user.** Route handlers stay wrapped by
  `withErrorBoundary` (no extra try/catch unless it yields a *different* error).
- **Friends-only fails closed.** When friendship can't be verified, deny.

### ADR-to-confirm (Task 01 finalizes; recommended stance for the ADR)

- **Session strategy → recommend JWT sessions** (no DB `Session` table). Keeps
  the free/zero-cost DB small and avoids a session-write per request; the
  `steamId` lives in the encrypted JWT. If the ADR chooses DB sessions, Task 03
  adds the next-auth `Account`/`Session`/`VerificationToken` tables instead.
- **Default privacy → recommend `private`** (a new user's history is hidden
  until they opt into sharing). The ADR picks the default; Task 03 sets it as the
  Prisma `@default`.
- **Retention / rate-budget stance** under N users: documented in the ADR
  (snapshot cadence, per-user growth, the shared token bucket); no spend-to-scale.

## Boundary / safety notes the reviewer will check

- Secrets server-only: no `NEXT_PUBLIC_` on `STEAM_API_KEY` / `NEXTAUTH_SECRET`;
  placeholders in `.env.ci` / `.env.test` so build + tests pass with no real
  secrets; MSW with `onUnhandledRequest: 'error'` so no live Steam call leaks.
- No residual `getEnv().STEAM_ID` reads inside `server/repositories/**` after
  Task 04 (grep the diff).
- IDOR: a test must prove user A cannot read user B's private data via the API.
- Client bundles stay clean: `server/auth.ts`, `server/authz.ts`,
  repositories are server-only; auth UI marks `"use client"` only where
  interaction requires it.
- Account deletion (Task 08) removes auth rows + snapshots + reference data with
  no silent orphaned PII; partial failure surfaces a clear error.
