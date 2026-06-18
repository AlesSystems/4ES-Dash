# API Reference

4ES-Dash exposes a small JSON API at `/api/*`. The API is a thin façade over the Steam Web API plus our snapshot database. All responses are JSON, all errors are RFC 7807 problem details.

## Conventions

- **Base URL**: `http://localhost:3000/api` in dev.
- **Auth (v1)**: none; the server reads `STEAM_ID` from env.
- **Auth (v2+)**: session cookie issued after Steam OpenID login.
- **Content type**: `application/json; charset=utf-8`.
- **IDs**: Steam IDs are 17-digit strings (the 64-bit form), not numbers. Don't lose precision in JS.
- **Times**: ISO-8601 UTC strings.
- **Durations**: minutes, integer.
- **Data sources**: Most data comes from the official Steam Web API (`api.steampowered.com`). Store metadata (genres, tags, description, price) comes from the undocumented `store.steampowered.com/api/appdetails` endpoint. See [`docs/STEAM_DATA_SOURCES.md`](STEAM_DATA_SOURCES.md) for the full breakdown.

## Error shape

```json
{
  "type": "https://4es-dash/errors/steam-private-profile",
  "title": "Steam profile is private",
  "status": 403,
  "detail": "GetOwnedGames requires the user's profile to be public.",
  "instance": "/api/library"
}
```

| `type` slug              | HTTP | When                                          |
| ------------------------ | ---- | --------------------------------------------- |
| `steam-rate-limit`       | 429  | Steam returned 429; includes `Retry-After`    |
| `steam-private-profile`  | 403  | Profile / library not public                  |
| `steam-auth`             | 401  | Bad or missing API key                        |
| `steam-transient`        | 502  | Upstream 5xx after retries                    |
| `validation`             | 400  | Request failed Zod validation                 |
| `not-found`              | 404  | Resource not in cache/DB and Steam has no data|
| `unauthorized`           | 401  | Missing/invalid `x-cron-secret` on a cron route|
| `internal`               | 500  | Unhandled                                     |

## Endpoints

### `GET /api/profile`

Returns the configured user's public profile and their full owned-game library.

**Response 200**

```json
{
  "profile": {
    "steamId": "76561198000000000",
    "personaName": "Ales",
    "avatar": {
      "small":  "https://avatars.steamstatic.com/abc123_small.jpg",
      "medium": "https://avatars.steamstatic.com/abc123_medium.jpg",
      "full":   "https://avatars.steamstatic.com/abc123_full.jpg"
    },
    "profileUrl": "https://steamcommunity.com/id/ales/",
    "createdAt": "2008-04-13T00:00:00.000Z",
    "countryCode": "US"
  },
  "games": [
    {
      "appId": 730,
      "name": "Counter-Strike 2",
      "iconUrl": "https://media.steampowered.com/steamcommunity/public/images/apps/730/abc123.jpg",
      "headerUrl": "https://cdn.akamai.steamstatic.com/steam/apps/730/header.jpg",
      "playtime": { "total": 23410, "twoWeeks": 120 },
      "lastPlayed": "2024-05-14T22:13:00.000Z",
      "hasAchievements": true
    },
    {
      "appId": 570,
      "name": "Dota 2",
      "iconUrl": "https://media.steampowered.com/steamcommunity/public/images/apps/570/def456.jpg",
      "headerUrl": "https://cdn.akamai.steamstatic.com/steam/apps/570/header.jpg",
      "playtime": { "total": 5000, "twoWeeks": 0 },
      "lastPlayed": null,
      "hasAchievements": false
    }
  ]
}
```

**Errors this endpoint can return**

| `type` slug             | HTTP | When                               |
| ----------------------- | ---- | ---------------------------------- |
| `steam-private-profile` | 403  | Steam library or profile is private |
| `steam-auth`            | 401  | Bad or missing Steam API key        |
| `validation`            | 400  | Response failed Zod schema check    |

### `GET /api/library`

The owned-games list with playtime.

**Query**

