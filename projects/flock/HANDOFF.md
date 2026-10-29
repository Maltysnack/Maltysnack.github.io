# flock HANDOFF

> **Standing rule:** the home page embeds `/projects/flock/?ambient` live.
> Every new UI, control or input must be gated off in ambient mode, and no
> Flock change is done until `?ambient` has been checked (chrome hidden, no
> input, 30 fps cap, reduced-motion still frame, phone budget).

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

## 29-10-2026: Skyline round 2

- Skyline opens in Watch mode (AI hawk, orbit camera); Fly hawk is opt-in, and
  the pointer is ignored until it moves after flying starts (was steering
  from the mode button's corner). Model picker, Gust and Fly-by buttons gone:
  Classic is the cone, Skyline is the bird, weather and visitors are ambient.
- Gusts slower (9 u/s, 16 s) and stronger; birds reacting to a gust, a visitor
  or the parachutist tint toward the accent (per-bird `instanceColor`, base
  colour now lives in that attribute while Skyline is on).
- Visitor roll (`KINDS` in `skyline.js`): plane, blimp (banner is
  `/icons/icon-192.png` on a canvas with a cloth-ripple shader), hang glider,
  jetpack figure, cloud (gentle avoidance, k 0.8, so fleeing birds can clip
  it). Lane height is clamped to roof top + 8 + the kind's hang + bob, so
  nothing can touch a building. A parachutist steps off the tallest roof's
  front edge now and then (collision-pushed away from walls).
- Headless check (6 min of sim): visitor bounding boxes never intersected a
  building, min clearance 9.8 over the roof; chute never hit one; tint and
  perching work. Still not eyeballed in a browser.

## 29-10-2026: `?ambient` (home page embed)

- `flock.js` reads `?ambient`: forces Skyline in watch mode with a slow
  auto-orbit (camera high and loose), 900 birds (600 phone), pixel ratio cap
  1.5 (1 on phone), 30 fps cap, no work while `document.hidden` or scrolled out
  of view (IntersectionObserver), all pointer/wheel input ignored. Reduced
  motion: simulate 4 s, render one frame, no loop (re-renders only on theme or
  resize). Phone: visitors and gusts half as often, at most 2 clouds.
- `index.html` hides the nav, title, bar, mode switch and stats with
  `html[data-ambient]` (set by a tiny inline script) and disables canvas
  pointer events. `sidebar.js` still loads (sanitize needs it); it is hidden.
- Theme: parent posts exactly `{type:'flock-theme', theme:'light'|'dark'}`;
  same-origin only; sets `data-theme` on the iframe's html, which re-themes
  the scene (and the still frame).
- Checked with a DOM-stubbed node run (ambient: 300 renders per 600 ticks, so
  30 fps; reduced: 2 renders and no loop; phone and normal modes fine). Not
  eyeballed in a browser.

## 29-10-2026: global wind, plane jumpers, storms, blinking beacon

- Wind is one direction for the whole map (+x, -x or +z, never toward the
  skyline front), picked each time Skyline starts. A light breeze pushes every
  bird, cloud, canopy and banner; a gust is a front (Gaussian band, 40 wide,
  13 u/s) that sweeps the full width of the map, with ripples along it.
  Streaks (440) fill the whole map, lengthen and brighten inside the front.
  Canopies drift with the wind (harder in a gust). `?debug` buttons: gust.
- Chutes are an array now (max 5). Planes carry 0 to 2 jumpers (55% of
  planes), who only leave over open ground (z > -4, inside the box), shed the
  plane's speed in the fall, then open and drift. Tower jumper unchanged
  except it edges +z away from the skyline.
- 30% of clouds are storm clouds (darker, tinted). Every 7 to 15 s one inside
  the box strikes: jagged thin-box bolt (yellow, 0xffd23c), branches, one soft
  sky flash (peak 0.2, no strobe), storm clouds glow briefly, birds near the
  bolt scatter and tint, perched ones leave. The tall tower draws strikes when
  a storm is within 40. Off under reduced motion (inside the ambient gate).
  `?debug` buttons: storm, strike.
- Beacon blinks (0.35 s every 1.8 s) in `--d2`, not the accent (accent means
  warning/avoidance).
- Checked headless: 6 min sim and 24 plane passes (67 chutes), zero building
  intersections; ambient/reduced/phone/normal modes load via a DOM stub.
  Still not eyeballed in a browser. Ambient embed (`?ambient`) gets all of
  this; confirm the flash is not too bright behind the home page text.
