// Sliding-tile puzzle search algorithms.
//
// State is a string of n copies of colors[0], n copies of colors[1], and one '_'
// for the blank. The blank can move to an adjacent cell, hop one tile, or hop
// two tiles. Goal: all of colors[0] left of all of colors[1]; blank anywhere.
//
// IDS treats every move as cost 1.
// A* and Beam use cost = 1 (slide) / 2 (hop one) / 3 (hop two).

export function isGoal(state, n, colors) {
  const tiles = state.replace('_', '');
  return tiles === colors[0].repeat(n) + colors[1].repeat(n);
}

function swap(state, i, j) {
  const a = state.split('');
  [a[i], a[j]] = [a[j], a[i]];
  return a.join('');
}

// Returns [{ state, cost }, ...] where cost reflects move type.
export function successors(state) {
  const blank = state.indexOf('_');
  const len = state.length;
  const out = [];
  for (const delta of [1, 2, 3]) {
    if (blank - delta >= 0) out.push({ state: swap(state, blank, blank - delta), cost: delta });
    if (blank + delta < len) out.push({ state: swap(state, blank, blank + delta), cost: delta });
  }
  return out;
}

// IDS uses uniform cost 1, so it just enumerates successor states.
function successorStates(state) {
  return successors(state).map(s => s.state);
}

export function randomInitialState(n, colors) {
  const tiles = [...colors[0].repeat(n), ...colors[1].repeat(n), '_'];
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles.join('');
}

// ---------- heuristics ----------

export function heuristicMisplaced(state, n, colors) {
  const tiles = state.replace('_', '');
  const goal = colors[0].repeat(n) + colors[1].repeat(n);
  let h = 0;
  for (let i = 0; i < tiles.length; i++) if (tiles[i] !== goal[i]) h++;
  return h;
}

export function heuristicManhattan(state, n, colors) {
  const tiles = state.replace('_', '');
  const goal = colors[0].repeat(n) + colors[1].repeat(n);
  const goalPos = { [colors[0]]: [], [colors[1]]: [] };
  for (let i = 0; i < goal.length; i++) goalPos[goal[i]].push(i);
  let h = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === goal[i]) continue;
    const cands = goalPos[tiles[i]];
    let best = Infinity;
    for (const j of cands) best = Math.min(best, Math.abs(i - j));
    h += best;
  }
  return h;
}

// Number of (second-colour, first-colour) pairs where the second-colour tile is
// left of the first-colour tile. Each inversion needs at least one move to
// resolve, so this is admissible.
export function heuristicInversions(state, n, colors) {
  const tiles = state.replace('_', '');
  let h = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] !== colors[1]) continue;
    for (let j = i + 1; j < tiles.length; j++) {
      if (tiles[j] === colors[0]) h++;
    }
  }
  return h;
}

// Goal has exactly two contiguous runs of colour. Count current runs and
// return the excess. Admissible: collapsing a run takes at least one move.
export function heuristicBlocks(state, n, colors) {
  const tiles = state.replace('_', '');
  if (!tiles.length) return 0;
  let runs = 1;
  for (let i = 1; i < tiles.length; i++) {
    if (tiles[i] !== tiles[i - 1]) runs++;
  }
  return Math.max(0, runs - 2);
}

export const heuristics = {
  misplaced: heuristicMisplaced,
  manhattan: heuristicManhattan,
  inversions: heuristicInversions,
  blocks: heuristicBlocks,
};

// ---------- iterative deepening ----------

export function iterativeDeepening(initial, n, colors, opts = {}) {
  const maxDepth = opts.maxDepth ?? 50;
  const stats = { explored: 0, generated: 0, time: 0 };
  const start = performance.now();

  function dls(state, limit, path, pathSet) {
    stats.explored++;
    if (isGoal(state, n, colors)) return path;
    if (limit === 0) return null;
    for (const next of successorStates(state)) {
      stats.generated++;
      if (pathSet.has(next)) continue;
      pathSet.add(next);
      path.push(next);
      const result = dls(next, limit - 1, path, pathSet);
      if (result) return result;
      path.pop();
      pathSet.delete(next);
    }
    return null;
  }

  for (let depth = 0; depth <= maxDepth; depth++) {
    const path = [initial];
    const pathSet = new Set([initial]);
    const result = dls(initial, depth, path, pathSet);
    if (result) {
      stats.time = performance.now() - start;
      return { path: [...result], stats };
    }
  }
  stats.time = performance.now() - start;
  return { path: null, stats };
}

