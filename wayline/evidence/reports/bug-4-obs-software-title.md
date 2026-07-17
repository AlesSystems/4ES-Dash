# Wayline — Bug #4: OBS Studio shows no achievements, 0 hours, no image

**Confidence: 5/5 that the report's stated causes are REFUTED** · 1 genuine latent
defect found · Status: needs a 60-second live reproduction to explain the *observed*
missing image

## Symptom

> OBS Studio game has no achievements and if user clicks on the library page, it
> shows 0 hours and no image.

OBS Studio = Steam appId **1905180** (a free *software* title, not a game).

## ⚠️ Headline finding — two of three symptoms are *correct designed behavior*

The scout traced all three sub-symptoms and **refuted the report's mental model**.
OBS is not an edge case that breaks this codebase:

| Sub-symptom | Verdict | Why |
|---|---|---|
| **No image** | **Cause as described = REFUTED** | Card art is built from `appId` only, *not* `img_icon_url`/`img_logo_url` hashes; OBS's `header.jpg` returns **HTTP 200** on the CSP-allow-listed CDN. The image *should* render. |
| **0 hours** | **NOT A BUG** | Steam genuinely reports `playtime_forever: 0` for OBS; the card renders the designed **"Untouched"** state. No conversion/join/zeroing bug. |
| **No achievements** | **NOT A BUG** | OBS has no achievement schema → `unavailable('no-achievements')` → designed "This game has no achievements" empty state. Exactly the degradation contract. |

**The one genuine (latent, low-severity) defect:** the Library cards call `next/image`
with **no `onError`/placeholder fallback**, so *if* a title's `header.jpg` ever 404s
(delisted/region-locked apps — **not** OBS), the optimizer renders a broken/empty box.

## Evidence

