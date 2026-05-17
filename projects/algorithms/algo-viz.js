import {
  iterativeDeepening, aStar, beamSearch, bfs, greedyBestFirst,
  algorithmDescriptions,
} from './algo-core.mjs?v=9';
import { randomTileState, tileProblem, tileHeuristicDescriptions } from './algo-tile.mjs?v=9';
import { key, fromKey, gridProblem, gridHeuristicDescriptions } from './algo-grid.mjs?v=9';
import { createGA, createACO, tspAlgorithmDescriptions, tspAlgorithmLabels } from './algo-tsp.mjs?v=9';

const ALGO_LABELS = {
  ids: 'Iterative deepening',
  astar: 'A*',
  greedy: 'Greedy best-first',
  beam: 'Beam',
  bfs: 'Breadth-first',
};

const TILE_HEUR_LABELS = {
  misplaced: 'Misplaced',
  manhattan: 'Manhattan',
  inversions: 'Inversions',
  blocks: 'Blocks',
};

const GRID_HEUR_LABELS = {
  manhattan: 'Manhattan',
  euclidean: 'Euclidean',
};

const $ = (id) => document.getElementById(id);

const TILE_FRAME_MS = 150;
// Grid animation targets a roughly fixed total time; per-cell delay is
// computed from the visited count so big searches don't take forever.
const GRID_TARGET_TOTAL_MS = 3000;
const GRID_FRAME_MS = 16;
const GRID_MIN_PER_CELL_MS = 4;

// ============================================================================
// Tile puzzle
// ============================================================================

const COLORS = ['Y', 'B'];
const tEls = {
  algo: $('t-algo'), n: $('t-n'), nVal: $('t-nVal'),
  heur: $('t-heur'),
  algoTag: $('t-algoTag'), algoDesc: $('t-algoDesc'),
  heurTag: $('t-heurTag'), heurDesc: $('t-heurDesc'),
  beam: $('t-beam'), beamVal: $('t-beamVal'),
  run: $('t-run'), rand: $('t-rand'),
  board: $('t-board'),
  step: $('t-step'), totalSteps: $('t-totalSteps'), cost: $('t-cost'),
  explored: $('t-explored'), generated: $('t-generated'),
  pathLen: $('t-pathLen'), pathCost: $('t-pathCost'),
  runtime: $('t-runtime'), status: $('t-status'),
};

let tileState = randomTileState(+tEls.n.value, COLORS);
let tileTimer = null;

function renderTile(state, movingIndex = -1) {
  tEls.board.innerHTML = '';
  for (let i = 0; i < state.length; i++) {
    const ch = state[i];
    const tile = document.createElement('div');
    tile.className = 'al-tile';
    if (ch === '_') {
      tile.classList.add('blank');
    } else if (ch === COLORS[0]) {
      tile.classList.add('a');
      tile.textContent = ch;
    } else {
      tile.classList.add('b');
      tile.textContent = ch;
    }
    if (i === movingIndex) tile.classList.add('moving');
    tEls.board.appendChild(tile);
  }
}

function tileMoveCost(prev, next) {
  return Math.abs(next.indexOf('_') - prev.indexOf('_'));
}

function tilePathCost(path) {
  if (!path || path.length < 2) return 0;
  let c = 0;
  for (let i = 1; i < path.length; i++) c += tileMoveCost(path[i - 1], path[i]);
  return c;
}

function tileSetStats({ explored = 0, generated = 0, pathLen = 0, pathCost = 0, runtime = 0 }) {
  tEls.explored.textContent = explored.toLocaleString();
  tEls.generated.textContent = generated.toLocaleString();
  tEls.pathLen.textContent = pathLen;
  tEls.pathCost.textContent = pathCost;
  tEls.runtime.textContent = `${runtime.toFixed(1)} ms`;
}

function tileSetStep(i, total, cost) {
  tEls.step.textContent = i;
  tEls.totalSteps.textContent = total;
  tEls.cost.textContent = cost;
}

