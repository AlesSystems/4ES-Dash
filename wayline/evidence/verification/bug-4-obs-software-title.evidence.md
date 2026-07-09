# Evidence — OBS Studio (appId 1905180): no achievements, 0 hours, no image

> Read-only adversarial root-cause verification · branch `docs/bug-waylines` · 2026-06-30
>
> **Bug ID:** `bug-4-obs-software-title` · **Classification:** `needs-live-evidence` · **Confidence:** 5/5
>
> **Reviewer verdict:** `approve` · **Ready for planning:** ❌ no (gated on live check) · **Revise rounds:** 2

## Root cause

The report's mental model is REFUTED by code at HEAD. (1) The header image src is built from appId ONLY: buildHeaderUrl(appId) at lib/steam/client.ts:107-109 returns `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`, consumed at client.ts:199 as headerUrl: buildHeaderUrl(game.appid). img_icon_url only feeds buildIconUrl (client.ts:102-105 / used at 198), which library cards never render. A missing/empty logo hash therefore CANNOT break the image, and the CDN host is allow-listed in next.config.mjs images.remotePatterns:17. (2) 0 hours is the DESIGNED "Untouched" state: playtime.total = game.playtime_forever direct passthrough (client.ts:201), OBS genuinely reports 0, GameCard.tsx:34 maps playtimeMinutes===0 to the "Untouched" pill (lines 57-66/81-82); minutesToHours(0)→'0' / formatHours(0)→'0 h' are correct (playtime.ts:9-16) — no zeroing bug. (3) "No achievements" is the DESIGNED unavailable('no-achievements') degradation for a title with no achievement schema (achievements.ts:249/254). The ONE real latent defect: NO next/image onError fallback exists on ANY library/dashboard/game image-rendering component (GameCard, GameRow, GameTile, GameHero, RecentlyPlayed), in contrast to the positive control UserMenu.tsx:90-92 which DOES swap to a placeholder onError. So any title whose header.jpg actually 404s (delisted/region-locked) renders a broken box. Static analysis says OBS's appId-based header.jpg SHOULD load, so whether OBS's image is genuinely missing cannot be settled statically and requires a live /library render + network trace.

## Evidence — every item grounded in a file:line opened this run

| File | Line | Finding |
|------|------|---------|
| `lib/steam/client.ts` | 107-109 | buildHeaderUrl(appId) returns `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg` — appId-only; a missing logo hash cannot break it. Refutes the 'no image' cause. |
| `lib/steam/client.ts` | 198-199 | iconUrl: buildIconUrl(game.appid, game.img_icon_url); headerUrl: buildHeaderUrl(game.appid) — the card's image source is derived solely from appId, the logo hash only feeds iconUrl (unused by cards). |
| `lib/steam/client.ts` | 201-202 | playtime.total = game.playtime_forever — direct passthrough; OBS's 0 is real Steam data, not a zeroing bug. |
| `lib/steam/client.ts` | 88-90 | buildOwnedGamesUrl includes include_played_free_games=1, so free software like OBS IS returned in the library. |
| `components/library/GameCard.tsx` | 50-56 | <Image src={headerUrl} fill .../> with NO onError/placeholder — a 404 surfaces as an empty box. |
| `components/library/GameCard.tsx` | 34 | untouched = playtimeMinutes === 0 → designed 'Untouched' pill (57-66, 81-82). 0 hours is working-as-designed. |
| `components/dashboard/RecentlyPlayed.tsx` | 49-55 | <Image src={game.headerUrl} fill .../> with NO onError — same appId-based header.jpg, wired into the dashboard; a true fallback-less rendering sibling missed by prior round. |
| `components/auth/UserMenu.tsx` | 90-92 | Positive control: <Image> HAS onError swapping src to PLACEHOLDER_AVATAR — the exact pattern every library/dashboard/game image component lacks. |
| `lib/steam/achievements.ts` | 253-254 | success:true with achievements===undefined → unavailable('no-achievements','Game has no achievements') — designed degradation for no-schema titles like OBS. |
| `lib/format/playtime.ts` | 9-16 | minutesToHours(0)→'0', formatHours(0)→'0 h' — correct, no off-by-one or zeroing defect. |
| `next.config.mjs` | 12-19 | images.remotePatterns allow-lists cdn.akamai.steamstatic.com (line 17), so the header URL host is permitted by next/image. |
| `app/game/[appId]/page.tsx` | 113-114 | headerUrl falls back to an appId-only `.../steam/apps/${params.appId}/header.jpg` before being passed to GameHero (line 120), so GameHero's missing onError is reachable for delisted/region-locked titles. |
| `lib/steam/recently-played.ts` | 63-65 | buildHeaderUrl(appId) identical to client.ts — URL builder only; feeds RecentlyPlayed's fallback-less <Image>. |

## Stale anchors (seed line numbers that drifted vs HEAD)

| File | Claimed line | Note |
|------|--------------|------|
| `next.config.mjs` | 14-18 | Seed labels this 'CSP allow-lists cdn.akamai.steamstatic.com'. At HEAD it is images.remotePatterns (a next/image host allow-list) at lines 12-19 (host on line 17), NOT a Content-Security-Policy header. Functionally still permits the host; the 'CSP' framing is inaccurate. |
| `lib/steam/schemas.ts` | 71 | Accurate: headerUrl: z.string() at line 71 with comment 'Always resolvable — uses the standard CDN header path.' (line 70). Flagged because that comment is the over-promise the seed calls out — it is contradicted by the missing onError fallbacks. |
| `lib/steam/achievements.ts` | 243-255 | Seed cites 243-255. The no-achievements returns are at 249 (failure path) and 254 (success-but-no-array path); both present and accurate. Slight line offset from seed's 253-254 framing in evidence. |

