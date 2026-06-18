# Security

## Threat model

4ES-Dash is a **multi-user** application (Phase 6, shipped). Any Steam account holder can sign in
with Steam OpenID and view their own private dashboard; public profile pages are visible to
unauthenticated visitors. The realistic threats are:

1. **API key leakage** — `STEAM_API_KEY` exfiltrated; the attacker can read public Steam data
   with our rate-budget quota.
   *Control:* server-only env var, never serialized to the client, never `NEXT_PUBLIC_`-prefixed
   (Task 02).

2. **Cross-site scripting** — game names, personas, and avatar URLs come from Steam; treat them
   as untrusted HTML.
   *Control:* React handles encoding for text; `dangerouslySetInnerHTML` is never used on Steam
   content. Avatar `src` values are allow-listed to `avatars.steamstatic.com` via the CSP and
   `next/image` config.

3. **Server-side request forgery** — image proxying or arbitrary URL fetching.
   *Control:* image URLs come from a hard-coded Steam CDN allow-list; no user-supplied URL
   hits `fetch` on the server.

4. **Rate-budget abuse across N users** — concurrent users or a single aggressive user
   exhausts the shared Steam API token bucket, causing 429 errors project-wide.
   *Control:* a single `1 req / 250 ms` token bucket in `lib/steam/limiter.ts` is shared across
   all session users; first-login backfills and cron jobs queue through the same limiter (ADR 0002
   §7). There is no per-user bypass or parallel channel.

5. **Session hijack** — an attacker steals a signed-in user's session and impersonates them.
   *Control:* sessions are stateless JWT cookies **encrypted** (JWE, next-auth v4 default) with a
   key derived from `NEXTAUTH_SECRET` — opaque to the client, no DB session row to steal. Cookies
   are `HttpOnly` (inaccessible to JavaScript), `Secure` (HTTPS only in production), and
   `SameSite=Lax` (mitigates cross-site submission). The JWT stores only `{ steamId, name, image }`
   — no privileged tokens. `NEXTAUTH_SECRET` rotation invalidates all existing sessions (Task 02,
   ADR 0002 §2).

6. **CSRF — state-changing auth routes** — a malicious page tricks a signed-in user's browser
   into triggering sign-in or sign-out.
   *Control:* next-auth applies a built-in double-submit cookie CSRF check on all its own
   state-changing routes (`/api/auth/signin`, `/api/auth/signout`, `/api/auth/callback`) by
   default. No extra CSRF code is needed for read-only data routes (Task 05).

7. **OpenID flow forgery / profile takeover** — an attacker crafts a callback URL with an
   arbitrary `claimed_id` to be authenticated as any SteamID.
   *Control:* `verifySteamOpenId()` in `server/auth.ts` re-POSTs all `openid.*` params to
   Steam's `check_authentication` endpoint and confirms `is_valid:true` before the JWT is
   minted. A response without `is_valid:true`, a non-`steamcommunity.com` `claimed_id`, or an
   HTTP error all return `null` (authentication refused). This step is exported and
   regression-tested (Task 02).

8. **IDOR / profile authorization** — user A reads or mutates user B's private data by changing
   a URL parameter or request body field.
   *Control:* every protected "my" view, route handler, and account action (`setPrivacy`,
   `resyncNow`, `deleteAccount`) derives `steamId` from the authenticated session via
   `getSessionUser()`, never from caller-supplied input. Cross-user reads go through
   `canViewProfile()` (`server/authz.ts`), which **fails closed**: a `friendsOnly` profile whose
   friends list is unavailable or private is treated as `private` — data is never exposed when
   friendship cannot be confirmed (Task 05).

9. **Secret management** — secrets committed to the repo or serialized into client bundles.
   *Control:* all secrets (`STEAM_API_KEY`, `NEXTAUTH_SECRET`, `CRON_SECRET`) are server-only env
   vars parsed by `server/env.ts` (Zod). None carry a `NEXT_PUBLIC_` prefix. `pnpm build` and CI
   use placeholder `.env.ci` / `.env.test` values; `grep -r "STEAM_API_KEY" .next/static` must
   find nothing after a production build (Task 02).

