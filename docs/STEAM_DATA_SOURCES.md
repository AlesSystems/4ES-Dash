# Steam Data Sources

This document maps every planned 4ES-Dash feature to its data source. It exists so that nothing ships without an agreed data strategy and so contributors know which client to call.

## Source tiers

| Tier | Label | Description |
|------|-------|-------------|
| **T1** | Official API | `api.steampowered.com` — key-authenticated, officially documented, covered by Steam's API ToS. |
| **T2** | Unofficial Store API | `store.steampowered.com/api/*` — no API key required, undocumented but stable and widely used. Subject to rate limits and potential breakage. |
| **T3** | Unofficial Community API | `steamcommunity.com` endpoints not intended as a public API — fragile, higher breakage risk. |
| **T4** | Unavailable | Not exposed by Steam through any programmatic means. Features relying on T4 data must either be dropped, approximated from other sources, or noted as "manual entry only." |

---

## Feature → data source matrix

### Phase 0 — Foundations

| Feature | Source | Steam Endpoint |
|---------|--------|----------------|
| User profile (name, avatar, status, country, created date) | **T1** | `ISteamUser/GetPlayerSummaries/v2` |
| Steam level | **T1** | `IPlayerService/GetSteamLevel/v1` |
| Owned games list with playtime | **T1** | `IPlayerService/GetOwnedGames/v1` |

### Phase 1 — Core dashboard

