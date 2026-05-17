# happyhour HANDOFF

Scratchpad for `/projects/happyhour/`. Coffeetime is the sister page; it lives at `/projects/coffeetime/` and has its own HANDOFF.

## Recently shipped

- Cinematic full-bleed slideshow per city. Photo via `happyhour-proxy.vercel.app` (Vercel proxy hides Unsplash key). Weather via Open-Meteo. ~280 cities embedded inline. ~150 with curated drinks/coffees. Local-language toasts/greetings. Real flagcdn flags. Regional minimap (continent-zoomed). Sequential fade-through-dark transition (4.5s fade, 600ms gap). 12hr time.
- Sister-link toggle (`happyhour. · coffeetime`) next to wordmark. coffeetime is an easter egg, not in sidebar/index. Empty state cross-recommends.
- **Photo quality bump**: proxy now builds image URL from `urls.raw` with `w=2400&q=85` default (`?res=widget` returns 1080w/q82). Was using `urls.regular` (1080w fixed) which looked upscaled on retina/1440+.
- Moved from loose `projects/happyhour.html` into its own folder 18-05-2026.

## Decisions

- **Scriptable widgets** at `projects/happyhour/widget-{happyhour,coffeetime}.js` are FROZEN. Do not update unless explicitly requested. Website-only focus from here. Both widgets live under happyhour because coffeetime is its sister page and they share the proxy + city list; moved here 18-05-2026 from the now-deleted root `widgets/` folder.

## Gotchas

- Sister-page link points at `/projects/coffeetime/`. If you rename or remove coffeetime, update the wordmark row and the empty-state retry button.
