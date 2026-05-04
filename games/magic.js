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

  // ── Selection (mirrored to URL hash #sel=a,b,c) ──
  let selection = parseSelectionFromHash();

  function parseSelectionFromHash() {
    const m = (location.hash || "").match(/^#sel=([^&]*)/);
    if (!m) return [];
    return m[1].split(",").filter(Boolean).map(decodeURIComponent);
  }
  function writeSelectionToHash() {
    const slugs = selection.map(encodeURIComponent).join(",");
    const newHash = slugs ? "#sel=" + slugs : "";
    if (newHash !== location.hash) {
      history.replaceState(null, "", location.pathname + newHash);
    }
  }
  function selectionAdd(name) {
    if (!name || selection.includes(name)) return;
    selection = [...selection, name];
    listsOpen = false;
    writeSelectionToHash();
    render();
  }
  function selectionRemove(name) {
    selection = selection.filter((n) => n !== name);
    if (!selection.length) listsOpen = false;
    writeSelectionToHash();
    render();
  }
  function selectionToggle(name) {
    if (selection.includes(name)) selectionRemove(name);
    else selectionAdd(name);
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
  function cardData(name) { return cardsByName && cardsByName[name]; }
  function tierTopMark(name) {
    const c = cardData(name);
    return c && (c.tier === "defines" || c.tier === "driving");
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

  function renderSelection() {
    if (!selection.length) return "";
    const cards = selection.map((n) => {
      const im = img(n);
      const inDataset = !!cardData(n);
      return `<button class="sel-card" data-name="${escapeAttr(n)}" title="${escapeAttr(n)} · click to remove">
        ${im ? `<img src="${im}" alt="">` : `<span class="sel-card-noimg">${escapeHtml(n)}</span>`}
        <span class="sel-card-x">×</span>
      </button>`;
    }).join("");
    return `
      <div class="sel-strip">
        <div class="sel-strip-cards">${cards}</div>
        <button class="sel-strip-export" id="sel-export">export</button>
        <div class="sel-strip-status" id="sel-status"></div>
      </div>
    `;
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
  function matchingDecks() {
    if (!decks || !selection.length) return [];
    return decks.filter((d) => {
      const names = new Set((d.main || []).map((c) => c.name));
      return selection.every((n) => names.has(n));
    });
  }

  function renderRecommendations() {
    if (!dataReady) return `<div class="loading">loading…</div>`;
    const recs = combinedRecommendations(selection);
    if (!recs.length) {
      return `<div class="rec-empty">No clean overlaps yet. Try removing a card or starting from one with more data.</div>`;
    }
    const spells = recs.filter((r) => !isLand(r.name));
    const lands = recs.filter((r) => isLand(r.name));

    const items = spells.map((r) => {
      const line = r.coverage > 0
        ? `${naturalFreq(r.avgPGivenSel)} decks with your team`
        : `same color space`;
      return { name: r.name, line };
    });

    const landItems = lands.slice(0, 12).map((r) => {
      const im = img(r.name);
      return `<button class="manabase-card" data-name="${escapeAttr(r.name)}" title="${escapeAttr(r.name)}">
        ${im ? `<img class="manabase-thumb" src="${im}" alt="">` : `<div class="manabase-thumb"></div>`}
        <span class="manabase-name">${escapeHtml(r.name)}</span>
      </button>`;
    }).join("");

    const subtitle = selection.length === 1
      ? `cards that go with ${escapeHtml(selection[0])}`
      : `cards that go with all ${selection.length} of your team`;

    return `
      <div class="stacked">
        ${section("What fits", subtitle, renderGrid(items))}
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

  function renderListsBody() {
    const ms = matchingDecks();
    if (!ms.length) {
      return `<div class="rec-empty">no winning lists contain all of these cards together</div>`;
    }
    // Sort by weight (PT Top 8 first) then by event date (newest first)
    ms.sort((a, b) => (b.weight || 1) - (a.weight || 1) || (b.week || "").localeCompare(a.week || ""));
    return `<div class="lists-body">${ms.map(renderDeck).join("")}</div>`;
  }

  function tierLabelForWeight(w) {
    if (w >= 10) return "PT Top 8";
    if (w >= 5) return "Pro Tour";
    if (w >= 3) return "Premier event";
    return "Ladder";
  }

  function renderDeck(d) {
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
          <div class="deck-card-title">${escapeHtml(title)}</div>
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

  function renderThumb({ name, line }) {
    const im = img(name);
    const inSel = selection.includes(name);
    const isTop = tierTopMark(name);
    return `<button class="thumb${inSel ? " in-sel" : ""}${isTop ? " top" : ""}" data-name="${escapeAttr(name)}" title="${escapeAttr(name)}">
      ${im ? `<img class="thumb-img" src="${im}" alt="" loading="lazy">` : `<div class="thumb-img thumb-noimg">${escapeHtml(name)}</div>`}
      ${isTop ? `<span class="thumb-dot"></span>` : ""}
      <div class="thumb-meta">
        <div class="thumb-name">${escapeHtml(name)}</div>
        ${line ? `<div class="thumb-line">${line}</div>` : ""}
      </div>
      ${tooltipHtml(name)}
    </button>`;
  }

  function tooltipHtml(name) {
    const c = cardData(name);
    const sf = scryfall[name] || {};
    const inSel = selection.includes(name);
    let lines = [];
    if (c) {
      lines.push(`${naturalFreq(c.centerpiece_prevalence)} winning decks (3+ copies)`);
      const p = pairs && pairs[name];
      if (p && p.companions.length) {
        const top = p.companions.slice(0, 3).map((r) => r.name).join(", ");
        lines.push(`plays with: ${top}`);
      }
    } else if (sf.released_at) {
      const ageWeeks = (Date.now() - new Date(sf.released_at).getTime()) / (1000 * 60 * 60 * 24 * 7);
      if (ageWeeks < 8) lines.push(`new from ${sf.set || "latest set"}, ${fmtDate(sf.released_at)}`);
      else lines.push(`Standard-legal but not in winning lists`);
    }
    const action = inSel ? "click to remove" : "click to add";
    return `<div class="thumb-tip">
      <div class="thumb-tip-name">${escapeHtml(name)}</div>
      ${(sf.type_line || sf.mana_cost) ? `<div class="thumb-tip-type">${escapeHtml(sf.mana_cost || "")} ${escapeHtml(sf.type_line || "")}</div>` : ""}
      ${lines.map((l) => `<div class="thumb-tip-line">${l}</div>`).join("")}
      <div class="thumb-tip-action">${action}</div>
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
    // Grid thumbnails
    $$(".thumb").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        selectionToggle(el.dataset.name);
      });
    });
    // Selection strip (click removes)
    $$(".sel-card").forEach((el) => {
      el.addEventListener("click", () => selectionRemove(el.dataset.name));
    });
    // Manabase rows
    $$(".manabase-card").forEach((el) => {
      el.addEventListener("click", () => selectionToggle(el.dataset.name));
    });
    // Export
    const exp = $("#sel-export");
    if (exp) exp.addEventListener("click", exportToMtga);
    // View matching lists toggle
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
    selection = parseSelectionFromHash();
    render();
  });

  loadInitial().then(() => {
    render();
    loadFull();
  }).catch((err) => {
    $(".magic-page").innerHTML = `<div class="error">couldn't load the dataset. ${escapeHtml(String(err))}</div>`;
  });
})();