function tileSetStatus(msg, isError = false) {
  tEls.status.textContent = msg;
  tEls.status.classList.toggle('error', isError);
}

function tileClearAnim() {
  if (tileTimer) clearTimeout(tileTimer);
  tileTimer = null;
}

function tileAnimate(path) {
  tileClearAnim();
  let i = 0, runningCost = 0;
  const tick = () => {
    if (i >= path.length) {
      tileTimer = null;
      tEls.run.disabled = false;
      return;
    }
    if (i > 0) {
      const prev = path[i - 1].indexOf('_');
      runningCost += tileMoveCost(path[i - 1], path[i]);
      renderTile(path[i], prev);
    } else {
      renderTile(path[i]);
    }
    tileSetStep(i, path.length - 1, runningCost);
    i++;
    tileTimer = setTimeout(tick, TILE_FRAME_MS);
  };
  tick();
}

function tilePickAlgo() {
  const algo = tEls.algo.value;
  const n = +tEls.n.value;
  const heur = tEls.heur.value;
  const beamWidth = +tEls.beam.value;
  const problem = tileProblem(tileState, n, COLORS, heur);
  if (algo === 'ids') return () => iterativeDeepening(problem, { maxExplored: 500_000 });
  if (algo === 'astar') return () => aStar(problem);
  if (algo === 'greedy') return () => greedyBestFirst(problem);
  if (algo === 'beam') return () => beamSearch(problem, { beamWidth });
}

function tileUpdateDescriptions() {
  const algo = tEls.algo.value;
  if (tEls.algoTag) tEls.algoTag.textContent = ALGO_LABELS[algo] ?? '';
  if (tEls.algoDesc) tEls.algoDesc.textContent = algorithmDescriptions[algo] ?? '';
  const showHeur = ['astar', 'greedy', 'beam'].includes(algo);
  const heurLine = tEls.heurTag?.parentElement;
  if (heurLine) heurLine.style.display = showHeur ? '' : 'none';
  if (!showHeur) return;
  if (tEls.heurTag) tEls.heurTag.textContent = TILE_HEUR_LABELS[tEls.heur.value] ?? '';
  if (tEls.heurDesc) tEls.heurDesc.textContent = tileHeuristicDescriptions[tEls.heur.value] ?? '';
}

function tileRun() {
  tileClearAnim();
  const algoFn = tilePickAlgo();
  tileSetStatus('running...');
  tEls.run.disabled = true;
  setTimeout(() => {
    let result;
    try { result = algoFn(); }
    catch (err) {
      tileSetStatus(`error: ${err.message}`, true);
      tEls.run.disabled = false;
      return;
    }
    const { path, stats } = result;
    if (!path) {
      tileSetStats({ explored: stats.explored, generated: stats.generated, pathLen: 0, pathCost: 0, runtime: stats.time });
      const reason = stats.hitBudget ? 'search budget exhausted before finding a goal.' : 'no solution found.';
      tileSetStatus(reason, true);
      tEls.run.disabled = false;
      return;
    }
    tileSetStats({
      explored: stats.explored, generated: stats.generated,
      pathLen: path.length - 1, pathCost: tilePathCost(path), runtime: stats.time,
    });
    tileSetStatus(`solved in ${path.length - 1} moves, cost ${tilePathCost(path)}.`);
    tileAnimate(path);
  });
}

function tileRandomise() {
  tileClearAnim();
  tileState = randomTileState(+tEls.n.value, COLORS);
  renderTile(tileState);
  tileSetStep(0, 0, 0);
  tileSetStats({});
  tileSetStatus('');
  tEls.run.disabled = false;
}

function tileUpdateVisibility() {
  const algo = tEls.algo.value;
  const scope = tEls.algo.closest('section, .panel, [data-section="tile"]') || document;
  for (const label of scope.querySelectorAll('label[data-when]')) {
    const allowed = label.dataset.when.split(',');
    label.style.display = allowed.includes(algo) ? '' : 'none';
  }
}

