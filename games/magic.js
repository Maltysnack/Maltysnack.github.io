/* magic.js
   Minimal explorer. One page, one grid, one interaction.
   Click any card to add to selection. Click in selection to remove.
   Hover for info. URL hash holds the selection so it's shareable.
*/

(function () {
  const DATA_DIR = "/games/data";

  // ── Data state (lazy-loaded) ──
  let meta = null, explore = null, scryfall = null;
  let cards = null, cardsByName = null;
  let allNames = null;
  let dataReady = false;
  let decks = null;       // raw decks, eager-loaded after initial render
  let listsOpen = false;
  // Synergy scores are computed ad-hoc from raw decks against the current
  // selection + bans, then cached. Cleared whenever selection or bans change.
  let _scoresMap = null;
  let _scoresKey = "";

  // ── Selection + Bans (mirrored to URL hash #sel=a,b&ban=x,y) ──
  let selection = parseHashList("sel");
  let bans = parseHashList("ban");
  let showLands = false;     // lands toggle near "what fits" header
  let searchQuery = "";      // live search input value, drives results strip
  let viewMode = "fits";     // "fits" (top-fit recs) or "off-meta" (lift inversion)
  let breakdownFor = null;   // which card has its score-breakdown popover open
  let inspectFor = null;     // which card has its inspect popover open
  let tagFilter = null;      // optional tag to filter recs to (e.g. "removal")
  let tagBoosts = new Set(); // tags currently boosted (multi-select)
  let tagInteractionMode = "boost"; // "boost" or "filter"

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
  function invalidateScores() { _scoresMap = null; _scoresKey = ""; }

  function selectionAdd(name) {
    if (!name || selection.includes(name)) return;
    bans = bans.filter((n) => n !== name);   // adding to selection unbans
    selection = [...selection, name];
    listsOpen = false;
    searchQuery = "";                         // clear the search so the user sees the new state
    inspectFor = null;
    invalidateScores();
    writeHash();
    render();
  }
  function selectionRemove(name) {
    selection = selection.filter((n) => n !== name);
    if (!selection.length) listsOpen = false;
    invalidateScores();
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
    invalidateScores();
    writeHash();
    render();
  }
  function banRemove(name) {
    bans = bans.filter((n) => n !== name);
    invalidateScores();
    writeHash();
    render();
  }
  function bansClear() {
    bans = [];
    invalidateScores();
    writeHash();
    render();
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

  // ── Synergy Score (computed ad-hoc from raw decks per selection state) ──
  //
  // Why ad-hoc rather than precomputed pairs?
  // - Multi-card selection works correctly: we look at decks containing all
  //   (or many) selected cards, not just the union of each card's top-N
  //   companions. That fixes the case where adding a third card was silently
  //   ignored because it wasn't in the other two's top-16.
  // - Bans filter the deck pool exactly.
  // - Cards below the analyze-time support floor still get a real signal if
  //   any decks have them alongside the selection.
  //
  // Coverage of partial-match decks via a quadratic weight: a deck with k of
  // n selected cards contributes (k/n)^2 to the co-occurrence count. So
  // exact-match decks dominate, partial matches contribute proportionally.
  //
  // Three signals combined per candidate:
  //   1. STRENGTH: (P(B | selection-weighted) - P(B in pool)) / (1 - P(B))
  //   2. ROBUSTNESS: sqrt(weighted_co / 200), capped at 1
  //   3. NOVELTY: 1 / (1 + 5 * P(B in pool))
  // Multiplied, then mapped to 0-99 via 99 * (1 - exp(-4.5 * raw)).
  const NOVELTY_K = 5;
  const ROBUSTNESS_REF = 200;
  const CURVE_K = 4.5;
  const SEMANTIC_CAP = 30;
  const COVERAGE_POWER = 2;      // partial-match weight = (k/n)^COVERAGE_POWER

  // ── Tag-aware deck-balance booster ──
  // Compute the selection's tag distribution. A candidate's "tag fit" is how
  // much it fills under-represented categories. Used as a small multiplier on
  // the score (max ~1.3x, min ~0.85x), so it nudges without overwhelming the
  // co-occurrence signal.
  function tagsFor(name) {
    const m = scryfall && scryfall[name];
    return (m && m.tags) || [];
  }
  function selectionTagProfile() {
    const counts = new Map();
    for (const n of selection) {
      for (const t of tagsFor(n)) counts.set(t, (counts.get(t) || 0) + 1);
    }
    return counts;
  }
  // The "shape" tags we balance against. When selection lacks one of these,
  // candidates with that tag get a substantial boost so the deck shape
  // actually nudges toward balance. The multiplier range is wide enough
  // (0.6x to 1.8x) to genuinely shift recommendations when the selection
  // is lopsided.
  const BALANCE_TAGS = ["removal", "card-draw", "ramp", "counterspell", "sweeper", "creature", "finisher"];
  function tagBalanceMultiplier(name, profile) {
    if (selection.length < 2) return 1;  // single-card selections don't have a "shape"
    const cTags = new Set(tagsFor(name));
    if (cTags.size === 0) return 1;
    let bonus = 0, malus = 0;
    const selN = selection.length;
    for (const t of BALANCE_TAGS) {
      if (!cTags.has(t)) continue;
      const have = profile.get(t) || 0;
      const fraction = have / selN;
      // 0 of this category in selection: big boost (this card fills a real gap)
      if (fraction === 0) bonus += 0.30;
      // <20%: moderate boost
      else if (fraction < 0.20) bonus += 0.15;
      // 20-40%: neutral, no change
      // 40-60%: getting saturated, mild malus
      else if (fraction >= 0.4 && fraction < 0.6) malus += 0.10;
      // >60%: very saturated, larger malus (don't pile on)
      else if (fraction >= 0.6) malus += 0.25;
    }
    const mult = 1 + bonus - malus;
    return Math.max(0.6, Math.min(1.8, mult));
  }

  // Compute the score map for the current selection + bans. Caches by key.
  // Returns Map(name -> { score, breakdown }).
  function computeScoreMap() {
    if (!decks) return null;
    const key = JSON.stringify({ s: selection, b: bans, m: viewMode, t: [...tagBoosts] });
    if (_scoresKey === key && _scoresMap) return _scoresMap;
    _scoresKey = key;

    const cutoff = (meta && meta.pair_window_first_week) || "";
    const banSet = new Set(bans);
    const selSet = new Set(selection);

    // Pool: recent decks that don't contain any banned card
    const pool = [];
    for (const d of decks) {
      if (cutoff && (d.week || "") < cutoff) continue;
      const main = d.main || [];
      let hasBan = false;
      for (const c of main) {
        if (banSet.has(c.name)) { hasBan = true; break; }
      }
      if (hasBan) continue;
      pool.push(d);
    }

    // Baseline: weighted prevalence of each card in the (recent, ban-free) pool
    const totalW = pool.reduce((s, d) => s + (d.weight || 1), 0);
    const baseline = new Map();
    for (const d of pool) {
      const w = d.weight || 1;
      for (const c of d.main || []) {
        baseline.set(c.name, (baseline.get(c.name) || 0) + w);
      }
    }

    const scores = new Map();
    if (selection.length === 0) { _scoresMap = scores; return scores; }

    // Selection-weighted co-occurrence: each deck contributes
    // (matchedSelectionCards / |selection|)^COVERAGE_POWER × deckWeight
    // to any candidate it contains. So decks that share more of the selection
    // pull harder; decks sharing none contribute nothing.
    const candidateCo = new Map();
    let totalSelW = 0;  // total weighted "selection presence" across pool
    const n = selection.length;

    for (const d of pool) {
      const main = d.main || [];
      const names = new Set(main.map((c) => c.name));
      let matched = 0;
      for (const s of selection) if (names.has(s)) matched++;
      if (matched === 0) continue;
      const selFrac = matched / n;
      const matchWeight = (d.weight || 1) * Math.pow(selFrac, COVERAGE_POWER);
      totalSelW += matchWeight;
      for (const c of main) {
        if (selSet.has(c.name)) continue;     // don't recommend the selection itself
        candidateCo.set(c.name, (candidateCo.get(c.name) || 0) + matchWeight);
      }
    }

    if (totalSelW === 0) { _scoresMap = scores; return scores; }

    const profile = selectionTagProfile();

    for (const [name, coW] of candidateCo) {
      if (banSet.has(name)) continue;
      if (!isLegal(name)) continue;
      const baseW = baseline.get(name) || 0;
      if (baseW === 0) continue;
      const pBase = baseW / totalW;
      if (pBase >= 1) continue;
      const pCondSel = coW / totalSelW;
      const strength = (pCondSel - pBase) / (1 - pBase);

      let raw, label;
      if (viewMode === "off-meta") {
        // Off-meta: rank by middle-prevalence pairs that are below the obvious
        // staples but above the noise floor. Boosts cards in 5-25% of the
        // selection's decks, demotes both the always-included and the rare.
        // pCondSel ∈ [0.05, 0.25] = sweet spot. Outside that range, dampen.
        let mid = 0;
        if (pCondSel >= 0.04 && pCondSel <= 0.30) {
          mid = 1 - Math.abs(pCondSel - 0.15) / 0.15;  // peak at 15%
        }
        const robustness = Math.min(Math.sqrt(coW / 60), 1);  // lower ref since we're in mid-band
        const novelty = 1 / (1 + (NOVELTY_K * 0.6) * pBase);  // softer novelty (mid-pop OK)
        raw = mid * robustness * novelty;
        label = "off-meta";
      } else {
        // Default "what fits" mode
        if (strength <= 0) continue;
        const robustness = Math.min(Math.sqrt(coW / ROBUSTNESS_REF), 1);
        const novelty = 1 / (1 + NOVELTY_K * pBase);
        raw = strength * robustness * novelty;
        label = "fits";
      }

      const tagMult = tagBalanceMultiplier(name, profile);
      raw *= tagMult;

      // User-driven tag boost: cards with any boosted tag get a bump
      if (tagBoosts.size) {
        const cTags = new Set(tagsFor(name));
        let matches = 0;
        for (const t of tagBoosts) if (cTags.has(t)) matches++;
        if (matches > 0) {
          raw *= (1 + 0.5 * matches);  // each matching boosted tag = +50%
        } else {
          raw *= 0.85;                  // others slightly demoted (not removed)
        }
      }

      const score = Math.round(Math.min(99, Math.max(0, 99 * (1 - Math.exp(-CURVE_K * raw)))));
      if (score > 0) {
        scores.set(name, {
          score,
          mode: label,
          breakdown: {
            strength: Math.round(strength * 100) / 100,
            pCondSel: Math.round(pCondSel * 100) / 100,
            pBase: Math.round(pBase * 1000) / 1000,
            coW: Math.round(coW),
            tagMult: Math.round(tagMult * 100) / 100,
          },
        });
      }
    }

    _scoresMap = scores;
    return scores;
  }

  // Sync lookup. If decks aren't loaded yet, returns null (renders skip the score).
  // Returns just the number; breakdown is fetched via synergyEntry().
  function synergyScore(name, sel) {
    const entry = synergyEntry(name, sel);
    return entry ? entry.score : null;
  }
  function synergyEntry(name, sel) {
    if (!isLegal(name)) return null;
    if (selection.includes(name)) return null;
    if (bans.includes(name)) return null;
    if (!decks) return null;
    const map = computeScoreMap();
    if (!map) return null;
    const direct = map.get(name);
    if (direct !== undefined) return direct;
    // No deck in the pool contains this candidate alongside any selection
    // card. Fall back to semantic similarity (returns just a number, not an entry).
    const semScore = semanticScore(name, sel || selection);
    if (semScore == null) return null;
    return { score: semScore, mode: "semantic", breakdown: null };
  }

  // Semantic fallback: tag overlap + color identity + type match.
  // Used when a candidate has no direct co-occurrence with the selection in
  // winning lists. With tagger tags this is now meaningfully informative:
  // Doppelgang ('tokens', 'x-spell', 'sorcery') matches against other tokens
  // / x-spell / sorcery cards even with zero pair data. Capped low so any
  // empirical signal still beats it.
  const STRUCTURAL_TAGS = new Set([
    "removal", "card-draw", "ramp", "counterspell", "sweeper", "tutor", "recursion",
    "tokens", "counters-plus", "lifegain", "drain", "discard", "finisher",
    "graveyard-matters", "spells-matter", "noncreature-matters",
    "treasure", "artifact-matters", "creature-buff", "x-spell", "scry",
  ]);
  function semanticScore(name, sel) {
    const sf = scryfall && scryfall[name];
    if (!sf) return null;
    const myColors = new Set(sf.colors || []);
    const myType = (sf.type_line || "").split(" ")[0];
    const myTags = new Set((sf.tags || []).filter(t => STRUCTURAL_TAGS.has(t)));

    // Selection profile
    const selColors = new Set();
    const selTypes = new Set();
    const selTagCounts = new Map();
    let n = 0;
    for (const s of sel) {
      const ssf = scryfall[s];
      if (!ssf) continue;
      n++;
      for (const c of ssf.colors || []) selColors.add(c);
      const t = (ssf.type_line || "").split(" ")[0];
      if (t) selTypes.add(t);
      for (const tg of ssf.tags || []) {
        if (STRUCTURAL_TAGS.has(tg)) selTagCounts.set(tg, (selTagCounts.get(tg) || 0) + 1);
      }
    }
    if (n === 0) return null;

    // Color overlap (0-1)
    let colorScore = 0;
    if (myColors.size === 0) colorScore = 0.4;  // colorless: neutral
    else {
      const shared = [...myColors].filter((c) => selColors.has(c)).length;
      colorScore = selColors.size ? shared / Math.max(myColors.size, selColors.size) : 0.5;
    }
    // Type overlap (0-1)
    const typeScore = selTypes.has(myType) ? 1 : 0.3;
    // Tag overlap (0-1+): for each shared structural tag, how present in selection
    let tagScore = 0;
    for (const t of myTags) {
      if (selTagCounts.has(t)) tagScore += Math.min(selTagCounts.get(t) / Math.max(n, 1), 1);
    }
    // Cap tag score so a card with many tag matches doesn't blow up
    tagScore = Math.min(tagScore, 1.5);

    // Composite: tags weighted highest because they're the most semantic
    const composite = (tagScore * 0.55) + (colorScore * 0.30) + (typeScore * 0.15);
    const score = Math.round(composite * SEMANTIC_CAP);
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

  // ── Render ──
  function render() {
    const root = $(".magic-page");
    if (!root) return;
    root.innerHTML = `
      ${renderSelection()}
      ${renderMatchingListsTag()}
      ${renderSearch()}
      ${renderSearchResultsSection()}
      ${selection.length ? renderRecommendations() : renderLanding()}
      <footer class="dataset-stamp" id="dataset-stamp"></footer>
    `;
    fillDatasetStamp();
    wireSearch();
    wireCardClicks();
  }

  // Indicator that sits between selection and search, "outside" the selection
  // box but visually anchored to it. Shown only when selection has cards.
  function renderMatchingListsTag() {
    if (!selection.length) return "";
    if (!decks) {
      return `<div class="match-tag-row"><button class="match-tag" id="match-tag-btn">find matching pro lists ↓</button></div>`;
    }
    const n = matchingDecks().length;
    if (n === 0) {
      return `<div class="match-tag-row"><span class="match-tag match-tag-empty">no winning lists contain all of these together</span></div>`;
    }
    return `<div class="match-tag-row"><button class="match-tag" id="match-tag-btn">${n} matching pro list${n === 1 ? "" : "s"} ↓</button></div>`;
  }

  function renderSearchResultsSection() {
    if (!searchQuery.trim() || !dataReady) return "";
    const hits = searchMatches(searchQuery);
    if (!hits.length) {
      return `<section class="sec"><header class="sec-header"><h2 class="sec-title">Search</h2><span class="sec-sub">no matches</span></header></section>`;
    }
    const items = hits.map((n) => {
      const score = synergyScore(n, selection);
      return { name: n, score };
    });
    return `
      <section class="sec sec-search">
        <header class="sec-header">
          <h2 class="sec-title">Search</h2>
          <span class="sec-sub">${hits.length} match${hits.length === 1 ? "" : "es"}</span>
        </header>
        ${renderGrid(items)}
      </section>
    `;
  }

  function renderSearch() {
    return `
      <div class="search-shell">
        <input class="search-input" type="text" placeholder="search…  try t:creature  c:ur  cmc<=3" autocomplete="off" spellcheck="false" value="${escapeAttr(searchQuery)}">
      </div>
    `;
  }

  // Two-mode chip: top-half hover reveals one action, bottom-half another.
  // Visually distinct icons + colors make them unambiguous.
  function chipHtml(n, kind) {
    const im = img(n);
    return `<div class="chip chip-${kind}" data-name="${escapeAttr(n)}">
      <div class="chip-card">
        ${im ? `<img src="${im}" alt="">` : `<span class="chip-noimg">${escapeHtml(n)}</span>`}
      </div>
      ${kind === "sel" ? `
        <button class="chip-half chip-half-top" data-action="remove" title="remove from selection">
          <span class="chip-icon">remove</span>
        </button>
        <button class="chip-half chip-half-bottom" data-action="ban" title="ban this card from all calculations">
          <span class="chip-icon">ban</span>
        </button>
      ` : `
        <button class="chip-half chip-half-top" data-action="unban" title="remove ban">
          <span class="chip-icon">unban</span>
        </button>
        <button class="chip-half chip-half-bottom" data-action="promote" title="move to selection">
          <span class="chip-icon">use</span>
        </button>
      `}
    </div>`;
  }

  function renderSelection() {
    if (!selection.length && !bans.length) return "";

    let html = "";

    if (selection.length) {
      html += `
        <div class="sel-strip">
          <div class="sel-strip-label">Selection</div>
          <div class="sel-strip-cards">${selection.map((n) => chipHtml(n, "sel")).join("")}</div>
          <div class="sel-strip-actions">
            <button class="sel-strip-export" id="sel-export" title="copy as 4-of for MTGA import">export</button>
            <button class="sel-strip-clear" id="sel-clear" title="clear selection">clear</button>
          </div>
          <div class="sel-strip-status" id="sel-status"></div>
        </div>
      `;
    }

    if (bans.length) {
      html += `
        <div class="sel-strip ban-strip">
          <div class="sel-strip-label">Banned</div>
          <div class="sel-strip-cards">${bans.map((n) => chipHtml(n, "ban")).join("")}</div>
          <div class="sel-strip-actions">
            <button class="sel-strip-clear" id="ban-clear" title="clear bans">clear</button>
          </div>
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

  function renderRecommendations() {
    if (!dataReady) return `<div class="loading">loading…</div>`;
    if (!decks) return `<div class="loading">loading the deck pool…</div>`;

    // The score map is the candidate set: every card that has any
    // selection-weighted co-occurrence in the recent, ban-filtered pool.
    const scoreMap = computeScoreMap();
    const scored = [];
    for (const [name, entry] of scoreMap) {
      // Tag filter: only show cards with the selected structural tag
      if (tagFilter) {
        const t = scryfall[name] && scryfall[name].tags;
        if (!t || !t.includes(tagFilter)) continue;
      }
      scored.push({ name, score: entry.score });
    }
    scored.sort((a, b) => b.score - a.score);

    const spells = scored.filter((r) => !isLand(r.name)).slice(0, 48);
    const lands = scored.filter((r) => isLand(r.name)).slice(0, 24);
    const items = showLands ? lands : spells;

    const subtitle = viewMode === "off-meta"
      ? (selection.length === 1
          ? `mid-frequency partners of ${escapeHtml(selection[0])} (less obvious picks)`
          : `mid-frequency partners across your ${selection.length} cards`)
      : (selection.length === 1
          ? `cards that travel with ${escapeHtml(selection[0])}`
          : `cards that travel with all ${selection.length} of your selection`);
    const title = viewMode === "off-meta" ? "Off the beaten path" : "Travels with";

    return `
      ${renderShapeWidget()}
      <div class="stacked">
        ${sectionWithToggle(title, subtitle, renderGrid(items))}
        ${renderListsSection()}
      </div>
    `;
  }

  // Shape widget: tag distribution as chips that boost (default) or filter
  // recommendations. Color-aware: counterspells are only shown if the
  // selection includes blue, ramp only if green is present, etc. Categories
  // that don't apply to the current colors stay hidden so the widget isn't
  // cluttered with irrelevant chips.
  const SHAPE_TAG_COLOR_AFFINITY = {
    "creature": null,        // null = always show
    "removal": null,
    "card-draw": ["U", "B", "R"],
    "ramp": ["G", "W"],
    "counterspell": ["U"],
    "sweeper": ["W", "B", "R"],
    "tokens": null,
    "finisher": null,
    "tutor": ["B", "G", "W"],
    "lifegain": ["W", "B"],
    "graveyard-matters": ["B", "U", "G"],
    "spells-matter": ["U", "R"],
    "counters-plus": ["G", "W"],
  };

  // Archetype hint: best-effort label based on color identity + tag distribution.
  // Returns null if confidence is low. The hint is suggestive, not authoritative.
  function archetypeHint() {
    if (selection.length < 2) return null;
    const profile = selectionTagProfile();
    const colors = new Set();
    for (const n of selection) {
      const sf = scryfall[n];
      if (sf && sf.colors) for (const c of sf.colors) colors.add(c);
    }
    const colorString = [...colors].sort().join("");
    const colorName = {
      "W": "Mono-White", "U": "Mono-Blue", "B": "Mono-Black", "R": "Mono-Red", "G": "Mono-Green",
      "WU": "Azorius", "UB": "Dimir", "BR": "Rakdos", "RG": "Gruul", "GW": "Selesnya",
      "WB": "Orzhov", "UR": "Izzet", "BG": "Golgari", "RW": "Boros", "GU": "Simic",
      "WUB": "Esper", "UBR": "Grixis", "BRG": "Jund", "RGW": "Naya", "GWU": "Bant",
      "WBG": "Abzan", "URW": "Jeskai", "BGU": "Sultai", "RWB": "Mardu", "GUR": "Temur",
      "WUBR": "Yore-Tiller", "UBRG": "Glint-Eye", "BRGW": "Dune-Brood", "RGWU": "Ink-Treader", "GWUB": "Witch-Maw",
    }[colorString];
    if (!colorName) return null;

    const total = selection.length;
    const has = (t) => (profile.get(t) || 0) / total;
    let archetype = null;
    if (has("kw-landfall") >= 0.3) archetype = "Landfall";
    else if (has("counterspell") + has("card-draw") >= 0.5) archetype = "Control";
    else if (has("creature") >= 0.6 && has("ramp") >= 0.2) archetype = "Ramp";
    else if (has("creature") >= 0.6 && has("counters-plus") >= 0.2) archetype = "Counters";
    else if (has("removal") + has("counterspell") >= 0.4 && has("creature") < 0.4) archetype = "Tempo";
    else if (has("creature") >= 0.7) archetype = "Aggro";
    else if (has("spells-matter") >= 0.2) archetype = "Spells";
    else if (has("tokens") >= 0.3) archetype = "Tokens";
    else if (has("graveyard-matters") >= 0.3) archetype = "Graveyard";

    if (!archetype) return colorName;
    return `${colorName} ${archetype}`;
  }

  function renderShapeWidget() {
    if (selection.length < 1) return "";
    const profile = selectionTagProfile();
    const total = selection.length;
    // What colors does the selection identify with?
    const selColors = new Set();
    for (const n of selection) {
      const sf = scryfall[n];
      if (sf && sf.colors) for (const c of sf.colors) selColors.add(c);
    }
    // Pick the tags relevant for this selection's color identity, plus any
    // tag the selection actually contains (so it shows even if "off-color").
    const relevant = [];
    for (const [tag, affinity] of Object.entries(SHAPE_TAG_COLOR_AFFINITY)) {
      const has = profile.get(tag) || 0;
      if (has > 0) { relevant.push(tag); continue; }
      if (affinity === null) { relevant.push(tag); continue; }
      // Only show if at least one of the affinity colors is in the selection
      if (affinity.some(c => selColors.has(c))) relevant.push(tag);
    }
    const chips = relevant.map((t) => {
      const count = profile.get(t) || 0;
      const fraction = count / total;
      const isLow = fraction === 0;
      const isFull = fraction >= 0.4;
      const active = (tagInteractionMode === "filter" && tagFilter === t) ||
                     (tagInteractionMode === "boost" && tagBoosts.has(t));
      const cls = "shape-chip" + (active ? " active" : "") + (isLow ? " shape-low" : "") + (isFull ? " shape-full" : "");
      return `<button class="${cls}" data-shape-tag="${escapeAttr(t)}" title="${count} of ${total} selected cards">
        <span class="shape-chip-name">${escapeHtml(t)}</span>
        <span class="shape-chip-count">${count}</span>
      </button>`;
    }).join("");
    const modeBtn = `<button class="shape-mode" id="shape-mode-toggle" title="${tagInteractionMode === "filter" ? "filter mode: only show tagged cards" : "boost mode: rank tagged cards higher but still show others"}">
      ${tagInteractionMode === "filter" ? "filter" : "boost"}
    </button>`;
    let hint = "";
    if (tagInteractionMode === "filter" && tagFilter) {
      hint = `<span class="shape-filter-hint">filtering: ${escapeHtml(tagFilter)} <button class="shape-clear" id="shape-clear">×</button></span>`;
    } else if (tagInteractionMode === "boost" && tagBoosts.size) {
      hint = `<span class="shape-filter-hint">boosting: ${escapeHtml([...tagBoosts].join(", "))} <button class="shape-clear" id="shape-clear">×</button></span>`;
    }
    const arch = archetypeHint();
    const archHtml = arch ? `<span class="shape-arch">looks like <strong>${escapeHtml(arch)}</strong></span>` : "";
    return `
      <div class="shape-widget">
        <div class="shape-label">Selection shape ${modeBtn} ${hint} ${archHtml}</div>
        <div class="shape-chips">${chips}</div>
      </div>
    `;
  }

  // "What fits" / "Off-meta" section with right-aligned toggles in the header.
  function sectionWithToggle(title, sub, body) {
    return `
      <section class="sec sec-rec">
        <header class="sec-header">
          <h2 class="sec-title">${escapeHtml(title)}</h2>
          <span class="sec-sub">${escapeHtml(sub)}</span>
          <div class="rec-toggles">
            <button class="rec-toggle ${viewMode === "fits" ? "active" : ""}" id="mode-fits" title="rank by what fits the selection most tightly">what fits</button>
            <button class="rec-toggle ${viewMode === "off-meta" ? "active" : ""}" id="mode-offmeta" title="rank by mid-prevalence partners that aren't obvious staples">off-meta</button>
            <button class="lands-toggle" id="lands-toggle" title="toggle between spells and lands">
              ${showLands ? "lands" : "spells"}
            </button>
          </div>
        </header>
        ${body}
      </section>
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

  // Primary card type for grouping. Order matters: this is the display order.
  const TYPE_GROUPS = [
    { key: "creature",     label: "Creatures",     match: t => t.includes("Creature") },
    { key: "planeswalker", label: "Planeswalkers", match: t => t.includes("Planeswalker") },
    { key: "instant",      label: "Instants",      match: t => t.includes("Instant") },
    { key: "sorcery",      label: "Sorceries",     match: t => t.includes("Sorcery") },
    { key: "enchantment",  label: "Enchantments",  match: t => t.includes("Enchantment") },
    { key: "artifact",     label: "Artifacts",     match: t => t.includes("Artifact") },
    { key: "battle",       label: "Battles",       match: t => t.includes("Battle") },
    { key: "land",         label: "Lands",         match: t => t.includes("Land") },
  ];
  function primaryGroupKey(name) {
    const sf = scryfall[name] || {};
    const type = sf.type_line || "";
    for (const g of TYPE_GROUPS) if (g.match(type)) return g.key;
    return "other";
  }

  function groupAndSortCards(cards) {
    // cards: [{qty, name}, ...]
    const byKey = new Map();
    for (const c of cards) {
      const k = primaryGroupKey(c.name);
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(c);
    }
    // Sort each group: mana value ascending, then name
    for (const arr of byKey.values()) {
      arr.sort((a, b) => {
        const ca = (scryfall[a.name] && scryfall[a.name].cmc) || 0;
        const cb = (scryfall[b.name] && scryfall[b.name].cmc) || 0;
        if (ca !== cb) return ca - cb;
        return a.name.localeCompare(b.name);
      });
    }
    return byKey;
  }

  function renderDeckHalf(cards) {
    if (!cards || !cards.length) return "";
    const byKey = groupAndSortCards(cards);
    const renderLine = (c) => {
      const inSel = selection.includes(c.name);
      return `<li class="${inSel ? "deck-line-hit" : ""}"><span class="deck-line-q">${c.qty}</span><button class="deck-line-name" data-name="${escapeAttr(c.name)}">${escapeHtml(c.name)}</button></li>`;
    };
    const sections = [];
    for (const g of TYPE_GROUPS) {
      const arr = byKey.get(g.key);
      if (!arr || !arr.length) continue;
      const total = arr.reduce((s, c) => s + (c.qty || 0), 0);
      sections.push(`<div class="deck-type-group">
        <div class="deck-type-label">${g.label} <span class="deck-type-count">${total}</span></div>
        <ul class="deck-card-list">${arr.map(renderLine).join("")}</ul>
      </div>`);
    }
    // Cards we couldn't classify (no scryfall data) go in "Other"
    const other = byKey.get("other") || [];
    if (other.length) {
      const total = other.reduce((s, c) => s + (c.qty || 0), 0);
      sections.push(`<div class="deck-type-group">
        <div class="deck-type-label">Other <span class="deck-type-count">${total}</span></div>
        <ul class="deck-card-list">${other.map(renderLine).join("")}</ul>
      </div>`);
    }
    return sections.join("");
  }

  function renderDeck(d, idx) {
    const title = d.deck_title || "Unknown player";
    const sub = d.subtitle || "";
    const ev = d.event_name || "";
    const dt = d.event_date || (d.week ? fmtDate(d.week) : "");
    const tag = tierLabelForWeight(d.weight || 1);
    const link = d.source ? `<a class="deck-source" href="${escapeAttr(d.source)}" target="_blank" rel="noopener">source ↗</a>` : "";
    const mainTotal = (d.main || []).reduce((s, c) => s + (c.qty || 0), 0);
    const sideTotal = (d.side || []).reduce((s, c) => s + (c.qty || 0), 0);
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
            <div class="deck-card-col-label">Main <span class="deck-col-total">${mainTotal}</span></div>
            ${renderDeckHalf(d.main || [])}
          </div>
          ${sideTotal > 0 ? `<div class="deck-card-col">
            <div class="deck-card-col-label">Sideboard <span class="deck-col-total">${sideTotal}</span></div>
            ${renderDeckHalf(d.side || [])}
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
  // The wrapper is a <div role="button"> rather than <button>, because the score
  // badge needs to be a separate clickable element (links inside <button> get
  // auto-relocated by the HTML parser, which moves the score outside the thumb).
  function renderThumb(item) {
    const name = item.name;
    const im = img(name);
    const inSel = selection.includes(name);
    const score = typeof item.score === "number" ? item.score : null;
    const cls = score !== null ? scoreColorClass(score) : "";
    const showBreakdown = breakdownFor === name;
    const showInspect = inspectFor === name;
    return `<div class="thumb${inSel ? " in-sel" : ""}${showBreakdown ? " breakdown-open" : ""}${showInspect ? " inspect-open" : ""}" role="button" tabindex="0" data-name="${escapeAttr(name)}" title="${escapeAttr(name)}">
      ${im ? `<img class="thumb-img" src="${im}" alt="" loading="lazy">` : `<div class="thumb-img thumb-noimg">${escapeHtml(name)}</div>`}
      <button class="thumb-inspect" data-inspect="${escapeAttr(name)}" title="inspect card without adding" aria-label="inspect">i</button>
      ${score !== null ? `<span class="thumb-score ${cls}" data-score-link role="button" tabindex="0">${score}</span>` : ""}
      ${showBreakdown ? renderBreakdownPopover(name) : ""}
      ${showInspect ? renderInspectPopover(name) : ""}
    </div>`;
  }

  function renderInspectPopover(name) {
    const sf = scryfall[name] || {};
    const c = cardData(name);
    const tags = (sf.tags || []).filter(t => t !== "spell" && !t.startsWith("kw-"));
    const oracle = (sf.oracle_text || "").replace(/\n/g, "<br>");
    let stats = "";
    if (c) {
      const parts = [];
      if (c.recent_main_decks > 0) parts.push(`${c.recent_main_decks} winning decks (12wk)`);
      if (c.tier) parts.push(`tier: ${c.tier}`);
      if (parts.length) stats = `<div class="ip-stats">${parts.join(" · ")}</div>`;
    } else if (sf.legal_standard) {
      stats = `<div class="ip-stats">Standard-legal, no winning lists yet</div>`;
    } else if (sf.released_at) {
      stats = `<div class="ip-stats">not Standard-legal</div>`;
    }
    return `<div class="ip-popover" data-bd="1">
      <div class="ip-name">${escapeHtml(name)}</div>
      <div class="ip-type">${escapeHtml(sf.mana_cost || "")} ${escapeHtml(sf.type_line || "")}</div>
      ${tags.length ? `<div class="ip-tags">${tags.slice(0,8).map(t => `<span class="bd-tag">${escapeHtml(t)}</span>`).join("")}</div>` : ""}
      ${oracle ? `<div class="ip-oracle">${oracle}</div>` : ""}
      ${stats}
    </div>`;
  }

  function renderBreakdownPopover(name) {
    const entry = synergyEntry(name);
    if (!entry) return "";
    const sf = scryfall[name] || {};
    const tags = (sf.tags || []).filter((t) => t !== "spell" && t !== "creature" && !t.startsWith("kw-"));
    const tagsHtml = tags.length ? `<div class="bd-tags">${tags.slice(0, 6).map(t => `<span class="bd-tag">${escapeHtml(t)}</span>`).join("")}</div>` : "";

    if (!entry.breakdown) {
      return `<div class="bd-popover" data-bd="1">
        <div class="bd-row bd-name">${escapeHtml(name)}</div>
        <div class="bd-row bd-mode">${entry.mode === "semantic" ? "semantic match" : entry.mode}</div>
        ${tagsHtml}
        <div class="bd-row bd-note">No direct co-occurrence with your selection in winning lists. Score reflects color and type overlap.</div>
        <a class="bd-link" href="/games/synergy-score.html" data-bd-stop>read about synergy score →</a>
      </div>`;
    }

    const b = entry.breakdown;
    const pCondPct = Math.round(b.pCondSel * 100);
    const pBasePct = Math.round(b.pBase * 1000) / 10;
    const tagDelta = b.tagMult > 1.02 ? `+${Math.round((b.tagMult - 1) * 100)}% deck-balance bonus` :
                     b.tagMult < 0.98 ? `−${Math.round((1 - b.tagMult) * 100)}% deck-balance malus` : "";
    return `<div class="bd-popover" data-bd="1">
      <div class="bd-row bd-name">${escapeHtml(name)}</div>
      <div class="bd-row bd-mode">${entry.mode === "off-meta" ? "off-meta lens" : "what-fits lens"}</div>
      ${tagsHtml}
      <div class="bd-grid">
        <div class="bd-cell"><span class="bd-label">in selection's decks</span><span class="bd-val">${pCondPct}%</span></div>
        <div class="bd-cell"><span class="bd-label">vs pool baseline</span><span class="bd-val">${pBasePct}%</span></div>
        <div class="bd-cell"><span class="bd-label">co-occurrence weight</span><span class="bd-val">${b.coW}</span></div>
        ${tagDelta ? `<div class="bd-cell"><span class="bd-label">deck balance</span><span class="bd-val">${tagDelta}</span></div>` : ""}
      </div>
      <a class="bd-link" href="/games/synergy-score.html" data-bd-stop>read about synergy score →</a>
    </div>`;
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
    if (!input) return;
    // Restore focus + caret position after re-render so typing flows
    if (searchQuery) {
      input.focus();
      const len = input.value.length;
      input.setSelectionRange(len, len);
    }
    let pending = null;
    input.addEventListener("input", () => {
      searchQuery = input.value;
      // Debounce so we don't re-render on every keystroke
      clearTimeout(pending);
      pending = setTimeout(() => render(), 80);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        searchQuery = "";
        input.value = "";
        render();
      } else if (e.key === "Enter") {
        // Add the top match to selection
        e.preventDefault();
        const hits = searchMatches(searchQuery);
        if (hits.length) {
          searchQuery = "";
          selectionAdd(hits[0]);
        }
      }
    });
  }

  function wireCardClicks() {
    // Grid thumbnails: click on art toggles selection; click on score opens an
    // inline breakdown popover. Click the score badge again to close, or
    // click outside the popover.
    $$(".thumb").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (e.target.closest("[data-bd-stop]")) return;          // let the read-more anchor work
        if (e.target.closest("[data-bd]")) return;               // ignore clicks inside popover content
        if (e.target.closest("[data-score-link]")) {
          breakdownFor = breakdownFor === el.dataset.name ? null : el.dataset.name;
          render();
          return;
        }
        selectionToggle(el.dataset.name);
      });
      el.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        if (e.target.matches("[data-score-link]")) {
          breakdownFor = breakdownFor === el.dataset.name ? null : el.dataset.name;
          render();
        } else {
          selectionToggle(el.dataset.name);
        }
      });
    });
    // Click outside any open breakdown / inspect popover closes it
    if (breakdownFor || inspectFor) {
      const closeOnOutside = (e) => {
        if (!e.target.closest(".bd-popover") &&
            !e.target.closest(".ip-popover") &&
            !e.target.closest("[data-score-link]") &&
            !e.target.closest("[data-inspect]")) {
          breakdownFor = null;
          inspectFor = null;
          document.removeEventListener("click", closeOnOutside, true);
          render();
        }
      };
      setTimeout(() => document.addEventListener("click", closeOnOutside, true), 0);
    }
    // Inspect buttons on each thumb. After opening, set data-pop-edge based
    // on the thumb's position so the popover stays in viewport.
    $$("[data-inspect]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const name = el.dataset.inspect;
        inspectFor = inspectFor === name ? null : name;
        breakdownFor = null;
        render();
        // After re-render, position the popover relative to viewport
        if (inspectFor === name) {
          requestAnimationFrame(() => {
            const thumb = document.querySelector(`.thumb[data-name="${CSS.escape(name)}"]`);
            if (!thumb) return;
            const rect = thumb.getBoundingClientRect();
            const vw = window.innerWidth;
            const popWidth = 280;
            // If centered popover would clip right edge → anchor right
            if (rect.left + rect.width / 2 + popWidth / 2 > vw - 12) {
              thumb.dataset.popEdge = "right";
            } else if (rect.left + rect.width / 2 - popWidth / 2 < 12) {
              thumb.dataset.popEdge = "left";
            } else {
              delete thumb.dataset.popEdge;
            }
          });
        }
      });
    });
    // Shape widget chips
    $$("[data-shape-tag]").forEach((el) => {
      el.addEventListener("click", () => {
        const t = el.dataset.shapeTag;
        if (tagInteractionMode === "filter") {
          tagFilter = (tagFilter === t) ? null : t;
        } else {
          if (tagBoosts.has(t)) tagBoosts.delete(t); else tagBoosts.add(t);
        }
        invalidateScores();
        render();
      });
    });
    const sclr = $("#shape-clear");
    if (sclr) sclr.addEventListener("click", (e) => {
      e.stopPropagation();
      tagFilter = null;
      tagBoosts.clear();
      invalidateScores();
      render();
    });
    const smode = $("#shape-mode-toggle");
    if (smode) smode.addEventListener("click", () => {
      tagInteractionMode = tagInteractionMode === "filter" ? "boost" : "filter";
      // Clear cross-mode state to avoid confusing combined behaviors
      tagFilter = null;
      tagBoosts.clear();
      invalidateScores();
      render();
    });
    // Selection / ban chip actions (top half = remove/unban, bottom half = ban/promote)
    $$(".chip-half").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const chip = el.closest(".chip");
        const name = chip && chip.dataset.name;
        if (!name) return;
        const action = el.dataset.action;
        if (action === "remove") selectionRemove(name);
        else if (action === "ban") banAdd(name);
        else if (action === "unban") banRemove(name);
        else if (action === "promote") { banRemove(name); selectionAdd(name); }
      });
    });
    // Manabase rows: just click to add (manabase doesn't show score badges)
    $$(".manabase-card").forEach((el) => {
      el.addEventListener("click", () => selectionToggle(el.dataset.name));
    });
    // Export
    const exp = $("#sel-export");
    if (exp) exp.addEventListener("click", exportToMtga);
    // Selection clear (no confirmation, per design)
    const clr = $("#sel-clear");
    if (clr) clr.addEventListener("click", () => {
      selection = [];
      invalidateScores();
      writeHash();
      render();
    });
    const banClr = $("#ban-clear");
    if (banClr) banClr.addEventListener("click", bansClear);
    // Matching-lists tag button (separate row outside selection)
    const tag = $("#match-tag-btn");
    if (tag) tag.addEventListener("click", async () => {
      if (!decks) {
        tag.textContent = "loading lists…";
        try { decks = await loadJson("decks_raw"); }
        catch { tag.textContent = "couldn't load lists"; return; }
      }
      listsOpen = true;
      render();
      const sec = $(".lists-sec");
      if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    // Lands toggle in "what fits" header
    const lt = $("#lands-toggle");
    if (lt) lt.addEventListener("click", () => {
      showLands = !showLands;
      render();
    });
    const mFits = $("#mode-fits");
    if (mFits) mFits.addEventListener("click", () => {
      if (viewMode !== "fits") { viewMode = "fits"; invalidateScores(); render(); }
    });
    const mOff = $("#mode-offmeta");
    if (mOff) mOff.addEventListener("click", () => {
      if (viewMode !== "off-meta") { viewMode = "off-meta"; invalidateScores(); render(); }
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
    // Eager-load cards.json AND decks_raw.json in parallel. Synergy scoring
    // computes from raw decks now (path B), so we want the raw data ready
    // before the user makes a selection. cards.json is still kept for
    // tier badges and recent_main_prevalence in the search results.
    const [c, d] = await Promise.all([loadJson("cards"), loadJson("decks_raw")]);
    cards = c;
    decks = d;
    cardsByName = Object.fromEntries(cards.map((c) => [c.name, c]));
    // Build the search index, deduping DFC name pairs. magic.gg's deck data
    // uses the front-face name ("Hearth Elemental") for most DFCs, but some
    // cards appear under the full "X // Y" form. Prefer whichever name the
    // deck data actually uses (the one in cardsByName), hide the other.
    const seenImage = new Map(); // image_url -> chosen name
    const candidates = new Set([
      ...Object.keys(scryfall).filter((n) => !n.startsWith("__")),
      ...Object.keys(cardsByName),
    ]);
    for (const n of candidates) {
      const m = scryfall[n];
      if (!m || typeof m !== "object") { seenImage.set(n, n); continue; }
      const key = m.image_small || m.image || n;
      const prior = seenImage.get(key);
      if (!prior) { seenImage.set(key, n); continue; }
      // Already have a name for this card. Pick the one that's in deck data.
      const priorInData = !!cardsByName[prior];
      const currentInData = !!cardsByName[n];
      if (currentInData && !priorInData) seenImage.set(key, n);
      else if (currentInData === priorInData) {
        // Both or neither in data: prefer the canonical (full) name when both
        // are valid Scryfall entries; otherwise keep whichever came first.
        const priorMeta = scryfall[prior];
        if (priorMeta && priorMeta.is_alias && !m.is_alias) seenImage.set(key, n);
      }
    }
    allNames = Array.from(new Set(seenImage.values())).sort();
    dataReady = true;
    render(); // re-render now that we have full data
  }

  // ── Boot ──
  window.addEventListener("hashchange", () => {
    selection = parseHashList("sel");
    bans = parseHashList("ban");
    invalidateScores();
    render();
  });

  loadInitial().then(() => {
    render();
    loadFull();
  }).catch((err) => {
    $(".magic-page").innerHTML = `<div class="error">couldn't load the dataset. ${escapeHtml(String(err))}</div>`;
  });
})();