| Param       | Type     | Default  | Notes                                       |
| ----------- | -------- | -------- | ------------------------------------------- |
| `sort`      | enum     | `playtime` | `playtime` \| `name` \| `recent` \| `added` |
| `order`     | enum     | `desc`   | `asc` \| `desc`                             |
| `search`    | string   | —        | Substring match on name                     |
| `limit`     | int      | 100      | 1–500                                       |
| `cursor`    | string   | —        | Opaque pagination cursor                    |

> **Note on `sort=added`:** Steam does not expose game acquisition dates via any API. The `acquiredAt` field is inferred from the first time a game appears in a nightly snapshot and is `null` for games imported before snapshotting began. When `sort=added` is used, games with a known date sort first; games with `acquiredAt = null` fall back to name order.

**Response 200**

```json
{
  "games": [
    {
      "appId": 730,
      "name": "Counter-Strike 2",
      "iconUrl": "https://media.steampowered.com/.../icon.jpg",
      "headerUrl": "https://cdn.akamai.steamstatic.com/.../header.jpg",
      "playtime": { "total": 23410, "twoWeeks": 120 },
      "lastPlayed": "2026-05-14T22:13:00Z",
      "hasAchievements": true
    }
  ],
  "nextCursor": "eyJvIjoxMDB9"
}
```

### `GET /api/games/:appid`

Detailed view for a single owned game.

**Response 200**

```json
{
  "appId": 730,
  "name": "Counter-Strike 2",
  "store": {
    "description": "...",
    "genres": ["Action", "FPS"],
    "tags": ["Multiplayer", "Competitive"],
    "releaseDate": "2012-08-21",
    "price": { "currency": "USD", "current": 0, "initial": 0 }
  },  "playtime": { "total": 23410, "twoWeeks": 120 },
  "achievements": {
    "total": 167,
    "unlocked": 89,
    "percentUnlocked": 0.533,
    "recent": [
      { "name": "First Blood", "unlockedAt": "2026-05-13T19:02:00Z" }
    ]
  },
  "history": {
    "playtimePerWeek": [
      { "weekStarting": "2026-05-04", "minutes": 320 }
    ]
  }
}
```

### `GET /api/games/:appid/achievements`

Full achievement list.

**Response 200**

```json
{
  "appId": 730,
  "total": 167,
  "unlocked": 89,
  "items": [
    {
      "apiName": "WIN_ROUNDS_LOW",
      "displayName": "Body Bagger",
      "description": "Win 1,000 rounds.",
      "iconUrl": "https://...",
      "iconGrayUrl": "https://...",
      "globalUnlockPercent": 78.4,
      "unlocked": true,
      "unlockedAt": "2026-05-13T19:02:00Z"
    }
  ]
}
```

### `GET /api/recent`

Recently played (last 2 weeks).

**Response 200**

```json
{
  "games": [
    {
      "appId": 730,
      "name": "Counter-Strike 2",
      "playtime": { "twoWeeks": 120, "total": 23410 }
    }
  ]
}
```

### `GET /api/friends`

Friend list with online status.

**Response 200**

```json
{
  "friends": [
    {
      "steamId": "76561198000000001",
      "personaName": "Friend",
      "avatar": {
        "small": "https://avatars.steamstatic.com/abc_small.jpg",
        "medium": "https://avatars.steamstatic.com/abc_medium.jpg",
        "full": "https://avatars.steamstatic.com/abc_full.jpg"
      },
      "profileUrl": "https://steamcommunity.com/id/friend/",
      "status": "online",
      "inGame": true,
      "playing": { "appId": 730, "name": "Counter-Strike 2" },
      "friendSince": "2020-09-13T12:26:40.000Z"
    }
  ]
}
```

Sorted: non-offline friends (online + away) first, offline last; within each group alphabetically by `personaName`.

`friendSince` is an ISO-8601 UTC string when Steam reports a non-zero `friend_since` epoch, or `null` otherwise.

`playing` is `null` when the friend is not in a game. `appId` inside `playing` is `null` for non-Steam games.

**Errors this endpoint can return**