tEls.n.addEventListener('input', () => { tEls.nVal.textContent = tEls.n.value; tileRandomise(); });
tEls.beam.addEventListener('input', () => { tEls.beamVal.textContent = tEls.beam.value; });
tEls.algo.addEventListener('change', () => { tileUpdateVisibility(); tileUpdateDescriptions(); });
tEls.heur.addEventListener('change', tileUpdateDescriptions);
tEls.run.addEventListener('click', tileRun);
tEls.rand.addEventListener('click', tileRandomise);
tEls.nVal.textContent = tEls.n.value;
tEls.beamVal.textContent = tEls.beam.value;
tileUpdateVisibility();
tileUpdateDescriptions();
renderTile(tileState);
tileSetStep(0, 0, 0);

// ============================================================================
// Grid pathfinder
// ============================================================================

const ROWS = 32, COLS = 64;
const START = key(Math.floor(ROWS / 2), 2);
const GOAL  = key(Math.floor(ROWS / 2), COLS - 3);

const gEls = {
  algo: $('g-algo'), heur: $('g-heur'),
  algoTag: $('g-algoTag'), algoDesc: $('g-algoDesc'),
  heurTag: $('g-heurTag'), heurDesc: $('g-heurDesc'),
  beam: $('g-beam'), beamVal: $('g-beamVal'),
  run: $('g-run'), clear: $('g-clear'), randWalls: $('g-randWalls'),
  grid: $('g-grid'),
  explored: $('g-explored'), generated: $('g-generated'),
  pathLen: $('g-pathLen'), runtime: $('g-runtime'),
  status: $('g-status'),
};

let walls = new Set();
let gridTimer = null;

function buildGrid() {
  gEls.grid.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
  gEls.grid.innerHTML = '';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'al-cell';
      cell.dataset.k = key(r, c);
      if (cell.dataset.k === START) { cell.classList.add('start'); cell.textContent = 'S'; }
      else if (cell.dataset.k === GOAL) { cell.classList.add('goal'); cell.textContent = 'G'; }
      gEls.grid.appendChild(cell);
    }
  }
}

function refreshWalls() {
  for (const cell of gEls.grid.children) {
    const k = cell.dataset.k;
    if (k === START || k === GOAL) continue;
    cell.classList.toggle('wall', walls.has(k));
    cell.classList.remove('explored', 'path');
  }
}

function clearTrace() {
  for (const cell of gEls.grid.children) cell.classList.remove('explored', 'path');
}

function gridSetStats({ explored = 0, generated = 0, pathLen = 0, runtime = 0 }) {
  gEls.explored.textContent = explored.toLocaleString();
  gEls.generated.textContent = generated.toLocaleString();
  gEls.pathLen.textContent = pathLen;
  gEls.runtime.textContent = `${runtime.toFixed(1)} ms`;
}

function gridSetStatus(msg, isError = false) {
  gEls.status.textContent = msg;
  gEls.status.classList.toggle('error', isError);
}

function gridClearAnim() {
  if (gridTimer) clearTimeout(gridTimer);
  gridTimer = null;
}

let isPainting = false, paintMode = null;

function paintAtPoint(clientX, clientY) {
  const elem = document.elementFromPoint(clientX, clientY);
  if (!elem) return;
  const cell = elem.closest('.al-cell');
  if (!cell) return;
  const k = cell.dataset.k;
  if (k === START || k === GOAL) return;
  togglePaint(k, cell);
}

function startPaint(target) {
  const cell = target.closest('.al-cell');
  if (!cell) return false;
  const k = cell.dataset.k;
  if (k === START || k === GOAL) return false;
  isPainting = true;
  paintMode = walls.has(k) ? 'erase' : 'paint';
  togglePaint(k, cell);
  return true;
}

gEls.grid.addEventListener('mousedown', (e) => { startPaint(e.target); });
gEls.grid.addEventListener('mousemove', (e) => {
  if (!isPainting) return;
  paintAtPoint(e.clientX, e.clientY);
});
window.addEventListener('mouseup', () => { isPainting = false; });

