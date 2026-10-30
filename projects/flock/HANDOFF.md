# flock HANDOFF

> **The root `/index.html` is the Flock page** (the home page). This folder
> holds the engine (`flock.js`, `skyline.js`, vendored three.js) and this
> HANDOFF; `projects/flock/index.html` is only a redirect to `/` that keeps the
> query string. UI and markup changes go in the root `index.html`; bump
> `flock.js?v=N` there, and the `skyline.js?v=N` import in `flock.js`, whenever
> either file changes. Check `/` (intro, `?nointro`, idle fade) before calling
> a change done.

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

## 29-10-2026: `?intro` (local prototype, NOT committed)

- `?intro`: always dark; nav, title, bar and stats hidden (opacity; fade in
  after the hand-off); full Skyline at normal rate. "Hello." is drawn white on
  a 2D overlay canvas (Big Shoulders 900), so the sampled pixels are exactly
  what is shown. **No auto-burst**: waits for a click, tap or key press.
- On input: about 700 birds (380 phone) are recruited from the existing flock
  (off screen or behind the camera first, then furthest from it), pinned
  (skyline state 3, `X.recruit`) exactly on the letters' pixels on a flat
  plane at 0.55 x orbit radius, scaled so their length is ~1.1 x the spacing
  (`scl` array in flock.js), and lying with nose to screen right, wings up and
  down. The text cross-fades out over 0.22 s. Birds release staggered outward
  from the click (0.2 to 1.1 s), with an outward kick, then flock normally;
  scale eases back to 1 over 1 s. UI reveals at 0.9 s. Bird count never changes.
- Colour is not lerped: birds are already the text colour (white in dark).
- Reduced motion: no Hello., UI shown at once. Every load plays it.

## 29-10-2026: polish round (local, uncommitted with ?intro)

- Beacon: thin mast plus a small ball on the tallest roof, blinks in the
  accent red (0.35 s every 1.8 s). Strikes now end at the antenna tip.
- Hawk perches on free roof edges. AI hawk: every 25 to 45 s it lands on the
  nearest free edge below it within 45, rests 6 to 12 s, takes off. Player
  hawk: Space near a roof (within 16) to land, any arrow or Space to leave.
  Wings fold while perched; birds keep clear but flee at 1/3 strength
  (`X.hawkCalm`) and perched birds only leave if it comes within 9. Debug
  button: perch.
- Lightning every 25 to 50 s (first 15 to 30 s), 1 in 5 clouds are storm clouds.
- Idle: 5 s with no input starts the auto-spin; 10 s fades the nav, header
  line, controls and cursor (`html[data-idle]`). Any pointer move, press, key,
  wheel or touch brings them back; an open Tune drawer counts as activity.
  Not applied in `?ambient`. Intro reveal uses `data-revealing` for its slower fade.
- Header: the Flock title and paragraph are gone; a small "based on boids"
  line sits top left. Removing the Flock nav tab (if home becomes Flock) is a
  sidebar.js / root index.html job for the master session.
- Nothing from `?intro` onward is committed (master asked for local only).

## 29-10-2026: live round (intro default, dark only, bigger soft world)

- **Intro is the default** on /projects/flock/ (Skyline opens under a big
  Hello.; click, tap or key bursts it). `?nointro` skips it and opens Classic.
  Reduced motion skips the intro. `?ambient` still works and is unchanged
  except it no longer takes theme messages (the page is dark only).
- **Dark only**: the page holds `data-theme=dark` whatever the nav toggle
  does (MutationObserver lock at the top of flock.js). The site-wide removal
  of light mode and the toggle is the master session's job.
- **World ~30% bigger** (117 x 58 x 78 half extents; skyline, fog and camera
  range scaled to match; bird count unchanged, so the flock is looser).
- **Soft edge** replaces the wall: nothing pushes until 6 inside the edge,
  then the pull home is 0.9e + 0.02e^2 (e = distance past), so wind carries
  birds out and they drift back. Under a constant 34 wind they settle about
  50 past the edge. The ground stays firm. Hawk clamp widened to 30 past.
