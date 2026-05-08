// 4-connected grid pathfinding.
// State is a string "r,c". A grid is { rows, cols, walls } where walls is a
// Set of "r,c" strings. Cost is 1 per move (uniform).

export function key(r, c) { return `${r},${c}`; }
export function fromKey(k) {
  const [r, c] = k.split(',').map(Number);
  return [r, c];
}

export function gridSuccessors(grid) {
  const { rows, cols, walls } = grid;
  return (state) => {
    const [r, c] = fromKey(state);
    const out = [];
    const moves = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of moves) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      const k = key(nr, nc);
      if (walls.has(k)) continue;
      out.push({ state: k, cost: 1 });
    }
    return out;
  };
}

// ---------- heuristics ----------

export function gridManhattan(goal) {
  const [gr, gc] = fromKey(goal);
  return (state) => {
    const [r, c] = fromKey(state);
    return Math.abs(r - gr) + Math.abs(c - gc);
  };
}

export function gridEuclidean(goal) {
  const [gr, gc] = fromKey(goal);
  return (state) => {
    const [r, c] = fromKey(state);
    const dr = r - gr, dc = c - gc;
    return Math.sqrt(dr * dr + dc * dc);
  };
}

export function gridZero() {
  return () => 0;
}

export const gridHeuristics = {
  manhattan: gridManhattan,
  euclidean: gridEuclidean,
  none: gridZero,
};

export function gridProblem(grid, start, goal, heuristicName = 'manhattan') {
  const makeHeur = gridHeuristics[heuristicName] ?? gridZero;
  return {
    initial: start,
    isGoal: (s) => s === goal,
    successors: gridSuccessors(grid),
    heuristic: makeHeur(goal),
  };
}
