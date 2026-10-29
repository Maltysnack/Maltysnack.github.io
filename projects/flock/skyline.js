// Skyline: the extended map. Same three rules, plus flapping birds, a hawk you
// can take over, a skyline to perch on, gusts of wind, and visitors passing
// through (plane, blimp, hang glider, jetpack, cloud, a parachutist).
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

  // ── Visitors ─────────────────────────────────────────────────────────
  // Every pass flies in a lane above the tallest roof (plus its own hang, bob
  // and clearance), so nothing can touch a building.
  const TOP = Math.max(...boxes.map(b => b.y1)), SAFE = TOP + 8, BOB = 1.2;
  const solidMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, side: THREE.DoubleSide });
  const accentMat = new THREE.MeshLambertMaterial({ color: 0xff0000, flatShading: true, side: THREE.DoubleSide });
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, transparent: true, opacity: 0.88 });
  const box = (w, h, d, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; };
  const ball = (r, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat); m.position.set(x, y, z); return m; };
  function figure(mat) {   // a stick person, feet at y = 0, about 2 tall
    const g = new THREE.Group();
    g.add(box(0.5, 0.9, 0.3, mat, 0, 1.15, 0), ball(0.28, mat, 0, 1.85), box(0.18, 0.8, 0.2, mat, -0.14, 0.4), box(0.18, 0.8, 0.2, mat, 0.14, 0.4),
      box(0.14, 0.7, 0.14, mat, -0.36, 1.2), box(0.14, 0.7, 0.14, mat, 0.36, 1.2));
    return g;
  }
  // Banner for the blimp: the site icon, with a cloth ripple in the vertex shader.
  const UBn = { uTime: { value: 0 }, uL: { value: 14 } };
  const bannerCanvas = document.createElement('canvas'); bannerCanvas.width = 512; bannerCanvas.height = 160;
  const bctx = bannerCanvas.getContext('2d'); bctx.fillStyle = '#ffffff'; bctx.fillRect(0, 0, 512, 160);
  const bannerTex = new THREE.CanvasTexture(bannerCanvas); bannerTex.colorSpace = THREE.SRGBColorSpace;
  const icon = new Image();
  icon.onload = () => {
    bctx.drawImage(icon, 0, 0, 160, 160);
    const px = bctx.getImageData(2, 2, 1, 1).data;   // fill the rest with the icon's own background
    bctx.fillStyle = `rgb(${px[0]},${px[1]},${px[2]})`; bctx.fillRect(0, 0, 512, 160); bctx.drawImage(icon, 176, 0, 160, 160);
    bannerTex.needsUpdate = true;
  };
  icon.src = '/icons/icon-192.png';
  const bannerMat = new THREE.MeshBasicMaterial({ map: bannerTex, side: THREE.DoubleSide });
  bannerMat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, UBn);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uL;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat k = -position.z / uL;\ntransformed.x += sin(uTime * 5.0 + position.z * 1.1) * 1.1 * k;\ntransformed.y += sin(uTime * 3.0 + position.z * 0.8) * 0.4 * k;');
  };
  const MESH = {
    plane() {
      const g = new THREE.Group();
      for (const [w, h, d, y, z] of [[1.8, 1.8, 13, 0, 0], [20, 0.4, 3.2, 0, 0.5], [6.5, 0.3, 2.2, 0.2, -5.6], [0.35, 3, 2.6, 1.6, -5.4]]) g.add(box(w, h, d, solidMat, 0, y, z));
      return g;
    },
    blimp() {
      const g = new THREE.Group(), hull = ball(1, solidMat); hull.scale.set(3.4, 3.4, 9);
      const ban = new THREE.Mesh(new THREE.PlaneGeometry(14, 4.5, 20, 1).translate(7, 0, 0).rotateY(Math.PI / 2), bannerMat); ban.position.z = -10.5;
      g.add(hull, box(1.4, 1.1, 3, solidMat, 0, -3.6, 0.5), box(0.3, 4.4, 2.6, solidMat, 0, 0, -8), box(4.4, 0.3, 2.6, solidMat, 0, 0, -8), ban);
      return g;
    },
    glider() {
      const g = new THREE.Group(), w = new THREE.BufferGeometry();
      w.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0.6, 3, -4.6, 0.2, -2.6, 0, 0.1, -1.4, 0, 0.6, 3, 0, 0.1, -1.4, 4.6, 0.2, -2.6]), 3)); w.computeVertexNormals();
      const f = figure(solidMat); f.scale.setScalar(0.9); f.position.y = -3.3; f.rotation.x = Math.PI / 2 * 0.9; f.position.z = 0.4;   // lying under the wing
      g.add(new THREE.Mesh(w, accentMat), f, box(0.12, 2.6, 0.12, solidMat, 0, -1.3, 0.2));
      return g;
    },
    jetpack() {
      const g = new THREE.Group(), f = figure(solidMat); f.position.y = -1; f.rotation.x = 0.35;
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.6, 6).rotateX(Math.PI), flameMat); flame.position.set(0, -1.4, -0.45); flame.name = 'flame';
      g.add(f, box(0.6, 1, 0.35, accentMat, 0, 0.1, -0.35), flame);
      return g;
    },
    cloud() {
      const g = new THREE.Group();
      for (const [r, x, y, z] of [[7, 0, 0, 0], [5.5, 7, -1, 1], [5, -7, -1.4, -1], [4.5, 2.5, 3, 2], [4, -3, 2.5, -3], [3.6, 10, -2, -2]]) g.add(ball(r, cloudMat, x, y * 0.7, z));
      return g;
    }
  };
  // path: how far ahead of itself a visitor is felt; k: how hard birds flee (cloud is gentle).
  const KINDS = {
    plane:   { weight: 30, speed: 20, R: 60, k: 2.5, path: 90, y: [30, 38], drop: 1, ext: 90 },
    blimp:   { weight: 22, speed: 11, R: 50, k: 2.0, path: 70, y: [32, 38], drop: 4.6, ext: 100 },
    glider:  { weight: 14, speed: 9,  R: 36, k: 1.6, path: 40, y: [31, 37], drop: 4.4, ext: 60 },
    jetpack: { weight: 12, speed: 14, R: 30, k: 1.6, path: 30, y: [30, 38], drop: 3.8, ext: 60 }
  };
  const fl = { on: false, kind: '', cfg: null, p: new THREE.Vector3(), dir: new THREE.Vector3(), y0: 0, end: 0, mesh: null };
  const meshes = {};
  function launchPass(kind) {
    if (fl.on) return;
    if (!kind) { let r = Math.random() * Object.values(KINDS).reduce((a, k) => a + k.weight, 0); for (const k in KINDS) { r -= KINDS[k].weight; if (r <= 0) { kind = k; break; } } }
    const cfg = KINDS[kind], sign = Math.random() < 0.5 ? -1 : 1, alongX = Math.random() < 0.5, ext = (alongX ? BX : BZ) + cfg.ext;
    meshes[kind] ??= MESH[kind](); fl.mesh = meshes[kind]; scene.add(fl.mesh);
    fl.kind = kind; fl.cfg = cfg; fl.dir.set(alongX ? sign : 0, 0, alongX ? 0 : sign);
    fl.y0 = Math.max(rnd(cfg.y[0], cfg.y[1]), SAFE + cfg.drop + BOB);   // clearance over the roofs, always
    fl.p.set(alongX ? -sign * ext : rnd(-BX * 0.6, BX * 0.6), fl.y0, alongX ? rnd(-BZ * 0.3, BZ * 0.8) : -sign * ext);
    fl.end = ext; fl.on = true;
    fl.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), fl.dir);
  }
  // Clouds are their own thing: several at once, each its own speed, height and size,
  // all drifting the same way, through the buildings if they like. Birds shy from them gently.
  const CLOUD_R = 26, CLOUD_K = 0.8, clouds = [];
  const wind = new THREE.Vector3();
  function pickWind() { const sign = Math.random() < 0.5 ? -1 : 1; if (Math.random() < 0.5) wind.set(sign, 0, 0); else wind.set(0, 0, sign); }
  function spawnCloud(anywhere) {
    const alongX = wind.x !== 0, ext = (alongX ? BX : BZ) + 45, sc = rnd(0.6, 1.4);
    const a = anywhere ? rnd(-ext, ext) : -(alongX ? wind.x : wind.z) * ext, l = alongX ? rnd(-BZ, BZ) : rnd(-BX, BX);
    const mesh = MESH.cloud(); mesh.scale.setScalar(sc); scene.add(mesh);
    clouds.push({ mesh, sc, speed: rnd(2.5, 6), end: ext, p: new THREE.Vector3(alongX ? a : l, rnd(-5, 40), alongX ? l : a) });
  }
  function clearClouds() { for (const c of clouds) scene.remove(c.mesh); clouds.length = 0; }
  function endPass() { fl.on = false; scene.remove(fl.mesh); }

  // ── Parachutist: steps off the tallest roof into open air and drifts down ─
  const tallBox = boxes.reduce((a, b) => b.y1 > a.y1 ? b : a);
  const ch = { on: false, phase: 0, t: 0, open: 0, p: new THREE.Vector3(), v: new THREE.Vector3() };
  const chute = new THREE.Group(), chFig = figure(solidMat), chCanopy = new THREE.Group();
  {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(2.7, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), accentMat); dome.position.y = 4.2;
    const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([[1.8, 4.2, 0], [0, 2, 0.1], [-1.8, 4.2, 0], [0, 2, 0.1], [0, 4.2, 1.8], [0, 2, 0.1], [0, 4.2, -1.8], [0, 2, 0.1]].map(a => new THREE.Vector3(...a))), edgeMat);
    chCanopy.add(dome, lines); chCanopy.position.y = 0; chute.add(chFig, chCanopy);
  }
  function startChute() {
    if (ch.on) return;
    ch.on = true; ch.phase = 0; ch.t = 0; ch.open = 0; ch.v.set(0, 0, 0); ch.sway = rnd(0, 6.28); ch.side = Math.random() < 0.5 ? -1 : 1;
    ch.p.set(tallBox.x0 + (tallBox.x1 - tallBox.x0) / 2, tallBox.y1 + 0.05, tallBox.z1 - 0.9);   // standing at the open (front) edge
    chCanopy.visible = false; chute.rotation.set(0, 0, 0); scene.add(chute);
  }
  function stepChute(dt) {
    ch.t += dt;
    if (ch.phase === 0 && ch.t > 2.5) { ch.phase = 1; ch.t = 0; ch.v.set(0, 2, 4); }
    else if (ch.phase === 1) { ch.p.addScaledVector(ch.v, dt); if (ch.t > 0.6) { ch.phase = 2; ch.t = 0; ch.v.set(0, 0, 2.5); } }
    else if (ch.phase === 2) {
      ch.v.y = Math.max(ch.v.y - 12 * dt, -22); ch.p.addScaledVector(ch.v, dt); pushOut(ch.p, 1.2);
      if (ch.t > 1.4) { ch.phase = 3; ch.t = 0; chCanopy.visible = true; }
    } else if (ch.phase === 3) {
      ch.open = Math.min(1, ch.open + dt / 0.7);
      let wx = 0, wz = 0; for (const g of gusts) if (g.on) { const d = Math.hypot(ch.p.x - g.c.x, ch.p.y - g.c.y, ch.p.z - g.c.z); if (d < GUST_R) { wx += g.dir.x * 6 * g.env * (1 - d / GUST_R); wz += g.dir.z * 6 * g.env * (1 - d / GUST_R); } }
      const k = Math.min(1, dt * 1.5);
      // a steady sideways drift plus a slow weave, so the path curves instead of dropping straight
      const weave = Math.sin(clock * 0.6 + ch.sway);
      ch.v.y += (-4.5 - ch.v.y) * Math.min(1, dt * 3); ch.v.x += (wx + ch.side * 2.2 + weave * 2.4 - ch.v.x) * k; ch.v.z += (1.5 + wz + Math.cos(clock * 0.45 + ch.sway) * 1.6 - ch.v.z) * k;
      ch.p.addScaledVector(ch.v, dt); pushOut(ch.p, 3.4); ch.p.x = clamp(ch.p.x, -BX, BX);
      if (ch.p.y <= GROUND + 0.1) { ch.p.y = GROUND + 0.1; ch.phase = 4; ch.t = 0; chCanopy.visible = false; }
    } else if (ch.phase === 4 && ch.t > 2) { ch.on = false; scene.remove(chute); }
  }

  // ── Gusts: a drifting volume of moving air, shown as streaks ─────────
  const GUST_R = 34, GUST_SPEED = 9, GUST_LIFE = 16, STREAKS = 260;
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
    g.c.set(-g.dir.x * (BX + 10) + rnd(-20, 20), rnd(-12, 22), -g.dir.z * (BZ + 10) + rnd(-20, 20));
    g.age = 0; g.on = true; g.lines.visible = true;
  }

  // ── Per-bird state: 0 flying, 1 landing, 2 perched ───────────────────
  let st = new Uint8Array(0), tgt = new Int16Array(0), leaveAt = new Float32Array(0), freeSlots = slots.length;
  let clock = 0, nextGust = 0, nextPass = 0, nextChute = 0, nextCloud = 0, rt = new Float32Array(0), tint = new Float32Array(0);
  function reset() {
    N = ctx.N; st = new Uint8Array(N); tgt = new Int16Array(N); leaveAt = new Float32Array(N);
    flapAttr = new THREE.InstancedBufferAttribute(new Float32Array(N).fill(1), 1);
    phaseAttr = new THREE.InstancedBufferAttribute(Float32Array.from({ length: N }, () => rnd(0, 6.283)), 1);
    for (const k in geoCache) { geoCache[k].geometry.dispose(); delete geoCache[k]; }
    for (const s of slots) s.taken = false; freeSlots = slots.length;
    rt = new Float32Array(N); tint = new Float32Array(N);
    api.st = st; setModel(api.model);
    ctx.birds.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3).fill(1), 3);
    nextGust = clock + rnd(10, 18); nextPass = clock + rnd(8, 16); nextChute = clock + rnd(25, 50); nextCloud = clock + rnd(4, 10);
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
    if (fl.on) {
      fl.p.addScaledVector(fl.dir, fl.cfg.speed * dt); fl.p.y = fl.y0 + Math.sin(clock * 0.9) * (fl.cfg.drop > 1 ? BOB : 0);
      if (Math.abs(fl.p.x * fl.dir.x + fl.p.z * fl.dir.z) > fl.end) endPass();
    }
    if (ch.on) stepChute(dt);
    for (let i = clouds.length - 1; i >= 0; i--) {
      const c = clouds[i]; c.p.addScaledVector(wind, c.speed * dt);
      if (Math.abs(c.p.x * wind.x + c.p.z * wind.z) > c.end) { scene.remove(c.mesh); clouds.splice(i, 1); }
    }
    for (const g of gusts) if (g.on) {
      g.age += dt; g.c.addScaledVector(g.dir, GUST_SPEED * dt);
      g.env = Math.sin(Math.PI * Math.min(1, g.age / GUST_LIFE));
      if (g.age > GUST_LIFE) { g.on = false; g.lines.visible = false; g.env = 0; }
    }
    if (!ctx.reduce) {   // ambient weather, off under reduced motion
      const slow = ctx.ambient && ctx.phone ? 2 : 1;   // phones get half the visitors
      if (clock > nextGust) { startGust(); nextGust = clock + rnd(30, 55) * slow; }
      if (clock > nextPass) { launchPass(); nextPass = clock + rnd(28, 55) * slow; }
      if (clock > nextCloud && clouds.length < (slow > 1 ? 2 : 5)) { spawnCloud(); nextCloud = clock + rnd(10, 22); }
      if (clock > nextChute) { startChute(); nextChute = clock + rnd(45, 90) * slow; }
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
  function force(i, px, py, pz, out) {
    let lvl = 0;   // how hard this bird is reacting to something big, 0 to 1, for the tint
    for (const b of boxes) {
      let dx = px - clamp(px, b.x0, b.x1), dy = py - clamp(py, b.y0, b.y1), dz = pz - clamp(pz, b.z0, b.z1), d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= PAD * PAD) continue;
      if (d2 < 1e-6) { dy = 1; d2 = 1; }
      const d = Math.sqrt(d2), k = MAX_FORCE * 2.2 * (1 - d / PAD) / d;
      out[0] += dx * k; out[1] += dy * k; out[2] += dz * k;
    }
    if (fl.on) {   // flee the line a visitor is on, well ahead of it
      const c = fl.cfg, rx = px - fl.p.x, ry = py - fl.p.y, rz = pz - fl.p.z, t = c.path ? clamp(rx * fl.dir.x + rz * fl.dir.z, -10, c.path) : 0;
      const ex = rx - fl.dir.x * t, ez = rz - fl.dir.z * t, d = Math.hypot(ex, ry, ez);
      if (d < c.R) { const u = 1 - d / c.R, k = MAX_FORCE * c.k * u ** 1.5 / (d || 1); out[0] += ex * k; out[1] += ry * k; out[2] += ez * k; lvl = Math.max(lvl, Math.min(1, u * c.k)); }
    }
    if (ch.on && ch.phase > 0) {   // a light berth for the parachutist
      const rx = px - ch.p.x, ry = py - ch.p.y - 3, rz = pz - ch.p.z, d = Math.hypot(rx, ry, rz);
      if (d < 14) { const u = 1 - d / 14, k = MAX_FORCE * 0.9 * u * u / (d || 1); out[0] += rx * k; out[1] += ry * k; out[2] += rz * k; lvl = Math.max(lvl, u); }
    }
    for (const c of clouds) {
      const R = CLOUD_R * c.sc, rx = px - c.p.x, ry = py - c.p.y, rz = pz - c.p.z, d = Math.hypot(rx, ry, rz);
      if (d < R) { const u = 1 - d / R, k = MAX_FORCE * CLOUD_K * u ** 1.5 / (d || 1); out[0] += rx * k; out[1] += ry * k; out[2] += rz * k; lvl = Math.max(lvl, u * CLOUD_K); }
    }
    for (const g of gusts) if (g.on) {
      const d = Math.hypot(px - g.c.x, py - g.c.y, pz - g.c.z);
      if (d < GUST_R) { const u = (1 - d / GUST_R) * g.env, w = u * 50; out[0] += g.dir.x * w; out[2] += g.dir.z * w; lvl = Math.max(lvl, u); }
    }
    rt[i] = lvl;
  }

  // ── The hawk: steered by pointer or arrows, or left to chase ─────────
  const H = { yaw: 0, pitch: 0, roll: 0, nx: 0, ny: 0, armed: false };   // armed: the pointer has moved since flying began
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
    const turn = (H.armed ? dead(H.nx) * -1 : 0) + (keys.l - keys.r), climb = (H.armed ? dead(H.ny) : 0) + (keys.u - keys.d);
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
    UBn.uTime.value = tick;
    if (fl.on) {
      fl.mesh.position.copy(fl.p);
      if (fl.kind === 'jetpack') { const f = fl.mesh.getObjectByName('flame'); f.scale.set(1, 0.8 + Math.random() * 0.6, 1); }
      if (fl.kind === 'glider') fl.mesh.rotation.z = Math.sin(clock * 0.7) * 0.12;
    }
    for (const c of clouds) c.mesh.position.copy(c.p);
    if (ch.on) {
      chute.position.copy(ch.p); chCanopy.scale.setScalar(Math.max(0.001, ch.open));
      chute.rotation.z = ch.phase === 3 ? Math.sin(clock * 1.3) * 0.08 : 0; chute.rotation.x = ch.phase === 2 ? 0.5 : 0;
    }
    const col = ctx.birds.instanceColor.array, k = Math.min(1, dt * 6), tr = textC.r, tg = textC.g, tb = textC.b;
    for (let i = 0; i < N; i++) {
      tint[i] += ((st[i] ? 0 : rt[i]) - tint[i]) * k; const t = tint[i];
      col[i * 3] = tr + (accC.r - tr) * t; col[i * 3 + 1] = tg + (accC.g - tg) * t; col[i * 3 + 2] = tb + (accC.b - tb) * t;
    }
    ctx.birds.instanceColor.needsUpdate = true;
    for (const g of gusts) if (g.on) {
      const pa = g.geo.attributes.position.array, len = 7 * g.env;
      g.mat.opacity = 0.6 * g.env;
      for (let i = 0; i < STREAKS; i++) {
        g.along[i] += 13 * dt; if (g.along[i] > GUST_R) g.along[i] -= 2 * GUST_R;
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

  const textC = new THREE.Color(), accC = new THREE.Color();
  function theme(col) {
    const text = col('--text'), bg = col('--bg'), accent = col('--accent');
    textC.copy(text); accC.copy(accent); birdMat.color.set(0xffffff);
    hawkMat.color.copy(accent); solidMat.color.copy(text); accentMat.color.copy(accent); flameMat.color.copy(accent); edgeMat.color.copy(text);
    cloudMat.color.copy(bg).lerp(text, 0.4);
    streakMat.color.copy(text); for (const g of gusts) g.mat.color.copy(text);
    groundMat.color.copy(bg).lerp(text, 0.07); bldMat.color.copy(bg).lerp(text, 0.16); beaconMat.color.copy(accent);
  }

  // ── Input ────────────────────────────────────────────────────────────
  const onMove = e => { H.armed = true; const r = canvas.getBoundingClientRect(); H.nx = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1); H.ny = clamp(-(((e.clientY - r.top) / r.height) * 2 - 1), -1, 1); };
  const onUp = e => { if (e.pointerType === 'touch') { H.nx = 0; H.ny = 0; } };
  const KEY = { ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd' };
  const onKey = v => e => { const k = KEY[e.code]; if (!k) return; keys[k] = v; if (api.flying) e.preventDefault(); };
  const kd = onKey(1), ku = onKey(0);

  const api = {
    st, model: 'bird', flying: false,
    spawn(k) { if (k === 'chute') startChute(); else if (k === 'cloud') spawnCloud(); else if (k === 'gust') startGust(); else { if (fl.on) endPass(); launchPass(k); } },   // for ?debug
    before, drive, force, hawk: hawkStep, draw, theme, reset, setModel,
    toggleFly() {
      api.flying = !api.flying; canvas.style.cursor = api.flying ? 'crosshair' : '';
      if (api.flying) { camReady = false; H.nx = 0; H.ny = 0; H.armed = false; } else ctx.orbit.idle = 0;
      camera.fov = api.flying ? 65 : 50; camera.updateProjectionMatrix();
      return api.flying;
    },
    enable() {
      scene.add(world, hawkMesh);
      addEventListener('pointermove', onMove); canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', onUp);
      addEventListener('keydown', kd); addEventListener('keyup', ku);
      api.flying = false; camReady = false; camera.fov = 50; camera.updateProjectionMatrix(); canvas.style.cursor = '';
      if (fl.on) endPass(); if (ch.on) { ch.on = false; scene.remove(chute); } clearClouds(); pickWind(); for (let i = 0; i < (ctx.ambient && ctx.phone ? 2 : 3); i++) spawnCloud(true); for (const g of gusts) { g.on = false; g.lines.visible = false; }
      hawk.p.set(BX * 0.5, 0, BZ * 0.5); H.yaw = -Math.PI * 0.75; H.pitch = 0; H.roll = 0; hawk.q.copy(hawk.p);
      reset();
    },
    disable() {
      scene.remove(world, hawkMesh); clearClouds(); if (fl.on) endPass(); if (ch.on) { ch.on = false; scene.remove(chute); }
      ctx.birds.instanceColor = null;
      removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp);
      removeEventListener('keydown', kd); removeEventListener('keyup', ku);
      canvas.style.cursor = ''; api.flying = false;
      hawk.p.set(BX, BY * 0.5, 0); hawk.v.set(-1, 0, 0); hawk.q.copy(hawk.p);
    }
  };
  return api;
}
