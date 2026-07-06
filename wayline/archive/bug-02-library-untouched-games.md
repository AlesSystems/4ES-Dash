# Bug 02 — Library shows all games as "untouched" despite playtime

> Read-only investigation receipt. Worker (opus, low) → adversarial reviewer (opus, xhigh).
> **Verdict: `plausible` · readyForPlanning = `true`** — the code mechanism is fully confirmed;
> the *cause of the zeros* reduces to a single named Steam check.

---

## Verdict at a glance

| Field | Value |
|---|---|
| Reviewer verdict | **plausible** |
| Ready for planning | **yes** (reduced to one evidence request) |
| Worker confidence | 4/5 |
| Reviewer confidence | 4/5 |

## What is broken (user terms)

The Library classifies every game as **"untouched"** even for games the user has clearly played.
"Untouched" is defined purely as `playtime.total === 0` minutes. That value comes **live from Steam's
`GetOwnedGames` `playtime_forever`** for the viewed user — never from the persisted `ownedGame` DB rows.
When a Steam account is *profile-public* but *"Game details" privacy is not public*, Steam still returns
the games list but reports `playtime_forever: 0` for every game → all games render "untouched". Matches
the "some users" symptom: it's per-user privacy config, not a global code bug.

## Branch RESOLVED — live Steam, not DB (reviewer upheld)

- ✅ **`getProfile` reads LIVE Steam only.** `server/repositories/profile.ts:23-34` sources games via
  `cache(cacheKey('owned-games', id), TTL.ownedGames, () => getOwnedGames(id))`. The file imports only
  `getOwnedGames`/`getPlayerSummaries`, `cache`, `requireSteamId` — **no prisma import**. Docstring
  (`profile.ts:5-8`): *"Phase 0: cache -> Steam only. The DB read-through layer slots in here at Phase 2."*
- ✅ **No DB fallback.** `server/cache.ts:80-137` is a pure in-memory stale-while-revalidate `Map`.
- ✅ **The DB `ownedGame` write path is never read by the library page.** `onboarding-backfill.ts:140-156`
  upserts rows, but the only readers of `prisma.ownedGame` are insights/cost-per-hour, insights/genres,
  account delete, and the game-detail page — *not* `app/library/page.tsx`.
- ✅ **Classification verbatim from Steam.** `lib/steam/client.ts:201` `total: game.playtime_forever`
  (no transform); `lib/steam/schemas.ts:32` `playtime_forever: z.number()` (required, no `.default()`,
  so no coercion masks a zero); `lib/games/sort.ts:63` + `app/library/page.tsx:105` → `total === 0` ⇒ untouched.
- ✅ **The `'private'` branch only fires when the `games` key is absent** (`lib/steam/client.ts:187-192`),
  so a details-private account passes through with a present-but-all-zero games array.

## Weakened claim (the adversarial value)

- ⚠️ **WEAKENED:** "Affected users have public profile but non-public Game-details privacy" — this is the
  asserted **cause**, not provable from the repo. The code path that *surfaces* such zeros is confirmed,
  but whether Steam actually returns *games-with-zero-playtime* under details-private (versus omitting the
  `games` key, which would instead hit the `private` branch) is upstream Steam behavior the codebase
  cannot attest. → one live `GetOwnedGames` call closes it.

## Missed angles flagged by reviewer

- **Blast radius wider:** the game-detail page (`app/game/[appId]/page.tsx`) also reads playtime via
  live `getProfile`, so affected users see 0 there too.
- **Onboarding persists the same zeros.** `onboarding-backfill.ts:79,145,168` sources from the *same*
  `getProfile`; a user onboarded while details-private writes zeros into `OwnedGame.playtimeForever`
  and `PlaytimeSnapshot`. ⇒ The DB cross-check `played=0` does **not** independently prove "never played".
- **A brand-new / never-played account also yields all-zero** — code cannot distinguish details-private
  from genuinely-new; only the live Steam vs. real-profile comparison disambiguates.
- **Edge case:** if Steam *omits* `playtime_forever` (rather than sending `0`), `schemas.ts:32` (required)
  throws `ZodError → SteamApiError kind:'schema'` → `page.tsx` rethrows a 500, **not** the untouched
  symptom. The untouched symptom **requires** Steam to send `playtime_forever: 0` explicitly.

## Reproduction conditions

Users with a **public profile + public game list but "Game details" not set to Public**. Fully-public
users are unaffected; fully-private libraries hit the separate "Profile is private" empty state.

## Evidence requests (gated Steam/DB lane — not run here)

1. **Live Steam (closes the branch):**
   `GET .../IPlayerService/GetOwnedGames/v1/?key=$STEAM_API_KEY&steamid=<AFFECTED_ID>&include_appinfo=1&include_played_free_games=1`
   — confirm **both** (a) `response.games` present and non-empty, **and** (b) each entry has the literal
   field `playtime_forever: 0` (*present*, not omitted). If omitted → it's a Zod/500, not this symptom.
2. **Sanity check the real account** shows nonzero playtime in the Steam client/web UI (distinguishes
   "details-private hides real play" from "genuinely new account").
3. **Optional DB cross-check (interpret carefully):**
   `SELECT count(*) total, count(*) FILTER (WHERE "playtimeForever" > 0) played FROM "OwnedGame" WHERE "steamId" = '<ID>';`
   — `played=0` is also consistent with onboarding-while-details-private, so it is *not* proof of "never played".

## Suggested fix direction (one line — not implemented)

Detect the game-details-private condition (library present but all `playtime_forever === 0`) and surface
a distinct privacy notice instead of classifying every game as "untouched".

## Affected paths

`app/library/page.tsx` · `lib/games/sort.ts` · `lib/steam/client.ts` · `lib/steam/schemas.ts` ·
`server/repositories/profile.ts` · `server/cache.ts` · (blast radius) `app/game/[appId]/page.tsx` ·
`server/jobs/onboarding-backfill.ts`
