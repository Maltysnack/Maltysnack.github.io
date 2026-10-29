  import * as THREE from './vendor/three.module.min.js';

  // ── Parameters ──────────────────────────────────────────────────────
  const PRESETS = {
    murmuration: { sep: 1.6, ali: 1.3, coh: 1.2, vis: 9,   spd: 20 },
    school:      { sep: 1.2, ali: 2.6, coh: 1.4, vis: 5,   spd: 14 },
    swarm:       { sep: 2.4, ali: 0.2, coh: 1.8, vis: 9,   spd: 26 }
  };
  const NUM = matchMedia('(max-width: 640px)').matches ? 900 : 1600;
  const T = { ...PRESETS.murmuration };   // what the controls ask for
  const P = { ...T };                     // what the flock uses, eased toward T so big changes never snap
  const BX = 90, BY = 45, BZ = 60;          // half extents of the box the flock lives in
  const MARGIN = 14;                        // how early the walls start to push
  const MAX_FORCE = 40;

  // ── State, in flat typed arrays: one slot per bird ───────────────────
  let N = 0, pos, vel, acc, prev;
  function seed(n) {
    N = n; pos = new Float32Array(n * 3); prev = new Float32Array(n * 3); vel = new Float32Array(n * 3); acc = new Float32Array(n * 3);
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
    const useHawk = $hawk.checked || !!X, fleeR2 = 22 * 22;
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
      // Walls push back harder the deeper a bird gets into the margin.
      const wall = (p, b) => p > b - MARGIN ? -(p - (b - MARGIN)) / MARGIN : p < -b + MARGIN ? (-b + MARGIN - p) / MARGIN : 0;
      fx += wall(px, BX) * MAX_FORCE * 1.5; fy += wall(py, BY) * MAX_FORCE * 1.5; fz += wall(pz, BZ) * MAX_FORCE * 1.5;
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
    if (useHawk) { if (X) X.hawk(dt); else stepHawk(dt); }
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
  const camera = new THREE.PerspectiveCamera(50, 1, 1, 800);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(40, 80, 30); scene.add(sun);

  const birdGeo = new THREE.ConeGeometry(0.45, 1.8, 4); birdGeo.rotateX(Math.PI / 2);   // nose along +z
  const birdMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  const hawkMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  const hawkMesh = new THREE.Mesh(new THREE.ConeGeometry(1.4, 5, 4).rotateX(Math.PI / 2), hawkMat);
  scene.add(hawkMesh);
  let birds;
  const look = { geo: birdGeo, mat: birdMat };
  function makeMesh() {
    if (birds) { scene.remove(birds); birds.dispose(); }
    birds = new THREE.InstancedMesh(look.geo, look.mat, N);
    birds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    birds.frustumCulled = false;
    scene.add(birds);
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), fwd = new THREE.Vector3(0, 0, 1), dir = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), at = new THREE.Vector3();
  function draw(a, real) {
    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      dir.set(vel[i3], vel[i3 + 1], vel[i3 + 2]).normalize();
      q.setFromUnitVectors(fwd, dir);
      m4.compose(at.set(prev[i3] + (pos[i3] - prev[i3]) * a, prev[i3 + 1] + (pos[i3 + 1] - prev[i3 + 1]) * a, prev[i3 + 2] + (pos[i3 + 2] - prev[i3 + 2]) * a), q, one);
      birds.setMatrixAt(i, m4);
    }
    birds.instanceMatrix.needsUpdate = true;
    hawkMesh.visible = $hawk.checked && !X;
    if (X) X.draw(a, real);
    if (hawkMesh.visible) { hawkMesh.position.lerpVectors(hawk.q, hawk.p, a); hawkMesh.quaternion.setFromUnitVectors(fwd, dir.copy(hawk.v).normalize()); }
    renderer.render(scene, camera);
  }

  // Colours come from the site tokens, and follow the theme toggle.
  function theme() {
    const cs = getComputedStyle(document.documentElement);
    const col = v => new THREE.Color().setStyle(cs.getPropertyValue(v).trim() || '#888');
    const bg = col('--bg');
    scene.background = bg; scene.fog = new THREE.Fog(bg, 120, 330);
    birdMat.color = col('--text'); hawkMat.color = col('--accent');
    if (X) X.theme(col);
  }
  new MutationObserver(theme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', theme);

  // ── Camera: drag to orbit, wheel or pinch to zoom, slow drift when idle ─
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const orbit = { th: 0.6, ph: 1.25, r: 120, idle: 0 };
  const pointers = new Map(); let pinch0 = 0;
  canvas.addEventListener('pointerdown', e => { if (X && X.flying) return; canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, [e.clientX, e.clientY]); orbit.idle = 0; });
  canvas.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId) || (X && X.flying)) return;
    const [x0, y0] = pointers.get(e.pointerId); pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch0) orbit.r = Math.min(160, Math.max(40, orbit.r * pinch0 / d));
      pinch0 = d; return;
    }
    orbit.th -= (e.clientX - x0) * 0.006;
    orbit.ph = Math.min(2.9, Math.max(0.25, orbit.ph - (e.clientY - y0) * 0.006));
    orbit.idle = 0;
  });
  const up = e => { pointers.delete(e.pointerId); pinch0 = 0; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => { e.preventDefault(); if (X && X.flying) return; orbit.r = Math.min(160, Math.max(40, orbit.r * Math.exp(e.deltaY * 0.001))); orbit.idle = 0; }, { passive: false });
  function placeCamera(dt) {
    if (X && X.flying) return;      // Skyline's chase camera sets itself in draw
    orbit.idle += dt;
    if (!reduce && orbit.idle > 3) orbit.th += dt * 0.05;
    camera.position.set(orbit.r * Math.sin(orbit.ph) * Math.sin(orbit.th), orbit.r * Math.cos(orbit.ph), orbit.r * Math.sin(orbit.ph) * Math.cos(orbit.th));
    camera.lookAt(0, 0, 0);
  }
  function resize() {
    const r = canvas.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);

  // ── Controls ─────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id), $hawk = $('hawk');
  const keys = ['sep', 'ali', 'coh', 'vis'];
  function sync() { for (const k of keys) { $(k).value = T[k]; $(k).nextElementSibling.value = (+T[k]).toFixed(1); } }
  for (const k of keys) $(k).addEventListener('input', e => {
    T[k] = +e.target.value; sync();
    document.querySelectorAll('#presets button').forEach(b => b.classList.remove('on'));
  });
  $('presets').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    Object.assign(T, PRESETS[b.dataset.p]); sync();
    document.querySelectorAll('#presets button').forEach(x => x.classList.toggle('on', x === b));
  });
  $('scatter').addEventListener('click', () => { seed(N); if (X) X.reset(); });
  if (matchMedia('(max-width: 640px)').matches) $('panel').open = false;

  // ── Loop: fixed physics step, so behaviour does not depend on frame rate ─
  seed(NUM); makeMesh(); sync(); theme(); resize();
  const DT = 1 / 60; let last = performance.now(), accT = 0, frames = 0, fpsT = 0;
  function frame(now) {
    const real = Math.min(0.1, (now - last) / 1000); last = now;
    accT += real; let n = 0; while (accT >= DT && n < 3) { step(DT); accT -= DT; n++; } if (n === 3) accT = 0;
    placeCamera(real); draw(accT / DT, real);
    frames++; fpsT += real;
    if (fpsT > 1) { $('stats').textContent = `${N} birds · ${Math.round(frames / fpsT)} fps`; frames = 0; fpsT = 0; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ── Modes: Classic is the pure boids; Skyline loads the extras on demand ─
  const ctx = {
    THREE, scene, camera, canvas, hawk, P, reduce,
    BX, BY, BZ, MAX_FORCE, orbit,
    get birds() { return birds; }, get pos() { return pos; }, get vel() { return vel; }, get N() { return N; },
    setLook(geo, mat) { look.geo = geo; look.mat = mat; birds.geometry = geo; birds.material = mat; },
    aiHawk: stepHawk
  };
  let sky = null, mode = 'classic';
  const $modes = document.querySelectorAll('#modes button'), $title = document.querySelector('.ov-title p');
  const blurb = $title.textContent, skyBlurb = 'The same three rules, plus a skyline to land on, gusts of wind and the odd visitor passing through. Press Fly hawk to take the hawk: steer with the mouse or arrow keys.';
  async function setMode(m) {
    if (m === mode) return;
    if (m === 'skyline') {
      sky ??= (await import('./skyline.js?v=5')).create(ctx);
      mode = m; X = sky; seed(N); sky.enable(); $title.textContent = skyBlurb;
    } else {
      mode = m; if (X) X.disable(); X = null;
      ctx.setLook(birdGeo, birdMat); camera.fov = 50; camera.updateProjectionMatrix(); orbit.idle = 0;
      seed(N); $title.textContent = blurb;
    }
    document.body.dataset.mode = m; $modes.forEach(b => b.classList.toggle('on', b.dataset.m === m));
    $('fly').classList.toggle('on', !!(X && X.flying));
    theme();
  }
  $('modes').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setMode(b.dataset.m); });
  $('fly').addEventListener('click', () => { if (X) $('fly').classList.toggle('on', X.toggleFly()); });
  // ?debug adds buttons to spawn each visitor, so nothing waits on the ambient timers.
  if (new URLSearchParams(location.search).has('debug')) {
    const bar = document.querySelector('.ov-bar');
    for (const k of ['plane', 'blimp', 'glider', 'jetpack', 'cloud', 'chute', 'gust']) {
      const b = document.createElement('button'); b.textContent = k; b.dataset.sky = '';
      b.addEventListener('click', () => X && X.spawn(k)); bar.prepend(b);
    }
  }
  document.body.dataset.mode = 'classic';
