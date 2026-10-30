// Skyline: the extended map. Same three rules, plus flapping birds, a hawk you
// can take over, a skyline to perch on, gusts of wind, and visitors passing
// through (plane, blimp, hang glider, jetpack, cloud, a parachutist).
// flock.js owns the simulation and calls these hooks while the mode is on.
import * as THREE from './vendor/three.module.min.js';
import { createExtras } from './extras.js?v=10';

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
  const birdMat = flapMaterial(UB), hawkMat = flapMaterial(UH); hawkMat.transparent = true;
  const hawkMesh = new THREE.Mesh(build('gull', false), hawkMat);
  hawkMesh.scale.setScalar(2.6); hawkMesh.frustumCulled = false;

  // ── World: ground, a small skyline, and perch slots along the roof edges ─
  const world = new THREE.Group();
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), groundMat);
  ground.position.y = GROUND - 0.2; world.add(ground);
  // The city: a fixed, seeded skyline, so it looks the same every visit. A hero tower (the one with the
  // antenna and the jumper) stands in front; rows of towers run behind it and wings curve forward at the sides,
  // leaving the middle open for the flock. Taller toward the centre.
  const rand = (() => { let a = 1987; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
  const rr = (lo, hi) => lo + rand() * (hi - lo);
  const BLD = [{ x: 3, z: -47, w: 16, d: 16, h: 102 }];
  const fits = (x, z, w, d) => BLD.every(o => Math.abs(x - o.x) > (w + o.w) / 2 + 2.5 || Math.abs(z - o.z) > (d + o.d) / 2 + 2.5);
  const lot = (x, z, w, d, h, wing) => { if (fits(x, z, w, d)) BLD.push({ x, z, w, d, h: Math.min(95, h * (1 - 0.3 * Math.abs(x) / 150)) }); };
  for (const [zc, dr, hr, x0, x1, gap] of [[-36, [9, 14], [20, 58], 105, 105, [4, 9]], [-58, [12, 18], [40, 80], 125, 125, [3, 8]], [-82, [14, 20], [60, 95], 140, 140, [2, 6]]]) {
    for (let x = -x0; x < x1;) { const w = rr(10, 18), d = rr(dr[0], dr[1]); lot(x + w / 2, (rr(-3, 3), zc), w, d, rr(hr[0], hr[1])); x += w + rr(gap[0], gap[1]); }
  }
  for (const side of [-1, 1]) for (let k = 0; k < 3; k++) {   // wings curving forward at the sides, stopping well short of the open ground
    for (let z = -22; z > -62;) { const w = rr(10, 16), d = rr(10, 15); lot(side * (114 + k * 17), z - d / 2, w, d, rr(18, 56), true); z -= d + rr(3, 7); }
  }
  const AVE = [-72, -32, 48, 90];   // north-south avenues: any tower standing in one is dropped (the hero never is)
  for (let i = BLD.length - 1; i > 0; i--) if (AVE.some(ax => Math.abs(BLD[i].x - ax) < BLD[i].w / 2 + 2.2)) BLD.splice(i, 1);
  for (const side of [-1, 1]) for (const [zc, dr, hr] of [[-38, [10, 16], [10, 38]], [-62, [12, 18], [8, 26]]]) {   // the city runs on along the rail line, both ways, thinning out
    for (let x = 156; x < 352;) { const w = rr(10, 18), d = rr(dr[0], dr[1]), xc = side * (x + w / 2), h = rr(hr[0], hr[1]) * (1 - 0.55 * (x - 156) / 200); if (fits(xc, zc, w, d)) BLD.push({ x: xc, z: zc, w, d, h }); x += w + rr(3, 9); }
  }
  for (const [x, z, w, d, h] of [[-176, -40, 15, 15, 96], [168, -42, 16, 16, 112], [-128, -96, 15, 15, 88], [132, -98, 16, 16, 104], [-224, -38, 14, 14, 72], [222, -40, 15, 15, 80]]) if (fits(x, z, w, d)) BLD.push({ x, z, w, d, h });   // taller towers out at the edges so the skyline is not so even
  const bldMat = new THREE.MeshLambertMaterial({ color: 0x888888, flatShading: true });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 });
  const boxes = [], slots = [];
  const bldMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), bldMat, BLD.length), bm = new THREE.Matrix4(), bq = new THREE.Quaternion(), edgeSrc = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)).getAttribute('position');
  const edgePos = new Float32Array(BLD.length * edgeSrc.count * 3);
  BLD.forEach((b, n) => {   // one instanced draw for every building, one merged line set for every outline
    bldMesh.setMatrixAt(n, bm.compose(new THREE.Vector3(b.x, GROUND + b.h / 2, b.z), bq, new THREE.Vector3(b.w, b.h, b.d)));
    for (let v = 0; v < edgeSrc.count; v++) {
      const o = (n * edgeSrc.count + v) * 3;
      edgePos[o] = b.x + edgeSrc.getX(v) * b.w; edgePos[o + 1] = GROUND + b.h / 2 + edgeSrc.getY(v) * b.h; edgePos[o + 2] = b.z + edgeSrc.getZ(v) * b.d;
    }
    const bx = { x0: b.x - b.w / 2, x1: b.x + b.w / 2, z0: b.z - b.d / 2, z1: b.z + b.d / 2, y0: GROUND, y1: GROUND + b.h };
    boxes.push(bx);
    // Birds sit along the roof edge, a little in from the lip (at most about a dozen a roof).
    const inset = 0.9, sp = 2.2, top = bx.y1 + 0.5, mine = [];
    for (let x = bx.x0 + inset; x <= bx.x1 - inset + 1e-6; x += sp) { mine.push({ x, y: top, z: bx.z0 + inset, b: bx }); mine.push({ x, y: top, z: bx.z1 - inset, b: bx }); }
    for (let z = bx.z0 + inset + sp; z <= bx.z1 - inset - sp + 1e-6; z += sp) { mine.push({ x: bx.x0 + inset, y: top, z, b: bx }); mine.push({ x: bx.x1 - inset, y: top, z, b: bx }); }
    const keep = Math.max(1, Math.ceil(mine.length / 12));
    mine.forEach((sl, k) => { if (k % keep === 0) slots.push(sl); });
  });
  bldMesh.instanceMatrix.needsUpdate = true; bldMesh.frustumCulled = false; world.add(bldMesh);
  const edgeGeo = new THREE.BufferGeometry(); edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgePos, 3));
  const edges = new THREE.LineSegments(edgeGeo, edgeMat); edges.frustumCulled = false; world.add(edges);
  for (const s of slots) { s.taken = false; }
  const tall = BLD[0];
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const MAST = 4.2;   // a thin antenna with a small ball on top that blinks
  const mast = new THREE.Mesh(new THREE.BoxGeometry(0.22, MAST, 0.22), bldMat), beacon = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), beaconMat);
  mast.position.set(tall.x, GROUND + tall.h + MAST / 2, tall.z); beacon.position.set(tall.x, GROUND + tall.h + MAST + 0.4, tall.z); world.add(mast, beacon);

  // ── Visitors ─────────────────────────────────────────────────────────
  // Every pass flies in a lane above the tallest roof (plus its own hang, bob
  // and clearance), so nothing can touch a building.
  const BOB = 1.2;
  // The highest roof under a pass, so its lane always clears what it flies over (+8, plus its own hang and bob).
  function roofMax(alongX, lat, half) { let y = GROUND; for (const b of boxes) { const lo = alongX ? b.z0 : b.x0, hi = alongX ? b.z1 : b.x1; if (hi >= lat - half && lo <= lat + half && b.y1 > y) y = b.y1; }
    for (const p of PEAKS) { const c = alongX ? p.z : p.x; if (c + p.r >= lat - half && c - p.r <= lat + half) y = Math.max(y, GROUND + p.h); }   // a mountain counts as its full height
    return y; }
  const solidMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, side: THREE.DoubleSide });
  const accentMat = new THREE.MeshLambertMaterial({ color: 0xff0000, flatShading: true, side: THREE.DoubleSide });
  const milMat = new THREE.MeshLambertMaterial({ color: 0x555555, flatShading: true });
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
  const UBn = { uTime: { value: 0 }, uL: { value: 6 } };
  const bannerCanvas = document.createElement('canvas'); bannerCanvas.width = 256; bannerCanvas.height = 256;
  const bctx = bannerCanvas.getContext('2d'); bctx.fillStyle = '#ffffff'; bctx.fillRect(0, 0, 256, 256);
  const bannerTex = new THREE.CanvasTexture(bannerCanvas); bannerTex.colorSpace = THREE.SRGBColorSpace;
  const icon = new Image();
  icon.onload = () => {
    bctx.drawImage(icon, 0, 0, 256, 256);
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
      const ban = new THREE.Mesh(new THREE.PlaneGeometry(6, 5, 12, 1).translate(3, 0, 0).rotateY(Math.PI / 2), bannerMat); ban.position.z = -10.5;
      g.add(hull, box(1.4, 1.1, 3, solidMat, 0, -3.6, 0.5), box(0.3, 4.4, 2.6, solidMat, 0, 0, -8), box(4.4, 0.3, 2.6, solidMat, 0, 0, -8), ban);
      return g;
    },
    tanker() { const g = MESH.plane(); g.add(box(1.8, 1.1, 7, milMat, 0, -1.4, 0)); return g; },   // a plane with a belly tank
    military() {   // a high-wing transport: dark, four engines, a T-tail
      const g = new THREE.Group();
      for (const [w, h, d, x, y, z] of [[2.6, 2.6, 16, 0, 0, 0], [26, 0.4, 3.6, 0, 1.5, 0.8], [7, 0.3, 2.4, 0, 3.8, -7.4], [0.4, 4.4, 2.8, 0, 2, -7.2], [2.4, 1.8, 3.4, 0, -0.4, -8.6],
        [0.9, 0.9, 2.4, -5, 0.7, 1.6], [0.9, 0.9, 2.4, 5, 0.7, 1.6], [0.9, 0.9, 2.4, -9.5, 0.7, 1.6], [0.9, 0.9, 2.4, 9.5, 0.7, 1.6]]) g.add(box(w, h, d, milMat, x, y, z));
      g.add(box(1.8, 0.8, 1.6, accentMat, 0, 1.5, 7.2));
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
      for (const [r, x, y, z] of [[7, 0, 0, 0], [5.5, 7, -1, 1], [5, -7, -1.4, -1], [4.5, 2.5, 3, 2]]) g.add(ball(r, mat, x, y * 0.7, z));
      return g;
    }
  };
  // path: how far ahead of itself a visitor is felt; k: how hard birds flee (cloud is gentle).
  const KINDS = {
    plane:   { weight: 30, speed: 20, R: 90, k: 2.5, path: 130, y: [42, 50], drop: 1, ext: 90 },
    blimp:   { weight: 22, speed: 10, R: 150, k: 2.0, path: 180, y: [60, 66], drop: 18.2, ext: 180 },
    tanker: { weight: 0, speed: 24, R: 90, k: 2.5, path: 130, y: [34, 40], drop: 1, ext: 110 },
    military: { weight: 3, speed: 22, R: 100, k: 2.5, path: 130, y: [44, 52], drop: 1, ext: 110 },
    glider:  { weight: 14, speed: 9,  R: 56, k: 1.6, path: 60, y: [42, 48], drop: 4.4, ext: 60 },
    jetpack: { weight: 12, speed: 14, R: 48, k: 1.6, path: 45, y: [40, 48], drop: 3.8, ext: 60 }
  };
  const fl = { on: false, kind: '', cfg: null, p: new THREE.Vector3(), dir: new THREE.Vector3(), y0: 0, end: 0, mesh: null };
  const meshes = {};
  function edgeFade(a, end, span) { const f = clamp((end - a) / span, 0, 1); return f * f * (3 - 2 * f); }
  function fadeable(root) {   // own transparent copies of the materials, so a visitor can fade without fading everything sharing them
    const list = [], seen = new Map();
    root.traverse(o => {
      if (!o.isMesh) return;
      const m = o.material;
      if (m === bannerMat) { if (!seen.has(m)) { m.transparent = true; seen.set(m, 1); list.push({ m, src: null }); } return; }
      if (!seen.has(m)) { const c = m.clone(); c.transparent = true; seen.set(m, c); list.push({ m: c, src: m }); }
      o.material = seen.get(m);
    });
    root.userData.fade = list; return root;
  }
  function surfMax(x, z, r) {   // the highest thing within r of a point: roofs and slopes
    let y = Math.max(terrainY(x, z), terrainY(x + r, z), terrainY(x - r, z), terrainY(x, z + r), terrainY(x, z - r));
    for (const b of boxes) if (b.y1 > y && b.x0 - r < x && b.x1 + r > x && b.z0 - r < z && b.z1 + r > z) y = b.y1;
    return y;
  }
  const yAxis = new THREE.Vector3(0, 1, 0), zAxis = new THREE.Vector3(0, 0, 1), rollQ = new THREE.Quaternion();
  function launchPass(kind, at) {
    if (fl.on) return;
    const auto = !kind;
    if (!kind) { let r = Math.random() * Object.values(KINDS).reduce((a, k) => a + k.weight, 0); for (const k in KINDS) { r -= KINDS[k].weight; if (r <= 0) { kind = k; break; } } }
    if (auto && kind === 'plane' && Math.random() < 0.35 && EX.requestLanding()) return;   // some visiting planes land at the airport instead of flying past
    const cfg = KINDS[kind], sign = Math.random() < 0.5 ? -1 : 1, ang = (Math.random() < 0.5 ? 0 : Math.PI / 2) + (sign < 0 ? Math.PI : 0) + rnd(-0.6, 0.6);   // any heading, roughly along an axis
    meshes[kind] ??= fadeable(MESH[kind]()); fl.mesh = meshes[kind]; scene.add(fl.mesh);
    fl.kind = kind; fl.cfg = cfg; fl.dir.set(Math.cos(ang), 0, Math.sin(ang));
    const ext = BX * Math.abs(fl.dir.x) + BZ * Math.abs(fl.dir.z) + cfg.ext, T = at ? new THREE.Vector3(at.x, 0, at.z) : new THREE.Vector3(rnd(-BX * 0.6, BX * 0.6), 0, rnd(-BZ * 0.3, BZ * 0.8));   // the line passes through T
    fl.p.copy(T).addScaledVector(fl.dir, -ext - T.dot(fl.dir));
    let lane = rnd(cfg.y[0], cfg.y[1]);
    for (let k = 0; k <= 30; k++) lane = Math.max(lane, surfMax(fl.p.x + fl.dir.x * 2 * ext * k / 30, fl.p.z + fl.dir.z * 2 * ext * k / 30, 16) + 8 + cfg.drop + BOB);   // clear of everything under the whole pass
    fl.y0 = lane; fl.p.y = lane;
    fl.end = ext; fl.on = true; fl.base = kind === 'blimp' ? 3.8 : kind === 'military' ? 1.2 : 1;
    fl.jumpers = kind === 'military' ? 14 : 0; fl.jumpAt = 0; fl.dropped = false;   // only the rare transport drops people, and then a whole stream
    fl.mesh.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(fl.dir.x, fl.dir.z));   // a plain turn about the vertical, so nothing can roll over
  }
  // Clouds are their own thing: several at once, each its own speed, height and size,
  // all drifting the same way, through the buildings if they like. Birds shy from them gently.
  const CLOUD_R = 38, CLOUD_K = 0.8, clouds = [];
  const wind = new THREE.Vector3(1, 0, 0);   // unit vector the wind blows toward: clouds, canopies and birds all feel it
  // It blows for a spell while slowly turning, dies down to almost nothing, then comes back from somewhere else.
  // Never toward the skyline's front (-z), so canopies are not pressed against the towers.
  const W = { a: 0, turn: 0, t: 0, goal: 1, lull: false, changed: false };
  let windStr = 1;
  const pickAngle = () => { for (;;) { const a = rnd(0, 6.283); if (Math.sin(a) > -0.35) return a; } };
  function initWind() { W.a = pickAngle(); W.turn = rnd(-0.02, 0.02); W.t = rnd(70, 160); W.goal = 1; W.lull = false; windStr = 1; wind.set(Math.cos(W.a), 0, Math.sin(W.a)); }
  function stepWind(dt) {
    W.t -= dt;
    if (W.t <= 0) {
      if (!W.lull) { W.lull = true; W.goal = 0.03; W.t = rnd(15, 28); }
      else { W.lull = false; W.goal = rnd(0.6, 1); W.t = rnd(70, 160); W.turn = rnd(-0.02, 0.02); }
    }
    if (W.lull) { if (windStr < 0.08 && !W.changed) { W.a = pickAngle(); W.changed = true; } }
    else {
      W.changed = false; W.a += W.turn * dt;
      if (Math.sin(W.a) < -0.4) { const d = Math.atan2(Math.sin(1.571 - W.a), Math.cos(1.571 - W.a)); W.a += Math.sign(d) * 0.06 * dt; }
    }
    windStr += (W.goal - windStr) * Math.min(1, dt * 0.12);
    wind.set(Math.cos(W.a), 0, Math.sin(W.a));
  }
  const CX = BX + 40, CZ = BZ + 40;
  function spawnCloud(anywhere, storm, at) {
    storm ??= Math.random() < 0.15;
    const sc = storm ? 1 + 2.6 * Math.pow(Math.random(), 1.2) : 0.4 + 3.1 * Math.pow(Math.random(), 1.7), sp = new THREE.Vector3();   // many small, a few huge; storms are big
    
    storm ??= Math.random() < 0.2;
    if (at) sp.copy(at);
    else {
      sp.set(rnd(-BX, BX), 0, rnd(-BZ, BZ));
      if (!anywhere) {   // enters from upwind: march back against the wind to the edge
        const tx = wind.x > 1e-4 ? (sp.x + CX) / wind.x : wind.x < -1e-4 ? (CX - sp.x) / -wind.x : 1e9, tz = wind.z > 1e-4 ? (sp.z + CZ) / wind.z : wind.z < -1e-4 ? (CZ - sp.z) / -wind.z : 1e9, t = Math.min(tx, tz);
        sp.x -= wind.x * t; sp.z -= wind.z * t;
      }
      sp.y = storm ? rnd(18, 62) : rnd(-10, 70);
    }
    const base = storm ? stormMat : cloudMat, mat = base.clone(), mesh = MESH.cloud(mat); mesh.scale.setScalar(sc); scene.add(mesh);
    clouds.push({ mesh, mat, base, sc, storm, k: rnd(0.7, 1.15), dr: new THREE.Vector2(rnd(-0.5, 0.5), rnd(-0.5, 0.5)), y0: sp.y, age: 0, life: rnd(260, 460), p: sp });
  }
  function cloudFade(c) {   // fades in at the edge, out at the edge, and out in old age
    const m = clamp(Math.min(CX - Math.abs(c.p.x), CZ - Math.abs(c.p.z)) / 45, 0, 1), a = clamp(1 - (c.age - c.life) / 20, 0, 1);
    return m * m * (3 - 2 * m) * a;
  }
  function stormCell() {   // a storm is a vast front: a broad band of big dark clouds that arrives together
    const sp = new THREE.Vector3(rnd(-BX, BX), 0, rnd(-BZ, BZ)), tx = wind.x > 1e-4 ? (sp.x + CX) / wind.x : wind.x < -1e-4 ? (CX - sp.x) / -wind.x : 1e9, tz = wind.z > 1e-4 ? (sp.z + CZ) / wind.z : wind.z < -1e-4 ? (CZ - sp.z) / -wind.z : 1e9, t = Math.min(tx, tz);
    sp.x -= wind.x * t; sp.z -= wind.z * t;
    const n = 8 + ((Math.random() * 7) | 0);
    for (let k = 0; k < n && clouds.length < 70; k++) { const at = sp.clone(); at.x += -wind.z * rnd(-220, 220) - wind.x * rnd(0, 170); at.z += wind.x * rnd(-220, 220) - wind.z * rnd(0, 170); at.y = rnd(18, 62); spawnCloud(false, true, at); }
  }
  function clearClouds() { for (const c of clouds) scene.remove(c.mesh); clouds.length = 0; }
  function endPass() { fl.on = false; scene.remove(fl.mesh); }

  // ── Parachutists: off the tallest roof or mountain top, or out of a plane over open ground ─
  const tallBox = boxes.reduce((a, b) => b.y1 > a.y1 ? b : a);
  const chutes = [], chuteTpl = new THREE.Group();
  {
    const canopy = new THREE.Group(); canopy.name = 'canopy';
    const dome = new THREE.Mesh(new THREE.SphereGeometry(2.7, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), accentMat); dome.position.y = 4.2;
    const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([[1.8, 4.2, 0], [0, 2, 0.1], [-1.8, 4.2, 0], [0, 2, 0.1], [0, 4.2, 1.8], [0, 2, 0.1], [0, 4.2, -1.8], [0, 2, 0.1]].map(a => new THREE.Vector3(...a))), edgeMat);
    canopy.add(dome, lines); chuteTpl.add(figure(solidMat), canopy);
  }
  function addChute(p, v, phase, jump) {   // jump: which way a standing jumper leaps, null for a plane jumper
    const g = chuteTpl.clone(true), canopy = g.getObjectByName('canopy'); canopy.visible = false; scene.add(g);
    chutes.push({ g, canopy, phase, jump, t: 0, open: 0, p: p.clone(), v: v.clone(), sway: rnd(0, 6.28) });
  }
  function startChute() {
    if (chutes.length >= 5) return;
    if (Math.random() < 0.5) {   // off the top of the tallest mountain, out toward the open ground
      const a = rnd(-0.9, 0.9), sp = PEAKS[0];
      addChute(new THREE.Vector3(sp.x, GROUND + sp.h - 0.4, sp.z), new THREE.Vector3(), 0, { x: Math.sin(a), z: -Math.cos(a), m: 7, s: 4.5, b: 3.5 });
    } else addChute(new THREE.Vector3((tallBox.x0 + tallBox.x1) / 2, tallBox.y1 + 0.05, tallBox.z1 - 0.9), new THREE.Vector3(), 0, { x: 0, z: 1, m: 4, s: 2.5, b: 3 });   // standing at the open (front) edge
  }
  function jumpFromPlane() { addChute(vtmp.copy(fl.p).setY(fl.p.y - 1.5), fl.dir.clone().multiplyScalar(fl.cfg.speed), 2, false); }
  function clearChutes() { for (const c of chutes) scene.remove(c.g); chutes.length = 0; }
  const vtmp = new THREE.Vector3();
  function stepChute(c, dt) {   // true when finished
    c.t += dt;
    if (c.phase === 0 && c.t > 2.5) { c.phase = 1; c.t = 0; c.v.set(c.jump.x * c.jump.m, 2, c.jump.z * c.jump.m); }
    else if (c.phase === 1) { c.p.addScaledVector(c.v, dt); if (c.t > 0.6) { c.phase = 2; c.t = 0; c.v.set(c.jump.x * c.jump.s, 0, c.jump.z * c.jump.s); } }
    else if (c.phase === 2) {
      c.v.y = Math.max(c.v.y - 12 * dt, -22);
      if (!c.jump) { const d = Math.max(0, 1 - 1.6 * dt); c.v.x *= d; c.v.z *= d; }   // a jumper sheds the plane's speed
      c.p.addScaledVector(c.v, dt); pushOut(c.p, 1.2, undefined, false); lift(c.p, 0.8);
      if (c.t > 1.4) { c.phase = 3; c.t = 0; c.canopy.visible = true; ctx.sound?.event('chute', c.p); }
    } else if (c.phase === 3) {
      c.open = Math.min(1, c.open + dt / 0.7);
      // drifts with the wind (harder in a gust) plus a slow weave across it; the tower jumper also edges away from the skyline
      const wv = 2.2 * windStr + gustAt(c.p.x, c.p.z) * 9, weave = Math.sin(clock * 0.6 + c.sway) * 2.2, k = Math.min(1, dt * 1.5);
      c.v.y += (-4.5 - c.v.y) * Math.min(1, dt * 3);
      c.v.x += (wind.x * wv + wind.z * weave + (c.jump ? c.jump.x * c.jump.b : 0) - c.v.x) * k; c.v.z += (wind.z * wv - wind.x * weave + (c.jump ? c.jump.z * c.jump.b : 0) - c.v.z) * k;
      c.p.addScaledVector(c.v, dt); twPush(c.p, dt, 1); pushOut(c.p, 3.4, undefined, false); lift(c.p, 0.8); c.p.x = clamp(c.p.x, -BX, BX); c.p.z = clamp(c.p.z, -BZ, BZ);
      const bt = boxTop(c.p.x, c.p.z);
      if (bt > GROUND + 0.5 && c.p.y <= bt + 3.5) { c.p.y = bt + 0.1; c.phase = 4; c.t = 0; c.canopy.visible = false; return false; }   // settled onto a roof
      const gy = terrainY(c.p.x, c.p.z) + (c.p.y > GROUND + 40 || terrainY(c.p.x, c.p.z) <= GROUND + 0.01 ? 0.1 : 0.9);
      if (c.p.y <= gy) { c.p.y = gy; c.phase = 4; c.t = 0; c.canopy.visible = false; }
    } else if (c.phase === 4 && c.t > 2) return true;
    return false;
  }

  // ── Mountains: a range on the open side, opposite the city, with a valley between the two biggest ─
  const PEAKS = [   // west of the valley (0 to 12, a long range), then east of it (13 to 20)
    { x: -68, z: 58, r: 40, h: 84 }, { x: -112, z: 50, r: 30, h: 48 }, { x: -150, z: 44, r: 24, h: 34 }, { x: -96, z: 94, r: 34, h: 66 }, { x: -170, z: 88, r: 28, h: 44 },
    { x: -208, z: 66, r: 34, h: 72 }, { x: -262, z: 62, r: 34, h: 80 }, { x: -340, z: 70, r: 34, h: 86 }, { x: -388, z: 60, r: 32, h: 70 }, { x: -438, z: 72, r: 32, h: 60 }, { x: -490, z: 62, r: 30, h: 48 },
    { x: -240, z: 22, r: 30, h: 44 }, { x: -350, z: 24, r: 30, h: 52 },
    { x: 38, z: 66, r: 34, h: 62 }, { x: 84, z: 66, r: 28, h: 42 }, { x: 126, z: 58, r: 24, h: 34 }, { x: 170, z: 58, r: 22, h: 30 },
    { x: 68, z: 98, r: 32, h: 58 }, { x: 118, z: 94, r: 28, h: 46 }, { x: 166, z: 88, r: 26, h: 40 }, { x: 206, z: 60, r: 20, h: 26 },
    { x: -400, z: 330, r: 42, h: 74 }, { x: -300, z: 385, r: 46, h: 92 }, { x: -200, z: 425, r: 42, h: 80 }, { x: -90, z: 440, r: 46, h: 96 }, { x: 30, z: 458, r: 44, h: 84 }, { x: 150, z: 430, r: 46, h: 92 },
    { x: 265, z: 415, r: 42, h: 78 }, { x: 370, z: 385, r: 42, h: 70 }, { x: 440, z: 320, r: 36, h: 60 }, { x: 330, z: 150, r: 28, h: 40 }, { x: -330, z: 160, r: 28, h: 42 }   // mountains reaching into the forest
  ];
  const PK = { tall: 0, cliffs: [5, 6, 7, 8, 9, 10], crackA: 6, crackB: 7, cable: 13, camp: 14 };
  const smooth = a => { a = a < 0 ? 0 : a > 1 ? 1 : a; return a * a * (3 - 2 * a); };
  function hillH(x, z) {   // smooth rolling hills behind the city that ease down to the sea; flat everywhere else, and along the highway
    if (z > -108) return 0;
    let w = smooth((-z - 112) / 60) * (1 - smooth((-z - 262) / 58)) * (1 - smooth((Math.abs(x) - 430) / 70)) * smooth((Math.abs(x - 48) - 10) / 22);
    { const fx = Math.abs(x - 290) - 180, fz = Math.abs(z + 250) - 40, m = Math.max(fx, fz); if (m < 40) w *= smooth(m / 40); }   // a flat pad for the airport
    if (w <= 0) return 0;
    return w * (12 * (1 + Math.sin(x * 0.011 + 1) * Math.sin(z * 0.013)) + 3.5 * (1 + Math.sin(x * 0.027 + z * 0.019)) + 2 * Math.sin(x * 0.05 - z * 0.04) + 4);
  }
  function terrainY(x, z) { let y = 0; for (const p of PEAKS) { const d = Math.hypot(x - p.x, z - p.z); if (d < p.r) y = Math.max(y, p.h * (1 - d / p.r)); } return GROUND + Math.max(y, hillH(x, z)); }
  function lift(p, pad) { const g = terrainY(p.x, p.z); if (g > GROUND + 0.01 && p.y < g + pad) p.y = g + pad; }   // keeps a point off a mountain's slope
  const rockC = new THREE.Color(), snowC = new THREE.Color(), WATER = new THREE.Color(0x4f7ca4), mtnMeshes = [];
  const mtnMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  function paint(g, h, snowAt) {   // rock below, snow above, blended over a band
    const pos = g.getAttribute('position'), col = g.getAttribute('color');
    for (let v = 0; v < pos.count; v++) {
      const m = clamp((pos.getY(v) / h - snowAt) / 0.2, 0, 1);
      col.setXYZ(v, rockC.r + (snowC.r - rockC.r) * m, rockC.g + (snowC.g - rockC.g) * m, rockC.b + (snowC.b - rockC.b) * m);
    }
    col.needsUpdate = true;
  }
  PEAKS.forEach((p, n) => {
    const g = new THREE.ConeGeometry(p.r, p.h, 9, 5).translate(0, p.h / 2, 0), pos = g.getAttribute('position');
    for (let v = 0; v < pos.count; v++) {   // roughen inward only (so the analytic cone always covers the mesh); the same at a seam
      const y = pos.getY(v); if (y < 0.01 || y > p.h - 0.01) continue;
      const a = Math.atan2(pos.getZ(v), pos.getX(v)), f = 1 - 0.16 * (0.5 + 0.5 * Math.sin(3 * a + y * 0.17 + n * 2)) * (0.5 + 0.5 * Math.sin(5 * a - y * 0.11 + n));
      pos.setX(v, pos.getX(v) * f); pos.setZ(v, pos.getZ(v) * f);
    }
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
    const m = new THREE.Mesh(g, mtnMat); m.position.set(p.x, GROUND, p.z); m.userData.h = p.h; m.userData.snow = p.hill ? 9 : 0.55; m.frustumCulled = false; world.add(m); mtnMeshes.push(m);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(g, 28), edgeMat); e.position.copy(m.position); e.frustumCulled = false; world.add(e);
    if (p.hill) return;
    const roof = {};   // stands in for a roof: one perch group per summit
    const ring = (rho, cnt) => { for (let k = 0; k < cnt; k++) { const a = k / cnt * 6.283 + n; slots.push({ x: p.x + Math.cos(a) * rho, y: GROUND + p.h * (1 - rho / p.r) + 0.5, z: p.z + Math.sin(a) * rho, b: roof, taken: false }); } };
    ring(2.2, n ? 4 : 6); if (!n) ring(5, 8);
  });
  // ── The river: from a forest far behind the mountains, down the valley between the two big peaks, across the open ground and off the map ─
  const RIVER = [[-10, 520], [-14, 470], [-12, 420], [-12, 380], [-12, 340], [-16, 280], [-8, 220], [-14, 160], [-10, 118], [-13, 84], [-11, 56], [-6, 38], [8, 24], [30, 18], [58, 14], [86, 20], [114, 12], [150, 16], [190, 10], [260, 8], [340, 6], [420, 5], [520, 4]];
  const CL = [];
  for (let i = 0; i < RIVER.length - 1; i++) {   // Catmull-Rom, a sample about every 2
    const p0 = RIVER[Math.max(0, i - 1)], p1 = RIVER[i], p2 = RIVER[i + 1], p3 = RIVER[Math.min(RIVER.length - 1, i + 2)], n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 2));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t, f = j => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3);
      CL.push({ x: f(0), z: f(1) });
    }
  }
  CL.push({ x: RIVER[RIVER.length - 1][0], z: RIVER[RIVER.length - 1][1] });
  CL.forEach((c, i) => {
    const a = CL[Math.max(0, i - 1)], b = CL[Math.min(CL.length - 1, i + 1)], l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    c.tx = (b.x - a.x) / l; c.tz = (b.z - a.z) / l; c.s = i ? CL[i - 1].s + Math.hypot(c.x - CL[i - 1].x, c.z - CL[i - 1].z) : 0; c.hw = 9 + 5 * Math.min(1, c.s / 600);
  });
  const waterMat = new THREE.MeshLambertMaterial({ color: 0x335577, flatShading: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  {
    const wp = new Float32Array(CL.length * 6), bank = new Float32Array((CL.length - 1) * 12), idx = [], Y = GROUND + 0.3;
    CL.forEach((c, i) => {
      wp.set([c.x - c.tz * c.hw, Y, c.z + c.tx * c.hw, c.x + c.tz * c.hw, Y, c.z - c.tx * c.hw], i * 6);
      if (i) { idx.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i - 1, 2 * i + 1, 2 * i); bank.set([wp[i * 6 - 6], Y, wp[i * 6 - 4], wp[i * 6], Y, wp[i * 6 + 2], wp[i * 6 - 3], Y, wp[i * 6 - 1], wp[i * 6 + 3], Y, wp[i * 6 + 5]], (i - 1) * 12); }
    });
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.BufferAttribute(wp, 3)); wg.setIndex(idx); wg.computeVertexNormals(); { const nn = wg.getAttribute('normal'); for (let i = 0; i < nn.count; i++) nn.setXYZ(i, 0, 1, 0); }
    const water = new THREE.Mesh(wg, waterMat); water.frustumCulled = false; world.add(water);
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(bank, 3));
    const banks = new THREE.LineSegments(bg, edgeMat); banks.frustumCulled = false; world.add(banks);
  }
  let LO = 0, HI = CL.length - 1, BS0 = 0, BS1 = CL.length - 1;   // LO..HI: inside the flock's box (fish); BS0..BS1: a little beyond it (the boat)
  while (LO < CL.length - 1 && CL[LO].z > BZ - 8) LO++;
  while (HI > 0 && CL[HI].x > BX - 8) HI--;
  while (BS0 < CL.length - 1 && CL[BS0].z > BZ + 35) BS0++;
  while (BS1 > 0 && CL[BS1].x > BX + 35) BS1--;
  function nearestCL(x, z, hint) {   // closest sample near a hint index
    let best = hint, bd = 1e9;
    for (let i = Math.max(LO, hint - 8), e = Math.min(HI, hint + 8); i <= e; i++) { const d = (CL[i].x - x) ** 2 + (CL[i].z - z) ** 2; if (d < bd) { bd = d; best = i; } }
    return best;
  }
  // ── A lake in the forest with a camp on its shore (tents, a fire, a few people) that comes and goes, and a hill with a firewatch tower ─
  const treeMat = new THREE.MeshLambertMaterial({ color: 0x666666, flatShading: true }), treeC = new THREE.Color();
  const LAKE = { x: 96, z: 190, rx: 46, rz: 34 }, CAMP = { x: 158, z: 190 }, TOWERS = [{ x: -95, z: 340 }, { x: 190, z: 360 }, { x: -280, z: 250 }, { x: 330, z: 230 }];
  {
    const N = 28, g = new THREE.CircleGeometry(1, N).rotateX(-Math.PI / 2), pos = g.getAttribute('position'), rim = new Float32Array(N * 3);
    const wob = a => 1 + 0.12 * Math.sin(3 * a + 1) + 0.06 * Math.sin(5 * a);
    for (let v = 0; v < pos.count; v++) { const x = pos.getX(v), z = pos.getZ(v), r = wob(Math.atan2(z, x)); pos.setXYZ(v, LAKE.x + x * r * LAKE.rx, GROUND + 0.3, LAKE.z + z * r * LAKE.rz); }
    g.computeVertexNormals(); const lm = new THREE.Mesh(g, waterMat); lm.frustumCulled = false; world.add(lm);
    for (let k = 0; k < N; k++) { const a = k / N * 6.2832, r = wob(a); rim.set([LAKE.x + Math.cos(a) * r * LAKE.rx, GROUND + 0.33, LAKE.z + Math.sin(a) * r * LAKE.rz], k * 3); }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rim, 3)); const rl = new THREE.LineLoop(rg, edgeMat); rl.frustumCulled = false; world.add(rl);
  }
  const camp = { f: 0, on: false, t: rnd(40, 100), g: null, flame: null };
  {
    const g = new THREE.Group(); g.position.set(CAMP.x, GROUND, CAMP.z);
    for (const [x, z, a] of [[-5, -4, 0.3], [4, -5, -0.4], [-1, 6, 0.1]]) { const t = new THREE.Mesh(new THREE.ConeGeometry(2.4, 2.8, 4).rotateY(Math.PI / 4), solidMat); t.position.set(x, 1.4, z); t.rotation.y = a; g.add(t); }
    for (let k = 0; k < 7; k++) { const a = k / 7 * 6.283; g.add(box(0.4, 0.3, 0.4, solidMat, Math.cos(a) * 1.1, 0.15, Math.sin(a) * 1.1)); }
    const flame = new THREE.Group(), f1 = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.6, 5), accentMat), f2 = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1, 5), accentMat);
    f1.position.y = 0.9; f2.position.set(0.2, 0.7, 0.1); flame.add(f1, f2); g.add(flame);
    for (const [x, z, r] of [[2.4, 1.2, 2.2], [-2.3, 1.6, -2], [0.4, -2.6, 0.2]]) { const f = figure(solidMat); f.scale.setScalar(0.75); f.position.set(x, 0, z); f.rotation.y = r; g.add(f); }
    g.visible = false; world.add(g); camp.g = fadeable(g); camp.flame = flame;
  }
  // smoke puffs: a small pool of points that rise, drift with the wind and recycle
  function makeSmoke(n, opt = {}) {
    const pos = new Float32Array(n * 3).fill(-999), age = new Float32Array(n), mat = new THREE.PointsMaterial({ color: opt.color ?? 0xaaaaaa, size: opt.size ?? 2.2, transparent: true, opacity: opt.opacity ?? 0.5, depthWrite: false });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; world.add(pts); return { pos, age, mat, geo, n, rise: opt.rise ?? 3, life: opt.life ?? 6, base: opt.opacity ?? 0.5 };
  }
  function stepSmoke(sm, dt, x, y, z, level) {
    for (let i = 0; i < sm.n; i++) {
      if (level < 0.3) { sm.pos[i * 3 + 1] = -999; continue; }
      sm.age[i] += dt;
      if (sm.pos[i * 3 + 1] < -900 || sm.age[i] > sm.life) { sm.age[i] = Math.random() * (sm.life - 1); sm.pos[i * 3] = x + rnd(-0.3, 0.3); sm.pos[i * 3 + 1] = y + sm.age[i] * sm.rise; sm.pos[i * 3 + 2] = z + rnd(-0.3, 0.3); }
      sm.pos[i * 3] += (wind.x * windStr * 2 + Math.sin(sm.age[i] * 2 + i) * 0.4) * dt; sm.pos[i * 3 + 1] += sm.rise * dt; sm.pos[i * 3 + 2] += (wind.z * windStr * 2 + Math.cos(sm.age[i] * 2 + i) * 0.4) * dt;
    }
    sm.geo.attributes.position.needsUpdate = true; sm.mat.opacity = sm.base * Math.min(1, level);
  }
  const campSmoke = makeSmoke(30), hutSmoke = makeSmoke(22), hut = { f: 0, on: false, t: rnd(10, 40) };
  // an island in the lake with a little hut that smokes now and then
  const ISL = { x: 84, z: 196 };
  {
    const isl = new THREE.Mesh(new THREE.CylinderGeometry(6, 8, 1.4, 9), bldMat); isl.position.set(ISL.x, GROUND + 0.3, ISL.z); world.add(isl);
    const top = GROUND + 1;
    world.add(box(4.2, 2.6, 4.2, solidMat, ISL.x, top + 1.3, ISL.z), box(0.8, 2.2, 0.8, solidMat, ISL.x + 1.2, top + 3.4, ISL.z + 0.6));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 1.7, 4).rotateY(Math.PI / 4), solidMat); roof.position.set(ISL.x, top + 3.4, ISL.z); world.add(roof);
    for (const [dx, dz, s] of [[-4, 2, 1], [3.5, -3, 0.8], [-2.5, -3.5, 0.9]]) { const t = new THREE.Mesh(new THREE.ConeGeometry(1.4 * s, 6 * s, 5).translate(0, 3 * s, 0), treeMat); t.position.set(ISL.x + dx, top, ISL.z + dz); world.add(t); }
    const bx = { x0: ISL.x - 2.4, x1: ISL.x + 2.4, z0: ISL.z - 2.4, z1: ISL.z + 2.4, y0: GROUND, y1: top + 4.3 };
    boxes.push(bx); slots.push({ x: bx.x0 + 0.9, y: bx.y1 + 0.5, z: bx.z0 + 0.9, b: bx, taken: false });
  }
  function stepCamp(dt) {
    camp.t -= dt; if (camp.t <= 0) { camp.on = !camp.on; camp.t = camp.on ? rnd(150, 260) : rnd(120, 260); }
    camp.f += ((camp.on ? 1 : 0) - camp.f) * Math.min(1, dt * 0.6);
    camp.g.visible = camp.f > 0.02;
    stepSmoke(campSmoke, dt, CAMP.x, GROUND + 1.8, CAMP.z, camp.f);
    hut.t -= dt; if (hut.t <= 0) { hut.on = !hut.on; hut.t = hut.on ? rnd(40, 80) : rnd(60, 140); }
    hut.f += ((hut.on ? 1 : 0) - hut.f) * Math.min(1, dt * 0.5);
    stepSmoke(hutSmoke, dt, ISL.x + 1.2, GROUND + 1 + 4.6, ISL.z + 0.6, hut.f);
  }
  const towerLamps = [];
  for (const TWR of TOWERS) {   // firewatch towers on flat ground, deep in the forest
    const top = GROUND, sq = [[-1, -1], [1, -1], [1, 1], [-1, 1]], br = [];
    for (const [sx, sz] of sq) world.add(box(0.4, 20, 0.4, solidMat, TWR.x + sx * 2.2, top + 10, TWR.z + sz * 2.2));
    for (let k = 0; k < 4; k++) {   // cross braces on each face, three bays
      const [ax, az] = sq[k], [bx, bz] = sq[(k + 1) % 4];
      for (const [y0, y1] of [[0.3, 6.8], [6.8, 13.5], [13.5, 19.8]]) br.push(TWR.x + ax * 2.2, top + y0, TWR.z + az * 2.2, TWR.x + bx * 2.2, top + y1, TWR.z + bz * 2.2, TWR.x + bx * 2.2, top + y0, TWR.z + bz * 2.2, TWR.x + ax * 2.2, top + y1, TWR.z + az * 2.2);
    }
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(br), 3)); const bl = new THREE.LineSegments(bg, edgeMat); bl.frustumCulled = false; world.add(bl);
    world.add(box(6, 0.2, 6, solidMat, TWR.x, top + 20, TWR.z), box(4.8, 2.8, 4.8, solidMat, TWR.x, top + 21.5, TWR.z));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.9, 2, 4).rotateY(Math.PI / 4), solidMat); roof.position.set(TWR.x, top + 24.4, TWR.z); world.add(roof);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4a3d })); lamp.position.set(TWR.x, top + 26.6, TWR.z); lamp.visible = false; world.add(lamp); towerLamps.push(lamp);
    boxes.push({ x0: TWR.x - 3, x1: TWR.x + 3, z0: TWR.z - 3, z1: TWR.z + 3, y0: GROUND, y1: top + 25.5 });   // birds keep clear of it
  }
  // ── Fish: a few schools of boids on the water, each wandering the whole river on its own errand, held to the channel. ─
  const NF = 64, SCH = 9, fx = new Float32Array(NF), fz = new Float32Array(NF), fvx = new Float32Array(NF), fvz = new Float32Array(NF), fi = new Int16Array(NF), fs = new Float32Array(NF), fph = new Float32Array(NF);
  const fobj = Array.from({ length: NF }, () => ({ air: null, dead: 0 }));   // air: thrown by the tornado; dead: waiting to reappear in the river
  const schools = Array.from({ length: SCH }, () => ({ tgt: 0, t: 0, lat: 0, mean: 0 }));
  const retarget = sc => { sc.tgt = LO + 8 + Math.floor(Math.random() * (HI - LO - 16)); sc.lat = rnd(-0.55, 0.55); sc.t = rnd(15, 40); };
  schools.forEach(retarget);
  for (let i = 0; i < NF; i++) {
    const sch = i % SCH, ci = clamp(LO + 8 + Math.floor((HI - LO - 16) * (sch + 0.5) / SCH) + ((Math.random() * 12) | 0) - 6, LO, HI), c = CL[ci];
    fx[i] = c.x + rnd(-2, 2); fz[i] = c.z + rnd(-2, 2); const a = rnd(0, 6.28); fvx[i] = Math.cos(a) * 3; fvz[i] = Math.sin(a) * 3; fi[i] = ci; fs[i] = rnd(0.8, 1.3); fph[i] = rnd(0, 6.28);
  }
  function stepFish(dt) {
    for (const sc of schools) { sc.t -= dt; sc.mean = 0; }
    for (let i = 0; i < NF; i++) schools[i % SCH].mean += fi[i] / (NF / SCH);
    for (const sc of schools) if (sc.t <= 0 || Math.abs(sc.mean - sc.tgt) < 6) retarget(sc);
    for (let i = 0; i < NF; i++) {
      const sc = schools[i % SCH], fo = fobj[i];
      if (fo.air) { if (!airStep(fo, dt)) { fo.air = null; fo.dead = rnd(10, 70); } continue; }
      if (fo.dead > 0) {
        fo.dead -= dt;
        if (fo.dead <= 0) { const ci = LO + 8 + Math.floor(Math.random() * (HI - LO - 16)), c = CL[ci]; fx[i] = c.x + rnd(-2, 2); fz[i] = c.z + rnd(-2, 2); fi[i] = ci; const a = rnd(0, 6.28); fvx[i] = Math.cos(a) * 3; fvz[i] = Math.sin(a) * 3; }
        continue;
      }
      let ax = 0, az = 0, cx = 0, cz = 0, sx = 0, sz = 0, n = 0;
      for (let j = 0; j < NF; j++) {
        if (j === i || fobj[j].air || fobj[j].dead > 0) continue;
        const dx = fx[j] - fx[i], dz = fz[j] - fz[i], d2 = dx * dx + dz * dz;
        if (d2 > 100) continue;
        n++; ax += fvx[j]; az += fvz[j]; cx += dx; cz += dz;
        if (d2 < 4) { sx -= dx / (d2 + 0.1); sz -= dz / (d2 + 0.1); }
      }
      let gx = (Math.random() - 0.5) * 3, gz = (Math.random() - 0.5) * 3;
      if (n) { gx += (ax / n - fvx[i]) * 1.2 + cx / n * 0.5 + sx * 4; gz += (az / n - fvz[i]) * 1.2 + cz / n * 0.5 + sz * 4; }
      let ci = fi[i] = nearestCL(fx[i], fz[i], fi[i]), c = CL[ci], o = (fx[i] - c.x) * -c.tz + (fz[i] - c.z) * c.tx;
      const go = Math.sign(sc.tgt - ci) * 4, k = (sc.lat * c.hw - o) * 1.4;   // along the river toward the school's errand; across toward its lane, a spring, never a wall
      gx += c.tx * go - c.tz * k; gz += c.tz * go + c.tx * k;
      fvx[i] += gx * dt; fvz[i] += gz * dt;
      const sp = Math.hypot(fvx[i], fvz[i]) || 1, want = clamp(sp, 2.5, 7) / sp; fvx[i] *= want; fvz[i] *= want;
      fx[i] += fvx[i] * dt; fz[i] += fvz[i] * dt;
      ci = fi[i] = nearestCL(fx[i], fz[i], ci); c = CL[ci]; o = (fx[i] - c.x) * -c.tz + (fz[i] - c.z) * c.tx;
      const hard = c.hw * 0.8;   // never near the bank
      if (Math.abs(o) > hard) { const e = Math.abs(o) - hard, s = Math.sign(o); fx[i] += c.tz * s * e; fz[i] -= c.tx * s * e; }
      if (grabbed(fx[i], fz[i])) airStart(fo, fx[i], GROUND + 0.4, fz[i], true);
    }
  }
  const fishMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
  const fishGeo = new THREE.BufferGeometry();
  fishGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0.2, 0.1, -0.24, 0, 0.1, 0.24, 0, 0.1, 0, -0.2, 0.1, 0, 0, -0.65, 0, 0, -0.55, 0, 0.34, -1.15, 0, -0.34, -1.15]), 3));
  fishGeo.setIndex([0, 2, 1, 0, 1, 3, 0, 4, 2, 0, 3, 4, 5, 1, 2, 5, 3, 1, 5, 2, 4, 5, 4, 3, 6, 7, 8]); fishGeo.scale(1.5, 1.5, 1.5);
  const fishMesh = new THREE.InstancedMesh(fishGeo, fishMat, NF); fishMesh.frustumCulled = false; world.add(fishMesh);
  // ── Boats: the river flows one way and so do they. A few sailboats and now and then a cruise ship come down it, one behind another, and sail off the map. ─
  const boats = [], pirateTex = (() => {   // black flag, white skull and crossbones
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 96;
    try {
      const c = cv.getContext('2d'); c.fillStyle = '#0b0b0b'; c.fillRect(0, 0, 128, 96); c.strokeStyle = '#f2f2f2'; c.fillStyle = '#f2f2f2'; c.lineWidth = 7; c.lineCap = 'round';
      c.beginPath(); c.moveTo(34, 70); c.lineTo(94, 24); c.moveTo(94, 70); c.lineTo(34, 24); c.stroke();
      c.beginPath(); c.arc(64, 44, 20, 0, 6.283); c.fill(); c.fillRect(54, 58, 20, 12); c.fillStyle = '#0b0b0b'; c.beginPath(); c.arc(56, 42, 5, 0, 6.283); c.arc(72, 42, 5, 0, 6.283); c.fill(); c.fillRect(62, 50, 4, 7);
    } catch (e) { /* no 2d canvas in the headless tests */ }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  })(), pirateFlagMat = new THREE.MeshBasicMaterial({ map: pirateTex, side: THREE.DoubleSide });
  function makeBoat(kind) {
    const g = new THREE.Group(), b = { kind, dir: 1, lane: 0, jit: 0, big: kind === 'ship' || kind === 'pirate', fireT: rnd(6, 15), on: false, g, sail: null, i: 0, s: 0, v: 4, off: 0, cur: 0, moor: 0, plan: null, yaw: 0, x: 0, z: 0, air: null };
    if (kind === 'pirate') {   // a galleon: three masts, square sails, cannons down each side, and a jolly roger
      g.add(box(4.6, 2.4, 20, solidMat, 0, 1.2, 0), box(3.8, 1.2, 4.6, solidMat, 0, 3, -7.4), box(3.4, 1, 3, solidMat, 0, 2.7, 8), box(0.4, 0.4, 5, solidMat, 0, 2.4, 11.5));
      for (const [mz, mh, sw] of [[-5, 15, 7.5], [1, 18, 9], [6.5, 14, 7]]) {
        g.add(box(0.35, mh, 0.35, solidMat, 0, 2.4 + mh / 2, mz), box(sw, mh * 0.42, 0.18, solidMat, 0, 2.4 + mh * 0.62, mz + 0.4), box(sw * 0.8, mh * 0.3, 0.18, solidMat, 0, 2.4 + mh * 0.92, mz + 0.4));
      }
      for (const sx of [-1, 1]) for (const cz of [-6, -2, 2, 6]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 1.5, 7).rotateZ(Math.PI / 2), milMat); c.position.set(sx * 2.55, 1.9, cz); g.add(c); }
      const fl2 = new THREE.Mesh(new THREE.PlaneGeometry(3, 2, 6, 1).translate(1.5, 0, 0).rotateY(Math.PI / 2), pirateFlagMat); fl2.position.set(0, 2.4 + 18 + 0.8, 1); g.add(fl2); b.sail = fl2;
    } else if (b.big) {
      g.add(box(4.2, 2.2, 18, solidMat, 0, 1.1, 0), box(3.6, 1.6, 11, solidMat, 0, 3, -1.5), box(3, 1.4, 7, solidMat, 0, 4.5, -2.5), box(1.3, 2.4, 1.7, milMat, 0, 6.4, -4), box(2.6, 0.9, 3, solidMat, 0, 3.4, 7));
    } else {
      const sailGeo = new THREE.BufferGeometry();
      sailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0.7, 0.5, 0, 6.2, 0.5, 0, 0.7, -2.3, 0, 0.7, 0.9, 0, 5, 0.8, 0, 0.7, 2.9]), 3)); sailGeo.setIndex([0, 1, 2, 3, 5, 4]); sailGeo.computeVertexNormals();
      b.sail = new THREE.Mesh(sailGeo, solidMat);
      g.add(box(1.6, 0.7, 5, solidMat, 0, 0.35, 0), box(0.14, 6.2, 0.14, solidMat, 0, 3.3, 0.5), b.sail); g.scale.setScalar(1.25);
    }
    g.visible = false; world.add(g); fadeable(g); return b;
  }
  for (let n = 0; n < 4; n++) boats.push(makeBoat(n < 3 ? 'sail' : 'ship'));
  boats.push(makeBoat('pirate'), makeBoat('pirate'));
  let foeAt = 0, foeDir = 1;
  function startBoat(kind, dir) {   // the river has two lanes: boats go down it in one and up it in the other
    dir ??= Math.random() < 0.5 ? 1 : -1;
    const b = boats.find(o => !o.on && o.kind === kind); if (!b) return false;
    const s0 = dir > 0 ? CL[BS0].s : CL[BS1].s;
    for (const o of boats) if (o.on && o.dir === dir && Math.abs(o.s - s0) < 32) return false;   // the start is not clear yet
    b.dir = dir; b.s = s0; b.i = dir > 0 ? BS0 : BS1; b.fireT = rnd(6, 15); b.v = b.big ? rnd(3, 4.2) : rnd(4, 6.5); b.lane = dir * 0.42; b.jit = b.big ? rnd(-0.6, 0.6) : rnd(-1.6, 1.6); b.off = b.jit; b.cur = b.lane * CL[b.i].hw + b.jit; b.moor = 0; b.plan = null; b.air = null; b.on = true; b.g.visible = true;
    if (b.big) ctx.sound?.event('horn', { x: CL[b.i].x, y: GROUND, z: CL[b.i].z });
    if (kind === 'pirate' && Math.random() < 0.45) { foeAt = clock + rnd(5, 12); foeDir = -dir; }   // sometimes a second galleon comes the other way
    return true;
  }
  function endBoat(b) { b.on = false; b.g.visible = false; b.air = null; }
  // anything caught by the tornado circles it, rises, is thrown, and comes down somewhere else
  function grabbed(x, z) { return tw.on && tw.env > 0.5 && (x - tw.p.x) ** 2 + (z - tw.p.z) ** 2 < 34 * 34; }
  function airStart(o, x, y, z, quiet) { if (!quiet) ctx.sound?.event('yoink', { x, y, z }); const dx = x - tw.p.x, dz = z - tw.p.z; o.air = { a: Math.atan2(dz, dx), r: Math.hypot(dx, dz), x, y, z, t: 0, spin: rnd(2, 4), rot: 0, free: false, vx: 0, vy: 0, vz: 0 }; }
  function airStep(o, dt) {   // true while still in the air
    const A = o.air; A.t += dt; A.rot += A.spin * dt;
    if (!A.free) {
      A.a += (2.4 + A.t * 0.15) * dt; A.r = Math.max(5, A.r - 2.5 * dt); A.y = Math.min(GROUND + 55, A.y + 9 * dt);
      A.x = tw.p.x + Math.cos(A.a) * A.r; A.z = tw.p.z + Math.sin(A.a) * A.r;
      if (A.t > 5 || !tw.on) { A.free = true; A.vx = -Math.sin(A.a) * 18; A.vz = Math.cos(A.a) * 18; A.vy = 6; }
    } else { A.vy -= 32 * dt; A.x += A.vx * dt; A.y += A.vy * dt; A.z += A.vz * dt; if (A.y <= GROUND) return false; }
    return true;
  }
  function stepBoats(dt) {
    if (foeAt && clock > foeAt) { foeAt = 0; startBoat('pirate', foeDir); }
    for (const b of boats) {
      if (!b.on) continue;
      if (b.air) { if (!airStep(b, dt)) endBoat(b); continue; }
      const mS = MOOR_BASE - 4.4 * b.dir, prev = b.s, dd = Math.abs(b.s - mS);
      let v = b.v; for (const o of boats) if (o !== b && o.on && !o.air && o.dir === b.dir) { const gap = (o.s - b.s) * b.dir; if (gap > 0 && gap < 34) v *= clamp((gap - 10) / 16, 0.15, 1); }   // queues behind the one ahead in its lane
      if (b.moor > 0) { b.moor -= dt; if (b.moor <= 0) { dock.busy = false; ctx.sound?.event('bell', b); ctx.sound?.event('toot', b); } } else b.s += b.dir * v * dt;
      if (b.kind === 'pirate') { b.fireT -= dt; if (b.fireT <= 0) { const foe = boats.some(o => o !== b && o.kind === 'pirate' && o.on && !o.air && Math.hypot(o.x - b.x, o.z - b.z) < 170); b.fireT = foe ? rnd(3, 6) : rnd(10, 25); fireCannons(b); } }
      if (b.big || dd > 26) b.plan = null; else if (b.plan === null && dd < 20 && b.moor <= 0) b.plan = !dock.busy && Math.random() < 0.4;   // a sailboat decides on approach whether to tie up
      if (b.plan && b.moor <= 0 && (prev - mS) * (b.s - mS) <= 0) { b.moor = rnd(18, 35); dock.busy = true; b.s = mS; b.plan = false; ctx.sound?.event('dock', b); ctx.sound?.event('bell', b); }
      if (b.s > CL[BS1].s || b.s < CL[BS0].s) { if (b.moor > 0) dock.busy = false; endBoat(b); continue; }
      while (b.i < BS1 && CL[b.i + 1].s < b.s) b.i++; while (b.i > BS0 && CL[b.i].s > b.s) b.i--;
      const c = CL[b.i], d = CL[Math.min(BS1, b.i + 1)], u = d.s > c.s ? clamp((b.s - c.s) / (d.s - c.s), 0, 1) : 0, tx = c.tx + (d.tx - c.tx) * u, tz = c.tz + (d.tz - c.tz) * u;
      b.cur += ((b.moor > 0 || b.plan ? DOCK_OFF : b.lane * c.hw + b.jit) - b.cur) * Math.min(1, dt * 0.7);
      b.x = c.x + (d.x - c.x) * u - tz * b.cur; b.z = c.z + (d.z - c.z) * u + tx * b.cur;
      let da = Math.atan2(tx * b.dir, tz * b.dir) - b.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); b.yaw += da * Math.min(1, dt * 1.5);
      if (grabbed(b.x, b.z)) { if (b.moor > 0) dock.busy = false; airStart(b, b.x, GROUND + 0.3, b.z); }
    }
  }

  // ── A small town where the river leaves the valley, with a dock the boat can tie up at ─
  const DOCK_SIDE = -1, dock = { busy: false };
  let DK = LO + 20;
  { const flat = []; for (let i = LO; i <= HI; i++) if (CL[i].z > 14 && CL[i].z < 44 && terrainY(CL[i].x, CL[i].z) <= GROUND + 0.01) flat.push(i); if (flat.length > 6) DK = flat[Math.floor(flat.length * 0.4)]; }
  const MOOR_BASE = CL[DK].s, DOCK_OFF = DOCK_SIDE * (CL[DK].hw - 1.9);
  {
    const nrm = c => ({ x: -c.tz, z: c.tx }), cd = CL[DK], nd = nrm(cd);
    const bank = { x: cd.x + nd.x * DOCK_SIDE * (cd.hw + 3), z: cd.z + nd.z * DOCK_SIDE * (cd.hw + 3) };
    const TOWN = [{ x: bank.x + nd.x * DOCK_SIDE * 6, z: bank.z + nd.z * DOCK_SIDE * 6, w: 4.5, d: 4.5, h: 4 }];   // a boathouse at the dock
    for (let tries = 0; tries < 600 && TOWN.length < 12; tries++) {
      const ci = clamp(DK - 22 + ((rand() * 44) | 0), LO, HI), c = CL[ci], nv = nrm(c), side = rand() < 0.5 ? -1 : 1, off = c.hw + 6 + rand() * 12;
      const w = 4 + rand() * 4, d = 4 + rand() * 4, h = 4 + rand() * 7, x = c.x + nv.x * side * off, z = c.z + nv.z * side * off;
      if (z < 6 || terrainY(x, z) > GROUND + 0.01 || terrainY(x + w, z + d) > GROUND + 0.01 || terrainY(x - w, z - d) > GROUND + 0.01 || Math.hypot(x - bank.x, z - bank.z) < 10) continue;   // the town keeps to the south bank, clear of the rail line
      let ok = true;
      for (let k = Math.max(0, ci - 20); k <= Math.min(CL.length - 1, ci + 20); k++) if (Math.hypot(CL[k].x - x, CL[k].z - z) < CL[k].hw + 3 + Math.max(w, d) / 2) { ok = false; break; }
      for (const o of TOWN) if (Math.abs(x - o.x) < (w + o.w) / 2 + 2 && Math.abs(z - o.z) < (d + o.d) / 2 + 2) ok = false;
      if (ok) TOWN.push({ x, z, w, d, h });
    }
    const tm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), bldMat, TOWN.length), tq = new THREE.Quaternion(), tmx = new THREE.Matrix4(), tpos = new THREE.Vector3(), tsc = new THREE.Vector3();
    const src = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)).getAttribute('position'), ep = new Float32Array(TOWN.length * src.count * 3);
    TOWN.forEach((t, n) => {
      tm.setMatrixAt(n, tmx.compose(tpos.set(t.x, GROUND + t.h / 2, t.z), tq, tsc.set(t.w, t.h, t.d)));
      for (let v = 0; v < src.count; v++) { const o = (n * src.count + v) * 3; ep[o] = t.x + src.getX(v) * t.w; ep[o + 1] = GROUND + t.h / 2 + src.getY(v) * t.h; ep[o + 2] = t.z + src.getZ(v) * t.d; }
      const bx = { x0: t.x - t.w / 2, x1: t.x + t.w / 2, z0: t.z - t.d / 2, z1: t.z + t.d / 2, y0: GROUND, y1: GROUND + t.h };
      boxes.push(bx);
      slots.push({ x: bx.x0 + 0.9, y: bx.y1 + 0.5, z: bx.z0 + 0.9, b: bx, taken: false }, { x: bx.x1 - 0.9, y: bx.y1 + 0.5, z: bx.z1 - 0.9, b: bx, taken: false });
    });
    tm.instanceMatrix.needsUpdate = true; tm.frustumCulled = false; world.add(tm);
    const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(ep, 3)); const te = new THREE.LineSegments(eg, edgeMat); te.frustumCulled = false; world.add(te);
    // the dock: a deck running out from the bank, on posts
    const dk = new THREE.Group(), dir = { x: -nd.x * DOCK_SIDE, z: -nd.z * DOCK_SIDE };
    dk.add(box(1.6, 0.25, 5.6, solidMat, 0, 0.8, 0));
    for (const [px, pz] of [[-0.65, -2.5], [0.65, -2.5], [-0.65, 2.5], [0.65, 2.5]]) dk.add(box(0.25, 1.6, 0.25, solidMat, px, 0.2, pz));
    dk.position.set(cd.x + nd.x * DOCK_SIDE * (cd.hw + 0.2), GROUND, cd.z + nd.z * DOCK_SIDE * (cd.hw + 0.2)); dk.rotation.y = Math.atan2(dir.x, dir.z); world.add(dk);
  }

  // ── Streets and traffic: streets and avenues through the city make a grid; a highway runs off the back. Cars and trucks are few. ─
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x222222, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const SEGS = [];
  function cut(fixed, a, b, horiz) {   // a road along one axis, cut wherever a building stands across it
    const bl = [];
    for (const bx of boxes) { const f0 = horiz ? bx.z0 : bx.x0, f1 = horiz ? bx.z1 : bx.x1; if (f1 + 0.3 > fixed - 1.8 && f0 - 0.3 < fixed + 1.8) bl.push(horiz ? [bx.x0 - 1, bx.x1 + 1] : [bx.z0 - 1, bx.z1 + 1]); }
    bl.sort((p, q) => p[0] - q[0]);
    let t = a; const out = [];
    for (const [lo, hi] of bl) { if (lo - t >= 18 && t < b) out.push([t, Math.min(lo, b)]); t = Math.max(t, hi); }
    if (b - t >= 18) out.push([t, b]);
    for (const [u, v] of out) { const x0 = horiz ? u : fixed, z0 = horiz ? fixed : u, x1 = horiz ? v : fixed, z1 = horiz ? fixed : v, len = Math.hypot(x1 - x0, z1 - z0); SEGS.push({ x0, z0, x1, z1, len, dx: (x1 - x0) / len, dz: (z1 - z0) / len, cars: true }); }
  }
  for (const rz of [-24, -46, -70, -96]) cut(rz, -112, 112, true);
  function riverStop(ax) { let z = 10; for (const c of CL) if (Math.abs(c.x - ax) < 3 && c.z > -50) z = Math.min(z, c.z - c.hw - 5); return z; }   // an avenue stops short of the water
  for (const ax of AVE) cut(ax, -108, riverStop(ax), false);
  const HWYP = [[48, -108], [48, -346], [330, -346]];   // the highway runs to the coast, then east along it to the harbour
  for (let i = 0; i < 2; i++) { const p = HWYP[i], q = HWYP[i + 1], len = Math.hypot(q[0] - p[0], q[1] - p[1]); SEGS.push({ x0: p[0], z0: p[1], x1: q[0], z1: q[1], len, dx: (q[0] - p[0]) / len, dz: (q[1] - p[1]) / len, cars: false }); }
  const HSEG = SEGS.slice(-2), HTOT = HSEG[0].len + HSEG[1].len;
  function hwyAt(d) { let r = d; for (const g of HSEG) { if (r <= g.len) return { x: g.x0 + g.dx * r, z: g.z0 + g.dz * r, dx: g.dx, dz: g.dz }; r -= g.len; } const g = HSEG[1]; return { x: g.x1, z: g.z1, dx: g.dx, dz: g.dz }; }
  {
    const pos = [], edge = [], Y = GROUND + 0.07;
    for (const g of SEGS) {
      const nx = -g.dz * 1.8, nz = g.dx * 1.8;
      pos.push(g.x0 + nx, Y, g.z0 + nz, g.x0 - nx, Y, g.z0 - nz, g.x1 - nx, Y, g.z1 - nz, g.x0 + nx, Y, g.z0 + nz, g.x1 - nx, Y, g.z1 - nz, g.x1 + nx, Y, g.z1 + nz);
      edge.push(g.x0 + nx, Y + 0.02, g.z0 + nz, g.x1 + nx, Y + 0.02, g.z1 + nz, g.x0 - nx, Y + 0.02, g.z0 - nz, g.x1 - nx, Y + 0.02, g.z1 - nz);
    }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3)); rg.computeVertexNormals();
    const roads = new THREE.Mesh(rg, roadMat); roads.frustumCulled = false; world.add(roads);
    const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(edge), 3));
    const kerbs = new THREE.LineSegments(eg, edgeMat); kerbs.frustumCulled = false; world.add(kerbs);
  }
  const NCAR = 8, NTRUCK = 2, VEH = [], DRIVE = SEGS.filter(g => g.cars), roadLen = DRIVE.reduce((a, g) => a + g.len, 0);
  function pickSeg() { let r = Math.random() * roadLen; for (const g of DRIVE) { r -= g.len; if (r <= 0) return g; } return DRIVE[0]; }
  for (let i = 0; i < NCAR + NTRUCK && DRIVE.length; i++) {
    const sg = pickSeg(), dir = Math.random() < 0.5 ? 1 : -1, v0 = i >= NCAR ? rnd(5, 8) : rnd(7, 12);
    VEH.push({ sg, s: rnd(0, sg.len), dir, v0, lat: dir * 0.9, truck: i >= NCAR, air: null, dead: 0, x: 0, z: 0 });
  }
  const BIG = Array.from({ length: 3 }, () => ({ on: false, wait: rnd(10, 90), z: 0, dir: -1, v: 10 }));   // big trucks that head off down the highway, or come in from it
  function stepTraffic(dt) {
    for (const a of VEH) {
      if (a.air) { if (!airStep(a, dt)) { a.air = null; a.dead = rnd(25, 50); } continue; }
      if (a.dead > 0) { a.dead -= dt; if (a.dead <= 0) { a.sg = pickSeg(); a.s = rnd(0, a.sg.len); a.dir = Math.random() < 0.5 ? 1 : -1; a.lat = a.dir * 0.9; } continue; }
      let v = a.v0;
      for (const b of VEH) if (b !== a && b.sg === a.sg && b.dir === a.dir && !b.air && b.dead <= 0) { const gap = (b.s - a.s) * a.dir; if (gap > 0 && gap < 10) v = Math.min(v, Math.max(0.5, (gap - 5) * 2)); }   // hangs back behind the one ahead
      a.s += a.dir * v * dt;
      if (Math.random() < dt / 160) ctx.sound?.event('car', { x: a.x, y: GROUND, z: a.z });
      if (a.s > a.sg.len) { a.s = a.sg.len; a.dir = -1; } else if (a.s < 0) { a.s = 0; a.dir = 1; }   // turns round at a dead end, into the other lane
      a.lat += (a.dir * 0.9 - a.lat) * Math.min(1, dt * 1.2);
      const g = a.sg; a.x = g.x0 + g.dx * a.s - g.dz * a.lat; a.z = g.z0 + g.dz * a.s + g.dx * a.lat;
      if (grabbed(a.x, a.z)) airStart(a, a.x, GROUND + 0.1, a.z);
    }
    for (const t of BIG) {
      if (!t.on) { t.wait -= dt; if (t.wait <= 0) { t.on = true; t.dir = Math.random() < 0.7 ? 1 : -1; t.z = t.dir > 0 ? 0 : HTOT; t.v = rnd(9, 13); const hp = hwyAt(t.z); ctx.sound?.event('truck', { x: hp.x, y: GROUND, z: hp.z }); } }
      else { t.z += t.dir * t.v * dt; if (t.z > HTOT || t.z < 0) { t.on = false; t.wait = rnd(30, 120); } }
    }
  }
  const vehMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  const carMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.3, 0.8, 2.8).translate(0, 0.45, 0), vehMat, NCAR), truckMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.8, 1.7, 5.4).translate(0, 0.9, 0), vehMat, NTRUCK);
  const bigMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 3.2, 9).translate(0, 1.7, 0), vehMat, BIG.length);
  for (let i = 0; i < NCAR; i++) carMesh.setColorAt(i, new THREE.Color().setScalar(rnd(0.5, 0.95)));
  for (let i = 0; i < NTRUCK; i++) truckMesh.setColorAt(i, new THREE.Color().setScalar(rnd(0.6, 0.9)));
  for (let i = 0; i < BIG.length; i++) bigMesh.setColorAt(i, new THREE.Color().setScalar(rnd(0.55, 0.85)));
  carMesh.frustumCulled = false; truckMesh.frustumCulled = false; bigMesh.frustumCulled = false; world.add(carMesh, truckMesh, bigMesh);
  const fq = new THREE.Quaternion(), fq2 = new THREE.Quaternion(), fe = new THREE.Euler(), fm = new THREE.Matrix4(), fpos = new THREE.Vector3(), fsc = new THREE.Vector3();
  function drawTraffic() {
    let ci = 0, ti = 0;
    for (const a of VEH) {
      if (a.dead > 0) fm.compose(fpos.set(0, -999, 0), fq.identity(), fsc.setScalar(0.001));
      else if (a.air) { fq.setFromEuler(fe.set(a.air.rot * 0.7, a.air.rot, a.air.rot * 0.5)); fm.compose(fpos.set(a.air.x, a.air.y, a.air.z), fq, fsc.setScalar(1)); }
      else { fq.setFromAxisAngle(UP, Math.atan2(a.sg.dx * a.dir, a.sg.dz * a.dir)); fm.compose(fpos.set(a.x, GROUND + 0.08, a.z), fq, fsc.setScalar(1)); }
      if (a.truck) truckMesh.setMatrixAt(ti++, fm); else carMesh.setMatrixAt(ci++, fm);
    }
    BIG.forEach((t, i) => {
      if (!t.on) fm.compose(fpos.set(0, -999, 0), fq.identity(), fsc.setScalar(0.001));
      else { const hp = hwyAt(t.z); fm.compose(fpos.set(hp.x - hp.dz * 0.9 * t.dir, GROUND + 0.08, hp.z + hp.dx * 0.9 * t.dir), fq.setFromAxisAngle(UP, Math.atan2(hp.dx * t.dir, hp.dz * t.dir)), fsc.setScalar(1)); }
      bigMesh.setMatrixAt(i, fm);
    });
    carMesh.instanceMatrix.needsUpdate = true; truckMesh.instanceMatrix.needsUpdate = true; bigMesh.instanceMatrix.needsUpdate = true;
  }

  // ── Cannon smoke and blasts: grey puffs that swell and fade; a broadside from the galleon can blow another boat sky high ─
  const puffs = [], puffGeo = new THREE.IcosahedronGeometry(1, 1), pending = [];
  for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, depthWrite: false })); m.visible = false; m.frustumCulled = false; world.add(m); puffs.push({ m, t: 0, delay: 0, on: false, big: false }); }
  function addPuff(x, y, z, delay, big) { const p = puffs.find(q => !q.on); if (!p) return; p.on = true; p.t = 0; p.delay = delay; p.big = !!big; p.m.position.set(x, y, z); p.m.visible = false; }
  function blast(o) {
    ctx.sound?.event('explosion', o); addPuff(o.x, GROUND + 2, o.z, 0, true); addPuff(o.x + 2, GROUND + 3, o.z - 1, 0.12, true);
    if (o.moor > 0) dock.busy = false;
    o.air = { a: 0, r: 0, x: o.x, y: GROUND + 0.5, z: o.z, t: 0, spin: rnd(4, 8), rot: 0, free: true, vx: rnd(-12, 12), vy: rnd(18, 28), vz: rnd(-12, 12) };
  }
  function stepPuffs(dt) {
    for (const p of puffs) {
      if (!p.on) continue;
      if (p.delay > 0) { p.delay -= dt; if (p.delay <= 0 && !p.big) ctx.sound?.event('cannon', p.m.position); continue; }
      p.t += dt; const u = p.t / (p.big ? 2.4 : 1.8);
      if (u >= 1) { p.on = false; p.m.visible = false; continue; }
      p.m.visible = true; p.m.scale.setScalar(p.big ? 2 + 7 * u : 0.8 + 3 * u); p.m.position.y += 1.5 * dt; p.m.material.opacity = (p.big ? 0.9 : 0.7) * (1 - u);
    }
    for (let i = pending.length - 1; i >= 0; i--) { const q = pending[i]; q.t -= dt; if (q.t <= 0) { if (q.tgt.on && !q.tgt.air) { if (q.tgt.kind === 'pirate') { ctx.sound?.event('explosion', q.tgt); addPuff(q.tgt.x + rnd(-3, 3), GROUND + 3, q.tgt.z + rnd(-3, 3), 0, true); shake(0.5); } else blast(q.tgt); } pending.splice(i, 1); } }
  }
  function fireCannons(b) {   // a broadside at the nearest other boat in range; the shells land a moment later
    let tgt = null, bd = 170; for (const o of boats) if (o !== b && o.on && !o.air) { const d = Math.hypot(o.x - b.x, o.z - b.z); if (d < bd) { bd = d; tgt = o; } }
    const c = Math.cos(b.yaw), s = Math.sin(b.yaw), side = tgt ? ((tgt.x - b.x) * c - (tgt.z - b.z) * s >= 0 ? 1 : -1) : (Math.random() < 0.5 ? -1 : 1), n = 3 + ((Math.random() * 2) | 0);
    for (let k = 0; k < n; k++) { const ox = side * 2.9, oz = [-6, -2, 2, 6][k % 4]; addPuff(b.x + ox * c + oz * s, GROUND + 2.2, b.z - ox * s + oz * c, k * 0.3); }
    if (tgt) pending.push({ t: 1.6 + n * 0.3, tgt });
  }

  // ── A fire in the forest: flames and dark smoke that spreads. A helicopter with a bucket or a water bomber comes and puts it out. ─
  const MAXSPOT = 4, fire = { on: false, spots: [], x: 0, z: 0, t: 0, power: 0, steam: 0, dispatchAt: 60, called: false, recall: 0, spreadT: 20, tower: 0, mayT: 0 };
  const fireDark = new THREE.Color(), fireSteam = new THREE.Color();
  const fireSmokes = Array.from({ length: MAXSPOT }, () => makeSmoke(30, { color: 0x333333, size: 5, opacity: 0.8, rise: 7, life: 8 }));
  const flameGroups = Array.from({ length: MAXSPOT }, () => { const gr = new THREE.Group(); gr.visible = false; world.add(gr); for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283, f = new THREE.Mesh(new THREE.ConeGeometry(1.1 + (k % 2) * 0.6, 3.4 + (k % 3), 5).translate(0, 1.7, 0), accentMat); f.position.set(Math.cos(a) * 2.2, 0, Math.sin(a) * 2.2); gr.add(f); } return gr; });
  const WATERN = 160, wx = new Float32Array(WATERN), wy = new Float32Array(WATERN).fill(-999), wz = new Float32Array(WATERN), wvx = new Float32Array(WATERN), wvy = new Float32Array(WATERN), wvz = new Float32Array(WATERN), waterPos = new Float32Array(WATERN * 3).fill(-999);
  const dropMat = new THREE.PointsMaterial({ color: 0x9ccaff, size: 1.6, transparent: true, opacity: 0.85, depthWrite: false });
  const dropGeo = new THREE.BufferGeometry(); dropGeo.setAttribute('position', new THREE.BufferAttribute(waterPos, 3));
  const drops = new THREE.Points(dropGeo, dropMat); drops.frustumCulled = false; world.add(drops);
  function emitWater(x, y, z, n, spread) { for (let i = 0; i < WATERN && n > 0; i++) if (wy[i] < -900) { wx[i] = x + rnd(-spread, spread); wz[i] = z + rnd(-spread, spread); wy[i] = y; wvx[i] = rnd(-1, 1); wvz[i] = rnd(-1, 1); wvy[i] = -rnd(18, 28); n--; } }
  function inLake(x, z) { return ((x - LAKE.x) / (LAKE.rx * 1.2 + 6)) ** 2 + ((z - LAKE.z) / (LAKE.rz * 1.2 + 6)) ** 2 < 1; }
  const fireOk = (x, z) => z > 110 && z < 440 && Math.abs(x) < 440 && terrainY(x, z) <= GROUND + 0.01 && !inLake(x, z) && !TOWERS.some(t => Math.hypot(x - t.x, z - t.z) < 25) && Math.hypot(x - CAMP.x, z - CAMP.z) < 25 === false && !CL.some(c => Math.hypot(c.x - x, c.z - z) < c.hw + 10);
  function recenter() { let sx = 0, sz = 0, n = 0, pw = 0; for (const s of fire.spots) if (s.power > 0) { sx += s.x; sz += s.z; n++; pw = Math.max(pw, s.power); } if (n) { fire.x = sx / n; fire.z = sz / n; } fire.power = pw; }
  function alertTower() { let bi = 0, bd = 1e9; TOWERS.forEach((t, i) => { const d = Math.hypot(t.x - fire.x, t.z - fire.z); if (d < bd) { bd = d; bi = i; } }); fire.tower = bi; ctx.sound?.event('mayday', { x: TOWERS[bi].x, y: GROUND + 24, z: TOWERS[bi].z }); fire.mayT = 25; }
  function startFire(soon, at) {
    if (fire.on) return;
    let sx = 0, sz = 0; if (at) { sx = at.x; sz = at.z; } else for (let tries = 0; tries < 80; tries++) { const x = rnd(-150, 230), z = rnd(115, 330); if (fireOk(x, z)) { sx = x; sz = z; break; } }
    if (!sx && !sz) return;
    fire.spots = [{ x: sx, z: sz, power: 1, wet: false }]; fire.on = true; fire.steam = 0; fire.t = soon ? 45 : 0; fire.dispatchAt = rnd(55, 85); fire.called = false; fire.recall = 0; fire.scouts = false; fire.scoutT = rnd(5, 9); fire.spreadT = rnd(18, 28); recenter(); alertTower();
  }
  function callFirefighters() {
    if (Math.random() < 0.5 && helis.some(q => !q.on)) { if (startFireHeli()) { fire.called = true; fire.recall = 75; } }
    else if (!fl.on) { launchPass('tanker', { x: fire.x, z: fire.z }); fire.called = true; fire.recall = 75; }   // otherwise try again next frame
  }
  function stepFire(dt) {
    for (let i = 0; i < WATERN; i++) {   // the water falls, and wets the fire where it lands
      if (wy[i] < -900) continue;
      wy[i] += wvy[i] * dt; wx[i] += wvx[i] * dt; wz[i] += wvz[i] * dt;
      if (wy[i] < GROUND + 2) { if (fire.on) for (const s of fire.spots) if (Math.hypot(wx[i] - s.x, wz[i] - s.z) < 20) { s.power = Math.max(0, s.power - 0.015); s.wet = true; } wy[i] = -999; }
      waterPos[i * 3] = wx[i]; waterPos[i * 3 + 1] = wy[i]; waterPos[i * 3 + 2] = wz[i];
    }
    dropGeo.attributes.position.needsUpdate = true;
    if (!fire.on) { for (const sm of fireSmokes) sm.mat.opacity = 0; return; }
    fire.t += dt;
    if (!fire.scouts && fire.power > 0 && fire.t > fire.scoutT) { fire.scouts = true; startScout(); if (Math.random() < 0.6) startScout(); }   // the alarm brings scouts with their lights first
    fire.spreadT -= dt;
    if (fire.spreadT <= 0 && fire.spots.length < MAXSPOT && fire.power > 0.5) {   // it spreads: a new spot catches nearby
      fire.spreadT = rnd(18, 30); const from = fire.spots[(Math.random() * fire.spots.length) | 0];
      for (let k = 0; k < 14; k++) { const a = rnd(0, 6.28), r = rnd(16, 26), x = from.x + Math.cos(a) * r, z = from.z + Math.sin(a) * r; if (fireOk(x, z)) { fire.spots.push({ x, z, power: 0.3, wet: false }); break; } }
    }
    for (const s of fire.spots) {
      if (s.power > 0 && !s.wet && s.power < 1) s.power = Math.min(1, s.power + dt * 0.05); if (fire.t > 260 && s.power > 0) s.power -= dt * 0.06;
      if (s.power > 0 && SND.rain > 0.25) s.power -= dt * 0.04 * SND.rain;   // heavy rain slowly puts it out
      if (s.power > 0 && tw.on && tw.env > 0.4 && Math.hypot(s.x - tw.p.x, s.z - tw.p.z) < TW_R * 0.9) s.power = 0;   // a tornado passing over snuffs it
    }
    recenter();
    if (fire.power > 0) {
      fire.mayT -= dt; if (fire.mayT <= 0) { fire.mayT = 25; ctx.sound?.event('mayday', { x: TOWERS[fire.tower].x, y: GROUND + 24, z: TOWERS[fire.tower].z }); }
      if (!fire.called && fire.t > fire.dispatchAt) callFirefighters();
      else if (fire.called && !helis.some(q => q.on && q.role === 'fighter') && !(fl.on && fl.kind === 'tanker')) { fire.recall -= dt; if (fire.recall <= 0) fire.called = false; }
    }
    if (fire.power <= 0) fire.steam += dt;
    fireSmokes.forEach((sm, i) => { const s = fire.spots[i]; if (!s) { sm.mat.opacity = 0; return; } sm.mat.color.copy(s.power > 0 ? fireDark : fireSteam); stepSmoke(sm, dt, s.x, GROUND + 3, s.z, s.power > 0 ? 1 : Math.max(0, 1 - fire.steam / 10)); });
    if (fire.power <= 0 && fire.steam > 12) { fire.on = false; fire.spots = []; nextFire = clock + rnd(240, 480); }
  }
  function drawFire() {
    flameGroups.forEach((gr, i) => {
      const s = fire.on ? fire.spots[i] : null; gr.visible = !!s && s.power > 0; if (!gr.visible) return;
      gr.position.set(s.x, GROUND, s.z); gr.children.forEach((f, k) => f.scale.set(s.power, s.power * (0.8 + 0.4 * Math.sin(tick * 13 + k * 1.7 + i) * Math.sin(tick * 7.3 + k)), s.power));
    });
    towerLamps.forEach((l, i) => { l.visible = fire.on && fire.power > 0 && i === fire.tower && (tick % 0.8) < 0.4; });
  }

  // ── Helicopters: up to four at once. Scenic ones hop between waypoints and hover; scouts circle a fire with their lights on; fire fighters
  //    hang over the flames with a bucket. They have weight: they accelerate and brake, bank into turns, slide one way while turning another,
  //    sway on the spot, and one that locks onto something stays with it, circling. ─
  function makeHeliMesh() {
    const g = new THREE.Group(); g.rotation.order = 'YXZ';
    g.add(box(2.6, 2.4, 5.6, solidMat, 0, 0, 0), box(1.9, 1.1, 1.6, milMat, 0, 0.3, 2.7), box(0.7, 0.7, 6, solidMat, 0, 0.3, -5.4), box(0.2, 2, 1.3, solidMat, 0, 1.2, -8.1),
      box(0.18, 0.18, 4.6, solidMat, -1.2, -1.5, 0.3), box(0.18, 0.18, 4.6, solidMat, 1.2, -1.5, 0.3), box(0.15, 0.9, 0.15, solidMat, 0, 1.6, 0));
    const rotor = new THREE.Group(); rotor.name = 'rotor'; rotor.position.y = 2.1; rotor.add(box(14, 0.08, 0.6, solidMat), box(0.6, 0.08, 14, solidMat)); g.add(rotor);
    const tail = box(0.08, 2.2, 0.35, solidMat, 0.3, 1.2, -8.1); tail.name = 'tail'; g.add(tail);
    return fadeable(g);
  }
  function clearY(x, z, r) {   // the lowest a helicopter may be here: 12 over any roof, 14 over any slope
    let y = Math.max(terrainY(x, z), terrainY(x + r, z), terrainY(x - r, z), terrainY(x, z + r), terrainY(x, z - r)) + 14;
    for (const b of boxes) if (b.x0 - r < x && b.x1 + r > x && b.z0 - r < z && b.z1 + r > z && b.y1 + 12 > y) y = b.y1 + 12;
    return y;
  }
  function legY(a, b) { let y = rnd(30, 42); for (let k = 0; k <= 12; k++) y = Math.max(y, clearY(a.x + (b.x - a.x) * k / 12, a.z + (b.z - a.z) * k / 12, 14)); return y; }
  const beamGeo = new THREE.ConeGeometry(1, 1, 18, 1, true), spotGeo = new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2), glowGeo = new THREE.SphereGeometry(1.3, 10, 8);
  const helis = [], lightMats = [];
  for (let n = 0; n < 4; n++) {
    const lm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }), sm = lm.clone(); sm.opacity = 0.3; lightMats.push(lm, sm);
    const h = { on: false, role: 'scenic', g: null, p: new THREE.Vector3(), v: new THREE.Vector3(), wp: [], i: 0, hover: 0, holding: false, yaw: 0, yawRate: 0, yawGoal: 0, pitch: 0, roll: 0, rot: 0, t: 0, ax: 0, ay: 0, az: 0, drip: 0, lock: null, lockEnd: 0, nextLock: 4, orbA: rnd(0, 6.28), life: 0, aim: new THREE.Vector3(), beamG: new THREE.Vector3(), lm, sm, fade: 1, tgt: new THREE.Vector3() };
    h.beam = new THREE.Mesh(beamGeo, lm); h.spot = new THREE.Mesh(spotGeo, sm); h.glow = new THREE.Mesh(glowGeo, sm);
    h.beam.visible = h.spot.visible = h.glow.visible = false; h.beam.frustumCulled = h.spot.frustumCulled = h.glow.frustumCulled = false; world.add(h.beam, h.spot, h.glow);
    helis.push(h);
  }
  const activeHelis = () => helis.filter(h => h.on);
  function startHeli(role = 'scenic') {
    const h = helis.find(q => !q.on); if (!h) return null;
    h.g ??= makeHeliMesh(); scene.add(h.g);
    const side = Math.random() < 0.5 ? -1 : 1, alongX = Math.random() < 0.6;
    const entry = { x: alongX ? side * (BX + 55) : rnd(-BX, BX) * 0.6, z: alongX ? rnd(-BZ * 0.3, BZ * 0.7) : side * (BZ + 55) }, wps = [], n = 2 + ((Math.random() * 3) | 0);
    for (let k = 0; k < n; k++) wps.push({ x: rnd(-BX * 0.7, BX * 0.7), z: rnd(-30, BZ * 0.7), hold: rnd(4, 10) });
    wps.push({ x: (Math.random() < 0.5 ? -1 : 1) * (BX + 60), z: rnd(-20, BZ * 0.6), hold: 0 });
    let prev = entry; for (const w of wps) { w.y = legY(prev, w); prev = w; }
    const dx = wps[0].x - entry.x, dz = wps[0].z - entry.z, d = Math.hypot(dx, dz) || 1;
    h.role = role; h.wp = wps; h.i = 0; h.hover = 0; h.holding = false; h.p.set(entry.x, wps[0].y, entry.z); h.v.set(dx / d * 10, 0, dz / d * 10);
    h.yaw = h.yawGoal = Math.atan2(dx, dz); h.yawRate = 0; h.pitch = h.roll = 0; h.ax = h.ay = h.az = 0; h.lock = null; h.nextLock = 4; h.drip = 0; h.on = true; h.t = 0; h.life = 0; h.fade = 1;
    h.beam.visible = h.spot.visible = h.glow.visible = false;
    return h;
  }
  function startScout() {   // lights on the fire, circling, until it is out
    const h = startHeli('scout'); if (!h) return;
    h.life = rnd(90, 140); h.wp = [{ x: h.p.x, z: h.p.z, y: 40, hold: 0 }];
  }
  function startFireHeli() {   // straight to the fire, hangs over each burning spot dropping water from a bucket, then leaves
    const h = startHeli('fighter'); if (!h) return false;
    const side = Math.random() < 0.5 ? -1 : 1, entry = { x: h.p.x, z: h.p.z }, wps = fire.spots.filter(q => q.power > 0).map(q => ({ x: q.x + 3, z: q.z + 3, hold: 10 }));
    wps.push({ x: side * (BX + 60), z: fire.z, hold: 0 });
    let prev = entry; for (const w of wps) { w.y = legY(prev, w); prev = w; }
    h.wp = wps; h.i = 0; h.yaw = h.yawGoal = Math.atan2(wps[0].x - entry.x, wps[0].z - entry.z);
    return true;
  }
  function clearHeli(h) { if (h.on && h.g) scene.remove(h.g); h.on = false; h.beam.visible = h.spot.visible = h.glow.visible = false; }
  function clearHelis() { for (const h of helis) clearHeli(h); }
  function lockTarget(h) {   // where a locked helicopter is looking, or null
    const lk = h.lock; if (!lk) return null;
    if (lk.fire) { let bs = null; for (const q of fire.spots) if (q.power > 0 && (!bs || q.power > bs.power)) bs = q; if (!bs) return null; return h.tgt.set(bs.x, GROUND + 5, bs.z); }
    if (lk.c) return chutes.includes(lk.c) && lk.c.phase > 0 ? h.tgt.set(lk.c.p.x, lk.c.p.y + 1.2, lk.c.p.z) : null;
    return fl.on && (fl.kind === 'glider' || fl.kind === 'jetpack') ? h.tgt.set(fl.p.x, fl.p.y + 1.2, fl.p.z) : null;
  }
  function stepHeli(h, dt) {
    if (!h.on) return;
    h.t += dt; h.rot += 28 * dt;
    // what it is watching: a fire first, then a glider, jetpack or parachutist nearby; a locked helicopter stays with it
    if (h.role === 'scout' && h.t > h.life && h.role === 'scout') { h.role = 'scenic'; h.lock = null; h.wp = [{ x: (Math.random() < 0.5 ? -1 : 1) * (BX + 60), z: rnd(-20, BZ * 0.6), hold: 0, y: 40 }]; h.i = 0; h.holding = false; }
    if (h.lock && (!lockTarget(h) || (h.role !== 'scout' && h.t > h.lockEnd))) { h.lock = null; h.nextLock = h.t + 6; }
    if (!h.lock && h.role !== 'fighter' && h.t > h.nextLock) {
      if (fire.on && fire.power > 0 && (h.role === 'scout' || Math.hypot(h.p.x - fire.x, h.p.z - fire.z) < 120)) { h.lock = { fire: true }; h.lockEnd = h.t + 40; }
      else if (h.role !== 'scout') {
        let best = null, bd = 110 * 110;
        if (fl.on && (fl.kind === 'glider' || fl.kind === 'jetpack')) { const d2 = (fl.p.x - h.p.x) ** 2 + (fl.p.y - h.p.y) ** 2 + (fl.p.z - h.p.z) ** 2; if (d2 < bd) { bd = d2; best = {}; } }
        for (const c of chutes) if (c.phase > 0) { const d2 = (c.p.x - h.p.x) ** 2 + (c.p.y - h.p.y) ** 2 + (c.p.z - h.p.z) ** 2; if (d2 < bd) { bd = d2; best = { c }; } }
        if (best) { h.lock = best; h.lockEnd = h.t + rnd(10, 18); }
      }
    }
    let T = h.lock ? lockTarget(h) : null; const w = h.wp[h.i], sp = Math.hypot(h.v.x, h.v.z);
    if (T && h.role !== 'scout' && Math.hypot(h.p.x - T.x, h.p.z - T.z) > 170) { h.lock = null; h.nextLock = h.t + 6; T = null; }   // it only holds a target that is near
    let tvx = 0, tvz = 0, ty = w.y;
    if (T) {   // follow: circle the target at a distance, nose on it
      h.orbA += (h.role === 'scout' ? 0.3 : 0.4) * dt; const rad = h.role === 'scout' ? 46 : 30, gx = T.x + Math.cos(h.orbA) * rad, gz = T.z + Math.sin(h.orbA) * rad, dx = gx - h.p.x, dz = gz - h.p.z, d = Math.hypot(dx, dz) || 1, vm = Math.min(16, d * 0.9 + 2);
      tvx = dx / d * vm; tvz = dz / d * vm; ty = Math.max(T.y + (h.role === 'scout' ? 24 : 18), clearY(gx, gz, 14)); h.yawGoal = Math.atan2(T.x - h.p.x, T.z - h.p.z);
    } else {
      const dx = w.x - h.p.x, dz = w.z - h.p.z, d = Math.hypot(dx, dz) || 1;
      if (h.role === 'fighter' && h.holding && w.hold) { h.drip -= dt; if (h.drip <= 0) { h.drip = 0.18; emitWater(h.p.x, h.p.y - 2, h.p.z, 5, 3); } if (h.hover > 9.5) ctx.sound?.event('splash', h.p); }
      if (h.holding) {   // hanging in the air: drifts a little, turns on the spot, and climbs or drops to the next leg's height
        h.hover -= dt; const nx = h.wp[h.i + 1]; ty = nx ? nx.y : w.y;
        tvx = Math.sin(h.t * 0.5) * 1.2; tvz = Math.cos(h.t * 0.4) * 1.2; h.yawGoal += Math.sin(h.t * 0.35) * 0.5 * dt;
        if (h.hover <= 0 && Math.abs(ty - h.p.y) < 1.5) { h.holding = false; h.i++; }
      } else {   // it brakes along a curve so it arrives slowly rather than stopping dead
        const vmax = w.hold ? Math.min(15, Math.sqrt(2 * 3 * Math.max(0, d - 4)) + 1) : 15;
        tvx = dx / d * vmax; tvz = dz / d * vmax;
        if (w.hold && d < 6 && sp < 4) { h.holding = true; h.hover = w.hold; }
        if (!w.hold && (Math.abs(h.p.x) > BX + 50 || Math.abs(h.p.z) > BZ + 50)) { clearHeli(h); return; }
      }
      if (sp > 3 && !h.holding) h.yawGoal = Math.atan2(h.v.x, h.v.z);
    }
    let wx = (tvx - h.v.x) * 0.8, wz = (tvz - h.v.z) * 0.8; const am = Math.hypot(wx, wz); if (am > 4) { wx *= 4 / am; wz *= 4 / am; }   // limited acceleration, which itself builds up smoothly
    const k = Math.min(1, dt * 1.6); h.ax += (wx - h.ax) * k; h.az += (wz - h.az) * k;
    const ax = h.ax, az = h.az; h.v.x += ax * dt; h.v.z += az * dt;
    const tvy = clamp((ty - h.p.y) * 0.5, -4, 4), wy = clamp((tvy - h.v.y) * 1.2, -2, 2); h.ay += (wy - h.ay) * k; h.v.y += h.ay * dt;
    h.p.addScaledVector(h.v, dt);
    const de = Math.atan2(Math.sin(h.yawGoal - h.yaw), Math.cos(h.yawGoal - h.yaw));
    h.yawRate += (clamp(de * 1.3, -0.7, 0.7) - h.yawRate) * Math.min(1, dt * 1.6); h.yaw += h.yawRate * dt;
    const fa = ax * Math.sin(h.yaw) + az * Math.cos(h.yaw), la = ax * Math.cos(h.yaw) - az * Math.sin(h.yaw);
    h.pitch += (clamp(fa * 0.06, -0.22, 0.28) + Math.sin(h.t * 0.6 + 1) * 0.02 - h.pitch) * Math.min(1, dt * 1.8);
    h.roll += (-clamp(la * 0.06, -0.3, 0.3) - h.yawRate * 0.35 + Math.sin(h.t * 0.85) * 0.035 - h.roll) * Math.min(1, dt * 1.8);
  }
  function drawHeli(h) {
    const g = h.g, f = clamp(Math.min(BX + 75 - Math.abs(h.p.x), BZ + 75 - Math.abs(h.p.z)) / 45, 0, 1); h.fade = f * f * (3 - 2 * f);
    g.position.set(h.p.x + Math.sin(h.t * 0.8) * 0.25, h.p.y + Math.sin(h.t * 1.3) * 0.45, h.p.z); g.rotation.set(h.pitch, h.yaw, h.roll);
    g.getObjectByName('rotor').rotation.y = h.rot; g.getObjectByName('tail').rotation.x = h.rot * 1.3;
    for (const e of g.userData.fade) { if (e.src) e.m.color.copy(e.src.color); e.m.opacity = h.fade; }
    // the search light: a pale cone from under the nose to a pool of light; on a target it holds there, otherwise it sweeps the ground ahead
    let T = h.lock ? lockTarget(h) : null;
    if (T && Math.hypot(h.p.x - T.x, h.p.z - T.z) > 140) T = null;   // the light only reaches so far
    if (T) h.aim.copy(T); else { const sweep = h.yaw + Math.sin(h.t * 0.45) * 0.9, reach = 22 + 12 * Math.sin(h.t * 0.31), gx = h.p.x + Math.sin(sweep) * reach, gz = h.p.z + Math.cos(sweep) * reach; h.aim.set(gx, topAt(gx, gz) + 0.2, gz); }
    if (!h.beam.visible) h.beamG.copy(h.aim); else h.beamG.lerp(h.aim, T ? 0.12 : 0.05);
    const onFire = !!(T && h.lock && h.lock.fire);
    beamD.copy(h.beamG).sub(g.position).add(fpos.set(0, 1.8, -2)); const L0 = beamD.length() || 1, L = T && !onFire ? Math.max(1, L0 - 4) : L0, rad = T ? 3.2 : 7;   // a beam on an object stops just short of it, so it never hides it
    h.beam.position.copy(g.position).addScaledVector(beamD, 0.5 * L / L0).add(fpos.set(0, -1.8, 2)); h.beam.quaternion.setFromUnitVectors(fpos.set(0, -1, 0), beamD.divideScalar(L0)); h.beam.scale.set(rad, L, rad);
    h.spot.position.copy(h.beamG); h.spot.scale.set(7, 1, 7);
    const on = h.fade > 0.02; h.beam.visible = on; h.spot.visible = on && (!T || onFire); h.glow.visible = false; h.lm.opacity = 0.1 * h.fade; h.sm.opacity = 0.3 * h.fade;
  }
  const beamD = new THREE.Vector3();

  function drawLife() {
    drawTraffic();
    for (let i = 0; i < NF; i++) {
      const o = fobj[i];
      if (o.dead > 0) fm.compose(fpos.set(0, -999, 0), fq.identity(), fsc.setScalar(0.001));
      else if (o.air) { fq.setFromEuler(fe.set(o.air.rot * 0.8, o.air.rot, o.air.rot * 0.4)); fm.compose(fpos.set(o.air.x, o.air.y, o.air.z), fq, fsc.setScalar(fs[i])); }
      else { fq.setFromAxisAngle(UP, Math.atan2(fvx[i], fvz[i]) + Math.sin(tick * 9 + fph[i]) * 0.22); fm.compose(fpos.set(fx[i], GROUND + 0.5, fz[i]), fq, fsc.setScalar(fs[i])); }
      fishMesh.setMatrixAt(i, fm);
    }
    fishMesh.instanceMatrix.needsUpdate = true;
    for (const b of boats) {
      if (!b.on) continue;
      const g = b.g, A = b.air;
      if (A) { g.position.set(A.x, A.y, A.z); g.rotation.set(A.rot * 0.5, b.yaw + A.rot, A.rot * 0.3); }
      else { g.position.set(b.x, GROUND + 0.3 + Math.sin(tick * 1.1 + b.off) * (b.big ? 0.06 : 0.12), b.z); g.rotation.set(0, b.yaw, Math.sin(tick * 0.9 + b.off) * (b.big ? 0.015 : 0.04)); if (b.sail) b.sail.rotation.y = Math.sin(tick * 0.6 + b.off) * 0.12 * (b.kind === 'pirate' ? 2 : 1); }
      const f = A ? 1 : clamp(Math.min(b.s - CL[BS0].s, CL[BS1].s - b.s) / 25, 0, 1);
      for (const e of g.userData.fade) { if (e.src) e.m.color.copy(e.src.color); e.m.opacity = f * f * (3 - 2 * f); }
    }
    for (const h of helis) if (h.on) drawHeli(h);
    camp.flame.scale.set(1, 0.85 + 0.35 * Math.sin(tick * 17) * Math.sin(tick * 9.3), 1);
    if (camp.g.visible) { const f = camp.f; for (const e of camp.g.userData.fade) { if (e.src) e.m.color.copy(e.src.color); e.m.opacity = f; } }
  }

  const S = { get windStr() { return windStr; }, wind, get tw() { return tw; }, fire, helis, get storms() { return SND.storms; } };
  const K = { boats, SEGS, HWYP, airStart, airStep, grabbed, PK, THREE, world, scene, camera, GROUND, BX, BZ, reduce: ctx.reduce, rnd, clamp, rand, box, figure, fadeable, solidMat, accentMat, milMat, edgeMat, bldMat, waterMat, terrainY, hillH, PEAKS, boxes, slots, CL, LAKE, CAMP, TOWERS, ISL, S, event: (n, p) => ctx.sound?.event(n, p), scatter, shake, makeSmoke, stepSmoke, fishGeo, fishMat, UP: new THREE.Vector3(0, 1, 0) };
  const EX = createExtras(K);

  // ── Rain and snow: once five storms are up they all rain, light blue; ordinary clouds over the mountains snow ─
  const RAIN = 1100, SNOW = 320;
  const SND = { wind: 1, gust: 0, rain: 0, storms: 0, tornado: 0, tx: 0, tz: 0, camp: 0, cx: CAMP.x, cz: CAMP.z, vis: null, helis: [{ p: null, fade: 1 }, { p: null, fade: 1 }], visFade: 1, fires: [{ x: 0, z: 0, l: 0 }, { x: 0, z: 0, l: 0 }, { x: 0, z: 0, l: 0 }], alarm: { x: 0, z: 0, l: 0 } };   // what the sound engine is told each frame
  const rainPos = new Float32Array(RAIN * 6).fill(-999), rx = new Float32Array(RAIN), ry = new Float32Array(RAIN).fill(-999), rz = new Float32Array(RAIN);
  const rainMat = new THREE.LineBasicMaterial({ color: 0x9ccaff, transparent: true, opacity: 0.75 });
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.LineSegments(rainGeo, rainMat); rain.frustumCulled = false; world.add(rain);
  const snowPos = new Float32Array(SNOW * 3).fill(-999), sx = new Float32Array(SNOW), sy = new Float32Array(SNOW).fill(-999), sz = new Float32Array(SNOW);
  const snowMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.9, transparent: true, opacity: 0.9, depthWrite: false });
  const snowGeo = new THREE.BufferGeometry(); snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  const snow = new THREE.Points(snowGeo, snowMat); snow.frustumCulled = false; world.add(snow);
  function clearWeather() { ry.fill(-999); sy.fill(-999); rainPos.fill(-999); snowPos.fill(-999); rainGeo.attributes.position.needsUpdate = true; snowGeo.attributes.position.needsUpdate = true; }
  function weatherStep(dt) {
    const S = [], M = [];
    for (const c of clouds) { if (c.storm) S.push(c); else if (terrainY(c.p.x, c.p.z) > GROUND + 4) M.push(c); }
    const rn = Math.floor(RAIN * clamp((S.length - 4) / 3, 0, 1)), sn = Math.min(SNOW, M.length * 110);
    SND.rain = rn / RAIN; SND.storms = S.length;
    for (let i = 0; i < RAIN; i++) {
      let y = ry[i];
      if (i >= rn) y = -999;
      else {
        if (y > -900) { y -= 38 * dt; rx[i] += wind.x * windStr * 5 * dt; rz[i] += wind.z * windStr * 5 * dt; if (y < topAt(rx[i], rz[i])) y = -999; }
        if (y < -900 && S.length) { const c = S[(Math.random() * S.length) | 0], r = 11 * c.sc * Math.sqrt(Math.random()), a = Math.random() * 6.283; rx[i] = c.p.x + Math.cos(a) * r; rz[i] = c.p.z + Math.sin(a) * r; y = c.p.y - 3 - Math.random() * 40; }
      }
      ry[i] = y; const o = i * 6;
      if (y < -900) { rainPos[o + 1] = rainPos[o + 4] = -999; } else { rainPos[o] = rx[i]; rainPos[o + 1] = y; rainPos[o + 2] = rz[i]; rainPos[o + 3] = rx[i] - wind.x * windStr * 0.3; rainPos[o + 4] = y + 2.4; rainPos[o + 5] = rz[i] - wind.z * windStr * 0.3; }
    }
    for (let i = 0; i < SNOW; i++) {
      let y = sy[i];
      if (i >= sn) y = -999;
      else {
        if (y > -900) { y -= 3.6 * dt; sx[i] += (wind.x * windStr * 2 + Math.sin(clock * 1.7 + i) * 0.9) * dt; sz[i] += (wind.z * windStr * 2 + Math.cos(clock * 1.3 + i) * 0.9) * dt; if (y < topAt(sx[i], sz[i]) + 0.2) y = -999; }
        if (y < -900 && M.length) { const c = M[(Math.random() * M.length) | 0], r = 10 * c.sc * Math.sqrt(Math.random()), a = Math.random() * 6.283; sx[i] = c.p.x + Math.cos(a) * r; sz[i] = c.p.z + Math.sin(a) * r; y = Math.max(c.p.y - 2 - Math.random() * 16, topAt(sx[i], sz[i]) + 1); }
      }
      sy[i] = y; snowPos[i * 3] = sx[i]; snowPos[i * 3 + 1] = y; snowPos[i * 3 + 2] = sz[i];
    }
    rainGeo.attributes.position.needsUpdate = true; snowGeo.attributes.position.needsUpdate = true;
  }

  // ── Wind: a breeze over the whole map, and gusts that sweep across it as fronts ─
  const BREEZE = 3.5, GUST_FORCE = 34, FRONT_W = 50, FRONT_SPEED = 16, STREAKS = 200;
  const gust = { on: false, s: 0, end: 0, tilt: 0, ph: 0 };   // s: where the front is, measured along the wind
  let breeze = BREEZE;
  function gustAt(x, z) {   // 0 to 1: how hard a gust blows at this spot
    if (!gust.on) return 0;
    const along = x * wind.x + z * wind.z, lat = x * wind.z - z * wind.x;
    // The front is slanted and wavy, so it reaches different places at different moments, and it blows in patches
    // rather than as an even wall.
    const front = gust.s + lat * gust.tilt + Math.sin(lat * 0.05 + gust.ph) * 40 + Math.sin(lat * 0.13 + gust.ph * 1.7) * 18 + Math.sin(lat * 0.31 + gust.ph * 2.3) * 8;
    const u = (along - front) / FRONT_W, patch = clamp(0.6 * Math.sin(lat * 0.045 + gust.ph * 0.6) + 0.5 * Math.sin(lat * 0.11 + gust.ph * 1.3) + 0.15, 0, 1);   // real gaps between gusty patches
    return Math.exp(-u * u) * patch * (0.85 + 0.15 * Math.sin(lat * 0.2 + clock * 1.1));
  }
  function startGust() {
    if (gust.on) return;
    const ext = Math.abs(wind.x) * BX + Math.abs(wind.z) * BZ + FRONT_W * 1.6 + 90;
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
      const i3 = i * 3, i6 = i * 6;
      let wx = wind.x, wz = wind.z;
      if (tw.on) {   // streaks near the funnel are swept round it, spiral up, and bend to follow the swirl
        const dx = sBase[i3] - tw.p.x, dz = sBase[i3 + 2] - tw.p.z, d = Math.hypot(dx, dz), R = TW_R * 1.7;
        if (d < R && d > 0.5) {
          const u = (1 - d / R) * tw.env, a = 3.4 * u * dt, ca = Math.cos(a), sa = Math.sin(a), k = (d - 3.5 * u * dt) / d;
          sBase[i3] = tw.p.x + (dx * ca - dz * sa) * k; sBase[i3 + 2] = tw.p.z + (dx * sa + dz * ca) * k; sBase[i3 + 1] += 16 * u * u * dt;
          if (sBase[i3 + 1] > BY) sBase[i3 + 1] = GROUND + 4;
          const m = clamp(u * 1.8, 0, 1); wx = wx * (1 - m) + (-dz / d) * m; wz = wz * (1 - m) + (dx / d) * m;
        }
      }
      const I = gustAt(sBase[i3], sBase[i3 + 2]), sp = (6 * windStr + 22 * I) * dt, len = 1.2 + 4 * I + 1.2 * windStr;
      sBase[i3] += wx * sp; sBase[i3 + 2] += wz * sp;
      if (sBase[i3] > BX) sBase[i3] -= 2 * BX; else if (sBase[i3] < -BX) sBase[i3] += 2 * BX;
      if (sBase[i3 + 2] > BZ) sBase[i3 + 2] -= 2 * BZ; else if (sBase[i3 + 2] < -BZ) sBase[i3 + 2] += 2 * BZ;
      const x = sBase[i3], y = sBase[i3 + 1], z = sBase[i3 + 2], a = 0.16 + 0.5 * I;
      sPos[i6] = x; sPos[i6 + 1] = y; sPos[i6 + 2] = z; sPos[i6 + 3] = x - wx * len; sPos[i6 + 4] = y; sPos[i6 + 5] = z - wz * len;
      for (let c = 0; c < 3; c++) { const b = bg3[c], t = tx3[c]; sCol[i6 + c] = b + (t - b) * a; sCol[i6 + 3 + c] = b + (t - b) * a * 0.15; }
    }
    streakGeo.attributes.position.needsUpdate = true; streakGeo.attributes.color.needsUpdate = true;
  }

  // ── Lightning: storm clouds (the dark ones) now and then strike the ground or a roof ─
  const boltMat = new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true });
  const flashC = new THREE.Color(1, 0.93, 0.62), UP = new THREE.Vector3(0, 1, 0), segGeo = new THREE.BoxGeometry(0.36, 1, 0.36);
  const strike = { on: false, t: 0, c: new THREE.Vector3(), a: new THREE.Vector3(), b: new THREE.Vector3(), group: null, flash: 0 };
  let flashed = false;
  function boxTop(x, z) { let y = GROUND; for (const b of boxes) if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) y = Math.max(y, b.y1); return y; }
  function topAt(x, z) { return Math.max(boxTop(x, z), terrainY(x, z)); }
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
  let shakeAmt = 0;
  function shake(a) { shakeAmt = Math.max(shakeAmt, a); }
  function scatter(x, y, z, R, k) {   // birds near a point bolt away from it
    const pos = ctx.pos, vel = ctx.vel;
    for (let i = 0, n = ctx.N; i < n; i++) {
      if (st[i]) continue;
      const i3 = i * 3, dx = pos[i3] - x, dy = pos[i3 + 1] - y, dz = pos[i3 + 2] - z, d = Math.hypot(dx, dy, dz);
      if (d < R) { const kk = P.spd * 1.3 * k * (1 - d / R) / (d || 1); vel[i3] += dx * kk; vel[i3 + 1] += (dy + 4) * kk; vel[i3 + 2] += dz * kk; }
    }
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
      if (d < 110) { const k = P.spd * 1.3 * (1 - d / 110) / (d || 1); vel[i3] += dx * k; vel[i3 + 1] += (dy - 6) * k; vel[i3 + 2] += dz * k; }
    }
    strike.group = bolt(strike.a, strike.b); scene.add(strike.group); strike.on = true; strike.t = 0; ctx.sound?.event('thunder', strike.b);
    if (!fire.on && fireOk(strike.b.x, strike.b.z) && Math.random() < 0.7) startFire(false, strike.b);   // lightning in the forest starts fires
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

  // ── Tornado: a rare funnel that crosses the open ground in front of the city under its own storm cloud.
  //    It spins, sucks in and lifts birds, drags clouds round, shoves visitors and canopies, tugs the hawk and
  //    curls the wind streaks. Buildings are left alone. ─
  const TW_R = 62, TW_H = 100, RINGS = 18, PTS = 320;
  const tw = { on: false, t: 0, env: 0, p: new THREE.Vector3(), dir: new THREE.Vector3(), speed: 7, lane: 0, end: 0 };
  const twMat = new THREE.MeshBasicMaterial({ color: 0x999999, transparent: true, opacity: 0.5, depthWrite: false });
  const twRings = [], twGroup = new THREE.Group(), ringGeo = new THREE.TorusGeometry(1, 0.07, 5, 28).rotateX(Math.PI / 2);
  for (let i = 0; i < RINGS; i++) { const m = new THREE.Mesh(ringGeo, twMat); m.frustumCulled = false; twRings.push(m); twGroup.add(m); }
  const twPos = new Float32Array(PTS * 3), twSeed = new Float32Array(PTS * 3);   // seed per speck: height 0..1, angle, radius jitter
  for (let i = 0; i < PTS; i++) { twSeed[i * 3] = Math.pow(Math.random(), 1.3); twSeed[i * 3 + 1] = rnd(0, 6.283); twSeed[i * 3 + 2] = rnd(0.7, 1.35); }
  const twPtsMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.15, sizeAttenuation: true, transparent: true, opacity: 0.8, depthWrite: false });
  const twPtsGeo = new THREE.BufferGeometry(); twPtsGeo.setAttribute('position', new THREE.BufferAttribute(twPos, 3));
  const twPoints = new THREE.Points(twPtsGeo, twPtsMat); twPoints.frustumCulled = false;
  const twCloudMat = stormMat.clone(), twCloud = MESH.cloud(twCloudMat); twCloud.scale.setScalar(2.6);
  const twR = yf => 2.8 + 21 * Math.pow(yf, 1.7);   // funnel radius up its height
  let nextTornado = 0;
  const stormCount = () => { let n = 0; for (const c of clouds) if (c.storm) n++; return n; };
  function startTornado() {
    if (tw.on) return;
    const sign = Math.random() < 0.5 ? -1 : 1, ext = BX + 50;   // the lane is mostly the open ground, sometimes out over the forest
    tw.dir.set(sign, 0, 0); tw.lane = Math.random() < 0.6 ? rnd(-6, 10) : rnd(110, 215); tw.speed = rnd(6, 9); tw.end = ext; tw.t = 0; tw.env = 0; tw.on = true;
    tw.p.set(-sign * ext, GROUND, tw.lane); scene.add(twGroup, twPoints, twCloud);
  }
  function clearTornado() { if (tw.on) scene.remove(twGroup, twPoints, twCloud); tw.on = false; tw.env = 0; }
  function stepTornado(dt) {
    if (!tw.on) return;
    tw.t += dt; tw.p.x += tw.dir.x * tw.speed * dt; tw.p.z = tw.lane + Math.sin(tw.t * 0.35) * 9;
    tw.env = edgeFade(Math.abs(tw.p.x), tw.end, 60);
    if (tw.t > 5 && Math.abs(tw.p.x) > tw.end) { clearTornado(); return; }
    // clouds are dragged round it
    for (const c of clouds) {
      const dx = c.p.x - tw.p.x, dz = c.p.z - tw.p.z, d = Math.hypot(dx, dz) || 1;
      if (d < 60) { const u = (1 - d / 60) * tw.env; c.p.x += (-dz / d * 10 - dx / d * 5) * u * dt; c.p.z += (dx / d * 10 - dz / d * 5) * u * dt; }
    }
    // a plane or blimp on its pass is shoved off line and bobbed
    if (fl.on) {
      const dx = fl.p.x - tw.p.x, dz = fl.p.z - tw.p.z, d = Math.hypot(dx, dz) || 1;
      if (d < 55) { const u = (1 - d / 55) * tw.env; fl.p.x += dx / d * 4 * u * dt; fl.p.z += dz / d * 4 * u * dt; fl.p.y += Math.sin(clock * 7) * 1.4 * u; }
    }
  }
  function twPush(p, dt, k) {   // displaces a point the way it would a hawk or a canopy; returns how hard it is in the pull
    const dx = p.x - tw.p.x, dz = p.z - tw.p.z, d = Math.hypot(dx, dz) || 1;
    if (!tw.on || d > TW_R) return 0;
    const u = (1 - d / TW_R) * tw.env;
    p.x += (-dz / d * 9 - (d > 6 ? dx / d * 5 : 0)) * u * k * dt; p.z += (dx / d * 9 - (d > 6 ? dz / d * 5 : 0)) * u * k * dt; p.y += 5 * u * k * dt;
    return u;
  }

  // ── Per-bird state: 0 flying, 1 landing, 2 perched ───────────────────
  let st = new Uint8Array(0), tgt = new Int16Array(0), leaveAt = new Float32Array(0), freeSlots = slots.length;
  let clock = 0, nextGust = 0, nextPass = 0, nextChute = 0, nextCloud = 0, nextStorm = 0, nextHawk = 0, nextFire = 0, nextHeli = 0, nextBoat = 0, nextStrike = 0, rt = new Float32Array(0), tint = new Float32Array(0);
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
    endHawk(); nextHawk = clock + rnd(40, 80); nextFire = clock + rnd(90, 200); nextHeli = clock + rnd(50, 110); nextBoat = clock + rnd(10, 40); nextGust = clock + rnd(10, 18); nextPass = clock + rnd(8, 16); nextChute = clock + rnd(25, 50); nextCloud = clock + rnd(4, 10); nextStrike = clock + rnd(15, 30); nextStorm = clock + rnd(60, 150); nextTornado = clock + 120;
  }
  function setModel(name) {
    api.model = name;
    const m = MODELS[name];
    UB.uAmp.value = m.amp; UB.uFreq.value = m.freq || 1;
    geoCache[name] ??= { geometry: build(name, true) };
    ctx.setLook(geoCache[name].geometry, birdMat);
  }

  // ── Hooks the engine calls ───────────────────────────────────────────
  // The flock splits into groups that each wander toward their own faraway place (forest, coast, mountains, city), now and then all gathering at one for a while.
  const NG = 5, gather = { t: rnd(200, 360), until: 0, x: 0, z: 0 };
  const roams = Array.from({ length: NG }, () => { const r = { x: rnd(-0.6, 0.6) * BX, y: rnd(-10, 25), z: rnd(-0.6, 0.7) * BZ, t: rnd(10, 60) }; r.tx = r.x; r.ty = r.y; r.tz = r.z; return r; });
  function pickRoam(r) { r.t = rnd(70, 150); r.tx = rnd(-0.85, 0.85) * BX; r.tz = rnd(-0.75, 0.9) * BZ; r.ty = rnd(-15, 30); if (clock < gather.until) { r.tx = gather.x + rnd(-40, 40); r.tz = gather.z + rnd(-40, 40); } }
  function stepRoam(dt) {
    gather.t -= dt; if (gather.t <= 0) { gather.t = rnd(300, 480); gather.until = clock + 75; gather.x = rnd(-0.6, 0.6) * BX; gather.z = rnd(-0.5, 0.7) * BZ; for (const r of roams) r.t = 0; }
    for (const r of roams) { r.t -= dt; if (r.t <= 0) pickRoam(r); const k = Math.min(1, dt * 0.03); r.x += (r.tx - r.x) * k; r.y += (r.ty - r.y) * k; r.z += (r.tz - r.z) * k; }
  }
  function before(dt) {
    clock += dt; if (!ctx.reduce) stepRoam(dt);
    if (fl.on) {
      fl.p.addScaledVector(fl.dir, fl.cfg.speed * dt); fl.p.y = fl.y0 + Math.sin(clock * 0.9) * (fl.cfg.drop > 1 ? BOB : 0);
      if (Math.abs(fl.p.x * fl.dir.x + fl.p.z * fl.dir.z) > fl.end) endPass();
    }
    if (fl.on && fl.jumpers > 0 && clock > fl.jumpAt && fl.p.z > -4 && Math.abs(fl.p.x) < BX * 0.85 && Math.abs(fl.p.z) < BZ * 0.85 && chutes.length < 18) {
      jumpFromPlane(); fl.jumpers--; fl.jumpAt = clock + 0.35;   // only over open ground, well clear of the skyline
    }
    if (fl.on && fl.kind === 'tanker' && fire.on && !fl.dropped && Math.hypot(fl.p.x - fire.x, fl.p.z - fire.z) < 12) {   // the water bomber lets go along its line
      fl.dropped = true; ctx.sound?.event('splash', fl.p);
      for (let k = 0; k < 12; k++) emitWater(fl.p.x + fl.dir.x * (k - 6) * 4, fl.p.y - 2, fl.p.z + fl.dir.z * (k - 6) * 4, 8, 3);
    }
    for (let i = chutes.length - 1; i >= 0; i--) if (stepChute(chutes[i], dt)) { scene.remove(chutes[i].g); chutes.splice(i, 1); }
    stepWind(dt); stepFish(dt); stepBoats(dt); stepCamp(dt); stepTraffic(dt); for (const h of helis) stepHeli(h, dt); stepFire(dt); stepPuffs(dt); EX.step(dt, clock, SND.storms < 2); EX.season(0.5 + 0.5 * Math.sin(clock * 0.004));
    breeze = BREEZE * windStr * (0.8 + 0.2 * Math.sin(clock * 0.07));
    if (gust.on) { gust.s += FRONT_SPEED * dt; if (gust.s > gust.end) gust.on = false; }
    stepStrike(dt); stepTornado(dt);
    for (let i = clouds.length - 1; i >= 0; i--) {
      const c = clouds[i]; c.age += dt;
      const ws = (7 * windStr + gustAt(c.p.x, c.p.z) * 16) * c.k;   // pushed by the wind; very little of their own
      c.p.x += (wind.x * ws + c.dr.x) * dt; c.p.z += (wind.z * ws + c.dr.y) * dt;
      if (Math.abs(c.p.x) > CX + 5 || Math.abs(c.p.z) > CZ + 5 || c.age > c.life + 20) { scene.remove(c.mesh); clouds.splice(i, 1); }
    }
    if (!ctx.reduce) {   // ambient weather (visitors, gusts, storms), off under reduced motion
      if (clock > nextFire && !fire.on) startFire(false);
      if (clock > nextHawk) { startHawk(); nextHawk = clock + rnd(80, 160); }
      if (clock > nextHeli) { if (helis.filter(h => h.on && h.role === 'scenic').length < 2) startHeli(); nextHeli = clock + rnd(50, 110); }
      if (clock > nextBoat) { { const r = Math.random(); startBoat(r < 0.12 ? 'pirate' : r < 0.3 ? 'ship' : 'sail'); } nextBoat = clock + rnd(25, 60); }
      if (clock > nextGust && windStr > 0.6) { startGust(); nextGust = clock + rnd(30, 55); }
      if (clock > nextPass) { launchPass(); nextPass = clock + rnd(28, 55); }
      // Clouds and storms breed: each spawn usually follows another soon after, then a long quiet. Bursts vary in length,
      // so most of the time there are a few, now and then the sky fills, and sometimes ten storms stack up and a tornado forms.
      if (clock > nextCloud && clouds.length < 60) { spawnCloud(false, false); nextCloud = clock + (Math.random() < 0.7 ? rnd(0.7, 2.2) : rnd(12, 30)); }
      const storms = stormCount();
      if (clock > nextStorm && storms < 12) { stormCell(); nextStorm = clock + rnd(160, 420); }
      if (storms >= 16 && !tw.on && clock > nextTornado) { startTornado(); nextTornado = clock + 300; }
      if (clock > nextStrike) { nextStrike = clock + (startStrike() ? rnd(25, 50) / clamp(Math.sqrt(storms), 1, 3.2) : 3); }
      if (clock > nextChute) { startChute(); nextChute = clock + rnd(45, 90); }
    }
    // Ambient perching: sample a few birds a step; any near a free roof edge may land.
    if (freeSlots === 0) return;
    const pos = ctx.pos;
    for (let s = 0; s < 8; s++) {
      const i = (Math.random() * ctx.N) | 0; if (st[i] || Math.random() > 0.3) continue;
      const i3 = i * 3, px = pos[i3], py = pos[i3 + 1], pz = pos[i3 + 2];
      let best = -1, bd = 36 * 36;
      for (let k = 0; k < slots.length; k++) {
        const sl = slots[k]; if (sl.taken || py < sl.y + 1.5) continue;
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
        st[i] = 2; leaveAt[i] = clock + rnd(5, 15); ctx.sound?.event('land', { x: pos[i3], y: pos[i3 + 1], z: pos[i3 + 2] }); flapAttr.array[i] = 0; flapAttr.needsUpdate = true;
        return;
      }
      const want = Math.min(P.spd, d * 1.8 + 2) / d, k = Math.min(1, dt * 4);
      vel[i3] += (dx * want - vel[i3]) * k; vel[i3 + 1] += (dy * want - vel[i3 + 1]) * k; vel[i3 + 2] += (dz * want - vel[i3 + 2]) * k;
      pos[i3] += vel[i3] * dt; pos[i3 + 1] += vel[i3 + 1] * dt; pos[i3 + 2] += vel[i3 + 2] * dt;
    } else if (st[i] === 2) {
      const h = (pos[i3] - hawk.p.x) ** 2 + (pos[i3 + 1] - hawk.p.y) ** 2 + (pos[i3 + 2] - hawk.p.z) ** 2;
      if (clock > leaveAt[i] || (hv.on && h < 30 * 30) || gustAt(pos[i3], pos[i3 + 2]) > 0.35 || (tw.on && tw.env > 0.3 && Math.hypot(pos[i3] - tw.p.x, pos[i3 + 2] - tw.p.z) < 30) || strikeDist(pos[i3], pos[i3 + 1], pos[i3 + 2]) < 20) takeOff(i);
    }
  }

  // Extra forces on a flying bird: buildings, the plane's path, wind.
  const PAD = 9;
  function force(i, px, py, pz, out) {
    let lvl = 0;   // how hard this bird is reacting to something big, 0 to 1, for the tint
    for (const b of boxes) {
      if (px < b.x0 - PAD || px > b.x1 + PAD || pz < b.z0 - PAD || pz > b.z1 + PAD || py > b.y1 + PAD) continue;   // cheap reject before the real distance
      let dx = px - clamp(px, b.x0, b.x1), dy = py - clamp(py, b.y0, b.y1), dz = pz - clamp(pz, b.z0, b.z1), d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= PAD * PAD) continue;
      if (d2 < 1e-6) { dy = 1; d2 = 1; }
      const d = Math.sqrt(d2), k = MAX_FORCE * 2.2 * (1 - d / PAD) / d;
      out[0] += dx * k; out[1] += dy * k; out[2] += dz * k;
    }
    for (const p of PEAKS) {   // mountains: pushed off the slope, outward and up
      const dx = px - p.x, dz = pz - p.z, d = Math.hypot(dx, dz);
      if (d >= p.r || py > GROUND + p.h + PAD) continue;
      const s = p.h / p.r, n = 1 / Math.sqrt(1 + s * s), gap = Math.max(0, (py - GROUND - p.h * (1 - d / p.r)) * n);
      if (gap >= PAD) continue;
      const k = MAX_FORCE * 2.2 * (1 - gap / PAD), o = d > 1e-3 ? s * n / d : 0;
      out[0] += dx * o * k; out[1] += n * k; out[2] += dz * o * k;
    }
    if (fl.on) {   // flee the line a visitor is on, well ahead of it
      const c = fl.cfg, rx = px - fl.p.x, ry = py - fl.p.y, rz = pz - fl.p.z, t = c.path ? clamp(rx * fl.dir.x + rz * fl.dir.z, -10, c.path) : 0;
      const ex = rx - fl.dir.x * t, ez = rz - fl.dir.z * t, d = Math.hypot(ex, ry, ez);
      if (d < c.R) { const u = 1 - d / c.R, k = MAX_FORCE * c.k * u ** 1.5 / (d || 1); out[0] += ex * k; out[1] += ry * k; out[2] += ez * k; lvl = Math.max(lvl, Math.min(1, u * c.k)); }
    }
    if (fire.on && fire.power > 0) for (const q of fire.spots) {   // the fire and its smoke
      if (q.power <= 0) continue;
      const dx = px - q.x, dz = pz - q.z, d = Math.hypot(dx, dz);
      if (d < 40) { const u = 1 - d / 40, k = MAX_FORCE * 1.5 * u / (d || 1); out[0] += dx * k; out[2] += dz * k; out[1] += 10 * u; lvl = Math.max(lvl, u * 0.8); }
    }
    { const FE = EX.fear; if (FE.t > 0) { const dx = px - FE.x, dy = py - FE.y, dz = pz - FE.z, d = Math.hypot(dx, dy, dz); if (d < 420) { const u = 1 - d / 420, k = MAX_FORCE * 3.4 * u * Math.min(1, FE.t / 3) / (d || 1); out[0] += dx * k; out[1] += dy * k * 0.5; out[2] += dz * k; lvl = Math.max(lvl, u); } } }   // fireworks terrify them
    for (const sp of EX.spheres) {   // balloons and the UFO
      const rx = px - sp.x, ry = py - sp.y, rz = pz - sp.z, d = Math.hypot(rx, ry, rz);
      if (d < sp.r + 14) { const u = 1 - d / (sp.r + 14), k = MAX_FORCE * 2 * u / (d || 1); out[0] += rx * k; out[1] += ry * k; out[2] += rz * k; lvl = Math.max(lvl, u); }
    }
    if (pz < -105) { const hh = GROUND + hillH(px, pz); if (hh > GROUND + 0.5) { const gap = py - hh; if (gap < PAD) out[1] += MAX_FORCE * 2.2 * (1 - Math.max(gap, 0) / PAD); } }
    for (const h of helis) if (h.on) {   // a helicopter is felt well around it
      const rx = px - h.p.x, ry = py - h.p.y, rz = pz - h.p.z, d = Math.hypot(rx, ry, rz);
      if (d < 65) { const u = 1 - d / 65, k = MAX_FORCE * 1.8 * u ** 1.5 / (d || 1); out[0] += rx * k; out[1] += ry * k; out[2] += rz * k; lvl = Math.max(lvl, Math.min(1, u * 1.8)); }
    }
    for (const c of chutes) if (c.phase > 0) {   // a light berth for parachutists
      const rx = px - c.p.x, ry = py - c.p.y - 3, rz = pz - c.p.z, d = Math.hypot(rx, ry, rz);
      if (d < 24) { const u = 1 - d / 24, k = MAX_FORCE * 0.9 * u * u / (d || 1); out[0] += rx * k; out[1] += ry * k; out[2] += rz * k; lvl = Math.max(lvl, u); }
    }
    for (const c of clouds) {
      const R = CLOUD_R * c.sc, rx = px - c.p.x, ry = py - c.p.y, rz = pz - c.p.z;
      if (rx > R || rx < -R || rz > R || rz < -R) continue;
      const d = Math.hypot(rx, ry, rz);
      if (d < R) { const u = 1 - d / R, k = MAX_FORCE * CLOUD_K * u ** 1.5 / (d || 1); out[0] += rx * k; out[1] += ry * k; out[2] += rz * k; lvl = Math.max(lvl, u * CLOUD_K); }
    }
    { const r = roams[i % NG], dx = r.x - px, dy = r.y - py, dz = r.z - pz, d = Math.hypot(dx, dy, dz); if (d > 60) { const k = MAX_FORCE * 0.5 * Math.min(1, (d - 60) / 250) / d; out[0] += dx * k; out[1] += dy * k * 0.4; out[2] += dz * k; } }   // each group's wandering centre
    out[0] += wind.x * breeze; out[2] += wind.z * breeze;   // the breeze moves everything, everywhere
    if (tw.on && tw.env > 0.02) {   // the tornado: spin, suck in, lift
      const dx = px - tw.p.x, dz = pz - tw.p.z, d2 = dx * dx + dz * dz;
      if (d2 < TW_R * TW_R) {
        const d = Math.sqrt(d2) + 1e-3, u = (1 - d / TW_R) * tw.env, yy = clamp((py - GROUND) / TW_H, 0, 1);
        const pull = d > 6 ? 40 : -14;   // strong enough to hold birds in orbit round the funnel rather than fling them clear
        out[0] += -dz / d * 34 * u - dx / d * pull * u; out[2] += dx / d * 34 * u - dz / d * pull * u; out[1] += 30 * u * (1 - yy * 0.6);
        lvl = Math.max(lvl, u);
      }
    }
    const I = gustAt(px, pz);
    if (I > 0.02) { const w = I * GUST_FORCE; out[0] += wind.x * w; out[2] += wind.z * w; out[1] += Math.sin(px * 0.15 + pz * 0.11 + clock * 2) * I * 10; lvl = Math.max(lvl, I); }
    if (strike.on && strike.t < 2.2) {   // and for a couple of seconds everything keeps moving away from the cloud
      const dx = px - strike.c.x, dy = py - strike.c.y, dz = pz - strike.c.z, d = Math.hypot(dx, dy, dz);
      if (d < 110) { const u = 1 - d / 110, k = MAX_FORCE * 3 * u * Math.max(0, 1 - strike.t / 2.2) / (d || 1); out[0] += dx * k; out[1] += (dy - 6) * k * 0.6; out[2] += dz * k; lvl = Math.max(lvl, u); }
    }
    const sd = strikeDist(px, py, pz);   // a strike scatters everything near the bolt
    if (sd < 45) {
      const u = 1 - sd / 45, k = MAX_FORCE * 3 * u * Math.max(0, 1 - strike.t / 1.5) / (sd || 1);
      out[0] += (px - strike.a.x) * k * 0.4; out[1] += 8 * u; out[2] += (pz - strike.a.z) * k * 0.4; lvl = Math.max(lvl, u);
    }
    rt[i] = lvl;
  }

  // ── The hawk: an occasional visitor. It flies in, chases the flock for a while, then leaves. ─
  const H = { yaw: 0, pitch: 0, roll: 0 };
  const hv = { on: false, t: 0, life: 0, leaving: false };
  function pushOut(p, pad, skip, ter = true) {
    if (ter) lift(p, pad);
    for (const b of boxes) {
      if (b === skip) continue;
      if (p.x < b.x0 - pad || p.x > b.x1 + pad || p.y < b.y0 - pad || p.y > b.y1 + pad || p.z < b.z0 - pad || p.z > b.z1 + pad) continue;
      // nearest face
      const ds = [p.x - (b.x0 - pad), (b.x1 + pad) - p.x, p.y - (b.y0 - pad), (b.y1 + pad) - p.y, p.z - (b.z0 - pad), (b.z1 + pad) - p.z];
      const k = ds.indexOf(Math.min(...ds));
      if (k === 0) p.x = b.x0 - pad; else if (k === 1) p.x = b.x1 + pad; else if (k === 2) p.y = b.y0 - pad; else if (k === 3) p.y = b.y1 + pad; else if (k === 4) p.z = b.z0 - pad; else p.z = b.z1 + pad;
    }
  }
  const hvec = new THREE.Vector3(), hOut = [0, 0, 0];
  function solids(px, py, pz, out) {   // a copy of the building, mountain and hill repulsion the birds feel
    for (const b of boxes) {
      if (px < b.x0 - PAD || px > b.x1 + PAD || pz < b.z0 - PAD || pz > b.z1 + PAD || py > b.y1 + PAD) continue;
      let dx = px - clamp(px, b.x0, b.x1), dy = py - clamp(py, b.y0, b.y1), dz = pz - clamp(pz, b.z0, b.z1), d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= PAD * PAD) continue;
      if (d2 < 1e-6) { dy = 1; d2 = 1; }
      const d = Math.sqrt(d2), k = MAX_FORCE * 2.2 * (1 - d / PAD) / d; out[0] += dx * k; out[1] += dy * k; out[2] += dz * k;
    }
    for (const p of PEAKS) {
      const dx = px - p.x, dz = pz - p.z, d = Math.hypot(dx, dz);
      if (d >= p.r + 4 || py > GROUND + p.h + PAD) continue;
      const s2 = p.h / p.r, n = 1 / Math.sqrt(1 + s2 * s2), gap = Math.max(0, (py - GROUND - p.h * (1 - Math.min(d, p.r) / p.r)) * n);
      if (gap >= PAD) continue;
      const k = MAX_FORCE * 2.2 * (1 - gap / PAD), o = d > 1e-3 ? s2 * n / d : 0; out[0] += dx * o * k; out[1] += n * k; out[2] += dz * o * k;
    }
  }
  function startHawk() {
    if (hv.on) return;
    const side = Math.random() < 0.5 ? -1 : 1, alongX = Math.random() < 0.6;
    hawk.p.set(alongX ? side * (BX + 30) : rnd(-BX, BX) * 0.7, rnd(0, 34), alongX ? rnd(-BZ, BZ) * 0.7 : side * (BZ + 30));
    hawk.v.set(alongX ? -side : 0, 0, alongX ? 0 : -side).multiplyScalar(P.spd); hawk.q.copy(hawk.p);
    hv.on = true; hv.t = 0; hv.life = rnd(30, 55); hv.leaving = false; UH.uAmp.value = 0.3; ctx.sound?.event('hawk', hawk.p);
  }
  function endHawk() { hv.on = false; hawk.p.set(0, 900, 0); hawk.q.copy(hawk.p); hawkMesh.visible = false; }
  function hawkStep(dt) {   // the engine calls this every step
    if (!hv.on) return;
    hv.t += dt;
    if (!hv.leaving && hv.t > hv.life) hv.leaving = true;
    const prevYaw = H.yaw;
    if (hv.leaving) {   // heads out through the nearest edge
      const alongX = Math.abs(hawk.p.x) / BX > Math.abs(hawk.p.z) / BZ;
      hvec.set(alongX ? Math.sign(hawk.p.x) || 1 : 0, 0.15, alongX ? 0 : Math.sign(hawk.p.z) || 1).multiplyScalar(P.spd * 1.3);
      hawk.v.lerp(hvec, Math.min(1, dt * 1.2)); hawk.p.addScaledVector(hawk.v, dt);
      if (Math.abs(hawk.p.x) > BX + 42 || Math.abs(hawk.p.z) > BZ + 42) { endHawk(); return; }
    } else ctx.aiHawk(dt);
    hOut[0] = hOut[1] = hOut[2] = 0; solids(hawk.p.x + hawk.v.x * 0.9, hawk.p.y + hawk.v.y * 0.9, hawk.p.z + hawk.v.z * 0.9, hOut); solids(hawk.p.x, hawk.p.y, hawk.p.z, hOut);   // looks ahead and steers clear
    hawk.v.x += hOut[0] * dt * 1.5; hawk.v.y += hOut[1] * dt * 1.5; hawk.v.z += hOut[2] * dt * 1.5; hawk.p.x += hOut[0] * dt * 0.3; hawk.p.y += hOut[1] * dt * 0.3; hawk.p.z += hOut[2] * dt * 0.3;
    pushOut(hawk.p, 2.5);
    { const ty = terrainY(hawk.p.x, hawk.p.z); if (hawk.p.z > 50 || ty > GROUND + 0.5) hawk.p.y = Math.max(hawk.p.y, ty + 17); }   // above the tree tops
    if (tw.on) { const u = twPush(hawk.p, dt, 0.8); if (u > 0) H.yaw += 0.5 * u * dt; }   // a moderate tug, a little spin
    hawk.p.y = clamp(hawk.p.y, GROUND + 2, BY + 8);
    const v = hawk.v, m = v.length() || 1;
    H.yaw = Math.atan2(v.x, v.z); H.pitch = Math.asin(clamp(v.y / m, -1, 1));
    H.roll += (clamp(Math.atan2(Math.sin(H.yaw - prevYaw), Math.cos(H.yaw - prevYaw)) / dt * 0.45, -0.9, 0.9) - H.roll) * Math.min(1, dt * 6);
  }

  // ── Per-frame drawing: hawk, camera, plane, streaks ──────────────────
  const hp = new THREE.Vector3(), eul = new THREE.Euler(0, 0, 0, 'YXZ'), cam = new THREE.Vector3(), look = new THREE.Vector3(), fwd = new THREE.Vector3(), tmp = new THREE.Vector3();
  let tick = 0, camReady = false;
  function draw(a, dt) {
    tick += dt; UB.uTime.value = tick; UH.uTime.value = tick;
    hp.lerpVectors(hawk.q, hawk.p, a);
    hawkMesh.position.copy(hp); hawkMesh.quaternion.setFromEuler(eul.set(-H.pitch, H.yaw, H.roll));
    hawkMesh.visible = hv.on;
    if (hv.on) hawkMat.opacity = clamp(Math.min(hv.t / 2, (Math.min(BX + 42 - Math.abs(hawk.p.x), BZ + 42 - Math.abs(hawk.p.z))) / 35), 0, 1);
    UBn.uTime.value = tick;
    if (fl.on) {
      fl.mesh.position.copy(fl.p); fl.mesh.scale.setScalar(fl.base);
      const fade = edgeFade(Math.abs(fl.p.x * fl.dir.x + fl.p.z * fl.dir.z), fl.end, fl.cfg.ext); fl.mesh.visible = fade > 0.01; SND.visFade = fade;   // fades away across the outer margin
      for (const e of fl.mesh.userData.fade) { if (e.src) e.m.color.copy(e.src.color); e.m.opacity = fade; }
      if (fl.kind === 'jetpack') { const f = fl.mesh.getObjectByName('flame'); f.scale.set(1, 0.8 + Math.random() * 0.6, 1); }
      if (fl.kind === 'glider') { fl.mesh.quaternion.setFromAxisAngle(yAxis, Math.atan2(fl.dir.x, fl.dir.z)).multiply(rollQ.setFromAxisAngle(zAxis, Math.sin(clock * 0.7) * 0.12)); }   // (setting rotation.z directly rolled it over whenever it flew toward -z)
    }
    for (const c of clouds) {
      c.mesh.position.copy(c.p); c.mat.color.copy(c.base.color); c.mat.emissive.copy(c.base.emissive);
      c.mat.opacity = c.base.opacity * cloudFade(c);
    }
    if (tw.on) {   // the funnel: spinning rings, specks, and its own storm cloud
      const e = tw.env;
      twMat.opacity = 0.55 * e; twPtsMat.opacity = 0.85 * e;
      for (let i = 0; i < RINGS; i++) {
        const yf = (i + 0.5) / RINGS, r = twR(yf) * (0.35 + 0.65 * e) * (1 + 0.12 * Math.sin(i * 2.3 + tick * 3)), m = twRings[i];
        m.position.set(tw.p.x + Math.sin(tick * 1.6 + yf * 5) * 3.2 * yf, GROUND + yf * TW_H, tw.p.z + Math.cos(tick * 1.3 + yf * 4) * 2.4 * yf);
        m.rotation.set(Math.sin(tick * 2 + i) * 0.12, tick * (3 - yf * 1.5) + i, 0); m.scale.set(r, r, r);
      }
      for (let i = 0; i < PTS; i++) {
        const yf = twSeed[i * 3], ang = twSeed[i * 3 + 1] + tick * (4.2 - yf * 2.2), r = (twR(yf) * (0.35 + 0.65 * e) + (yf < 0.08 ? 7 * (0.08 - yf) / 0.08 : 0)) * twSeed[i * 3 + 2];   // low specks spread out as dust
        twPos[i * 3] = tw.p.x + Math.sin(tick * 1.6 + yf * 5) * 3.2 * yf + Math.cos(ang) * r; twPos[i * 3 + 1] = GROUND + yf * TW_H + 0.5; twPos[i * 3 + 2] = tw.p.z + Math.cos(tick * 1.3 + yf * 4) * 2.4 * yf + Math.sin(ang) * r;
      }
      twPtsGeo.attributes.position.needsUpdate = true;
      twCloud.position.set(tw.p.x, GROUND + TW_H + 9, tw.p.z); twCloud.scale.setScalar(2.6 * (0.4 + 0.6 * e));
      twCloudMat.color.copy(stormMat.color); twCloudMat.emissive.copy(stormMat.emissive); twCloudMat.opacity = stormMat.opacity * e;
    }
    for (const c of chutes) {
      c.g.position.copy(c.p); c.canopy.scale.setScalar(Math.max(0.001, c.open));
      c.g.rotation.z = c.phase === 3 ? Math.sin(clock * 1.3 + c.sway) * 0.08 : 0; c.g.rotation.x = c.phase === 2 ? 0.5 : 0;
    }
    drawLife(); drawFire(); EX.draw(tick); weatherStep(dt); shakeAmt *= Math.exp(-dt * 3);
    SND.wind = windStr; SND.gust = gust.on ? 1 : 0; SND.tornado = tw.on ? tw.env : 0; SND.tx = tw.p.x; SND.tz = tw.p.z; SND.camp = camp.f; SND.vis = fl.on ? fl : null; { let n = 0; for (const h of helis) if (h.on && n < 2) { SND.helis[n].p = h.p; SND.helis[n].fade = h.fade; n++; } for (; n < 2; n++) SND.helis[n].p = null; }
    { const F = SND.fires; F[0].x = CAMP.x; F[0].z = CAMP.z; F[0].l = camp.f; F[1].x = ISL.x; F[1].z = ISL.z; F[1].l = hut.f; F[2].x = fire.x; F[2].z = fire.z; F[2].l = fire.on ? Math.max(0, fire.power) : 0; const AL = SND.alarm; AL.l = fire.on && fire.power > 0 ? 1 : 0; AL.x = TOWERS[fire.tower].x; AL.z = TOWERS[fire.tower].z; }
    ctx.sound?.update(SND, dt);
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
    twMat.color.copy(stormMat.color).multiplyScalar(2); twPtsMat.color.copy(text);
    groundMat.color.copy(bg).lerp(text, 0.07); rockC.copy(bg).lerp(text, 0.2); snowC.copy(bg).lerp(text, 0.78); for (const m of mtnMeshes) paint(m.geometry, m.userData.h, m.userData.snow);
    waterMat.color.copy(bg).lerp(WATER, 0.78); fishMat.color.copy(text); roadMat.color.copy(bg).lerp(text, 0.13); milMat.color.copy(text).lerp(bg, 0.55); for (const m of lightMats) m.color.copy(text); EX.theme(text, bg); fireDark.copy(bg).lerp(text, 0.16); fireSteam.copy(bg).lerp(text, 0.6); for (const p of puffs) p.m.material.color.copy(text).lerp(bg, 0.25); snowMat.color.copy(text); treeMat.color.copy(bg).lerp(text, 0.26); bldMat.color.copy(bg).lerp(text, 0.16); beaconOff.copy(beaconC).lerp(bg, 0.8); }

  const api = {
    st, model: 'bird', flying: false,
    // state 3 = held: pinned in place by the Hello. intro until freed
    recruit(i) { if (st[i] === 1 || st[i] === 2) { slots[tgt[i]].taken = false; freeSlots++; } st[i] = 3; flapAttr.array[i] = 1; flapAttr.needsUpdate = true; },
    free(i) { st[i] = 0; },
    blocked(x, y, z) { for (const b of boxes) if (x > b.x0 - 3 && x < b.x1 + 3 && y > b.y0 - 3 && y < b.y1 + 3 && z > b.z0 - 3 && z < b.z1 + 3) return true; return y < terrainY(x, z) + 3 && terrainY(x, z) > GROUND + 0.01; },   // inside or hugging a building
    get shake() { return shakeAmt; },
    surface: (x, z) => Math.max(terrainY(x, z), boxTop(x, z)),
    boxes, terrainY, PEAKS, dbg: { roams, EX, VEH, boats, camp, helis, fl, fobj, hut, fire, puffs, CL, SEGS, NF, fx, fz, fi, LO, HI, get tw() { return tw; } },   // for tests
    get hawkOn() { return hv.on; },
    spawn(k) {
      if (EX.spawn(k)) return; if (k === 'hawk') { startHawk(); return; } if (k === 'heli') { startHeli(); return; } if (k === 'scout') { startScout(); return; } if (k === 'boat') { startBoat('sail'); return; } if (k === 'ship') { startBoat('ship'); return; } if (k === 'pirate') { startBoat('pirate'); return; } if (k === 'fire') { startFire(true); return; }
      if (k === 'chute') startChute(); else if (k === 'cloud') spawnCloud(true, false); else if (k === 'storm') spawnCloud(true, true); else if (k === 'strike') startStrike(true); else if (k === 'gust') startGust(); else if (k === 'tornado') startTornado(); else if (k === 'storms') { for (let i = 0; i < 10; i++) spawnCloud(true, true); nextTornado = 0; }
      else { if (fl.on) endPass(); launchPass(k); }
    },   // for ?debug
    before, drive, force, hawk: hawkStep, draw, theme, reset, setModel,
    enable() {
      scene.add(world, hawkMesh);
      camera.fov = 50; camera.updateProjectionMatrix(); canvas.style.cursor = '';
      if (fl.on) endPass(); clearChutes(); clearStrike(); clearTornado(); gust.on = false; streaks.visible = !ctx.reduce; clearClouds(); initWind(); clearWeather(); for (let i = 0; i < 16; i++) spawnCloud(true, false);
      endHawk(); clearHelis(); for (const b of boats) endBoat(b); EX.clear();
      reset();
    },
    disable() {
      scene.remove(world, hawkMesh); clearWeather(); clearClouds(); clearChutes(); clearStrike(); clearTornado(); if (fl.on) endPass();
      ctx.birds.instanceColor = null;
      canvas.style.cursor = ''; endHawk(); clearHelis(); for (const b of boats) endBoat(b); EX.clear();
    }
  };
  return api;
}
