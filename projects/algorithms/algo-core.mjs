// Generic search algorithms.
//
// Each algorithm takes a `problem` object with:
//   - initial:    starting state (any hashable value, typically a string)
//   - isGoal:     (state) => boolean
//   - successors: (state) => Array<{ state, cost }>
//   - heuristic:  (state) => number   (only required for informed methods)
//
// And an optional `opts` object:
//   - maxExplored: cap on explored states; bails out cleanly if exceeded
//   - onVisit:     (state) => void    called once per state when it's expanded
//   - beamWidth:   (Beam only) how many states to keep per layer
//   - maxDepth:    (IDS only) maximum depth to search to
//
// Each returns { path, stats } where path is null if no solution was found
// within the budget, stats tracks explored/generated/time.

const DEFAULT_MAX_EXPLORED = 200_000;

export const algorithmDescriptions = {
  ids: 'Repeats a depth-limited DFS at increasing depths until a goal turns up. Finds the fewest-move path but the work doubles with every layer, so it falls over fast on big problems.',
  astar: 'Expands states by f = g + h, balancing path cost so far against estimated cost ahead. Returns the optimal-cost path whenever the heuristic is admissible.',
  greedy: 'Expands by h alone, ignoring cost so far. Often races toward the goal in a few steps, but it commits to bad detours and cannot back out, so the path it returns is rarely optimal.',
  beam: 'Like A*, but only the best k states from each layer survive into the next. Cheap on memory, often suboptimal, can fail outright when the right state gets pruned.',
  bfs: 'Expands states in waves of equal depth from the start. Returns the shortest path in steps when every step has the same cost.',
};

// ---------- min-heap for A* ----------

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

// ---------- iterative deepening ----------

export function iterativeDeepening({ initial, isGoal, successors }, opts = {}) {
  const maxDepth = opts.maxDepth ?? 30;
  const maxExplored = opts.maxExplored ?? DEFAULT_MAX_EXPLORED;
  const onVisit = opts.onVisit;
  const stats = { explored: 0, generated: 0, time: 0, hitBudget: false };
  const start = performance.now();

  function dls(state, limit, path, pathSet) {
    stats.explored++;
    if (onVisit) onVisit(state);
    if (stats.explored > maxExplored) {
      stats.hitBudget = true;
      return null;
    }
    if (isGoal(state)) return path;
    if (limit === 0) return null;
    for (const { state: next } of successors(state)) {
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
    if (stats.hitBudget) break;
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

export function aStar({ initial, isGoal, successors, heuristic }, opts = {}) {
  const maxExplored = opts.maxExplored ?? DEFAULT_MAX_EXPLORED;
  const onVisit = opts.onVisit;
  const stats = { explored: 0, generated: 0, time: 0, hitBudget: false };
  const start = performance.now();
  const frontier = new MinHeap();
  const g = new Map([[initial, 0]]);
  const parent = new Map([[initial, null]]);
  let counter = 0;
  frontier.push([heuristic(initial), counter++, initial]);

  while (frontier.size) {
    const [, , current] = frontier.pop();
    stats.explored++;
    if (onVisit) onVisit(current);
    if (stats.explored > maxExplored) {
      stats.hitBudget = true;
      break;
    }
    if (isGoal(current)) {
      stats.time = performance.now() - start;
      return { path: reconstruct(parent, current), stats };
    }
    for (const { state: next, cost } of successors(current)) {
      const tentative = g.get(current) + cost;
      if (!g.has(next) || tentative < g.get(next)) {
        g.set(next, tentative);
        parent.set(next, current);
        frontier.push([tentative + heuristic(next), counter++, next]);
        stats.generated++;
      }
    }
  }
  stats.time = performance.now() - start;
  return { path: null, stats };
}

// ---------- beam search ----------

export function beamSearch({ initial, isGoal, successors, heuristic }, opts = {}) {
  const beamWidth = opts.beamWidth ?? 5;
  const maxExplored = opts.maxExplored ?? DEFAULT_MAX_EXPLORED;
  const onVisit = opts.onVisit;
  const stats = { explored: 0, generated: 0, time: 0, hitBudget: false };
  const start = performance.now();
  const g = new Map([[initial, 0]]);
  const parent = new Map([[initial, null]]);
  let frontier = [{ f: heuristic(initial), state: initial }];
  const seen = new Set([initial]);

  while (frontier.length) {
    for (const { state } of frontier) {
      stats.explored++;
      if (onVisit) onVisit(state);
      if (isGoal(state)) {
        stats.time = performance.now() - start;
        return { path: reconstruct(parent, state), stats };
      }
    }
    if (stats.explored > maxExplored) {
      stats.hitBudget = true;
      break;
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
          candidates.push({ f: tentative + heuristic(next), state: next });
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

// ---------- greedy best-first ----------
// Like A*, but the priority is just h(n), ignoring g(n). Fast, but it can
// commit to a bad path and not back out, so paths are not always optimal.

export function greedyBestFirst({ initial, isGoal, successors, heuristic }, opts = {}) {
  const maxExplored = opts.maxExplored ?? DEFAULT_MAX_EXPLORED;
  const onVisit = opts.onVisit;
  const stats = { explored: 0, generated: 0, time: 0, hitBudget: false };
  const start = performance.now();
  const frontier = new MinHeap();
  const seen = new Set([initial]);
  const parent = new Map([[initial, null]]);
  let counter = 0;
  frontier.push([heuristic(initial), counter++, initial]);

  while (frontier.size) {
    const [, , current] = frontier.pop();
    stats.explored++;
    if (onVisit) onVisit(current);
    if (stats.explored > maxExplored) {
      stats.hitBudget = true;
      break;
    }
    if (isGoal(current)) {
      stats.time = performance.now() - start;
      return { path: reconstruct(parent, current), stats };
    }
    for (const { state: next } of successors(current)) {
      if (seen.has(next)) continue;
      seen.add(next);
      parent.set(next, current);
      frontier.push([heuristic(next), counter++, next]);
      stats.generated++;
    }
  }
  stats.time = performance.now() - start;
  return { path: null, stats };
}

// ---------- breadth-first (Dijkstra with h=0, useful as a baseline) ----------

export function bfs({ initial, isGoal, successors }, opts = {}) {
  const maxExplored = opts.maxExplored ?? DEFAULT_MAX_EXPLORED;
  const onVisit = opts.onVisit;
  const stats = { explored: 0, generated: 0, time: 0, hitBudget: false };
  const start = performance.now();
  const frontier = new MinHeap();
  const g = new Map([[initial, 0]]);
  const parent = new Map([[initial, null]]);
  let counter = 0;
  frontier.push([0, counter++, initial]);

  while (frontier.size) {
    const [, , current] = frontier.pop();
    stats.explored++;
    if (onVisit) onVisit(current);
    if (stats.explored > maxExplored) {
      stats.hitBudget = true;
      break;
    }
    if (isGoal(current)) {
      stats.time = performance.now() - start;
      return { path: reconstruct(parent, current), stats };
    }
    for (const { state: next, cost } of successors(current)) {
      const tentative = g.get(current) + cost;
      if (!g.has(next) || tentative < g.get(next)) {
        g.set(next, tentative);
        parent.set(next, current);
        frontier.push([tentative, counter++, next]);
        stats.generated++;
      }
    }
  }
  stats.time = performance.now() - start;
  return { path: null, stats };
}
