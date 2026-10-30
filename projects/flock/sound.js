// Sound: all synthesised in the browser, no audio files. It starts on the first gesture, stays quiet, and follows the scene:
// wind, rain, the tornado, a river, a campfire, engines for the visitors, and a music bed that shifts mood with the weather.
export function createSound(camera) {
  let ac = null, master, fx, musicBus, bus = {}, loops = {}, voices = {}, rev, noiseBuf, active = false, lastLand = 0, nextChirp = 8, mood = { calm: 1, happy: 0, storm: 0 }, moodT = 0, moodBase = 'calm', step = 0, chordT = 0, melT = 0;
  const LEVEL = 0.3;
  let muted = true;   // off until asked for
  try { muted = localStorage.getItem('flock-sound') !== 'on'; } catch (e) { /* storage can be blocked */ }
  const R = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => v < a ? a : v > b ? b : v, hz = n => 440 * Math.pow(2, (n - 69) / 12);
  const cam = { x: 0, y: 0, z: 0, rx: 1, ry: 0, rz: 0 };

  function build() {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0;
    const comp = ac.createDynamicsCompressor(); master.connect(comp); comp.connect(ac.destination);
    fx = g(0.55); fx.connect(master); musicBus = g(1.8); musicBus.connect(master);   // effects sit under the music
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 4, ac.sampleRate);
    { const d = noiseBuf.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; } }
    const c = ac.createConvolver(), len = ac.sampleRate * 2.2, b = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    c.buffer = b; rev = c; const rg = g(0.45); c.connect(rg); rg.connect(musicBus);
    for (const k of ['calm', 'happy', 'storm']) { bus[k] = g(0); bus[k].connect(musicBus); bus[k].connect(rev); }
    // loops
    const n = (f, q, type = 'bandpass') => { const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const x = flt(type, f, q); s.connect(x); s.start(); return x; };
    const L = (k, build) => { const out = g(0); out.connect(fx); loops[k] = { out, ...build(out) }; };
    L('wind', out => { const x = n(500, 0.7), y = n(2400, 2), gg = g(0.35), hh = g(0.0); x.connect(gg).connect(out); y.connect(hh).connect(out); lfo(x.frequency, 0.13, 220); lfo(gg.gain, 0.09, 0.12); return { x, hh }; });
    L('rain', out => { const x = n(4000, 0.4, 'highpass'), gg = g(0.22), y = n(1800, 0.5), hh = g(0.1); x.connect(gg).connect(out); y.connect(hh).connect(out); return {}; });
    L('tornado', out => { const x = n(90, 1.4, 'lowpass'), gg = g(1.4), y = n(300, 2), hh = g(0.35); x.connect(gg).connect(out); lfo(gg.gain, 0.5, 0.5); y.connect(hh).connect(out); lfo(y.frequency, 0.35, 180); return {}; });
    L('fire', out => { const x = n(260, 0.5, 'lowpass'), gg = g(0.4); x.connect(gg).connect(out); return {}; });
    L('alarm', out => { const o = ac.createOscillator(), f = flt('lowpass', 1400), gg = g(0.1); o.type = 'sawtooth'; o.frequency.value = 760; o.connect(f).connect(gg).connect(out); lfo(o.frequency, 0.45, 260, 'triangle'); o.start(); return {}; });   // a watchtower siren
    L('surf', out => { const x = n(500, 0.5, 'lowpass'), gg = g(0.5); x.connect(gg).connect(out); lfo(gg.gain, 0.07, 0.35); lfo(x.frequency, 0.07, 200); return {}; });   // breakers on the beach
    L('river', out => { const x = n(700, 0.6), gg = g(0.18); x.connect(gg).connect(out); lfo(x.frequency, 0.3, 300); lfo(gg.gain, 0.5, 0.05); return {}; });
    // a low minor drone for the stormy bed, always running, its bus decides whether it is heard
    for (const note of [36, 43, 46, 51]) { const o = ac.createOscillator(), gg = g(0.016), f = flt('lowpass', 220); o.type = 'sine'; o.frequency.value = hz(note); o.detune.value = R(-8, 8); o.connect(f).connect(gg).connect(bus.storm); lfo(f.frequency, 0.07, 140); lfo(gg.gain, 0.11, 0.02); o.start(); }
    setMaster();
  }
  const g = v => { const x = ac.createGain(); x.gain.value = v; return x; };
  const flt = (type, f, q = 1) => { const x = ac.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; return x; };
  const pn = v => { const p = ac.createStereoPanner(); p.pan.value = v; return p; };
  function lfo(param, rate, depth, type = 'sine') { const o = ac.createOscillator(); o.type = type; o.frequency.value = rate; const gg = g(depth); o.connect(gg).connect(param); o.start(); }
  const noise = (loop = false) => { const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = loop; return s; };
  function tone(f, t, a, d, peak, type = 'sine', dest = fx, p = 0) {
    const o = ac.createOscillator(), gg = g(0.0001); o.type = type; o.frequency.value = f; o.connect(gg); gg.connect(pn(p)).connect(dest);
    gg.gain.setValueAtTime(0.0001, t); gg.gain.exponentialRampToValueAtTime(peak, t + a); gg.gain.exponentialRampToValueAtTime(0.0001, t + a + d); o.start(t); o.stop(t + a + d + 0.1);
  }
  function setMaster() { if (ac) master.gain.setTargetAtTime(muted || !active ? 0 : LEVEL, ac.currentTime, 0.8); }
  // where a point is relative to the camera: how loud it should be and which side it is on
  function where(p) {
    const dx = p.x - cam.x, dy = (p.y ?? -58) - cam.y, dz = p.z - cam.z, d = Math.hypot(dx, dy, dz) || 1;
    return { d, gain: 0.35 + 0.65 / (1 + Math.pow(d / 250, 1.5)), pan: clamp((dx * cam.rx + dy * cam.ry + dz * cam.rz) / d * 1.2, -0.85, 0.85) };
  }

  // engines: one voice for the current visitor and one for the helicopter
  function engine(kind) {
    const out = g(0), p = pn(0), nodes = []; out.connect(p).connect(fx);
    const osc = (f, type, lp) => { const o = ac.createOscillator(), x = flt('lowpass', lp); o.type = type; o.frequency.value = f; o.connect(x).connect(out); o.start(); nodes.push(o); return o; };
    const nz = (f, q, type, level) => { const s = noise(true), x = flt(type, f, q), gg = g(level); s.connect(x).connect(gg).connect(out); s.start(); nodes.push(s); };
    const tuned = [];
    if (kind === 'plane') { tuned.push(osc(95, 'sawtooth', 700), osc(99, 'sawtooth', 700)); nz(700, 0.6, 'bandpass', 0.3); }
    else if (kind === 'military') { tuned.push(osc(60, 'sawtooth', 450), osc(63, 'sawtooth', 450)); nz(350, 0.6, 'bandpass', 0.5); }
    else if (kind === 'blimp') { tuned.push(osc(55, 'sine', 300), osc(56.5, 'sine', 300)); nz(250, 0.5, 'lowpass', 0.25); }
    else if (kind === 'glider') nz(1500, 0.5, 'bandpass', 0.25);
    else if (kind === 'jetpack') { tuned.push(osc(150, 'sawtooth', 900)); nz(1800, 0.7, 'bandpass', 0.5); }
    else {   // helicopter: blade thump, turbine whine
      nz(110, 0.8, 'lowpass', 0.22);
      const o = ac.createOscillator(), m = g(0); o.type = 'sine'; o.frequency.value = 48; o.connect(m).connect(out); lfo(m.gain, 9, 0.12, 'sine');
      const bias = ac.createConstantSource(); bias.offset.value = 0.12; bias.connect(m.gain); bias.start(); o.start(); nodes.push(o, bias);
    }
    return { out, p, nodes, tuned, base: kind === 'heli' ? 0.28 : kind === 'military' ? 0.55 : kind === 'blimp' ? 0.25 : kind === 'glider' ? 0.14 : kind === 'jetpack' ? 0.3 : 0.35, prev: null };
  }
  function drive(key, kind, pos, dt, fade = 1) {
    let v = voices[key];
    if (!pos) { if (v) { v.out.gain.setTargetAtTime(0, ac.currentTime, 0.4); if (!v.dying) { v.dying = true; setTimeout(() => { for (const n of v.nodes) try { n.stop(); } catch (e) { /* already stopped */ } v.out.disconnect(); if (voices[key] === v) delete voices[key]; }, 2500); } } return; }
    if (v && (v.kind !== kind || v.dying)) { drive(key, kind, null, dt); v = null; delete voices[key]; }
    if (!v) { v = voices[key] = engine(kind); v.kind = kind; }
    const w = where(pos), vr = v.prev === null ? 0 : (w.d - v.prev) / Math.max(dt, 1e-3); v.prev = w.d;
    v.out.gain.setTargetAtTime(v.base * w.gain * fade, ac.currentTime, 0.15); v.p.pan.setTargetAtTime(w.pan, ac.currentTime, 0.2);
    for (const o of v.tuned) o.detune.setTargetAtTime(clamp(-vr * 6, -250, 250), ac.currentTime, 0.2);
  }

  function pop(w) {   // one crackle
    const t = ac.currentTime, s = noise(), f = flt('bandpass', R(1200, 5000), 3), gg = g(0.0001); s.connect(f).connect(gg).connect(pn(w.pan)).connect(fx);
    gg.gain.setValueAtTime(0.0001, t); gg.gain.exponentialRampToValueAtTime(R(0.2, 0.6) * (0.4 + 0.6 * w.gain), t + 0.004); gg.gain.exponentialRampToValueAtTime(0.0001, t + R(0.02, 0.07)); s.start(t, Math.random() * 3); s.stop(t + 0.1);
  }
  // one-shots, placed in the scene
  function event(name, pos) {
    if (!ac || muted || !active || ac.state !== 'running') return;
    const t = ac.currentTime, w = pos ? where(pos) : { d: 100, gain: 0.6, pan: 0 }, out = g(w.gain), p = pn(w.pan); out.connect(p).connect(fx);
    if (name === 'thunder') {
      const d = clamp(w.d / 180, 0.2, 2.5), far = w.d > 220, s = noise(), f = flt('lowpass', far ? 260 : 900), gg = g(0.0001); s.connect(f).connect(gg).connect(out);
      if (!far) { const c = noise(), cf = flt('highpass', 2000), cg = g(0.0001); c.connect(cf).connect(cg).connect(out); cg.gain.setValueAtTime(0.0001, t); cg.gain.exponentialRampToValueAtTime(0.5, t + 0.005); cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.18); c.start(t, 1); c.stop(t + 0.3); }
      f.frequency.setValueAtTime(far ? 260 : 900, t + d); f.frequency.exponentialRampToValueAtTime(60, t + d + (far ? 5 : 3.5));
      gg.gain.setValueAtTime(0.0001, t + d); gg.gain.exponentialRampToValueAtTime(far ? 0.9 : 1.3, t + d + (far ? 0.9 : 0.08)); gg.gain.exponentialRampToValueAtTime(0.0001, t + d + (far ? 6 : 4)); s.start(t + d, 0); s.stop(t + d + 6.5);
    } else if (name === 'horn' || name === 'truck') {
      const lo = name === 'horn' ? 98 : 130;
      for (const m of [1, 1.25, 1.5]) { const o = ac.createOscillator(), gg = g(0.0001), f = flt('lowpass', 900); o.type = 'sawtooth'; o.frequency.value = lo * m; o.connect(f).connect(gg).connect(out); gg.gain.setValueAtTime(0.0001, t); gg.gain.exponentialRampToValueAtTime(0.12, t + 0.08); gg.gain.setValueAtTime(0.12, t + (name === 'horn' ? 1.1 : 0.6)); gg.gain.exponentialRampToValueAtTime(0.0001, t + (name === 'horn' ? 1.8 : 0.9)); o.start(t); o.stop(t + 2); }
    } else if (name === 'bell') {
      for (const [m, v] of [[1, 0.18], [2.76, 0.08], [5.4, 0.04]]) tone(880 * m, t, 0.003, 2.4 / m + 0.4, v, 'sine', out);
      setTimeout(() => { if (ac) for (const [m, v] of [[1, 0.18], [2.76, 0.08]]) tone(880 * m, ac.currentTime, 0.003, 1.8, v, 'sine', out); }, 700);
    } else if (name === 'dock') {   // a boat nudging the pier: two wooden knocks and a creak
      tone(150, t, 0.003, 0.18, 0.25, 'sine', out); tone(130, t + 0.22, 0.003, 0.2, 0.2, 'sine', out);
      const c = noise(), cf = flt('bandpass', 380, 6), cg = g(0.0001); c.connect(cf).connect(cg).connect(out); cf.frequency.setValueAtTime(380, t + 0.1); cf.frequency.exponentialRampToValueAtTime(240, t + 0.9);
      cg.gain.setValueAtTime(0.0001, t + 0.1); cg.gain.exponentialRampToValueAtTime(0.12, t + 0.3); cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.9); c.start(t, 1); c.stop(t + 1);
    } else if (name === 'toot') {
      for (const m of [1, 1.5]) { const o = ac.createOscillator(), gg = g(0.0001), f = flt('lowpass', 800); o.type = 'sawtooth'; o.frequency.value = 196 * m; o.connect(f).connect(gg).connect(out); gg.gain.setValueAtTime(0.0001, t); gg.gain.exponentialRampToValueAtTime(0.1, t + 0.05); gg.gain.setValueAtTime(0.1, t + 0.3); gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.55); o.start(t); o.stop(t + 0.6); }
    } else if (name === 'cannon') {
      const o = ac.createOscillator(), gg = g(0.0001); o.type = 'sine'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(32, t + 0.6); o.connect(gg).connect(out);
      gg.gain.setValueAtTime(0.0001, t); gg.gain.exponentialRampToValueAtTime(0.9, t + 0.01); gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.9); o.start(t); o.stop(t + 1);
      const s = noise(), f = flt('lowpass', 1200), ng = g(0.0001); s.connect(f).connect(ng).connect(out); ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.7, t + 0.005); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.5); s.start(t, 0.5); s.stop(t + 0.6);
    } else if (name === 'splash') {   // water dumped from the air
      const s = noise(), f = flt('bandpass', 900, 0.8), gg = g(0.0001); s.connect(f).connect(gg).connect(out); f.frequency.setValueAtTime(1400, t); f.frequency.exponentialRampToValueAtTime(300, t + 1.4);
      gg.gain.setValueAtTime(0.0001, t); gg.gain.exponentialRampToValueAtTime(0.5, t + 0.15); gg.gain.exponentialRampToValueAtTime(0.0001, t + 1.5); s.start(t, 1); s.stop(t + 1.6);
    } else if (name === 'explosion') {
      const o = ac.createOscillator(), gg = g(0.0001); o.type = 'sine'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(28, t + 1); o.connect(gg).connect(out);
      gg.gain.setValueAtTime(0.0001, t); gg.gain.exponentialRampToValueAtTime(1.1, t + 0.01); gg.gain.exponentialRampToValueAtTime(0.0001, t + 1.4); o.start(t); o.stop(t + 1.5);
      const s2 = noise(), f = flt('lowpass', 2500), ng = g(0.0001); s2.connect(f).connect(ng).connect(out); f.frequency.exponentialRampToValueAtTime(200, t + 1); ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.9, t + 0.005); ng.gain.exponentialRampToValueAtTime(0.0001, t + 1.1); s2.start(t, 0.3); s2.stop(t + 1.2);
    } else if (name === 'mayday') {   // an urgent radio SOS: three short, three long, three short
      const f = flt('bandpass', 1500, 2), gg = g(0.5); f.connect(gg).connect(out);
      let tt = t; for (const len of [0.12, 0.12, 0.12, 0.36, 0.36, 0.36, 0.12, 0.12, 0.12]) { const o = ac.createOscillator(), e = g(0.0001); o.type = 'square'; o.frequency.value = 1050; o.connect(e).connect(f); e.gain.setValueAtTime(0.0001, tt); e.gain.exponentialRampToValueAtTime(0.09, tt + 0.01); e.gain.setValueAtTime(0.09, tt + len); e.gain.exponentialRampToValueAtTime(0.0001, tt + len + 0.02); o.start(tt); o.stop(tt + len + 0.05); tt += len + 0.12; }
      const sn = noise(), sf = flt('highpass', 2500), sg = g(0.0001); sn.connect(sf).connect(sg).connect(out); sg.gain.setValueAtTime(0.0001, t); sg.gain.linearRampToValueAtTime(0.03, t + 0.1); sg.gain.setValueAtTime(0.03, tt); sg.gain.exponentialRampToValueAtTime(0.0001, tt + 0.2); sn.start(t, 1); sn.stop(tt + 0.3);
    } else if (name === 'stomp') {
      tone(60, t, 0.004, 0.5, 0.9, 'sine', out); tone(38, t, 0.004, 0.7, 0.7, 'sine', out);
      const s2 = noise(), f = flt('lowpass', 500), ng = g(0.0001); s2.connect(f).connect(ng).connect(out); ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.5, t + 0.01); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.5); s2.start(t, 1); s2.stop(t + 0.6);
    } else if (name === 'roar') {
      for (const m of [1, 1.5, 2.02]) { const o = ac.createOscillator(), gg = g(0.0001), f = flt('lowpass', 700); o.type = 'sawtooth'; o.frequency.setValueAtTime(70 * m, t); o.frequency.linearRampToValueAtTime(48 * m, t + 2.2); o.connect(f).connect(gg).connect(out); lfo(o.frequency, 22, 6);
        gg.gain.setValueAtTime(0.0001, t); gg.gain.exponentialRampToValueAtTime(0.16, t + 0.3); gg.gain.setValueAtTime(0.16, t + 1.4); gg.gain.exponentialRampToValueAtTime(0.0001, t + 2.4); o.start(t); o.stop(t + 2.5); }
    } else if (name === 'ufo') {   // a rising warble
      const o = ac.createOscillator(), gg = g(0.0001); o.type = 'sine'; o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(900, t + 5); lfo(o.frequency, 7, 60); o.connect(gg).connect(out);
      gg.gain.setValueAtTime(0.0001, t); gg.gain.exponentialRampToValueAtTime(0.1, t + 1.5); gg.gain.setValueAtTime(0.1, t + 4); gg.gain.exponentialRampToValueAtTime(0.0001, t + 6); o.start(t); o.stop(t + 6.2);
    } else if (name === 'firework') {
      const s2 = noise(), f = flt('bandpass', 1800, 0.7), ng = g(0.0001); s2.connect(f).connect(ng).connect(out); ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.6, t + 0.006); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.5); s2.start(t, 2); s2.stop(t + 0.6);
      for (let k = 0; k < 8; k++) tone(R(1500, 4200), t + 0.15 + k * 0.06, 0.002, 0.08, 0.04, 'square', out);
    } else if (name === 'train') {
      for (const m of [1, 1.26]) { const o = ac.createOscillator(), gg = g(0.0001), f = flt('lowpass', 700); o.type = 'sawtooth'; o.frequency.value = 220 * m; o.connect(f).connect(gg).connect(out); gg.gain.setValueAtTime(0.0001, t); gg.gain.exponentialRampToValueAtTime(0.12, t + 0.06); gg.gain.setValueAtTime(0.12, t + 0.9); gg.gain.exponentialRampToValueAtTime(0.0001, t + 1.5); o.start(t); o.stop(t + 1.6); }
    } else if (name === 'burner') {
      const s2 = noise(), f = flt('bandpass', 500, 0.8), ng = g(0.0001); s2.connect(f).connect(ng).connect(out); ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.25, t + 0.15); ng.gain.setValueAtTime(0.25, t + 0.8); ng.gain.exponentialRampToValueAtTime(0.0001, t + 1.4); s2.start(t, 1); s2.stop(t + 1.5);
    } else if (name === 'jets') {   // a roar that sweeps past, then a low boom
      const sn = noise(), bf = flt('bandpass', 400, 0.7), ng = g(0.0001); sn.connect(bf).connect(ng).connect(out); bf.frequency.setValueAtTime(300, t); bf.frequency.exponentialRampToValueAtTime(2200, t + 2.5); bf.frequency.exponentialRampToValueAtTime(260, t + 7);
      ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.9, t + 2.5); ng.gain.exponentialRampToValueAtTime(0.0001, t + 7); sn.start(t, 0.5); sn.stop(t + 7.2);
      tone(46, t + 2.4, 0.02, 1.8, 0.9, 'sine', out);
    } else if (name === 'kookaburra') {   // a laugh that speeds up and falls away
      let tt = t; for (let k = 0; k < 9; k++) { const f = 900 - k * 40 + (k % 2 ? 160 : 0); const o = ac.createOscillator(), gg = g(0.0001), bf = flt('bandpass', f, 3); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, tt); o.frequency.exponentialRampToValueAtTime(f * 0.7, tt + 0.16); o.connect(bf).connect(gg).connect(out); gg.gain.setValueAtTime(0.0001, tt); gg.gain.exponentialRampToValueAtTime(0.12, tt + 0.02); gg.gain.exponentialRampToValueAtTime(0.0001, tt + 0.17); o.start(tt); o.stop(tt + 0.2); tt += 0.17 - k * 0.008; }
    } else if (name === 'chuff') {
      const sn = noise(), bf = flt('bandpass', 700, 0.8), ng = g(0.0001); sn.connect(bf).connect(ng).connect(out); ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.22, t + 0.03); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.28); sn.start(t, Math.random() * 3); sn.stop(t + 0.3);
    } else if (name === 'whale') {   // a long, low song with a wobble
      const o = ac.createOscillator(), gg = g(0.0001); o.type = 'sine'; o.frequency.setValueAtTime(95, t); o.frequency.linearRampToValueAtTime(175, t + 2.4); o.frequency.linearRampToValueAtTime(110, t + 5); lfo(o.frequency, 5, 6); o.connect(gg).connect(out);
      gg.gain.setValueAtTime(0.0001, t); gg.gain.exponentialRampToValueAtTime(0.25, t + 1.2); gg.gain.setValueAtTime(0.25, t + 3.5); gg.gain.exponentialRampToValueAtTime(0.0001, t + 5.5); o.start(t); o.stop(t + 5.6);
    } else if (name === 'airliner') {
      const sn = noise(), bf = flt('bandpass', 500, 0.8), ng = g(0.0001); sn.connect(bf).connect(ng).connect(out); bf.frequency.setValueAtTime(350, t); bf.frequency.exponentialRampToValueAtTime(1200, t + 4); bf.frequency.exponentialRampToValueAtTime(300, t + 9);
      ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.55, t + 3.5); ng.gain.exponentialRampToValueAtTime(0.0001, t + 9); sn.start(t, 1); sn.stop(t + 9.2);
    } else if (name === 'cessna') {   // a small engine buzz that passes
      const o = ac.createOscillator(), gg = g(0.0001), f2 = flt('lowpass', 900); o.type = 'sawtooth'; o.frequency.setValueAtTime(118, t); o.frequency.linearRampToValueAtTime(150, t + 3); o.frequency.linearRampToValueAtTime(110, t + 6); lfo(o.frequency, 18, 6); o.connect(f2).connect(gg).connect(out);
      gg.gain.setValueAtTime(0.0001, t); gg.gain.exponentialRampToValueAtTime(0.14, t + 1.5); gg.gain.setValueAtTime(0.14, t + 3); gg.gain.exponentialRampToValueAtTime(0.0001, t + 6); o.start(t); o.stop(t + 6.2);
    } else if (name === 'land') {
      if (t - lastLand < 0.5) return; lastLand = t;
      const o = ac.createOscillator(), gg = g(0.0001); o.type = 'sine'; o.frequency.setValueAtTime(3600, t); o.frequency.exponentialRampToValueAtTime(2400, t + 0.05); o.connect(gg).connect(out);
      gg.gain.setValueAtTime(0.0001, t); gg.gain.exponentialRampToValueAtTime(0.035, t + 0.004); gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.06); o.start(t); o.stop(t + 0.12);
    } else if (name === 'car') { tone(420, t, 0.01, 0.22, 0.05, 'square', out); tone(530, t, 0.01, 0.22, 0.05, 'square', out); }
    else if (name === 'chute') {
      const s = noise(), f = flt('bandpass', 1400, 0.7), gg = g(0.0001); s.connect(f).connect(gg).connect(out); gg.gain.setValueAtTime(0.0001, t); gg.gain.exponentialRampToValueAtTime(0.4, t + 0.05); gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.5); f.frequency.exponentialRampToValueAtTime(400, t + 0.5); s.start(t); s.stop(t + 0.6);
    } else if (name === 'hawk') {
      for (let k = 0; k < 2; k++) { const tt = t + k * 0.5, o = ac.createOscillator(), gg = g(0.0001), f = flt('bandpass', 3000, 3); o.type = 'sawtooth'; o.frequency.setValueAtTime(3200, tt); o.frequency.exponentialRampToValueAtTime(1800, tt + 0.55); o.connect(f).connect(gg).connect(out); gg.gain.setValueAtTime(0.0001, tt); gg.gain.exponentialRampToValueAtTime(0.07, tt + 0.04); gg.gain.exponentialRampToValueAtTime(0.0001, tt + 0.55); o.start(tt); o.stop(tt + 0.7); }
    } else if (name === 'yoink') {
      const o = ac.createOscillator(), gg = g(0.0001); o.type = 'sine'; o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.7); o.connect(gg).connect(out);
      gg.gain.setValueAtTime(0.0001, t); gg.gain.exponentialRampToValueAtTime(0.1, t + 0.02); gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.8); o.start(t); o.stop(t + 1); tone(70, t + 0.9, 0.005, 0.35, 0.18, 'sine', out);
    } else if (name === 'chirp') {
      for (let k = 0; k < 3; k++) { const tt = t + k * 0.14, o = ac.createOscillator(), gg = g(0.0001); o.type = 'sine'; o.frequency.setValueAtTime(R(2800, 3400), tt); o.frequency.exponentialRampToValueAtTime(R(4200, 5200), tt + 0.07); o.connect(gg).connect(out); gg.gain.setValueAtTime(0.0001, tt); gg.gain.exponentialRampToValueAtTime(0.04, tt + 0.005); gg.gain.exponentialRampToValueAtTime(0.0001, tt + 0.08); o.start(tt); o.stop(tt + 0.14); }
    }
  }

  // a simple piano: a few sine partials that die away at different rates, plus a soft hammer tick
  function piano(f, t, vel, dest, p = 0) {
    const out = g(0.0001), dur = clamp(3.4 - f / 650, 1.3, 3.4); out.connect(pn(p)).connect(dest);
    out.gain.setValueAtTime(0.0001, t); out.gain.linearRampToValueAtTime(vel, t + 0.006); out.gain.exponentialRampToValueAtTime(vel * 0.3, t + 0.3); out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    [[1, 1], [2, 0.4], [3, 0.2], [4, 0.1], [5, 0.05]].forEach(([m, a], k) => {
      const o = ac.createOscillator(), gg = g(a); o.type = 'sine'; o.frequency.value = f * m * (1 + 0.0004 * k * k); o.connect(gg).connect(out);
      gg.gain.setValueAtTime(a, t); gg.gain.exponentialRampToValueAtTime(a * 0.04, t + dur / m); o.start(t); o.stop(t + dur + 0.1);
    });
    const s = noise(), nf = flt('lowpass', 1800), ng = g(0.0001); s.connect(nf).connect(ng).connect(out); ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(vel * 0.5, t + 0.002); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.03); s.start(t, Math.random() * 3); s.stop(t + 0.05);
  }
  // short phrases: [note, beats]
  const PHRASES = {
    calm: [[[76, 1], [74, 1], [72, 1], [67, 2], [69, 1], [72, 1], [74, 2], [72, 1], [67, 1], [64, 3]], [[67, 1], [72, 1], [76, 2], [74, 1], [72, 1], [69, 2], [67, 1], [69, 1], [72, 4]], [[72, 1], [67, 1], [64, 1], [67, 1], [72, 2], [76, 1], [74, 1], [72, 3]]],
    happy: [[[72, 0.5], [76, 0.5], [79, 0.5], [76, 0.5], [84, 1], [79, 0.5], [76, 0.5], [74, 1], [72, 2]], [[67, 0.5], [72, 0.5], [76, 1], [74, 0.5], [76, 0.5], [79, 1], [76, 0.5], [74, 0.5], [72, 2]]],
    storm: [[[57, 2], [60, 2], [64, 3], [62, 2], [60, 4]], [[52, 3], [57, 2], [55, 2], [52, 4]]]
  };
  let phraseT = 6;
  function phrase(kind, dest) {
    const ph = PHRASES[kind][(Math.random() * PHRASES[kind].length) | 0], beat = kind === 'happy' ? 0.28 : kind === 'storm' ? 0.7 : 0.55, tr = [0, 0, 2, -2, 5][(Math.random() * 5) | 0], quiet = kind === 'storm' ? 0.6 : 1;
    let tt = ac.currentTime + 0.05; piano(hz(ph[0][0] - 24 + tr), tt, 0.06 * quiet, dest);
    for (const [n, b] of ph) { piano(hz(n + tr), tt + Math.random() * 0.02, R(0.05, 0.095) * quiet, dest, R(-0.2, 0.2)); tt += b * beat; }
  }

  // the music bed: calm by default, a happier spell now and then, stormy when the weather is
  function music(dt, st) {
    moodT -= dt;
    if (moodT <= 0) { moodBase = moodBase === 'calm' && Math.random() < 0.5 ? 'happy' : 'calm'; moodT = moodBase === 'happy' ? R(60, 120) : R(120, 240); }
    const storm = clamp((st.storms - 2) / 3, 0, 1) * 0.9 + st.tornado * 0.1, want = { calm: moodBase === 'calm' ? 1 - storm : 0, happy: moodBase === 'happy' ? 1 - storm : 0, storm };
    for (const k in mood) { mood[k] += (want[k] - mood[k]) * Math.min(1, dt * 0.25); bus[k].gain.setTargetAtTime(mood[k] * (k === 'storm' ? 0.4 : 0.55), ac.currentTime, 0.5); }
    const t = ac.currentTime;
    chordT -= dt; melT -= dt; step -= dt;
    if (mood.calm > 0.03) {
      if (chordT <= 0) { chordT = 8; const ch = [[48, 55, 60, 64, 71], [45, 52, 60, 64, 67], [41, 48, 60, 65, 69], [43, 50, 59, 62, 67]][(Math.random() * 4) | 0]; for (const note of ch) for (const det of [-6, 6]) { const o = ac.createOscillator(), gg = g(0.0001), f = flt('lowpass', 900); o.type = 'triangle'; o.frequency.value = hz(note); o.detune.value = det; o.connect(f).connect(gg).connect(bus.calm); gg.gain.setValueAtTime(0.0001, t); gg.gain.linearRampToValueAtTime(0.03, t + 3.5); gg.gain.linearRampToValueAtTime(0.0001, t + 9); o.start(t); o.stop(t + 9.5); } }
    }
    phraseT -= dt;
    if (phraseT <= 0) {   // a short piano phrase in whichever mood is strongest
      const tot = mood.calm + mood.happy + mood.storm; let r = Math.random() * tot, kind = 'calm'; for (const k in mood) { r -= mood[k]; if (r <= 0) { kind = k; break; } }
      phrase(kind, bus[kind]); phraseT = kind === 'happy' ? R(8, 14) : kind === 'storm' ? R(22, 40) : R(14, 26);
    }
    if (mood.happy > 0.03 && step <= 0) {
      step = 0.24; const s = (t * 4.17) | 0, arp = [60, 64, 67, 72, 67, 64], root = [0, -3, 5, 7][((s / 12) | 0) % 4];
      tone(hz(arp[s % 6] + root + 12), t, 0.005, 0.28, 0.05, 'triangle', bus.happy, R(-0.3, 0.3));
      if (s % 3 === 0) tone(hz([48, 48, 53, 55][((s / 12) | 0) % 4]), t, 0.01, 0.6, 0.12, 'sine', bus.happy);
    }
  }

  const api = {
    get muted() { return muted; },
    gesture() { if (!ac) build(); if (ac.state === 'suspended') ac.resume(); setMaster(); },
    setActive(on) { active = on; setMaster(); },
    toggle() { muted = !muted; try { localStorage.setItem('flock-sound', muted ? 'off' : 'on'); } catch (e) { /* storage can be blocked */ } setMaster(); if (!muted && !ac) api.gesture(); return muted; },
    event,
    update(s, dt) {
      if (!ac || !active || muted || ac.state !== 'running') return;
      const m = camera.matrixWorld.elements; cam.x = m[12]; cam.y = m[13]; cam.z = m[14]; cam.rx = m[0]; cam.ry = m[1]; cam.rz = m[2];
      const T = 0.6, now = ac.currentTime, set = (k, v) => loops[k].out.gain.setTargetAtTime(v, now, T);
      set('wind', 0.1 + s.wind * 0.45 + s.gust * 0.3); loops.wind.x.frequency.setTargetAtTime(400 + s.wind * 500, now, 1);
      set('rain', s.rain * 0.9);
      set('tornado', s.tornado ? s.tornado * where({ x: s.tx, y: 0, z: s.tz }).gain * 0.9 : 0);
      let fire = 0;   // campsite, the hut and the forest fire: a low roar from afar, crackling and popping up close
      for (const F of s.fires) { if (F.l <= 0.02) continue; const w = where({ x: F.x, y: -58, z: F.z }), near = Math.pow(clamp(1 - w.d / 170, 0, 1), 1.6); fire = Math.max(fire, F.l * (0.12 * w.gain + 0.9 * near)); if (Math.random() < dt * 18 * F.l * near) pop(w); }
      set('fire', fire * 0.9);
      set('river', 0.5 * where({ x: 20, y: -58, z: 20 }).gain);
      set('surf', 0.7 * Math.pow(clamp(1 - where({ x: -330, y: -58, z: -335 }).d / 260, 0, 1), 1.5));
      set('alarm', s.alarm.l * where({ x: s.alarm.x, y: -40, z: s.alarm.z }).gain * 0.4);
      drive('vis', s.vis ? s.vis.kind : '', s.vis ? s.vis.p : null, dt, s.visFade);
      drive('heli0', 'heli', s.helis[0].p, dt, s.helis[0].fade);
      drive('heli1', 'heli', s.helis[1].p, dt, s.helis[1].fade);
      music(dt, s);
      nextChirp -= dt;   // a little birdsong on quiet days
      if (nextChirp <= 0) { nextChirp = R(6, 16); if (s.storms < 2 && s.wind < 0.8) event('chirp', { x: cam.x + R(-150, 150), y: 0, z: cam.z + R(-150, 150) }); }
    }
  };
  document.addEventListener('visibilitychange', () => { if (!ac) return; if (document.hidden) ac.suspend(); else if (active && !muted) ac.resume(); });
  return api;
}
