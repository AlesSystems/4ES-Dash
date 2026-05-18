# Security

## Threat model

This is a single-user (Phase 1) dashboard with a server-side Steam API key. The realistic threats are:

1. **API key leakage** — exfiltrated, the attacker can read public Steam data with our quota.
2. **Cross-site scripting** — game names and personas come from Steam; treat them as untrusted.
3. **Server-side request forgery** — image proxying or arbitrary URL fetching.
4. **Rate-limit abuse** — an attacker hammers our routes and gets us 429'd by Steam.
5. **Multi-user (Phase 3+)** — session hijack, profile takeover via OpenID flow flaws.

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

## Reporting

If you find a vulnerability, email the maintainer rather than filing a public issue. We'll respond within 7 days.

## Steam API key

If a key leaks, revoke it at https://steamcommunity.com/dev/apikey and rotate `STEAM_API_KEY`. There is no other cleanup required — the key has no write capability.