// Touch support: prevent scroll-while-painting and route touches to the paint logic.
gEls.grid.addEventListener('touchstart', (e) => {
  const touch = e.touches[0];
  if (!touch) return;
  if (startPaint(document.elementFromPoint(touch.clientX, touch.clientY))) e.preventDefault();
}, { passive: false });
gEls.grid.addEventListener('touchmove', (e) => {
  if (!isPainting) return;
  e.preventDefault();
  const touch = e.touches[0];
  if (!touch) return;
  paintAtPoint(touch.clientX, touch.clientY);
}, { passive: false });
window.addEventListener('touchend', () => { isPainting = false; });

function togglePaint(k, cell) {
  if (paintMode === 'paint' && !walls.has(k)) {
    walls.add(k);
    cell.classList.add('wall');
  } else if (paintMode === 'erase' && walls.has(k)) {
    walls.delete(k);
    cell.classList.remove('wall');
  }
}

function getCell(k) {
  return gEls.grid.querySelector(`[data-k="${CSS.escape(k)}"]`);
}

function gridPickAlgo() {
  const algo = gEls.algo.value;
  const heur = gEls.heur.value;
  const beamWidth = +gEls.beam.value;
  const grid = { rows: ROWS, cols: COLS, walls };
  const problem = gridProblem(grid, START, GOAL, heur);
  if (algo === 'bfs') return (onVisit) => bfs(problem, { onVisit });
  if (algo === 'astar') return (onVisit) => aStar(problem, { onVisit });
  if (algo === 'greedy') return (onVisit) => greedyBestFirst(problem, { onVisit });
  if (algo === 'beam') return (onVisit) => beamSearch(problem, { beamWidth, onVisit });
}

function gridUpdateDescriptions() {
  const algo = gEls.algo.value;
  if (gEls.algoTag) gEls.algoTag.textContent = ALGO_LABELS[algo] ?? '';
  if (gEls.algoDesc) gEls.algoDesc.textContent = algorithmDescriptions[algo] ?? '';
  const showHeur = ['astar', 'greedy', 'beam'].includes(algo);
  const heurLine = gEls.heurTag?.parentElement;
  if (heurLine) heurLine.style.display = showHeur ? '' : 'none';
  if (!showHeur) return;
  if (gEls.heurTag) gEls.heurTag.textContent = GRID_HEUR_LABELS[gEls.heur.value] ?? '';
  if (gEls.heurDesc) gEls.heurDesc.textContent = gridHeuristicDescriptions[gEls.heur.value] ?? '';
}

function gridAnimateExploration(visited, path) {
  gridClearAnim();
  // Either delay-per-cell at min rate, or batch many cells per frame on big runs.
  const idealDelay = visited.length ? GRID_TARGET_TOTAL_MS / visited.length : GRID_FRAME_MS;
  const cellsPerFrame = Math.max(1, Math.ceil(GRID_FRAME_MS / Math.max(idealDelay, GRID_MIN_PER_CELL_MS)));
  const frameDelay = Math.max(GRID_MIN_PER_CELL_MS, Math.min(GRID_FRAME_MS, idealDelay));
  let i = 0;
  const tick = () => {
    if (i >= visited.length) {
      animatePath(path);
      return;
    }
    const stop = Math.min(visited.length, i + cellsPerFrame);
    for (; i < stop; i++) {
      const k = visited[i];
      if (k !== START && k !== GOAL) {
        const cell = getCell(k);
        if (cell) cell.classList.add('explored');
      }
    }
    gridTimer = setTimeout(tick, frameDelay);
  };
  tick();
}

function animatePath(path) {
  if (!path) {
    gridTimer = null;
    gEls.run.disabled = false;
    return;
  }
  let i = 0;
  const delay = Math.max(GRID_MIN_PER_CELL_MS, Math.min(40, 1500 / Math.max(path.length, 1)));
  const tick = () => {
    if (i >= path.length) {
      gridTimer = null;
      gEls.run.disabled = false;
      return;
    }
    const k = path[i];
    if (k !== START && k !== GOAL) {
      const cell = getCell(k);
      if (cell) cell.classList.add('path');
    }
    i++;
    gridTimer = setTimeout(tick, delay);
  };
  tick();
}