| Feature | Source | Steam Endpoint |
|---------|--------|----------------|
| Library grid (sort by name, playtime, recent) | **T1** | `IPlayerService/GetOwnedGames/v1` |
| Library grid — sort by `added` (acquisition date) | **T4** ⚠️ | Not available; see [Known limitations](#known-limitations) |
| Game detail — playtime | **T1** | `IPlayerService/GetOwnedGames/v1` |
| Game detail — achievements (player progress) | **T1** | `ISteamUserStats/GetPlayerAchievements/v1` |
| Game detail — achievement schema (names, descriptions, icons) | **T1** | `ISteamUserStats/GetSchemaForGame/v2` |
| Global achievement unlock % | **T1** | `ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2` |
| Game detail — store metadata (genres, description, release date) | **T2** | `store.steampowered.com/api/appdetails?appids=<id>` |
| Game detail — community tags | **T2** | `store.steampowered.com/api/appdetails?appids=<id>` |
| Game detail — current store price | **T2** | `store.steampowered.com/api/appdetails?appids=<id>&filters=price_overview` |
| Recently played widget | **T1** | `IPlayerService/GetRecentlyPlayedGames/v1` |
| Profile header (avatar, level, total playtime) | **T1** | `GetPlayerSummaries/v2` + `GetSteamLevel/v1` + `GetOwnedGames/v1` |

### Phase 2 — Persistence & history

| Feature | Source | Steam Endpoint |
|---------|--------|----------------|
| Playtime snapshots (nightly) | **T1** | `IPlayerService/GetOwnedGames/v1` |
| Achievement snapshots (nightly) | **T1** | `ISteamUserStats/GetPlayerAchievements/v1` |
| Time-series chart (playtime per week/month) | Local DB | Derived from snapshots |
| Backlog score (unplayed count, oldest unplayed) | Local DB + **T1** | Derived from `GetOwnedGames` |
| Library value — current store prices | **T2** | `store.steampowered.com/api/appdetails?appids=<id>&filters=price_overview` |
| Library value — price paid by user | **T4** ⚠️ | Not available; see [Known limitations](#known-limitations) |

### Phase 3 — Social & comparison

| Feature | Source | Steam Endpoint |
|---------|--------|----------------|
| Friends list | **T1** | `ISteamUser/GetFriendList/v1` |
| Friend online status & current game | **T1** | `ISteamUser/GetPlayerSummaries/v2` |
| Compare two users (shared games, playtime delta) | **T1** | `IPlayerService/GetOwnedGames/v1` (for each user) |
| Multiplayer-eligible games filter | **T2** | `store.steampowered.com/api/appdetails` — check `categories` (id 1 = Multi-player, id 9 = Co-op, id 27 = Cross-Platform Multiplayer) |
| Activity feed across friends | **T4** ⚠️ | Not available; see [Known limitations](#known-limitations) |

### Phase 4 — Insights

| Feature | Source | Steam Endpoint |
|---------|--------|----------------|
| "Year in Review" — annual playtime, top games | Local DB | Derived from snapshots |
| Genre / tag breakdown | **T2** | `store.steampowered.com/api/appdetails` (genres + categories per game, cached 7 days) |
| Cost-per-hour ranking — current prices | **T2** | `store.steampowered.com/api/appdetails?filters=price_overview` |
| Cost-per-hour ranking — prices paid | **T4** ⚠️ | Not available; approximation only (show current price, not paid price) |
| Idle-detection heuristic | Local DB | Derived from playtime snapshot delta analysis |

### Stretch goals

| Feature | Source | Steam Endpoint |
|---------|--------|----------------|
| Multi-user Steam OpenID login | **T1** | Steam OpenID 2.0 (`steamcommunity.com/openid`) |
| Wishlist tracker | **T2** | `store.steampowered.com/wishlist/profiles/<steamid>/wishlistdata/` |
| Price-drop alerts | **T2** | `store.steampowered.com/api/appdetails?filters=price_overview` (polled nightly) |
| Export to JSON / CSV | Local DB | No external source |

---

## Known limitations

### `sort=added` — Game acquisition date not available

`IPlayerService/GetOwnedGames/v1` does not return the date a game was added to the user's library. The `acquiredAt` field in our data model is set only if we can infer it (first time the game appears in a snapshot). Until a game appears in a snapshot for the first time, its `acquiredAt` is `null`.

**Impact:** The `sort=added` option in `GET /api/library` will sort games with a known `acquiredAt` first, then fall back to name order for games where the date is unknown. A note is surfaced in the UI.

**Alternative considered:** `store.steampowered.com/account/licenses/` lists purchase dates for the authenticated account owner, but it requires a browser session cookie (`sessionid` + `steamLoginSecure`) — this is a full browser-session scrape that is fragile and arguably violates Steam's ToS. It is **not** implemented.

---

### Price paid — purchase history not available

Steam does not expose how much a user paid for any game through any API or scrapeable endpoint. The closest approximation is the current store price, which may differ wildly from the purchase price (sales, bundles, regional pricing).

**Impact:** Phase 2's "library value" widget shows **current total value** only (sum of current store prices). The "vs. paid" comparison is dropped from scope.

---

### Friends activity feed — not available

There is no official or unofficial API that returns a real-time or recent friends activity feed (what games friends have played, achievements they've unlocked, etc.) beyond the current-game field on `GetPlayerSummaries`.

**Impact:** Phase 3's "Activity feed across friends" feature is **descoped**. The friends page will show online status and current game (which are available), but no historical activity stream.

---

## Undocumented Store API — usage rules

Because `store.steampowered.com/api/appdetails` is undocumented, we apply conservative rules to reduce breakage risk and respect Steam's infrastructure:

1. **Cache aggressively.** Store metadata is cached for 7 days. Price overviews are cached for 1 hour. We never fetch on every page load.
2. **Batch responsibly.** The endpoint accepts up to 100 `appids` in a single request but returns one object per ID. We batch in groups of 50 and add a 500 ms delay between batches.
3. **Fail gracefully.** If the Store API returns an unexpected shape, we log and continue — the game is shown without metadata rather than crashing.
4. **Separate client.** All calls to `store.steampowered.com` are made from `lib/steam/store-client.ts`, not `lib/steam/client.ts`. This enforces the isolation and makes mocking easy.
5. **No API key on Store API calls.** The `STEAM_API_KEY` is never sent to `store.steampowered.com`.
6. **User-Agent header.** We send a descriptive `User-Agent: 4ES-Dash/<version>` header so Steam can identify the traffic.

---

## Official Steam Web API endpoints — reference

| Interface | Method | Purpose |
|-----------|--------|---------|
| `ISteamUser` | `GetPlayerSummaries/v2` | Profile info for up to 100 Steam IDs |
| `ISteamUser` | `GetFriendList/v1` | Friend list for a single user |
| `IPlayerService` | `GetOwnedGames/v1` | Full owned-game list with playtime |
| `IPlayerService` | `GetRecentlyPlayedGames/v1` | Games played in the last 2 weeks |
| `IPlayerService` | `GetSteamLevel/v1` | Steam level for a single user |
| `ISteamUserStats` | `GetPlayerAchievements/v1` | Achievement progress for a single user + game |
| `ISteamUserStats` | `GetSchemaForGame/v2` | Achievement definitions (names, descriptions, icons) |
| `ISteamUserStats` | `GetGlobalAchievementPercentagesForApp/v2` | Global unlock % per achievement |
| `ISteamApps` | `GetAppList/v2` | Full app catalogue (id + name only) |

All calls require `STEAM_API_KEY` in the query string and go to `https://api.steampowered.com`.

---

## Undocumented Store API endpoints — reference

| Base URL | Parameters | Returns |
|----------|------------|---------|
| `store.steampowered.com/api/appdetails` | `appids=<id>`, `cc=<country>`, `l=<lang>`, `filters=<comma-list>` | Full game details or subset via `filters` |
| `store.steampowered.com/wishlist/profiles/<steamid>/wishlistdata/` | — | Wishlist items (public wishlists only) |

Common `filters` values: `basic`, `genres`, `categories`, `price_overview`, `release_date`, `short_description`.

These endpoints are **not** covered by Steam's published API Terms of Use. They may change or disappear without notice. All consuming code must handle `null` / unexpected shapes gracefully.
