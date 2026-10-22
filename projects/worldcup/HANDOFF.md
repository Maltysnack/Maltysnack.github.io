# worldcup HANDOFF

Scratchpad for `/projects/worldcup/`.

## Status

- Nightly auto-refresh wired (see commits `worldcup: nightly auto-refresh`).
- Predictions use Dixon-Coles goals model.
- Data files (`bracket.json`, `live.json`, `simulation.json`, `top-scorers.json`) sit in this folder. Fetched from `/projects/worldcup/<name>.json` by `index.html`.
- Moved from loose `projects/worldcup.html` + `projects/worldcup-*.json` 18-05-2026; data files lost their `worldcup-` prefix since the folder name carries it now.

## Gotchas

- If you change a JSON name, also update the `fetch()` calls in `index.html` (top of the data-load block).
- External: data generator lives in `github.com/Maltysnack/worldcup` (linked from the page). This folder only holds the published snapshot.


## Status 23-10-2026: stale, maltysnack is handling it

The 2026 tournament has been and gone. `simulation.json` and `bracket.json`
are frozen at `2026-06-06T02:06`, **before the first match**, with a
versioned Elo model (`elo-v4a-flat-mild+squad35+form`), per-match
probabilities and a top-scorer model.

That is worth more than it looks: it is a dated, unedited forecast that can
now be scored against what actually happened. Brier score, a calibration
curve, bracket accuracy by round, top-scorer hit rate, each against a naive
baseline. Published honestly, including where the model was wrong.

maltysnack wants to keep it going as an ongoing tracker and predictor for
future tournaments, and is doing that work separately. **Do not restyle or
restructure this page without asking.**

Doing the scorecard needs real 2026 results fetched and committed as a dated
snapshot, so it stays reproducible rather than depending on a live API.
