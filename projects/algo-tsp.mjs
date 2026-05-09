// Travelling salesman problem: find the shortest tour visiting every point.
//
// Both algorithms expose a `step()` method that runs one iteration and a
// `best` field with the running best tour. Lets the UI drive the loop with
// setTimeout and stop at any time.

function distanceMatrix(points) {
  const n = points.length;
  const d = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = points[i].x - points[j].x;
      const dy = points[i].y - points[j].y;
      const v = Math.hypot(dx, dy);
      d[i][j] = d[j][i] = v;
    }
  }
  return d;
}

export function tourLength(tour, d) {
  let total = 0;
  for (let i = 0; i < tour.length; i++) {
    const a = tour[i];
    const b = tour[(i + 1) % tour.length];
    total += d[a][b];
  }
  return total;
}

function randomPermutation(n) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- genetic algorithm ----------
//
// Encoding: tour is a permutation of city indices [0..n-1].
// Selection: tournament of k=3.
// Crossover: order crossover (OX). Preserves a subtour from one parent and
//   fills the rest in the order they appear in the other parent.
// Mutation: 2-opt-style swap of two random positions.
// Elitism: best 2 individuals carry over unchanged.

function tournamentSelect(pop, fitness, k = 3) {
  let best = -1, bestFit = -Infinity;
  for (let i = 0; i < k; i++) {
    const idx = Math.floor(Math.random() * pop.length);
    if (fitness[idx] > bestFit) { bestFit = fitness[idx]; best = idx; }
  }
  return pop[best];
}

function orderCrossover(p1, p2) {
  const n = p1.length;
  const segLen = 1 + Math.floor(Math.random() * (n - 1));
  const start = Math.floor(Math.random() * n);
  const child = new Array(n).fill(-1);
  const inSlice = new Set();

  for (let k = 0; k < segLen; k++) {
    const idx = (start + k) % n;
    child[idx] = p1[idx];
    inSlice.add(p1[idx]);
  }

  let writePos = (start + segLen) % n;
  let readPos = (start + segLen) % n;
  let written = 0;
  while (written < n - segLen) {
    const cand = p2[readPos];
    readPos = (readPos + 1) % n;
    if (inSlice.has(cand)) continue;
    child[writePos] = cand;
    writePos = (writePos + 1) % n;
    written++;
  }
  return child;
}

function swapMutate(tour, rate) {
  const t = tour.slice();
  if (Math.random() < rate) {
    const i = Math.floor(Math.random() * t.length);
    let k = Math.floor(Math.random() * t.length);
    while (k === i) k = Math.floor(Math.random() * t.length);
    [t[i], t[k]] = [t[k], t[i]];
  }
  return t;
}

export function createGA(points, opts = {}) {
  const n = points.length;
  const popSize = opts.populationSize ?? 50;
  const mutationRate = opts.mutationRate ?? 0.15;
  const elitism = Math.min(opts.elitism ?? 2, popSize);
  const d = distanceMatrix(points);

  let population = Array.from({ length: popSize }, () => randomPermutation(n));
  let lengths = population.map(t => tourLength(t, d));
  let bestIdx = lengths.indexOf(Math.min(...lengths));
  let best = population[bestIdx].slice();
  let bestLength = lengths[bestIdx];
  let iteration = 0;
  const history = [bestLength];

  function step() {
    // Fitness: inverse length (higher is better).
    const fitness = lengths.map(l => 1 / l);
    // Sort by fitness desc to grab elites.
    const order = fitness
      .map((f, i) => [f, i])
      .sort((a, b) => b[0] - a[0]);
    const next = [];
    for (let i = 0; i < elitism; i++) next.push(population[order[i][1]].slice());
    while (next.length < popSize) {
      const p1 = tournamentSelect(population, fitness);
      const p2 = tournamentSelect(population, fitness);
      const child = swapMutate(orderCrossover(p1, p2), mutationRate);
      next.push(child);
    }
    population = next;
    lengths = population.map(t => tourLength(t, d));
    const min = Math.min(...lengths);
    if (min < bestLength) {
      bestLength = min;
      best = population[lengths.indexOf(min)].slice();
    }
    iteration++;
    history.push(bestLength);
  }

  return {
    step,
    get best() { return best; },
    get bestLength() { return bestLength; },
    get iteration() { return iteration; },
    get history() { return history; },
    get population() { return population; },
  };
}

