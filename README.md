# maltysnack.github.io

Personal site at [maltysnack.github.io](https://maltysnack.github.io).

## Pages

- `/` - homepage
- `/films/filmclub.html` - Filmclub link card
- `/projects/saltysnacks.html` - placeholder
- `/projects/fantasyfootball.html` - FPL Predicted XI (synced from public FPL API every 4h)
- `/dnd.html` - D&D character hub
- `/grosh.html`, `/reginald.html` - character sheets

## Stack

Vanilla HTML/CSS/JS, no build step. Served by GitHub Pages from `main`.
`sidebar.js` is the single source of truth for navigation.

## FPL sync

`scripts/sync-fpl.js` runs via GitHub Actions every 4 hours. Hits the
public FPL API, computes per-position calibration, writes
`projects/fpl-api-cache.json`. The browser reads same-origin JSON.