| `type` slug             | HTTP | When                                         |
| ----------------------- | ---- | -------------------------------------------- |
| `steam-private-profile` | 403  | Friend list is not public                    |
| `steam-auth`            | 401  | Bad or missing Steam API key                 |
| `steam-transient`       | 502  | Steam API temporarily unavailable after retries |
| `validation`            | 400  | Response failed Zod schema check             |

### `GET /api/stats/summary`

Aggregates for the dashboard hero.

**Response 200**

```json
{
  "totals": {
    "games": 412,
    "playtime": 1284530,
    "unplayed": 178,
    "achievementsUnlocked": 5821
  },
  "topGenres": [
    { "name": "Action", "playtime": 412000 }
  ]
}
```

### `POST /api/import`

Imports user-supplied game price and acquisition data that Steam never exposes. Idempotent — re-importing the same rows overwrites with the same values; the DB record count stays at 1 per `(steamId, appId)`.

Accepts two content types:

- `application/json` — body must be `{ "rows": [...] }`
- `text/csv` — `Content-Type: text/csv`. First row is a header; valid columns: `appId`, `pricePaidCents`, `currency`, `acquiredAt`. Empty cells are treated as absent (i.e. the field stays `null`).

**Request — JSON**

```json
{
  "rows": [
    {
      "appId": 730,
      "pricePaidCents": 2499,
      "currency": "USD",
      "acquiredAt": "2021-03-15T00:00:00.000Z"
    },
    {
      "appId": 570
    }
  ]
}
```

**Request — CSV**

```csv
appId,pricePaidCents,currency,acquiredAt
730,2499,USD,2021-03-15T00:00:00.000Z
570,,,
```

**Validation**

| Field           | Type              | Constraints                                                |
| --------------- | ----------------- | ---------------------------------------------------------- |
| `appId`         | integer           | Required, positive                                         |
| `pricePaidCents`| integer           | Optional, non-negative (minor currency units, e.g. cents) |
| `currency`      | string (ISO 4217) | Optional, exactly 3 characters                             |
| `acquiredAt`    | string (ISO 8601) | Optional, full datetime string                             |

`rows` array: minimum 1, maximum 5 000 rows per request.

**Response 200**

```json
{ "imported": 2 }
```

`imported` equals `rows.length` — every row is counted once regardless of whether it was inserted or updated.

**Errors this endpoint can return**

| `type` slug  | HTTP | When                                                         |
| ------------ | ---- | ------------------------------------------------------------ |
| `validation` | 400  | `rows` is empty, missing, or contains invalid field values   |
| `internal`   | 500  | Unexpected error during the DB transaction                   |

### `POST /api/cron/snapshot`

Cron-only. Snapshots playtime (and a bounded set of achievement-unlock counts) for the configured user. Idempotent — safe to retry; a second call on the same UTC day inserts no new rows.

**Headers**

- `x-cron-secret: <CRON_SECRET>` — required. Compared timing-safely; missing/invalid → `401 unauthorized`.

**Response 200**

```json
{
  "steamId": "76561198000000000",
  "date": "2026-06-16",
  "gamesProcessed": 65,
  "rowsInserted": 65,
  "clamped": 0,
  "achievementRowsInserted": 20
}
```

**Errors**

| `type` slug    | HTTP | When                                  |
| -------------- | ---- | ------------------------------------- |
| `unauthorized` | 401  | Missing/invalid `x-cron-secret`       |
| `internal`     | 500  | The snapshot job threw (logged + `JobRun` row marked `error`) |

## Rate limits

- Outbound to Steam: at most 1 request / 250 ms per origin process. The client enforces this with a token-bucket limiter.
- Inbound on our endpoints: 60 req/min/IP. Returns `429` with `Retry-After`.

## Versioning

The API is currently `v1` implicitly. Breaking changes will introduce `/api/v2/*` rather than mutate existing paths. Additive changes (new fields, new endpoints) are not versioned.

## OpenAPI

A machine-readable spec (`docs/openapi.yaml`) generated from Zod schemas via
`zod-to-openapi` is deferred until the API surface stabilises.
