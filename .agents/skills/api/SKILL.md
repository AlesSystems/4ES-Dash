---
name: api
description: Use when designing, documenting, or modifying the public JSON API at /api/* in 4ES-Dash, or when integrating with the upstream Steam Web API. Trigger on requests like "add an endpoint", "design the response shape for X", "what does GetOwnedGames return", "version this route", "write a Zod schema for the API", or anything touching docs/API.md, route handlers, or lib/steam types. Enforces docs/API.md conventions and Steam Web API constraints.
---

# API skill

Sources of truth: [`docs/API.md`](../../../docs/API.md) for our surface, [`docs/BACKEND.md`](../../../docs/BACKEND.md) for how routes are implemented. The upstream is the [Steam Web API](https://steamcommunity.com/dev) and its undocumented sibling [Steam Web API documentation site](https://wiki.teamfortress.com/wiki/WebAPI).

## Our API conventions (recap)

- JSON only, `application/json; charset=utf-8`.
- IDs are strings (Steam IDs are 64-bit — no JS numbers).
- Times are ISO-8601 UTC strings.
- Durations are integer minutes.
- Errors are RFC 7807 problem details with stable `type` slugs.
- Additive changes are unversioned; breaking changes go under `/api/v2/...`.

## Designing an endpoint

Walk through this checklist before writing the route:

1. **Who calls this?** RSC, client component, or external? RSCs should call the repository directly; only build an API endpoint when something *outside* the RSC needs it.
2. **Shape**: prefer one resource per path. Wrap collections in `{ items, nextCursor }`, not bare arrays — it leaves room for pagination metadata.
3. **Names**: noun paths, plural for collections (`/api/games`, `/api/games/:appid`). Avoid verbs (`/api/getGame` is wrong).
4. **Query params**: filtering / sorting / pagination only. State-changing inputs go in the body.
5. **Pagination**: cursor-based, opaque base64 cursors. Don't expose offset.
6. **Idempotency**: GET is safe by definition. For POST that may be retried, accept an `Idempotency-Key` header.
7. **Errors**: enumerate the `type` slugs this endpoint can return; add new ones to `docs/API.md`.
8. **Cache headers**: read endpoints can set `Cache-Control: private, max-age=<short>`; cron / mutation endpoints must set `no-store`.

## Zod is the schema

- Define input + output schemas in `lib/zod/api/<endpoint>.ts`.
- Derive TypeScript types from the schema (`z.infer<...>`), never declare them by hand.
- Route handler validates input with `schema.parse`. Response is parsed in dev only (gated by `NODE_ENV !== 'production'`) — production trusts the typed payload.
- These schemas later feed `zod-to-openapi` for `docs/openapi.yaml`.

## Steam Web API gotchas

- **Rate limits**: ~100k calls/day per key, ~1 call/sec sustained. Token-bucket at 1 req / 250 ms.
- **Private profiles**: `IPlayerService` returns `{}` (not an empty list) for private libraries. Map to `SteamApiError({ kind: "private" })`.
- **`include_appinfo`**: must pass `1` to `GetOwnedGames` to get names/icons. The default `0` returns only `appid` and `playtime`.
- **Icon URLs**: assemble from `img_icon_url` hash, not provided as a full URL:
  `https://media.steampowered.com/steamcommunity/public/images/apps/<appid>/<img_icon_url>.jpg`.
- **Header art** is via `cdn.akamai.steamstatic.com/steam/apps/<appid>/header.jpg`.
- **`appid`** is a 32-bit unsigned integer; safe to keep as a JS `number`.
- **`steamid`** is a 64-bit unsigned integer; keep as a string everywhere.
- **`GetPlayerAchievements`** 400s for games without achievements. Check `Game.hasStats` before calling, or treat 400 as "no achievements" and don't retry.
- **`GetGlobalAchievementPercentagesForApp`** returns global stats — cache aggressively (weekly is fine).

## Versioning

- We start at implicit v1. Additive changes (new fields, new endpoints, new error slugs) don't bump versions.
- Breaking changes (rename / remove / type change of an existing field) introduce a parallel `/api/v2/<path>` and a deprecation note on v1.
- Clients should ignore unknown fields. Our Zod schemas use `.strict()` only in dev to surface drift; production is lenient.

## Documenting a new endpoint

When you add one, update [`docs/API.md`](../../../docs/API.md) with:

- Method + path
- Query params table (name, type, default, notes)
- Example request (if non-trivial)
- Example response (a realistic body, not `{}`)
- The error slugs it can return

If you skip the docs, the endpoint isn't done.

## Definition of done

- [ ] Zod schemas for input + output in `lib/zod/api/`
- [ ] Route handler wrapped by `withErrorBoundary`
- [ ] Cache TTL set (or explicit `no-store`)
- [ ] `docs/API.md` updated
- [ ] Vitest covering happy path + at least one error
- [ ] If consuming Steam, the client method exists in `lib/steam/` with its own schema

## What to deliver

When asked to design an endpoint, return the shape first (request + response + errors + caching), then the schema, then the handler. Don't write the handler until the shape is agreed.