- **Gusts**: weaker (34), front 75 wide, slanted, wavy and patchy so it
  arrives in cells rather than a wall.
- **Hawk lands**: birds on that roof leave staggered, none land there while
  the hawk is on it.
- **Lightning**: birds within 55 of the cloud get an instant outward kick and
  keep fleeing it for 2 s.
- **Edges**: clouds fade (own material per cloud) and visitors shrink across
  the outer margin instead of popping out.
- **Blimp** 35% bigger, banner 9 long (was 14).
- Cache-busting now: flock.js?v=9, skyline.js?v=11.
- Checked headless: Skyline hooks, 66 chutes and 24 planes with zero building
  hits, perch cycle, soft edge under wind, intro/nointro/ambient/reduced
  modes. Still not eyeballed in a browser.

## 29-10-2026: ambient removed

- `?ambient` and everything that served it is gone (iframe-only chrome hiding,
  theme message listener, 30 fps cap, pause on hidden, reduced-motion still
  frame, phone budget). The home page no longer iframes Flock.
- `projects/flock/index.html` is a redirect to `/` (query kept, so
  `/projects/flock/?nointro` lands on `/?nointro`).
- Modes now: `/` (intro, opens in Skyline), `/?nointro` (Classic, no intro),
  `?debug` adds the spawn buttons. Reduced motion skips the intro.
- Earlier HANDOFF sections that mention `?ambient` or "projects/flock/index.html
  as the page" are history.
- Cache-busting now: root loads `flock.js?v=10`; `flock.js` imports `skyline.js?v=12`.

## 29-10-2026: city and tornado (local, not pushed)

- **City**: 44 seeded buildings (`rand` seed 1987, so identical every visit):
  the hero tower (x 3, z -47, 102 tall, antenna and jumper), three rows behind
  it (z -36, -58, -82; heights to 95, taller toward the centre) and three
  columns of wings each side (|x| 114 to 148, z -22 to -62) that stop well
  short of the open ground. One instanced mesh plus one merged outline.
  About a dozen perch slots a roof. Birds only test buildings near them.
- **Lanes** now clear whatever is under the pass: `roofMax()` takes the
  highest roof within 16 of the lane and adds 8 + the visitor's hang and bob.
  Over the hero a plane flies around y 54 (the blimp about 60, just above the
  58 ceiling). Passes can reach above the flock.
- **Tornado** (rare: first 90 to 180 s, then every 3 to 6 min; `?debug` button
  tornado). It crosses the open ground (lane z 2 to 48, meander 9, 6 to 9 u/s,
  x direction only, so it never meets the city) under its own storm cloud. 18
  spinning rings, 320 specks and dust. Birds within 40: spin 34, inward pull
  40 (outside the core), lift 30; core repels. Perched birds within 30 leave.
  Ordinary clouds are dragged round (to 60), planes and blimps shoved off line
  and bobbed (to 55), canopies and the hawk displaced (moderate: 9 spin, 5
  inward, 5 lift, scaled 0.8 for the hawk, plus a little yaw spin), wind
  streaks curl round it. Buildings untouched.
- Headless: 57 chutes and every visitor pass with zero building hits, perch
  cycle, tornado force probe (spin, pull and lift point the right way), intro
  hand-off (706 recruited, count constant), idle fade. Not seen in a browser.
- Cache-busting: root loads `flock.js?v=11`, which imports `skyline.js?v=13`.

## mountains, river, breeding weather (local, not pushed, 30-10-2026)
- skyline.js: 5 cone mountains on the open (+z) side (`PEAKS`, tallest 84), rock and snow vertex colours, perch slots on summits, force/hawk/chute/strike all aware of `terrainY`. Parachutists also jump off the tallest summit toward open ground.
- River: Catmull-Rom ribbon from inside the big mountain off the map. 66 fish (boids held to the channel) and 3 sailboats that turn at the ends.
- Weather breeds: clouds and storms spawn in chains (70% / 80% chance the next follows in seconds, else a long quiet). Cap 24 clouds, 14 storms. The tornado now spawns when 10 storms are alive (4 min cooldown), no timer. Lightning rate scales with storm count. Tornado lane moved to z -6..10 (clear of the mountains).
- Debug: `storms` button spawns 10 storms (forces a tornado). skyline.js v14, flock.js v12.

