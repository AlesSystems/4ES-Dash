# Task 07 — auth UI: sign in/out + user menu + landing (#65)

**Status owner:** implementer · **Depends on:** Task 02 (session) · **Blocks:** Task 08

## Scope (exactly these files)

- `components/auth/SignInButton.tsx`, `components/auth/UserMenu.tsx` (new)
- `app/(marketing)/page.tsx` or `app/landing/**` (logged-out landing)
- App shell wiring (app bar / sidebar) to show signed-in vs logged-out state
- Skeletons for auth-dependent regions
- `tests/**` (render + a11y for the menu)

Serialize any shared shell/barrel edits with the orchestrator — the app bar is a
merge point.

## Goal

Authentication UI: "Sign in with Steam", a signed-in user menu, and a logged-out
landing — wired into the existing app shell.

## Acceptance criteria

1. "Sign in with Steam" entry point (official Steam sign-in button styling/asset)
   starts the next-auth Steam OpenID flow.
2. Signed-in state: user menu in the app bar showing avatar + persona name, with
   sign-out and a link to account settings (Task 08).
3. Logged-out landing explains the app with a CTA to sign in; protected areas
   redirect here.
4. RSC by default; `"use client"` only where interaction requires it. Tailwind
   tokens only (no hardcoded hex). `lucide-react` icons (stroke 1.75).
   `next/image` with `sizes` for the Steam avatar (allow-listed
   `avatars.steamstatic.com`).
5. Skeletons for auth-dependent regions (no CLS); accessible (keyboard + screen
   reader for the menu).
6. Per-route JS budget < 200 KB gz; LCP < 2.5 s mid-tier mobile.

## Degraded / unavailable-data behavior

Auth in progress → skeleton. Sign-in failure → inline, friendly error with
retry, not a raw error page. Missing avatar → designed fallback.

## Definition of done for this task

- Failing test first; gate passes. Visual/a11y reviewed against `docs/DESIGN.md`.
- `state.json` task `07` set to `in-review`.
- Reviewer returns APPROVE.
