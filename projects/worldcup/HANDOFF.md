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