10. **Account-deletion / PII** — a user deletes their account but orphaned rows remain in the
    database, violating the right to erasure.
    *Control:* `deleteAccountData(steamId)` in `server/repositories/account.ts` removes **all**
    user-keyed rows (`PlaytimeSnapshot`, `AchievementSnapshot`, `OwnedGame`, `ManualGameData`,
    `IdleDismissal`, `User`) in a single `$transaction`. Children are deleted before the parent
    row; a partial failure rolls back — no PII is left behind silently. The UI requires an
    explicit type-to-confirm step. Because sessions are JWT (no `Session` table), clearing the
    client cookie via `signOut()` is sufficient to end the session server-side (Task 08).

See [docs/adr/0002-multi-tenant-steam-openid-auth.md](adr/0002-multi-tenant-steam-openid-auth.md)
for the binding architectural decisions behind §2 (JWT sessions), §5 (OpenID identity ≠ data
access), §6 (per-user data isolation), and §7 (shared rate budget).

## Controls

- **Secrets**: only in env vars, never in code or client bundles. No `NEXT_PUBLIC_` prefix on anything secret.
- **Strict origin**: same-origin only. No public CORS.
- **CSP**: `default-src 'self'`, `img-src https://avatars.steamstatic.com https://media.steampowered.com https://cdn.akamai.steamstatic.com data:`, `script-src 'self'`. No inline scripts except Next.js's hashed boot.
- **Output encoding**: React handles it for text; never `dangerouslySetInnerHTML` on Steam content.
- **No URL pass-through**: image URLs come from a fixed allow-list of Steam CDNs. No user-supplied URL hits `fetch` on the server.
- **Rate limit**: 60 req/min/IP on `/api/*`.
- **Cron auth**: shared secret in `x-cron-secret`, compared with `crypto.timingSafeEqual`.
- **Dependencies**: `pnpm audit` runs in CI; Dependabot PRs are reviewed weekly.
- **Cookies (v2+)**: `HttpOnly`, `Secure`, `SameSite=Lax`. Session ID rotated on login.
- **Store API calls (SSRF prevention)**: `lib/steam/store-client.ts` only ever connects to a hard-coded `store.steampowered.com` base URL. No user-supplied input is interpolated into the hostname. Only `appId` (integer) and `steamId` (17-digit string validated by Zod) are included as query/path parameters.

### Multi-user & account data (Phase 6)

> The full multi-user threat model is in the **Threat model** section above.
> This sub-section records the specific account-data controls shipped in Task 08.
> See also [ADR 0002](adr/0002-multi-tenant-steam-openid-auth.md) for the
> architectural decisions behind session strategy, data isolation, and rate budget.

- **Session-scoped data, no IDOR**: every "my" view, route handler, and account
  action (`setPrivacy` / `resyncNow` / `deleteAccount`) derives the `steamId` from
  the authenticated session (`getSessionUser()`), never from caller input — a user
  cannot read or mutate another user's data by changing a parameter. Cross-user
  reads go through `canViewProfile()` (`server/authz.ts`), which **fails closed**
  for friends-only profiles when friendship cannot be verified.
- **Account & data deletion (right to erasure)**: `deleteAccountData(steamId)`
  (`server/repositories/account.ts`) removes **all** of the user's rows —
  `PlaytimeSnapshot`, `AchievementSnapshot`, `OwnedGame`, `ManualGameData`,
  `IdleDismissal`, and the `User` record — in a single atomic `prisma.$transaction`
  (children first, parent last). There is **no FK cascade**, so the table list is
  explicit and must be extended whenever a new `steamId`-keyed table is added
  (see `docs/DATA_MODEL.md` §Privacy). A partial failure rolls back; no orphaned
  PII is left behind. The UI requires an explicit type-to-confirm step, and the
  JWT session cookie is cleared client-side (`signOut`) immediately after deletion.
- **Privacy default**: new accounts default to `private` (ADR 0002 §4) — history is
  hidden until the user opts into sharing.

## Reporting

If you find a vulnerability, email the maintainer rather than filing a public issue. We'll respond within 7 days.

## Steam API key

If a key leaks, revoke it at https://steamcommunity.com/dev/apikey and rotate `STEAM_API_KEY`. There is no other cleanup required — the key has no write capability.
