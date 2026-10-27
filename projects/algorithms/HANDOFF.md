# algorithms HANDOFF

Scratchpad for `/projects/algorithms/`.

## Status

- 5 modules: `algo-core.mjs` (shared search/optimisation kernel), `algo-grid.mjs`, `algo-tile.mjs`, `algo-tsp.mjs` (per-problem definitions + heuristics), `algo-viz.js` (entry, wires to DOM).
- `index.html` loads `algo-viz.js` as a module; the `.mjs` files chain-import via relative `./algo-*.mjs` paths so they keep working inside this folder.
- Rebuilt 22-10-2026 from maltysnack's review. See below.
- Moved from loose `projects/algorithms.html` + `projects/algo-*.{mjs,js}` 18-05-2026.

## Gotchas

- All algo files use a cache-buster (currently `?v=15`) in their import URLs. Bump the version in `index.html` and every `import` in `algo-viz.js` together when you change behaviour, or browsers serve stale modules.


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

## 23-10-2026: framing and structure

The rest of the 15-10 spec, section 7.

- **Reference tour.** `referenceTour(points)` in `algo-tsp.mjs`: the proven
  optimum by Held-Karp dynamic programming up to 15 points (checked against
  brute force up to 9; 15 points takes about 8 ms), and the best of 60 2-opt
  descents beyond that, labelled "best known" rather than optimal. Computed
  at the start of each run, drawn dashed under the final tour, and reported
  as a "Gap to optimum" / "Gap to best known" stat and in the status line.
- **No-guarantee framing** is in the tour prose, the status line and the
  closing line. The old prose claimed 240 million orderings at 12 points;
  the real count of distinct tours is about 20 million, fixed.
- **Structure.** Each demo opens with a one-sentence `.al-intro` naming the
  problem and closes with a `.al-proves` line on what it shows.
- **Runs on its own.** Each demo runs once when its board is half on
  screen (`AUTORUN` and an `IntersectionObserver` at the bottom of
  `algo-viz.js`; grid gets random walls first). It watches the board, not
  the section, because on a phone a section is taller than the screen. Any
  pointer, key or input in a section first cancels its autorun, so it never
  starts on top of a run the reader began.

## 26-10-2026: one-screen redesign

Agreed with maltysnack: `body.fit`, three tabs (Path, Tiles, Tour), one
canvas, one bar (algorithm picker, Run, New board, stat line), one line of
text per tab. Path: A*, BFS, Greedy, drag to draw walls. Tiles: A*, Greedy,
IDDFS, n=4, fixed Manhattan, plays once at a fixed pace (IDDFS gives up on
about 20% of boards; kept, it is the point). Tour: GA, ACO, 12 cities, gap
to the Held-Karp optimum. Beam, heuristic pickers, transport and prose cut.
Colours from the palette (seq ramp by visit order, accent for path/tour).
`index.html` and `algo-viz.js` rewritten, modules untouched (still `?v=15`),
viz at `?v=16`. The old prose, `.al-intro`/`.al-proves`, autorun-on-scroll
and the 22-10 transport described above are gone.

- Tab is in the hash (`#path`, `#tiles`, `#tour`); `hashchange` switches it.
- `epoch` cancels in-flight animations on tab switch or rerun.
- Path grid size comes from the stage: cell 8..22 px, so phones get a tall
  grid. Resizing to a new cell count deals a new board.
- Explored ramp is `--seq4..2`; `--seq5` was too close to the accent route.
- Tiles deals only boards with Manhattan h >= 5 (about 90% of deals).
- Checked in headless Chromium at 1280x800 and 375x812, light and dark: no
  scroll, no console errors.

## 28-10-2026: feedback fixes

- The algorithm pick survives New board and tab switches (`mode.algo`); New
  board used to rebuild the select and reset it to A*.
- Tiles line states the goal ("every yellow tile left of every blue one").
  No Wikipedia link: this is not the 15 puzzle, and no page matches it.
- Tour runs slower (GA 5 s, ACO 8 s) and the board is clickable: empty space
  adds a city, a city removes it (4 to 40 cities). Above 15 the gap is to the
  best known tour, not a proven optimum.
- Viz at `?v=17`.
