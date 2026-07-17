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
| Multiplayer-eligible games filter | **T2** | Derived from **nightly-persisted Store metadata**: the snapshot job's `refreshGameStoreData` pass stores `Game.categoryIds` (from `appdetails` `categories` — id 1 = Multi-player, id 9 = Co-op, id 27 = Cross-Platform Multiplayer) and the filter reads the DB with zero request-path Store calls (ERR-0022). Fallback ladder: `categoryIds` present → classify; `null` (never refreshed, or unavailable at last refresh with no prior value) or malformed → excluded from the filtered set and counted in `missingCount` (surfaced as "Some games could not be categorized"); a game is never classified non-multiplayer from missing data |
| Activity feed across friends | **T4** ⚠️ | Not available; see [Known limitations](#known-limitations) |

### Phase 4 — Insights

| Feature | Source | Steam Endpoint |
|---------|--------|----------------|
| "Year in Review" — annual playtime, top games | Local DB | Derived from snapshots |
| Genre / tag breakdown | **T2** | `store.steampowered.com/api/appdetails` (genres + categories per game, cached 7 days) |
| Cost-per-hour ranking — current prices | **T2** | `store.steampowered.com/api/appdetails?filters=price_overview` |
| Cost-per-hour ranking — prices paid | **T4** → Manual | Not available from Steam. Captured via `ManualGameData` import (#40) for future use; the Phase 4 cost-per-hour page itself uses **current store price only** (per ACCEPTANCE.md #36), so its disclaimer stays accurate |
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

## Data availability & degradation strategy

This project is privacy-respecting, self-hostable, and zero-cost. No paid third-party services are ever required. The strategies below define how 4ES-Dash handles data Steam does not fully expose, without fabricating values or crashing.

**Guiding principle: never crash, never fabricate a value, always degrade to a designed empty/unavailable state.**

### Fallback ladder

When a data point is needed, sources are tried in this order:

1. **Official API (T1)** — `api.steampowered.com` authenticated endpoints. Always the first choice.
2. **Unofficial Store API (T2)** — `store.steampowered.com/api/*`. Used when T1 does not expose the field.
3. **Derive from our own nightly DB snapshots** — if neither T1 nor T2 exposes the data, compute it from the snapshot table we already accumulate. No extra outbound calls required.
4. **Free opt-in enrichment** — additional free third-party APIs (SteamSpy, IsThereAnyDeal) that the self-hoster explicitly enables via env vars. Off by default.
5. **Explicit `unavailable` / approximate state in the UI** — if all prior steps fail or are disabled, the UI renders a designed empty/unavailable state. The data layer signals this with a typed result; a thrown error never reaches the user.

### Typed unavailable states at the data boundary

Data-layer functions return a discriminated result type rather than throwing or returning `null`:

```ts
type Result<T> =
  | { available: true;  value: T }
  | { available: false; reason: Reason };

type Reason = 'private' | 'rate_limit' | 'not_exposed' | 'schema' | 'transient';
```

This mirrors the existing `SteamApiError.kind` union documented in CLAUDE.md and docs/BACKEND.md. RSCs and client components consume `available: false` to render designed empty states; they never receive a thrown error from a missing data point. On exhausted retries the cache returns the previous value flagged `stale: true` (stale-while-revalidate), which the UI surfaces with a visual indicator rather than an error boundary.

### Snapshot inference (free, no dependencies)

The nightly snapshot job (`IPlayerService/GetOwnedGames/v1`) is the primary free mechanism for data Steam does not timestamp:

- **`acquiredAt`** — set to the first date a game appears in the snapshot table. This value is `null` until the game is seen for the first time. No outbound call needed beyond what the snapshot job already makes.
- **Playtime trends** — all time-series charts and "year in review" derive from the snapshot table. No extra API calls.
- **Idle detection** — playtime delta analysis between snapshots; no additional source required.

This is a zero-cost, zero-dependency inference mechanism available to every self-hoster from day one.

### Free opt-in enrichment (off by default, env-gated)

Two free third-party APIs supplement data Steam does not expose. Both are **disabled by default** and must be explicitly opted in via env vars. Enabling them adds outbound calls to third-party servers — a privacy trade-off the self-hoster consciously accepts.

| Service | Env var to enable | Cost | Rate limit | Cache TTL | Supplements | Client module |
|---------|-------------------|------|------------|-----------|-------------|---------------|
| **SteamSpy** (`https://steamspy.com/api.php`) | `ENABLE_STEAMSPY=1` or `ENABLE_STEAMSPY=true` | Free, no API key | ≤ 1 req/sec | ≥ 24 h (`steamSpy` TTL) | Genres/tags, ownership bands | `lib/steam/steamspy-client.ts` |
| **IsThereAnyDeal** (`https://api.isthereanydeal.com`) | `ITAD_API_KEY=<key>` (free key from ITAD) | Free API key | Per-key quota | ≥ 24 h (`itadPrice` TTL) | Historical-low price, best current deal | `lib/steam/itad-client.ts` |

**No paid services are used anywhere in this project.** If `ENABLE_STEAMSPY` is not set to `1`/`true` or `ITAD_API_KEY` is unset, the respective enrichment path is skipped entirely and the UI falls through to the `available: false` state. The privacy implication (extra outbound third-party calls revealing which games you own) is why enrichment is opt-in.

Both clients follow the **store-client T2 pattern**: no API key embedded in the URL for SteamSpy (key-less), a custom `User-Agent: 4ES-Dash/<version>` header, and a _never-throw_ contract — unexpected shapes or network errors degrade to `unavailable('metadata-unavailable')` rather than bubbling up.

IsThereAnyDeal allows a better approximation of library value and cost-per-hour by supplying historical-low prices, since Steam only exposes the current price.

### Manual import (free)

For data no API exposes — specifically `price_paid` and `acquired_at` — self-hosters may supply values via CSV/JSON import. This fills the T4 gaps for:

- **Accurate cost-per-hour** — using the actual price paid rather than current store price.
- **`sort=added`** — for games purchased before the snapshot baseline, a manually supplied `acquired_at` overrides the inferred value.

Manual import adds optional DB columns and an import route. It is tracked as a Phase 4 roadmap issue and does not affect core functionality.

### Decision table

| Unavailable / limited data | Tier | Chosen free strategy | Resulting UI behavior |
|---------------------------|------|----------------------|-----------------------|
| Acquisition date (`acquiredAt`) | T4 | Snapshot inference — first date game appears in nightly snapshot | Sort by `added` works for games seen since baseline; older games sort last with a UI note |
| Price paid | T4 | `ManualGameData` table (#40): user imports `pricePaidCents` + `currency` via CSV/JSON; stored for future features. The Phase 4 cost-per-hour ranking uses current store price only (ACCEPTANCE.md #36) | "Library value" shows current total value; cost-per-hour shows current price with the persistent "not what you paid" disclaimer |
| Friends activity feed | T4 | Not pursued — no free mechanism exists | Feature descoped; friends page shows online status and current game only |
| Genres / tags | T2 + opt-in T3 | Store API primary; SteamSpy opt-in supplements and fills gaps | Shown when available; card renders without genre chip if missing |
| Ownership / popularity | Opt-in T3 | SteamSpy opt-in only (`ENABLE_STEAMSPY=true`) | Popularity band shown if SteamSpy enabled; hidden otherwise |

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
