# Plan — multi-user & auth (Phase 6)

> Orchestrator-authored from `00-brief.md` (which synthesizes issues #59–#67).
> Approach, sequencing, and risks. Contracts live in `02-architecture.md`.

## Approach

The app already keys everything on `steamId: String` — the `User` table is
`@id steamId`, every snapshot/reference table relates by `steamId`, and the
cache namespace is `steam:<endpoint>:<steamId>[:<appid>]`. So multi-tenancy is
**not** a data-model rewrite; it's three moves:

1. **Establish identity.** Add next-auth with a Steam OpenID provider so a
   request carries an authenticated `session.user.steamId`. (Today there is no
   auth at all; next-auth is not yet a dependency.)
2. **Replace the global owner with the session user.** ~12 repositories read
   `getEnv().STEAM_ID` today. Half already accept an optional `steamId` arg
   (`snapshots`, `manual-import`, all of `insights/*`, `compare`); the other half
   are still hard-coded (`profile`, `level`, `recently-played`, `friends`,
   `achievements`). Make `steamId` a required, explicit argument everywhere and
   feed it from the session (or an explicit public-profile param). Demote
   `env.STEAM_ID` to a dev / featured-profile fallback.
3. **Guard, onboard, and surface it.** Add authz (protected routes + IDOR
   prevention + public profile pages), a first-login backfill, the auth UI, and
   privacy/account-settings — then bring the docs in line.

Decisions that bound everything (session strategy JWT-vs-DB, default privacy
level, retention/rate-budget stance) are **deferred to the ADR (Task 01)** by
design — the issues explicitly route them there. The architecture doc records a
recommended stance for the ADR to confirm; no implementer decides them.

## Sequencing (by dependency tier → one PR per tier)

Grouped into PR tiers per the CLAUDE.md orchestration playbook (group by
dependency tier, not one-PR-per-issue; merge each tier to `main` before the next
branches off it). Tasks within a tier have disjoint file sets and can run in
parallel.

- **Tier 0 — decision foundation**
  - **Task 01 (#59)** — ADR: multi-tenancy + Steam OpenID. Locks the session
    strategy, identity model, privacy default, retention stance. *Source of
    truth for Tasks 02 & 03.* Docs-only, but blocks the schema/auth choices.

- **Tier 1 — auth + schema foundation** (parallel after the ADR)
  - **Task 02 (#60)** — next-auth + Steam OpenID provider: route handler, env
    vars, session→`steamId` callback, `getSessionUser()` helper.
  - **Task 03 (#61)** — Prisma: next-auth persistence tables (or the documented
    JWT-only decision), `lastLoginAt` + privacy field on `User`, one new
    migration. *Coordinate the migration with #24 per the issue note.*

- **Tier 2 — session-scoped data + authz** (serial: 05 depends on 04)
  - **Task 04 (#62)** — retire `env.STEAM_ID`: repositories take `steamId`
    explicitly; isolation test for two SteamIDs.
  - **Task 05 (#63)** — route protection + data isolation: middleware redirect,
    public `/u/<steamId>` pages, server-side IDOR guard, API scoping.

- **Tier 3 — onboarding + auth UI** (parallel)
  - **Task 06 (#64)** — first-login backfill (idempotent, rate-limited).
  - **Task 07 (#65)** — auth UI: sign-in button, user menu, logged-out landing.

- **Tier 4 — privacy + settings**
  - **Task 08 (#66)** — privacy controls + account settings (re-sync, delete).
    Pulls together the privacy field (03), authz (05), backfill (06), UI (07).

- **Tier 5 — docs pass**
  - **Task 09 (#67)** — SECURITY threat model, ROADMAP, ARCHITECTURE, README,
    ACCEPTANCE updated to multi-user; cross-links the ADR.

Dependency graph (also encoded in each task's "Depends on / Blocks" header):

```
01(ADR) ─┬─▶ 02(auth) ─┬─▶ 04(data) ─▶ 05(authz) ─┐
         └─▶ 03(prisma)┤        │                  ├─▶ 08(privacy/settings) ─▶ 09(docs)
                        ├────────┴─▶ 06(onboarding)─┤
                        └─▶ 02 ─────▶ 07(auth UI) ──┘
```

## Risks / unknowns

- **Session strategy (JWT vs DB).** Determines whether Task 03 adds the
  next-auth `Session` table. *Deferred to the ADR (Task 01)* — must be decided
  before Task 03 starts. Recommended stance recorded in `02-architecture.md`.
- **Migration collision with #24.** #61 supersedes the auth/identity portion of
  #24. If a #24 migration is already in flight, Task 03 must rebase onto it and
  produce a single coherent migration — never edit a merged one.
- **`env.STEAM_ID` is load-bearing in 12 files.** Task 04 is the riskiest
  refactor: a missed call site silently serves the featured profile's data to a
  logged-in user. The guard (blank `steamId` → typed error) and the
  two-SteamID isolation test are the safety net; the reviewer must grep for
  residual `getEnv().STEAM_ID` reads outside the dev-fallback path.
- **Rate budget across N users.** The 1 req / 250 ms token bucket is global;
  many simultaneous first-login backfills could starve it. Task 06 must respect
  the limiter and degrade (stale-while-revalidate), not bypass it. Scaling
  stance is an ADR note, not an implementer decision.
- **Friends-only privacy needs the friends list**, which is itself private for
  some users. Task 08 must **fail closed** (treat as private) when the friends
  list is unavailable — never expose by default.

## Out of scope (from brief non-goals)

- Non-Steam identity providers; email+password.
- A directory/browser of arbitrary users beyond the shareable public-profile
  route.
- New social features (friend graph, messaging, activity feed).
- Paid infra to absorb scale — free/zero-cost constraint holds.
