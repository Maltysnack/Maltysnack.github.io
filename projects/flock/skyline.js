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
  const SC = BX / 90;   // the skyline grows with the world
  const BLD = [
    { x: -62, z: -30, w: 14, d: 14, h: 34 }, { x: -40, z: -34, w: 12, d: 12, h: 52 }, { x: -20, z: -28, w: 16, d: 12, h: 28 },
    { x: 2, z: -36, w: 12, d: 14, h: 62 }, { x: 24, z: -30, w: 14, d: 12, h: 40 }, { x: 46, z: -34, w: 12, d: 12, h: 30 }
  ].map(b => ({ x: b.x * SC, z: b.z * SC, w: b.w * SC, d: b.d * SC, h: b.h * SC }));
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
    for (let x = bx.x0 + inset; x <= bx.x1 - inset + 1e-6; x += sp) { slots.push({ x, y: top, z: bx.z0 + inset, b: bx }); slots.push({ x, y: top, z: bx.z1 - inset, b: bx }); }
    for (let z = bx.z0 + inset + sp; z <= bx.z1 - inset - sp + 1e-6; z += sp) { slots.push({ x: bx.x0 + inset, y: top, z, b: bx }); slots.push({ x: bx.x1 - inset, y: top, z, b: bx }); }
  }
  for (const s of slots) { s.taken = false; }
  const tall = BLD.reduce((a, b) => b.h > a.h ? b : a);
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const MAST = 4.2;   // a thin antenna with a small ball on top that blinks
  const mast = new THREE.Mesh(new THREE.BoxGeometry(0.22, MAST, 0.22), bldMat), beacon = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), beaconMat);
  mast.position.set(tall.x, GROUND + tall.h + MAST / 2, tall.z); beacon.position.set(tall.x, GROUND + tall.h + MAST + 0.4, tall.z); world.add(mast, beacon);

  // ── Visitors ─────────────────────────────────────────────────────────
  // Every pass flies in a lane above the tallest roof (plus its own hang, bob
  // and clearance), so nothing can touch a building.
  const TOP = Math.max(...boxes.map(b => b.y1)), SAFE = TOP + 8, BOB = 1.2;
  const solidMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, side: THREE.DoubleSide });
  const accentMat = new THREE.MeshLambertMaterial({ color: 0xff0000, flatShading: true, side: THREE.DoubleSide });
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, transparent: true, opacity: 0.88 });
  const stormMat = new THREE.MeshLambertMaterial({ color: 0x444444, flatShading: true, transparent: true, opacity: 0.94, emissive: 0x000000 });
  const box = (w, h, d, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; };
  const ball = (r, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat); m.position.set(x, y, z); return m; };
  function figure(mat) {   // a stick person, feet at y = 0, about 2 tall
    const g = new THREE.Group();
    g.add(box(0.5, 0.9, 0.3, mat, 0, 1.15, 0), ball(0.28, mat, 0, 1.85), box(0.18, 0.8, 0.2, mat, -0.14, 0.4), box(0.18, 0.8, 0.2, mat, 0.14, 0.4),
      box(0.14, 0.7, 0.14, mat, -0.36, 1.2), box(0.14, 0.7, 0.14, mat, 0.36, 1.2));
    return g;
  }
  // Banner for the blimp: the site icon, with a cloth ripple in the vertex shader.
  const UBn = { uTime: { value: 0 }, uL: { value: 9 } };
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
      const ban = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.8, 14, 1).translate(4.5, 0, 0).rotateY(Math.PI / 2), bannerMat); ban.position.z = -10.5;
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
    cloud(mat = cloudMat) {
      const g = new THREE.Group();
      for (const [r, x, y, z] of [[7, 0, 0, 0], [5.5, 7, -1, 1], [5, -7, -1.4, -1], [4.5, 2.5, 3, 2], [4, -3, 2.5, -3], [3.6, 10, -2, -2]]) g.add(ball(r, mat, x, y * 0.7, z));
      return g;
    }
  };
  // path: how far ahead of itself a visitor is felt; k: how hard birds flee (cloud is gentle).
  const KINDS = {
    plane:   { weight: 30, speed: 20, R: 60, k: 2.5, path: 90, y: [30, 38], drop: 1, ext: 90 },
    blimp:   { weight: 22, speed: 11, R: 50, k: 2.0, path: 70, y: [34, 40], drop: 6.6, ext: 100 },
    glider:  { weight: 14, speed: 9,  R: 36, k: 1.6, path: 40, y: [31, 37], drop: 4.4, ext: 60 },
    jetpack: { weight: 12, speed: 14, R: 30, k: 1.6, path: 30, y: [30, 38], drop: 3.8, ext: 60 }
  };
  const fl = { on: false, kind: '', cfg: null, p: new THREE.Vector3(), dir: new THREE.Vector3(), y0: 0, end: 0, mesh: null };
  const meshes = {};
  function edgeFade(a, end, span) { const f = clamp((end - a) / span, 0, 1); return f * f * (3 - 2 * f); }
  function launchPass(kind) {
    if (fl.on) return;
    if (!kind) { let r = Math.random() * Object.values(KINDS).reduce((a, k) => a + k.weight, 0); for (const k in KINDS) { r -= KINDS[k].weight; if (r <= 0) { kind = k; break; } } }
    const cfg = KINDS[kind], sign = Math.random() < 0.5 ? -1 : 1, alongX = Math.random() < 0.5, ext = (alongX ? BX : BZ) + cfg.ext;
    meshes[kind] ??= MESH[kind](); fl.mesh = meshes[kind]; scene.add(fl.mesh);
    fl.kind = kind; fl.cfg = cfg; fl.dir.set(alongX ? sign : 0, 0, alongX ? 0 : sign);
    fl.y0 = Math.max(rnd(cfg.y[0], cfg.y[1]), SAFE + cfg.drop + BOB);   // clearance over the roofs, always
    fl.p.set(alongX ? -sign * ext : rnd(-BX * 0.6, BX * 0.6), fl.y0, alongX ? rnd(-BZ * 0.3, BZ * 0.8) : -sign * ext);
    fl.end = ext; fl.on = true; fl.base = kind === 'blimp' ? 1.35 : 1;
    fl.jumpers = kind === 'plane' && Math.random() < 0.55 ? (Math.random() < 0.4 ? 2 : 1) : 0; fl.jumpAt = 0;
    fl.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), fl.dir);
  }
  // Clouds are their own thing: several at once, each its own speed, height and size,
  // all drifting the same way, through the buildings if they like. Birds shy from them gently.
  const CLOUD_R = 26, CLOUD_K = 0.8, clouds = [];
  const wind = new THREE.Vector3();   // one direction for the whole map: clouds, canopies, banners and birds all feel it
  // Never blows toward the skyline's front (-z), so canopies are not pressed against the towers.
  function pickWind() { const r = Math.random(); if (r < 0.34) wind.set(1, 0, 0); else if (r < 0.67) wind.set(-1, 0, 0); else wind.set(0, 0, 1); }
  function spawnCloud(anywhere, storm, at) {
    const alongX = wind.x !== 0, ext = (alongX ? BX : BZ) + 45, sc = rnd(0.6, 1.4);
    storm ??= Math.random() < 0.2;
    const a = anywhere ? rnd(-ext, ext) : -(alongX ? wind.x : wind.z) * ext, l = alongX ? rnd(-BZ, BZ) : rnd(-BX, BX);
    const base = storm ? stormMat : cloudMat, mat = base.clone(), mesh = MESH.cloud(mat); mesh.scale.setScalar(sc); scene.add(mesh);
    clouds.push({ mesh, mat, base, sc, storm, speed: rnd(2.5, 6), end: ext, p: at ? at.clone() : new THREE.Vector3(alongX ? a : l, storm ? rnd(22, 40) : rnd(-5, 40), alongX ? l : a) });
  }
  function clearClouds() { for (const c of clouds) scene.remove(c.mesh); clouds.length = 0; }
  function endPass() { fl.on = false; scene.remove(fl.mesh); }

  // ── Parachutists: off the tallest roof, or out of a plane over open ground ─
  const tallBox = boxes.reduce((a, b) => b.y1 > a.y1 ? b : a);
  const chutes = [], chuteTpl = new THREE.Group();
  {
    const canopy = new THREE.Group(); canopy.name = 'canopy';
    const dome = new THREE.Mesh(new THREE.SphereGeometry(2.7, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), accentMat); dome.position.y = 4.2;
    const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([[1.8, 4.2, 0], [0, 2, 0.1], [-1.8, 4.2, 0], [0, 2, 0.1], [0, 4.2, 1.8], [0, 2, 0.1], [0, 4.2, -1.8], [0, 2, 0.1]].map(a => new THREE.Vector3(...a))), edgeMat);
    canopy.add(dome, lines); chuteTpl.add(figure(solidMat), canopy);
  }
  function addChute(p, v, phase, tower) {
    const g = chuteTpl.clone(true), canopy = g.getObjectByName('canopy'); canopy.visible = false; scene.add(g);
    chutes.push({ g, canopy, phase, tower, t: 0, open: 0, p: p.clone(), v: v.clone(), sway: rnd(0, 6.28) });
  }
  function startChute() {
    if (chutes.length >= 5) return;
    addChute(new THREE.Vector3((tallBox.x0 + tallBox.x1) / 2, tallBox.y1 + 0.05, tallBox.z1 - 0.9), new THREE.Vector3(), 0, true);   // standing at the open (front) edge
  }
  function jumpFromPlane() { addChute(vtmp.copy(fl.p).setY(fl.p.y - 1.5), fl.dir.clone().multiplyScalar(fl.cfg.speed), 2, false); }
  function clearChutes() { for (const c of chutes) scene.remove(c.g); chutes.length = 0; }
  const vtmp = new THREE.Vector3();
  function stepChute(c, dt) {   // true when finished
    c.t += dt;
    if (c.phase === 0 && c.t > 2.5) { c.phase = 1; c.t = 0; c.v.set(0, 2, 4); }
    else if (c.phase === 1) { c.p.addScaledVector(c.v, dt); if (c.t > 0.6) { c.phase = 2; c.t = 0; c.v.set(0, 0, 2.5); } }
    else if (c.phase === 2) {
      c.v.y = Math.max(c.v.y - 12 * dt, -22);
      if (!c.tower) { const d = Math.max(0, 1 - 1.6 * dt); c.v.x *= d; c.v.z *= d; }   // a jumper sheds the plane's speed
      c.p.addScaledVector(c.v, dt); pushOut(c.p, 1.2);
      if (c.t > 1.4) { c.phase = 3; c.t = 0; c.canopy.visible = true; }
    } else if (c.phase === 3) {
      c.open = Math.min(1, c.open + dt / 0.7);
      // drifts with the wind (harder in a gust) plus a slow weave across it; the tower jumper also edges away from the skyline
      const wv = 2.2 + gustAt(c.p.x, c.p.z) * 9, weave = Math.sin(clock * 0.6 + c.sway) * 2.2, k = Math.min(1, dt * 1.5);
      c.v.y += (-4.5 - c.v.y) * Math.min(1, dt * 3);
      c.v.x += (wind.x * wv + wind.z * weave - c.v.x) * k; c.v.z += (wind.z * wv - wind.x * weave + (c.tower ? 3 : 0) - c.v.z) * k;
      c.p.addScaledVector(c.v, dt); pushOut(c.p, 3.4); c.p.x = clamp(c.p.x, -BX, BX); c.p.z = clamp(c.p.z, -BZ, BZ);
      if (c.p.y <= GROUND + 0.1) { c.p.y = GROUND + 0.1; c.phase = 4; c.t = 0; c.canopy.visible = false; }
    } else if (c.phase === 4 && c.t > 2) return true;
    return false;
  }

  // ── Wind: a breeze over the whole map, and gusts that sweep across it as fronts ─
  const BREEZE = 3.5, GUST_FORCE = 34, FRONT_W = 75, FRONT_SPEED = 16, STREAKS = 440;
  const gust = { on: false, s: 0, end: 0, tilt: 0, ph: 0 };   // s: where the front is, measured along the wind
  let breeze = BREEZE;
  function gustAt(x, z) {   // 0 to 1: how hard a gust blows at this spot
    if (!gust.on) return 0;
    const along = x * wind.x + z * wind.z, lat = x * wind.z - z * wind.x;
    // The front is slanted and wavy, so it reaches different places at different moments, and it blows in patches
    // rather than as an even wall.
    const front = gust.s + lat * gust.tilt + Math.sin(lat * 0.05 + gust.ph) * 22 + Math.sin(lat * 0.13 + gust.ph * 1.7) * 9;
    const u = (along - front) / FRONT_W, patch = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(lat * 0.045 + gust.ph * 0.6));
    return Math.exp(-u * u) * patch * (0.85 + 0.15 * Math.sin(lat * 0.2 + clock * 1.1));
  }
  function startGust() {
    if (gust.on) return;
    const ext = (wind.x ? BX : BZ) + FRONT_W * 1.6 + 90;
    gust.tilt = rnd(0.2, 0.5) * (Math.random() < 0.5 ? -1 : 1); gust.ph = rnd(0, 6.28); gust.s = -ext; gust.end = ext; gust.on = true;
  }
  // Streaks fill the whole map and drift with the wind; they lengthen and brighten inside a gust.
  const sPos = new Float32Array(STREAKS * 6), sCol = new Float32Array(STREAKS * 6), sBase = new Float32Array(STREAKS * 3);
  for (let i = 0; i < STREAKS; i++) { sBase[i * 3] = rnd(-BX, BX); sBase[i * 3 + 1] = rnd(GROUND + 4, BY); sBase[i * 3 + 2] = rnd(-BZ, BZ); }
  const streakGeo = new THREE.BufferGeometry();
  streakGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3)); streakGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
  const streaks = new THREE.LineSegments(streakGeo, new THREE.LineBasicMaterial({ vertexColors: true })); streaks.frustumCulled = false; world.add(streaks);
  function moveStreaks(dt) {
    const bg3 = [bgC.r, bgC.g, bgC.b], tx3 = [textC.r, textC.g, textC.b];
    for (let i = 0; i < STREAKS; i++) {
      const i3 = i * 3, i6 = i * 6, I = gustAt(sBase[i3], sBase[i3 + 2]), sp = (6 + 30 * I) * dt, len = 2 + 9 * I;
      sBase[i3] += wind.x * sp; sBase[i3 + 2] += wind.z * sp;
      if (sBase[i3] > BX) sBase[i3] -= 2 * BX; else if (sBase[i3] < -BX) sBase[i3] += 2 * BX;
      if (sBase[i3 + 2] > BZ) sBase[i3 + 2] -= 2 * BZ; else if (sBase[i3 + 2] < -BZ) sBase[i3 + 2] += 2 * BZ;
      const x = sBase[i3], y = sBase[i3 + 1], z = sBase[i3 + 2], a = 0.18 + 0.82 * I;
      sPos[i6] = x; sPos[i6 + 1] = y; sPos[i6 + 2] = z; sPos[i6 + 3] = x - wind.x * len; sPos[i6 + 4] = y; sPos[i6 + 5] = z - wind.z * len;
      for (let c = 0; c < 3; c++) { const b = bg3[c], t = tx3[c]; sCol[i6 + c] = b + (t - b) * a; sCol[i6 + 3 + c] = b + (t - b) * a * 0.15; }
    }
    streakGeo.attributes.position.needsUpdate = true; streakGeo.attributes.color.needsUpdate = true;
  }

  // ── Lightning: storm clouds (the dark ones) now and then strike the ground or a roof ─
  const boltMat = new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true });
  const flashC = new THREE.Color(1, 0.93, 0.62), UP = new THREE.Vector3(0, 1, 0), segGeo = new THREE.BoxGeometry(0.36, 1, 0.36);
  const strike = { on: false, t: 0, c: new THREE.Vector3(), a: new THREE.Vector3(), b: new THREE.Vector3(), group: null, flash: 0 };
  let flashed = false;
  function topAt(x, z) { let y = GROUND; for (const b of boxes) if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) y = Math.max(y, b.y1); return y; }
  function bolt(a, b) {   // a jagged line of thin boxes, plus two short branches
    const g = new THREE.Group(), n = Math.max(8, Math.ceil(a.distanceTo(b) / 4)), pts = [];
    for (let k = 0; k <= n; k++) {
      const u = k / n, j = Math.sin(Math.PI * u) * 3.2;
      pts.push(new THREE.Vector3(a.x + (b.x - a.x) * u + (k && k < n ? rnd(-j, j) : 0), a.y + (b.y - a.y) * u, a.z + (b.z - a.z) * u + (k && k < n ? rnd(-j, j) : 0)));
    }
    const seg = (p, q) => { const m = new THREE.Mesh(segGeo, boltMat), d = vtmp.copy(q).sub(p), len = d.length(); m.position.copy(p).addScaledVector(d, 0.5); m.scale.y = len; m.quaternion.setFromUnitVectors(UP, d.divideScalar(len || 1)); g.add(m); };
    for (let k = 0; k < n; k++) seg(pts[k], pts[k + 1]);
    for (let br = 0; br < 2; br++) {
      let p = pts[1 + ((Math.random() * (n - 2)) | 0)].clone(); const sx = rnd(-1, 1) * 3.5, sz = rnd(-1, 1) * 3.5;
      for (let k = 0; k < 3; k++) { const q = p.clone().add(new THREE.Vector3(sx + rnd(-1, 1), -rnd(2.5, 4.5), sz + rnd(-1, 1))); seg(p, q); p = q; }
    }
    return g;
  }
  function startStrike(force) {
    if (strike.on) return true;
    let cands = clouds.filter(c => c.storm && Math.abs(c.p.x) < BX * 0.9 && Math.abs(c.p.z) < BZ * 0.9);
    if (!cands.length && force) { spawnCloud(true, true, new THREE.Vector3(rnd(-30, 30), 30, rnd(-10, 20))); cands = clouds.slice(-1); }
    if (!cands.length) return false;
    const c = cands[(Math.random() * cands.length) | 0];
    strike.a.set(c.p.x + rnd(-4, 4) * c.sc, c.p.y - 2 * c.sc, c.p.z + rnd(-4, 4) * c.sc);
    if (Math.hypot(c.p.x - (tallBox.x0 + tallBox.x1) / 2, c.p.z - (tallBox.z0 + tallBox.z1) / 2) < 50) strike.b.set((tallBox.x0 + tallBox.x1) / 2, tallBox.y1 + MAST + 0.9, (tallBox.z0 + tallBox.z1) / 2);   // the tall tower draws it
    else { const x = strike.a.x + rnd(-10, 10), z = strike.a.z + rnd(-10, 10); strike.b.set(x, topAt(x, z), z); }
    strike.c.copy(c.p);
    const pos = ctx.pos, vel = ctx.vel;   // an immediate kick away from the cloud, so the flock bolts rather than eases off
    for (let i = 0, n = ctx.N; i < n; i++) {
      if (st[i]) continue;
      const i3 = i * 3, dx = pos[i3] - c.p.x, dy = pos[i3 + 1] - c.p.y, dz = pos[i3 + 2] - c.p.z, d = Math.hypot(dx, dy, dz);
      if (d < 55) { const k = P.spd * 1.3 * (1 - d / 55) / (d || 1); vel[i3] += dx * k; vel[i3 + 1] += (dy - 6) * k; vel[i3 + 2] += dz * k; }
    }
    strike.group = bolt(strike.a, strike.b); scene.add(strike.group); strike.on = true; strike.t = 0;
    return true;
  }
  function stepStrike(dt) {
    if (!strike.on) return;
    strike.t += dt;
    boltMat.opacity = strike.t < 0.12 ? 1 : Math.max(0, 1 - (strike.t - 0.12) / 0.4);
    strike.flash = strike.t < 0.08 ? strike.t / 0.08 : Math.max(0, 1 - (strike.t - 0.08) / 0.5);   // one soft flash, no strobing
    if (strike.t > 0.9) { scene.remove(strike.group); strike.on = false; strike.flash = 0; }
  }
  function strikeDist(x, y, z) {   // distance to the bolt line while the birds are still shaken
    if (!strike.on || strike.t > 1.5) return 1e9;
    const a = strike.a, b = strike.b, abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
    const t = clamp(((x - a.x) * abx + (y - a.y) * aby + (z - a.z) * abz) / (abx * abx + aby * aby + abz * abz), 0, 1);
    return Math.hypot(x - (a.x + abx * t), y - (a.y + aby * t), z - (a.z + abz * t));
  }
  function clearStrike() { if (strike.on) scene.remove(strike.group); strike.on = false; strike.flash = 0; }

  // ── Per-bird state: 0 flying, 1 landing, 2 perched ───────────────────
  let st = new Uint8Array(0), tgt = new Int16Array(0), leaveAt = new Float32Array(0), freeSlots = slots.length;
  let clock = 0, nextGust = 0, nextPass = 0, nextChute = 0, nextCloud = 0, nextStrike = 0, rt = new Float32Array(0), tint = new Float32Array(0);
  function reset() {
    N = ctx.CAP; st = new Uint8Array(N);   // N here is capacity; the live count is ctx.N
     tgt = new Int16Array(N); leaveAt = new Float32Array(N);
    flapAttr = new THREE.InstancedBufferAttribute(new Float32Array(N).fill(1), 1);
    phaseAttr = new THREE.InstancedBufferAttribute(Float32Array.from({ length: N }, () => rnd(0, 6.283)), 1);
    for (const k in geoCache) { geoCache[k].geometry.dispose(); delete geoCache[k]; }
    for (const s of slots) s.taken = false; freeSlots = slots.length;
    rt = new Float32Array(N); tint = new Float32Array(N);
    api.st = st; setModel(api.model);
    ctx.birds.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3).fill(1), 3);
    hkReset(); nextGust = clock + rnd(10, 18); nextPass = clock + rnd(8, 16); nextChute = clock + rnd(25, 50); nextCloud = clock + rnd(4, 10); nextStrike = clock + rnd(15, 30);
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
    if (fl.on && fl.jumpers > 0 && clock > fl.jumpAt && fl.p.z > -4 && Math.abs(fl.p.x) < BX * 0.85 && Math.abs(fl.p.z) < BZ * 0.85 && chutes.length < 5) {
      jumpFromPlane(); fl.jumpers--; fl.jumpAt = clock + 1.5;   // only over open ground, well clear of the skyline
    }
    for (let i = chutes.length - 1; i >= 0; i--) if (stepChute(chutes[i], dt)) { scene.remove(chutes[i].g); chutes.splice(i, 1); }
    breeze = BREEZE * (0.8 + 0.2 * Math.sin(clock * 0.07));
    if (gust.on) { gust.s += FRONT_SPEED * dt; if (gust.s > gust.end) gust.on = false; }
    stepStrike(dt);
    for (let i = clouds.length - 1; i >= 0; i--) {
      const c = clouds[i]; c.p.addScaledVector(wind, c.speed * dt);
      if (Math.abs(c.p.x * wind.x + c.p.z * wind.z) > c.end) { scene.remove(c.mesh); clouds.splice(i, 1); }
    }
    if (!ctx.reduce) {   // ambient weather, off under reduced motion
      const slow = ctx.ambient && ctx.phone ? 2 : 1;   // phones get half the visitors
      if (clock > nextGust) { startGust(); nextGust = clock + rnd(30, 55) * slow; }
      if (clock > nextPass) { launchPass(); nextPass = clock + rnd(28, 55) * slow; }
      if (clock > nextCloud && clouds.length < (slow > 1 ? 2 : 5)) { spawnCloud(); nextCloud = clock + rnd(10, 22); }
      if (clock > nextStrike) { nextStrike = clock + (startStrike() ? rnd(25, 50) : 3); }
      if (clock > nextChute) { startChute(); nextChute = clock + rnd(45, 90) * slow; }
    }
    // Ambient perching: sample a few birds a step; any near a free roof edge may land.
    if (freeSlots === 0) return;
    const pos = ctx.pos;
    for (let s = 0; s < 8; s++) {
      const i = (Math.random() * ctx.N) | 0; if (st[i] || Math.random() > 0.3) continue;
      const i3 = i * 3, px = pos[i3], py = pos[i3 + 1], pz = pos[i3 + 2];
      let best = -1, bd = 24 * 24;
      for (let k = 0; k < slots.length; k++) {
        const sl = slots[k]; if (sl.taken || py < sl.y + 1.5 || (hk.mode > 0 && sl.b === hk.box)) continue;
        const d = (sl.x - px) ** 2 + (sl.y - py) ** 2 + (sl.z - pz) ** 2;
        if (d < bd) { bd = d; best = k; }
      }
      if (best >= 0) { slots[best].taken = true; freeSlots--; st[i] = 1; tgt[i] = best; }
    }
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
    } else if (st[i] === 2) {
      const h = (pos[i3] - hawk.p.x) ** 2 + (pos[i3 + 1] - hawk.p.y) ** 2 + (pos[i3 + 2] - hawk.p.z) ** 2;
      if (clock > leaveAt[i] || h < (hk.mode > 0 ? 9 * 9 : 30 * 30) || gustAt(pos[i3], pos[i3 + 2]) > 0.35 || strikeDist(pos[i3], pos[i3 + 1], pos[i3 + 2]) < 20) takeOff(i);
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
    for (const c of chutes) if (c.phase > 0) {   // a light berth for parachutists
      const rx = px - c.p.x, ry = py - c.p.y - 3, rz = pz - c.p.z, d = Math.hypot(rx, ry, rz);
      if (d < 14) { const u = 1 - d / 14, k = MAX_FORCE * 0.9 * u * u / (d || 1); out[0] += rx * k; out[1] += ry * k; out[2] += rz * k; lvl = Math.max(lvl, u); }
    }
    for (const c of clouds) {
      const R = CLOUD_R * c.sc, rx = px - c.p.x, ry = py - c.p.y, rz = pz - c.p.z, d = Math.hypot(rx, ry, rz);
      if (d < R) { const u = 1 - d / R, k = MAX_FORCE * CLOUD_K * u ** 1.5 / (d || 1); out[0] += rx * k; out[1] += ry * k; out[2] += rz * k; lvl = Math.max(lvl, u * CLOUD_K); }
    }
    out[0] += wind.x * breeze; out[2] += wind.z * breeze;   // the breeze moves everything, everywhere
    const I = gustAt(px, pz);
    if (I > 0.02) { const w = I * GUST_FORCE; out[0] += wind.x * w; out[2] += wind.z * w; out[1] += Math.sin(px * 0.15 + pz * 0.11 + clock * 2) * I * 10; lvl = Math.max(lvl, I); }
    if (strike.on && strike.t < 2.2) {   // and for a couple of seconds everything keeps moving away from the cloud
      const dx = px - strike.c.x, dy = py - strike.c.y, dz = pz - strike.c.z, d = Math.hypot(dx, dy, dz);
      if (d < 55) { const u = 1 - d / 55, k = MAX_FORCE * 3 * u * Math.max(0, 1 - strike.t / 2.2) / (d || 1); out[0] += dx * k; out[1] += (dy - 6) * k * 0.6; out[2] += dz * k; lvl = Math.max(lvl, u); }
    }
    const sd = strikeDist(px, py, pz);   // a strike scatters everything near the bolt
    if (sd < 24) {
      const u = 1 - sd / 24, k = MAX_FORCE * 3 * u * Math.max(0, 1 - strike.t / 1.5) / (sd || 1);
      out[0] += (px - strike.a.x) * k * 0.4; out[1] += 8 * u; out[2] += (pz - strike.a.z) * k * 0.4; lvl = Math.max(lvl, u);
    }
    rt[i] = lvl;
  }

  // ── The hawk: steered by pointer or arrows, or left to chase ─────────
  const H = { yaw: 0, pitch: 0, roll: 0, nx: 0, ny: 0, armed: false };   // armed: the pointer has moved since flying began
  const keys = { l: 0, r: 0, u: 0, d: 0, s: 0, sPrev: 0 };   // s: space, perch or take off
  const dead = v => Math.abs(v) < 0.08 ? 0 : (v - Math.sign(v) * 0.08) / 0.92;
  function pushOut(p, pad, skip) {
    for (const b of boxes) {
      if (b === skip) continue;
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
  // The hawk can perch on a free roof edge: the AI one now and then, the player's on Space near a roof.
  // mode 0 flying, 1 gliding in, 2 perched. Perched, it is calm: birds keep clear but do not bolt.
  const hk = { mode: 0, slot: -1, box: null, pt: new THREE.Vector3(), until: 0, next: 0 };
  function hkBegin(k) {
    const sl = slots[k]; sl.taken = true; freeSlots--; hk.mode = 1; hk.slot = k; hk.box = sl.b; hk.pt.set(sl.x, sl.y + 1.5, sl.z);
    for (let i = 0, n = ctx.N; i < n; i++) {   // everyone on that roof clears off, staggered over about a second
      if (st[i] === 1 && slots[tgt[i]].b === hk.box) takeOff(i);
      else if (st[i] === 2 && slots[tgt[i]].b === hk.box) leaveAt[i] = Math.min(leaveAt[i], clock + rnd(0.1, 1));
    }
  }
  function hkReset() { hk.mode = 0; hk.slot = -1; UH.uAmp.value = 0.3; hk.next = clock + rnd(25, 45); }
  function hkEnd() {   // take off facing the way it was looking
    if (hk.slot >= 0) { slots[hk.slot].taken = false; freeSlots++; }
    hkReset(); H.pitch = 0.5; const c = Math.cos(H.pitch);
    hawk.v.set(Math.sin(H.yaw) * c, Math.sin(H.pitch), Math.cos(H.yaw) * c).multiplyScalar(P.spd * 1.2);
  }
  function tryPerch(maxD) {   // the nearest free edge that is below the hawk, so it always lands from above
    let best = -1, bd = maxD * maxD;
    for (let k = 0; k < slots.length; k++) {
      const sl = slots[k]; if (sl.taken || hawk.p.y < sl.y + 1.5) continue;
      const d = (sl.x - hawk.p.x) ** 2 + (sl.y - hawk.p.y) ** 2 + (sl.z - hawk.p.z) ** 2;
      if (d < bd) { bd = d; best = k; }
    }
    if (best >= 0) hkBegin(best);
  }
  function hawkStep(dt) {
    const space = keys.s && !keys.sPrev; keys.sPrev = keys.s;
    const steerKey = keys.l || keys.r || keys.u || keys.d;
    if (hk.mode === 2) {
      hawk.p.copy(hk.pt); hawk.v.set(0, 0, 0);
      if (api.flying ? (steerKey || space) : clock > hk.until) hkEnd();
    } else if (hk.mode === 1) {
      const dx = hk.pt.x - hawk.p.x, dy = hk.pt.y - hawk.p.y, dz = hk.pt.z - hawk.p.z, d = Math.hypot(dx, dy, dz), want = Math.min(P.spd * 1.2, d * 1.5 + 2) / (d || 1), k = Math.min(1, dt * 3);
      hawk.v.x += (dx * want - hawk.v.x) * k; hawk.v.y += (dy * want - hawk.v.y) * k; hawk.v.z += (dz * want - hawk.v.z) * k;
      hawk.p.addScaledVector(hawk.v, dt); pushOut(hawk.p, 1.5, slots[hk.slot].b);
      const m = hawk.v.length();
      if (m > 1) { H.yaw = Math.atan2(hawk.v.x, hawk.v.z); H.pitch = Math.asin(clamp(hawk.v.y / m, -1, 1)); }
      if (d < 0.7) { hk.mode = 2; hk.until = clock + rnd(6, 12); UH.uAmp.value = 0; H.pitch = 0; H.roll = 0; }   // wings fold
      else if (api.flying && (steerKey || space)) hkEnd();
    } else {
      if (api.flying) { if (space) tryPerch(16); }
      else if (clock > hk.next && !ctx.reduce) tryPerch(45);
      if (hk.mode === 0) {
        if (api.flying) steerHawk(dt);
        else {
          const prevYaw = H.yaw;
          ctx.aiHawk(dt);
          const v = hawk.v, m = v.length() || 1;
          H.yaw = Math.atan2(v.x, v.z); H.pitch = Math.asin(clamp(v.y / m, -1, 1));
          H.roll += (clamp(Math.atan2(Math.sin(H.yaw - prevYaw), Math.cos(H.yaw - prevYaw)) / dt * 0.45, -0.9, 0.9) - H.roll) * Math.min(1, dt * 6);
        }
        pushOut(hawk.p, 2.5);
      }
    }
    hawk.p.x = clamp(hawk.p.x, -BX - 30, BX + 30); hawk.p.z = clamp(hawk.p.z, -BZ - 30, BZ + 30); hawk.p.y = clamp(hawk.p.y, GROUND + 2, BY + 8);
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
      fl.mesh.position.copy(fl.p); fl.mesh.scale.setScalar(fl.base * Math.max(0.001, edgeFade(Math.abs(fl.p.x * fl.dir.x + fl.p.z * fl.dir.z), fl.end, fl.cfg.ext)));   // shrinks away across the outer margin
      if (fl.kind === 'jetpack') { const f = fl.mesh.getObjectByName('flame'); f.scale.set(1, 0.8 + Math.random() * 0.6, 1); }
      if (fl.kind === 'glider') fl.mesh.rotation.z = Math.sin(clock * 0.7) * 0.12;
    }
    for (const c of clouds) {
      c.mesh.position.copy(c.p); c.mat.color.copy(c.base.color); c.mat.emissive.copy(c.base.emissive);
      c.mat.opacity = c.base.opacity * edgeFade(Math.abs(c.p.x * wind.x + c.p.z * wind.z), c.end, 45);   // fades in and out across the outer margin
    }
    for (const c of chutes) {
      c.g.position.copy(c.p); c.canopy.scale.setScalar(Math.max(0.001, c.open));
      c.g.rotation.z = c.phase === 3 ? Math.sin(clock * 1.3 + c.sway) * 0.08 : 0; c.g.rotation.x = c.phase === 2 ? 0.5 : 0;
    }
    beaconMat.color.copy((tick % 1.8) < 0.35 ? beaconC : beaconOff);   // a slow aircraft-style blink
    if (!ctx.reduce) moveStreaks(dt);
    const f = strike.on ? strike.flash * 0.2 : 0;   // the whole sky takes a brief, soft flash
    if (f > 0 || flashed) { scene.background.copy(bgC).lerp(flashC, f); if (scene.fog) scene.fog.color.copy(scene.background); flashed = f > 0; }
    stormMat.emissive.setRGB(1, 0.85, 0.3).multiplyScalar(strike.on ? strike.flash * 0.45 : 0);
    const col = ctx.birds.instanceColor.array, k = Math.min(1, dt * 6), tr = textC.r, tg = textC.g, tb = textC.b;
    for (let i = 0, n = ctx.N; i < n; i++) {
      tint[i] += ((st[i] ? 0 : rt[i]) - tint[i]) * k; const t = tint[i];
      col[i * 3] = tr + (accC.r - tr) * t; col[i * 3 + 1] = tg + (accC.g - tg) * t; col[i * 3 + 2] = tb + (accC.b - tb) * t;
    }
    ctx.birds.instanceColor.needsUpdate = true;
  }

  const textC = new THREE.Color(), accC = new THREE.Color(), bgC = new THREE.Color(), beaconC = new THREE.Color(), beaconOff = new THREE.Color();
  function theme(col) {
    const text = col('--text'), bg = col('--bg'), accent = col('--accent');
    textC.copy(text); accC.copy(accent); bgC.copy(bg); beaconC.copy(accent); birdMat.color.set(0xffffff);
    hawkMat.color.copy(accent); solidMat.color.copy(text); accentMat.color.copy(accent); flameMat.color.copy(accent); edgeMat.color.copy(text);
    cloudMat.color.copy(bg).lerp(text, 0.4);
    stormMat.color.setRGB(cloudMat.color.r * 0.42, cloudMat.color.g * 0.46, cloudMat.color.b * 0.55);
    groundMat.color.copy(bg).lerp(text, 0.07); bldMat.color.copy(bg).lerp(text, 0.16); beaconOff.copy(beaconC).lerp(bg, 0.8); }

  // ── Input ────────────────────────────────────────────────────────────
  const onMove = e => { H.armed = true; const r = canvas.getBoundingClientRect(); H.nx = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1); H.ny = clamp(-(((e.clientY - r.top) / r.height) * 2 - 1), -1, 1); };
  const onUp = e => { if (e.pointerType === 'touch') { H.nx = 0; H.ny = 0; } };
  const KEY = { ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd', Space: 's' };
  const onKey = v => e => { const k = KEY[e.code]; if (!k) return; keys[k] = v; if (api.flying) e.preventDefault(); };   // (arrows and space only)
  const kd = onKey(1), ku = onKey(0);

  const api = {
    st, model: 'bird', flying: false,
    // state 3 = held: pinned in place by the Hello. intro until freed
    recruit(i) { if (st[i] === 1 || st[i] === 2) { slots[tgt[i]].taken = false; freeSlots++; } st[i] = 3; flapAttr.array[i] = 1; flapAttr.needsUpdate = true; },
    free(i) { st[i] = 0; },
    blocked(x, y, z) { for (const b of boxes) if (x > b.x0 - 3 && x < b.x1 + 3 && y > b.y0 - 3 && y < b.y1 + 3 && z > b.z0 - 3 && z < b.z1 + 3) return true; return false; },   // inside or hugging a building
    get hawkCalm() { return hk.mode > 0; },
    spawn(k) {
      if (k === 'perch') { if (hk.mode) hkEnd(); else { const free = slots.filter(x => !x.taken), sl = free[(Math.random() * free.length) | 0]; if (sl) { hawk.p.set(sl.x + 5, sl.y + 9, sl.z + 9); hawk.q.copy(hawk.p); hkBegin(slots.indexOf(sl)); } } return; }
      if (k === 'chute') startChute(); else if (k === 'cloud') spawnCloud(true, false); else if (k === 'storm') spawnCloud(true, true); else if (k === 'strike') startStrike(true); else if (k === 'gust') startGust();
      else { if (fl.on) endPass(); launchPass(k); if (k === 'plane') fl.jumpers = 2; }
    },   // for ?debug
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
      if (fl.on) endPass(); clearChutes(); clearStrike(); gust.on = false; streaks.visible = !ctx.reduce; clearClouds(); pickWind(); for (let i = 0; i < (ctx.ambient && ctx.phone ? 2 : 3); i++) spawnCloud(true);
      hkReset(); hawk.p.set(BX * 0.5, 0, BZ * 0.5); H.yaw = -Math.PI * 0.75; H.pitch = 0; H.roll = 0; hawk.q.copy(hawk.p);
      reset();
    },
    disable() {
      scene.remove(world, hawkMesh); clearClouds(); clearChutes(); clearStrike(); if (fl.on) endPass();
      ctx.birds.instanceColor = null;
      removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp);
      removeEventListener('keydown', kd); removeEventListener('keyup', ku);
      canvas.style.cursor = ''; api.flying = false;
      if (hk.slot >= 0) { slots[hk.slot].taken = false; freeSlots++; } hkReset();
      hawk.p.set(BX, BY * 0.5, 0); hawk.v.set(-1, 0, 0); hawk.q.copy(hawk.p);
    }
  };
  return api;
}
