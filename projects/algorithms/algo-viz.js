// One canvas, three tabs. Each tab is a mode with the same shape:
// line, algorithm list, newBoard(), run(), draw(), plus optional pointer
// handlers. Switching tab or starting a run bumps `epoch`, which stops any
// animation still in flight from the previous one.

import { aStar, bfs, greedyBestFirst, iterativeDeepening } from './algo-core.mjs?v=15';
import { randomTileState, tileProblem } from './algo-tile.mjs?v=15';
import { key, fromKey, gridProblem } from './algo-grid.mjs?v=15';
import { createGA, createACO, referenceTour } from './algo-tsp.mjs?v=15';

const $ = (id) => document.getElementById(id);
const canvas = $('al-canvas');
const ctx = canvas.getContext('2d');
const els = { line: $('al-line'), algo: $('al-algo'), run: $('al-run'), fresh: $('al-new'), stats: $('al-stats') };

let W = 0, H = 0;   // stage size in CSS pixels
let epoch = 0;
let mode = null;

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const fmt = (n) => Math.round(n).toLocaleString('en-AU');
const stats = (pairs) => {
  els.stats.innerHTML = pairs.map(([label, v]) => `<b>${v}</b> ${label}`).join(' &middot; ');
};
const frame = () => new Promise(requestAnimationFrame);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ============================================================================
// Path
// ============================================================================

const WALL_COVERAGE = 0.16;
const PATH_ANIM_MS = 2000;

const path = {
  line: 'Find a route from the left square to the right one. Drag on the board to draw walls.',
  algos: [['astar', 'A*'], ['bfs', 'Breadth-first'], ['greedy', 'Greedy best-first']],
  rows: 0, cols: 0, cell: 0, start: '', goal: '',
  walls: new Set(), visited: [], route: [], shown: 0, routeShown: 0,

  layout() {
    const cell = Math.max(8, Math.min(22, Math.floor(Math.sqrt((W * H) / 1400))));
    const cols = Math.max(8, Math.floor(W / cell));
    const rows = Math.max(6, Math.floor(H / cell));
    if (cols === this.cols && rows === this.rows && cell === this.cell) return false;
    Object.assign(this, { cell, cols, rows });
    const mid = Math.floor(rows / 2);
    this.start = key(mid, 1);
    this.goal = key(mid, cols - 2);
    return true;
  },

  // Short straight runs rather than noise: they read as walls and force detours.
  newBoard() {
    this.layout();
    const { rows, cols } = this;
    const keep = new Set();
    for (const k of [this.start, this.goal]) {
      const [r, c] = fromKey(k);
      for (const [dr, dc] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) keep.add(key(r + dr, c + dc));
    }
    this.walls = new Set();
    const target = Math.round(rows * cols * WALL_COVERAGE);
    for (let guard = 0; this.walls.size < target && guard < target * 20; guard++) {
      const horizontal = Math.random() < 0.5;
      const len = 2 + Math.floor(Math.random() * 4);
      let r = Math.floor(Math.random() * rows), c = Math.floor(Math.random() * cols);
      for (let i = 0; i < len && r < rows && c < cols; i++) {
        const k = key(r, c);
        if (!keep.has(k)) this.walls.add(k);
        if (horizontal) c++; else r++;
      }
    }
    this.clearTrace();
  },

  clearTrace() { this.visited = []; this.route = []; this.shown = 0; this.routeShown = 0; },

  resize() { if (!this.layout()) return false; this.newBoard(); return true; },

  async run(algo, my) {
    this.clearTrace();
    const visited = [];
    const problem = gridProblem({ rows: this.rows, cols: this.cols, walls: this.walls }, this.start, this.goal);
    const fn = { astar: aStar, bfs, greedy: greedyBestFirst }[algo];
    const { path: route, stats: s } = fn(problem, { onVisit: (st) => visited.push(st) });
    this.visited = visited;
    this.route = route || [];
    const done = () => stats([
      ['explored', fmt(visited.length)],
      ['path', route ? fmt(route.length - 1) : 'none'],
      ['ms', s.time.toFixed(1)],
    ]);
    const perFrame = Math.max(1, Math.ceil(visited.length / (PATH_ANIM_MS / 16)));
    while (this.shown < visited.length) {
      if (my !== epoch) return;
      this.shown = Math.min(visited.length, this.shown + perFrame);
      draw();
      await frame();
    }
    while (this.routeShown < this.route.length) {
      if (my !== epoch) return;
      this.routeShown = Math.min(this.route.length, this.routeShown + 2);
      draw();
      await frame();
    }
    done();
  },

  draw() {
    const { cell, rows, cols } = this;
    const ox = Math.floor((W - cols * cell) / 2), oy = Math.floor((H - rows * cell) / 2);
    const at = (k, fill) => {
      const [r, c] = fromKey(k);
      ctx.fillStyle = fill;
      ctx.fillRect(ox + c * cell, oy + r * cell, cell - 1, cell - 1);
    };
    ctx.fillStyle = css('--bg-soft');
    ctx.fillRect(ox, oy, cols * cell, rows * cell);
    // Visit order as a ramp: the oldest cells darkest, the search front
    // lightest. Kept light enough that the accent route reads on top.
    const ramp = ['--seq4', '--seq3', '--seq2'].map(css);
    for (let i = 0; i < this.shown; i++) {
      at(this.visited[i], ramp[Math.min(2, Math.floor((i / this.visited.length) * 3))]);
    }
    const wall = css('--text');
    for (const k of this.walls) at(k, wall);
    const accent = css('--accent');
    for (let i = 0; i < this.routeShown; i++) at(this.route[i], accent);
    const end = css('--d2');
    at(this.start, end);
    at(this.goal, end);
  },

  cellAt(e) {
    const { cell, rows, cols } = this;
    const ox = Math.floor((W - cols * cell) / 2), oy = Math.floor((H - rows * cell) / 2);
    const rect = canvas.getBoundingClientRect();
    const c = Math.floor((e.clientX - rect.left - ox) / cell);
    const r = Math.floor((e.clientY - rect.top - oy) / cell);
    if (r < 0 || r >= rows || c < 0 || c >= cols) return null;
    const k = key(r, c);
    return k === this.start || k === this.goal ? null : k;
  },

  painting: null,
  pointerdown(e) {
    const k = this.cellAt(e);
    if (!k) return;
    epoch++;
    this.clearTrace();
    this.painting = !this.walls.has(k);
    this.paint(k);
  },
  pointermove(e) {
    if (this.painting === null) return;
    const k = this.cellAt(e);
    if (k) this.paint(k);
  },
  pointerup() {
    if (this.painting === null) return;
    this.painting = null;
    start();
  },
  paint(k) {
    if (this.painting) this.walls.add(k); else this.walls.delete(k);
    draw();
  },
};

