// Extras: the living landscape. The forest and what stands in it, wildlife, a yeti, a cable car, a train, balloons and sky events.
// skyline.js hands over a kernel (K) of shared helpers and live state; everything here is optional scenery on top of it.
export function createExtras(K) {
  const { THREE, world, camera, GROUND, BX, BZ, rnd, clamp, rand, box, figure, fadeable, solidMat, accentMat, milMat, edgeMat, bldMat, waterMat, terrainY, PEAKS, boxes, CL, LAKE, CAMP, TOWERS, ISL, S, event, scatter, shake, makeSmoke, stepSmoke, fishGeo, fishMat, UP, slots, airStart, airStep, grabbed } = K;
  const spheres = [];   // things birds keep clear of: {x, y, z, r}
  const live = [];      // per-frame hooks
  const col = hex => [(hex >> 16 & 255) / 255, (hex >> 8 & 255) / 255, (hex & 255) / 255];
  const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), m4 = new THREE.Matrix4(), v3 = new THREE.Vector3(), sc3 = new THREE.Vector3(), e3 = new THREE.Euler();

  // ── Where things may stand ─
  const SPOTS = [{ x: -190, z: 235, r: 24 }, { x: 230, z: 250, r: 11 }, { x: 100, z: 350, r: 9 }, { x: 130, z: 290, r: 15 }, { x: -150, z: 340, r: 15 }, { x: 60, z: 400, r: 15 }];
  const PONDS = [{ x: -35, z: 215, rx: 14, rz: 9 }, { x: 210, z: 330, rx: 16, rz: 11 }, { x: -230, z: 150, rx: 12, rz: 8 }];
  const inEll = (x, z, e, pad = 0) => ((x - e.x) / (e.rx + pad)) ** 2 + ((z - e.z) / (e.rz + pad)) ** 2 < 1;
  const lakeE = { x: LAKE.x, z: LAKE.z, rx: LAKE.rx * 1.2, rz: LAKE.rz * 1.2 };
  function nearRiver(x, z, pad) { for (const c of CL) if (Math.abs(c.x - x) < c.hw + pad && Math.abs(c.z - z) < c.hw + pad && Math.hypot(c.x - x, c.z - z) < c.hw + pad) return true; return false; }
  function okSpot(x, z, pad = 0) {
    if (terrainY(x, z) > GROUND + 0.01 || inEll(x, z, lakeE, 4 + pad)) return false;
    for (const p of PEAKS) if (Math.hypot(x - p.x, z - p.z) < p.r + 8 + pad) return false;   // clear of every mountain's foot
    for (const p of PONDS) if (inEll(x, z, p, 3 + pad)) return false;
    for (const s of SPOTS) if (Math.hypot(x - s.x, z - s.z) < s.r + pad) return false;
    for (const t of TOWERS) if (Math.hypot(x - t.x, z - t.z) < 7 + pad) return false;
    if (Math.hypot(x - CAMP.x, z - CAMP.z) < 8.5 + pad) return false;
    return !nearRiver(x, z, 4 + pad);
  }

  // ── Plants: pines, gums, grass trees, banksias and scrub, all low poly and a little different each ─
  const foliageMat = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, flatShading: true });
  function mergeG(parts) {
    const P = [], C = [];
    for (const { g, c } of parts) { const n = g.index ? g.toNonIndexed() : g, p = n.getAttribute('position'); for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); C.push(c[0], c[1], c[2]); } }
    const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); out.computeVertexNormals(); return out;
  }
  const PINE = mergeG([{ g: new THREE.CylinderGeometry(0.25, 0.35, 2, 5).translate(0, 1, 0), c: col(0x4a4a44) }, { g: new THREE.ConeGeometry(2, 4, 6).translate(0, 3.8, 0), c: col(0x5b605b) }, { g: new THREE.ConeGeometry(1.5, 3, 6).translate(0, 6, 0), c: col(0x696f69) }]);
  const GUM = mergeG([{ g: new THREE.CylinderGeometry(0.3, 0.45, 6.4, 5).translate(0, 3.2, 0), c: col(0xc8cabf) },
    ...[[0, 7.2, 0, 2.3], [1.7, 6.3, 0.6, 1.7], [-1.6, 6.7, -0.5, 1.8], [0.4, 8.4, 0.4, 1.5], [-0.5, 6.1, 1.5, 1.4]].map(([x, y, z, r]) => ({ g: new THREE.IcosahedronGeometry(r, 0).translate(x, y, z), c: col(0x70766e) }))]);
  const GRASSTREE = (() => {
    const parts = [{ g: new THREE.CylinderGeometry(0.35, 0.42, 2.2, 5).translate(0, 1.1, 0), c: col(0x2b2b28) }];
    for (let k = 0; k < 12; k++) { q1.setFromAxisAngle(UP, k * 0.52); q2.setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.8 + (k % 3) * 0.2); q1.multiply(q2); parts.push({ g: new THREE.ConeGeometry(0.1, 2.8, 3).translate(0, 1.4, 0).applyMatrix4(m4.makeRotationFromQuaternion(q1)).translate(0, 2.2, 0), c: col(0x80857a) }); }
    return mergeG(parts);
  })();
  const BANKSIA = mergeG([{ g: new THREE.CylinderGeometry(0.35, 0.5, 2.6, 5).translate(0, 1.3, 0), c: col(0x3a3a35) }, { g: new THREE.SphereGeometry(2.2, 7, 5).scale(1, 0.7, 1).translate(0, 3.6, 0), c: col(0x686e69) }]);
  const SCRUB = mergeG([{ g: new THREE.IcosahedronGeometry(0.9, 0).translate(0, 0.6, 0), c: col(0x676c63) }]);
  const KINDS = [[PINE, 0.5], [GUM, 0.28], [GRASSTREE, 0.08], [BANKSIA, 0.06], [SCRUB, 0.08]];
  let beachTintDone = false;
  const forest = KINDS.map(() => []);
  for (let tries = 0, total = 0; tries < 22000 && total < 4500; tries++) {
    const x = (rand() * 2 - 1) * 460, z = 54 + rand() * 420;
    if (!okSpot(x, z)) continue;
    let r = rand(), k = 0; for (; k < KINDS.length - 1; k++) { r -= KINDS[k][1]; if (r <= 0) break; }
    forest[k].push([x, z, k === 4 ? 0.7 + rand() * 0.9 : 0.75 + rand() * 0.8, 0.85 + rand() * 0.4, 0]); total++;
  }
  for (let k = 0; k < 11; k++) { const a = k / 11 * 6.283 + rand() * 0.4, r = 9.5 + rand() * 3.5, x = CAMP.x + Math.cos(a) * r, z = CAMP.z + Math.sin(a) * r; if (!inEll(x, z, lakeE, 2)) forest[k % 2].push([x, z, 0.8 + rand() * 0.8, 1, 0]); }   // trees close round the camp
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x666666, flatShading: true }), sandMat = new THREE.MeshLambertMaterial({ color: 0x999999 });

  // ── Landmarks that fill the gaps in the forest: a homestead with a windmill, a ranger hut, a radio mast, rock outcrops, billabongs ─
  const mills = [];
  {
    const H = SPOTS[0], y = GROUND;
    world.add(box(7, 3.4, 5, solidMat, H.x, y + 1.7, H.z), box(4, 2.6, 4, solidMat, H.x + 9, y + 1.3, H.z + 3), box(5.4, 0.3, 4, solidMat, H.x + 0.2, y + 3.5, H.z));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.6, 1.8, 4).rotateY(Math.PI / 4).scale(1.1, 1, 0.8), solidMat); roof.position.set(H.x, y + 4.3, H.z); world.add(roof);
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 3.2, 10), solidMat); tank.position.set(H.x - 6, y + 1.6, H.z - 3); world.add(tank);
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) world.add(box(0.25, 10, 0.25, solidMat, H.x - 10 + sx, y + 5, H.z + 6 + sz));
    const rotor = new THREE.Group(); rotor.position.set(H.x - 10, y + 10.5, H.z + 6); for (let k = 0; k < 6; k++) { const b = box(0.12, 3, 0.7, solidMat, 0, 1.5, 0); const arm = new THREE.Group(); arm.rotation.z = k * 1.047; arm.add(b); rotor.add(arm); } world.add(rotor); mills.push(rotor);
    boxes.push({ x0: H.x - 3.6, x1: H.x + 3.6, z0: H.z - 2.6, z1: H.z + 2.6, y0: y, y1: y + 4 });
    const R = SPOTS[1]; world.add(box(4.4, 2.6, 3.6, solidMat, R.x, y + 1.3, R.z), box(0.2, 7, 0.2, solidMat, R.x + 4, y + 3.5, R.z));
    const rr2 = new THREE.Mesh(new THREE.ConeGeometry(3.4, 1.6, 4).rotateY(Math.PI / 4), solidMat); rr2.position.set(R.x, y + 3.4, R.z); world.add(rr2);
    const M = SPOTS[2], mb = [], sq = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (const [sx, sz] of sq) world.add(box(0.3, 40, 0.3, solidMat, M.x + sx * 1.6, y + 20, M.z + sz * 1.6));
    for (let k = 0; k < 4; k++) { const [ax, az] = sq[k], [bx, bz] = sq[(k + 1) % 4]; for (let j = 0; j < 5; j++) { const y0 = j * 8, y1 = y0 + 8; mb.push(M.x + ax * 1.6, y + y0, M.z + az * 1.6, M.x + bx * 1.6, y + y1, M.z + bz * 1.6, M.x + bx * 1.6, y + y0, M.z + bz * 1.6, M.x + ax * 1.6, y + y1, M.z + az * 1.6); } }
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(mb), 3)); const ml = new THREE.LineSegments(mg, edgeMat); ml.frustumCulled = false; world.add(ml);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4a3d })); lamp.position.set(M.x, y + 41, M.z); world.add(lamp);
    boxes.push({ x0: M.x - 2, x1: M.x + 2, z0: M.z - 2, z1: M.z + 2, y0: y, y1: y + 42 });
    live.push((dt, t) => { lamp.visible = (t % 1.6) < 0.4; for (const r of mills) r.rotation.z += (0.6 + S.windStr * 3) * dt; });
    for (const o of SPOTS.slice(3)) for (let k = 0; k < 5; k++) { const r = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), rockMat), s = 2 + rand() * 3; r.scale.set(s, s * (0.6 + rand() * 0.5), s * (0.8 + rand() * 0.5)); r.position.set(o.x + rnd(-6, 6), y + s * 0.3, o.z + rnd(-6, 6)); r.rotation.set(rand() * 3, rand() * 3, rand() * 3); world.add(r); }
    for (const p of PONDS) {
      const N = 20, g = new THREE.CircleGeometry(1, N).rotateX(-Math.PI / 2), pos = g.getAttribute('position'), rim = new Float32Array(N * 3), wob = a => 1 + 0.1 * Math.sin(3 * a + p.x);
      for (let v = 0; v < pos.count; v++) { const px = pos.getX(v), pz = pos.getZ(v), r = wob(Math.atan2(pz, px)); pos.setXYZ(v, p.x + px * r * p.rx, y + 0.3, p.z + pz * r * p.rz); }
      g.computeVertexNormals(); const pm = new THREE.Mesh(g, waterMat); pm.frustumCulled = false; world.add(pm);
      for (let k = 0; k < N; k++) { const a = k / N * 6.2832, r = wob(a); rim.set([p.x + Math.cos(a) * r * p.rx, y + 0.33, p.z + Math.sin(a) * r * p.rz], k * 3); }
      const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rim, 3)); const rl = new THREE.LineLoop(rg, edgeMat); rl.frustumCulled = false; world.add(rl);
    }
  }

  // ── Fish in the lake ─
  const NLF = 18, lfx = new Float32Array(NLF), lfz = new Float32Array(NLF), lfvx = new Float32Array(NLF), lfvz = new Float32Array(NLF);
  for (let i = 0; i < NLF; i++) { const a = rnd(0, 6.28), r = rnd(0.2, 0.7); lfx[i] = LAKE.x + Math.cos(a) * LAKE.rx * r; lfz[i] = LAKE.z + Math.sin(a) * LAKE.rz * r; const b = rnd(0, 6.28); lfvx[i] = Math.cos(b) * 3; lfvz[i] = Math.sin(b) * 3; }
  const lakeFish = new THREE.InstancedMesh(fishGeo, fishMat, NLF); lakeFish.frustumCulled = false; world.add(lakeFish);
  live.push((dt, t) => {
    for (let i = 0; i < NLF; i++) {
      let ax = 0, az = 0, cx = 0, cz = 0, sx = 0, sz = 0, n = 0;
      for (let j = 0; j < NLF; j++) { if (j === i) continue; const dx = lfx[j] - lfx[i], dz = lfz[j] - lfz[i], d2 = dx * dx + dz * dz; if (d2 > 144) continue; n++; ax += lfvx[j]; az += lfvz[j]; cx += dx; cz += dz; if (d2 < 4) { sx -= dx / (d2 + 0.1); sz -= dz / (d2 + 0.1); } }
      let gx = (Math.random() - 0.5) * 3, gz = (Math.random() - 0.5) * 3;
      if (n) { gx += (ax / n - lfvx[i]) * 1.2 + cx / n * 0.5 + sx * 4; gz += (az / n - lfvz[i]) * 1.2 + cz / n * 0.5 + sz * 4; }
      const ux = (lfx[i] - LAKE.x) / (LAKE.rx * 0.85), uz = (lfz[i] - LAKE.z) / (LAKE.rz * 0.85), u = Math.hypot(ux, uz);
      if (u > 0.7) { gx -= ux / u * (u - 0.7) * 30; gz -= uz / u * (u - 0.7) * 30; }
      const ix = lfx[i] - ISL.x, iz = lfz[i] - ISL.z, id = Math.hypot(ix, iz);
      if (id < 14) { gx += ix / (id || 1) * (14 - id) * 2; gz += iz / (id || 1) * (14 - id) * 2; }
      lfvx[i] += gx * dt; lfvz[i] += gz * dt;
      const sp = Math.hypot(lfvx[i], lfvz[i]) || 1, w = clamp(sp, 2, 5.5) / sp; lfvx[i] *= w; lfvz[i] *= w; lfx[i] += lfvx[i] * dt; lfz[i] += lfvz[i] * dt;
      q1.setFromAxisAngle(UP, Math.atan2(lfvx[i], lfvz[i]) + Math.sin(t * 9 + i) * 0.22); lakeFish.setMatrixAt(i, m4.compose(v3.set(lfx[i], GROUND + 0.5, lfz[i]), q1, sc3.setScalar(1.1)));
    }
    lakeFish.instanceMatrix.needsUpdate = true;
  });

  // ── Wildlife: herds of kangaroos and groups of emus, grazing, moving between clearings, bolting from danger ─
  const roo = new THREE.MeshLambertMaterial({ color: 0x9a9a9a, flatShading: true }), emu = new THREE.MeshLambertMaterial({ color: 0x777777, flatShading: true });
  function makeRoo() {
    const g = new THREE.Group(), b = new THREE.Group(); g.add(b);
    b.add(box(0.8, 1.5, 1, roo, 0, 1.6, 0), box(0.45, 0.55, 0.75, roo, 0, 2.5, 0.55), box(0.12, 0.45, 0.1, roo, -0.15, 2.95, 0.4), box(0.12, 0.45, 0.1, roo, 0.15, 2.95, 0.4),
      box(0.3, 0.3, 1.9, roo, 0, 0.9, -1.2), box(0.3, 1.1, 0.8, roo, -0.32, 0.6, -0.1), box(0.3, 1.1, 0.8, roo, 0.32, 0.6, -0.1), box(0.12, 0.5, 0.12, roo, -0.3, 1.9, 0.6), box(0.12, 0.5, 0.12, roo, 0.3, 1.9, 0.6));
    return { g, b };
  }
  function makeEmu() {
    const g = new THREE.Group(), b = new THREE.Group(); g.add(b);
    const legL = box(0.14, 1.9, 0.14, emu, 0, -0.95, 0), legR = box(0.14, 1.9, 0.14, emu, 0, -0.95, 0), pl = new THREE.Group(), pr = new THREE.Group(); pl.position.set(-0.25, 1.9, 0); pr.position.set(0.25, 1.9, 0); pl.add(legL); pr.add(legR);
    b.add(box(0.9, 1.1, 1.8, emu, 0, 2.3, 0), box(0.18, 1.4, 0.18, emu, 0, 3.3, 0.7), box(0.3, 0.25, 0.5, emu, 0, 4.05, 0.9), box(0.6, 0.6, 0.7, emu, 0, 2.5, -1.1), pl, pr);
    return { g, b, pl, pr };
  }
  const herds = [];
  function addHerd(kind, n, x, z) {
    const h = { kind, x, z, tx: x, tz: z, mode: 'graze', t: rnd(3, 10), speed: kind === 'roo' ? 6 : 8, flee: 0, members: [] };
    for (let i = 0; i < n; i++) { const a = kind === 'roo' ? makeRoo() : makeEmu(); world.add(a.g); h.members.push({ ...a, ox: rnd(-5, 5), oz: rnd(-5, 5), x: x + rnd(-5, 5), z: z + rnd(-5, 5), yaw: rnd(0, 6.28), ph: rnd(0, 6.28), moving: false, dead: 0, abduct: 0 }); }
    herds.push(h); return h;
  }
  addHerd('roo', 4, -60, 170); addHerd('roo', 5, 160, 200); addHerd('roo', 4, -170, 270); addHerd('emu', 3, 30, 300); addHerd('emu', 3, -110, 190);
  function threat(h) {
    if (S.tw.on && Math.hypot(h.x - S.tw.p.x, h.z - S.tw.p.z) < 95) return [S.tw.p.x, S.tw.p.z];
    for (const f of S.fire.spots) if (f.power > 0 && Math.hypot(h.x - f.x, h.z - f.z) < 75) return [f.x, f.z];
    for (const hc of S.helis) if (hc.on && Math.hypot(h.x - hc.p.x, h.z - hc.p.z) < 70) return [hc.p.x, hc.p.z];
    if (yeti.on && Math.hypot(h.x - yeti.x, h.z - yeti.z) < 80) return [yeti.x, yeti.z];
    return null;
  }
  function stepHerds(dt, t) {
    for (const h of herds) {
      h.t -= dt; const th = threat(h);
      if (th && h.mode !== 'flee') { const dx = h.x - th[0], dz = h.z - th[1], d = Math.hypot(dx, dz) || 1; for (let k = 0; k < 12; k++) { const tx = h.x + dx / d * 70 + rnd(-30, 30), tz = h.z + dz / d * 70 + rnd(-30, 30); if (okSpot(tx, tz, -2) && tz > 60) { h.tx = tx; h.tz = tz; h.mode = 'flee'; h.flee = 6; break; } } }
      if (h.mode === 'graze' && h.t <= 0) { for (let k = 0; k < 14; k++) { const a = rnd(0, 6.28), r = rnd(30, 90), tx = h.x + Math.cos(a) * r, tz = h.z + Math.sin(a) * r; if (tz > 70 && tz < 440 && Math.abs(tx) < 440 && okSpot(tx, tz, -2)) { h.tx = tx; h.tz = tz; h.mode = 'move'; break; } } h.t = rnd(2, 6); }
      if (h.mode !== 'graze') {
        const dx = h.tx - h.x, dz = h.tz - h.z, d = Math.hypot(dx, dz), sp = h.speed * (h.mode === 'flee' ? 1.8 : 1) * dt;
        if (d < 3 || (h.mode === 'flee' && (h.flee -= dt) <= 0)) { h.mode = 'graze'; h.t = rnd(6, 16); } else if (okSpot(h.x + dx / d * sp * 3, h.z + dz / d * sp * 3, -2)) { h.x += dx / d * sp; h.z += dz / d * sp; } else { h.mode = 'graze'; h.t = rnd(1, 3); }
      }
      for (const m of h.members) {
        if (m.dead > 0) { m.dead -= dt; if (m.dead <= 0) { m.g.visible = true; m.x = h.x + m.ox; m.z = h.z + m.oz; m.abduct = 0; } continue; }
        if (m.abduct) continue;
        const dx = h.x + m.ox - m.x, dz = h.z + m.oz - m.z, d = Math.hypot(dx, dz);
        m.moving = d > 1.2 || h.mode !== 'graze';
        if (d > 0.6) { const sp = Math.min(d * 2, h.speed * (h.mode === 'flee' ? 1.9 : 1.15)) * dt; m.x += dx / d * sp; m.z += dz / d * sp; }
        if (d > 0.6) { let da = Math.atan2(dx, dz) - m.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); m.yaw += da * Math.min(1, dt * 6); }
        m.ph += dt * (m.moving ? (h.mode === 'flee' ? 11 : 8) : 2);
      }
    }
  }
  function drawHerds() {
    for (const h of herds) for (const m of h.members) {
      if (m.dead > 0) continue;
      const g = m.g; g.position.x = m.x; g.position.z = m.z; g.rotation.y = m.yaw;
      if (m.abduct) continue;
      g.position.y = GROUND;
      if (h.kind === 'roo') { m.b.position.y = m.moving ? Math.abs(Math.sin(m.ph)) * 1.2 : 0; m.b.rotation.x = m.moving ? -0.25 : Math.sin(m.ph) * 0.12; }
      else { m.b.position.y = m.moving ? Math.abs(Math.sin(m.ph * 2)) * 0.12 : 0; m.pl.rotation.x = m.moving ? Math.sin(m.ph * 2) * 0.9 : 0; m.pr.rotation.x = m.moving ? -Math.sin(m.ph * 2) * 0.9 : 0; m.b.rotation.x = m.moving ? 0.08 : Math.sin(m.ph) * 0.05; }
    }
  }

  // ── A UFO now and then takes a kangaroo ─
  const ufo = { on: false, t: 0, phase: 0, m: null, h: null, x: 0, y: 0, z: 0, next: rnd(500, 900) };
  const ufoG = new THREE.Group(); { const disc = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8).scale(7, 1.7, 7), milMat), dome = new THREE.Mesh(new THREE.SphereGeometry(3, 12, 8, 0, 6.283, 0, 1.571), solidMat); dome.position.y = 1.2; ufoG.add(disc, dome); for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283, l = new THREE.Mesh(new THREE.SphereGeometry(0.4, 6, 4), accentMat); l.position.set(Math.cos(a) * 6.4, 0, Math.sin(a) * 6.4); l.name = 'light' + k; ufoG.add(l); } ufoG.visible = false; world.add(ufoG); }
  const ufoBeamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const ufoBeam = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 18, 1, true), ufoBeamMat); ufoBeam.visible = false; ufoBeam.frustumCulled = false; world.add(ufoBeam);
  function startUfo() {
    if (ufo.on) return;
    const cands = []; for (const h of herds) if (h.kind === 'roo') for (const m of h.members) if (m.dead <= 0 && !m.abduct) cands.push([h, m]);
    if (!cands.length) return;
    [ufo.h, ufo.m] = cands[(Math.random() * cands.length) | 0]; ufo.on = true; ufo.phase = 0; ufo.t = 0; ufo.x = ufo.m.x + 320; ufo.z = ufo.m.z + rnd(-100, 100); ufo.y = 80; ufoG.visible = true; ufo.next = rnd(700, 1300); event('ufo', ufoG.position);
  }
  function stepUfo(dt) {
    if (!ufo.on) return; ufo.t += dt; const m = ufo.m;
    if (ufo.phase === 0) { ufo.x += (m.x - ufo.x) * Math.min(1, dt * 0.7); ufo.z += (m.z - ufo.z) * Math.min(1, dt * 0.7); ufo.y += (50 - ufo.y) * Math.min(1, dt * 0.8); if (Math.hypot(ufo.x - m.x, ufo.z - m.z) < 3) { ufo.phase = 1; ufo.t = 0; m.abduct = 1; } }
    else if (ufo.phase === 1) { ufo.x += (m.x - ufo.x) * dt; ufo.z += (m.z - ufo.z) * dt; m.g.position.y += 7 * dt; m.g.rotation.y += 3 * dt; m.g.rotation.z = Math.sin(ufo.t * 4) * 0.4; if (m.g.position.y > ufo.y - 4 || ufo.t > 10) { m.g.visible = false; m.g.rotation.z = 0; m.dead = rnd(60, 120); m.abduct = 0; ufo.phase = 2; ufo.t = 0; } }
    else { ufo.y += 40 * ufo.t * dt; ufo.x += 30 * dt * ufo.t; if (ufo.y > 400) { ufo.on = false; ufoG.visible = false; ufoBeam.visible = false; } }
  }
  function drawUfo(t) {
    if (!ufo.on) return;
    ufoG.position.set(ufo.x, ufo.y + Math.sin(t * 2) * 0.6, ufo.z); ufoG.rotation.y = t * 1.5; spheres.push({ x: ufo.x, y: ufo.y, z: ufo.z, r: 14 });
    for (let k = 0; k < 8; k++) ufoG.getObjectByName('light' + k).visible = ((t * 6 | 0) + k) % 2 === 0;
    ufoBeam.visible = ufo.phase === 1; if (ufoBeam.visible) { const L = ufo.y - GROUND; ufoBeam.position.set(ufo.x, GROUND + L / 2, ufo.z); ufoBeam.scale.set(8, L, 8); ufoBeam.rotation.x = Math.PI; }
  }

  // ── A yeti in a cave high up on the wall between two peaks of the long western range, well away from everything: it comes out rarely,
  //    walks down the slope into the canyon between the peaks and out into the forest, stomps about, and goes back up ─
  const cliffMatX = new THREE.MeshLambertMaterial({ color: 0x555555, flatShading: true });
  const WA = PEAKS[K.PK.crackA], WB = PEAKS[K.PK.crackB], cdx = WB.x - WA.x, cdz = WB.z - WA.z, cln = Math.hypot(cdx, cdz), ux = cdx / cln, uz = cdz / cln;
  let cax = -cdz / cln, caz = cdx / cln; if (caz < 0) { cax = -cax; caz = -caz; }   // along the canyon, pointing out toward the forest
  const CM = { x: (WA.x + WB.x) / 2, z: (WA.z + WB.z) / 2 }, RHO = 14, L1 = cln / 2 - RHO, OUT_S = 42;
  const cave = { x: WA.x + ux * RHO, z: WA.z + uz * RHO }; cave.y = terrainY(cave.x, cave.z);
  const yeti = { on: false, t: 0, phase: 0, x: 0, z: 0, p: 0, lat: 0, yaw: 0, next: rnd(500, 900), stompT: 0, g: null, parts: null };
  const yetiMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  { const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    const mk = (w, h, d, x, y, z) => box(w, h, d, yetiMat, x, y, z);
    const armL = new THREE.Group(), armR = new THREE.Group(), legL = new THREE.Group(), legR = new THREE.Group();
    armL.position.set(-2, 6, 0); armR.position.set(2, 6, 0); legL.position.set(-0.8, 3, 0); legR.position.set(0.8, 3, 0);
    armL.add(mk(1, 3.8, 1, 0, -1.9, 0)); armR.add(mk(1, 3.8, 1, 0, -1.9, 0)); legL.add(mk(1.2, 3, 1.3, 0, -1.5, 0)); legR.add(mk(1.2, 3, 1.3, 0, -1.5, 0));
    const face = box(1.2, 0.8, 0.2, new THREE.MeshLambertMaterial({ color: 0x222222, flatShading: true }), 0, 7.4, 1.05);
    body.add(mk(3.4, 4.2, 2.4, 0, 5, 0), mk(2.1, 2, 2, 0, 7.6, 0.2), mk(3.9, 1.4, 2.8, 0, 6.8, -0.1), face, armL, armR, legL, legR);
    g.visible = false; world.add(g); yeti.g = g; yeti.parts = { body, armL, armR, legL, legR };
  }
  { const m = new THREE.Mesh(new THREE.BoxGeometry(6, 6.5, 4), new THREE.MeshBasicMaterial({ color: 0x030303 })); m.position.set(cave.x + ux * 1.4, cave.y + 2.2, cave.z + uz * 1.4); m.rotation.y = Math.atan2(ux, uz);
    world.add(m); const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), edgeMat); e.position.copy(m.position); e.rotation.copy(m.rotation); world.add(e);
    const ledge = box(7, 0.8, 5, cliffMatX, cave.x + ux * 3, cave.y - 0.2, cave.z + uz * 3); ledge.rotation.y = Math.atan2(ux, uz); world.add(ledge); }
  const yetiPos = () => ({ x: yeti.x, y: terrainY(yeti.x, yeti.z), z: yeti.z });
  function startYeti() { if (yeti.on) return; yeti.on = true; yeti.phase = 0; yeti.t = 0; yeti.p = 0; yeti.lat = 0; yeti.g.visible = true; yeti.next = rnd(600, 1100); }
  function stepYeti(dt, t) {
    if (!yeti.on) return; yeti.t += dt;
    if (yeti.phase === 0) { yeti.p += 4 * dt; if (yeti.p >= L1 + OUT_S) { yeti.phase = 1; yeti.t = 0; yeti.stompT = 0.4; event('roar', yetiPos()); } }
    else if (yeti.phase === 1) {   // stomps about out in the open, roars, beats its chest
      yeti.lat = Math.sin(yeti.t * 0.5) * 12; yeti.p = L1 + OUT_S + Math.sin(yeti.t * 0.9) * 4; yeti.stompT -= dt;
      if (yeti.stompT <= 0) { yeti.stompT = 1.5; shake(1.1); scatter(yeti.x, terrainY(yeti.x, yeti.z) + 3, yeti.z, 90, 1.3); event('stomp', yetiPos()); }
      if (yeti.t > 20) yeti.phase = 2;
    } else { yeti.p -= 4 * dt; yeti.lat *= 0.98; if (yeti.p <= 0) { yeti.on = false; yeti.g.visible = false; } }
    if (yeti.p < L1) { yeti.x = cave.x + ux * yeti.p; yeti.z = cave.z + uz * yeti.p; yeti.yaw = Math.atan2(ux, uz) + (yeti.phase === 2 ? Math.PI : 0); }
    else { const s = yeti.p - L1; yeti.x = CM.x + cax * s - caz * yeti.lat; yeti.z = CM.z + caz * s + cax * yeti.lat; yeti.yaw = Math.atan2(cax, caz) + (yeti.phase === 2 ? Math.PI : 0); }
  }
  function drawYeti(t) {
    if (!yeti.on) return; const g = yeti.g, y = terrainY(yeti.x, yeti.z), P = yeti.parts, moving = yeti.phase !== 1, ph = t * 5;
    g.position.set(yeti.x, y, yeti.z); g.rotation.y = yeti.yaw;
    P.legL.rotation.x = moving ? Math.sin(ph) * 0.7 : (yeti.stompT > 1.1 ? -0.9 : 0); P.legR.rotation.x = moving ? -Math.sin(ph) * 0.7 : 0;
    P.armL.rotation.x = moving ? -Math.sin(ph) * 0.5 : (yeti.t % 6 < 2 ? -2.6 : 0.2 + Math.sin(t * 20) * (yeti.t % 6 < 3 ? 0.4 : 0)); P.armR.rotation.x = moving ? Math.sin(ph) * 0.5 : (yeti.t % 6 < 2 ? -2.6 : 0.2);
    P.body.position.y = moving ? Math.abs(Math.sin(ph)) * 0.25 : 0;
  }

  // ── A tiny climbing camp, tucked into a saddle between two eastern peaks well away from the town, that appears now and then ─
  const MC = { x: 93, z: 96, f: 0, on: false, t: rnd(40, 100) };
  const mcamp = new THREE.Group(), mcBase = terrainY(MC.x, MC.z);
  { const pad = new THREE.Mesh(new THREE.CylinderGeometry(5, 6.6, 2.6, 8), bldMat); pad.position.set(MC.x, mcBase - 0.7, MC.z); world.add(pad);
    mcamp.position.set(MC.x, mcBase + 0.6, MC.z); const tent = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2.8, 5).scale(1.2, 1, 1.2), solidMat); tent.position.y = 1.4; mcamp.add(tent, box(3.4, 0.4, 3.4, solidMat, 0, 0.2, 0));
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1, 5), accentMat); fl.position.set(3.2, 0.5, 1); fl.name = 'mflame'; mcamp.add(fl);
    const f = figure(solidMat); f.scale.setScalar(0.7); f.position.set(2.4, 0, 2.2); mcamp.add(f); mcamp.visible = false; world.add(fadeable(mcamp)); }
  const mcSmoke = makeSmoke(14, { color: 0xaaaaaa, size: 1.6, opacity: 0.45, rise: 2.5, life: 5 });
  function stepMountainCamp(dt, t) {
    MC.t -= dt; if (MC.t <= 0) { MC.on = !MC.on; MC.t = MC.on ? rnd(150, 240) : rnd(200, 400); }
    MC.f += ((MC.on ? 1 : 0) - MC.f) * Math.min(1, dt * 0.6); mcamp.visible = MC.f > 0.02;
    stepSmoke(mcSmoke, dt, MC.x + 3.2, mcBase + 1.8, MC.z + 1, MC.f);
    if (mcamp.visible) { for (const e of mcamp.userData.fade) { if (e.src) e.m.color.copy(e.src.color); e.m.opacity = MC.f; } mcamp.getObjectByName('mflame').scale.y = 0.8 + 0.4 * Math.sin(t * 15); }
  }

  // ── A cable car from the town on the east bank up to a station on the summit of the biggest eastern peak ─
  const cc = { u: 0, dir: 1, pause: 4, lower: null, upper: null, gs: [] };
  function buildCableCar() {
    const P = PEAKS[K.PK.cable];
    let lx = 62, lz = 42; for (const [x, z] of [[62, 42], [66, 46], [56, 46], [70, 40], [52, 48], [74, 44]]) if (terrainY(x, z) <= GROUND + 0.01 && !nearRiver(x, z, 14) && !boxes.some(b => x > b.x0 - 8 && x < b.x1 + 8 && z > b.z0 - 8 && z < b.z1 + 8)) { lx = x; lz = z; break; }
    const ux = P.x, uz = P.z, topY = GROUND + P.h;
    cc.lower = { x: lx, z: lz, y: GROUND + 5 }; cc.upper = { x: ux, z: uz, y: topY + 3.6 };
    world.add(box(4.4, 3.6, 4.4, solidMat, lx, GROUND + 1.8, lz), box(3.6, 2.4, 3.6, solidMat, ux, topY + 1.0, uz));
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.6, 2.4, 8), bldMat); pad.position.set(ux, topY - 0.6, uz); world.add(pad);
    boxes.push({ x0: lx - 2.5, x1: lx + 2.5, z0: lz - 2.5, z1: lz + 2.5, y0: GROUND, y1: GROUND + 4 }, { x0: ux - 2.2, x1: ux + 2.2, z0: uz - 2.2, z1: uz + 2.2, y0: topY - 1, y1: topY + 3 });
    const pts = [], N = 26, ln = Math.hypot(ux - lx, uz - lz), at = u => ({ x: lx + (ux - lx) * u, z: lz + (uz - lz) * u, y: cc.lower.y + (cc.upper.y - cc.lower.y) * u - 3 * 4 * u * (1 - u) });
    for (const off of [-1.1, 1.1]) for (let k = 0; k < N; k++) { const a = at(k / N), b = at((k + 1) / N), nx = -(uz - lz) / ln * off, nz = (ux - lx) / ln * off; pts.push(a.x + nx, a.y, a.z + nz, b.x + nx, b.y, b.z + nz); }
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3)); const cl = new THREE.LineSegments(cg, edgeMat); cl.frustumCulled = false; world.add(cl);
    for (const u of [0.28, 0.5, 0.72]) { const p = at(u), gy = terrainY(p.x, p.z), h = p.y - gy + 8; world.add(box(0.9, h, 0.9, solidMat, p.x, gy + h / 2 - 0.5, p.z), box(3.4, 0.3, 0.3, solidMat, p.x, p.y + 0.4, p.z), box(0.2, 1.6, 0.2, solidMat, p.x - 1.1, p.y - 0.4, p.z), box(0.2, 1.6, 0.2, solidMat, p.x + 1.1, p.y - 0.4, p.z)); }   // tall towers, the cable slung under their arms
    for (let k = 0; k < 2; k++) { const g = new THREE.Group(); g.add(box(2.4, 1.8, 2.2, solidMat, 0, -2.6, 0), box(0.12, 1.4, 0.12, solidMat, 0, -1.0, 0), box(1.8, 0.8, 0.1, milMat, 0, -2.5, 1.12)); world.add(g); cc.gs.push(g); }
    cc.at = at;
  }
  function stepCable(dt) {
    if (cc.pause > 0) { cc.pause -= dt; return; }
    cc.u += cc.dir * dt / 46; if (cc.u >= 1) { cc.u = 1; cc.dir = -1; cc.pause = 7; } else if (cc.u <= 0) { cc.u = 0; cc.dir = 1; cc.pause = 7; }
  }
  function drawCable(t) { const e = cc.u * cc.u * (3 - 2 * cc.u); [e, 1 - e].forEach((u, k) => { const p = cc.at(u), g = cc.gs[k]; g.position.set(p.x, p.y, p.z); g.rotation.z = Math.sin(t * 1.3 + k) * 0.05; }); }

  // ── A train along a rail line across the open ground, now and then. The roads cross it at level crossings with blinking signals; a tornado throws the carriages. ─
  let RAILZ = -14; { const clear = z => { if (boxes.some(b => b.z1 > z - 6 && b.z0 < z + 6 && b.y0 < 5)) return false; for (let x = -380; x <= 380; x += 5) if (terrainY(x, z) > GROUND + 0.01) return false; return true; }; for (const z of [-14, -13, -15, -12, -16, -11, -17, -10, -9, -18, -8, -20]) if (clear(z)) { RAILZ = z; break; } }
  const train = { on: false, x: 0, dir: 1, v: 16, next: rnd(60, 150), cars: [], derail: false };
  const crossings = [];
  {
    const rp = [], sl = [];
    for (const off of [-0.8, 0.8]) rp.push(-380, GROUND + 0.15, RAILZ + off, 380, GROUND + 0.15, RAILZ + off);
    for (let x = -380; x < 380; x += 3) sl.push(x, GROUND + 0.12, RAILZ - 1.4, x, GROUND + 0.12, RAILZ + 1.4);
    for (const a of [rp, sl]) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(a), 3)); const l = new THREE.LineSegments(g, edgeMat); l.frustumCulled = false; world.add(l); }
    for (const sg of K.SEGS) if (sg.dx === 0 && Math.min(sg.z0, sg.z1) < RAILZ - 2 && Math.max(sg.z0, sg.z1) > RAILZ + 2 && sg.cars) {   // a road crosses: boards, posts, and lamps
      const x = sg.x0; world.add(box(4.2, 0.06, 2.6, solidMat, x, GROUND + 0.2, RAILZ));
      const lamps = [];
      for (const sz of [-1, 1]) { const px = x + 3 * -sz, pz = RAILZ + 3.2 * sz; world.add(box(0.2, 3, 0.2, solidMat, px, GROUND + 1.5, pz)); const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4a3d })); lamp.position.set(px, GROUND + 3.2, pz); lamp.visible = false; world.add(lamp); lamps.push(lamp); }
      crossings.push({ x, lamps });
    }
    function carMesh(loco) {
      const g = new THREE.Group();
      if (loco) g.add(box(3, 3.4, 8, solidMat, 0, 2.2, 0), box(1.2, 1.6, 1.2, solidMat, 0, 4.7, 2.5), box(2.2, 1.4, 2.4, milMat, 0, 3.8, -2.6)); else g.add(box(3, 3, 10, solidMat, 0, 2, 0));
      g.visible = false; world.add(fadeable(g)); return g;
    }
    for (let k = 0; k < 6; k++) train.cars.push({ g: carMesh(k === 0), off: k === 0 ? 0 : 7 + k * 11.2 - 11.2 + 3.6, air: null, gone: false });
  }
  function startTrain() { if (train.on) return; train.on = true; train.derail = false; train.dir = Math.random() < 0.5 ? -1 : 1; train.x = -train.dir * 400; train.v = rnd(13, 19); for (const c of train.cars) { c.g.visible = true; c.air = null; c.gone = false; } train.next = rnd(150, 300); event('train', { x: train.x, y: GROUND, z: RAILZ }); }
  function stepTrain(dt) {
    if (!train.on) return;
    if (train.derail) {
      let any = false; for (const c of train.cars) { if (c.gone) continue; if (c.air && airStep(c, dt)) any = true; else { c.air = null; c.gone = true; c.g.visible = false; } }
      if (!any) { train.on = false; train.next = rnd(300, 600); } return;
    }
    train.x += train.dir * train.v * dt;
    for (const c of train.cars) { const cx = train.x - train.dir * c.off; if (grabbed(cx, RAILZ)) { train.derail = true; for (const q of train.cars) airStart(q, train.x - train.dir * q.off, GROUND + 1.5, RAILZ, q !== c); break; } }   // the tornado picks them all up
    if (Math.abs(train.x) > 600) { train.on = false; for (const c of train.cars) c.g.visible = false; }
  }
  function drawTrain(t) {
    for (const c of crossings) { const near = train.on && !train.derail && Math.abs(train.x - c.x) < 170; for (let i = 0; i < 2; i++) c.lamps[i].visible = near && ((t * 1.25 + i * 0.5) % 1) < 0.5; }
    if (!train.on) return;
    for (const c of train.cars) {
      if (c.gone) continue; const g = c.g;
      if (c.air) { g.position.set(c.air.x, c.air.y, c.air.z); g.rotation.set(c.air.rot * 0.7, c.air.rot, c.air.rot * 0.4); }
      else { const cx = train.x - train.dir * c.off; g.position.set(cx, GROUND, RAILZ); g.rotation.set(0, train.dir > 0 ? Math.PI / 2 : -Math.PI / 2, 0); }
      const px = c.air ? c.air.x : train.x, f = c.air ? 1 : clamp((BX + 150 - Math.abs(px)) / 90, 0, 1), s = f * f * (3 - 2 * f);
      for (const e of g.userData.fade) { if (e.src) e.m.color.copy(e.src.color); e.m.opacity = s; }
    }
  }

  // ── Hot-air balloons drifting with the wind ─
  const balloons = []; let nextBalloon = rnd(120, 300);
  function makeBalloon() {
    const g = new THREE.Group(), sg = new THREE.SphereGeometry(1, 16, 12), p = sg.getAttribute('position'), c = new Float32Array(p.count * 3), acc = col(0xff4a3d);
    for (let i = 0; i < p.count; i++) { const stripe = Math.floor((Math.atan2(p.getZ(i), p.getX(i)) + Math.PI) / (Math.PI * 2) * 10) % 2; const k = stripe ? acc : [0.92, 0.92, 0.92]; c.set(k, i * 3); }
    sg.setAttribute('color', new THREE.BufferAttribute(c, 3)); sg.scale(7, 8.5, 7);
    g.add(new THREE.Mesh(sg, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })), box(1.8, 1.3, 1.8, solidMat, 0, -11.5, 0));
    for (const [x, z] of [[-0.8, -0.8], [0.8, -0.8], [0.8, 0.8], [-0.8, 0.8]]) g.add(box(0.06, 3.8, 0.06, solidMat, x * 2, -9.2, z * 2));
    g.visible = false; world.add(fadeable(g)); return g;
  }
  function startBalloon() {
    if (balloons.length >= 2) return;
    const g = makeBalloon(), sp = new THREE.Vector3(), w = S.wind; sp.set(rnd(-BX, BX) * 0.6, rnd(42, 62), rnd(-BZ * 0.2, BZ * 0.9));
    sp.x -= w.x * (BX + 90); sp.z -= w.z * (BZ + 90); g.visible = true; balloons.push({ g, p: sp, ph: rnd(0, 6), burn: rnd(5, 12), sphere: { x: 0, y: 0, z: 0, r: 14 } });
  }
  function stepBalloons(dt, t) {
    for (let i = balloons.length - 1; i >= 0; i--) {
      const b = balloons[i]; b.p.x += S.wind.x * (3.5 * S.windStr + 0.4) * dt; b.p.z += S.wind.z * (3.5 * S.windStr + 0.4) * dt; b.p.y += Math.sin(t * 0.3 + b.ph) * 0.8 * dt; b.burn -= dt;
      if (b.burn <= 0) { b.burn = rnd(8, 16); event('burner', b.p); }
      if (Math.abs(b.p.x) > BX + 100 || Math.abs(b.p.z) > BZ + 100) { world.remove(b.g); balloons.splice(i, 1); }
    }
  }
  function drawBalloons(t) {
    for (const b of balloons) {
      const f = clamp(Math.min(BX + 100 - Math.abs(b.p.x), BZ + 100 - Math.abs(b.p.z)) / 50, 0, 1), s = f * f * (3 - 2 * f);
      b.g.position.copy(b.p); b.g.rotation.z = Math.sin(t * 0.5 + b.ph) * 0.03; for (const e of b.g.userData.fade) { if (e.src) e.m.color.copy(e.src.color); e.m.opacity = s; }
      b.sphere.x = b.p.x; b.sphere.y = b.p.y; b.sphere.z = b.p.z; spheres.push(b.sphere);
    }
  }

  // ── Shooting stars across the sky in front of the camera ─
  const stars = [];
  for (let i = 0; i < 3; i++) { const g = new THREE.BufferGeometry(), pos = new Float32Array(6); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const m = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), l = new THREE.LineSegments(g, m); l.frustumCulled = false; l.visible = false; world.add(l); stars.push({ l, m, g, pos, on: false, t: 0, p: new THREE.Vector3(), v: new THREE.Vector3() }); }
  let nextStar = rnd(10, 30);
  function startStar() {   // far off and high, just above the horizon, so it reads as part of the sky and never reaches the ground
    const s = stars.find(q => !q.on); if (!s) return;
    camera.getWorldDirection(v3); v3.y = 0; v3.normalize(); const fwd = v3.clone(), right = new THREE.Vector3().crossVectors(fwd, UP).normalize();
    s.p.copy(camera.position).addScaledVector(fwd, 2500).addScaledVector(right, rnd(-1200, 1200)); s.p.y = camera.position.y + 2500 * rnd(0.12, 0.3);
    s.v.copy(right).multiplyScalar((Math.random() < 0.5 ? -1 : 1) * rnd(500, 900)); s.v.y = -rnd(30, 90); s.on = true; s.t = 0; s.l.visible = true;
  }
  function stepStars(dt, st) {
    nextStar -= dt; if (nextStar <= 0 && st) { nextStar = rnd(20, 60); startStar(); }
    for (const s of stars) { if (!s.on) continue; s.t += dt; s.p.addScaledVector(s.v, dt); if (s.t > 1.6) { s.on = false; s.l.visible = false; continue; } s.pos.set([s.p.x, s.p.y, s.p.z, s.p.x - s.v.x * 0.22, s.p.y - s.v.y * 0.22, s.p.z - s.v.z * 0.22]); s.g.attributes.position.needsUpdate = true; s.m.opacity = Math.sin(Math.min(1, s.t / 1.6) * Math.PI); }
  }

  // ── Fireworks over the city, now and then ─
  const FW = 3, fireworks = [], fwc = [col(0xffffff), col(0xff4a3d), col(0xcfe3ff)];
  for (let i = 0; i < FW; i++) { const N = 70, pos = new Float32Array(N * 3).fill(-999), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const m = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }), p = new THREE.Points(g, m); p.frustumCulled = false; world.add(p); fireworks.push({ p, m, g, pos, vel: new Float32Array(N * 3), N, on: false, t: 0, x: 0, y: 0, z: 0, rise: 0 }); }
  const show = { on: false, left: 0, t: 0, next: rnd(240, 480) }, fear = { t: 0, x: 0, y: 0, z: 0 };
  function burst(f) {
    f.on = true; f.t = 0; f.rise = 1.1; f.x = rnd(-70, 70); f.z = rnd(-85, -35); f.y = rnd(55, 95); const c = fwc[(Math.random() * 3) | 0]; f.m.color.setRGB(c[0], c[1], c[2]);
    for (let i = 0; i < f.N; i++) { const a = rnd(0, 6.283), b = Math.acos(rnd(-1, 1)), s = rnd(12, 24); f.vel[i * 3] = Math.sin(b) * Math.cos(a) * s; f.vel[i * 3 + 1] = Math.cos(b) * s; f.vel[i * 3 + 2] = Math.sin(b) * Math.sin(a) * s; }
  }
  function stepFireworks(dt) {
    fear.t = Math.max(0, fear.t - dt);
    show.next -= dt; if (show.next <= 0 && !show.on) { show.on = true; show.left = 6 + ((Math.random() * 3) | 0); show.t = 0; show.next = rnd(360, 720); }
    if (show.on) { show.t -= dt; if (show.t <= 0 && show.left > 0) { const f = fireworks.find(q => !q.on); if (f) { burst(f); show.left--; show.t = rnd(1.2, 3); } } if (show.left <= 0 && !fireworks.some(q => q.on)) show.on = false; }
    for (const f of fireworks) {
      if (!f.on) continue; f.t += dt;
      if (f.t < f.rise) { const u = f.t / f.rise; f.pos.fill(-999); f.pos[0] = f.x; f.pos[1] = GROUND + (f.y - GROUND) * u; f.pos[2] = f.z; f.m.opacity = 1; }
      else {
        const a = f.t - f.rise; if (a === dt || !f.burst) { if (!f.burst) { f.burst = true; event('firework', { x: f.x, y: f.y, z: f.z }); scatter(f.x, f.y, f.z, 380, 3.2); fear.t = 12; fear.x = f.x; fear.y = f.y; fear.z = f.z; for (let i = 0; i < f.N; i++) { f.pos[i * 3] = f.x; f.pos[i * 3 + 1] = f.y; f.pos[i * 3 + 2] = f.z; } } }
        for (let i = 0; i < f.N; i++) { f.vel[i * 3 + 1] -= 9 * dt; f.vel[i * 3] *= 1 - dt * 0.9; f.vel[i * 3 + 2] *= 1 - dt * 0.9; f.pos[i * 3] += f.vel[i * 3] * dt; f.pos[i * 3 + 1] += f.vel[i * 3 + 1] * dt; f.pos[i * 3 + 2] += f.vel[i * 3 + 2] * dt; }
        f.m.opacity = clamp(1 - a / 2.4, 0, 1); if (a > 2.4) { f.on = false; f.burst = false; f.pos.fill(-999); f.m.opacity = 0; }
      }
      f.g.attributes.position.needsUpdate = true;
    }
  }

  // ── Behind the city: smooth farmland hills easing down to the sea, a wind farm, barns, a lighthouse, a harbour and ships ─
  const SEA = -352, turbines = [], farm = [];
  const hillMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  {
    const g = new THREE.PlaneGeometry(1040, 250, 130, 50).rotateX(-Math.PI / 2), p = g.getAttribute('position'), c = new Float32Array(p.count * 3), fcol = [col(0x3b3e3b), col(0x3d403d), col(0x404340), col(0x383b38), col(0x434643), col(0x3c3f3c)];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i) - 235, h = K.hillH(x, z), f = fcol[(((Math.floor((x + 600) / 70) * 7 + Math.floor((z + 600) / 55) * 3) % 6) + 6) % 6], t = clamp(h / 4, 0, 1);
      p.setY(i, h); c[i * 3] = 0.1 + (f[0] - 0.1) * t; c[i * 3 + 1] = 0.1 + (f[1] - 0.1) * t; c[i * 3 + 2] = 0.1 + (f[2] - 0.1) * t;
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.computeVertexNormals();
    const hills = new THREE.Mesh(g, hillMat); hills.position.set(0, GROUND + 0.02, -235); hills.frustumCulled = false; world.add(hills);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(2200, 720).rotateX(-Math.PI / 2), waterMat); sea.position.set(0, GROUND + 0.3, SEA - 360); sea.frustumCulled = false; world.add(sea);
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1100, GROUND + 0.33, SEA, 1100, GROUND + 0.33, SEA]), 3)); const sl = new THREE.LineSegments(sg, edgeMat); sl.frustumCulled = false; world.add(sl);
  }
  const hillSpots = [];   // keep trees off these
  {   // wind farm and barns on the hills
    const flatEnough = (x, z) => Math.abs(K.hillH(x + 6, z) - K.hillH(x - 6, z)) < 4 && Math.abs(K.hillH(x, z + 6) - K.hillH(x, z - 6)) < 4;
    for (let tries = 0; tries < 800 && turbines.length < 12; tries++) {
      const x = rnd(-420, 420), z = rnd(-300, -150), h = K.hillH(x, z); if (h < 14 || turbines.some(t => Math.hypot(t.x - x, t.z - z) < 70)) continue;
      const g = new THREE.Group(); g.position.set(x, GROUND + h, z); g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.1, 34, 8).translate(0, 17, 0), solidMat), box(1.8, 1.8, 4.4, solidMat, 0, 34.5, 0.4));
      const rotor = new THREE.Group(); rotor.position.set(0, 34.5, 2.7); for (let k = 0; k < 3; k++) { const arm = new THREE.Group(); arm.rotation.z = k * 2.094; arm.add(box(0.55, 15, 0.18, solidMat, 0, 7.5, 0)); rotor.add(arm); } g.add(rotor); g.rotation.y = rnd(0, 6.28); world.add(g);
      turbines.push({ x, z, rotor, ph: rnd(0, 6) }); hillSpots.push({ x, z, r: 14 });
    }
    for (let tries = 0; tries < 600 && farm.length < 7; tries++) {
      const x = rnd(-420, 420), z = rnd(-290, -135), h = K.hillH(x, z); if (h < 3 || !flatEnough(x, z) || farm.some(t => Math.hypot(t.x - x, t.z - z) < 90) || turbines.some(t => Math.hypot(t.x - x, t.z - z) < 30)) continue;
      const y = GROUND + h, g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rnd(0, 3);
      g.add(box(8, 4, 12, solidMat, 0, 2, 0), new THREE.Mesh(new THREE.ConeGeometry(7.6, 2.6, 4).rotateY(Math.PI / 4).scale(1, 1, 1.4), solidMat).translateY(5.3), new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 9, 9).translate(10, 4.5, 2), solidMat), new THREE.Mesh(new THREE.ConeGeometry(1.9, 1.4, 9).translate(10, 9.7, 2), solidMat));
      world.add(g); farm.push({ x, z }); hillSpots.push({ x, z, r: 16 });
    }
  }
  const LH = { x: -226, z: -452 };
  const beamPivot = new THREE.Group();
  {   // a striped lighthouse on a rock with a turning beam, and a harbour where the highway ends
    const y = GROUND, rk = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0).scale(12, 5, 12), rockMat); rk.position.set(LH.x, y + 1, LH.z); world.add(rk);
    for (let k = 0; k < 9; k++) { const u = k / 8, r = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), rockMat), s2 = 22 - u * 10 + rnd(-3, 3); r.scale.set(s2, 4 + rnd(0, 3), s2 * rnd(0.8, 1.1)); r.position.set(-235 + (LH.x + 235) * u + rnd(-5, 5), y + 0.4 + rnd(0, 1.5), -328 + (LH.z + 328) * u); r.rotation.y = rnd(0, 3); world.add(r); }   // a rocky peninsula reaching out to sea
    world.add(new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.6, 12, 10).translate(LH.x, y + 6, LH.z), solidMat), new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 12, 10).translate(LH.x, y + 18, LH.z), accentMat), new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.2, 10, 10).translate(LH.x, y + 29, LH.z), solidMat));
    world.add(box(5, 0.4, 5, solidMat, LH.x, y + 34.2, LH.z), box(2.4, 2.4, 2.4, milMat, LH.x, y + 35.6, LH.z));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2, 2, 8), accentMat); roof.position.set(LH.x, y + 38, LH.z); world.add(roof);
    const bm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    for (const s of [0, Math.PI]) { const b = new THREE.Mesh(new THREE.ConeGeometry(15, 280, 14, 1, true).translate(0, -140, 0).rotateZ(Math.PI / 2), bm); b.rotation.y = s; beamPivot.add(b); }
    beamPivot.position.set(LH.x, y + 35.6, LH.z); world.add(beamPivot); hillSpots.push({ x: LH.x, z: LH.z, r: 18 });
    boxes.push({ x0: LH.x - 3, x1: LH.x + 3, z0: LH.z - 3, z1: LH.z + 3, y0: y, y1: y + 40 });
    slots.push({ x: LH.x + 2.2, y: y + 34.8, z: LH.z + 2.2, b: {}, taken: false }, { x: LH.x - 2.2, y: y + 34.8, z: LH.z - 2.2, b: {}, taken: false });
    const hx = 330;   // harbour: a long pier, warehouses, cranes, where the highway ends
    world.add(box(6, 0.8, 80, solidMat, hx, y + 0.6, SEA - 36), box(18, 8, 10, solidMat, hx - 22, y + 4, SEA + 14), box(22, 7, 10, solidMat, hx + 24, y + 3.5, SEA + 18));
    for (const sx of [-1, 1]) { world.add(box(0.7, 26, 0.7, solidMat, hx + sx * 7, y + 13, SEA - 20)); } world.add(box(16, 0.8, 0.8, solidMat, hx, y + 26, SEA - 20), box(0.4, 10, 0.4, solidMat, hx + 5, y + 21, SEA - 20));
    for (let k = 0; k < 9; k++) world.add(box(5.4, 2.6, 2.4, k % 3 ? milMat : accentMat, hx - 14 + (k % 3) * 6, y + 1.3 + (k > 5 ? 2.6 : 0), SEA + 30 + Math.floor(k / 3) * 3));
    boxes.push({ x0: hx - 31, x1: hx - 13, z0: SEA + 9, z1: SEA + 19, y0: y, y1: y + 8 }, { x0: hx + 13, x1: hx + 35, z0: SEA + 13, z1: SEA + 23, y0: y, y1: y + 7 }); hillSpots.push({ x: hx, z: SEA + 15, r: 45 });
  }
  const cargo = [];
  for (const [dx, dz, ry] of [[12, -28, 0], [-12, -58, 0.05]]) { const g = new THREE.Group(); g.add(box(7, 3.5, 36, solidMat, 0, 1.75, 0), box(5, 6, 6, solidMat, 0, 6.5, -12)); for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) g.add(box(2.8, 2.6, 4.4, (i + j) % 3 === 0 ? accentMat : (i + j) % 2 ? milMat : solidMat, (j - 0.5) * 3, 4.8, 12 - i * 5)); g.position.set(330 + dx, GROUND + 0.1, SEA + dz); g.rotation.y = ry; world.add(g); }   // two ships tied up at the pier
  for (let n = 0; n < 3; n++) {
    const g = new THREE.Group(); g.add(box(7, 3.5, 36, solidMat, 0, 1.75, 0), box(5, 6, 6, solidMat, 0, 6.5, -12));
    for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) g.add(box(2.8, 2.6, 4.4, (i + j + n) % 3 === 0 ? accentMat : (i + j) % 2 ? milMat : solidMat, (j - 0.5) * 3, 4.8, 12 - i * 5));
    g.visible = false; world.add(fadeable(g)); cargo.push({ g, x: rnd(-400, 400), z: -410 - n * 55, dir: n % 2 ? 1 : -1, v: rnd(3, 5.5), wait: 0 });
  }
  {   // the western end of the coast: a beach with huts, umbrellas, a lifeguard tower, a jetty, boats pulled up, a cafe and people; the harbour is at the other end
    const bx = -330, y = GROUND;
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(260, 34).rotateX(-Math.PI / 2), sandMat); sand.position.set(bx, y + 0.1, SEA + 16); world.add(sand);
    for (let k = 0; k < 6; k++) { const x = bx - 95 + k * 36 + rnd(-4, 4), z = SEA + 9; world.add(box(3.4, 2.6, 3, solidMat, x, y + 1.4, z), box(3.7, 0.7, 3.3, k % 2 ? accentMat : milMat, x, y + 2.9, z)); }
    for (let k = 0; k < 10; k++) { const x = bx + rnd(-110, 110), z = SEA + rnd(14, 28); world.add(box(0.1, 2.4, 0.1, solidMat, x, y + 1.3, z)); const u = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.8, 8), k % 2 ? accentMat : solidMat); u.position.set(x, y + 2.7, z); world.add(u); if (k % 2 === 0) world.add(box(1.4, 0.15, 0.7, solidMat, x + 1.6, y + 0.25, z)); }
    const lx = bx + 60, lz = SEA + 20;   // lifeguard tower
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) world.add(box(0.2, 3.4, 0.2, solidMat, lx + sx * 1.2, y + 1.7, lz + sz * 1.2));
    world.add(box(3.4, 2.2, 3.4, solidMat, lx, y + 4.4, lz), box(0.1, 2.4, 0.1, solidMat, lx + 1.6, y + 6.6, lz), box(1.2, 0.8, 0.1, accentMat, lx + 2.2, y + 7.3, lz));
    world.add(box(3, 0.5, 46, solidMat, bx + 24, y + 0.7, SEA - 17)); for (let k = 0; k < 6; k++) for (const sx of [-1, 1]) world.add(box(0.25, 2, 0.25, solidMat, bx + 24 + sx * 1.3, y, SEA + 5 - k * 8));   // jetty
    for (const [x, z, r] of [[bx - 40, SEA + 6, 0.3], [bx + 80, SEA + 7, -0.4]]) { const b = new THREE.Group(); b.position.set(x, y, z); b.rotation.y = r; b.add(box(1.6, 0.7, 5, solidMat, 0, 0.5, 0), box(0.14, 5, 0.14, solidMat, 0, 3, 0.5)); world.add(b); }
    world.add(box(10, 4, 7, solidMat, bx - 125, y + 2, SEA + 22)); const cr = new THREE.Mesh(new THREE.ConeGeometry(8, 2.4, 4).rotateY(Math.PI / 4).scale(1.1, 1, 0.8), solidMat); cr.position.set(bx - 125, y + 5.2, SEA + 22); world.add(cr);
    for (let k = 0; k < 4; k++) world.add(box(1.6, 0.15, 1.6, solidMat, bx - 112 + k * 3, y + 1, SEA + 14), box(0.12, 1, 0.12, solidMat, bx - 112 + k * 3, y + 0.5, SEA + 14));
    for (let k = 0; k < 12; k++) { const f = figure(solidMat); f.scale.setScalar(0.62); f.position.set(bx + rnd(-115, 100), y + 0.1, SEA + rnd(10, 30)); f.rotation.y = rnd(0, 6.28); if (k % 3 === 0) { f.rotation.x = -Math.PI / 2; f.position.y = y + 0.35; } world.add(f); }
    for (let k = 0; k < 7; k++) { const t = new THREE.Mesh(PINE, foliageMat); t.position.set(bx + rnd(-125, 125), y, SEA + 33 + rnd(0, 6)); t.scale.setScalar(1.4 + rand() * 0.8); world.add(t); }   // norfolk pines along the back
    hillSpots.push({ x: bx, z: SEA + 18, r: 150 });
    boxes.push({ x0: bx - 130, x1: bx - 120, z0: SEA + 18, z1: SEA + 26, y0: y, y1: y + 6 });
  }
  live.push((dt, t) => {
    for (const w of turbines) w.rotor.rotation.z += (0.5 + S.windStr * 1.8) * dt;
    beamPivot.rotation.y = t * 0.2;
    for (const s of cargo) {
      if (s.wait > 0) { s.wait -= dt; s.g.visible = false; if (s.wait <= 0) s.x = -s.dir * 520; continue; }
      s.x += s.dir * s.v * dt; if (Math.abs(s.x) > 540) { s.wait = rnd(20, 90); continue; }
      const f = clamp((480 - Math.abs(s.x)) / 100, 0, 1), o = f * f * (3 - 2 * f); s.g.visible = o > 0.01; s.g.position.set(s.x, GROUND + 0.1, s.z); s.g.rotation.y = s.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      for (const e of s.g.userData.fade) { if (e.src) e.m.color.copy(e.src.color); e.m.opacity = o; }
    }
  });
  // ── Farms: fenced paddocks with a barn and silo, sheep, cattle and dogs that run round the sheep ─
  const animalMat = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, flatShading: true });
  const legs4 = (w, h, x, z, c) => [[-x, -z], [x, -z], [-x, z], [x, z]].map(([a, b]) => ({ g: new THREE.BoxGeometry(w, h, w).translate(a, h / 2, b), c }));
  const SHEEP = mergeG([{ g: new THREE.BoxGeometry(1.1, 0.9, 1.5).translate(0, 0.85, 0), c: col(0xdadad4) }, { g: new THREE.BoxGeometry(0.45, 0.5, 0.55).translate(0, 1.05, 0.95), c: col(0x3a3a38) }, ...legs4(0.18, 0.5, 0.35, 0.5, col(0x3a3a38))]);
  const COW = mergeG([{ g: new THREE.BoxGeometry(1.5, 1.3, 3).translate(0, 1.7, 0), c: col(0x8c8c88) }, { g: new THREE.BoxGeometry(0.7, 0.55, 1.1).translate(0.3, 2.37, -0.2), c: col(0x2c2c2c) }, { g: new THREE.BoxGeometry(0.8, 0.8, 0.9).translate(0, 2.0, 1.9), c: col(0x8c8c88) }, ...legs4(0.28, 1.05, 0.5, 1.0, col(0x333333))]);
  const DOG = mergeG([{ g: new THREE.BoxGeometry(0.5, 0.5, 1.1).translate(0, 0.75, 0), c: col(0x2c2c2c) }, { g: new THREE.BoxGeometry(0.38, 0.4, 0.45).translate(0, 0.95, 0.72), c: col(0x2c2c2c) }, { g: new THREE.BoxGeometry(0.12, 0.12, 0.6).translate(0, 0.9, -0.8), c: col(0xdadad4) }, ...legs4(0.12, 0.5, 0.17, 0.4, col(0x2c2c2c))]);
  const pads = [], beasts = [];
  function fence(cx, cz, w, d, yfn) {
    const pts = [], per = [[cx - w / 2, cz - d / 2], [cx + w / 2, cz - d / 2], [cx + w / 2, cz + d / 2], [cx - w / 2, cz + d / 2]];
    for (let e = 0; e < 4; e++) {
      const [x0, z0] = per[e], [x1, z1] = per[(e + 1) % 4], n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 5);
      for (let k = 0; k < n; k++) { const xa = x0 + (x1 - x0) * k / n, za = z0 + (z1 - z0) * k / n, xb = x0 + (x1 - x0) * (k + 1) / n, zb = z0 + (z1 - z0) * (k + 1) / n, ya = yfn(xa, za) + 0.05, yb = yfn(xb, zb) + 0.05; pts.push(xa, ya, za, xa, ya + 1.6, za, xa, ya + 0.7, za, xb, yb + 0.7, zb, xa, ya + 1.4, za, xb, yb + 1.4, zb); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3)); const l = new THREE.LineSegments(g, edgeMat); l.frustumCulled = false; world.add(l);
  }
  function barn(x, z, y, rot) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot;
    g.add(box(8, 4, 12, solidMat, 0, 2, 0), new THREE.Mesh(new THREE.ConeGeometry(7.6, 2.6, 4).rotateY(Math.PI / 4).scale(1, 1, 1.4), solidMat).translateY(5.3), new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 9, 9).translate(10, 4.5, 2), solidMat), new THREE.Mesh(new THREE.ConeGeometry(1.9, 1.4, 9).translate(10, 9.7, 2), solidMat));
    world.add(g);
  }
  function addPad(cx, cz, sheep, cattle, dog, hill, barnAt) {
    const pad = { cx, cz, w: 60, d: 44, hill, y: hill ? (x, z) => GROUND + K.hillH(x, z) : () => GROUND, sx: cx, sz: cz }; pads.push(pad); fence(cx, cz, pad.w, pad.d, pad.y);
    if (barnAt) barn(barnAt.x, barnAt.z, pad.y(barnAt.x, barnAt.z), 0.3);
    const add = (kind, n) => { for (let i = 0; i < n; i++) beasts.push({ kind, pad, x: cx + rnd(-pad.w / 2 + 5, pad.w / 2 - 5), z: cz + rnd(-pad.d / 2 + 5, pad.d / 2 - 5), tx: cx, tz: cz, yaw: rnd(0, 6.28), t: rnd(0, 6), ph: rnd(0, 6), moving: false, a: rnd(0, 6.28) }); };
    add('sheep', sheep); add('cow', cattle); add('dog', dog); return pad;
  }
  function placeFarms(hillFarms) {
    hillFarms.slice(0, 3).forEach((f, i) => { const sheepN = [14, 0, 12][i], cowN = [0, 8, 4][i]; addPad(f.x + 36, f.z, sheepN, cowN, sheepN ? 1 : 0, true, null); hillSpots.push({ x: f.x + 36, z: f.z, r: 44 }); });
  }
  function finishFarms() {
    const NS = beasts.filter(b => b.kind === 'sheep').length, NC = beasts.filter(b => b.kind === 'cow').length, ND = beasts.filter(b => b.kind === 'dog').length;
    const mk = (geo, n) => { const im = new THREE.InstancedMesh(geo, animalMat, Math.max(1, n)); im.count = n; im.frustumCulled = false; world.add(im); return im; };
    return { sheep: mk(SHEEP, NS), cow: mk(COW, NC), dog: mk(DOG, ND) };
  }
  let farmMeshes = null;
  function stepFarms(dt) {
    for (const p of pads) { let sx = 0, sz = 0, n = 0; for (const b of beasts) if (b.pad === p && b.kind === 'sheep') { sx += b.x; sz += b.z; n++; } if (n) { p.sx = sx / n; p.sz = sz / n; } }
    const dogs = beasts.filter(b => b.kind === 'dog');
    for (const b of beasts) {
      const p = b.pad, hw = p.w / 2 - 3, hd = p.d / 2 - 3; b.t -= dt;
      if (b.kind === 'dog') {   // runs a wide circle round the flock
        b.a += dt * 0.45; b.tx = clamp(p.sx + Math.cos(b.a) * 11, p.cx - hw, p.cx + hw); b.tz = clamp(p.sz + Math.sin(b.a) * 11, p.cz - hd, p.cz + hd); b.moving = true;
      } else {
        const dog = dogs.find(q => q.pad === p), near = b.kind === 'sheep' && dog && Math.hypot(dog.x - b.x, dog.z - b.z) < 16;
        if (near) { b.tx = clamp(p.sx + rnd(-4, 4), p.cx - hw, p.cx + hw); b.tz = clamp(p.sz + rnd(-4, 4), p.cz - hd, p.cz + hd); b.t = 1; b.moving = true; }
        else if (b.t <= 0) { b.tx = p.cx + rnd(-hw, hw); b.tz = p.cz + rnd(-hd, hd); b.t = rnd(5, 14); b.moving = Math.random() < 0.6; }
      }
      const dx = b.tx - b.x, dz = b.tz - b.z, d = Math.hypot(dx, dz);
      if (b.moving && d > 0.8) { const sp = (b.kind === 'dog' ? 6 : b.kind === 'cow' ? 0.8 : (b.t <= 1.05 && b.t > 0.9 ? 3 : 1.3)) * dt; b.x += dx / d * sp; b.z += dz / d * sp; let da = Math.atan2(dx, dz) - b.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); b.yaw += da * Math.min(1, dt * 4); b.ph += dt * (b.kind === 'dog' ? 14 : 6); } else b.moving = false;
    }
  }
  function drawFarms() {
    farmMeshes ??= finishFarms();
    const idx = { sheep: 0, cow: 0, dog: 0 };
    for (const b of beasts) {
      const y = b.pad.y(b.x, b.z) + (b.moving ? Math.abs(Math.sin(b.ph)) * (b.kind === 'dog' ? 0.25 : 0.08) : 0);
      q1.setFromAxisAngle(UP, b.yaw); farmMeshes[b.kind].setMatrixAt(idx[b.kind]++, m4.compose(v3.set(b.x, y, b.z), q1, sc3.set(1, 1, 1)));
    }
    for (const k in farmMeshes) farmMeshes[k].instanceMatrix.needsUpdate = true;
  }

  placeFarms(farm);
  // a sprinkling of trees on the hills
  for (let tries = 0, n = 0; tries < 2400 && n < 650; tries++) {
    const x = rnd(-470, 470), z = rnd(-340, -118), h = K.hillH(x, z);
    if (h < 0.5 || Math.abs(x - 48) < 14 || hillSpots.some(s => Math.hypot(x - s.x, z - s.z) < s.r) || Math.sin(x * 0.02 + z * 0.03) < -0.2) continue;
    const r = rand(), k = r < 0.5 ? 0 : r < 0.85 ? 1 : r < 0.93 ? 2 : r < 0.97 ? 3 : 4; forest[k].push([x, z, 0.75 + rand() * 0.8, 0.85 + rand() * 0.4, h]); n++;
  }
  forest.forEach((list, k) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(KINDS[k][0], foliageMat, list.length), tint = new THREE.Color();
    list.forEach(([x, z, s, sy, y], i) => { im.setMatrixAt(i, m4.compose(v3.set(x, GROUND + y, z), q1.setFromAxisAngle(UP, rand() * 6.283), sc3.set(s, s * sy, s))); im.setColorAt(i, tint.setRGB(0.82 + rand() * 0.3, 0.85 + rand() * 0.25, 0.8 + rand() * 0.2)); });
    im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; world.add(im);
  });
  // birds can perch on the tops of a few hundred trees, on the watchtower decks and on the island hut's roof
  for (let n = 0; n < 1400; n++) { const k = rand() < 0.55 ? 0 : 1, list = forest[k]; if (!list.length) continue; const [x, z, sc, sy, y] = list[(rand() * list.length) | 0]; slots.push({ x, y: GROUND + y + (k === 0 ? 7.7 : 9.9) * sc * sy + 0.2, z, b: {}, taken: false }); }
  for (const t of TOWERS) for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) slots.push({ x: t.x + sx * 2.7, y: GROUND + 20.4, z: t.z + sz * 2.7, b: {}, taken: false });
  for (const [dx, dz] of [[-0.8, -0.8], [0.8, -0.8], [0.8, 0.8], [-0.8, 0.8]]) slots.push({ x: ISL.x + dx, y: GROUND + 4.3, z: ISL.z + dz, b: {}, taken: false });
  buildCableCar();
  // ── A ferris wheel by the river at the east end of the city strip ─
  const FWH = { x: 188, z: -3 }, wheel = new THREE.Group(), rim = new THREE.Group(), cars = [];
  {
    wheel.position.set(FWH.x, GROUND, FWH.z); wheel.rotation.y = 0.35;
    for (const sz of [-2.2, 2.2]) for (const sx of [-1, 1]) { const leg = box(0.5, 18, 0.5, solidMat, sx * 6, 8.6, sz); leg.rotation.z = -sx * 0.32; wheel.add(leg); }
    wheel.add(box(1.4, 1.4, 6, solidMat, 0, 17, 0));
    rim.position.y = 17; rim.add(new THREE.Mesh(new THREE.TorusGeometry(13, 0.32, 6, 40), solidMat), new THREE.Mesh(new THREE.TorusGeometry(13, 0.32, 6, 40), solidMat).translateZ(2.2), new THREE.Mesh(new THREE.TorusGeometry(13, 0.32, 6, 40), solidMat).translateZ(-2.2));
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * 6.283, spoke = box(0.14, 26, 0.14, solidMat, 0, 0, 0); spoke.rotation.z = a; if (k < 6) rim.add(spoke);
      const car = new THREE.Group(); car.position.set(Math.cos(a) * 13, Math.sin(a) * 13, 0); car.add(box(0.1, 1.4, 0.1, solidMat, 0, 0.7, 0), box(1.8, 1.4, 1.6, k % 3 ? solidMat : accentMat, 0, -0.5, 0)); rim.add(car); cars.push(car);
    }
    wheel.add(rim); world.add(wheel); boxes.push({ x0: FWH.x - 9, x1: FWH.x + 9, z0: FWH.z - 5, z1: FWH.z + 5, y0: GROUND, y1: GROUND + 31 });
    live.push(dt => { rim.rotation.z += 0.12 * dt; for (const c of cars) c.rotation.z = -rim.rotation.z; });
  }
  // ── The sky: stars, a moon, a faint ring of far hills so the edge of the map cannot be seen, and cloud banks low on the horizon ─
  const ringMats = [], bankMats = [];
  {
    const N = 1700, sp = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { const a = rand() * 6.283, y = 0.04 + rand() * 0.96, r = Math.sqrt(1 - y * y); sp[i * 3] = Math.cos(a) * r * 3200; sp[i * 3 + 1] = y * 3200; sp[i * 3 + 2] = Math.sin(a) * r * 3200; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2.1, sizeAttenuation: false, transparent: true, opacity: 0.8, fog: false, depthWrite: false })); stars.frustumCulled = false; world.add(stars);
    live.push((dt, t) => { stars.rotation.y = t * 0.002; });
    const moon = new THREE.Mesh(new THREE.SphereGeometry(110, 18, 12), new THREE.MeshBasicMaterial({ color: 0xe9e9e4, fog: false })), halo = new THREE.Mesh(new THREE.SphereGeometry(190, 18, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.06, fog: false, depthWrite: false }));
    moon.position.set(-1700, 1250, -2300); halo.position.copy(moon.position); world.add(moon, halo);
    for (let i = 0; i < 46; i++) {
      const a = i / 46 * 6.283 + rand() * 0.1, R = 2300 + rand() * 300, r = 220 + rand() * 160, h = 90 + rand() * 230, m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), new THREE.MeshBasicMaterial({ color: 0x222222, fog: false }));
      m.position.set(Math.cos(a) * R, GROUND + h / 2 - 8, Math.sin(a) * R); m.frustumCulled = false; world.add(m); ringMats.push(m.material);
    }
    for (let i = 0; i < 18; i++) {
      const a = rand() * 6.283, R = 1900 + rand() * 300, m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6).scale(220 + rand() * 160, 24 + rand() * 20, 90 + rand() * 60), new THREE.MeshBasicMaterial({ color: 0x777777, transparent: true, opacity: 0.16, fog: false, depthWrite: false }));
      m.position.set(Math.cos(a) * R, 70 + rand() * 130, Math.sin(a) * R); m.frustumCulled = false; world.add(m); bankMats.push(m.material);
    }
  }
  const api = {
    spheres, fear,
    theme(text, bg) {
      roo.color.copy(bg).lerp(text, 0.55); emu.color.copy(bg).lerp(text, 0.38); yetiMat.color.copy(text); rockMat.color.copy(bg).lerp(text, 0.3); sandMat.color.copy(bg).lerp(text, 0.5); cliffMatX.color.copy(bg).lerp(text, 0.24); for (const m of ringMats) m.color.copy(bg).lerp(text, 0.1); for (const m of bankMats) m.color.copy(text).lerp(bg, 0.45); beachTintDone = true;
      foliageMat.color.setRGB(1, 1, 1);
    },
    season(u) { foliageMat.color.setRGB(1, 1 - 0.04 * u, 1 - 0.14 * u); },   // 0 spring, 1 late summer: the greys warm a touch
    step(dt, t, calm) {
      for (const f of live) f(dt, t);
      stepHerds(dt, t); stepFarms(dt); stepUfo(dt); stepYeti(dt, t); stepMountainCamp(dt, t); stepCable(dt); stepTrain(dt); stepBalloons(dt, t); stepStars(dt, calm); stepFireworks(dt);
      if (!ctxReduce()) {
        ufo.next -= dt; if (ufo.next <= 0) { ufo.next = rnd(700, 1300); startUfo(); }
        yeti.next -= dt; if (yeti.next <= 0) { yeti.next = rnd(600, 1100); startYeti(); }
        train.next -= dt; if (train.next <= 0) { train.next = rnd(150, 300); startTrain(); }
        nextBalloon -= dt; if (nextBalloon <= 0) { nextBalloon = rnd(240, 520); startBalloon(); }
      }
    },
    draw(t) { spheres.length = 0; drawHerds(); drawFarms(); drawUfo(t); drawYeti(t); drawCable(t); drawTrain(t); drawBalloons(t); },
    spawn(k) { if (k === 'yeti') startYeti(); else if (k === 'ufo') startUfo(); else if (k === 'train') startTrain(); else if (k === 'balloon') startBalloon(); else if (k === 'fireworks') { show.on = true; show.left = 7; show.t = 0; } else if (k === 'star') startStar(); else return false; return true; },
    clear() { yeti.on = false; yeti.g.visible = false; ufo.on = false; ufoG.visible = false; ufoBeam.visible = false; train.on = false; for (const c of train.cars) c.g.visible = false; for (const b of balloons) world.remove(b.g); balloons.length = 0; show.on = false; for (const f of fireworks) { f.on = false; f.m.opacity = 0; } },
    get yeti() { return yeti; }, get ufo() { return ufo; }, get herds() { return herds; }, get cc() { return cc; }, get train() { return train; }, get railZ() { return RAILZ; }, get balloons() { return balloons; }, SPOTS
  };
  const ctxReduce = () => K.reduce;
  return api;
}
