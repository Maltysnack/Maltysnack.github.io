# flock HANDOFF

> **The root `/index.html` is the Flock page** (the site's home page). This
> folder holds the engine and the world: `flock.js`, `skyline.js`, `extras.js`,
> `sound.js` and the vendored three.js. `projects/flock/index.html` is only a
> redirect to `/` that keeps the query string. UI and markup go in the root
> `index.html`. Root `HANDOFF.md` covers site-wide.

Last full rewrite of this file: 30-10-2026, at a session handoff. Older
per-batch notes were folded into the sections below.

## 1. Status (read first)

- **Live** on https://maltysnack.github.io: commit `8cb1a23`
  ("flock: a living world", skyline v26, extras v1, sound v2, flock v24).
- **Local only, not pushed**: everything after that. It is all in the working
  tree (`index.html`, `projects/flock/*`). maltysnack said "only localhost"
  for these batches; **do not push until they say so**. Push command:
  `git add index.html projects/flock/ && git commit -m "..." -- index.html projects/flock/ && git pull --rebase --autostash origin main && git push origin main`
  (own paths only; never `add -A`, never stash/reset; trailer
  `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`). After pushing,
  wait for Pages and `curl` the live `index.html` for the new `flock.js?v=`.
- **Nothing in the local batches has been seen in a real browser by Claude.**
  Everything was verified headless (node + the vendored three.js + fakes) and
  by maltysnack looking at `http://127.0.0.1:8766/?debug` between batches.
  Treat visuals, frame rate and sound levels as unverified until they say so.
- Sound is **off by default**; the music-note button in the bar turns it on
  (remembered in `localStorage` key `flock-sound`).

### Cache-busting chain (bump all links when any file changes)

`index.html` loads `/projects/flock/flock.js?v=30` ->
`flock.js` imports `./skyline.js?v=31`, `./sound.js?v=5` ->
`skyline.js` imports `./extras.js?v=9` (and three.js). Bumping a leaf without
bumping the importers is invisible to browsers. **The root `index.html` also has
`modulepreload` links for `skyline.js`, `extras.js`, `sound.js` and three.js with
the same `?v=` values; keep them in step** (a stale one only wastes a download).
The slow start (black, birds, then a 1 to 2 s wait for the Hello.) was the
world and the Google font being fetched only when the intro asked for them;
flock.js now starts both at once and the intro waits at most 1.2 s for shader
compile plus font.

## 2. Working rules (maltysnack's, enforced by CLAUDE.md)

- **Discuss before build**: plan, then wait for an explicit "go". Direct
  imperative fixes ("remove X") have been treated as go. No edits, commits or
  pushes before a go; reading and drafting are fine.
- Terse chat, **no em dashes anywhere** (code, comments, commits), **Australian
  English**, dates `dd-mm-yyyy`, git identity `maltysnack` (check
  `git config user.email` = `39046911+Maltysnack@users.noreply.github.com`).
- Never open or mention the preview panel. Edit only this folder plus the root
  `index.html` (the Flock session owns it). Shared files (`sidebar.js`,
  `style.css`, root `HANDOFF.md`, `scripts/`) belong to the master session.
- Run `bash scripts/sanitize.sh` before committing (0 errors expected; 1
  warning is another session's untracked folders).
- The site is **dark only** (a MutationObserver holds `data-theme=dark`).
  Palette: black/white plus accent red; blue water and subdued greys with a
  hint of green are deliberate highlights. No browns or yellows in site chrome.

## 3. Files

| File | Lines | Role |
|---|---|---|
| `flock.js` | ~410 | Engine and page glue: boids step (counting-sort spatial hash, soft proportional steering, force low-pass, render interpolation, 60 Hz fixed step), camera (orbit plus free WASD/arrow movement, ground clamp, shake), idle fade, the "Hello." intro, preset drift, Classic/Skyline switch, `?debug` buttons, sound button wiring. |
| `skyline.js` | ~1530 | The world core (see section 5). Lazy-loaded on first Skyline switch. |
| `extras.js` | ~950 | `createExtras(K)`: forest and landmarks, wildlife, yeti, cable car, train, bridge, balloons, sky events, hills/coast/airport/quarry (see section 6). |
| `sound.js` | ~245 | `createSound(camera)`: everything synthesised in Web Audio (section 7). |
| `vendor/three.module.min.js` | | three.js r160, MIT, no CDN. |
| `index.html` (folder) | | redirect to `/`. |

Root `index.html` is the markup and CSS: title, Classic/Skyline switch, bar
(`#snd` sound button, `Scatter`), stats. The bar and title fade after 10 s idle
(`html[data-idle]`); the camera auto-spins after 5 s of no canvas interaction.

## 4. Engine and page behaviour (flock.js)

- 1,300 birds (750 phone). World box `BX 210, BY 58, BZ 230` (so about 420 x
  116 x 460); soft edge pull beyond 6 inside each wall, ground firm. Camera far
  4200, near 2, orbit radius 60 to 520, fog 280 to 760.
- Birds are `InstancedMesh` with `instanceColor`; Skyline patches the vertex
  shader for wing flap. Bird states in `X.st`: 0 flying, 1 landing, 2 perched,
  3 held (intro).
- **Presets drift** (`drift()`): the flock blends between Murmuration, School
  and Swarm on its own (40 to 80 s holds, 25 s blends). No sliders, no buttons.
- **Intro**: "Hello." drawn on a 2D canvas, sampled to points, existing birds
  recruited and pinned, released outward from the click. Triggers only on
  pointerdown or keydown. `?nointro` skips it. Reduced motion skips the intro
  and ambient weather. The reveal does not stop the camera spin.
- **Camera**: drag orbit, wheel/pinch zoom, **W A S D or arrows slide the look-at
  point, Q/E down/up, Shift faster**; left alone for 60 s it follows group 0 of
  the flock; never below the ground (`X.surface`); shake from `X.shake`.
- Classic mode is the pure three-rule boids with no extras. The hawk and the
  player hawk are gone from Classic.
- `?debug` adds one button per spawn (list in section 8).

## 5. skyline.js sections (in file order)

Hook object `X` is what the engine calls: `before, drive, force, hawk, draw,
theme, reset, enable, disable, spawn, st, recruit, free, blocked, surface,
shake, hawkOn`. `create(ctx)` builds everything; `K` (kernel) is handed to
`extras.js`. Key facts:

- **Constants**: `GROUND = -BY`. Everything is in absolute y; ground y = -58.
- **City**: seeded (`rand`, seed 1987) towers around a hero tower (x 3, z -47,
  h 102); extension along the rail line both ways (x 156 to 350); six tall
  edge towers; four avenues `AVE = [-72,-32,48,90]` (towers in their path are
  dropped); perch slots on roofs.
- **Visitors** (`KINDS`): plane, blimp (scale 3.8), glider, jetpack, military
  transport (rare, drops a stream of parachutists), tanker (only dispatched to
  fires). Any heading within about 34 degrees of an axis; lane clears
  everything under the whole line (`surfMax`). They fade at the edges
  (`fadeable`). **Gliders flipped because `rotation.z` was set on a mesh with a
  yaw beyond 90 degrees; use quaternions** (`setFromAxisAngle`).
  35 percent of automatic planes divert to the airport (`EX.requestLanding()`).
- **Clouds**: up to 60 (70 in a storm cell), sizes 0.4 to 3.5, heights -10 to
  70, pushed by the wind with little motion of their own. A storm is a cell of
  8 to 14 big dark clouds (`stormCell`). Rain from 5 storms, full at 8. Tornado
  needs 16 storms (cooldown 300 s) or the debug button.
- **Wind**: an angle that turns slowly, dies to a lull, then returns from a new
  direction (`stepWind`, `windStr`); gust fronts are patchy bands (`gustAt`).
- **Tornado**: funnel of rings and specks, picks up cars, trucks, boats, fish
  and the train, snuffs fires it crosses.
- **Lightning** strikes storm clouds, scatters birds, and in the forest starts a
  fire 70 percent of the time.
- **Fire** (`fire`): up to 4 spots, spreads every 18 to 30 s, nearest of the 4
  watchtowers flashes a lamp, a siren and an SOS sound; scouts (lights on the
  fire) after 5 to 9 s, a bucket helicopter or a `tanker` plane after 55 to 85 s;
  heavy rain and a passing tornado put it out; burns out alone at 260 s.
- **Helicopters** (`helis`, up to 4): roles `scenic`, `scout`, `fighter`; momentum,
  banking, hover; lock onto fires first then gliders, jetpacks and parachutists
  within 110 to 170, circle the target; the light stops 4 short of an object
  and only reaches 140.
- **Hawk**: an occasional visitor (not controllable); steers clear of
  buildings and mountains (`solids`), stays 17 above the tree tops.
- **Terrain**: `PEAKS` (cones; indices: 0 to 12 west range, 13 to 20 east, 21 to
  31 forest) plus `hillH` (smooth farmland hills behind the city, with flat
  pads: highway corridor x 48 and the airport pad at (290, -250)). `terrainY`
  is the one height function everything (birds, chutes, helis, camera) uses.
  `PK` names the indices extras needs.
- **River** (`RIVER` polyline, Catmull-Rom into `CL`, hw 9 to 14): forest
  source (z 520) to the east edge (x 520). **Triangles must face up or be
  double sided** (`waterMat` is double sided; a culled river looked like bare
  ground). Fish: 64 in 9 schools, held to the channel, thrown by the tornado.
  Boats (`boats`): sail x3, cruise ship, galleon x2, both ways in two lanes,
  queue behind each other, sailboats may tie up at the dock; galleons trade
  broadsides and blow other boats up (`blast`).
- **Town** on the south bank (rejects z < 6 so it stays off the rail), dock,
  boathouse; **roads** (`SEGS`, streets and avenues cut by buildings, highway
  `HWYP` bending east to the harbour), 8 cars, 2 trucks, 3 big highway trucks.
- **Flock groups**: five groups (`roams`, bird `i % 5`) each pulled to a
  wandering place; every 5 to 8 minutes they gather for 75 s.
- **Fear field**: fireworks set `EX.fear` (12 s) that pushes birds outward;
  `EX.spheres` are balloons, the UFO, jets and airborne aircraft.
- `api.dbg` exposes internals for tests (`EX`, `boats`, `fire`, `helis`, `VEH`,
  `CL`, ...). Safe to leave.

## 6. extras.js sections

Forest (about 4,500 trees in 5 kinds, none within 8 of a mountain foot) and
perch slots (1,400 treetops, tower decks, island hut roof, lighthouse); landmarks
(homestead and windmill, ranger hut, radio mast at (100, 350), rock outcrops,
two billabongs; the puddle by the river is gone); lake fish; kangaroo and emu
herds that flee danger; UFO that takes a kangaroo; **yeti** (cave on a western
peak facing the pocket ringed by three peaks; walks to the forest, stomps,
returns; `WAY` polyline); climbing camp at (93, 96); **cable car** (east bank to
the summit of `PEAKS[13]`); **lookout mountain** (`PEAKS[25]`: fenced spiral
track and a platform facing back at the scene); steam **train** on `RAILZ` (flat
ground clear of buildings; level crossings with lamps; a tornado throws it);
**lift bridge** at x 90 (span rises to 24 when a boat is within 130; a car
crosses to the cable station); balloons; shooting stars (far, high, `fog:false`);
fireworks (finale: the whole pool of 10 at once); stars, moon, far hills and
cloud banks; **hills chunk**: hill mesh, sea, lighthouse on a tall rocky island
(232, -700), harbour at x 330, cargo ships, wind farm and farms on the west
grass, dunes on the coast strip behind the beach, beach with promenade and a
42-long pier (rides), waves and 6 surfers (4 stretches, gap at the pier),
whales (breach, spout), dolphin pods, pelicans, swans, platypus, marble quarry
(far-west peak `PEAKS[9]`), fighter jets (curving, banking V; rare), **airport**
(pad (290, -250); 2 airliners that are *visitors that landed*, 2 small
propeller planes that fly freely and land).

## 7. sound.js

Web Audio, all synthesised, starts on the first gesture, master 0.3, effects bus
0.55, music bus 1.8, distance gain `0.35 + 0.65 / (1 + (d/250)^1.5)`. Loops
(wind, rain, tornado, fire, river, surf, alarm), engines with Doppler for the
current visitor and two helicopters, one-shots by event name (`event(name,
pos)`), and a music bed that crossfades calm / happy / storm with short piano
phrases. skyline calls `ctx.sound?.event(...)` and `ctx.sound?.update(SND, dt)`;
both optional so headless tests run without audio. A standalone demo page and
WAV renderer lives in the scratchpad, not the repo (`flock-sounds.html`).

## 8. Debug buttons (`?debug`)

plane, blimp, glider, jetpack, military, cloud, storm, storms (10 storms ->
tornado), strike, chute, gust, hawk, heli, scout, boat, ship, pirate, fire,
yeti, ufo, train, balloon, fireworks, jets, platypus, roadcar, airliner, cessna,
whale, tornado.

## 9. Testing without a browser

Harness pattern (kept in the old session scratchpad, easy to recreate): import
the vendored three.js in node, fake `document.createElement` (canvas with
no-op 2d context), `addEventListener`, `Image`, a Proxy `AudioContext`, build a
ctx `{ THREE, scene, camera, canvas, hawk, P, reduce, BX, BY, BZ, MAX_FORCE,
orbit, pos, vel, N, CAP, birds, setLook, aiHawk, sound }`, call
`create(ctx).enable()`, then step `X.before(dt)`, `X.force/drive` per bird,
`X.hawk(dt)`, `X.draw(0.5, dt)` and use `X.dbg` / `X.spawn(name)` to exercise
things. Always `node --check` an `.mjs` copy (a `.js` copy is parsed as CJS).
Last runs were clean: no NaN, no building/terrain hits for visitors, helicopters
or the hawk, fires spread and are put out, boats blown up, bridge lifts,
airliner lands, jets curve.

## 10. Pitfalls learned (do not repeat)

- A trailing `//` comment on a line swallows the rest of that line (it silently
  disabled `startTornado` once). Put comments on their own line or last.
- Top-level `const`s used inside `createExtras(K)` must be defined before the
  call; getters in `K.S` and function declarations are the safe route (TDZ).
- Euler decomposition flips quaternion rotations beyond 90 degrees: never set a
  single `rotation.z` on a mesh whose orientation came from a quaternion.
- `sed -i` on macOS needs `''`; prefer Python for multi-line edits and always
  assert the match count.
- Python patch scripts that slice by section marker must use the right *end*
  marker (a wrong one duplicated a whole block once).
- Culled triangles (wrong winding) are invisible; use double sided where in doubt.

## 11. Open items and ideas

- **Unverified by eye**: forest density and tree look, hill/dune colours, the
  lift bridge and approach roads, wave/surfer look, pier rides, airport, the
  yeti pocket and cave arch, lookout track, marble quarry benches, steam train,
  and **frame rate** with 4,500 trees, 60 clouds, instanced livestock and the
  hills mesh. If it stutters thin the trees, clouds and animals first.
- Tuning knobs worth a look: flock group pull (0.5 x MAX_FORCE, skyline `force`),
  cloud caps (60/70), tree cap (4,500, extras), sound levels.
- Benched or never built: Twitch chat spawns (read-only IRC over WebSocket,
  `!glider` style commands, needs a name filter and cooldowns); more Australian
  animals (koalas in gum trees, wombats, echidnas, cockatoo flocks, penguins);
  night mode with stars/aurora and a lit pier; photo mode; time-lapse controls;
  bushfire haze; rocket launch; regatta; splitting `skyline.js` into modules
  (offered, deferred; everything shares one closure of state).
- maltysnack likes: dynamic, curved, "performance" movement; rare spawns that
  interact (tornado grabs things, cannons blow up boats, fires spread); more
  life and landmarks everywhere; colour kept subdued with highlights; nothing
  looking "flat" or uniform. They dislike: boxy placeholders, things that fly
  through scenery, shrinking-away fades, repeated asks for the same fix.
