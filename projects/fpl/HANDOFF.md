# fpl HANDOFF

Scratchpad for `/projects/fpl/`. Root `HANDOFF.md` covers site-wide.

## Current state (23-10-2026)

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

## Single-screen layout (23-10-2026)

The page fits the viewport with no scrolling (`body { height: 100dvh; overflow: hidden }`,
page-scoped). Panels sized by importance per the 15-10 spec:

- **Model accuracy, largest**: predicted vs actual squad columns per GW, the
  honesty strip (percentile of the real score among 20,000 resamples) on the
  same x positions, per-position error table, captaincy and totals.
- **Season**: line vs game average, cumulative and rank toggles.
- **Squad**: starting XI on a pitch sized with container query units. Bench dropped.
- **Next gameweek**: deadline and the model's league-wide top picks, as many
  rows as fit, never a clipped row.
- Footer states the privacy rule.

Dropped from the page: transfer ledger, decision log cards, model card,
points-by-position chart, fixtures with bookmaker odds, accuracy drill-down.
The data is still in `dashboard.json` if any comes back.

Charts draw at real pixel size via a `ResizeObserver` (`sized()`), so text
never stretches. Breakpoints: at 1100px the squad and chips tile drop; at
720px it is one column, accuracy over season, everything else dropped.
Under 540px tall it falls back to scrolling rather than clipping.

## Wiring

- `.github/workflows/sync-fpl.yml*` here are stale; the private repo's
  `sync-and-publish.yml` is the only publisher.