// ---------- A* ----------

class MinHeap {
  constructor() { this.h = []; }
  push(item) {
    this.h.push(item);
    let i = this.h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.h[p][0] <= this.h[i][0]) break;
      [this.h[p], this.h[i]] = [this.h[i], this.h[p]];
      i = p;
    }
  }
  pop() {
    const top = this.h[0];
    const last = this.h.pop();
    if (this.h.length) {
      this.h[0] = last;
      let i = 0;
      const n = this.h.length;
      while (true) {
        const l = 2 * i + 1, r = 2 * i + 2;
        let s = i;
        if (l < n && this.h[l][0] < this.h[s][0]) s = l;
        if (r < n && this.h[r][0] < this.h[s][0]) s = r;
        if (s === i) break;
        [this.h[s], this.h[i]] = [this.h[i], this.h[s]];
        i = s;
      }
    }
    return top;
  }
  get size() { return this.h.length; }
}

function reconstruct(parent, end) {
  const path = [end];
  let cur = end;
  while (parent.has(cur) && parent.get(cur) !== null) {
    cur = parent.get(cur);
    path.push(cur);
  }
  return path.reverse();
}

export function aStar(initial, n, colors, heuristic = heuristicMisplaced) {
  const stats = { explored: 0, generated: 0, time: 0 };
  const start = performance.now();
  const frontier = new MinHeap();
  const g = new Map([[initial, 0]]);
  const parent = new Map([[initial, null]]);
  let counter = 0; // tie-breaker so heap doesn't compare strings
  frontier.push([heuristic(initial, n, colors), counter++, initial]);

  while (frontier.size) {
    const [, , current] = frontier.pop();
    stats.explored++;
    if (isGoal(current, n, colors)) {
      stats.time = performance.now() - start;
      return { path: reconstruct(parent, current), stats };
    }
    for (const { state: next, cost } of successors(current)) {
      const tentative = g.get(current) + cost;
      if (!g.has(next) || tentative < g.get(next)) {
        g.set(next, tentative);
        parent.set(next, current);
        const f = tentative + heuristic(next, n, colors);
        frontier.push([f, counter++, next]);
        stats.generated++;
      }
    }
  }
  stats.time = performance.now() - start;
  return { path: null, stats };
}

// ---------- Beam search ----------

export function beamSearch(initial, n, colors, beamWidth = 5, heuristic = heuristicMisplaced) {
  const stats = { explored: 0, generated: 0, time: 0 };
  const start = performance.now();
  const g = new Map([[initial, 0]]);
  const parent = new Map([[initial, null]]);
  let frontier = [{ f: heuristic(initial, n, colors), state: initial }];
  const seen = new Set([initial]);

  while (frontier.length) {
    stats.explored += frontier.length;
    for (const { state } of frontier) {
      if (isGoal(state, n, colors)) {
        stats.time = performance.now() - start;
        return { path: reconstruct(parent, state), stats };
      }
    }
    const candidates = [];
    for (const { state } of frontier) {
      for (const { state: next, cost } of successors(state)) {
        const tentative = g.get(state) + cost;
        if (!g.has(next) || tentative < g.get(next)) {
          g.set(next, tentative);
          parent.set(next, state);
          stats.generated++;
        }
        if (!seen.has(next)) {
          seen.add(next);
          candidates.push({ f: tentative + heuristic(next, n, colors), state: next });
        }
      }
    }
    if (!candidates.length) break;
    candidates.sort((a, b) => a.f - b.f);
    frontier = candidates.slice(0, beamWidth);
  }
  stats.time = performance.now() - start;
  return { path: null, stats };
}
