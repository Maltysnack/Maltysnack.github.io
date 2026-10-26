# fpl HANDOFF

Scratchpad for `/projects/fpl/`. Root `HANDOFF.md` covers site-wide.

## Current state (26-10-2026)

- Page is the bot's dashboard; see Layout below for what it shows now.
- Data: `dashboard.json`, built by the private engine (`Maltysnack/fpl`
  `public-dashboard.js`) and pushed here twice daily by its sync-and-publish
  workflow together with `api-cache.json` and `history.json`. The page reads
  only `dashboard.json`.
- Privacy rule: the bot's planned transfers, captain and chip for the
  UPCOMING gameweek are never published; squads, transfers and decision logs
  appear only for gameweeks whose deadline has passed.
- Layout: `<aside class="sidebar">` + `/sidebar.js`, `<main data-layout="wide">`.
  Stylesheet is `../../style.css` (site tokens; light and dark).
- The old browser-side prediction formula, captain card and `sync.js` in this
  folder are retired; predictions come from the private engine only.

## Layout (26-10-2026)

Rebuilt to the brief in the engine repo's `DISPLAY.md` (`Maltysnack/fpl`). Read that before changing the page; the page adds nothing the brief does not ask for.

- Four ideas, each a generated sentence heading plus one figure: gap to the average manager (cumulative line), where the points went (captaincy, bench, transfers, hits), model error vs FPL's own xP plus squad honesty sentence, next GW deadline and top five model picks.
- Masthead: total, rank, verdict sentence, last GW and chips as small print.
- Scrolling page, `data-layout="wide"`, two columns, one under 720px.
- Dropped: squad pitch, per-position error table, honesty strip, predicted vs actual chart, line toggles, pace tile. Data still in `dashboard.json`.

## Wiring

- `.github/workflows/sync-fpl.yml*` here are stale; the private repo's
  `sync-and-publish.yml` is the only publisher.
