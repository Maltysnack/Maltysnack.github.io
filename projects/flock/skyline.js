// Skyline: the extended map. Same three rules, plus bird models, a hawk you
// steer, a skyline to perch on, gusts of wind and a plane the flock sees coming.
// flock.js owns the simulation and calls these hooks while the mode is on.
import * as THREE from './vendor/three.module.min.js';

export function create(ctx) {
  const { scene, camera, canvas, hawk, P, BX, BY, BZ, MAX_FORCE } = ctx;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const GROUND = -BY;

  // ── Bird models: nose along +z. Flat triangles, wings flap in the vertex shader ─
  const flip = t => t.map((v, i) => i % 3 === 0 ? -v : v);
  const body = (s) => {
    const H = [0, .02, .9], SL = [-.16, 0, .15], SR = [.16, 0, .15], TL = [0, 0, -.75], B = [0, .2, .1], D = [0, -.15, .1];
    return [[H, SL, B], [H, B, SR], [H, D, SL], [H, SR, D], [SL, TL, B], [B, TL, SR], [SL, D, TL], [SR, TL, D]].map(tr => tr.flat().map(v => v * s));
  };
  const wingTris = w => w.map(tr => tr.flat());
  const both = w => [...wingTris(w), ...wingTris(w).map(flip)];
  const MODELS = {
    cone: { amp: 0, geo: () => new THREE.ConeGeometry(0.45, 1.8, 4).rotateX(Math.PI / 2) },
    dart: { amp: 0, tris: () => {
      const T = [0, 0, 1], L = [-.75, 0, -.9], R = [.75, 0, -.9], C = [0, 0, -.5], K = [0, -.35, -.8];
      return [[T, L, C], [T, C, R], [T, C, K], [C, K, L]].map(t => t.flat());
    } },
    bird: { amp: 0.55, freq: 11, tris: () => [...body(1), ...both([
      [[.16, 0, .35], [.7, 0, .25], [.16, 0, -.45]], [[.7, 0, .25], [1.3, 0, -.45], [.16, 0, -.45]]])] },
    gull: { amp: 0.4, freq: 6.5, tris: () => [...body(1.25), ...both([
      [[.16, 0, .45], [.95, .15, .35], [.16, 0, -.55]], [[.95, .15, .35], [.95, .1, -.4], [.16, 0, -.55]], [[.95, .15, .35], [2.1, -.1, -.55], [.95, .1, -.4]]])] }
  };

  let N = 0;
  let flapAttr, phaseAttr;           // per-bird, shared by every model's geometry
  const geoCache = {};
  function build(name, instanced) {
    const m = MODELS[name];
    let g;
    if (m.geo) g = m.geo();
    else { g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(m.tris().flat()), 3)); g.computeVertexNormals(); }
    if (instanced) { g.setAttribute('flap', flapAttr); g.setAttribute('phase', phaseAttr); }
    else {
      const n = g.getAttribute('position').count;
      g.setAttribute('flap', new THREE.BufferAttribute(new Float32Array(n).fill(1), 1));
      g.setAttribute('phase', new THREE.BufferAttribute(new Float32Array(n), 1));
    }
    return g;
  }
  // One material patch serves birds and hawk; a model with amp 0 simply does not flap.
  function flapMaterial(U) {
    const m = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, side: THREE.DoubleSide });
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float flap; attribute float phase; uniform float uTime; uniform float uFreq; uniform float uAmp;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y += sin(uTime * uFreq + phase) * abs(position.x) * uAmp * flap;');
    };
    return m;
  }
  const UB = { uTime: { value: 0 }, uFreq: { value: 11 }, uAmp: { value: 0.55 } };
  const UH = { uTime: { value: 0 }, uFreq: { value: 5 }, uAmp: { value: 0.3 } };
  const birdMat = flapMaterial(UB), hawkMat = flapMaterial(UH);
  const hawkMesh = new THREE.Mesh(build('gull', false), hawkMat);
  hawkMesh.scale.setScalar(2.6); hawkMesh.frustumCulled = false;

  // ── World: ground, a small skyline, and perch slots along the roof edges ─
  const world = new THREE.Group();
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200).rotateX(-Math.PI / 2), groundMat);
  ground.position.y = GROUND - 0.2; world.add(ground);
  const BLD = [
    { x: -62, z: -30, w: 14, d: 14, h: 34 }, { x: -40, z: -34, w: 12, d: 12, h: 52 }, { x: -20, z: -28, w: 16, d: 12, h: 28 },
    { x: 2, z: -36, w: 12, d: 14, h: 62 }, { x: 24, z: -30, w: 14, d: 12, h: 40 }, { x: 46, z: -34, w: 12, d: 12, h: 30 }
  ];
  const bldMat = new THREE.MeshLambertMaterial({ color: 0x888888, flatShading: true });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 });
  const boxes = [], slots = [];
  for (const b of BLD) {
    const g = new THREE.BoxGeometry(b.w, b.h, b.d), m = new THREE.Mesh(g, bldMat);
    m.position.set(b.x, GROUND + b.h / 2, b.z); world.add(m);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), edgeMat); e.position.copy(m.position); world.add(e);
    const bx = { x0: b.x - b.w / 2, x1: b.x + b.w / 2, z0: b.z - b.d / 2, z1: b.z + b.d / 2, y0: GROUND, y1: GROUND + b.h };
    boxes.push(bx);
    // Birds sit along the roof edge, a little in from the lip.
    const inset = 0.9, sp = 2.2, top = bx.y1 + 0.5;
    for (let x = bx.x0 + inset; x <= bx.x1 - inset + 1e-6; x += sp) { slots.push({ x, y: top, z: bx.z0 + inset }); slots.push({ x, y: top, z: bx.z1 - inset }); }
    for (let z = bx.z0 + inset + sp; z <= bx.z1 - inset - sp + 1e-6; z += sp) { slots.push({ x: bx.x0 + inset, y: top, z }); slots.push({ x: bx.x1 - inset, y: top, z }); }
  }
  for (const s of slots) { s.taken = false; }
  const tall = BLD.reduce((a, b) => b.h > a.h ? b : a);
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const beacon = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 1.2), beaconMat);
  beacon.position.set(tall.x, GROUND + tall.h + 1.1, tall.z); world.add(beacon);

  // ── Plane: a low-poly silhouette on a straight pass the flock sees coming ─
  const planeMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  const planeMesh = new THREE.Group();
  for (const [w, h, d, y, z] of [[1.8, 1.8, 13, 0, 0], [20, 0.4, 3.2, 0, 0.5], [6.5, 0.3, 2.2, 0.2, -5.6], [0.35, 3, 2.6, 1.6, -5.4]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), planeMat); m.position.set(0, y, z); planeMesh.add(m);
  }
  planeMesh.visible = false; planeMesh.frustumCulled = false;
  const pl = { on: false, p: new THREE.Vector3(), dir: new THREE.Vector3(), end: 0, speed: 30 };
  const PLANE_R = 55, PLANE_LEN = 80;
  function launchPlane() {
    if (pl.on) return;
    const sign = Math.random() < 0.5 ? -1 : 1, alongX = Math.random() < 0.5, ext = (alongX ? BX : BZ) + 90;
    pl.dir.set(alongX ? sign : 0, 0, alongX ? 0 : sign);
    pl.p.set(alongX ? -sign * ext : rnd(-BX * 0.6, BX * 0.6), rnd(20, 36), alongX ? rnd(-BZ * 0.3, BZ * 0.8) : -sign * ext);
    pl.end = ext; pl.on = true; planeMesh.visible = true;
    planeMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), pl.dir);
  }

  // ── Gusts: a drifting volume of moving air, shown as streaks ─────────
  const GUST_R = 30, GUST_SPEED = 24, GUST_LIFE = 7, STREAKS = 240;
  const streakMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
  const gusts = [0, 1].map(() => {
    const g = { on: false, c: new THREE.Vector3(), dir: new THREE.Vector3(), age: 0, env: 0, off: new Float32Array(STREAKS * 3) };
    for (let i = 0; i < STREAKS; i++) {
      let x, y, z; do { x = rnd(-1, 1); y = rnd(-1, 1); z = rnd(-1, 1); } while (x * x + y * y + z * z > 1);
      g.off[i * 3] = x * GUST_R; g.off[i * 3 + 1] = y * GUST_R * 0.7; g.off[i * 3 + 2] = z * GUST_R;
    }
    g.geo = new THREE.BufferGeometry(); g.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STREAKS * 6), 3));
    g.mat = streakMat.clone(); g.lines = new THREE.LineSegments(g.geo, g.mat); g.lines.frustumCulled = false; g.lines.visible = false;
    g.along = new Float32Array(STREAKS).map(() => rnd(-GUST_R, GUST_R));
    return g;
  });
  for (const g of gusts) world.add(g.lines);
  function startGust() {
    const g = gusts.find(x => !x.on); if (!g) return;
    const a = rnd(0, Math.PI * 2); g.dir.set(Math.cos(a), 0, Math.sin(a));
    g.c.set(-g.dir.x * (BX + 10) + rnd(-20, 20), rnd(-12, 24), -g.dir.z * (BZ + 10) + rnd(-20, 20));
    g.age = 0; g.on = true; g.lines.visible = true;
  }

  // ── Per-bird state: 0 flying, 1 landing, 2 perched ───────────────────
  let st = new Uint8Array(0), tgt = new Int16Array(0), leaveAt = new Float32Array(0), freeSlots = slots.length;
  let clock = 0, nextGust = 0, nextPlane = 0;
  function reset() {
    N = ctx.N; st = new Uint8Array(N); tgt = new Int16Array(N); leaveAt = new Float32Array(N);
    flapAttr = new THREE.InstancedBufferAttribute(new Float32Array(N).fill(1), 1);
    phaseAttr = new THREE.InstancedBufferAttribute(Float32Array.from({ length: N }, () => rnd(0, 6.283)), 1);
    for (const k in geoCache) { geoCache[k].geometry.dispose(); delete geoCache[k]; }
    for (const s of slots) s.taken = false; freeSlots = slots.length;
    api.st = st; setModel(api.model);
    nextGust = clock + rnd(14, 24); nextPlane = clock + rnd(22, 40);
  }
  function setModel(name) {
    api.model = name;
    const m = MODELS[name];
    UB.uAmp.value = m.amp; UB.uFreq.value = m.freq || 1;
    geoCache[name] ??= { geometry: build(name, true) };
    ctx.setLook(geoCache[name].geometry, birdMat);
  }

  // ── Hooks the engine calls ───────────────────────────────────────────
  function before(dt) {
    clock += dt;
    if (pl.on) { pl.p.addScaledVector(pl.dir, pl.speed * dt); if (Math.abs(pl.p.x * pl.dir.x + pl.p.z * pl.dir.z) > pl.end) { pl.on = false; planeMesh.visible = false; } }
    for (const g of gusts) if (g.on) {
      g.age += dt; g.c.addScaledVector(g.dir, GUST_SPEED * dt);
      g.env = Math.sin(Math.PI * Math.min(1, g.age / GUST_LIFE));
      if (g.age > GUST_LIFE) { g.on = false; g.lines.visible = false; g.env = 0; }
    }
    if (!ctx.reduce) {   // ambient weather, off under reduced motion
      if (clock > nextGust) { startGust(); nextGust = clock + rnd(22, 45); }
      if (clock > nextPlane) { launchPlane(); nextPlane = clock + rnd(35, 70); }
    }
    // Ambient perching: sample a few birds a step; any near a free roof edge may land.
    if (freeSlots === 0) return;
    const pos = ctx.pos;
    for (let s = 0; s < 8; s++) {
      const i = (Math.random() * N) | 0; if (st[i] || Math.random() > 0.3) continue;
      const i3 = i * 3, px = pos[i3], py = pos[i3 + 1], pz = pos[i3 + 2];
      let best = -1, bd = 24 * 24;
      for (let k = 0; k < slots.length; k++) {
        const sl = slots[k]; if (sl.taken || py < sl.y + 1.5) continue;
        const d = (sl.x - px) ** 2 + (sl.y - py) ** 2 + (sl.z - pz) ** 2;
        if (d < bd) { bd = d; best = k; }
      }
      if (best >= 0) { slots[best].taken = true; freeSlots--; st[i] = 1; tgt[i] = best; }
    }
  }

  function inGust(x, y, z) {
    for (const g of gusts) if (g.on && (x - g.c.x) ** 2 + (y - g.c.y) ** 2 + (z - g.c.z) ** 2 < GUST_R * GUST_R) return true;
    return false;
  }
  function takeOff(i) {
    const vel = ctx.vel, i3 = i * 3;
    slots[tgt[i]].taken = false; freeSlots++; st[i] = 0; flapAttr.array[i] = 1; flapAttr.needsUpdate = true;
    const a = rnd(0, Math.PI * 2), s = P.spd * 0.6;
    vel[i3] = Math.cos(a) * s * 0.5; vel[i3 + 1] = s; vel[i3 + 2] = Math.sin(a) * s * 0.5;
  }
  // Landing birds glide in and slow to a stop; perched birds wait, then leave.
  function drive(i, dt) {
    const pos = ctx.pos, vel = ctx.vel, i3 = i * 3;
    if (st[i] === 1) {
      const sl = slots[tgt[i]], dx = sl.x - pos[i3], dy = sl.y - pos[i3 + 1], dz = sl.z - pos[i3 + 2], d = Math.hypot(dx, dy, dz);
      if (d < 0.6) {
        pos[i3] = sl.x; pos[i3 + 1] = sl.y; pos[i3 + 2] = sl.z;
        const a = rnd(0, Math.PI * 2); vel[i3] = Math.cos(a) * 1e-3; vel[i3 + 1] = 0; vel[i3 + 2] = Math.sin(a) * 1e-3;   // tiny, so the bird keeps a heading
        st[i] = 2; leaveAt[i] = clock + rnd(5, 15); flapAttr.array[i] = 0; flapAttr.needsUpdate = true;
        return;
      }
      const want = Math.min(P.spd, d * 1.8 + 2) / d, k = Math.min(1, dt * 4);
      vel[i3] += (dx * want - vel[i3]) * k; vel[i3 + 1] += (dy * want - vel[i3 + 1]) * k; vel[i3 + 2] += (dz * want - vel[i3 + 2]) * k;
      pos[i3] += vel[i3] * dt; pos[i3 + 1] += vel[i3 + 1] * dt; pos[i3 + 2] += vel[i3 + 2] * dt;
    } else {
      const h = (pos[i3] - hawk.p.x) ** 2 + (pos[i3 + 1] - hawk.p.y) ** 2 + (pos[i3 + 2] - hawk.p.z) ** 2;
      if (clock > leaveAt[i] || h < 30 * 30 || inGust(pos[i3], pos[i3 + 1], pos[i3 + 2])) takeOff(i);
    }
  }

  // Extra forces on a flying bird: buildings, the plane's path, wind.
  const PAD = 9;
  function force(px, py, pz, out) {
    for (const b of boxes) {
      let dx = px - clamp(px, b.x0, b.x1), dy = py - clamp(py, b.y0, b.y1), dz = pz - clamp(pz, b.z0, b.z1), d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= PAD * PAD) continue;
      if (d2 < 1e-6) { dy = 1; d2 = 1; }
      const d = Math.sqrt(d2), k = MAX_FORCE * 2.2 * (1 - d / PAD) / d;
      out[0] += dx * k; out[1] += dy * k; out[2] += dz * k;
    }
    if (pl.on) {   // flee the line the plane is on, well ahead of it
      const rx = px - pl.p.x, ry = py - pl.p.y, rz = pz - pl.p.z, t = clamp(rx * pl.dir.x + rz * pl.dir.z, -10, PLANE_LEN);
      const ex = rx - pl.dir.x * t, ey = ry, ez = rz - pl.dir.z * t, d = Math.hypot(ex, ey, ez);
      if (d < PLANE_R) { const k = MAX_FORCE * 2.5 * (1 - d / PLANE_R) ** 1.5 / (d || 1); out[0] += ex * k; out[1] += ey * k; out[2] += ez * k; }
    }
    for (const g of gusts) if (g.on) {
      const d = Math.hypot(px - g.c.x, py - g.c.y, pz - g.c.z);
      if (d < GUST_R) { const w = (1 - d / GUST_R) * g.env * 34; out[0] += g.dir.x * w; out[2] += g.dir.z * w; }
    }
  }

  // ── The hawk: steered by pointer or arrows, or left to chase ─────────
  const H = { yaw: 0, pitch: 0, roll: 0, nx: 0, ny: 0 };
  const keys = { l: 0, r: 0, u: 0, d: 0 };
  const dead = v => Math.abs(v) < 0.08 ? 0 : (v - Math.sign(v) * 0.08) / 0.92;
  function pushOut(p, pad) {
    for (const b of boxes) {
      if (p.x < b.x0 - pad || p.x > b.x1 + pad || p.y < b.y0 - pad || p.y > b.y1 + pad || p.z < b.z0 - pad || p.z > b.z1 + pad) continue;
      // nearest face
      const ds = [p.x - (b.x0 - pad), (b.x1 + pad) - p.x, p.y - (b.y0 - pad), (b.y1 + pad) - p.y, p.z - (b.z0 - pad), (b.z1 + pad) - p.z];
      const k = ds.indexOf(Math.min(...ds));
      if (k === 0) p.x = b.x0 - pad; else if (k === 1) p.x = b.x1 + pad; else if (k === 2) p.y = b.y0 - pad; else if (k === 3) p.y = b.y1 + pad; else if (k === 4) p.z = b.z0 - pad; else p.z = b.z1 + pad;
    }
  }
  function steerHawk(dt) {
    const turn = dead(H.nx) * -1 + (keys.l - keys.r), climb = dead(H.ny) + (keys.u - keys.d);
    const prevYaw = H.yaw;
    H.yaw += turn * 1.7 * dt; H.pitch = clamp(H.pitch + climb * 1.3 * dt, -1.1, 1.1);
    // Near a wall or the ground, the hawk banks back inside on its own.
    const p = hawk.p, out = Math.max(Math.abs(p.x) / (BX - 6), Math.abs(p.z) / (BZ - 6));
    if (out > 1) {
      const want = Math.atan2(-p.x, -p.z); let d = want - H.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      H.yaw += clamp(d, -1, 1) * Math.min(1, dt * 2.5);
    }
    if (p.y > BY - 6) H.pitch -= dt * 1.5; if (p.y < GROUND + 6) H.pitch += dt * 1.5;
    H.roll += (clamp((H.yaw - prevYaw) / dt * 0.45, -0.9, 0.9) - H.roll) * Math.min(1, dt * 6);
    const c = Math.cos(H.pitch), sp = P.spd * 1.3;
    hawk.v.set(Math.sin(H.yaw) * c * sp, Math.sin(H.pitch) * sp, Math.cos(H.yaw) * c * sp);
    p.addScaledVector(hawk.v, dt);
  }
  function hawkStep(dt) {
    if (api.flying) steerHawk(dt);
    else {
      const prevYaw = H.yaw;
      ctx.aiHawk(dt);
      const v = hawk.v, m = v.length() || 1;
      H.yaw = Math.atan2(v.x, v.z); H.pitch = Math.asin(clamp(v.y / m, -1, 1));
      H.roll += (clamp(Math.atan2(Math.sin(H.yaw - prevYaw), Math.cos(H.yaw - prevYaw)) / dt * 0.45, -0.9, 0.9) - H.roll) * Math.min(1, dt * 6);
    }
    pushOut(hawk.p, 2.5);
    hawk.p.x = clamp(hawk.p.x, -BX - 10, BX + 10); hawk.p.z = clamp(hawk.p.z, -BZ - 10, BZ + 10); hawk.p.y = clamp(hawk.p.y, GROUND + 2, BY + 8);
  }

  // ── Per-frame drawing: hawk, camera, plane, streaks ──────────────────
  const hp = new THREE.Vector3(), eul = new THREE.Euler(0, 0, 0, 'YXZ'), cam = new THREE.Vector3(), look = new THREE.Vector3(), fwd = new THREE.Vector3(), tmp = new THREE.Vector3();
  let tick = 0, camReady = false;
  function draw(a, dt) {
    tick += dt; UB.uTime.value = tick; UH.uTime.value = tick;
    hp.lerpVectors(hawk.q, hawk.p, a);
    hawkMesh.position.copy(hp); hawkMesh.quaternion.setFromEuler(eul.set(-H.pitch, H.yaw, H.roll));
    if (api.flying) {   // chase camera, smoothed so frame-rate wobble never reaches the view
      const c = Math.cos(H.pitch);
      fwd.set(Math.sin(H.yaw) * c, Math.sin(H.pitch), Math.cos(H.yaw) * c);
      cam.copy(hp).addScaledVector(fwd, -17); cam.y += 5;
      if (!camReady) { camera.position.copy(cam); camReady = true; }
      camera.position.lerp(cam, 1 - Math.exp(-dt * 5));
      look.copy(hp).addScaledVector(fwd, 28); camera.lookAt(look);
    }
    if (pl.on) planeMesh.position.copy(pl.p);
    for (const g of gusts) if (g.on) {
      const pa = g.geo.attributes.position.array, len = 5 * g.env;
      g.mat.opacity = 0.6 * g.env;
      for (let i = 0; i < STREAKS; i++) {
        g.along[i] += 38 * dt; if (g.along[i] > GUST_R) g.along[i] -= 2 * GUST_R;
        const ox = g.off[i * 3], oy = g.off[i * 3 + 1], oz = g.off[i * 3 + 2];
        const al = ox * g.dir.x + oz * g.dir.z, px = ox - al * g.dir.x, pz = oz - al * g.dir.z;   // perpendicular part of the offset
        const inside = g.along[i] * g.along[i] + px * px + oy * oy + pz * pz < GUST_R * GUST_R;
        const x = g.c.x + px + g.dir.x * g.along[i], y = g.c.y + oy, z = g.c.z + pz + g.dir.z * g.along[i], l = inside ? len : 0;
        pa[i * 6] = x; pa[i * 6 + 1] = y; pa[i * 6 + 2] = z;
        pa[i * 6 + 3] = x - g.dir.x * l; pa[i * 6 + 4] = y; pa[i * 6 + 5] = z - g.dir.z * l;
      }
      g.geo.attributes.position.needsUpdate = true;
    }
  }

  function theme(col) {
    const text = col('--text'), bg = col('--bg'), accent = col('--accent');
    birdMat.color.copy(text); hawkMat.color.copy(accent); planeMat.color.copy(text); edgeMat.color.copy(text);
    streakMat.color.copy(text); for (const g of gusts) g.mat.color.copy(text);
    groundMat.color.copy(bg).lerp(text, 0.07); bldMat.color.copy(bg).lerp(text, 0.16); beaconMat.color.copy(accent);
  }

  // ── Input ────────────────────────────────────────────────────────────
  const onMove = e => { const r = canvas.getBoundingClientRect(); H.nx = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1); H.ny = clamp(-(((e.clientY - r.top) / r.height) * 2 - 1), -1, 1); };
  const onUp = e => { if (e.pointerType === 'touch') { H.nx = 0; H.ny = 0; } };
  const KEY = { ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd' };
  const onKey = v => e => { const k = KEY[e.code]; if (!k) return; keys[k] = v; if (api.flying) e.preventDefault(); };
  const kd = onKey(1), ku = onKey(0);

  const api = {
    st, model: 'bird', flying: true,
    before, drive, force, hawk: hawkStep, draw, theme, reset, setModel,
    gust: startGust, plane: launchPlane,
    toggleFly() {
      api.flying = !api.flying; canvas.style.cursor = api.flying ? 'crosshair' : '';
      if (api.flying) { camReady = false; H.nx = 0; H.ny = 0; } else ctx.orbit.idle = 0;
      camera.fov = api.flying ? 65 : 50; camera.updateProjectionMatrix();
      return api.flying;
    },
    enable() {
      scene.add(world, planeMesh, hawkMesh);
      addEventListener('pointermove', onMove); canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', onUp);
      addEventListener('keydown', kd); addEventListener('keyup', ku);
      api.flying = true; camReady = false; camera.fov = 65; camera.updateProjectionMatrix(); canvas.style.cursor = 'crosshair';
      pl.on = false; planeMesh.visible = false; for (const g of gusts) { g.on = false; g.lines.visible = false; }
      hawk.p.set(BX * 0.5, 0, BZ * 0.5); H.yaw = -Math.PI * 0.75; H.pitch = 0; H.roll = 0; hawk.q.copy(hawk.p);
      reset();
    },
    disable() {
      scene.remove(world, planeMesh, hawkMesh);
      removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp);
      removeEventListener('keydown', kd); removeEventListener('keyup', ku);
      canvas.style.cursor = ''; api.flying = false;
      hawk.p.set(BX, BY * 0.5, 0); hawk.v.set(-1, 0, 0); hawk.q.copy(hawk.p);
    }
  };
  return api;
}
