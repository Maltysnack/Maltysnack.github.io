import {
  iterativeDeepening, aStar, beamSearch, bfs, greedyBestFirst,
  algorithmDescriptions,
} from './algo-core.mjs?v=3';
import { randomTileState, tileProblem, tileHeuristicDescriptions } from './algo-tile.mjs?v=3';
import { key, fromKey, gridProblem, gridHeuristicDescriptions } from './algo-grid.mjs?v=3';

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
