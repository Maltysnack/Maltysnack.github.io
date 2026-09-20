# fpl HANDOFF

Scratchpad for `/projects/fpl/`. Root `HANDOFF.md` covers site-wide.

## Current state (20-09-2026)

- Page rebuilt as the bot's dashboard ("Malty's Team runs itself"): season
  line vs game average and Red Rebels, head-to-head, locked squad on a pitch
  (toggle bot / Red Rebels), transfer ledger, decision logs, model accuracy
  (predicted vs actual, pooled bias by position, captaincy hindsight), next
  GW top predictions + captain candidates + fixtures with bookmaker win
  probability, model card.
- Data: `dashboard.json`, built by the private engine (`Maltysnack/fpl`
  `public-dashboard.js`) and pushed here twice daily by its sync-and-publish
  workflow together with `api-cache.json` and `history.json`. The page reads
  only `dashboard.json`.
- Privacy rule: the bot's planned transfers, captain and chip for the
  UPCOMING gameweek are never published; squads, transfers and decision logs
  appear only for gameweeks whose deadline has passed.
- Layout: `<aside class="sidebar">` + `/sidebar.js`, `<main data-layout="full">`.
  Stylesheet is `../../style.css` (site tokens; light and dark).
- The old browser-side prediction formula, captain card and `sync.js` in this
  folder are retired; predictions come from the private engine only.

## Wiring

- `.github/workflows/sync-fpl.yml*` here are stale; the private repo's
  `sync-and-publish.yml` is the only publisher.
