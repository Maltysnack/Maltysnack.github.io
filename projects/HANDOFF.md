# projects HANDOFF

Scratchpad for `/projects/` pages that don't have their own folder yet. Root `HANDOFF.md` covers site-wide.

Projects with their own folders own their own HANDOFFs:
- [`fpl/HANDOFF.md`](fpl/HANDOFF.md)
- [`flox/HANDOFF.md`](flox/HANDOFF.md)
- [`duoclue/HANDOFF.md`](duoclue/HANDOFF.md)

## Loose pages tracked here

- `happyhour.html` + `coffeetime.html` (sister projects, share infra)
- `worldcup.html` + `worldcup-*.json` (4 data files)
- `algorithms.html` + `algo-*.{mjs,js}` (5 algo files)

## happyhour + coffeetime

### Recently shipped

- Cinematic full-bleed slideshow per city. Photo via `happyhour-proxy.vercel.app` (Vercel proxy hides Unsplash key). Weather via Open-Meteo. ~280 cities embedded inline. ~150 with curated drinks/coffees. Local-language toasts/greetings. Real flagcdn flags. Regional minimap (continent-zoomed). Sequential fade-through-dark transition (4.5s fade, 600ms gap). 12hr time.
- Sister-link toggle (`happyhour. · coffeetime`) next to wordmark. coffeetime is an easter egg, not in sidebar/index. Empty state cross-recommends.
- **Photo quality bump (last change shipped)**: proxy now builds image URL from `urls.raw` with `w=2400&q=85` default (`?res=widget` returns 1080w/q82). Was using `urls.regular` (1080w fixed) which looked upscaled on retina/1440+.

### Decisions

- **Scriptable widgets** at `widgets/{happyhour,coffeetime}.js` are FROZEN. Do not update unless explicitly requested. Website-only focus from here.

## worldcup

- Nightly auto-refresh wired (see commits `worldcup: nightly auto-refresh`).
- Predictions use Dixon-Coles goals model.
- 4 JSON data files at `projects/worldcup-*.json` (bracket, live, simulation, top-scorers).

## algorithms

- 5 algo modules: `algo-core.mjs`, `algo-grid.mjs`, `algo-tile.mjs`, `algo-tsp.mjs`, `algo-viz.js`.
- No in-flight work.

## Gotchas

- These pages will eventually move into per-project folders (see root HANDOFF "Loose-page reorg"). When they do, this doc splits per project and shrinks to a link list.