## second local batch (30-10-2026, not pushed; skyline.js v15, flock.js v13)
- Streets cut through the gaps between tower rows (z -24, -46, -70, -96), 18 cars and 5 trucks on them (U-turn at dead ends). City rows no longer jitter in z (same random sequence, layout shifts slightly).
- Town of up to 12 small buildings plus a dock and boathouse on the river near the mountains; boats sometimes tie up at the dock for 18 to 35 s.
- Blimp 2.6x with a square flag (256px canvas). Visitors now fade out at the edge instead of shrinking (cloned materials, `fadeable`).
- Wind is an angle that turns slowly, dies to a lull, then returns from a new direction (`stepWind`, `windStr`). Clouds are pushed by it, with very little of their own motion, and ride up over buildings and mountains. Streaks swirl and spiral round the tornado.
- Rain (light blue) from every storm once 5 are up (full at 8); ordinary clouds over mountains snow. Rain and snow are pooled line/point systems in `weatherStep`.
- Rare `military` transport (weight 3) drops a stream of 14 jumpers over open ground; ordinary planes no longer drop anyone. Chutes now settle on a roof they touch.
- Hawk nest on the second mountain (slot with `nest: true`): AI visits 25% of the time and stays 80 to 100 s (roofs 16 to 24 s); other birds are pushed away within 20.
- Removed the Murmuration/School/Swarm buttons and the Tune drawer; `drift()` in flock.js blends the three presets on its own (40 to 80 s holds, 25 s blends). Classic mode still exists.
- Debug: `military` button added.

