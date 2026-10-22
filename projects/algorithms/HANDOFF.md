# algorithms HANDOFF

Scratchpad for `/projects/algorithms/`.

## Status

- 5 modules: `algo-core.mjs` (shared search/optimisation kernel), `algo-grid.mjs`, `algo-tile.mjs`, `algo-tsp.mjs` (per-problem definitions + heuristics), `algo-viz.js` (entry, wires to DOM).
- `index.html` loads `algo-viz.js` as a module; the `.mjs` files chain-import via relative `./algo-*.mjs` paths so they keep working inside this folder.
- Rebuilt 22-10-2026 from maltysnack's review. See below.
- Moved from loose `projects/algorithms.html` + `projects/algo-*.{mjs,js}` 18-05-2026.

## Gotchas

- All algo files use a cache-buster (currently `?v=13`) in their import URLs. Bump the version in `index.html` and every `import` in `algo-viz.js` together when you change behaviour, or browsers serve stale modules.


## 22-10-2026 rebuild

Three problems maltysnack identified, and what was done about each.

**Tour planning was the weakest demo**, for a concrete reason: the search ran
invisibly and only the single finished tour was ever drawn, so 29 of 30 ants
did nothing you could see. `drawPopulation()` now draws every candidate tour
faintly with the current best on top, every frame. The data was already
there: `createACO` exposed `lastTours` with the comment "for visualisation"
and nothing consumed it.

The search also finished inside one frame on a small problem, so the
population would have flashed past. `runIterations` now spreads iterations
over `SEARCH_TARGET_TOTAL_MS` (4s), the same approach the grid search used.

**Random walls** were uniform 25% noise, which reads as clutter. They are now
grown as short straight runs to `WALL_COVERAGE` (16%), with the cells around
start and goal kept clear.

**The sliding tile** ran at 150ms with a wholesale board redraw, too quick to
see which tile moved. It now has a five-stop speed control (default slow),
play/pause, and previous/next buttons. The solution is retained so it can be
replayed and walked in either direction. `tileResetPlayback()` must be called
by anything that invalidates the current solution, or the transport acts on a
stale path.

## Still to do

maltysnack's framing note: the page should state plainly that GA and ACO are
metaheuristics with **no optimality guarantee**, and report the gap to the
best known tour as a percentage. Reaching within a few percent in
milliseconds, where exact search is factorial, is the achievement. Framing
the limitation as the lesson turns the page's weakest moment into its most
informative one. Not implemented yet.
