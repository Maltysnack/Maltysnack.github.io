# projects HANDOFF

Index for `/projects/`. Every project owns its own folder and HANDOFF.
Root `HANDOFF.md` covers site-wide concerns.

## Subprojects

- [`fpl/HANDOFF.md`](fpl/HANDOFF.md): FPL bot dashboard, fed twice daily by a private engine
- [`worldcup/HANDOFF.md`](worldcup/HANDOFF.md): World Cup 2026 model. Stale; maltysnack is handling it separately
- [`flox/HANDOFF.md`](flox/HANDOFF.md): Flox, a small language for flow networks
- [`algorithms/HANDOFF.md`](algorithms/HANDOFF.md): algorithm visualisations

## Removed 15-10-2026

`happyhour/` and `coffeetime/` were deleted along with their Scriptable
widgets and the `happyhour-proxy.vercel.app` image proxy they shared.
Recoverable only from the pre-reset archive in
`~/Documents/maltysnack-archive/`.

## In flight

- **FPL page to be rebuilt by the user** from the FPL engine repo, driven by
  a `DISPLAY.md` there. The 23-10-2026 single-screen dashboard was judged
  incoherent: panels chosen without a brief. Do not iterate on it here.
- **World Cup** is likewise the user's; v2 lives at `worldcup/v2/`.

## Gotchas

- `projects/fpl/dashboard.json` is written by an external workflow. Do not
  hand-edit it; it will be overwritten twice a day.
- Both football projects are framed as **forecast calibration against market
  odds**, not betting. Same maths, better framing.
