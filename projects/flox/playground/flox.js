// src/output.ts
var Output = class {
  constructor(out) {
    this.out = out;
  }
  out;
  println(s = "") {
    this.out.push(s + "\n");
  }
  print(s) {
    this.out.push(s);
  }
};
function printHelp(o) {
  o.println("=== FLOX SYNTAX REFERENCE ===\n");
  o.println("Declarations:");
  o.println("  river Name { base: N, peak: N, decay: N }   (decay optional, default 0.7)");
  o.println("  dam   Name { capacity: N, threshold: N%, normalRate: N, openRate: N }");
  o.println("  outlet Name;                                (zero-flow accumulator)\n");
  o.println("Connections:");
  o.println("  A -> B -> C;                                (bare names; declared anywhere)\n");
  o.println("Commands:");
  o.println("  system Name;                  - Create a system");
  o.println("  list Name;                    - Show connections list");
  o.println("  map Name;                     - Show network diagram");
  o.println("  print Name;                   - Simulate with 1mm rainfall on day 1");
  o.println("  print Name N;                 - Simulate with N mm on day 1");
  o.println("  print Name [r1, r2, r3, ...]; - Per-day rainfall series in mm");
  o.println("  help;                         - Show this message\n");
}
function printList(o, system) {
  o.println("");
  o.println("=== RIVER SYSTEM: " + system.name + " ===\n");
  o.println("Connections:");
  for (const [from, edges] of system.connections) {
    for (const e of edges) {
      const fromLabel = system.dams.has(from) ? `${from} [DAM]` : from;
      const toLabel = system.dams.has(e.target) ? `${e.target} [DAM]` : e.target;
      o.println("  " + padRight(fromLabel, 22) + " \u2192  " + toLabel);
    }
  }
  o.println("");
}
function printMap(o, system) {
  o.println("");
  o.println("=== RIVER SYSTEM MAP: " + system.name + " ===\n");
  const finalOutlet = system.getFinalOutlet();
  for (const root of system.roots) {
    const path = [];
    tracePath(system, root, path, finalOutlet);
    printPath(o, system, path);
  }
  o.println("");
}
function tracePath(system, node, path, finalOutlet) {
  path.push(node);
  if (node === finalOutlet) return;
  const downstream = system.connections.get(node);
  if (downstream && downstream.length > 0) {
    tracePath(system, downstream[0].target, path, finalOutlet);
  }
}
function printPath(o, system, path) {
  for (let i = 0; i < path.length; i++) {
    const node = path[i];
    const isDam = system.dams.has(node);
    const river = system.rivers.get(node);
    const isOutlet = river ? river.isTerminator() : false;
    const indent = "  ".repeat(i);
    let label = node;
    if (isDam) label += " [DAM]";
    if (isOutlet) label += " [OUTLET]";
    if (i === 0) {
      o.println(indent + label + " (source)");
    } else {
      o.println(indent + "\u2514\u2500\u2500\u25B6 " + label);
    }
  }
  o.println("");
}
function printFlowTable(o, system, rainfall) {
  o.println("");
  o.println(
    "=== FLOW SIMULATION: " + system.name + " (" + formatRainfall(rainfall) + ") ===\n"
  );
  o.println("(Flow values represent water volume per day in L/s)\n");
  const finalOutlet = system.getFinalOutlet();
  let valWidth = 5;
  let locWidth = 8;
  for (const r of system.rivers.values()) {
    if (r.name === finalOutlet) continue;
    if (r.name.length > locWidth) locWidth = r.name.length;
    for (let day = 0; day < 10; day++) {
      const w = fmtFixed(r.dailyFlow[day], 1).length;
      if (w > valWidth) valWidth = w;
    }
  }
  for (const d of system.dams.values()) {
    if (d.name.length > locWidth) locWidth = d.name.length;
    for (let day = 0; day < 10; day++) {
      const w = fmtFixed(d.dailyOutflow[day], 1).length;
      if (w > valWidth) valWidth = w;
    }
  }
  if (finalOutlet !== null) {
    const outlet = system.rivers.get(finalOutlet);
    if (outlet) {
      const labelLen = (outlet.name + " [OUTLET]").length;
      if (labelLen > locWidth) locWidth = labelLen;
      let cumulative = 0;
      for (let day = 0; day < 10; day++) {
        cumulative += outlet.dailyFlow[day];
        const w = formatCumulative(cumulative).length;
        if (w > valWidth) valWidth = w;
      }
    }
  }
  const interior = valWidth + 3;
  const dashes = "-".repeat(interior);
  const locDashes = "-".repeat(locWidth);
  o.print(padRight("Location", locWidth));
  for (let day = 1; day <= 10; day++) {
    const dayStr = "Day " + padLeft(String(day), 2);
    o.print("|" + padCenter(dayStr, interior));
  }
  o.println("|");
  o.print(locDashes + "|");
  for (let i = 0; i < 10; i++) o.print(dashes + "|");
  o.println("");
  for (const r of system.rivers.values()) {
    if (r.name === finalOutlet) continue;
    o.print(padRight(r.name, locWidth));
    for (let day = 0; day < 10; day++) {
      o.print("|  " + padLeft(fmtFixed(r.dailyFlow[day], 1), valWidth) + " ");
    }
    o.println("|");
  }
  for (const d of system.dams.values()) {
    o.print(padRight(d.name, locWidth));
    for (let day = 0; day < 10; day++) {
      o.print("|  " + padLeft(fmtFixed(d.dailyOutflow[day], 1), valWidth) + " ");
    }
    o.println("|");
  }
  if (finalOutlet !== null) {
    const outlet = system.rivers.get(finalOutlet);
    if (outlet) {
      o.print(locDashes + "|");
      for (let i = 0; i < 10; i++) o.print(dashes + "|");
      o.println("");
      o.println("Cumulative Outlet (converted to actual volume):");
      o.print(padRight(outlet.name + " [OUTLET]", locWidth));
      let cumulative = 0;
      for (let day = 0; day < 10; day++) {
        cumulative += outlet.dailyFlow[day];
        o.print("|  " + padLeft(formatCumulative(cumulative), valWidth) + " ");
      }
      o.println("|");
      const totalLitersPerDay = cumulative * 86400;
      const totalGigaliters = totalLitersPerDay / 1e9;
      o.println("");
      if (totalGigaliters >= 1) {
        o.println(
          "Total water accumulated at outlet: " + fmtFixed(totalGigaliters, 2) + " GL (gigaliters)"
        );
      } else if (totalGigaliters >= 1e-3) {
        const totalMegaliters = totalLitersPerDay / 1e6;
        o.println(
          "Total water accumulated at outlet: " + fmtFixed(totalMegaliters, 2) + " ML (megaliters)"
        );
      } else if (totalGigaliters >= 1e-6) {
        const totalKiloliters = totalLitersPerDay / 1e3;
        o.println(
          "Total water accumulated at outlet: " + fmtFixed(totalKiloliters, 2) + " KL (kiloliters)"
        );
      } else {
        o.println(
          "Total water accumulated at outlet: " + fmtFixed(totalLitersPerDay, 1) + " L (liters)"
        );
      }
    }
  }
  o.println("");
}
function printMarkovMap(o, system) {
  o.println("");
  o.println("=== MARKOV CHAIN: " + system.name + " ===\n");
  const states = [...system.rivers.keys(), ...system.dams.keys()];
  o.println("States (" + states.length + "):");
  o.println("  " + states.join(", "));
  o.println("");
  o.println("Transitions:");
  for (const [src, outs] of system.connections) {
    for (let i = 0; i < outs.length; i++) {
      const e = outs[i];
      const w = formatWeight(e.weight);
      if (i === 0) {
        o.println("  " + src + " \u2500[" + w + "]\u2500\u25B6 " + e.target);
      } else {
        const pad = " ".repeat(src.length + 2);
        o.println(pad + "\u2514[" + w + "]\u2500\u25B6 " + e.target);
      }
    }
  }
  o.println("");
  o.println("Outgoing weights per state:");
  for (const src of states) {
    const outs = system.connections.get(src);
    if (!outs || outs.length === 0) {
      o.println("  " + src + " absorbing");
      continue;
    }
    let sum = 0;
    for (const e of outs) sum += e.weight;
    const mark = Math.abs(sum - 1) < 1e-6 ? "  \u2713" : "  \u2717";
    o.println("  " + src + " \u2192 " + sum.toFixed(3) + mark);
  }
  o.println("");
}
function printMarkovDistribution(o, system) {
  const tickWord = system.markovTicksRun === 1 ? "tick" : "ticks";
  const status = system.markovConverged ? ", converged" : ", not yet converged";
  o.println("");
  o.println(
    "=== MARKOV DISTRIBUTION: " + system.name + " (" + system.markovTicksRun + " " + tickWord + status + ") ===\n"
  );
  let locWidth = 5;
  for (const s of system.markovHistory.keys()) {
    if (s.length > locWidth) locWidth = s.length;
  }
  o.println("Final distribution:");
  let total = 0;
  for (const [state, hist] of system.markovHistory) {
    const v = hist[system.markovTicksRun];
    total += v;
    o.println("  " + padRight(state, locWidth) + "  " + v.toFixed(4));
  }
  o.println("");
  o.println("Total mass: " + total.toFixed(4));
  o.println("");
}
function formatWeight(w) {
  if (w === Math.floor(w)) return w.toFixed(1);
  let s = w.toFixed(3);
  while (s.endsWith("0")) s = s.slice(0, -1);
  if (s.endsWith(".")) s += "0";
  return s;
}
function formatCumulative(cumulativeFlowLps) {
  const litersPerDay = cumulativeFlowLps * 86400;
  const gigaliters = litersPerDay / 1e9;
  if (gigaliters >= 1) return fmtFixed(gigaliters, 2) + "GL";
  if (gigaliters >= 1e-3) return fmtFixed(litersPerDay / 1e6, 2) + "ML";
  if (gigaliters >= 1e-6) return fmtFixed(litersPerDay / 1e3, 2) + "KL";
  return fmtFixed(litersPerDay, 1) + "L";
}
function padCenter(s, n) {
  if (s.length >= n) return s.slice(0, n);
  const pad = n - s.length;
  const left = Math.floor(pad / 2);
  const right = pad - left;
  return " ".repeat(left) + s + " ".repeat(right);
}
function formatRainfall(rainfall) {
  if (rainfall.length === 1) {
    return fmtFixed(rainfall[0], 1) + "mm rainfall on day 1";
  }
  const parts = [];
  for (const r of rainfall) parts.push(formatNumber(r));
  return "rainfall mm/day: [" + parts.join(", ") + "]";
}
function formatNumber(v) {
  if (v === Math.floor(v) && isFinite(v)) return String(v);
  return fmtFixed(v, 1);
}
function fmtFixed(n, decimals) {
  if (!isFinite(n)) return String(n);
  const s = Math.abs(n).toString();
  const sign = n < 0 ? "-" : "";
  const dotIdx = s.indexOf(".");
  const intStr = dotIdx < 0 ? s : s.slice(0, dotIdx);
  const fracStr = dotIdx < 0 ? "" : s.slice(dotIdx + 1);
  if (fracStr.length <= decimals) {
    return sign + intStr + (decimals > 0 ? "." + fracStr.padEnd(decimals, "0") : "");
  }
  const roundDigit = fracStr.charCodeAt(decimals) - 48;
  let intPart = BigInt(intStr);
  let fracKept = decimals > 0 ? BigInt(fracStr.slice(0, decimals)) : 0n;
  const mag = 10n ** BigInt(decimals);
  if (roundDigit >= 5) {
    fracKept += 1n;
    if (fracKept >= mag) {
      intPart += 1n;
      fracKept = 0n;
    }
  }
  const fracOut = decimals > 0 ? "." + fracKept.toString().padStart(decimals, "0") : "";
  return sign + intPart.toString() + fracOut;
}
function padRight(s, n) {
  if (s.length >= n) return s.slice(0, n);
  return s + " ".repeat(n - s.length);
}
function padLeft(s, n) {
  if (s.length >= n) return s;
  return " ".repeat(n - s.length) + s;
}

