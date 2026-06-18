# Screenshots

The PNG files in this directory are referenced from the root `README.md`.

## Current state

`home.png` and `library.png` are 1×1-pixel placeholder files committed so that
the link-checker (`pnpm check:docs`) passes on every branch before real
screenshots exist.

## How to capture real screenshots

1. Make sure you have real Steam credentials configured in `.env`
   (`STEAM_API_KEY`, `STEAM_ID`).
2. Start the dev server:
   ```bash
   pnpm dev
   ```
3. Open http://localhost:3000 in your browser and wait for the dashboard to
   fully load.
4. Take a screenshot of the full viewport and save it as
   `docs/screenshots/home.png`.
5. Navigate to http://localhost:3000/library and wait for the library grid to
   load.
6. Take a screenshot and save it as `docs/screenshots/library.png`.

Recommended dimensions: 1280×800 px at 1× device-pixel ratio so the images
render crisply in the README without being too large.

Replace the placeholder files with the real captures and commit them to `main`.
