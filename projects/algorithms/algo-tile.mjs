// Sliding-tile puzzle: a row of two colours and one blank.
// State is a string of n copies of colors[0], n copies of colors[1], and '_'.

function swap(state, i, j) {
  const a = state.split('');
  [a[i], a[j]] = [a[j], a[i]];
  return a.join('');
}

export function tileSuccessors(state) {
  const blank = state.indexOf('_');
  const len = state.length;
  const out = [];
  for (const delta of [1, 2, 3]) {
    if (blank - delta >= 0) out.push({ state: swap(state, blank, blank - delta), cost: delta });
    if (blank + delta < len) out.push({ state: swap(state, blank, blank + delta), cost: delta });
  }
  return out;
}

export function isTileGoal(state, n, colors) {
  const tiles = state.replace('_', '');
  return tiles === colors[0].repeat(n) + colors[1].repeat(n);
}

export function randomTileState(n, colors) {
  const tiles = [...colors[0].repeat(n), ...colors[1].repeat(n), '_'];
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles.join('');
}

// ---------- heuristics ----------

export function tileMisplaced(state, n, colors) {
  const tiles = state.replace('_', '');
  const goal = colors[0].repeat(n) + colors[1].repeat(n);
  let h = 0;
  for (let i = 0; i < tiles.length; i++) if (tiles[i] !== goal[i]) h++;
  return h;
}

export function tileManhattan(state, n, colors) {
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

export function tileInversions(state, n, colors) {
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

export function tileBlocks(state, n, colors) {
  const tiles = state.replace('_', '');
  if (!tiles.length) return 0;
  let runs = 1;
  for (let i = 1; i < tiles.length; i++) {
    if (tiles[i] !== tiles[i - 1]) runs++;
  }
  return Math.max(0, runs - 2);
}

export const tileHeuristics = {
  misplaced: tileMisplaced,
  manhattan: tileManhattan,
  inversions: tileInversions,
  blocks: tileBlocks,
};

export const tileHeuristicDescriptions = {
  misplaced: 'Number of tiles in the wrong colour group. Each misplaced tile needs at least one move, so it never overestimates. Loose, since one move can fix several tiles at once.',
  manhattan: 'For each misplaced tile, the shortest distance to any valid goal slot. Tighter than misplaced because it accounts for how far a tile is, not just whether it is wrong.',
  inversions: 'Pairs where a second-colour tile sits left of a first-colour tile. Specific to this puzzle: every inversion requires at least one move to resolve.',
  blocks: 'Number of contiguous colour runs minus the two the goal allows. Sees that the colours need to coalesce, not how, so it offers weak guidance compared to Manhattan.',
};

// Build a problem object from a tile-puzzle initial state.
export function tileProblem(initial, n, colors, heuristicName = 'manhattan') {
  const heur = tileHeuristics[heuristicName];
  return {
    initial,
    isGoal: (s) => isTileGoal(s, n, colors),
    successors: tileSuccessors,
    heuristic: heur ? (s) => heur(s, n, colors) : (() => 0),
  };
}