// ---------- ant colony optimisation ----------
//
// Each ant constructs a tour by stepping from city to city, choosing the next
// unvisited city with probability proportional to (pheromone^alpha) * (1/distance^beta).
// After all ants finish: pheromone evaporates, then each ant lays pheromone on its
// edges in proportion to 1/tour_length. Best tour across all iterations is tracked.

export function createACO(points, opts = {}) {
  const n = points.length;
  const numAnts = opts.numAnts ?? 30;
  const alpha = opts.alpha ?? 1;       // pheromone weight
  const beta = opts.beta ?? 3;         // distance weight
  const evaporation = opts.evaporation ?? 0.1;
  const Q = opts.Q ?? 1;
  const d = distanceMatrix(points);

  // Initial pheromone: small uniform amount.
  const initial = 1 / (n * meanDistance(d));
  const tau = Array.from({ length: n }, () => new Float64Array(n).fill(initial));

  let best = randomPermutation(n);
  let bestLength = tourLength(best, d);
  let iteration = 0;
  const history = [bestLength];
  const lastTours = [];   // tours from the most recent iteration (for visualisation)

  function pickNextCity(current, visited) {
    const probs = new Float64Array(n);
    let total = 0;
    for (let j = 0; j < n; j++) {
      if (visited[j] || j === current) continue;
      const phero = Math.pow(tau[current][j], alpha);
      const dist = d[current][j] || 1e-9;
      const eta = Math.pow(1 / dist, beta);
      const p = phero * eta;
      probs[j] = p;
      total += p;
    }
    if (total === 0) {
      for (let j = 0; j < n; j++) if (!visited[j] && j !== current) return j;
      return -1;
    }
    let r = Math.random() * total;
    for (let j = 0; j < n; j++) {
      if (visited[j] || j === current) continue;
      r -= probs[j];
      if (r <= 0) return j;
    }
    for (let j = 0; j < n; j++) if (!visited[j] && j !== current) return j;
    return -1;
  }

  function constructTour() {
    const visited = new Uint8Array(n);
    const start = Math.floor(Math.random() * n);
    const tour = [start];
    visited[start] = 1;
    let current = start;
    for (let step = 1; step < n; step++) {
      const next = pickNextCity(current, visited);
      if (next < 0) break;
      tour.push(next);
      visited[next] = 1;
      current = next;
    }
    return tour;
  }

  function step() {
    lastTours.length = 0;
    const tours = [], lengths = [];
    for (let a = 0; a < numAnts; a++) {
      const t = constructTour();
      tours.push(t);
      lengths.push(tourLength(t, d));
    }
    // Evaporate.
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        tau[i][j] *= (1 - evaporation);
      }
    }
    // Deposit.
    for (let a = 0; a < tours.length; a++) {
      const t = tours[a];
      const deposit = Q / lengths[a];
      for (let i = 0; i < t.length; i++) {
        const x = t[i], y = t[(i + 1) % t.length];
        tau[x][y] += deposit;
        tau[y][x] += deposit;
      }
    }
    const minIdx = lengths.indexOf(Math.min(...lengths));
    if (lengths[minIdx] < bestLength) {
      bestLength = lengths[minIdx];
      best = tours[minIdx].slice();
    }
    iteration++;
    history.push(bestLength);
    lastTours.push(...tours);
  }

  return {
    step,
    get best() { return best; },
    get bestLength() { return bestLength; },
    get iteration() { return iteration; },
    get history() { return history; },
    get pheromone() { return tau; },
    get lastTours() { return lastTours; },
  };
}

function meanDistance(d) {
  const n = d.length;
  let sum = 0, count = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      sum += d[i][j];
      count++;
    }
  }
  return count ? sum / count : 1;
}

export const tspAlgorithmDescriptions = {
  ga: 'Maintains a population of candidate tours. Each generation, parents are picked weighted by fitness, recombined with order-crossover, and a few are mutated. Larger populations explore more, smaller ones converge faster.',
  aco: 'Simulated ants construct tours, biased by edge length and accumulated pheromone. After each round, pheromone evaporates and the best tours reinforce their edges. More ants explore more; faster evaporation forgets old solutions sooner.',
};

export const tspAlgorithmLabels = {
  ga: 'Genetic algorithm',
  aco: 'Ant colony',
};