function gridRun() {
  gridClearAnim();
  clearTrace();
  const algoFn = gridPickAlgo();
  gridSetStatus('running...');
  gEls.run.disabled = true;
  setTimeout(() => {
    const visited = [];
    let result;
    try { result = algoFn((s) => visited.push(s)); }
    catch (err) {
      gridSetStatus(`error: ${err.message}`, true);
      gEls.run.disabled = false;
      return;
    }
    const { path, stats } = result;
    if (!path) {
      gridSetStats({ explored: stats.explored, generated: stats.generated, pathLen: 0, runtime: stats.time });
      const reason = stats.hitBudget ? 'search budget exhausted.' : 'no path between S and G.';
      gridSetStatus(reason, true);
      gridAnimateExploration(visited, null);
      return;
    }
    gridSetStats({
      explored: stats.explored, generated: stats.generated,
      pathLen: path.length - 1, runtime: stats.time,
    });
    gridSetStatus(`path of ${path.length - 1} steps after exploring ${stats.explored} cells.`);
    gridAnimateExploration(visited, path);
  });
}

function gridUpdateVisibility() {
  const algo = gEls.algo.value;
  const scope = gEls.algo.closest('section, .panel, [data-section="grid"]') || document;
  for (const label of scope.querySelectorAll('label[data-when]')) {
    const allowed = label.dataset.when.split(',');
    label.style.display = allowed.includes(algo) ? '' : 'none';
  }
}

function gridClearWalls() {
  walls = new Set();
  refreshWalls();
  gridSetStats({});
  gridSetStatus('');
  gEls.run.disabled = false;
}

function gridRandomWalls() {
  walls = new Set();
  const density = 0.25;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const k = key(r, c);
      if (k === START || k === GOAL) continue;
      if (Math.random() < density) walls.add(k);
    }
  }
  refreshWalls();
  gridSetStats({});
  gridSetStatus('');
  gEls.run.disabled = false;
}

gEls.beam.addEventListener('input', () => { gEls.beamVal.textContent = gEls.beam.value; });
gEls.algo.addEventListener('change', () => { gridUpdateVisibility(); gridUpdateDescriptions(); });
gEls.heur.addEventListener('change', gridUpdateDescriptions);
gEls.run.addEventListener('click', gridRun);
gEls.clear.addEventListener('click', gridClearWalls);
gEls.randWalls.addEventListener('click', gridRandomWalls);
gEls.beamVal.textContent = gEls.beam.value;
buildGrid();
gridUpdateVisibility();
gridUpdateDescriptions();

// ============================================================================
// Tour planning (TSP)
// ============================================================================

const CANVAS_W = 1000, CANVAS_H = 600;
const SVG_NS = 'http://www.w3.org/2000/svg';
// New flow: run K iterations rapidly in the background, then reveal the best
// tour edge-by-edge from a fixed starting city. The user sees one clear
// answer being constructed, the way the grid pathfinder reveals its path.
const ITERATIONS_PER_RUN = { ga: 200, aco: 80 };
const COMPUTE_BUDGET_MS = 12;
const REVEAL_EDGE_MS = 280;       // ms per segment when interpolating
const REVEAL_INITIAL_PAUSE_MS = 500;

const rEls = {
  algo: $('r-algo'), n: $('r-n'), nVal: $('r-nVal'),
  pop: $('r-pop'), popVal: $('r-popVal'),
  mut: $('r-mut'), mutVal: $('r-mutVal'),
  ants: $('r-ants'), antsVal: $('r-antsVal'),
  evap: $('r-evap'), evapVal: $('r-evapVal'),
  run: $('r-run'), stop: $('r-stop'), rand: $('r-rand'), clear: $('r-clear'),
  canvas: $('r-canvas'),
  algoTag: $('r-algoTag'), algoDesc: $('r-algoDesc'),
  iter: $('r-iter'), best: $('r-best'),
  improve: $('r-improve'),
  status: $('r-status'),
};

