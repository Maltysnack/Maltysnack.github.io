/* magic.js
   Minimal explorer. One page, one grid, one interaction.
   Click any card to add to selection. Click in selection to remove.
   Hover for info. URL hash holds the selection so it's shareable.
*/

(function () {
  const DATA_DIR = "/games/data";

  // ── Data state (lazy-loaded) ──
  let meta = null, explore = null, scryfall = null;
  let cards = null, cardsByName = null, pairs = null;
  let allNames = null;
  let dataReady = false;
  let decks = null; // raw decks, lazy-loaded on first "view lists" action
  let listsOpen = false;

  // ── Selection + Bans (mirrored to URL hash #sel=a,b&ban=x,y) ──
  let selection = parseHashList("sel");
  let bans = parseHashList("ban");

  function parseHashList(key) {
    const m = (location.hash || "").match(new RegExp("[#&]" + key + "=([^&]*)"));
    if (!m) return [];
    return m[1].split(",").filter(Boolean).map(decodeURIComponent);
  }
  function writeHash() {
    const parts = [];
    if (selection.length) parts.push("sel=" + selection.map(encodeURIComponent).join(","));
    if (bans.length) parts.push("ban=" + bans.map(encodeURIComponent).join(","));
    const newHash = parts.length ? "#" + parts.join("&") : "";
    if (newHash !== location.hash) {
      history.replaceState(null, "", location.pathname + newHash);
    }
  }
  // Backward compat shim: old name
  function writeSelectionToHash() { writeHash(); }
  function selectionAdd(name) {
    if (!name || selection.includes(name)) return;
    bans = bans.filter((n) => n !== name);   // adding to selection unbans
    selection = [...selection, name];
    listsOpen = false;
    _adHocPairs = null;
    writeHash();
    ensureDecksForBansIfNeeded();
    render();
  }
  function selectionRemove(name) {
    selection = selection.filter((n) => n !== name);
    if (!selection.length) listsOpen = false;
    _adHocPairs = null;
    writeHash();
    render();
  }
  function selectionToggle(name) {
    if (selection.includes(name)) selectionRemove(name);
    else selectionAdd(name);
  }
  function banAdd(name) {
    if (!name || bans.includes(name)) return;
    selection = selection.filter((n) => n !== name);  // banning removes from selection
    bans = [...bans, name];
    _adHocPairs = null;
    writeHash();
    ensureDecksForBansIfNeeded();
    render();
  }
  function banRemove(name) {
    bans = bans.filter((n) => n !== name);
    _adHocPairs = null;
    writeHash();
    render();
  }
  function bansClear() {
    bans = [];
    _adHocPairs = null;
    writeHash();
    render();
  }

  // When bans become active, we need decks_raw.json loaded so we can filter
  // the deck pool. Lazy-fetches in the background if not already loaded.
  async function ensureDecksForBansIfNeeded() {
    if (!bans.length || decks) return;
    try {
      decks = await loadJson("decks_raw");
      _adHocPairs = null;
      render();
    } catch {
      // silent: recommendations fall back to precomputed pairs without ban filter
    }
  }

  // ── Utilities ──
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  function escapeHtml(s) { const d = document.createElement("div"); d.textContent = s ?? ""; return d.innerHTML; }
  function escapeAttr(s) { return escapeHtml(s).replace(/"/g, "&quot;"); }

  function img(name) {
    const m = scryfall && scryfall[name];
    return m ? (m.image_small || m.image || "") : "";
  }
  function imgLarge(name) {
    const m = scryfall && scryfall[name];
    return m ? (m.image || m.image_small || "") : "";
  }
  function isLand(name) {
    const m = scryfall && scryfall[name];
    return !!(m && (m.type_line || "").includes("Land"));
  }
  function isLegal(name) {
    const m = scryfall && scryfall[name];
    return m ? !!m.legal_standard : false;
  }
  function cardData(name) { return cardsByName && cardsByName[name]; }
  function tierTopMark(name) {
    const c = cardData(name);
    return c && (c.tier === "defines" || c.tier === "driving");
  }

  // ── Synergy Score (0-100, calibrated absolute) ──
  // Components:
  //   1. Recency-weighted geometric-mean lift across selection (capped at 30)
  //   2. Sample-size dampening: log(1 + co-occurrence count)
  //   3. Novelty discount: 1 / (1 + 8 * own_recent_prevalence)
  //   4. Coverage: fraction of selection cards this candidate pairs with
  //   5. Standard-legal hard filter (illegal cards return null)
  //   6. Semantic fallback when no direct pair data: capped at 30
  // Calibration constant tuned so that "obvious meta staples" land around 70-80,
  // strong-but-novel hits land 85+, weak/popular noise stays in 30-60.
  const SCORE_SCALE = 16;            // multiplier on raw to push into 0-100
  const NOVELTY_K = 8;               // novelty curve steepness
  const SEMANTIC_CAP = 30;           // ceiling for semantic-only matches
  const LIFT_CAP = 30;

  function synergyScore(name, sel) {
    if (!isLegal(name)) return null;
    if (sel.includes(name)) return null;
    if (bans.includes(name)) return null;
    const activePairs = getActivePairs();
    if (!activePairs) return null;

    const card = cardData(name);
    const recentPrev = card ? (card.recent_main_prevalence || 0) : 0;

    // Direct pair signal: collect lifts to each card in selection that has data
    const validSel = sel.filter((s) => activePairs[s]);
    let lifts = [], cos = [], pCondToSel = [];
    for (const s of validSel) {
      const r = (activePairs[s].companions || []).find((x) => x.name === name);
      if (!r) continue;
      lifts.push(Math.min(r.lift, LIFT_CAP));
      cos.push(r.co_decks);
      pCondToSel.push(r.p_b_given_a);
    }

    if (lifts.length === 0) {
      // No direct data; semantic fallback if at least one selection card has a profile
      return semanticScore(name, sel);
    }

    // Geometric mean of lifts (anchored at 1 so missing pairs neutral, not 0)
    const product = lifts.reduce((a, b) => a * b, 1);
    const geomLift = Math.pow(product, 1 / lifts.length);
    const sumCo = cos.reduce((a, b) => a + b, 0);
    const sample = Math.log(1 + sumCo);
    const coverage = lifts.length / Math.max(validSel.length, 1);
    const novelty = 1 / (1 + NOVELTY_K * recentPrev);
    // Composite raw score
    const raw = Math.log(geomLift) * sample * Math.pow(coverage, 0.7) * novelty;
    // Map raw to 0-100 via the calibration scale
    let score = Math.round(Math.min(99, Math.max(0, raw * SCORE_SCALE)));
    return score;
  }

  // Semantic fallback: shared color identity + same primary type. Bounded low.
  function semanticScore(name, sel) {
    const sf = scryfall && scryfall[name];
    if (!sf) return null;
    let colorOverlap = 0, typeOverlap = 0;
    const myColors = new Set(sf.colors || []);
    const myType = (sf.type_line || "").split(" ")[0];
    let n = 0;
    for (const s of sel) {
      const ssf = scryfall[s];
      if (!ssf) continue;
      n++;
      const sColors = new Set(ssf.colors || []);
      const shared = [...myColors].filter((c) => sColors.has(c)).length;
      if (myColors.size && sColors.size) colorOverlap += shared / Math.max(myColors.size, sColors.size);
      const sType = (ssf.type_line || "").split(" ")[0];
      if (myType && myType === sType) typeOverlap += 1;
    }
    if (n === 0) return null;
    const score = Math.round(((colorOverlap / n) * 0.65 + (typeOverlap / n) * 0.35) * SEMANTIC_CAP);
    return score > 0 ? score : null;
  }

  function scoreColorClass(score) {
    if (score >= 90) return "score-90";
    if (score >= 80) return "score-80";
    if (score >= 70) return "score-70";
    if (score >= 60) return "score-60";
    if (score >= 50) return "score-50";
    return "score-low";
  }

  // Natural-frequency formatter: 0.20 -> "1 in 5"
  function naturalFreq(p) {
    if (!isFinite(p) || p <= 0) return "0 in 100";
    if (p >= 0.5) return Math.round(p * 100) + " in 100";
    const n = Math.round(1 / p);
    return "1 in " + n;
  }

  // dd-mm-yyyy per CLAUDE.md hard rule 5
  function fmtDate(iso) {
    if (!iso || typeof iso !== "string") return "";
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
  }

  // Damerau-Levenshtein for fuzzy search
  function dlDistance(a, b) {
    const al = a.length, bl = b.length;
    if (Math.abs(al - bl) > 3) return 99;
    const d = Array.from({ length: al + 1 }, () => new Int8Array(bl + 1));
    for (let i = 0; i <= al; i++) d[i][0] = i;
    for (let j = 0; j <= bl; j++) d[0][j] = j;
    for (let i = 1; i <= al; i++) {
      for (let j = 1; j <= bl; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
    return d[al][bl];
  }

  // ── Scryfall-style search filters parsed from the search input ──
  // Supports: t:creature, c:r (color), cmc<=3, cmc=2, c>=2 (multi-color)
  function parseSearchQuery(q) {
    const filters = [];
    let textParts = [];
    for (const tok of q.split(/\s+/)) {
      if (!tok) continue;
      let m;
      if ((m = tok.match(/^t:(.+)$/i))) filters.push((sf) => (sf.type_line || "").toLowerCase().includes(m[1].toLowerCase()));
      else if ((m = tok.match(/^c:([wubrg]+)$/i))) {
        const want = new Set(m[1].toUpperCase().split(""));
        filters.push((sf) => [...(sf.colors || [])].every((c) => want.has(c)) && (sf.colors || []).length > 0);
      }
      else if ((m = tok.match(/^cmc(<=|>=|=|<|>)(\d+(?:\.\d+)?)$/i))) {
        const op = m[1], val = parseFloat(m[2]);
        filters.push((sf) => {
          const v = sf.cmc || 0;
          return op === "=" ? v === val : op === "<=" ? v <= val : op === ">=" ? v >= val : op === "<" ? v < val : v > val;
        });
      }
      else textParts.push(tok);
    }
    return { text: textParts.join(" ").toLowerCase(), filters };
  }

  function searchMatches(rawQuery) {
    if (!allNames || !rawQuery) return [];
    const { text, filters } = parseSearchQuery(rawQuery);
    const exact = [], prefix = [], contains = [], fuzzy = [];
    for (const n of allNames) {
      const sf = scryfall[n] || {};
      if (filters.length && !filters.every((f) => f(sf))) continue;
      if (!text) { contains.push(n); continue; }
      const nl = n.toLowerCase();
      if (nl === text) exact.push(n);
      else if (nl.startsWith(text)) prefix.push(n);
      else if (nl.includes(text)) contains.push(n);
      else if (text.length >= 4 && Math.abs(nl.length - text.length) <= 3) {
        const d = dlDistance(nl.slice(0, text.length + 2), text);
        if (d <= 2) fuzzy.push([n, d]);
      }
    }
    fuzzy.sort((a, b) => a[1] - b[1]);
    const fuzzNames = fuzzy.slice(0, 10).map((x) => x[0]);
    const rank = (n) => {
      const c = cardData(n);
      return c ? -(c.centerpiece_decks * 2 + c.any_decks) : 0;
    };
    exact.sort((a, b) => rank(a) - rank(b));
    prefix.sort((a, b) => rank(a) - rank(b));
    contains.sort((a, b) => rank(a) - rank(b));
    return [...exact, ...prefix, ...contains, ...fuzzNames].slice(0, 20);
  }

  // ── Recommendation: combined lift across selection ──
  // For each candidate card, compute geometric mean of lifts to each selected card
  // that has data. Cards already in selection are excluded from results.
  function combinedRecommendations(sel, limit = 36) {
    if (!sel.length || !pairs) return [];
    const validSel = sel.filter((n) => pairs[n]);
    if (!validSel.length) {
      // Fallback: shared neighbors of selection in same color/type space
      return secondOrderRecommendations(sel, limit);
    }
    const selSet = new Set(sel);

    // Aggregate: for each candidate card, collect its lifts to each selected card
    const agg = new Map(); // name -> { lifts: [..], sumPGivenA: ..., count }
    for (const a of validSel) {
      for (const r of pairs[a].companions) {
        if (selSet.has(r.name)) continue;
        let entry = agg.get(r.name);
        if (!entry) { entry = { lifts: [], pGivenSel: [], count: 0 }; agg.set(r.name, entry); }
        entry.lifts.push(r.lift);
        entry.pGivenSel.push(r.p_b_given_a);
        entry.count++;
      }
    }

    // Score: geometric mean of lifts. Weight by count (cards present in more pin-lifts rank higher).
    const scored = [];
    for (const [name, entry] of agg) {
      const product = entry.lifts.reduce((a, b) => a * b, 1);
      const geomLift = Math.pow(product, 1 / entry.lifts.length);
      const avgPGivenSel = entry.pGivenSel.reduce((a, b) => a + b, 0) / entry.pGivenSel.length;
      const coverage = entry.count / validSel.length; // 1.0 = appears with all
      // Composite score: stronger lift × higher coverage. Coverage bumps cards
      // that play with everyone over cards that play with just one.
      const score = geomLift * Math.pow(coverage, 0.7);
      scored.push({ name, geomLift, avgPGivenSel, coverage, score });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  // Second-order: when selection has only data-light cards, find cards in the
  // same color/type space whose synergy partners overlap with the selection.
  function secondOrderRecommendations(sel, limit) {
    const colors = new Set();
    const types = new Set();
    for (const n of sel) {
      const sf = scryfall[n] || {};
      (sf.colors || []).forEach((c) => colors.add(c));
      const t = (sf.type_line || "").split(" ")[0];
      if (t) types.add(t);
    }
    const candidates = [];
    for (const c of cards || []) {
      if (sel.includes(c.name)) continue;
      const sf = scryfall[c.name] || {};
      const cColors = sf.colors || [];
      // Color overlap required (any shared color)
      if (cColors.length && colors.size && !cColors.some((x) => colors.has(x))) continue;
      candidates.push({
        name: c.name,
        geomLift: 1,
        avgPGivenSel: 0,
        coverage: 0,
        score: c.centerpiece_decks * 2 + c.any_decks,
      });
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, limit);
  }

  // ── Render ──
  function render() {
    const root = $(".magic-page");
    if (!root) return;
    root.innerHTML = `
      ${renderSearch()}
      ${renderSelection()}
      ${selection.length ? renderRecommendations() : renderLanding()}
      <footer class="dataset-stamp" id="dataset-stamp"></footer>
    `;
    fillDatasetStamp();
    wireSearch();
    wireCardClicks();
  }

  function renderSearch() {
    return `
      <div class="search-shell">
        <input class="search-input" type="text" placeholder="search…  try t:creature  c:ur  cmc<=3" autocomplete="off" spellcheck="false" value="">
        <div class="search-results"></div>
      </div>
    `;
  }

  function chipHtml(n, kind) {
    const im = img(n);
    return `<div class="chip chip-${kind}" data-name="${escapeAttr(n)}">
      <button class="chip-card" data-action="open" title="${escapeAttr(n)}">
        ${im ? `<img src="${im}" alt="">` : `<span class="chip-noimg">${escapeHtml(n)}</span>`}
      </button>
      <div class="chip-actions">
        ${kind === "sel"
          ? `<button class="chip-act chip-rem" data-action="remove" title="remove from selection">×</button>
             <button class="chip-act chip-ban" data-action="ban" title="ban this card">⊘</button>`
          : `<button class="chip-act chip-rem" data-action="unban" title="remove ban">×</button>
             <button class="chip-act chip-promote" data-action="promote" title="move to selection">↑</button>`}
      </div>
    </div>`;
  }

  function renderSelection() {
    if (!selection.length && !bans.length) return "";

    let html = "";

    if (selection.length) {
      const matchHint = decks
        ? (() => {
            const n = matchingDecks().length;
            return n > 0
              ? `<button class="sel-strip-jump" id="sel-jump-lists">${n} matching list${n === 1 ? "" : "s"} ↓</button>`
              : `<span class="sel-strip-hint">no matching lists</span>`;
          })()
        : `<button class="sel-strip-jump" id="sel-jump-lists">find matching lists ↓</button>`;
      html += `
        <div class="sel-strip">
          <div class="sel-strip-label">Selection</div>
          <div class="sel-strip-cards">${selection.map((n) => chipHtml(n, "sel")).join("")}</div>
          ${matchHint}
          <button class="sel-strip-export" id="sel-export" title="copy as 4-of for MTGA import">export</button>
          <button class="sel-strip-clear" id="sel-clear" title="clear selection">clear</button>
          <div class="sel-strip-status" id="sel-status"></div>
        </div>
      `;
    }

    if (bans.length) {
      html += `
        <div class="sel-strip ban-strip">
          <div class="sel-strip-label">Banned</div>
          <div class="sel-strip-cards">${bans.map((n) => chipHtml(n, "ban")).join("")}</div>
          <span class="sel-strip-hint">these cards and decks containing them are excluded from all stats</span>
          <button class="sel-strip-clear" id="ban-clear" title="clear bans">clear</button>
        </div>
      `;
    }

    return html;
  }

  function renderLanding() {
    if (!explore) return `<div class="loading">loading…</div>`;
    const recentRange = explore.recent_window_weeks.length
      ? `${fmtDate(explore.recent_window_weeks[0])} to ${fmtDate(explore.recent_window_weeks.at(-1))}`
      : "";

    return `
      <div class="stacked">
        ${section("Pillars right now", `last 8 weeks · ${recentRange}`,
          renderGrid(explore.pillars.map((r) => ({
            name: r.name,
            line: `${naturalFreq(r.recent_centerpiece_prevalence)} winning decks`,
          })))
        )}
        ${section("Recently risen", "last 8wk vs prior 8wk",
          renderGrid(explore.risen.map((r) => ({
            name: r.name,
            line: `+${(r.delta * 100).toFixed(1)}pp · now ${naturalFreq(r.recent)}`,
          })))
        )}
        ${section("Sideboards are preparing for", "side prevalence rising",
          renderGrid(explore.side_risers.map((r) => ({
            name: r.name,
            line: `+${(r.delta * 100).toFixed(1)}pp in sideboards`,
          })))
        )}
        ${section("New arrivals that moved a shell", "catalyst detection",
          renderGrid(explore.catalysts.map((r) => ({
            name: r.name,
            line: `arrived ${fmtDate(r.first_week)} · its shell moved +${(r.shell_delta * 100).toFixed(1)}pp`,
          })))
        )}
        ${section("Quietly disappeared", "biggest losers, last 8wk vs prior",
          renderGrid(explore.disappeared.map((r) => ({
            name: r.name,
            line: `${(r.delta * 100).toFixed(1)}pp · now ${naturalFreq(r.recent)}`,
          })))
        )}
      </div>
    `;
  }

  // ── Matching decks ──
  // Decks (in decks_raw.json) where every card in selection appears in main.
  // When bans are active, decks containing any banned card are excluded.
  function matchingDecks() {
    if (!decks || !selection.length) return [];
    const banSet = new Set(bans);
    return decks.filter((d) => {
      const names = new Set((d.main || []).map((c) => c.name));
      if (bans.length && [...names].some((n) => banSet.has(n))) return false;
      return selection.every((n) => names.has(n));
    });
  }

  // ── Ban-aware ad-hoc pair stats ──
  // When bans are active we recompute pair stats in the browser, filtering
  // out any deck containing a banned card. Cached until selection or bans change.
  let _adHocPairs = null;

  function getActivePairs() {
    if (!bans.length) return pairs;            // no bans: use precomputed
    if (!decks) return pairs;                  // not loaded yet: fall back gracefully
    if (_adHocPairs) return _adHocPairs;       // cached for this state
    const banSet = new Set(bans);
    const cutoff = (meta && meta.pair_window_first_week) || "";
    const filtered = decks.filter((d) => {
      if (cutoff && (d.week || "") < cutoff) return false;
      return !(d.main || []).some((c) => banSet.has(c.name));
    });
    _adHocPairs = computeAdHocPairs(filtered, selection);
    return _adHocPairs;
  }

  function computeAdHocPairs(filteredDecks, sel) {
    const totalW = filteredDecks.reduce((s, d) => s + (d.weight || 1), 0);
    if (totalW === 0 || !sel.length) return {};
    const cardW = new Map();
    for (const d of filteredDecks) {
      const w = d.weight || 1;
      for (const c of d.main || []) {
        cardW.set(c.name, (cardW.get(c.name) || 0) + w);
      }
    }
    const result = {};
    for (const a of sel) {
      const decksWithA = filteredDecks.filter((d) => (d.main || []).some((c) => c.name === a));
      const aW = decksWithA.reduce((s, d) => s + (d.weight || 1), 0);
      if (aW === 0) continue;
      const pA = aW / totalW;
      const candCoW = new Map();
      for (const d of decksWithA) {
        const w = d.weight || 1;
        for (const c of d.main || []) {
          if (c.name === a) continue;
          candCoW.set(c.name, (candCoW.get(c.name) || 0) + w);
        }
      }
      const companions = [];
      for (const [cand, coW] of candCoW) {
        if (coW < 4) continue;  // noise floor
        const candTotal = cardW.get(cand) || 0;
        if (candTotal === 0) continue;
        const pCand = candTotal / totalW;
        const pCo = coW / totalW;
        const lift = pCo / (pA * pCand);
        companions.push({
          name: cand,
          lift,
          co_decks: Math.round(coW),
          p_b_given_a: coW / aW,
          p_a_given_b: coW / candTotal,
        });
      }
      companions.sort((a, b) => b.lift - a.lift);
      result[a] = { companions };
    }
    return result;
  }

  function renderRecommendations() {
    if (!dataReady) return `<div class="loading">loading…</div>`;

    // Score every viable candidate and rank
    const activePairs = getActivePairs();
    const scored = [];
    const seen = new Set(selection);
    const banSet = new Set(bans);
    const candidates = new Set();
    for (const s of selection) {
      if (activePairs && activePairs[s]) for (const r of activePairs[s].companions) candidates.add(r.name);
    }
    // For sparse selections without pair data, also score the eligible card pool
    if (candidates.size < 12) {
      for (const c of cards || []) candidates.add(c.name);
    }
    // Hard filter banned cards
    for (const b of banSet) candidates.delete(b);
    for (const name of candidates) {
      if (seen.has(name)) continue;
      const score = synergyScore(name, selection);
      if (score === null) continue;
      scored.push({ name, score });
    }
    scored.sort((a, b) => b.score - a.score);

    const spells = scored.filter((r) => !isLand(r.name)).slice(0, 36);
    const lands = scored.filter((r) => isLand(r.name)).slice(0, 12);

    const subtitle = selection.length === 1
      ? `cards that go with ${escapeHtml(selection[0])}`
      : `cards that go with all ${selection.length} of your team`;

    const landItems = lands.map((r) => {
      const im = img(r.name);
      const cls = scoreColorClass(r.score);
      return `<button class="manabase-card" data-name="${escapeAttr(r.name)}" title="${escapeAttr(r.name)}">
        ${im ? `<img class="manabase-thumb" src="${im}" alt="">` : `<div class="manabase-thumb"></div>`}
        <span class="manabase-score ${cls}">${r.score}</span>
      </button>`;
    }).join("");

    return `
      <div class="stacked">
        ${section("What fits", subtitle, renderGrid(spells))}
        ${landItems ? `<div class="manabase-row"><div class="manabase-label">Manabase ties</div><div class="manabase-strip">${landItems}</div></div>` : ""}
        ${renderListsSection()}
      </div>
    `;
  }

  function renderListsSection() {
    // Always offer the toggle when selection is non-empty. Lazy-load decks_raw on first open.
    const matchCount = decks ? matchingDecks().length : null;
    const label = matchCount === null
      ? "view matching lists"
      : `${matchCount} matching list${matchCount === 1 ? "" : "s"}`;
    const arrow = listsOpen ? "▴" : "▾";
    return `
      <section class="sec lists-sec">
        <button class="lists-toggle" id="lists-toggle">${label} ${arrow}</button>
        ${listsOpen && decks ? renderListsBody() : ""}
      </section>
    `;
  }

  let _matchingCache = null;
  function renderListsBody() {
    const ms = matchingDecks();
    if (!ms.length) {
      return `<div class="rec-empty">no winning lists contain all of these cards together</div>`;
    }
    ms.sort((a, b) => (b.weight || 1) - (a.weight || 1) || (b.week || "").localeCompare(a.week || ""));
    _matchingCache = ms;
    return `<div class="lists-body">${ms.map((d, i) => renderDeck(d, i)).join("")}</div>`;
  }

  function tierLabelForWeight(w) {
    if (w >= 10) return "PT Top 8";
    if (w >= 5) return "Pro Tour";
    if (w >= 3) return "Premier event";
    return "Ladder";
  }

  function renderDeck(d, idx) {
    const title = d.deck_title || "Unknown player";
    const sub = d.subtitle || "";
    const ev = d.event_name || "";
    const dt = d.event_date || (d.week ? fmtDate(d.week) : "");
    const tag = tierLabelForWeight(d.weight || 1);
    const link = d.source ? `<a class="deck-source" href="${escapeAttr(d.source)}" target="_blank" rel="noopener">source ↗</a>` : "";
    const renderCardLine = (c) => {
      const inSel = selection.includes(c.name);
      return `<li class="${inSel ? "deck-line-hit" : ""}"><span class="deck-line-q">${c.qty}</span><button class="deck-line-name" data-name="${escapeAttr(c.name)}">${escapeHtml(c.name)}</button></li>`;
    };
    const main = (d.main || []).map(renderCardLine).join("");
    const side = (d.side || []).map(renderCardLine).join("");
    return `
      <article class="deck-card">
        <header class="deck-card-head">
          <div class="deck-card-row">
            <div class="deck-card-title">${escapeHtml(title)}</div>
            <div class="deck-card-actions">
              <button class="deck-card-action" data-deck-action="copy-mtga" data-deck-idx="${idx}">copy to MTGA</button>
              <button class="deck-card-action" data-deck-action="load-sel" data-deck-idx="${idx}">load into selection</button>
            </div>
          </div>
          <div class="deck-card-sub">
            ${sub ? `<span>${escapeHtml(sub)}</span>` : ""}
            ${ev ? `<span>${escapeHtml(ev)}</span>` : ""}
            ${dt ? `<span>${escapeHtml(dt)}</span>` : ""}
            <span class="deck-card-tag">${tag}</span>
            ${link}
          </div>
        </header>
        <div class="deck-card-cols">
          <div class="deck-card-col">
            <div class="deck-card-col-label">Main</div>
            <ul class="deck-card-list">${main}</ul>
          </div>
          ${side ? `<div class="deck-card-col">
            <div class="deck-card-col-label">Sideboard</div>
            <ul class="deck-card-list">${side}</ul>
          </div>` : ""}
        </div>
        <div class="deck-card-status" id="deck-card-status-${idx}"></div>
      </article>
    `;
  }

  function section(title, sub, body) {
    return `
      <section class="sec">
        <header class="sec-header">
          <h2 class="sec-title">${escapeHtml(title)}</h2>
          <span class="sec-sub">${escapeHtml(sub)}</span>
        </header>
        ${body}
      </section>
    `;
  }

  function renderGrid(items) {
    if (!items.length) return `<div class="rec-empty">nothing here yet</div>`;
    return `<div class="grid">${items.map(renderThumb).join("")}</div>`;
  }

  // Items are either {name, score} (recommendation context) or {name, line} (landing).
  // Landing thumbs show no number; recommendation thumbs show only the colored score.
  function renderThumb(item) {
    const name = item.name;
    const im = img(name);
    const inSel = selection.includes(name);
    const score = typeof item.score === "number" ? item.score : null;
    const cls = score !== null ? scoreColorClass(score) : "";
    return `<button class="thumb${inSel ? " in-sel" : ""}" data-name="${escapeAttr(name)}" title="${escapeAttr(name)}">
      ${im ? `<img class="thumb-img" src="${im}" alt="" loading="lazy">` : `<div class="thumb-img thumb-noimg">${escapeHtml(name)}</div>`}
      ${score !== null ? `
        <a class="thumb-score ${cls}" href="/games/synergy-score.html" title="synergy score, click for explanation" data-stop>${score}</a>
      ` : ""}
    </button>`;
  }

  function fillDatasetStamp() {
    const el = $("#dataset-stamp");
    if (!el || !meta) return;
    const wb = meta.n_decks_by_weight || {};
    const pieces = [];
    if (wb["10"]) pieces.push(`${wb["10"]} PT Top 8`);
    if (wb["5"]) pieces.push(`${wb["5"]} PT main`);
    if (wb["3"]) pieces.push(`${wb["3"]} premier event`);
    if (wb["1"]) pieces.push(`${wb["1"]} ladder`);
    el.textContent = `${meta.n_decks.toLocaleString()} winning decks · ${pieces.join(", ")} · ${meta.n_weeks} weeks · ${fmtDate(meta.first_week)} to ${fmtDate(meta.last_week)}`;
  }

  // ── Wiring ──
  function wireSearch() {
    const input = $(".search-input");
    const box = $(".search-results");
    if (!input) return;
    let activeIdx = -1, currentResults = [];

    function showResults(names) {
      currentResults = names;
      activeIdx = -1;
      if (!names.length) { box.classList.remove("open"); box.innerHTML = ""; return; }
      box.innerHTML = names.map((n, i) => {
        const im = img(n);
        const c = cardData(n);
        const sub = c ? `${naturalFreq(c.centerpiece_prevalence)} winning decks` :
                    (scryfall[n] && scryfall[n].released_at) ? `not in winning lists` : "";
        return `<div class="sr" data-idx="${i}" data-name="${escapeAttr(n)}">
          ${im ? `<img class="sr-img" src="${im}" alt="">` : `<div class="sr-img"></div>`}
          <div class="sr-text"><div class="sr-name">${escapeHtml(n)}</div><div class="sr-sub">${sub}</div></div>
        </div>`;
      }).join("");
      box.classList.add("open");
      $$(".sr", box).forEach((el) => {
        el.addEventListener("mousedown", (e) => {
          e.preventDefault();
          selectionAdd(el.dataset.name);
          input.value = "";
          showResults([]);
        });
      });
    }

    input.addEventListener("input", () => {
      if (!dataReady) return;
      showResults(searchMatches(input.value.trim()));
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); activeIdx = Math.min(activeIdx + 1, currentResults.length - 1); highlight(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); activeIdx = Math.max(activeIdx - 1, 0); highlight(); }
      else if (e.key === "Enter") {
        e.preventDefault();
        const target = currentResults[activeIdx >= 0 ? activeIdx : 0];
        if (target) { selectionAdd(target); input.value = ""; showResults([]); }
      } else if (e.key === "Escape") { input.value = ""; showResults([]); }
    });
    function highlight() {
      $$(".sr", box).forEach((el, i) => el.classList.toggle("active", i === activeIdx));
    }
    document.addEventListener("click", (e) => {
      if (!box.contains(e.target) && e.target !== input) box.classList.remove("open");
    });
  }

  function wireCardClicks() {
    // Grid thumbnails: click on art toggles selection, click on score follows the link
    $$(".thumb").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (e.target.closest("[data-stop]")) return; // let the score link navigate
        e.preventDefault();
        selectionToggle(el.dataset.name);
      });
    });
    // Selection / ban chip actions
    $$(".chip").forEach((el) => {
      const name = el.dataset.name;
      el.addEventListener("click", (e) => {
        const target = e.target.closest("[data-action]");
        if (!target) return;
        const action = target.dataset.action;
        if (action === "open") {
          // Click on the card art does nothing in selection (use the × button to remove).
          // For bans, also no-op on art click.
        } else if (action === "remove") selectionRemove(name);
        else if (action === "ban") banAdd(name);
        else if (action === "unban") banRemove(name);
        else if (action === "promote") { banRemove(name); selectionAdd(name); }
      });
    });
    // Manabase rows
    $$(".manabase-card").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (e.target.closest("[data-stop]")) return;
        selectionToggle(el.dataset.name);
      });
    });
    // Export
    const exp = $("#sel-export");
    if (exp) exp.addEventListener("click", exportToMtga);
    // Selection clear (no confirmation, per design)
    const clr = $("#sel-clear");
    if (clr) clr.addEventListener("click", () => {
      selection = [];
      _adHocPairs = null;
      writeHash();
      render();
    });
    const banClr = $("#ban-clear");
    if (banClr) banClr.addEventListener("click", bansClear);
    // Jump-to-lists button in selection strip
    const jump = $("#sel-jump-lists");
    if (jump) jump.addEventListener("click", async () => {
      if (!decks) {
        jump.textContent = "loading lists…";
        try { decks = await loadJson("decks_raw"); }
        catch { jump.textContent = "couldn't load lists"; return; }
      }
      listsOpen = true;
      render();
      const sec = $(".lists-sec");
      if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    // View matching lists toggle (in body)
    const ltog = $("#lists-toggle");
    if (ltog) ltog.addEventListener("click", async () => {
      if (!decks) {
        ltog.textContent = "loading lists…";
        try { decks = await loadJson("decks_raw"); }
        catch { ltog.textContent = "couldn't load lists"; return; }
      }
      listsOpen = !listsOpen;
      render();
      if (listsOpen) {
        const sec = $(".lists-sec");
        if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
    // Cards inside a deck list are clickable to add to selection
    $$(".deck-line-name").forEach((el) => {
      el.addEventListener("click", () => selectionToggle(el.dataset.name));
    });
    // Per-list actions
    $$("[data-deck-action]").forEach((el) => {
      el.addEventListener("click", () => {
        const idx = parseInt(el.dataset.deckIdx, 10);
        const action = el.dataset.deckAction;
        const d = _matchingCache && _matchingCache[idx];
        if (!d) return;
        if (action === "copy-mtga") copyDeckToMtga(d, idx);
        if (action === "load-sel") loadDeckIntoSelection(d);
      });
    });
  }

  function deckToMtgaText(d) {
    const lines = ["Deck"];
    for (const c of d.main || []) {
      const sf = scryfall[c.name] || {};
      const setCn = sf.set && sf.cn ? ` (${sf.set}) ${sf.cn}` : "";
      lines.push(`${c.qty} ${c.name}${setCn}`);
    }
    if (d.side && d.side.length) {
      lines.push("", "Sideboard");
      for (const c of d.side) {
        const sf = scryfall[c.name] || {};
        const setCn = sf.set && sf.cn ? ` (${sf.set}) ${sf.cn}` : "";
        lines.push(`${c.qty} ${c.name}${setCn}`);
      }
    }
    return lines.join("\n");
  }

  function copyDeckToMtga(d, idx) {
    const text = deckToMtgaText(d);
    const status = $("#deck-card-status-" + idx);
    navigator.clipboard.writeText(text).then(() => {
      if (status) { status.textContent = "copied. paste into MTGA import."; setTimeout(() => status.textContent = "", 4000); }
    }).catch(() => {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); if (status) status.textContent = "copied (fallback)."; }
      catch { if (status) status.textContent = "copy failed."; }
      finally { document.body.removeChild(ta); }
    });
  }

  function loadDeckIntoSelection(d) {
    const cardCount = (d.main || []).length + (d.side || []).length;
    const player = d.deck_title || "this list";
    if (!confirm(`Replace your current selection with ${player}'s ${cardCount}-card list?\n\nYour current selection will be lost.`)) return;
    const names = new Set();
    for (const c of d.main || []) names.add(c.name);
    selection = [...names];
    writeSelectionToHash();
    listsOpen = false;
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ── MTGA export ──
  // No copy-cycling UI per design. Default each selected card to 4 copies.
  function exportToMtga() {
    const lines = ["Deck"];
    for (const n of selection) {
      const sf = scryfall[n] || {};
      const setCn = sf.set && sf.cn ? ` (${sf.set}) ${sf.cn}` : "";
      lines.push(`4 ${n}${setCn}`);
    }
    const text = lines.join("\n");
    const status = $("#sel-status");
    navigator.clipboard.writeText(text).then(() => {
      if (status) { status.textContent = "copied, paste into MTGA import"; setTimeout(() => status.textContent = "", 4000); }
    }).catch(() => {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); status.textContent = "copied (fallback)"; }
      catch { status.textContent = "copy failed"; }
      finally { document.body.removeChild(ta); }
    });
  }

  // ── Data loading ──
  async function loadJson(name) {
    const r = await fetch(`${DATA_DIR}/${name}.json`);
    if (!r.ok) throw new Error(`failed to load ${name}.json`);
    return r.json();
  }

  async function loadInitial() {
    [meta, explore, scryfall] = await Promise.all([
      loadJson("meta"), loadJson("explore"), loadJson("scryfall"),
    ]);
  }

  async function loadFull() {
    [cards, pairs] = await Promise.all([loadJson("cards"), loadJson("pairs")]);
    cardsByName = Object.fromEntries(cards.map((c) => [c.name, c]));
    allNames = Array.from(new Set([...Object.keys(scryfall), ...Object.keys(cardsByName)])).sort();
    dataReady = true;
    render(); // re-render now that we have full data
  }

  // ── Boot ──
  window.addEventListener("hashchange", () => {
    selection = parseHashList("sel");
    bans = parseHashList("ban");
    _adHocPairs = null;
    render();
    ensureDecksForBansIfNeeded();
  });

  loadInitial().then(() => {
    render();
    loadFull();
    if (bans.length) ensureDecksForBansIfNeeded();
  }).catch((err) => {
    $(".magic-page").innerHTML = `<div class="error">couldn't load the dataset. ${escapeHtml(String(err))}</div>`;
  });
})();
