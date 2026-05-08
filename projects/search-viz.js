import {
  iterativeDeepening, aStar, beamSearch,
  randomInitialState, heuristics,
} from './search-core.mjs';

const COLORS = ['Y', 'B'];

const $ = (id) => document.getElementById(id);

const els = {
  algo: $('algo'),
  n: $('n'),
  nVal: $('nVal'),
  heur: $('heur'),
  beam: $('beam'),
  beamVal: $('beamVal'),
  speed: $('speed'),
  speedVal: $('speedVal'),
  run: $('run'),
  rand: $('rand'),
  board: $('board'),
  step: $('step'),
  totalSteps: $('totalSteps'),
  cost: $('cost'),
  explored: $('explored'),
  generated: $('generated'),
  pathLen: $('pathLen'),
  pathCost: $('pathCost'),
  runtime: $('runtime'),
  status: $('status'),
};

let currentState = randomInitialState(+els.n.value, COLORS);
let animationTimer = null;

function renderState(state, movingIndex = -1) {
  els.board.innerHTML = '';
  for (let i = 0; i < state.length; i++) {
    const ch = state[i];
    const tile = document.createElement('div');
    tile.className = 'se-tile';
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
    els.board.appendChild(tile);
  }
}

function setStats({ explored = 0, generated = 0, pathLen = 0, pathCost = 0, runtime = 0 }) {
  els.explored.textContent = explored.toLocaleString();
  els.generated.textContent = generated.toLocaleString();
  els.pathLen.textContent = pathLen;
  els.pathCost.textContent = pathCost;
  els.runtime.textContent = `${runtime.toFixed(1)} ms`;
}

function setStep(i, total, cost) {
  els.step.textContent = i;
  els.totalSteps.textContent = total;
  els.cost.textContent = cost;
}

function setStatus(msg, isError = false) {
  els.status.textContent = msg;
  els.status.classList.toggle('error', isError);
}

function updateControlVisibility() {
  const algo = els.algo.value;
  for (const label of document.querySelectorAll('label[data-when]')) {
    const allowed = label.dataset.when.split(',');
    label.style.display = allowed.includes(algo) ? '' : 'none';
  }
}

function pickAlgo() {
  const algo = els.algo.value;
  const n = +els.n.value;
  const heur = heuristics[els.heur.value];
  const beamWidth = +els.beam.value;
  if (algo === 'ids') return () => iterativeDeepening(currentState, n, COLORS);
  if (algo === 'astar') return () => aStar(currentState, n, COLORS, heur);
  if (algo === 'beam') return () => beamSearch(currentState, n, COLORS, beamWidth, heur);
}

function pathCost(path) {
  if (!path || path.length < 2) return 0;
  let cost = 0;
  for (let i = 1; i < path.length; i++) {
    const blankPrev = path[i - 1].indexOf('_');
    const blankNext = path[i].indexOf('_');
    cost += Math.abs(blankNext - blankPrev);
  }
  return cost;
}

function clearAnimation() {
  if (animationTimer) {
    clearTimeout(animationTimer);
    animationTimer = null;
  }
}

function animatePath(path) {
  clearAnimation();
  let i = 0;
  let runningCost = 0;

  const tick = () => {
    if (i >= path.length) {
      animationTimer = null;
      els.run.disabled = false;
      return;
    }
    if (i > 0) {
      const blankPrev = path[i - 1].indexOf('_');
      const blankNext = path[i].indexOf('_');
      runningCost += Math.abs(blankNext - blankPrev);
      renderState(path[i], blankPrev);
    } else {
      renderState(path[i]);
    }
    setStep(i, path.length - 1, runningCost);
    i++;
    animationTimer = setTimeout(tick, +els.speed.value);
  };
  tick();
}

function run() {
  clearAnimation();
  const algoFn = pickAlgo();
  setStatus('running...');
  els.run.disabled = true;

  requestAnimationFrame(() => {
    let result;
    try {
      result = algoFn();
    } catch (err) {
      setStatus(`error: ${err.message}`, true);
      els.run.disabled = false;
      return;
    }

    const { path, stats } = result;
    if (!path) {
      setStats({
        explored: stats.explored,
        generated: stats.generated,
        pathLen: 0,
        pathCost: 0,
        runtime: stats.time,
      });
      setStatus('no solution found within search limits.', true);
      els.run.disabled = false;
      return;
    }

    setStats({
      explored: stats.explored,
      generated: stats.generated,
      pathLen: path.length - 1,
      pathCost: pathCost(path),
      runtime: stats.time,
    });
    setStatus(`solved in ${(path.length - 1)} moves, cost ${pathCost(path)}.`);
    animatePath(path);
  });
}

function randomise() {
  clearAnimation();
  const n = +els.n.value;
  currentState = randomInitialState(n, COLORS);
  renderState(currentState);
  setStep(0, 0, 0);
  setStats({});
  setStatus('');
  els.run.disabled = false;
}

els.n.addEventListener('input', () => {
  els.nVal.textContent = els.n.value;
  randomise();
});
els.beam.addEventListener('input', () => {
  els.beamVal.textContent = els.beam.value;
});
els.speed.addEventListener('input', () => {
  els.speedVal.textContent = `${els.speed.value}ms`;
});
els.algo.addEventListener('change', updateControlVisibility);
els.run.addEventListener('click', run);
els.rand.addEventListener('click', randomise);

els.nVal.textContent = els.n.value;
els.beamVal.textContent = els.beam.value;
els.speedVal.textContent = `${els.speed.value}ms`;
updateControlVisibility();
renderState(currentState);
setStep(0, 0, 0);
