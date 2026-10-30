  import * as THREE from './vendor/three.module.min.js';
import { createSound } from './sound.js?v=5';
const skyP = import('./skyline.js?v=32');   // start fetching the world at once, not when the intro asks for it
const fontP = document.fonts.load('900 120px "Big Shoulders Display"').catch(() => {});   // and the heading font the intro draws with

  // ── Parameters ──────────────────────────────────────────────────────
  const PRESETS = {
    murmuration: { sep: 1.6, ali: 1.3, coh: 1.2, vis: 9,   spd: 20 },
    school:      { sep: 1.2, ali: 2.6, coh: 1.4, vis: 5,   spd: 14 },
    swarm:       { sep: 2.4, ali: 0.2, coh: 1.8, vis: 9,   spd: 26 }
  };
  const PHONE = matchMedia('(max-width: 640px)').matches;
  // Dark only: the scene has no light version, so the page is held dark whatever the nav's toggle says.
  { const d = document.documentElement, lock = () => { if (d.dataset.theme !== 'dark') d.dataset.theme = 'dark'; }; new MutationObserver(lock).observe(d, { attributes: true, attributeFilter: ['data-theme'] }); lock(); }
  // ?intro: a local prototype of "home is Flock": Skyline at full rate under a big Hello. that bursts into birds.
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const INTRO = !new URLSearchParams(location.search).has('nointro');   // the intro is the default; ?nointro skips it
  const intro = INTRO && !REDUCED;                   // reduced motion skips the burst and shows the bar at once
  let introRun = null;                               // the Hello. hand-off, ticked each frame while it plays
  let introLock = intro;                             // while true the canvas ignores orbit input
  const NUM = PHONE ? 750 : 1300;
  const T = { ...PRESETS.murmuration };   // what the controls ask for
  const P = { ...T };                     // what the flock uses, eased toward T so big changes never snap
  const BX = 210, BY = 58, BZ = 230;          // half extents of the box the flock lives in
  const MARGIN = 40;                        // padding around the box for the spatial grid, so birds that drift past the soft edge are still indexed
  const MAX_FORCE = 40;

  // ── State, in flat typed arrays: one slot per bird ───────────────────
  let N = 0, CAP = 0, pos, vel, acc, prev, scl;
  function seed(n, cap = n) {
    N = n; CAP = cap; if (birds) birds.count = N;
    scl = new Float32Array(cap).fill(1); pos = new Float32Array(cap * 3); prev = new Float32Array(cap * 3); vel = new Float32Array(cap * 3); acc = new Float32Array(cap * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() * 2 - 1) * BX * 0.6;
      pos[i * 3 + 1] = (Math.random() * 2 - 1) * BY * 0.6;
      pos[i * 3 + 2] = (Math.random() * 2 - 1) * BZ * 0.6;
      const a = Math.random() * Math.PI * 2, b = (Math.random() - 0.5) * 0.6;
      prev[i * 3] = pos[i * 3]; prev[i * 3 + 1] = pos[i * 3 + 1]; prev[i * 3 + 2] = pos[i * 3 + 2];
      vel[i * 3] = Math.cos(a) * P.spd; vel[i * 3 + 1] = b * P.spd; vel[i * 3 + 2] = Math.sin(a) * P.spd;
    }
  }
  let X = null;                    // Skyline's extras while that mode is on, else null
  const f3 = new Float32Array(3);
  const hawk = { p: new THREE.Vector3(BX, BY * 0.5, 0), v: new THREE.Vector3(-1, 0, 0), q: new THREE.Vector3(BX, BY * 0.5, 0) };

  // ── Spatial hash: counting sort into cells the size of a bird's vision,
  //    so each bird only looks at the 27 cells around it, not all N. ────
  let cellStart, cellCount, order, cellOf, GX, GY, GZ, CS;
  function buildGrid() {
    CS = P.vis;
    GX = Math.ceil((BX * 2 + 2 * MARGIN) / CS); GY = Math.ceil((BY * 2 + 2 * MARGIN) / CS); GZ = Math.ceil((BZ * 2 + 2 * MARGIN) / CS);
    const cells = GX * GY * GZ;
    if (!cellCount || cellCount.length < cells + 1) { cellCount = new Int32Array(cells + 1); cellStart = new Int32Array(cells + 1); }
    else cellCount.fill(0, 0, cells + 1);
    if (!order || order.length < N) { order = new Int32Array(N); cellOf = new Int32Array(N); }
    for (let i = 0; i < N; i++) {
      const c = cellIndex(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      cellOf[i] = c; cellCount[c]++;
    }
    let run = 0;
    for (let c = 0; c < cells; c++) { cellStart[c] = run; run += cellCount[c]; cellCount[c] = cellStart[c]; }
    cellStart[cells] = run;
    for (let i = 0; i < N; i++) order[cellCount[cellOf[i]]++] = i;
  }
  const clampI = (v, n) => v < 0 ? 0 : v >= n ? n - 1 : v;
  function cellIndex(x, y, z) {
    const ix = clampI(Math.floor((x + BX + MARGIN) / CS), GX), iy = clampI(Math.floor((y + BY + MARGIN) / CS), GY), iz = clampI(Math.floor((z + BZ + MARGIN) / CS), GZ);
    return (ix * GY + iy) * GZ + iz;
  }

  // ── One step of the three rules, plus walls and the hawk ─────────────
  function step(dt) {
    const st = X ? X.st : null;
    if (X) X.before(dt);
    const ease = Math.min(1, dt * 2.5);
    for (const k in T) P[k] += (T[k] - P[k]) * ease;
    prev.set(pos); hawk.q.copy(hawk.p);
    buildGrid();
    const r2 = P.vis * P.vis, sepR2 = r2 * 0.2, sepR = Math.sqrt(sepR2), sepK = 30 * P.sep;
    const maxS = P.spd, minS = P.spd * 0.45;
    const useHawk = !!(X && X.hawkOn), fleeR2 = 42 * 42;
    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      if (st && st[i]) { X.drive(i, dt); acc[i3] = acc[i3 + 1] = acc[i3 + 2] = 0; continue; }   // landing or perched
      const px = pos[i3], py = pos[i3 + 1], pz = pos[i3 + 2];
      let cx = 0, cy = 0, cz = 0, ax = 0, ay = 0, az = 0, sx = 0, sy = 0, sz = 0, n = 0;
      const ix = clampI(Math.floor((px + BX + MARGIN) / CS), GX), iy = clampI(Math.floor((py + BY + MARGIN) / CS), GY), iz = clampI(Math.floor((pz + BZ + MARGIN) / CS), GZ);
      for (let dx = -1; dx <= 1; dx++) { const X = ix + dx; if (X < 0 || X >= GX) continue;
        for (let dy = -1; dy <= 1; dy++) { const Y = iy + dy; if (Y < 0 || Y >= GY) continue;
          for (let dz = -1; dz <= 1; dz++) { const Z = iz + dz; if (Z < 0 || Z >= GZ) continue;
            const c = (X * GY + Y) * GZ + Z;
            for (let k = cellStart[c], e = cellStart[c + 1]; k < e; k++) {
              const j = order[k]; if (j === i || (st && st[j])) continue;
              const j3 = j * 3, ex = pos[j3] - px, ey = pos[j3 + 1] - py, ez = pos[j3 + 2] - pz;
              const d2 = ex * ex + ey * ey + ez * ez;
              if (d2 > r2) continue;
              n++; cx += ex; cy += ey; cz += ez; ax += vel[j3]; ay += vel[j3 + 1]; az += vel[j3 + 2];
              if (d2 < sepR2 && d2 > 1e-6) { const d = Math.sqrt(d2), w = (1 / d - 1 / sepR) / d; sx -= ex * w; sy -= ey * w; sz -= ez * w; }
            }
          }
        }
      }
      const vx = vel[i3], vy = vel[i3 + 1], vz = vel[i3 + 2];
      let fx = 0, fy = 0, fz = 0;
      // Forces scale with how far off a bird is, never a fixed-size shove, so
      // a tiny disagreement gives a tiny correction and flight stays smooth.
      if (n) {
        fx += (ax / n - vx) * P.ali; fy += (ay / n - vy) * P.ali; fz += (az / n - vz) * P.ali;
        const k = P.coh * 0.6 * maxS / P.vis / n;   // pull grows with distance from the centre
        fx += cx * k; fy += cy * k; fz += cz * k;
      }
      const sp = Math.hypot(vx, vy, vz) || 1, hold = (maxS * 0.85 - sp) * 2 / sp;   // keep cruising speed along the current heading
      fx += vx * hold; fy += vy * hold; fz += vz * hold;
      fx += sx * sepK; fy += sy * sepK; fz += sz * sepK;
      // A soft edge: nothing pushes until a bird is near the edge, then the pull back grows the further out it goes,
      // so wind can carry the flock past it and it drifts home, instead of piling against a wall. The ground stays firm.
      const soft = (p, b) => { const e = Math.abs(p) - (b - 6); return e > 0 ? -Math.sign(p) * (0.9 * e + 0.02 * e * e) : 0; };
      fx += soft(px, BX); fz += soft(pz, BZ); fy += soft(py, BY) * (py > 0 ? 1 : 0);
      if (py < -BY + 14) fy += (-BY + 14 - py) / 14 * MAX_FORCE * 1.5;
      if (useHawk) {
        const hx = px - hawk.p.x, hy = py - hawk.p.y, hz = pz - hawk.p.z, h2 = hx * hx + hy * hy + hz * hz;
        if (h2 < fleeR2) { const k = MAX_FORCE * 3 * (1 - h2 / fleeR2) / Math.sqrt(h2 + 1e-6); fx += hx * k; fy += hy * k; fz += hz * k; }
      }
      if (X) { f3[0] = f3[1] = f3[2] = 0; X.force(i, px, py, pz, f3); fx += f3[0]; fy += f3[1]; fz += f3[2]; }
      const fm = Math.hypot(fx, fy, fz), lim = useHawk ? MAX_FORCE * 3 : MAX_FORCE;
      if (fm > lim) { fx *= lim / fm; fy *= lim / fm; fz *= lim / fm; }
      // low-pass the force so heading changes ease in rather than twitch
      const b = 0.25; acc[i3] += (fx - acc[i3]) * b; acc[i3 + 1] += (fy - acc[i3 + 1]) * b; acc[i3 + 2] += (fz - acc[i3 + 2]) * b;
    }
    for (let i = 0; i < N; i++) {
      if (st && st[i]) continue;
      const i3 = i * 3;
      let vx = vel[i3] + acc[i3] * dt, vy = vel[i3 + 1] + acc[i3 + 1] * dt, vz = vel[i3 + 2] + acc[i3 + 2] * dt;
      const s = Math.hypot(vx, vy, vz) || 1, t = s > maxS ? maxS / s : s < minS ? minS / s : 1;
      vel[i3] = vx * t; vel[i3 + 1] = vy * t; vel[i3 + 2] = vz * t;
      pos[i3] += vel[i3] * dt; pos[i3 + 1] += vel[i3 + 1] * dt; pos[i3 + 2] += vel[i3 + 2] * dt;
    }
    if (X) X.hawk(dt);
  }

  // The hawk chases whichever bird is nearest, a little faster than the
  // flock but turning more slowly, so the flock can out-manoeuvre it.
  const tmp = new THREE.Vector3();
  function stepHawk(dt) {
    let best = -1, bd = Infinity;
    for (let i = 0; i < N; i++) {
      const dx = pos[i * 3] - hawk.p.x, dy = pos[i * 3 + 1] - hawk.p.y, dz = pos[i * 3 + 2] - hawk.p.z, d = dx * dx + dy * dy + dz * dz;
      if (d < bd) { bd = d; best = i; }
    }
    if (best < 0) return;
    tmp.set(pos[best * 3], pos[best * 3 + 1], pos[best * 3 + 2]).sub(hawk.p).normalize().multiplyScalar(P.spd * 1.25);
    hawk.v.lerp(tmp, Math.min(1, dt * 1.6));
    hawk.p.addScaledVector(hawk.v, dt);
  }

  // ── Rendering ────────────────────────────────────────────────────────
  const canvas = document.getElementById('stage');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 2, 4200);
  const sound = createSound(camera);
  for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, () => sound.gesture(), { once: true, passive: true });   // browsers only allow sound after a gesture
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(40, 80, 30); scene.add(sun);

  const birdGeo = new THREE.ConeGeometry(0.45, 1.8, 4); birdGeo.rotateX(Math.PI / 2);   // nose along +z
  const birdMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  let birds;
  const look = { geo: birdGeo, mat: birdMat };
  function makeMesh() {
    if (birds) { scene.remove(birds); birds.dispose(); }
    birds = new THREE.InstancedMesh(look.geo, look.mat, CAP); birds.count = N;
    birds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    birds.frustumCulled = false;
    scene.add(birds);
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), fwd = new THREE.Vector3(0, 0, 1), dir = new THREE.Vector3(), sv = new THREE.Vector3(), heldQ = new THREE.Quaternion(), at = new THREE.Vector3();   // heldQ: how birds lie while they spell a word
  function draw(a, real) {
    const st = X ? X.st : null;
    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      if (st && st[i] === 3) q.copy(heldQ);
      else { dir.set(vel[i3], vel[i3 + 1], vel[i3 + 2]).normalize(); q.setFromUnitVectors(fwd, dir); }
      m4.compose(at.set(prev[i3] + (pos[i3] - prev[i3]) * a, prev[i3 + 1] + (pos[i3 + 1] - prev[i3 + 1]) * a, prev[i3 + 2] + (pos[i3 + 2] - prev[i3 + 2]) * a), q, sv.setScalar(scl[i]));
      birds.setMatrixAt(i, m4);
    }
    birds.instanceMatrix.needsUpdate = true;
    if (X) X.draw(a, real);
    renderer.render(scene, camera);
  }

  // Colours come from the site tokens, and follow the theme toggle.
  function theme() {
    const cs = getComputedStyle(document.documentElement);
    const col = v => new THREE.Color().setStyle(cs.getPropertyValue(v).trim() || '#888');
    const bg = col('--bg');
    scene.background = bg; scene.fog = new THREE.Fog(bg, 280, 760);
    birdMat.color = col('--text');
    if (X) X.theme(col);
  }
  new MutationObserver(theme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', theme);

  // ── Camera: drag to orbit, wheel or pinch to zoom, slow drift when idle ─
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const orbit = { th: 0.6, ph: 1.25, r: 265, idle: 0, tx: 0, ty: 0, tz: 0 };   // tx, ty, tz: the point it looks at, which WASD or the arrows move
  const pointers = new Map(); let pinch0 = 0;
  canvas.addEventListener('pointerdown', e => { if (introLock || (X && X.flying)) return; canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, [e.clientX, e.clientY]); orbit.idle = 0; });
  canvas.addEventListener('pointermove', e => {
    if (introLock || !pointers.has(e.pointerId) || (X && X.flying)) return;
    const [x0, y0] = pointers.get(e.pointerId); pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch0) orbit.r = Math.min(520, Math.max(60, orbit.r * pinch0 / d));
      pinch0 = d; return;
    }
    orbit.th -= (e.clientX - x0) * 0.006;
    orbit.ph = Math.min(2.9, Math.max(0.25, orbit.ph - (e.clientY - y0) * 0.006));
    orbit.idle = 0;
  });
  const up = e => { pointers.delete(e.pointerId); pinch0 = 0; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => { if (introLock) return; e.preventDefault(); if (X && X.flying) return; orbit.r = Math.min(520, Math.max(60, orbit.r * Math.exp(e.deltaY * 0.001))); orbit.idle = 0; }, { passive: false });
  const move = { w: 0, s: 0, a: 0, d: 0, u: 0, dn: 0, fast: 0 };
  const KEYS = { KeyW: 'w', ArrowUp: 'w', KeyS: 's', ArrowDown: 's', KeyA: 'a', ArrowLeft: 'a', KeyD: 'd', ArrowRight: 'd', KeyE: 'u', KeyQ: 'dn', ShiftLeft: 'fast', ShiftRight: 'fast' };
  const onKey = v => e => { const k = KEYS[e.code]; if (!k || introLock || e.metaKey || e.ctrlKey || e.altKey) return; move[k] = v; if (k !== 'fast') e.preventDefault(); };
  addEventListener('keydown', onKey(1)); addEventListener('keyup', onKey(0)); addEventListener('blur', () => { for (const k in move) move[k] = 0; });
  function placeCamera(dt) {
    orbit.idle += dt;
    const dx = move.d - move.a, df = move.w - move.s, dy = move.u - move.dn;
    if (dx || df || dy) {   // free movement: slide the point the camera looks at
      orbit.idle = 0; orbit.moved = 0; const sp = (orbit.r * 0.7 + 40) * dt * (move.fast ? 2.5 : 1), fx = -Math.sin(orbit.th), fz = -Math.cos(orbit.th), rx = Math.cos(orbit.th), rz = -Math.sin(orbit.th);
      orbit.tx = Math.max(-BX - 150, Math.min(BX + 150, orbit.tx + (fx * df + rx * dx) * sp)); orbit.tz = Math.max(-BZ - 250, Math.min(BZ + 250, orbit.tz + (fz * df + rz * dx) * sp)); orbit.ty = Math.max(-40, Math.min(140, orbit.ty + dy * sp * 0.6));
    }
    if (!reduce && orbit.idle > 5) orbit.th += dt * 0.05;
    orbit.moved = (orbit.moved ?? 99) + dt;
    if (X && !reduce && orbit.idle > 5 && orbit.moved > 60) {   // left alone, the view drifts after the flock as its centre wanders
      let sx = 0, sz = 0, n = 0; for (let i = 0; i < N; i += 5) { sx += pos[i * 3]; sz += pos[i * 3 + 2]; n++; }   // follows one of the groups
      if (n) { const k = Math.min(1, dt * 0.04); orbit.tx += (sx / n * 0.8 - orbit.tx) * k; orbit.tz += (sz / n * 0.8 - orbit.tz) * k; }
    }
    camera.position.set(orbit.tx + orbit.r * Math.sin(orbit.ph) * Math.sin(orbit.th), orbit.ty + orbit.r * Math.cos(orbit.ph), orbit.tz + orbit.r * Math.sin(orbit.ph) * Math.cos(orbit.th));
    const floor = (X ? X.surface(camera.position.x, camera.position.z) : -BY) + 6;   // never under the ground or inside a mountain
    if (camera.position.y < floor) camera.position.y = floor;
    camera.lookAt(orbit.tx, orbit.ty, orbit.tz);
    if (X && X.shake > 0.02) { const k = X.shake * 0.6; camera.position.x += (Math.random() - 0.5) * k; camera.position.y += (Math.random() - 0.5) * k; camera.position.z += (Math.random() - 0.5) * k; }
  }
  function resize() {
    const r = canvas.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);

  // ── Controls ─────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  // The flock drifts between the three presets on its own: a long hold on each, then a slow blend to the next.
  const NAMES = Object.keys(PRESETS), BLEND = 25;
  let dA = 'murmuration', dB = dA, dClock = 0, dHold = 60;
  function drift(dt) {
    dClock += dt;
    if (dA === dB) { if (dClock > dHold) { dB = NAMES.filter(n => n !== dA)[(Math.random() * 2) | 0]; dClock = 0; } return; }
    const u = Math.min(1, dClock / BLEND), e = u * u * (3 - 2 * u), p = PRESETS[dA], q = PRESETS[dB];
    for (const k in p) T[k] = p[k] + (q[k] - p[k]) * e;
    if (u >= 1) { dA = dB; dClock = 0; dHold = 40 + Math.random() * 40; }
  }
  const $snd = $('snd'), sndLabel = () => { $snd.title = sound.muted ? 'Sound off' : 'Sound on'; $snd.setAttribute('aria-label', $snd.title); $snd.classList.toggle('on', !sound.muted); };
  sndLabel(); $snd.addEventListener('click', () => { sound.toggle(); sndLabel(); });
  $('scatter').addEventListener('click', () => {   // each bird bolts away from its neighbours' centre; flocking then pulls them back together
    for (let i = 0; i < N; i++) {
      const i3 = i * 3; let cx = 0, cy = 0, cz = 0, c = 0;
      for (let j = 0; j < N; j++) { const j3 = j * 3, dx = pos[j3] - pos[i3], dy = pos[j3 + 1] - pos[i3 + 1], dz = pos[j3 + 2] - pos[i3 + 2]; if (dx * dx + dy * dy + dz * dz < 2500) { cx += dx; cy += dy; cz += dz; c++; } }
      let ax = -cx, ay = -cy, az = -cz; const l = Math.hypot(ax, ay, az);
      if (l < 1e-3) { ax = Math.random() - 0.5; ay = Math.random() - 0.5; az = Math.random() - 0.5; } else { ax += (Math.random() - 0.5) * l * 0.3; az += (Math.random() - 0.5) * l * 0.3; }
      const k = P.spd * 1.8 / (Math.hypot(ax, ay, az) || 1);
      vel[i3] += ax * k; vel[i3 + 1] += ay * k * 0.6; vel[i3 + 2] += az * k;
    }
  });

  // ── Idle: after 5 s of nothing the camera starts to spin; after 10 s the nav, title and controls fade away.
  //    Any movement, touch or key brings them back. A flying hawk counts as activity.
  let idleSec = 0;
  const wake = () => { idleSec = 0; if (document.documentElement.hasAttribute('data-idle')) document.documentElement.removeAttribute('data-idle'); };
  for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(ev, wake, { passive: true });
  function idleTick(dt) {
    if (introLock) return;
    idleSec += dt;
    if (idleSec > 10 && !document.documentElement.hasAttribute('data-idle')) document.documentElement.setAttribute('data-idle', '');
  }

  // ── Loop: fixed physics step, so behaviour does not depend on frame rate ─
  seed(NUM); makeMesh(); theme(); resize();
  const DT = 1 / 60; let last = performance.now(), accT = 0, frames = 0, fpsT = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const real = Math.min(0.1, (now - last) / 1000); last = now;
    accT += real; let n = 0; while (accT >= DT && n < 3) { step(DT); accT -= DT; n++; } if (n === 3) accT = 0;
    idleTick(real); drift(real);
    placeCamera(real); if (introRun) introRun(real); draw(accT / DT, real);
    frames++; fpsT += real;
    if (fpsT > 1) { $('stats').textContent = `${N} birds · ${Math.round(frames / fpsT)} fps`; frames = 0; fpsT = 0; }
  }
  requestAnimationFrame(frame);

  // ── Modes: Classic is the pure boids; Skyline loads the extras on demand ─
  const ctx = {
    THREE, scene, camera, canvas, hawk, P, reduce, phone: PHONE, sound,
    BX, BY, BZ, MAX_FORCE, orbit,
    get birds() { return birds; }, get CAP() { return CAP; }, get pos() { return pos; }, get vel() { return vel; }, get N() { return N; },
    setLook(geo, mat) { look.geo = geo; look.mat = mat; birds.geometry = geo; birds.material = mat; },
    aiHawk: stepHawk
  };
  let sky = null, mode = 'classic';
  const $modes = document.querySelectorAll('#modes button');
  async function setMode(m) {
    if (m === mode) return;
    if (m === 'skyline') {
      sky ??= (await skyP).create(ctx);
      mode = m; X = sky; seed(N, CAP); sky.enable();
    } else {
      mode = m; if (X) X.disable(); X = null;
      ctx.setLook(birdGeo, birdMat); camera.fov = 50; camera.updateProjectionMatrix(); orbit.idle = 0;
      seed(N, CAP);
    }
    sound.setActive(m === 'skyline');
    document.body.dataset.mode = m; $modes.forEach(b => b.classList.toggle('on', b.dataset.m === m));
    theme();
  }
  $('modes').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setMode(b.dataset.m); });
  // ?debug adds buttons to spawn each visitor, so nothing waits on the ambient timers.
  if (new URLSearchParams(location.search).has('debug')) {
    const bar = document.querySelector('.ov-bar');
    for (const k of ['plane', 'blimp', 'glider', 'jetpack', 'cloud', 'storm', 'strike', 'chute', 'gust', 'hawk', 'heli', 'boat', 'ship', 'pirate', 'fire', 'scout', 'yeti', 'ufo', 'train', 'balloon', 'fireworks', 'jets', 'platypus', 'roadcar', 'airliner', 'cessna', 'whale', 'tornado', 'storms', 'military']) {
      const b = document.createElement('button'); b.textContent = k; b.dataset.sky = '';
      b.addEventListener('click', () => X && X.spawn(k)); bar.prepend(b);
    }
  }
  document.body.dataset.mode = 'classic';

  // ── ?intro: Hello. made of pixels, then a burst of birds from where each pixel was ─
  if (INTRO) {
    const html = document.documentElement;
    orbit.r = 310; orbit.ph = 1.1; orbit.idle = 99;
    const reveal = () => { introLock = false; idleSec = 0; html.dataset.revealing = ''; html.removeAttribute('data-intro'); setTimeout(() => html.removeAttribute('data-revealing'), 2200); };   // CSS fades the bar and controls in
    setMode('skyline').then(async () => {
      if (!intro) { reveal(); return; }
      // get the shaders compiled off the main thread and the font in, but never wait long: the Hello. should not lag behind the birds
      await Promise.race([Promise.all([renderer.compileAsync(scene, camera).catch(() => {}), fontP]), new Promise(r => setTimeout(r, 1200))]);
      const hello = document.createElement('canvas'); hello.id = 'hello';
      hello.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:5;transition:opacity .3s ease';
      canvas.parentElement.appendChild(hello);
      const dpr = Math.min(devicePixelRatio, 2), font = s => `900 ${s}px "Big Shoulders Display", "Arial Narrow", sans-serif`;
      let W = 0, H = 0, done = false;
      function drawHello() {
        const r = canvas.getBoundingClientRect(); W = r.width; H = r.height; hello.width = W * dpr; hello.height = H * dpr;
        const c = hello.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
        c.font = font(100); const w100 = c.measureText('Hello.').width;
        const size = Math.min(W * 0.78 / w100 * 100, H * 0.62);   // wide as the screen allows, never taller than most of it
        c.font = font(size); c.textAlign = 'center'; c.fillStyle = '#ffffff';
        const m = c.measureText('Hello.'); c.fillText('Hello.', W / 2, H / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
      }
      drawHello(); addEventListener('resize', () => { if (!done) drawHello(); });
      const fwd = new THREE.Vector3(), ray = new THREE.Vector3(), cen = new THREE.Vector3(), pt = new THREE.Vector3(), v = new THREE.Vector3(), cw = new THREE.Vector3();
      const rnd01 = (a, b) => a + Math.random() * (b - a);
      // The word is made of the flock itself: on input, birds from the back of the scene (or off screen, so the
      // jump is not seen) land exactly on the letters' pixels, sized to tile them, hold a beat while the text
      // fades, then peel away outward from the click and settle into normal flight. The bird count never changes.
      function burst(ev) {
        if (done) return; done = true;
        const r = canvas.getBoundingClientRect(), cx = ev && ev.clientX != null ? ev.clientX - r.left : W / 2, cy = ev && ev.clientY != null ? ev.clientY - r.top : H / 2;
        const data = hello.getContext('2d').getImageData(0, 0, hello.width, hello.height).data, stride = hello.width;
        const on = (x, y) => data[((y * dpr | 0) * stride + (x * dpr | 0)) * 4 + 3] > 128;
        let filled = 0; for (let y = 0; y < H; y += 3) for (let x = 0; x < W; x += 3) if (on(x, y)) filled++;
        const want = Math.min(PHONE ? 380 : 700, N >> 1), s = Math.max(2, Math.sqrt(filled * 9 / want));   // grid step: about `want` birds over the glyph
        placeCamera(0); camera.updateMatrixWorld(); camera.getWorldDirection(fwd);
        const dist = orbit.r * 0.55, unit = 2 * dist * Math.tan(camera.fov * Math.PI / 360) / H;   // world units per screen pixel on the letter plane
        const S = Math.max(0.5, Math.min(3, s * unit * 1.1 / 1.7));   // bird length ~ 1.1 x the spacing, so the glyph still reads
        const up = camera.up.clone().applyQuaternion(camera.quaternion), right = new THREE.Vector3().crossVectors(fwd, up).normalize();
        heldQ.setFromRotationMatrix(new THREE.Matrix4().makeBasis(up, fwd.clone().negate(), right));   // nose to screen right, wings up and down, top toward the camera
        const planePt = (sx, sy, out) => { ray.set(sx / W * 2 - 1, -(sy / H * 2 - 1), 0.5).unproject(camera).sub(camera.position).normalize(); return out.copy(camera.position).addScaledVector(ray, dist / ray.dot(fwd)); };
        planePt(cx, cy, cw);
        const pts = [];
        for (let y = 0; y < H; y += s) for (let x = 0; x < W; x += s) {
          const px = x + Math.random() * s, py = y + Math.random() * s; if (!on(px, py)) continue;
          planePt(px, py, pt); pts.push(pt.x, pt.y, pt.z);
        }
        // recruits: off screen or behind first, then the furthest from the camera
        const score = new Float32Array(N);
        for (let i = 0; i < N; i++) {
          v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); const depth = v.clone().sub(camera.position).dot(fwd); v.project(camera);
          score[i] = (depth <= 0 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1 ? 1e6 : 0) + depth;
        }
        const k = Math.min(pts.length / 3, N >> 1), rec = Array.from({ length: N }, (_, i) => i).sort((a, b) => score[b] - score[a]).slice(0, k);
        let far = 1; const items = [];
        for (let j = 0; j < k; j++) far = Math.max(far, Math.hypot(pts[j * 3] - cw.x, pts[j * 3 + 1] - cw.y, pts[j * 3 + 2] - cw.z));
        for (let j = 0; j < k; j++) {
          const i = rec[j], i3 = i * 3, x = pts[j * 3], y = pts[j * 3 + 1], z = pts[j * 3 + 2];
          X.recruit(i); pos[i3] = prev[i3] = x; pos[i3 + 1] = prev[i3 + 1] = y; pos[i3 + 2] = prev[i3 + 2] = z;
          vel[i3] = right.x * 1e-3; vel[i3 + 1] = right.y * 1e-3; vel[i3 + 2] = right.z * 1e-3; scl[i] = S;
          const d = Math.hypot(x - cw.x, y - cw.y, z - cw.z);
          items.push({ i, rel: 0.2 + (d / far) * 0.9 + rnd01(0, 0.08), at: -1, ox: (x - cw.x) / (d || 1), oy: (y - cw.y) / (d || 1), oz: (z - cw.z) / (d || 1) });   // stagger outward from the click
        }
        hello.style.transition = 'opacity .22s ease'; hello.style.opacity = '0'; setTimeout(() => hello.remove(), 400);
        let el = 0, shown = false;
        introRun = dt => {
          el += dt; let live = 0;
          for (const it of items) {
            if (it.at < 0) {
              if (el < it.rel) { live++; continue; }
              it.at = el; const i3 = it.i * 3, sp = P.spd * rnd01(0.9, 1.2);
              X.free(it.i); vel[i3] = it.ox * sp + fwd.x * sp * 0.3; vel[i3 + 1] = it.oy * sp + fwd.y * sp * 0.3; vel[i3 + 2] = it.oz * sp + fwd.z * sp * 0.3;   // outward kick, then flocking takes over
            }
            const u = (el - it.at) / 1.0;
            if (u >= 1) { if (scl[it.i] !== 1) scl[it.i] = 1; continue; }
            scl[it.i] = 1 + (S - 1) * (1 - u) ** 3; live++;
          }
          if (!shown && el > 0.9) { shown = true; reveal(); }
          if (!live && shown) introRun = null;
        };
      }
      addEventListener('pointerdown', burst, { once: true }); addEventListener('keydown', burst, { once: true });
    });
  }
