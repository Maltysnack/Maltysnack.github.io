# projects HANDOFF

Index for `/projects/`. Every project owns its own folder + HANDOFF.

## Subprojects

- [`fpl/HANDOFF.md`](fpl/HANDOFF.md): FPL Predicted XI
- [`flox/HANDOFF.md`](flox/HANDOFF.md): Flox docs
- [`happyhour/HANDOFF.md`](happyhour/HANDOFF.md): Happy Hour (with sister page Coffee Time)
- [`coffeetime/HANDOFF.md`](coffeetime/HANDOFF.md): Coffee Time (easter-egg sister of Happy Hour)
- [`worldcup/HANDOFF.md`](worldcup/HANDOFF.md): World Cup 2026 simulator
- [`algorithms/HANDOFF.md`](algorithms/HANDOFF.md): algorithm visualisations

## Current state (as of 18-05-2026)

- Loose-page reorg completed 18-05-2026: happyhour, coffeetime, worldcup, algorithms each got their own folder with `index.html` + assets + HANDOFF. No redirect stubs (site has no inbound traffic from the old URLs).

## Gotchas

- happyhour and coffeetime share the `happyhour-proxy.vercel.app` image proxy and the same inline city list. Treat them as one project for design decisions; per-page state lives in each HANDOFF.
- Scriptable widgets at `projects/happyhour/widget-{happyhour,coffeetime}.js` are FROZEN (see happyhour HANDOFF).