**Image — appId-based, not logo-hash based:**
| Location | Finding |
|---|---|
| [lib/steam/client.ts:107-109](../../lib/steam/client.ts#L107) | `buildHeaderUrl(appId)` = `…/steam/apps/${appId}/header.jpg` — **only `appId`**; empty logo art can't break it. |
| [lib/steam/client.ts:199](../../lib/steam/client.ts#L199) | `headerUrl: buildHeaderUrl(game.appid)` — the card's source. |
| [lib/steam/client.ts:102-105](../../lib/steam/client.ts#L102) | `buildIconUrl` (the only consumer of `img_icon_url`) feeds `iconUrl`, which the Library card does **not** render. |
| [lib/steam/schemas.ts:71](../../lib/steam/schemas.ts#L71) | `headerUrl: z.string()` "**Always resolvable**" — an over-promise (see fix). |
| [next.config.mjs:14-18](../../next.config.mjs#L14) | CSP allow-lists `cdn.akamai.steamstatic.com` → URL permitted. |
| [components/library/GameCard.tsx:50-56](../../components/library/GameCard.tsx#L50), [GameRow.tsx:43](../../components/library/GameRow.tsx#L43) | plain `<Image src={headerUrl}/>` — **no `onError`/placeholder** (contrast [components/auth/UserMenu.tsx:90](../../components/auth/UserMenu.tsx#L90) which *has* `onError`). |
| Live check | OBS app 1905180 `header.jpg`, `capsule_231x87.jpg`, `library_600x900.jpg`, `logo.png` all **HTTP 200** on the allow-listed host. |

**0 hours — designed "Untouched", real Steam data:**
| Location | Finding |
|---|---|
| [lib/steam/client.ts:200-203](../../lib/steam/client.ts#L200) | `playtime.total = game.playtime_forever` — direct passthrough; OBS = 0. |
| [lib/format/playtime.ts](../../lib/format/playtime.ts) | `minutesToHours(0)→'0'`, `formatHours(0)→'0 h'` — correct, no zeroing bug. |
| [components/library/GameCard.tsx:34,57-82](../../components/library/GameCard.tsx#L34) | `untouched = playtimeMinutes === 0` → "Untouched" pill (designed state). |
| [app/library/page.tsx:58](../../app/library/page.tsx#L58) | join by `appId` is sound. |

**No achievements — graceful degradation:**
| Location | Finding |
|---|---|
| [lib/steam/achievements.ts:243-255](../../lib/steam/achievements.ts#L243) | `!success` / no `achievements` array → `unavailable('no-achievements')`. |
| [server/repositories/achievements.ts:64-66](../../server/repositories/achievements.ts#L64) | passes the Availability straight through. |
| [components/game/AchievementList.tsx:130-138](../../components/game/AchievementList.tsx#L130) | renders the designed "no achievements" `UnavailableState`. |

**ERROR.md:** no existing ERR covers software/empty-art or software-zero-playtime;
closest are ERR-0002 (achievements 403→privacy) and ERR-0015 (all-zero-playtime
privacy heuristic) — both *privacy*, not *software titles*.

## Data-flow trace

```
/library: getProfile → cache('owned-games') → getOwnedGames
   (URL has include_played_free_games=1, so free OBS IS returned — client.ts:88-90)
   → map {appId, headerUrl: buildHeaderUrl(appId) [valid 200], playtime.total: 0}
   → GameCard: <Image src={headerUrl}> renders; playtimeMinutes===0 → "Untouched"
achievements: game detail → getGameAchievements → unavailable('no-achievements') → empty state
```
OBS flows through cleanly in static analysis: image *should* load, hours show
"Untouched", achievements show the empty state.

## ⚠️ The real open question → how to reach 5/5 on the *observed* missing image

The scout is **5/5 that the cited mechanisms aren't the cause**, but the user *did*
observe a missing image. The static + live-CDN evidence says it should render — so the
true trigger is something reproduction will reveal, most likely one of:

- A **delisted/region-locked** app whose `header.jpg` actually 404s (the latent
  no-`onError` defect), and OBS was a misattribution.
- A **`next/image` optimizer** failure (timeout/transform) that the missing fallback
  turns into a blank box.
- A **stale observation** from before an earlier art/CSP fix.

→ **Close it:** run the app against the real `STEAM_ID`, open `/library`, screenshot
the OBS card, and check the network tab for the `header.jpg` request status + the
`/_next/image` optimizer response. (Offered — not yet done; it's a live-env step.)

## Blast radius

- **Image fallback gap** is repo-wide and identical for all titles:
  [recently-played.ts:63-65](../../lib/steam/recently-played.ts#L63),
  [components/games/GameTile.tsx:15](../../components/games/GameTile.tsx#L15),
  [components/game/GameHero.tsx:26](../../components/game/GameHero.tsx#L26),
  [GameRow.tsx:43](../../components/library/GameRow.tsx#L43) — none have an image
  `onError`. Only *delisted/region-locked* art would surface a broken `<Image>`.
- **"Untouched" + "no achievements"** apply to every never-played / no-schema title
  by design.
- **Connected to Bug #5:** software titles like OBS are exactly the apps that fall
  into the Insights "Unknown" genre bucket — see
  [bug-5-insights-unknown-label.md](bug-5-insights-unknown-label.md).

## Fix direction (described, not implemented)

1. **Image robustness (the only real, low-severity defect).** Add an `onError`
   fallback to a branded placeholder (pattern exists at
   [UserMenu.tsx:90](../../components/auth/UserMenu.tsx#L90)) applied consistently to
   `GameCard`, `GameRow`, `GameTile`, `GameHero`, recently-played. Soften the
   "Always resolvable" comment at [schemas.ts:71](../../lib/steam/schemas.ts#L71).
2. **0 hours** — no code fix (accurate). Optional UX: label Steam-classified
   non-games as "Tool"/"Software" instead of "Untouched" — needs Store-API `type`
   (T2 enrichment), not a bug fix.
3. **No achievements** — no fix; correct designed empty state.

## → Agentic loop seed

- **FIRST task = reproduce, don't fix.** This wayline's most important output is that
  the report's model is wrong. The loop must begin with a live `/library` screenshot
  + network trace for OBS to find the *actual* trigger before any code changes.
- **If repro shows the image renders:** close as "working as designed"; ship only the
  `onError` hardening as a separate low-priority task.
- **If repro shows a 404/optimizer blank:** the `onError` fallback (#1) becomes the
  fix, scoped to whatever app actually 404s.
- **Acceptance criteria (hardening task):** any title whose `header.jpg` 404s renders
  a designed placeholder, not a broken image; assert via a card test with a failing
  image URL.
- **Reviewer checks:** the fallback covers all five components; "Untouched" and
  "no achievements" states untouched.
- **ERROR.md:** append `ERR-XXXX` recording that software titles degrade correctly
  (zero-playtime + no-achievement empty states) and that the image-`onError` gap is a
  hardening follow-up — **not** an active OBS bug.