// ============================================================================
// Tiles
// ============================================================================

// A row of two colours and a gap. A tile can jump into the gap from up to
// three places away, costing the distance jumped. Goal: colours sorted.
const TILE_N = 4;
const COLORS = ['Y', 'B'];
const MOVE_MS = 380, PAUSE_MS = 260;

const tiles = {
  line: 'Goal: every red tile left of every black one. A tile jumps into the gap from up to three places away; the move costs the distance jumped.',
  algos: [['astar', 'A*'], ['greedy', 'Greedy best-first'], ['ids', 'Iterative deepening']],
  state: '', moving: null,

  newBoard() {
    // Skip near-solved deals; a two-move solution shows nothing.
    do { this.state = randomTileState(TILE_N, COLORS); } while (tileProblem(this.state, TILE_N, COLORS).heuristic(this.state) < 5);
    this.moving = null;
  },

  async run(algo, my) {
    const problem = tileProblem(this.state, TILE_N, COLORS, 'manhattan');
    const fn = { astar: aStar, greedy: greedyBestFirst, ids: (p) => iterativeDeepening(p, { maxExplored: 500_000 }) }[algo];
    const { path: route, stats: s } = fn(problem);
    if (!route) { stats([['explored', fmt(s.explored)], ['result', 'gave up']]); return; }
    let cost = 0;
    const show = (i) => stats([
      ['explored', fmt(s.explored)],
      ['moves', `${i}/${route.length - 1}`],
      ['cost', cost],
      ['ms', s.time.toFixed(1)],
    ]);
    show(0);
    for (let i = 1; i < route.length; i++) {
      if (my !== epoch) return;
      const from = route[i - 1].indexOf('_'), to = route[i].indexOf('_');
      // The tile that moves sits where the gap ends up, and lands where the gap was.
      const t0 = performance.now();
      while (performance.now() - t0 < MOVE_MS) {
        if (my !== epoch) return;
        this.moving = { from: to, to: from, t: (performance.now() - t0) / MOVE_MS };
        draw();
        await frame();
      }
      this.moving = null;
      this.state = route[i];
      cost += Math.abs(from - to);
      draw();
      show(i);
      await wait(PAUSE_MS);
    }
  },

  draw() {
    const n = this.state.length;
    const size = Math.min((W * 0.92) / n, H * 0.35, 96);
    const gap = Math.max(3, size * 0.08);
    const total = n * size - gap;
    const ox = (W - total) / 2, oy = (H - size) / 2;
    const fill = { Y: css('--accent'), B: css('--text') };
    ctx.strokeStyle = css('--border-strong');
    ctx.lineWidth = 1.5;
    for (let i = 0; i < n; i++) {
      // the gap's outline, drawn on the slot the tile is leaving too
      if (this.state[i] === '_' || (this.moving && this.moving.from === i)) {
        ctx.strokeRect(ox + i * size + 0.75, oy + 0.75, size - gap - 1.5, size - gap - 1.5);
      }
    }
    for (let i = 0; i < n; i++) {
      const ch = this.state[i];
      if (ch === '_') continue;
      let x = ox + i * size, y = oy;
      if (this.moving && this.moving.from === i) {
        const t = this.moving.t, e = t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
        x = ox + (i + (this.moving.to - i) * e) * size;
        y = oy - Math.sin(Math.PI * t) * size * 0.35; // hop, so jumps over other tiles read
      }
      ctx.fillStyle = fill[ch];
      ctx.fillRect(x, y, size - gap, size - gap);
    }
  },
};

