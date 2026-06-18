# 0002. Multi-tenant authentication with Steam OpenID

**Status:** Accepted

**Date:** 2026-06-18

## Context

4ES-Dash was originally a **single-owner** dashboard: one hard-coded `STEAM_ID`
environment variable identified "the user", all repository queries were scoped to
it, and no authentication was required. Phase 6 converts it to a **multi-tenant**
app where any Steam account holder can sign in, own their own data, and control who
can see their profile.

Several decisions must be locked before any implementation begins, because they
constrain the Prisma schema, the session surface, the repository signatures, and
the route-guard logic simultaneously. This ADR is the binding source of truth that
Tasks 02–09 build against.

Cross-links:
- Threat model and secret-handling rules → [`docs/SECURITY.md`](../SECURITY.md)
- System overview and data-flow diagram → [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md)
- Steam data-availability ladder and degradation strategy → [`docs/STEAM_DATA_SOURCES.md`](../STEAM_DATA_SOURCES.md)

### Constraints in scope

- **Free/zero-cost constraint.** No spend-to-scale; every design choice must
  operate within free tiers of Vercel, PlanetScale/Neon (or SQLite locally), and
  Redis Cloud's free tier.
- **Steam API is public-read only.** The Steam Web API authenticates the
  *server* (via `STEAM_API_KEY`), not the end-user. Logging in with Steam OpenID
  establishes identity; it does **not** grant access to any Steam data that was not
  already publicly readable. A user's private Steam profile stays inaccessible
  regardless of who is signed in.
- **`steamId` is a string.** Steam's 64-bit SteamID64 exceeds `Number.MAX_SAFE_INTEGER`;
  it is a 17-character decimal string at every codebase boundary.

## Decision

### 1. Identity provider — Steam OpenID only

We use Steam OpenID 2.0 (via next-auth / Auth.js) as the **sole** authentication
mechanism. No email+password flow, no magic-link flow, and no anonymous "profile
viewer" mode are supported.

The SteamID returned by the OpenID `claimed_id` (`https://steamcommunity.com/openid/id/<steamId>`)
is the account key. It maps directly to the `User` table's `@id` field.

### 2. Session strategy — JWT sessions (no DB Session table)

We use **stateless JWT sessions** managed by next-auth. The encrypted JWT stores
`{ steamId, name, image }` and is read on every request with no database round-trip.
The next-auth `Account`, `Session`, and `VerificationToken` tables are **not**
added to the Prisma schema.

Rationale under the free/zero-cost constraint:

- Eliminating a `Session` table removes one write per request, which on a free-tier
  database can exhaust connection-pooling and storage limits much faster than the
  actual application data.
- The DB grows with *user data* (snapshots, reference rows), not with session
  bookkeeping. For N users, each active session is just a signed cookie — zero DB
  rows.
- Token invalidation is handled by rotating `NEXTAUTH_SECRET`; forced sign-out of
  a specific account is handled at the application layer (e.g., on account
  deletion) by clearing the session cookie.

**Task 03 must NOT add next-auth `Account`/`Session`/`VerificationToken` tables.**
The `@default` for `privacy` (see §4 below) is the only schema addition beyond the
three new `User` columns (`lastLoginAt`, `privacy`, `onboardedAt`).

### 3. Identity model — SteamID as account key

The `User` table (already present) is keyed by `steamId: String @id`. It is the
only source-of-truth record for an authenticated account. No numeric surrogate key,
no email column, no password hash.

On first sign-in, next-auth's `signIn` callback receives the `claimed_id`, extracts
the SteamID string, and upserts the `User` row. Subsequent sign-ins update
`lastLoginAt` only.

### 4. Default privacy level — `private`

A newly created account defaults to `privacy: private`. The user's dashboard is
hidden from all other visitors until they explicitly change the setting in Account
Settings (`public` or `friendsOnly`).

Rationale: a new user should never accidentally expose their gaming history. Opt-in
sharing is the safer default, consistent with GDPR's data-minimization principle.

**Task 03 must set `privacy Privacy @default(private)` in the Prisma schema.**

### 5. OpenID establishes identity, not data access

Authenticating with Steam OpenID does **not** grant the server any additional
Steam API access beyond what the `STEAM_API_KEY` already provides. The Steam Web
API returns *public data* for *public profiles* regardless of who is signed in.

Consequences for the data layer:

- A user with a **private** Steam profile will see a designed locked state:
  `{ available: false, reason: 'private' }`. This is never a thrown error, never a
  fabricated zero, never silently coerced. See the full degradation ladder in
  [`docs/STEAM_DATA_SOURCES.md`](../STEAM_DATA_SOURCES.md).
- A user with a **friends-only** Steam profile may see partial data for the
  sections that only the profile owner can access; the app fails closed (treats it
  as private) when the friends-list itself is unavailable.
- The signed-in user does **not** receive extra data about *other users'* private
  profiles.

### 6. Per-user data isolation

Every repository function, RSC page, and route handler receives `steamId` as an
**explicit parameter**. There is no global "current user" singleton inside the data
layer.