## third local batch (30-10-2026, not pushed; skyline.js v16, flock.js v14, root index flock.js v14)
- World is bigger: box 316 x 116 x 210 (BX 158, BZ 105), 1100 birds (650 phone), fog and orbit limits widened.
- Hawk is now an occasional visitor (flies in, chases, leaves, fades). Gone: nest, roof perching, Fly hawk, Classic hawk toggle, all pointer and key input in skyline.js.
- Helicopter: waypoints, hovers 3 to 8 s at each, leg altitude clears roofs (+12) and slopes (+14). Debug `heli`.
- River now starts in a forest behind the mountains, runs down a valley between the two biggest peaks and off the map; wider (hw 5 to 8.5). 3,400 trees. Town and dock sit where it leaves the valley.
- Boat: one at a time, rare (150 to 300 s), travels the whole river and off the map, sometimes ties up at the dock. Fish have a body and tail, hard-clamped to the channel.
- Roads: four avenues cross the four streets (towers in an avenue's path are dropped), highway runs off the back from x 48 with big trucks. 8 cars, 2 trucks.
- The tornado picks up cars, trucks and the boat (within 24), circles and throws them; vehicles respawn after 25 to 50 s.
- Clouds: size 0.4 to 2.5, no riding over buildings. Visitors fly about 10 higher. Wind streaks 220, shorter.
- `api.dbg` exposes internals for the headless tests.

## fourth local batch (30-10-2026, not pushed; skyline.js v17, flock.js v15, root index flock.js v15)
- World 420 x 280 (BX 210, BZ 140), camera far 1300, fog 280 to 760. Visitors now fly any heading within about 34 degrees of an axis; the lane clears everything under the whole line (`surfMax`).
- Mountains: 5 west of the river, 8 east (some in a back row), valley edges hug the river banks. A low hill in the forest carries a firewatch tower (a solid box for avoidance). A lake in the forest with a camp (3 tents, fire, 3 people, smoke) that appears for 150 to 260 s and goes for 120 to 260 s.
- Roads: avenues stop short of the water and are cut by the town as well as the city (town is built first now).
- Helicopter has momentum: acceleration is limited and itself eased, brakes along a curve, banks and pitches into motion, yaw is rate-limited, sways while hovering.
- Fish: 45 in 7 schools, each school heads for a random point on the river and a random lane (spring, not wall); hard clamp 80% of half width.
- Boats: river flows one way. Up to 3 sailboats and a cruise ship (`ship`), spawned every 35 to 80 s, queue behind each other, sailboats may dock. Debug `boat`, `ship`.
- Gusts: narrower fronts, bigger waves, real gaps (patches go to zero); streaks fewer (200) and fainter in gusts.
- Twitch chat idea benched. Sound demo page lives outside the repo in the session scratchpad (flock-sounds.html), not in the site.

## fifth local batch (30-10-2026, not pushed; skyline.js v18, sound.js v1, flock.js v16, root index flock.js v16)
- Firewatch tower now sits on a small mound (r 15, h 10) in the middle of the forest (40, 215), away from the mountains and city. Trees come to 8.5 of the camp centre, plus 9 placed in a ring round it.
- `sound.js`: synthesised Web Audio, no files. Starts on the first gesture, master level 0.3, on by default, `Sound on/off` button (skyline mode only, remembered in localStorage `flock-sound`). Loops: wind (follows `windStr` and gusts), rain (follows storm count), tornado roar, campfire, river. Visitor engines (plane, military, blimp, glider, jetpack, helicopter) are positioned and Doppler-shifted. Music bed: calm pads and melody, happy arpeggio spells, a low drone that takes over as storms build. One-shots: thunder (delayed by distance), ship and truck horns, dock bell, bird lands, car horn, chute, hawk, tornado grab, birdsong.
- skyline.js talks to it through `ctx.sound?.event(name, pos)` and a per-frame `ctx.sound?.update(SND, dt)`; both are optional so the headless tests run without audio.

## sixth local batch (30-10-2026, not pushed; skyline.js v19, sound.js v1, flock.js v17, root index flock.js v17)
- Box is now 420 x 116 x 460 (BZ 230), 1300 birds (750 phone), orbit max 520, so the flock, clouds and tornado range over the forest. The tornado lane is the open ground 60% of the time and the forest (z 110 to 215) 40%.
- Helicopter has a search light: an additive cone from under the nose to a pool of light that sweeps the ground ahead (`beam`, `spot`).
- Fish: 64 in 9 schools. The tornado throws them (`fobj[i].air`), they land out of sight and reappear in the river after 10 to 70 s.
- Firewatch tower is on flat ground at (-55, 205), no hill. Lake is bigger (rx 46, rz 34 at (96, 190)); the camp moved to its east shore (158, 190). Island with a hut at (84, 196); the hut smokes for 40 to 80 s at a time (`hutSmoke`), then rests 60 to 140 s.
- Sound: the storm drone is a quiet sine at 0.016 with the bed capped at 0.4; the calm bed now plays short piano phrases (`piano`, `PHRASES`) in calm, happy and storm moods over a softer pad. Distance gain curve is now 0.35 + 0.65 / (1 + (d/250)^1.5), applied to one-shots, engines, tornado, fire and river.
- The sound demo page (scratchpad `flock-sounds.html`) has the piano beds, a camera-distance slider and a button that renders every effect to WAV files you can play and save.

## seventh local batch (30-10-2026, not pushed; skyline.js v20, sound.js v1, flock.js v18, root index flock.js v18)
- Sound is off by default (localStorage `flock-sound` = 'on' to remember on); the bar button is a music note, slashed when off. Effects bus 0.55, music bus 1.8; helicopter is a soft low thump with no whine; engines follow the visitor's fade (`SND.visFade`, `heliFade`).
- Fire sounds (campsite, hut, forest fire) are a low roar from afar and crackle/pops that grow steeply as the camera nears (`SND.fires`). New events: dock (knocks and creak), toot, cannon, splash.
- Camera cannot go below the ground, a mountain slope or a roof (`X.surface`). The Hello click no longer stops the spin: mouse moves only bring the bar back; dragging, zooming and touch stop the spin as before.
- River normals forced up so it is lit exactly like the lake. Two firewatch towers (-70, 265) and (150, 315), 20 high on flat ground. Thick tree belt between the river and the lake.
- Pirate galleon (rare, 10% of boat spawns): three masts, cannon rows, jolly roger flag texture, fires cannons every 10 to 25 s (grey puffs, `cannon` sound). Debug `pirate`.
- Search light locks onto a glider, jetpack or parachutist within 160 for 8 to 15 s, then rests 6 s and goes back to sweeping the ground.
- Forest fire (`fire`, debug `fire`): flames, dark smoke, birds avoid it. After 55 to 85 s a bucket helicopter (hovers 14 s dropping water) or a `tanker` plane (a pass aimed at the fire) puts it out; steam for 12 s; burns out alone at 260 s. Next fire 4 to 8 minutes later. Water is a pooled point cloud (`emitWater`).

## eighth local batch (30-10-2026, not pushed; skyline.js v21, extras.js v1, sound.js v1, flock.js v19, root index flock.js v19)
- New module `projects/flock/extras.js` (`createExtras(K)`): the forest and everything standing in it, wildlife, yeti, UFO, cable car, train, balloons, rainbow, shooting stars, fireworks, the hills and coast. skyline.js hands it a kernel `K` of helpers and live state (`S`); it returns `step`, `draw`, `theme`, `season`, `spawn`, `clear` and `spheres` (things birds avoid). Debug spawns: yeti, ufo, train, balloon, fireworks, rainbow, star.
- Forest: 9,500 trees in five kinds (pine, gum, grass tree, banksia, scrub), green via vertex colours and a seasonal tint. Landmarks fill the gaps: homestead with windmill, ranger hut, radio mast with blinking lamp, rock outcrops, three billabongs. Lake fish (18). Perch slots on 420 treetops, the tower decks and the island hut roof.
- Behind the city: smooth rolling farmland hills (`hillH`, fed into `terrainY` so birds, chutes, helicopters and the camera all respect them) easing down to the sea at z -352; wind farm, barns, a lighthouse with a turning beam, a harbour where the highway now ends (z -335), cargo ships on the sea. The highway corridor stays flat.
- Wildlife: 3 kangaroo herds and 2 emu groups graze, move between clearings and bolt from the tornado, fire, helicopter or yeti. A rare UFO takes a kangaroo (it returns later).
- Yeti: cave on the big western peak, rare; walks out, stomps (camera shake via `X.shake`, birds scatter), roars, returns. Mountain camp (tiny, one thick tent) appears now and then in the eastern saddle.
- Cable car from the town up to a station beside the cave; two gondolas, pauses at the ends. Train along a rail line at z -8, now and then. Balloons drift with the wind. Rainbow after storms clear. Shooting stars. Fireworks over the city, now and then.
- Fire now spreads (up to 4 spots, a new one every 18 to 30 s while above half strength), the nearest watchtower flashes a red lamp and a siren and a radio SOS sound; the search light locks onto the biggest burning spot; the bucket heli visits every spot, the tanker covers a line, and another responder is called after 75 s if it persists.
- Pirate galleon cannons now pick the nearest other boat in range and blow it into the air (same flight code as the tornado) after the shells land. Water and lake are bluer, trees green. Towers moved further into the forest ((-95, 340), (190, 360)).
- Camera: WASD or arrows slide the point it looks at (Shift for faster), Q and E go down and up, drag and wheel still orbit and zoom; moving stops the auto-spin.

## ninth local batch (30-10-2026, not pushed; skyline.js v23, extras.js v2, sound.js v2, flock.js v21, root index flock.js v21)
- River was invisible, not the wrong colour: its triangles faced down and were culled. `waterMat` is now double sided. River is wider (hw 9 to 14) with two lanes; boats go both ways (`b.dir`, `b.lane`). Two galleons can meet and trade broadsides (`fireCannons` targets any boat; pirate-on-pirate hits are puffs, shake and a boom only; other boats are blown into the air by `blast`).
- Mountains: `PEAKS` is now west range 0 to 12 (long, with stepped cliff boxes on the forest side of 5 to 10) and east 13 to 20; `PK` names the indices extras uses. Valley widened for the river. Yeti cave is in a canyon between peaks 6 and 7 (back wall, cave mouth, corridor out to the forest); climbing camp on a ledge of peak 14; cable car goes to the summit of peak 13.
- Trees cut to about 4,500, grey with a hint of green, never within 8 of a mountain foot. Hill fields and the beach are muted.
- Sky: stars, moon, a ring of far dark hills, cloud banks on the horizon (all `fog: false`); ground plane 6000, camera near 2 far 4200. Clouds: up to 60 (70 in a cell), sizes 0.4 to 3.5, heights -10 to 70; storms arrive as cells of 8 to 14 big clouds; tornado needs 16 storms.
- Effects reach further (visitor, cloud, tornado, strike, hawk, helicopter radii); fireworks scatter birds and set a 12 s `fear` field that pushes them to the edges.
- Helicopters are an array (`helis`, up to 4): scenic, scout (lights on the fire, circles it), fighter (bucket). A locked helicopter follows its target in a circle. The alarm brings 1 or 2 scouts after 5 to 9 s, water 55 to 85 s.
- Fire: lightning in the forest starts one (70%), heavy rain and a passing tornado put it out.
- Train: rail line z chosen clear of buildings; level crossings with blinking lamps; a tornado throws the carriages and ends the run. Rainbow is fixed in the world at (-60, -230). Highway now runs to the coast and east along it to the harbour at x 330; the beach with huts, umbrellas, lifeguard tower, jetty and cafe is at the west end; lighthouse moved to x -235.
- Farms: 3 on the hills, 2 in the forest; fenced paddocks, barns; instanced sheep, cattle and dogs (dogs circle the flock). Everything lives in `extras.js` except the boat, fire and helicopter changes.

- Removed (maltysnack, 30-10-2026): the stepped cliff boxes on the western range, and the two forest farms (only the three hill farms remain). skyline.js v24, extras.js v3, flock.js v22.

## tenth local batch (30-10-2026, not pushed; skyline.js v25, extras.js v4, flock.js v23, root index flock.js v23)
- Rail line: z chosen flat and clear of buildings; the town now keeps to the south bank (it had spread across the river onto the line); the rail sits at z -15.
- Yeti cave is a mouth on the wall of the western peak facing the canyon, with a ledge; the yeti walks down the slope into the canyon and out into the forest and back. Climbing camp moved to the saddle between the two eastern back-row peaks (93, 96), away from the town and from the yeti.
- 11 more mountains reach into the forest; 4 watchtowers in all ((-95,340), (190,360), (-280,250), (330,230)); the radio mast moved to (100, 350) out of the river's way. River runs to the map edge both ways (z 520 in the forest, x 520 off the east), a touch narrower ramp (`s / 600`).
- Greens and the water duller; shooting stars far and high above the horizon (`fog: false`); the rainbow is removed.
- City runs on along the rail line both sides (two rows each, thinning out, x 156 to 350). Ferris wheel by the river at (188, -3). Cable car stations smaller, three tall towers with arms. 1,400 treetop perch slots; ambient perch reach 36.
- Helicopter locks only within 110 to 170 and the light draws only within 140 (scouts still fly to the fire from anywhere).
- Lighthouse stands at the tip of a rocky peninsula (-226, -452) with a much longer (280) and slower (0.2 rad/s) beam.

- The flock's centre wanders (30-10-2026, skyline.js v26, flock.js v24): `roam` is a point that drifts between faraway places every 70 to 140 s and pulls every bird softly toward it; left alone for 60 s the camera target follows the flock's centroid (WASD or arrows take over again).