// ============================================================================
// Tour
// ============================================================================

const CITIES = 12;           // Held-Karp proves the optimum up to 15
const ITERATIONS = { ga: 200, aco: 80 };
const TOUR_ANIM_MS = { ga: 5000, aco: 8000 };
const MAX_CITIES = 40;

const tour = {
  line: 'Visit every city once and come home by the shortest loop. Click to add or remove a city. Neither method promises the best one.',
  algos: [['ga', 'Genetic algorithm'], ['aco', 'Ant colony']],
  points: [], solver: null, ref: null, showRef: false,

  // Points live in a unit-height box as wide as the stage, so lengths are
  // comparable across runs and the layout keeps its shape on resize.
  newBoard() {
    const aspect = Math.max(0.6, Math.min(2.4, W / H || 1.6));
    this.points = Array.from({ length: CITIES }, () => ({
      x: 0.06 * aspect + Math.random() * aspect * 0.88,
      y: 0.06 + Math.random() * 0.88,
    }));
    this.aspect = aspect;
    this.solver = null;
    this.ref = null;
    this.showRef = false;
  },

  async run(algo, my) {
    this.showRef = false;
    this.ref = referenceTour(this.points);
    const solver = (algo === 'ga' ? createGA : createACO)(this.points);
    this.solver = solver;
    const target = ITERATIONS[algo];
    const perFrame = Math.max(1, Math.ceil(target / (TOUR_ANIM_MS[algo] / 16)));
    const label = this.ref.exact ? 'optimum' : 'best known';
    const show = () => {
      const gap = (solver.bestLength / this.ref.length - 1) * 100;
      stats([
        [algo === 'ga' ? 'generation' : 'round', solver.iteration],
        ['length', (solver.bestLength * 100).toFixed(1)],
        [`off ${label}`, gap < 0.05 ? '0%' : gap.toFixed(1) + '%'],
      ]);
    };
    while (solver.iteration < target) {
      if (my !== epoch) return;
      for (let i = 0; i < perFrame && solver.iteration < target; i++) solver.step();
      show();
      draw();
      await frame();
    }
    this.showRef = true;
    draw();
  },

  frame() {
    const s = Math.min(W / this.aspect, H);
    return { s, ox: (W - s * this.aspect) / 2, oy: (H - s) / 2 };
  },

  // Click empty space to plant a city, click a city to remove it.
  pointerdown(e) {
    const { s, ox, oy } = this.frame();
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - ox) / s, y = (e.clientY - rect.top - oy) / s;
    if (x < 0 || y < 0 || x > this.aspect || y > 1) return;
    const hit = this.points.findIndex((p) => Math.hypot(p.x - x, p.y - y) < 0.03);
    if (hit >= 0) { if (this.points.length > 4) this.points.splice(hit, 1); }
    else if (this.points.length < MAX_CITIES) this.points.push({ x, y });
    else return;
    this.solver = null;
    start();
  },

  draw() {
    const { s, ox, oy } = this.frame();
    const P = (i) => [ox + this.points[i].x * s, oy + this.points[i].y * s];
    const loop = (t) => {
      ctx.beginPath();
      t.forEach((c, i) => (i ? ctx.lineTo(...P(c)) : ctx.moveTo(...P(c))));
      ctx.closePath();
      ctx.stroke();
    };
    const sv = this.solver;
    if (sv) {
      const pop = sv.population || sv.lastTours || [];
      ctx.strokeStyle = css('--border-strong');
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 1;
      pop.slice(0, 40).forEach(loop);
      ctx.globalAlpha = 1;
    }
    if (this.showRef && this.ref) {
      ctx.strokeStyle = css('--text-dim');
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      loop(this.ref.tour);
      ctx.setLineDash([]);
    }
    if (sv && sv.best) {
      ctx.strokeStyle = css('--accent');
      ctx.lineWidth = 2.5;
      loop(sv.best);
    }
    ctx.fillStyle = css('--text');
    const r = Math.max(3, s * 0.012);
    this.points.forEach((_, i) => {
      const [x, y] = P(i);
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    });
  },
};