let points = [];
let tourAlgo = null;
let tourTimer = null;
let tourStartTime = 0;
let tourInitialBest = 0;

function rerollPoints(count) {
  const margin = 30;
  return Array.from({ length: count }, () => ({
    x: margin + Math.random() * (CANVAS_W - 2 * margin),
    y: margin + Math.random() * (CANVAS_H - 2 * margin),
  }));
}

function tourPath(tour) {
  if (!tour || tour.length < 2) return '';
  let d = '';
  for (let i = 0; i < tour.length; i++) {
    const p = points[tour[i]];
    d += (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ' ' + p.y.toFixed(1);
  }
  return d + 'Z';
}

function drawPointsOnly() {
  rEls.canvas.innerHTML = '';
  appendPoints();
}

function appendPoints() {
  for (let i = 0; i < points.length; i++) {
    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('cx', points[i].x);
    c.setAttribute('cy', points[i].y);
    c.setAttribute('r', 5);
    c.classList.add('al-point');
    c.dataset.idx = i;
    rEls.canvas.appendChild(c);
  }
}

function rebuildCanvas() {
  drawPointsOnly();
}

function tourClearAlgo() {
  if (tourTimer) { clearTimeout(tourTimer); tourTimer = null; }
  tourAlgo = null;
}

function tourSetStats() {
  if (!tourAlgo) {
    rEls.iter.textContent = '0';
    rEls.best.textContent = '0';
    rEls.improve.textContent = '0%';
    return;
  }
  rEls.iter.textContent = tourAlgo.iteration.toLocaleString();
  rEls.best.textContent = tourAlgo.bestLength.toFixed(0);
  const improvement = tourInitialBest
    ? ((tourInitialBest - tourAlgo.bestLength) / tourInitialBest * 100)
    : 0;
  rEls.improve.textContent = `${improvement.toFixed(1)}%`;
}

function tourSetStatus(msg, isError = false) {
  rEls.status.textContent = msg;
  rEls.status.classList.toggle('error', isError);
}

function tourUpdateVisibility() {
  const algo = rEls.algo.value;
  for (const label of document.querySelectorAll('[data-section="tour"] label[data-when]')) {
    const allowed = label.dataset.when.split(',');
    label.style.display = allowed.includes(algo) ? '' : 'none';
  }
}

function tourUpdateDescriptions() {
  const algo = rEls.algo.value;
  rEls.algoTag.textContent = tspAlgorithmLabels[algo] ?? '';
  rEls.algoDesc.textContent = tspAlgorithmDescriptions[algo] ?? '';
}

function tourBuildAlgo() {
  const algo = rEls.algo.value;
  if (algo === 'ga') {
    return createGA(points, {
      populationSize: +rEls.pop.value,
      mutationRate: +rEls.mut.value / 100,
    });
  }
  return createACO(points, {
    numAnts: +rEls.ants.value,
    evaporation: +rEls.evap.value / 100,
  });
}

// Pick a consistent starting city for the reveal: the leftmost point. Stable
// regardless of which ordering the algorithm picked internally.
function pickStartCity() {
  let best = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].x < points[best].x) best = i;
    else if (points[i].x === points[best].x && points[i].y < points[best].y) best = i;
  }
  return best;
}

function rotateTourToStart(tour, startCity) {
  const i = tour.indexOf(startCity);
  if (i <= 0) return tour;
  return [...tour.slice(i), ...tour.slice(0, i)];
}

// Phase 1: run the algorithm in time-budgeted chunks, yielding to the UI
// between chunks so the iteration counter ticks up smoothly.
function runIterations(target, onDone) {
  function tick() {
    if (!tourAlgo) return;                // stopped
    if (tourAlgo.iteration >= target) { onDone(); return; }
    const t0 = performance.now();
    while (tourAlgo.iteration < target && performance.now() - t0 < COMPUTE_BUDGET_MS) {
      tourAlgo.step();
    }
    tourSetStats();
    tourSetStatus(`searching... iteration ${tourAlgo.iteration} / ${target}`);
    tourTimer = setTimeout(tick, 0);
  }
  tick();
}