## Blast radius

- components/library/GameCard.tsx:50-56 — <Image src={headerUrl}> no onError fallback
- components/library/GameRow.tsx:43 — <Image src={headerUrl}> no onError fallback
- components/games/GameTile.tsx:15-21 — <Image src={headerUrl}> no onError fallback
- components/game/GameHero.tsx:26-33 — <Image src={headerUrl}> no onError fallback (also priority-loaded); reachable via app/game/[appId]/page.tsx:113-114 appId-only header.jpg fallback
- components/dashboard/RecentlyPlayed.tsx:49-55 — <Image src={game.headerUrl}> no onError fallback; wired into app/page.tsx dashboard; same appId-based header.jpg as GameCard, so OBS would show a broken box here too
- lib/steam/recently-played.ts:63-65 — buildHeaderUrl appId-only URL builder (not a renderer); feeds RecentlyPlayed's fallback-less tiles
- components/auth/UserMenu.tsx:90-92 — POSITIVE CONTROL: the only next/image consumer that HAS the onError fallback
- FIX SCOPE: covers all SIX rendering components — GameCard, GameRow, GameTile, GameHero, RecentlyPlayed (dashboard); grep baseline is that only UserMenu.tsx currently has onError, so verify no other next/image consumer of a header/app image is missed

## Gated checks — human live lane (read-only; never run inside this verification)

### `steam-cdn`
- ```
  curl -s -o /dev/null -w '%{http_code}\n' https://cdn.akamai.steamstatic.com/steam/apps/1905180/header.jpg
  ```
  **Expect:** HTTP 200 — if 200, the appId-based header URL resolves and the missing image is NOT a 404; the static refutation holds and the symptom is an optimizer/stale-cache issue. If 404, the no-onError defect is the active fix scoped to this app.

### `render`
- ```
  # With real STEAM_ID env set: pnpm dev, then open http://localhost:3000/library and screenshot the OBS Studio (1905180) card
  ```
  **Expect:** OBS card renders header art + 'Untouched' pill + '0 h'. Confirms image loads (working-as-designed) or reveals a blank box (optimizer failure).
- ```
  # In browser DevTools Network tab on /library, filter '1905180' and '/_next/image'
  ```
  **Expect:** header.jpg request 200 AND the /_next/image optimizer transform 200. A non-200 on either isolates the true trigger of the observed missing image.

## Reviewer (adversarial, opus 4.8 · effort xhigh)

**Verdict:** `approve`

**Suite baseline:** No dedicated unit coverage for the image-error/fallback surface. tests/unit/GameCard.test.tsx, GameTile.test.tsx, GameRow.test.tsx, RecentlyPlayed.test.tsx, and GameCard-playtime-hidden.test.tsx exist, but a grep across them returns zero assertions on onError/fallback/placeholder/404 — they only cover playtime formatting and alt text. The latent defect (missing next/image onError fallback) is therefore unguarded by any current test. No unrelated suite was run, per instructions.

**Reasons / findings:**

- Re-opened all 13 cited anchors at HEAD (commit ee3a247) — every one matches: buildHeaderUrl(appId) is appId-only at client.ts:107-109; consumed at client.ts:199; playtime.total passthrough at client.ts:201; GameCard untouched/Untouched at GameCard.tsx:34,57-66,81-82; achievements no-achievements degradation at achievements.ts:249,254; minutesToHours(0)/formatHours(0) correct at playtime.ts:9-16; images.remotePatterns host allow-list at next.config.mjs:14-19 (host line 17); GameHero appId-fallback header at app/game/[appId]/page.tsx:113-114; recently-played builder at recently-played.ts:63-65. No anchor is stale or unflagged.
- Classification 'needs-live-evidence' is honest. The report's mental model (logo-hash / playtime causes the missing image) is genuinely REFUTED statically: buildHeaderUrl ignores img_icon_url entirely, and playtime is a separate field. 0 hours = designed Untouched state; 'no achievements' = designed unavailable('no-achievements'). The ONLY honest residual code defect is the missing next/image onError fallback, and whether it fires for OBS depends on whether 1905180/header.jpg actually 404s — a true live question correctly deferred.
- Evidence-vs-gatedChecks separation is clean: every 'evidence' entry is a static file:line code fact; NO runtime assertion leaked into evidence. The two runtime questions (does the CDN header.jpg resolve; does /library render the OBS card) are both correctly placed in gatedChecks (curl HTTP status + dev-render + DevTools network trace).
- Blast radius is complete for the header-image surface. Independent grep confirms exactly 5 components render an appId-based headerUrl image (GameCard, GameRow, GameHero, RecentlyPlayed, GameTile) and that UserMenu.tsx:90 is the ONLY onError handler in the entire codebase (the positive control) — matching the worker's FIX SCOPE with no missed header-rendering sibling.
- confirmedReadyForPlanning is true: the latent defect (missing onError fallback across all 5 header-rendering components) is isolated and actionable independent of the live trace; a working-as-designed bug with an isolated latent defect is plan-ready without a code fix needing to exist yet.
