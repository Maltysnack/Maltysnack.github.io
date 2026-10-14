# algorithms HANDOFF

Scratchpad for `/projects/algorithms/`.

## Status

- 5 modules: `algo-core.mjs` (shared search/optimisation kernel), `algo-grid.mjs`, `algo-tile.mjs`, `algo-tsp.mjs` (per-problem definitions + heuristics), `algo-viz.js` (entry, wires to DOM).
- `index.html` loads `algo-viz.js` as a module; the `.mjs` files chain-import via relative `./algo-*.mjs` paths so they keep working inside this folder.
- No in-flight work.
- Moved from loose `projects/algorithms.html` + `projects/algo-*.{mjs,js}` 18-05-2026.

## Gotchas

- All algo files use cache-buster `?v=9` in their import URLs. Bump the version in `index.html` and every `import` in `algo-viz.js` together when you change behaviour, or browsers serve stale modules.