// Phase 2: draw the best tour edge-by-edge from the chosen starting city.
// Continuous reveal: a single growing path. Each segment interpolates from
// the last city to the next over REVEAL_EDGE_MS, so the line keeps moving
// instead of snapping then pausing.
function revealTour(tour, onDone) {
  const startCity = pickStartCity();
  const ordered = rotateTourToStart(tour, startCity);
  const visit = [...ordered, ordered[0]];

  // Draw start marker once and a single path element we mutate in place.
  drawPointsOnly();
  const sp = points[startCity];
  const ring = document.createElementNS(SVG_NS, 'circle');
  ring.setAttribute('cx', sp.x);
  ring.setAttribute('cy', sp.y);
  ring.setAttribute('r', 11);
  ring.classList.add('al-start-marker');
  rEls.canvas.insertBefore(ring, rEls.canvas.firstChild);

  const label = document.createElementNS(SVG_NS, 'text');
  label.setAttribute('x', sp.x);
  label.setAttribute('y', sp.y - 16);
  label.setAttribute('text-anchor', 'middle');
  label.classList.add('al-start-label');
  label.textContent = 'START';
  rEls.canvas.appendChild(label);

  const path = document.createElementNS(SVG_NS, 'path');
  path.classList.add('al-edge');
  // Insert after start ring, before points.
  rEls.canvas.insertBefore(path, ring.nextSibling);

  // Pre-build the prefix string up to (but not including) the current
  // segment so each frame only appends one interpolated L-command.
  const prefixes = [`M${points[visit[0]].x.toFixed(1)} ${points[visit[0]].y.toFixed(1)}`];
  for (let i = 1; i < visit.length; i++) {
    const p = points[visit[i]];
    prefixes.push(prefixes[i - 1] + `L${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
  }

  let segIdx = 0;            // index of the segment currently being drawn (visit[segIdx] -> visit[segIdx+1])
  let segStart = 0;          // timestamp when current segment began
  let started = false;

  function frame(now) {
    if (!tourAlgo) return;
    if (!started) { segStart = now; started = true; }

    const a = points[visit[segIdx]];
    const b = points[visit[segIdx + 1]];
    const t = Math.min(1, (now - segStart) / REVEAL_EDGE_MS);
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    path.setAttribute('d', prefixes[segIdx] + `L${x.toFixed(1)} ${y.toFixed(1)}`);

    if (t >= 1) {
      segIdx++;
      if (segIdx >= visit.length - 1) {
        // Tour complete: snap to final closed path and finish.
        path.setAttribute('d', prefixes[visit.length - 1]);
        onDone();
        return;
      }
      tourSetStatus(`drawing tour: ${segIdx} / ${visit.length - 1} edges`);
      segStart = now;
    }
    tourTimer = setTimeout(() => frame(performance.now()), 16);
  }

  tourSetStatus('drawing tour from START...');
  // Pause briefly with just the start marker showing, then begin animation.
  tourTimer = setTimeout(() => frame(performance.now()), REVEAL_INITIAL_PAUSE_MS);
}

function tourRun() {
  if (points.length < 4) {
    tourSetStatus('Need at least 4 points.', true);
    return;
  }
  tourClearAlgo();
  tourAlgo = tourBuildAlgo();
  tourInitialBest = tourAlgo.bestLength;
  tourStartTime = performance.now();
  rEls.run.disabled = true;
  rEls.stop.disabled = false;
  drawPointsOnly();
  tourSetStats();
  tourSetStatus('starting search...');

  const target = ITERATIONS_PER_RUN[rEls.algo.value] ?? 100;
  runIterations(target, () => {
    if (!tourAlgo) return;
    revealTour(tourAlgo.best, () => {
      const length = tourAlgo.bestLength.toFixed(0);
      const improvement = ((tourInitialBest - tourAlgo.bestLength) / tourInitialBest * 100).toFixed(1);
      tourSetStatus(`done. best tour length ${length}, ${improvement}% better than the random starting tour.`);
      rEls.run.disabled = false;
      rEls.stop.disabled = true;
    });
  });
}

function tourStop() {
  if (tourTimer) { clearTimeout(tourTimer); tourTimer = null; }
  rEls.run.disabled = false;
  rEls.stop.disabled = true;
  if (tourAlgo) tourSetStatus(`stopped at iteration ${tourAlgo.iteration}, best length ${tourAlgo.bestLength.toFixed(0)}.`);
  else tourSetStatus('');
}

function tourRandomise() {
  tourStop();
  tourClearAlgo();
  points = rerollPoints(+rEls.n.value);
  rebuildCanvas();

  tourSetStats();
  tourSetStatus('');
}

function tourClear() {
  tourStop();
  tourClearAlgo();
  points = [];
  rebuildCanvas();

  tourSetStats();
  tourSetStatus('Click in the canvas to place points.');
  rEls.nVal.textContent = '0';
}

function svgPoint(evt) {
  const rect = rEls.canvas.getBoundingClientRect();
  const x = ((evt.clientX - rect.left) / rect.width) * CANVAS_W;
  const y = ((evt.clientY - rect.top) / rect.height) * CANVAS_H;
  return { x, y };
}

rEls.canvas.addEventListener('click', (e) => {
  // Did we click on an existing point? Remove it.
  const target = e.target;
  if (target.classList.contains('al-point')) {
    const idx = +target.dataset.idx;
    points.splice(idx, 1);
    if (tourAlgo) tourStop();
    tourClearAlgo();
    rebuildCanvas();
    rEls.nVal.textContent = points.length;
    rEls.n.value = Math.min(rEls.n.max, Math.max(rEls.n.min, points.length || rEls.n.min));
    return;
  }
  const { x, y } = svgPoint(e);
  points.push({ x, y });
  if (tourAlgo) tourStop();
  tourClearAlgo();
  rebuildCanvas();
  rEls.nVal.textContent = points.length;
  rEls.n.value = Math.min(rEls.n.max, Math.max(rEls.n.min, points.length || rEls.n.min));
  tourSetStatus('');
});

rEls.n.addEventListener('input', () => {
  rEls.nVal.textContent = rEls.n.value;
});
rEls.n.addEventListener('change', () => {
  // Only rebuild on commit (avoids thrashing while sliding).
  tourRandomise();
});
rEls.pop.addEventListener('input', () => { rEls.popVal.textContent = rEls.pop.value; });
rEls.mut.addEventListener('input', () => { rEls.mutVal.textContent = (+rEls.mut.value / 100).toFixed(2); });
rEls.ants.addEventListener('input', () => { rEls.antsVal.textContent = rEls.ants.value; });
rEls.evap.addEventListener('input', () => { rEls.evapVal.textContent = (+rEls.evap.value / 100).toFixed(2); });
rEls.algo.addEventListener('change', () => { tourUpdateVisibility(); tourUpdateDescriptions(); });
rEls.run.addEventListener('click', tourRun);
rEls.stop.addEventListener('click', tourStop);
rEls.rand.addEventListener('click', tourRandomise);
rEls.clear.addEventListener('click', tourClear);

// init
rEls.nVal.textContent = rEls.n.value;
rEls.popVal.textContent = rEls.pop.value;
rEls.mutVal.textContent = (+rEls.mut.value / 100).toFixed(2);
rEls.antsVal.textContent = rEls.ants.value;
rEls.evapVal.textContent = (+rEls.evap.value / 100).toFixed(2);
rEls.stop.disabled = true;
points = rerollPoints(+rEls.n.value);
drawPointsOnly();

tourSetStats();
tourUpdateVisibility();
tourUpdateDescriptions();