// ============================================================================
// Shell
// ============================================================================

const MODES = { path, tiles, tour };

function draw() {
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  ctx.clearRect(0, 0, W, H);
  mode.draw();
}

function start() {
  const my = ++epoch;
  mode.run(els.algo.value, my);
}

function select(name, { fresh = false } = {}) {
  epoch++;
  mode = MODES[name] || path;
  name = Object.keys(MODES).find((k) => MODES[k] === mode);
  document.querySelectorAll('.al-tabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === name));
  els.line.textContent = mode.line;
  els.algo.innerHTML = mode.algos.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
  els.algo.value = mode.algo || mode.algos[0][0]; // keep the pick across New board and tab switches
  buildDd();
  els.stats.textContent = '';
  if (fresh || !mode.ready) { mode.newBoard(); mode.ready = true; }
  history.replaceState(null, '', '#' + name);
  draw();
  start();
}

function resize() {
  const r = canvas.parentElement.getBoundingClientRect();
  if (!r.width || !r.height) return;
  W = r.width; H = r.height;
  canvas.width = Math.round(W * devicePixelRatio);
  canvas.height = Math.round(H * devicePixelRatio);
  if (!mode) return;
  if (mode.resize && mode.resize()) start();
  draw();
}

document.querySelectorAll('.al-tabs button').forEach((b) => b.addEventListener('click', () => select(b.dataset.tab)));
// Custom listbox over the hidden select (the native popup can't be themed); the select stays the source of truth.
const dd = { btn: $('al-dd-btn'), list: $('al-dd-list'), i: 0 };
function ddOpen(open) {
  dd.list.hidden = !open; dd.btn.setAttribute('aria-expanded', open);
  if (open) ddMark(els.algo.selectedIndex);
}
function ddMark(i) { dd.i = i; [...dd.list.children].forEach((li, n) => li.classList.toggle('act', n === i)); }
function ddPick(i) {
  els.algo.selectedIndex = i; ddOpen(false); dd.btn.focus();
  buildDd(); els.algo.dispatchEvent(new Event('change'));
}
function buildDd() {
  const opts = [...els.algo.options], cur = els.algo.selectedIndex;
  dd.btn.textContent = opts[cur] ? opts[cur].text : '';
  dd.list.innerHTML = opts.map((o, n) => `<li role="option" aria-selected="${n === cur}">${o.text}</li>`).join('');
  [...dd.list.children].forEach((li, n) => li.addEventListener('click', () => ddPick(n)));
}
dd.btn.addEventListener('click', () => ddOpen(dd.list.hidden));
dd.btn.addEventListener('keydown', (e) => {
  const n = els.algo.options.length;
  if (e.key === 'Escape') ddOpen(false);
  else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (dd.list.hidden) return ddOpen(true);
    ddMark((dd.i + (e.key === 'ArrowDown' ? 1 : n - 1)) % n);
  } else if ((e.key === 'Enter' || e.key === ' ') && !dd.list.hidden) { e.preventDefault(); ddPick(dd.i); }
});
document.addEventListener('pointerdown', (e) => { if (!e.target.closest('#al-dd')) ddOpen(false); });
els.algo.addEventListener('change', () => {
  mode.algo = els.algo.value; if (mode.clearTrace) mode.clearTrace(); start(); });
els.run.addEventListener('click', () => { if (mode.clearTrace) mode.clearTrace(); start(); });
els.fresh.addEventListener('click', () => select(Object.keys(MODES).find((k) => MODES[k] === mode), { fresh: true }));
for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'pointerleave']) {
  canvas.addEventListener(ev, (e) => {
    const h = mode[ev === 'pointerleave' ? 'pointerup' : ev];
    if (h) h.call(mode, e);
  });
}
// Redraw in the new colours when the theme flips.
new MutationObserver(() => mode && draw()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => mode && draw());
new ResizeObserver(resize).observe(canvas.parentElement);
addEventListener('hashchange', () => select(location.hash.slice(1)));

resize();
select(location.hash.slice(1));
