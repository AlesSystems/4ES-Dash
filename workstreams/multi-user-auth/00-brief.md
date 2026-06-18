# Brief — multi-user & auth (Phase 6)

> **Source of intent: human-authored GitHub issues.** The intent and acceptance
> criteria below are a faithful synthesis of the Phase 6 issues (#59–#67) under
> the milestone *"Phase 6 — Multi-user & Auth"*. Those issues are the
> human-written brief; this file transcribes them into the workstream format so
> the orchestrator can plan against a single record. If intent here conflicts
> with an issue, the issue wins — and that's a brief edit, not an agent call.

## Intent

Convert 4ES-Dash from a **single-owner** dashboard (one hard-coded
`STEAM_ID`) into a **multi-tenant** app: anyone signs in with **Steam OpenID**
(via next-auth / Auth.js), gets their own dashboard backed by per-user data
isolation, an onboarding backfill, and privacy controls over who can see their
profile. The single `STEAM_ID` env var stays only as a dev / featured-profile
fallback — it is no longer "the user".

## Acceptance criteria

> Phase-level, behavioral, testable. Each task in `03-tasks/` carries the
> finer-grained criteria copied from its source issue.

1. A visitor can **sign in with Steam**; the session carries their 64-bit
   **SteamID as a string** (`session.user.steamId`), and signing out clears it.
   (#60, #65)
2. Auth secrets (`NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `STEAM_API_KEY`) are
   **server-only**, Zod-validated at boot, and have placeholders in
   `.env.ci` / `.env.test` so build + tests pass with no real secrets. (#60)
3. The Prisma schema persists **per-user identity** (the `User` table, keyed by
   `steamId`, is the authenticated account) plus the next-auth persistence model
   chosen in the ADR; existing snapshot/reference tables work for **many**
   SteamIDs, via one new immutable migration. (#61)
4. **No data read is scoped to a global owner id.** Every repository / RSC /
   route / job reads the **session user's** SteamID or an explicitly-requested
   public profile; two different SteamIDs get isolated cache + query results.
   A missing/blank SteamID is a typed error, never a silent fallback. (#62)
5. **Authorization is enforced server-side.** Protected routes (`/dashboard`,
   any "my" view) redirect unauthenticated visitors to sign-in; a logged-in user
   can only read their **own** private/derived data (no IDOR); public profiles
   render public Steam data for any visitor. (#63)
6. **First sign-in bootstraps the dashboard**: profile summary + owned games are
   fetched and a baseline snapshot is seeded, idempotently (re-login / concurrent
   logins create no duplicates), respecting the rate limiter. (#64)
7. **Auth UI** is wired into the app shell: a "Sign in with Steam" entry point, a
   signed-in user menu (avatar + persona, sign-out, link to settings), and a
   logged-out landing that protected areas redirect to. (#65)
8. **Privacy controls + account settings**: a persisted privacy level
   (`public` / `friends-only` / `private`) enforced by the authz rules, a
   "re-sync now" action, and a "delete my account & data" path that removes all
   of the user's rows after a confirm step. (#66)
9. **Degrade, never crash or fabricate**: a private Steam profile → designed
   locked / `{ available: false, reason: 'private' }` state everywhere it
   surfaces; friends-only with an unavailable friends list **fails closed**
   (treated as private); transient Steam errors use stale-while-revalidate.
   (#62, #63, #64, #66)
10. **Docs reflect multi-tenancy**: a new ADR (#59) is the source of truth; the
    threat model, ROADMAP, ARCHITECTURE, README, and ACCEPTANCE are updated from
    "single-user" to multi-user. (#59, #67)

## Non-goals

- Email + password or any non-Steam identity provider (rejected in the ADR;
  Steam OpenID only).
- A no-login public profile *browser* / directory of arbitrary users beyond the
  public-profile route required for sharing one's own dashboard.
- Cross-user social features beyond what already exists (no new friend graph,
  messaging, or activity feed).
- Paid infrastructure to absorb multi-user scale — the free/zero-cost constraint
  still holds; the ADR records the retention / rate-budget stance, not a
  spend-to-scale plan.
- Changing the Steam data-availability ladder itself; multi-user reuses the
  existing degradation strategy.

## Constraints

- **Data source / availability:** Steam OpenID establishes **identity, not data
  access** — the Steam Web API still returns only *public* data for any logged-in
  user. Private profile → designed locked state, never a thrown error or
  fabricated zero. Follow `docs/STEAM_DATA_SOURCES.md` degradation ladder.
- **Identity:** `steamId` is a **string** at every boundary (17-digit, 64-bit).
  It is the account key. All Steam I/O stays behind the single rate-limited
  client in `lib/steam/` and is Zod-parsed at the boundary.
- **Security:** secrets server-only (never `NEXT_PUBLIC_`); CSRF on
  state-changing routes (next-auth defaults); no IDOR; account deletion removes
  PII with no silent orphans. See `docs/SECURITY.md`.
- **Migrations are immutable once merged.** One new migration; coordinate with
  the note in #61 that this supersedes the auth/identity portion of #24 so the
  two migrations don't collide.
- **Performance budget:** per-route < 200 KB JS gzipped, LCP < 2.5 s mid-tier
  mobile. RSC by default; `"use client"` only where interaction needs it.
  Tailwind tokens only; `lucide-react` (stroke 1.75); `next/image` with `sizes`;
  Steam avatars from allow-listed `avatars.steamstatic.com`.
- **Must honor:** TDD + the PostToolUse gate; `withErrorBoundary` on route
  handlers (no extra try/catch); cache keys stay `steam:<endpoint>:<steamId>[:<appid>]`;
  the Definition of Done in `docs/CONTRIBUTING.md`.