// src/runtime.ts
var River = class {
  constructor(name, baseFlow, peakMultiplier, decayRate) {
    this.name = name;
    this.baseFlow = baseFlow;
    this.peakMultiplier = peakMultiplier;
    this.decayRate = decayRate;
  }
  name;
  baseFlow;
  peakMultiplier;
  decayRate;
  dailyFlow = new Array(10).fill(0);
  totalAccumulated = 0;
  // Flow on a given simulation day, given the full rainfall series so far.
  // Each non-zero entry rainfall[d] kicks off its own hydrograph; flow is
  // the superposition of every event that has happened up to (and including)
  // day. response(0) is the rising limb (0.3 of peak), response(1) is the
  // peak itself, response(k>=1) is decay^(k-1) of the peak.
  calculateFlow(day, rainfall) {
    let total = this.baseFlow;
    for (let d = 0; d <= day && d < rainfall.length; d++) {
      const r = rainfall[d];
      if (r === 0) continue;
      const k = day - d;
      const factor = k === 0 ? 0.3 : Math.pow(this.decayRate, k - 1);
      total += r * this.peakMultiplier * factor;
    }
    return total;
  }
  isTerminator() {
    return this.baseFlow === 0 && this.peakMultiplier === 0;
  }
};
var Dam = class _Dam {
  constructor(name, capacity, threshold, normalRate, openRate) {
    this.name = name;
    this.capacity = capacity;
    this.threshold = threshold;
    this.normalRate = normalRate;
    this.openRate = openRate;
    this.currentLevel = capacity * 0.5;
  }
  name;
  capacity;
  threshold;
  normalRate;
  openRate;
  // 1 L/s sustained for one day = 86400 L = 0.0864 ML.
  // Storage is in ML; flow is in L/s. Convert at the boundary.
  static L_PER_S_TO_ML_PER_DAY = 0.0864;
  currentLevel;
  dailyOutflow = new Array(10).fill(0);
  processFlow(inflowLps) {
    const inflowVolumeMl = inflowLps * _Dam.L_PER_S_TO_ML_PER_DAY;
    this.currentLevel += inflowVolumeMl;
    let outflowLps;
    if (this.currentLevel >= this.capacity * this.threshold) {
      outflowLps = inflowLps * this.openRate;
    } else {
      outflowLps = inflowLps * this.normalRate;
    }
    let outflowVolumeMl = outflowLps * _Dam.L_PER_S_TO_ML_PER_DAY;
    if (outflowVolumeMl > this.currentLevel) {
      outflowVolumeMl = this.currentLevel;
      outflowLps = outflowVolumeMl / _Dam.L_PER_S_TO_ML_PER_DAY;
    }
    this.currentLevel -= outflowVolumeMl;
    if (this.currentLevel > this.capacity) this.currentLevel = this.capacity;
    return outflowLps;
  }
  reset() {
    this.currentLevel = this.capacity * 0.5;
  }
};
var RiverSystem = class {
  constructor(name) {
    this.name = name;
  }
  name;
  mode = "river";
  rivers = /* @__PURE__ */ new Map();
  dams = /* @__PURE__ */ new Map();
  connections = /* @__PURE__ */ new Map();
  roots = [];
  // Markov state
  initialMass = /* @__PURE__ */ new Map();
  markovHistory = /* @__PURE__ */ new Map();
  markovTicksRun = 0;
  markovConverged = false;
  addRiver(river) {
    this.rivers.set(river.name, river);
  }
  addDam(dam) {
    this.dams.set(dam.name, dam);
  }
  addConnection(from, to, weight) {
    let downstream = this.connections.get(from);
    if (!downstream) {
      downstream = [];
      this.connections.set(from, downstream);
    }
    downstream.push({ target: to, weight });
  }
  identifyRoots() {
    this.roots = [];
    const hasUpstream = /* @__PURE__ */ new Set();
    for (const edges of this.connections.values()) {
      for (const e of edges) hasUpstream.add(e.target);
    }
    for (const r of this.rivers.values()) {
      if (!hasUpstream.has(r.name) && !r.isTerminator()) {
        this.roots.push(r.name);
      }
    }
  }
  getFinalOutlet() {
    for (const river of this.rivers.values()) {
      if (river.isTerminator()) {
        const downstream = this.connections.get(river.name);
        if (!downstream || downstream.length === 0) return river.name;
      }
    }
    return null;
  }
  simulate(rainfall) {
    for (const dam of this.dams.values()) dam.reset();
    for (const river of this.rivers.values()) river.totalAccumulated = 0;
    for (let day = 0; day < 10; day++) {
      const flowThisDay = /* @__PURE__ */ new Map();
      for (const node of this.getTopologicalOrder()) {
        let flow = 0;
        for (const [from, edges] of this.connections) {
          for (const e of edges) {
            if (e.target === node) {
              flow += (flowThisDay.get(from) ?? 0) * e.weight;
            }
          }
        }
        const river = this.rivers.get(node);
        if (river && !river.isTerminator()) {
          flow += river.calculateFlow(day, rainfall);
        }
        const dam = this.dams.get(node);
        if (dam) {
          flow = dam.processFlow(flow);
          dam.dailyOutflow[day] = flow;
        } else if (river) {
          river.dailyFlow[day] = flow;
          if (river.isTerminator()) river.totalAccumulated += flow;
        }
        flowThisDay.set(node, flow);
      }
    }
  }
  // Markov-mode simulation: row-stochastic transition matrix induced by
  // edge weights, applied iteratively to the state vector. Halts at
  // maxTicks or when the state stops changing within EPSILON.
  simulateMarkov(maxTicks) {
    const EPSILON = 1e-9;
    const nodes = [...this.rivers.keys(), ...this.dams.keys()];
    let mass = /* @__PURE__ */ new Map();
    for (const n of nodes) mass.set(n, this.initialMass.get(n) ?? 0);
    this.markovHistory.clear();
    for (const n of nodes) {
      const hist = new Array(maxTicks + 1).fill(0);
      hist[0] = mass.get(n);
      this.markovHistory.set(n, hist);
    }
    this.markovTicksRun = 0;
    this.markovConverged = false;
    for (let t = 1; t <= maxTicks; t++) {
      const next = /* @__PURE__ */ new Map();
      for (const n of nodes) next.set(n, 0);
      for (const src of nodes) {
        const outs = this.connections.get(src);
        if (!outs || outs.length === 0) {
          next.set(src, (next.get(src) ?? 0) + (mass.get(src) ?? 0));
          continue;
        }
        for (const e of outs) {
          if (!next.has(e.target)) continue;
          next.set(e.target, (next.get(e.target) ?? 0) + (mass.get(src) ?? 0) * e.weight);
        }
      }
      let maxDiff = 0;
      for (const n of nodes) {
        maxDiff = Math.max(maxDiff, Math.abs(next.get(n) - mass.get(n)));
        this.markovHistory.get(n)[t] = next.get(n);
      }
      mass = next;
      this.markovTicksRun = t;
      if (maxDiff < EPSILON) {
        this.markovConverged = true;
        break;
      }
    }
  }
  getTopologicalOrder() {
    const order = [];
    const inDegree = /* @__PURE__ */ new Map();
    const allNodes = /* @__PURE__ */ new Set([
      ...this.rivers.keys(),
      ...this.dams.keys()
    ]);
    for (const n of allNodes) inDegree.set(n, 0);
    for (const edges of this.connections.values()) {
      for (const e of edges) {
        inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
      }
    }
    const queue = [];
    for (const [n, d] of inDegree) {
      if (d === 0) queue.push(n);
    }
    while (queue.length > 0) {
      const node = queue.shift();
      order.push(node);
      const edges = this.connections.get(node);
      if (edges) {
        for (const e of edges) {
          const d = (inDegree.get(e.target) ?? 0) - 1;
          inDegree.set(e.target, d);
          if (d === 0) queue.push(e.target);
        }
      }
    }
    return order;
  }
};