- `env.STEAM_ID` is **demoted, not deleted.** It becomes an optional environment
  variable used only as a dev/featured-profile fallback at the call site (e.g., the
  public landing page may feature a pre-seeded profile). It is never read inside
  `server/repositories/**`.
- Cache keys remain `steam:<endpoint>:<steamId>[:<appid>]` — scoped per SteamID,
  so two concurrent users never share a cache entry.
- A blank or missing `steamId` argument is a **typed error** at the repository
  boundary; it never silently falls back to `env.STEAM_ID`.

### 7. Free/zero-cost retention and rate-budget stance

**DB growth per user.** Each new user adds:

- 1 `User` row (reference).
- N `PlaytimeSnapshot` rows/day (one per owned game per day the cron runs).
- M `AchievementSnapshot` rows/day (one per completed achievement per game).

At typical library sizes (200–500 games), the daily snapshot growth is several
thousand rows per active user. The free-tier DB limit (~500 MB on Neon free tier)
is the binding constraint; a self-hosted operator with many users should budget
Postgres storage accordingly.

**Shared token bucket across N users.** The existing rate limiter enforces
1 req/250 ms project-wide. Multi-user use does not bypass or relax this limit.

- First-login backfill (Task 06) must page its Steam calls through the same
  rate-limited `lib/steam/` client; it may not open a parallel channel or spawn
  concurrent requests.
- Cron snapshot jobs continue to process one user at a time with normal
  rate-limit respect; they become sequential over multiple SteamIDs.

**No spend-to-scale.** If the free-tier limits are reached, the operator's options
are: reduce snapshot frequency, prune old snapshots, or upgrade their own hosting.
No paid managed service is introduced by Phase 6.

## Consequences

### Positive

- No DB session table means zero extra writes per authenticated request; the free
  Neon/PlanetScale row budget is not consumed by session bookkeeping.
- Steam OpenID is the only identity path users of a Steam-stats app would expect;
  no credential management or email-verification flow to build or secure.
- `steamId` already keys the `User` table, so no surrogate-key migration or foreign
  key rewiring is needed.
- Per-request SteamID isolation means two authenticated users can never observe
  each other's derived data; the cache namespace guarantees it by construction.
- `private` default minimizes accidental data exposure for new sign-ups.

### Negative

- JWT sessions cannot be revoked per-session (e.g., "sign out all devices") without
  rotating `NEXTAUTH_SECRET`, which signs out *all* users. Forced individual-account
  sign-out is only possible by clearing the client cookie.
- The shared 1 req/250 ms token bucket means a first-login backfill for a user with
  a 500-game library takes ~125 seconds of Steam API time. Backfills must run
  asynchronously and not block the sign-in response.
- DB growth scales linearly with active users × library size × snapshot frequency.
  Operators running many users on a free-tier DB will hit storage limits and must
  prune or upgrade.
- A user whose Steam profile is private cannot use most dashboard features; the app
  cannot prompt them to change their Steam privacy setting on their behalf.

### Neutral

- `env.STEAM_ID` is retained as an optional env var (dev/featured-profile fallback)
  to avoid a breaking change for existing self-hosted operators. Documentation must
  make clear it is no longer "the user."
- next-auth's Steam OpenID provider is maintained by the community, not Valve; any
  upstream Steam OpenID endpoint change would require a next-auth update.
- The JWT payload stores only `steamId`, `name`, and `image` — enough for the UI
  but not for server-side authorization checks that need `privacy`. Those checks
  must load the `User` row from the DB (one read, cacheable).

## Alternatives considered

| Alternative | Why not chosen |
| --- | --- |
| Email + password (+ Steam account link) | Requires credential storage, password hashing, reset flows, and email delivery infrastructure — all outside the free/zero-cost constraint and beyond the scope of a Steam-stats app. No Steam user expects this path. |
| Magic-link / passwordless email | Still requires an email delivery service (SMTP or SES); adds a new user attribute (email) that Steam does not provide and that users may not want to share. Complexity not justified for the user population. |
| No-login "public profile viewer" as the primary access model | Single-owner model is the status quo; abandoning auth entirely means no privacy controls, no per-user snapshots, and no account deletion. Phase 6's goal is multi-tenancy, not just public browsing. |
| DB sessions (next-auth `Session` table) | Every authenticated request would write/read the session table. Under the free-tier DB constraint and with N concurrent users, this adds contention and storage costs. JWT sessions deliver the same UX with zero DB overhead per request. |
| OAuth2 / OIDC with another provider (Google, GitHub, Discord) | Steam is the only platform 4ES-Dash surfaces data from; requiring a second account creates unnecessary friction. Steam OpenID is the natural, expected identity path for the user population. |
| Per-user rate-limit budget (bypass shared token bucket for backfill) | The single token-bucket limiter is a contract in `lib/steam/` (see [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md)); relaxing it for backfills would risk 429 errors from Steam and defeat the purpose of rate limiting. Backfills must queue through the same path. |
