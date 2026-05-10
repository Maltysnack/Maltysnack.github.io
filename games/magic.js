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

  // Compute the score map for the current selection + bans. Caches by key.
  function computeScoreMap() {
    if (!decks) return null;
    const key = JSON.stringify({ s: selection, b: bans });
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

    for (const [name, coW] of candidateCo) {
      if (banSet.has(name)) continue;
      if (!isLegal(name)) continue;
      const baseW = baseline.get(name) || 0;
      if (baseW === 0) continue;
      const pBase = baseW / totalW;
      if (pBase >= 1) continue;
      const pCondSel = coW / totalSelW;
      const strength = (pCondSel - pBase) / (1 - pBase);
      if (strength <= 0) continue;
      const robustness = Math.min(Math.sqrt(coW / ROBUSTNESS_REF), 1);
      const novelty = 1 / (1 + NOVELTY_K * pBase);
      const raw = strength * robustness * novelty;
      const score = Math.round(Math.min(99, Math.max(0, 99 * (1 - Math.exp(-CURVE_K * raw)))));
      if (score > 0) scores.set(name, score);
    }

    _scoresMap = scores;
    return scores;
  }

  // Sync lookup. If decks aren't loaded yet, returns null (renders skip the score).
  function synergyScore(name, sel) {
    if (!isLegal(name)) return null;
    if (selection.includes(name)) return null;
    if (bans.includes(name)) return null;
    if (!decks) return null;
    const map = computeScoreMap();
    if (!map) return null;
    const direct = map.get(name);
    if (direct !== undefined) return direct;
    // No deck in the pool contains this candidate alongside any selection
    // card. Fall back to semantic similarity.
    return semanticScore(name, sel || selection);
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
    for (const [name, score] of scoreMap) {
      scored.push({ name, score });
    }
    scored.sort((a, b) => b.score - a.score);

    const spells = scored.filter((r) => !isLand(r.name)).slice(0, 48);
    const lands = scored.filter((r) => isLand(r.name)).slice(0, 24);
    const items = showLands ? lands : spells;

    const subtitle = selection.length === 1
      ? `cards that go with ${escapeHtml(selection[0])}`
      : `cards that go with all ${selection.length} of your team`;

    return `
      <div class="stacked">
        ${sectionWithToggle("What fits", subtitle, renderGrid(items))}
        ${renderListsSection()}
      </div>
    `;
  }

  // "What fits" section with a right-aligned lands toggle in the header.
  function sectionWithToggle(title, sub, body) {
    return `
      <section class="sec sec-rec">
        <header class="sec-header">
          <h2 class="sec-title">${escapeHtml(title)}</h2>
          <span class="sec-sub">${escapeHtml(sub)}</span>
          <button class="lands-toggle" id="lands-toggle" title="toggle between spell and land recommendations">
            ${showLands ? "showing lands · click for spells" : "showing spells · click for lands"}
          </button>
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
  // The wrapper is a <div role="button"> rather than <button>, because the score
  // badge needs to be a separate clickable element (links inside <button> get
  // auto-relocated by the HTML parser, which moves the score outside the thumb).
  function renderThumb(item) {
    const name = item.name;
    const im = img(name);
    const inSel = selection.includes(name);
    const score = typeof item.score === "number" ? item.score : null;
    const cls = score !== null ? scoreColorClass(score) : "";
    return `<div class="thumb${inSel ? " in-sel" : ""}" role="button" tabindex="0" data-name="${escapeAttr(name)}" title="${escapeAttr(name)}">
      ${im ? `<img class="thumb-img" src="${im}" alt="" loading="lazy">` : `<div class="thumb-img thumb-noimg">${escapeHtml(name)}</div>`}
      ${score !== null ? `<span class="thumb-score ${cls}" data-score-link role="link" tabindex="0">${score}</span>` : ""}
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
    // Grid thumbnails: click on art toggles selection, click on score navigates
    $$(".thumb").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (e.target.closest("[data-score-link]")) {
          window.location.href = "/games/synergy-score.html";
          return;
        }
        selectionToggle(el.dataset.name);
      });
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (e.target.matches("[data-score-link]")) window.location.href = "/games/synergy-score.html";
          else selectionToggle(el.dataset.name);
        }
      });
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
    // Manabase rows
    $$(".manabase-card").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (e.target.closest("[data-score-link]")) {
          window.location.href = "/games/synergy-score.html";
          return;
        }
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