// src/interpreter.ts
var Interpreter = class {
  constructor(out, errs) {
    this.out = out;
    this.errs = errs;
  }
  out;
  errs;
  systems = /* @__PURE__ */ new Map();
  pendingChains = /* @__PURE__ */ new Map();
  currentSystem = null;
  phase = 0 /* COLLECT */;
  fileMode = "river";
  interpret(statements) {
    try {
      this.phase = 0 /* COLLECT */;
      this.currentSystem = null;
      for (const stmt of statements) {
        if (stmt) this.execute(stmt);
      }
      for (const s of this.systems.values()) s.mode = this.fileMode;
      this.resolveChains();
      for (const s of this.systems.values()) {
        if (s.mode === "markov") this.validateMarkov(s);
      }
      for (const s of this.systems.values()) s.identifyRoots();
      this.phase = 1 /* EXECUTE */;
      this.currentSystem = null;
      for (const stmt of statements) {
        if (stmt) this.execute(stmt);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.errs.push("Runtime error: " + msg + "\n");
    }
  }
  execute(stmt) {
    switch (stmt.kind) {
      case "SystemDecl": {
        const name = stmt.name.lexeme;
        if (this.phase === 0 /* COLLECT */) {
          let s = this.systems.get(name);
          if (!s) {
            s = new RiverSystem(name);
            this.systems.set(name, s);
            this.pendingChains.set(name, []);
          }
          this.currentSystem = s;
        } else {
          this.currentSystem = this.systems.get(name) ?? null;
        }
        return;
      }
      case "ModeDecl": {
        if (this.phase !== 0 /* COLLECT */) return;
        const name = stmt.mode.lexeme;
        if (name === "river") this.fileMode = "river";
        else if (name === "markov") this.fileMode = "markov";
        else {
          throw new Error(
            `Unknown mode '${name}' (line ${stmt.mode.line}). Known modes: river, markov.`
          );
        }
        return;
      }
      case "RiverDecl": {
        if (this.phase !== 0 /* COLLECT */) return;
        const sys = this.requireSystem(stmt.name);
        if (sys.rivers.has(stmt.name.lexeme) || sys.dams.has(stmt.name.lexeme)) {
          throw new Error(
            `Node '${stmt.name.lexeme}' is declared more than once in system '${sys.name}'.`
          );
        }
        sys.addRiver(
          new River(
            stmt.name.lexeme,
            stmt.baseFlow,
            stmt.peakMultiplier,
            stmt.decayRate
          )
        );
        return;
      }
      case "DamDecl": {
        if (this.phase !== 0 /* COLLECT */) return;
        const sys = this.requireSystem(stmt.name);
        if (sys.rivers.has(stmt.name.lexeme) || sys.dams.has(stmt.name.lexeme)) {
          throw new Error(
            `Node '${stmt.name.lexeme}' is declared more than once in system '${sys.name}'.`
          );
        }
        sys.addDam(
          new Dam(
            stmt.name.lexeme,
            stmt.capacity,
            stmt.threshold,
            stmt.normalRate,
            stmt.openRate
          )
        );
        return;
      }
      case "OutletDecl": {
        if (this.phase !== 0 /* COLLECT */) return;
        const sys = this.requireSystem(stmt.name);
        if (sys.rivers.has(stmt.name.lexeme) || sys.dams.has(stmt.name.lexeme)) {
          throw new Error(
            `Node '${stmt.name.lexeme}' is declared more than once in system '${sys.name}'.`
          );
        }
        sys.addRiver(new River(stmt.name.lexeme, 0, 0, 0.7));
        return;
      }
      case "Chain": {
        if (this.phase !== 0 /* COLLECT */) return;
        const sys = this.requireSystem(
          stmt.nodes.length > 0 ? stmt.nodes[0] : null
        );
        this.pendingChains.get(sys.name).push(stmt);
        return;
      }
      case "StartStmt": {
        if (this.phase !== 0 /* COLLECT */) return;
        const sys = this.requireSystem(stmt.node);
        sys.initialMass.set(
          stmt.node.lexeme,
          (sys.initialMass.get(stmt.node.lexeme) ?? 0) + stmt.mass
        );
        return;
      }
      case "MapStmt": {
        if (this.phase !== 1 /* EXECUTE */) return;
        const sys = this.lookupSystem(stmt.systemName);
        if (sys.mode === "markov") {
          printMarkovMap(new Output(this.out), sys);
        } else {
          printMap(new Output(this.out), sys);
        }
        return;
      }
      case "ListStmt": {
        if (this.phase !== 1 /* EXECUTE */) return;
        const sys = this.lookupSystem(stmt.systemName);
        printList(new Output(this.out), sys);
        return;
      }
      case "PrintStmt": {
        if (this.phase !== 1 /* EXECUTE */) return;
        const sys = this.lookupSystem(stmt.systemName);
        if (sys.mode === "markov") {
          let ticks = 30;
          if (stmt.rainfall != null && stmt.rainfall.length > 0) {
            ticks = Math.max(1, Math.round(stmt.rainfall[0]));
          }
          sys.simulateMarkov(ticks);
          printMarkovDistribution(new Output(this.out), sys);
        } else {
          const rainfall = stmt.rainfall ?? [1];
          sys.simulate(rainfall);
          printFlowTable(new Output(this.out), sys, rainfall);
        }
        return;
      }
      case "HelpStmt": {
        if (this.phase !== 1 /* EXECUTE */) return;
        printHelp(new Output(this.out));
        return;
      }
    }
  }
  resolveChains() {
    for (const [sysName, chains] of this.pendingChains) {
      const system = this.systems.get(sysName);
      for (const chain of chains) {
        for (const name of chain.nodes) {
          if (!this.nodeDefined(system, name.lexeme)) {
            throw new Error(
              `Chain references undeclared node '${name.lexeme}' (line ${name.line}) in system '${system.name}'.`
            );
          }
        }
        for (let i = 0; i + 1 < chain.nodes.length; i++) {
          const arrow = chain.arrows[i];
          const a = chain.nodes[i];
          const b = chain.nodes[i + 1];
          const from = arrow.forward ? a : b;
          const to = arrow.forward ? b : a;
          const weight = arrow.weight != null ? arrow.weight : 1;
          system.addConnection(from.lexeme, to.lexeme, weight);
        }
      }
    }
  }
  validateMarkov(system) {
    for (const name of system.initialMass.keys()) {
      if (!this.nodeDefined(system, name)) {
        throw new Error(
          `start references undeclared node '${name}' in system '${system.name}'.`
        );
      }
    }
    let totalInitial = 0;
    for (const m of system.initialMass.values()) totalInitial += m;
    if (totalInitial === 0) {
      throw new Error(
        `Markov system '${system.name}' has no initial mass. Use 'start NodeName 1.0;' to set one.`
      );
    }
    for (const [src, edges] of system.connections) {
      let sum = 0;
      for (const e of edges) sum += e.weight;
      if (Math.abs(sum - 1) > 1e-6) {
        throw new Error(
          `Markov system '${system.name}': outgoing weights from '${src}' sum to ${sum}, not 1.0.`
        );
      }
    }
  }
  nodeDefined(system, name) {
    return system.rivers.has(name) || system.dams.has(name);
  }
  requireSystem(at) {
    if (this.currentSystem === null) {
      const where = at ? ` (line ${at.line})` : "";
      throw new Error("No system declared. Use 'system Name;' first." + where);
    }
    return this.currentSystem;
  }
  lookupSystem(nameToken) {
    const sys = this.systems.get(nameToken.lexeme);
    if (!sys) {
      throw new Error(
        `System '${nameToken.lexeme}' not found (line ${nameToken.line}).`
      );
    }
    return sys;
  }
};

// src/token.ts
var Token = class {
  constructor(type, lexeme, literal, line) {
    this.type = type;
    this.lexeme = lexeme;
    this.literal = literal;
    this.line = line;
  }
  type;
  lexeme;
  literal;
  line;
  toString() {
    return `${this.type} ${this.lexeme} ${this.literal ?? ""}`;
  }
};

// src/parser.ts
var ParseError = class extends Error {
};
var Parser = class {
  constructor(tokens, errs) {
    this.tokens = tokens;
    this.errs = errs;
  }
  tokens;
  errs;
  current = 0;
  parse() {
    const statements = [];
    while (!this.isAtEnd()) {
      const stmt = this.declaration();
      if (stmt !== null) statements.push(stmt);
    }
    return statements;
  }
  declaration() {
    try {
      if (this.match("MODE" /* MODE */)) return this.modeDeclaration();
      if (this.match("SYSTEM" /* SYSTEM */)) return this.systemDeclaration();
      if (this.match("RIVER" /* RIVER */)) return this.riverDeclaration();
      if (this.match("DAM" /* DAM */)) return this.damDeclaration();
      if (this.match("OUTLET" /* OUTLET */)) return this.outletDeclaration();
      if (this.match("START" /* START */)) return this.startStatement();
      if (this.match("MAP" /* MAP */)) return this.mapStatement();
      if (this.match("LIST" /* LIST */)) return this.listStatement();
      if (this.match("PRINT" /* PRINT */)) return this.printStatement();
      if (this.match("HELP" /* HELP */)) return this.helpStatement();
      return this.chain();
    } catch (e) {
      if (e instanceof ParseError) {
        this.synchronize();
        return null;
      }
      throw e;
    }
  }
  modeDeclaration() {
    const name = this.consume("IDENTIFIER" /* IDENTIFIER */, "Expect mode name (e.g. river, markov).");
    this.consume("SEMICOLON" /* SEMICOLON */, "Expect ';' after mode name.");
    return { kind: "ModeDecl", mode: name };
  }
  startStatement() {
    const node = this.consume("IDENTIFIER" /* IDENTIFIER */, "Expect node name after 'start'.");
    const mass = this.consumeNumber("Expect initial mass after node name in 'start'.");
    this.consume("SEMICOLON" /* SEMICOLON */, "Expect ';' after start statement.");
    return { kind: "StartStmt", node, mass };
  }
  systemDeclaration() {
    const name = this.consume("IDENTIFIER" /* IDENTIFIER */, "Expect system name.");
    this.consume("SEMICOLON" /* SEMICOLON */, "Expect ';' after system name.");
    return { kind: "SystemDecl", name };
  }
  mapStatement() {
    const name = this.consume("IDENTIFIER" /* IDENTIFIER */, "Expect system name.");
    this.consume("SEMICOLON" /* SEMICOLON */, "Expect ';' after system name.");
    return { kind: "MapStmt", systemName: name };
  }
  listStatement() {
    const name = this.consume("IDENTIFIER" /* IDENTIFIER */, "Expect system name.");
    this.consume("SEMICOLON" /* SEMICOLON */, "Expect ';' after system name.");
    return { kind: "ListStmt", systemName: name };
  }
  printStatement() {
    const name = this.consume("IDENTIFIER" /* IDENTIFIER */, "Expect system name.");
    let rainfall = null;
    if (this.match("NUMBER" /* NUMBER */)) {
      rainfall = [this.previous().literal];
    } else if (this.match("LEFT_BRACKET" /* LEFT_BRACKET */)) {
      const values = [];
      if (!this.check("RIGHT_BRACKET" /* RIGHT_BRACKET */)) {
        values.push(this.consumeNumber("Expect number in rainfall series."));
        while (this.match("COMMA" /* COMMA */)) {
          values.push(
            this.consumeNumber("Expect number after ',' in rainfall series.")
          );
        }
      }
      this.consume(
        "RIGHT_BRACKET" /* RIGHT_BRACKET */,
        "Expect ']' to close rainfall series."
      );
      rainfall = values;
    }
    this.consume("SEMICOLON" /* SEMICOLON */, "Expect ';' after print statement.");
    return { kind: "PrintStmt", systemName: name, rainfall };
  }
  helpStatement() {
    this.consume("SEMICOLON" /* SEMICOLON */, "Expect ';' after 'help'.");
    return { kind: "HelpStmt" };
  }
  riverDeclaration() {
    const name = this.consume("IDENTIFIER" /* IDENTIFIER */, "Expect river name.");
    const attrs = this.parseBlock(name);
    this.consumeOptional("SEMICOLON" /* SEMICOLON */);
    this.validateAttrs(name, attrs, ["base", "peak"], ["decay"]);
    return {
      kind: "RiverDecl",
      name,
      baseFlow: attrs.get("base"),
      peakMultiplier: attrs.get("peak"),
      decayRate: attrs.get("decay") ?? 0.7
    };
  }
  damDeclaration() {
    const name = this.consume("IDENTIFIER" /* IDENTIFIER */, "Expect dam name.");
    const attrs = this.parseBlock(name);
    this.consumeOptional("SEMICOLON" /* SEMICOLON */);
    this.validateAttrs(
      name,
      attrs,
      ["capacity", "threshold", "normalRate", "openRate"],
      []
    );
    return {
      kind: "DamDecl",
      name,
      capacity: attrs.get("capacity"),
      threshold: attrs.get("threshold"),
      normalRate: attrs.get("normalRate"),
      openRate: attrs.get("openRate")
    };
  }
  outletDeclaration() {
    const name = this.consume("IDENTIFIER" /* IDENTIFIER */, "Expect outlet name.");
    if (this.check("LEFT_BRACE" /* LEFT_BRACE */)) {
      const attrs = this.parseBlock(name);
      if (attrs.size > 0) {
        throw this.errorAt(
          name,
          `Outlet '${name.lexeme}' takes no attributes.`
        );
      }
    }
    this.consumeOptional("SEMICOLON" /* SEMICOLON */);
    return { kind: "OutletDecl", name };
  }
  chain() {
    if (!this.check("IDENTIFIER" /* IDENTIFIER */)) {
      throw this.errorAt(this.peek(), "Expect declaration or chain.");
    }
    const nodes = [];
    const arrows = [];
    nodes.push(this.advance());
    while (this.atArrowStart()) {
      arrows.push(this.parseArrow());
      nodes.push(this.consume("IDENTIFIER" /* IDENTIFIER */, "Expect node name after arrow."));
    }
    this.consume("SEMICOLON" /* SEMICOLON */, "Expect ';' after chain.");
    return { kind: "Chain", nodes, arrows };
  }
  atArrowStart() {
    if (this.check("ARROW" /* ARROW */)) return true;
    if (this.check("LARROW" /* LARROW */)) return true;
    if (this.check("DASH" /* DASH */) && this.peekAt(1, "LEFT_BRACKET" /* LEFT_BRACKET */)) return true;
    return false;
  }
  parseArrow() {
    if (this.match("ARROW" /* ARROW */)) {
      return { forward: true, weight: null, op: this.previous() };
    }
    if (this.match("LARROW" /* LARROW */)) {
      const op2 = this.previous();
      if (this.match("LEFT_BRACKET" /* LEFT_BRACKET */)) {
        const w2 = this.consumeNumber("Expect weight number inside arrow brackets.");
        this.consume("RIGHT_BRACKET" /* RIGHT_BRACKET */, "Expect ']' after arrow weight.");
        this.consume("DASH" /* DASH */, "Expect '-' to close '<-[w]-' arrow.");
        return { forward: false, weight: w2, op: op2 };
      }
      return { forward: false, weight: null, op: op2 };
    }
    const op = this.consume("DASH" /* DASH */, "Expect arrow.");
    this.consume("LEFT_BRACKET" /* LEFT_BRACKET */, "Expect '[' after '-' to start a weighted arrow.");
    const w = this.consumeNumber("Expect weight number inside arrow brackets.");
    this.consume("RIGHT_BRACKET" /* RIGHT_BRACKET */, "Expect ']' after arrow weight.");
    this.consume("ARROW" /* ARROW */, "Expect '->' to close '-[w]->' arrow.");
    return { forward: true, weight: w, op };
  }
  peekAt(offset, type) {
    const idx = this.current + offset;
    if (idx >= this.tokens.length) return false;
    return this.tokens[idx].type === type;
  }
  parseBlock(declName) {
    this.consume(
      "LEFT_BRACE" /* LEFT_BRACE */,
      `Expect '{' to open '${declName.lexeme}' attributes.`
    );
    const attrs = /* @__PURE__ */ new Map();
    while (!this.check("RIGHT_BRACE" /* RIGHT_BRACE */) && !this.isAtEnd()) {
      const key = this.consume("IDENTIFIER" /* IDENTIFIER */, "Expect attribute name.");
      this.consume(
        "COLON" /* COLON */,
        `Expect ':' after attribute name '${key.lexeme}'.`
      );
      let value = this.consumeNumber("Expect number after ':'.");
      if (this.match("PERCENT" /* PERCENT */)) value = value / 100;
      if (attrs.has(key.lexeme)) {
        throw this.errorAt(key, `Duplicate attribute '${key.lexeme}'.`);
      }
      attrs.set(key.lexeme, value);
      this.match("COMMA" /* COMMA */);
    }
    this.consume("RIGHT_BRACE" /* RIGHT_BRACE */, "Expect '}' to close attributes.");
    return attrs;
  }
  validateAttrs(declName, attrs, required, optional) {
    for (const key of attrs.keys()) {
      if (!required.includes(key) && !optional.includes(key)) {
        throw this.errorAt(
          declName,
          `Unknown attribute '${key}' on '${declName.lexeme}'.`
        );
      }
    }
    for (const r of required) {
      if (!attrs.has(r)) {
        throw this.errorAt(
          declName,
          `Missing required attribute '${r}' on '${declName.lexeme}'.`
        );
      }
    }
  }
  consumeNumber(message) {
    if (!this.check("NUMBER" /* NUMBER */)) {
      throw this.errorAt(this.peek(), message);
    }
    return this.advance().literal;
  }
  match(...types) {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }
  consumeOptional(type) {
    if (this.check(type)) this.advance();
  }
  consume(type, message) {
    if (this.check(type)) return this.advance();
    throw this.errorAt(this.peek(), message);
  }
  check(type) {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }
  advance() {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }
  isAtEnd() {
    return this.peek().type === "EOF" /* EOF */;
  }
  peek() {
    return this.tokens[this.current];
  }
  previous() {
    return this.tokens[this.current - 1];
  }
  errorAt(token, message) {
    if (token.type === "EOF" /* EOF */) {
      this.errs.push(`[line ${token.line}] Error at end: ${message}
`);
    } else {
      this.errs.push(
        `[line ${token.line}] Error at '${token.lexeme}': ${message}
`
      );
    }
    return new ParseError();
  }
  synchronize() {
    this.advance();
    while (!this.isAtEnd()) {
      if (this.previous().type === "SEMICOLON" /* SEMICOLON */) return;
      switch (this.peek().type) {
        case "MODE" /* MODE */:
        case "SYSTEM" /* SYSTEM */:
        case "RIVER" /* RIVER */:
        case "DAM" /* DAM */:
        case "OUTLET" /* OUTLET */:
        case "START" /* START */:
        case "MAP" /* MAP */:
        case "LIST" /* LIST */:
        case "PRINT" /* PRINT */:
          return;
      }
      this.advance();
    }
  }
};

// src/scanner.ts
var KEYWORDS = {
  system: "SYSTEM" /* SYSTEM */,
  map: "MAP" /* MAP */,
  list: "LIST" /* LIST */,
  print: "PRINT" /* PRINT */,
  help: "HELP" /* HELP */,
  river: "RIVER" /* RIVER */,
  dam: "DAM" /* DAM */,
  outlet: "OUTLET" /* OUTLET */,
  mode: "MODE" /* MODE */,
  start: "START" /* START */
};
var Scanner = class {
  constructor(source, errs) {
    this.source = source;
    this.errs = errs;
  }
  source;
  errs;
  tokens = [];
  start = 0;
  current = 0;
  line = 1;
  scanTokens() {
    while (!this.isAtEnd()) {
      this.start = this.current;
      this.scanToken();
    }
    this.tokens.push(new Token("EOF" /* EOF */, "", null, this.line));
    return this.tokens;
  }
  scanToken() {
    const c = this.advance();
    switch (c) {
      case "[":
        this.addToken("LEFT_BRACKET" /* LEFT_BRACKET */);
        break;
      case "]":
        this.addToken("RIGHT_BRACKET" /* RIGHT_BRACKET */);
        break;
      case "{":
        this.addToken("LEFT_BRACE" /* LEFT_BRACE */);
        break;
      case "}":
        this.addToken("RIGHT_BRACE" /* RIGHT_BRACE */);
        break;
      case ",":
        this.addToken("COMMA" /* COMMA */);
        break;
      case ";":
        this.addToken("SEMICOLON" /* SEMICOLON */);
        break;
      case "%":
        this.addToken("PERCENT" /* PERCENT */);
        break;
      case ":":
        this.addToken("COLON" /* COLON */);
        break;
      case "-":
        if (this.match(">")) {
          this.addToken("ARROW" /* ARROW */);
        } else {
          this.addToken("DASH" /* DASH */);
        }
        break;
      case "<":
        if (this.match("-")) {
          this.addToken("LARROW" /* LARROW */);
        } else {
          this.errs.push(`Unexpected character: < at line ${this.line}
`);
        }
        break;
      case "/":
        if (this.match("/")) {
          while (this.peek() !== "\n" && !this.isAtEnd()) this.advance();
        } else if (this.match("*")) {
          this.blockComment();
        } else {
          this.errs.push(`Unexpected character: / at line ${this.line}
`);
        }
        break;
      case " ":
      case "\r":
      case "	":
        break;
      case "\n":
        this.line++;
        break;
      default:
        if (this.isDigit(c)) {
          this.number();
        } else if (this.isAlpha(c)) {
          this.identifier();
        } else {
          this.errs.push(`Unexpected character: ${c} at line ${this.line}
`);
        }
        break;
    }
  }
  blockComment() {
    while (!this.isAtEnd()) {
      if (this.peek() === "*" && this.peekNext() === "/") {
        this.advance();
        this.advance();
        return;
      }
      if (this.peek() === "\n") this.line++;
      this.advance();
    }
    this.errs.push(`Unterminated block comment starting near line ${this.line}
`);
  }
  identifier() {
    while (this.isAlphaNumeric(this.peek())) this.advance();
    const text = this.source.slice(this.start, this.current);
    const type = KEYWORDS[text] ?? "IDENTIFIER" /* IDENTIFIER */;
    this.addTokenLit(type, null);
  }
  number() {
    while (this.isDigit(this.peek())) this.advance();
    if (this.peek() === "." && this.isDigit(this.peekNext())) {
      this.advance();
      while (this.isDigit(this.peek())) this.advance();
    }
    const value = parseFloat(this.source.slice(this.start, this.current));
    this.addTokenLit("NUMBER" /* NUMBER */, value);
  }
  match(expected) {
    if (this.isAtEnd()) return false;
    if (this.source[this.current] !== expected) return false;
    this.current++;
    return true;
  }
  peek() {
    if (this.isAtEnd()) return "\0";
    return this.source[this.current] ?? "\0";
  }
  peekNext() {
    if (this.current + 1 >= this.source.length) return "\0";
    return this.source[this.current + 1] ?? "\0";
  }
  isAlpha(c) {
    return c >= "a" && c <= "z" || c >= "A" && c <= "Z";
  }
  isAlphaNumeric(c) {
    return this.isAlpha(c) || this.isDigit(c);
  }
  isDigit(c) {
    return c >= "0" && c <= "9";
  }
  isAtEnd() {
    return this.current >= this.source.length;
  }
  advance() {
    return this.source[this.current++] ?? "\0";
  }
  addToken(type) {
    this.addTokenLit(type, null);
  }
  addTokenLit(type, literal) {
    const text = this.source.slice(this.start, this.current);
    this.tokens.push(new Token(type, text, literal, this.line));
  }
};

// src/flox.ts
function interpret(source) {
  const out = [];
  const errs = [];
  const scanner = new Scanner(source, errs);
  const tokens = scanner.scanTokens();
  if (errs.length > 0) {
    return { stdout: out.join(""), stderr: errs.join(""), hadError: true };
  }
  const parser = new Parser(tokens, errs);
  const ast = parser.parse();
  if (errs.length > 0) {
    return { stdout: out.join(""), stderr: errs.join(""), hadError: true };
  }
  const interp = new Interpreter(out, errs);
  interp.interpret(ast);
  return {
    stdout: out.join(""),
    stderr: errs.join(""),
    hadError: errs.length > 0
  };
}
export {
  interpret
};
