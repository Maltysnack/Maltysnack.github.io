# flock HANDOFF

Scratchpad for `/projects/flock/`. Root `HANDOFF.md` covers site-wide.

## Current state (23-10-2026)

Boids in 3D. Separation, alignment and cohesion only, no leader, plus a hawk
that chases the nearest bird and that birds flee. Fills the viewport, never
scrolls; the controls sit in a `<details>` panel (folded by default on phones).

- **three.js r160 is vendored** at `vendor/three.module.min.js` (MIT, no
  imports of its own). No CDN, so the page works offline and cannot break
  when a CDN changes. Upgrade by replacing the file and checking the page.
- Simulation is plain typed arrays with a counting-sort spatial hash sized to
  the vision radius; each bird checks 27 cells, not all N. Fixed 60 Hz physics
  step, decoupled from frame rate. 1,600 birds at about 57 fps on a laptop.
- One `InstancedMesh` of cones. Colours come from `--bg`, `--text` and
  `--accent`, and follow the theme toggle.
- Presets: Murmuration (default), School, Swarm. Moving a weight slider
  clears the preset highlight.
- Camera: drag to orbit, wheel or pinch to zoom, slow drift after 3 s idle
  (off under reduced motion).

## Ideas not taken

- Obstacles, wind, a second species. Keep it to the three rules unless one
  of these earns its place.

## 28-10-2026: quieter controls

The boxed panel is gone. Title and one paragraph top left (paragraph hidden
on phones), one uppercase text bar bottom left (presets, Hawk, Scatter,
Pause, Tune). Tune opens the six sliders above the bar; thin track, square
red thumb. Element ids unchanged, so the script is untouched.

## 29-10-2026: plan (maltysnack gave the go)

Two modes on one page, one shared engine. **Classic** (opens by default) is
the pure boids: three rules, cones, AI hawk, presets, Tune. **Skyline** is the
extended map: immersive view, flapping bird models, picker, player-steered
hawk with chase camera, fly-by plane, wind gusts with streaks, small skyline,
ambient perching. Decisions: Classic gets smoothing only (no feature changes,
no model picker); mode not remembered; birds fixed per device, no speed/pause/
count controls.

1. Classic fixes: soft steering (no normalised bang-bang), force low-pass,
   render interpolation, separation floor 0.3 with eased slider changes,
   tighter zoom range and closer default. Remove speed, pause, birds controls.
2. Split script into `flock.js` (engine) and `skyline.js` (extras), add mode switch.
3. Skyline: models and picker, then player hawk, then plane and gusts, then
   skyline and perching. Commit per concept.

## 29-10-2026: built

- `index.html` is markup and CSS only. `flock.js` is the engine (Classic) and
  calls hooks on `X` (the Skyline object) when that mode is on. `skyline.js`
  is lazy-loaded on first switch: bird models (cone, dart, bird, gull; wings
  flap in a patched vertex shader), player hawk (pointer or arrows, chase
  camera, "Fly hawk" toggles to AI hawk plus orbit camera), plane fly-by,
  wind gusts with streaks, six-building skyline with perch slots on the roof
  edges, ambient perching. Ambient gust/plane/perch run on their own timers;
  off under reduced motion (perching stays).
- Classic: soft proportional steering, force low-pass, render interpolation,
  separation floor 0.3, slider changes eased (`T` target, `P` live), zoom 40
  to 160. Speed stays in presets only. Bump `?v=` on `flock.js` and the
  `skyline.js` import in `flock.js` when either changes.
- Verified: node harness for the sim (smooth, no fps cliff at sep 0.3) and for
  the Skyline hooks (perch, takeoff, gust, plane, models, no NaN); assets
  resolve over a local server. NOT verified visually in a browser (no WebGL
  here), so flap look, hawk feel, chase camera and layout need an eyeball.
