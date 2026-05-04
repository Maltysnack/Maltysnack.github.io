/* ═══════════════════════════════════════
   magic.js, meta explorer interactions.
   Routes: #card/<slug>, # (home).
   The deck IS the context. As you add cards, the relationships re-rank.
   Visual encoding: position > length > color (Cleveland-McGill, 1984).
   Numbers as natural frequencies (Gigerenzer): "1 in 4" not "25%".
═══════════════════════════════════════ */

(function () {
  const DATA_DIR = "/games/data";
  const LS_DECK = "magic.deck";

  // ── State ─────────────────────────────────────────────
  let cards = null;
  let cardsByName = null;
  let pairs = null;
  let scryfall = null;
  let allNames = null;
  let explore = null;
  let meta = null;
  let dataReady = false;
  let deck = loadJsonLs(LS_DECK, { main: {}, side: {} });
  let deckPanelClosed = false;

  // ── Utils ─────────────────────────────────────────────
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));

  function loadJsonLs(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  }
  function saveLs(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s ?? "";
    return d.innerHTML;
  }

  function fmtPct(v, d = 1) {
    if (!isFinite(v)) return "-";
    return (v * 100).toFixed(d) + "%";
  }
  function fmtPp(v) {
    const sign = v >= 0 ? "+" : "−";
    return sign + Math.abs(v * 100).toFixed(1) + "pp";
  }

  // dd-mm-yyyy per CLAUDE.md hard rule 5.
  function fmtDate(iso) {
    if (!iso || typeof iso !== "string") return "";
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
  }

  // Gigerenzer's natural frequencies. Probabilities -> "X in Y" form people grasp.
  function naturalFreq(p) {
    if (!isFinite(p) || p <= 0) return "rarely";
    if (p >= 0.9) return "almost always";
    if (p >= 0.66) return "2 in 3";
    if (p >= 0.45) return "1 in 2";
    if (p >= 0.30) return "1 in 3";
    if (p >= 0.20) return "1 in 4";
    if (p >= 0.15) return "1 in 5 to 6";
    if (p >= 0.10) return "1 in 8";
    if (p >= 0.05) return "1 in 15";
    if (p >= 0.02) return "1 in 30";
    return "rarely";
  }

  function img(name, kind = "small") {
    const m = scryfall && scryfall[name];
    if (!m) return "";
    return kind === "small" ? m.image_small : m.image;
  }

  function isLand(name) {
    const m = scryfall && scryfall[name];
    return !!(m && m.type_line && m.type_line.includes("Land"));
  }

  function slugify(name) {
    return encodeURIComponent(name.toLowerCase().replace(/\s+/g, "-").replace(/[^\w\-]/g, ""));
  }
  function normalizeName(s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  }
  function unslugify(slug) {
    if (!allNames) return null;
    const want = normalizeName(decodeURIComponent(slug));
    for (const n of allNames) if (normalizeName(n) === want) return n;
    return null;
  }

  const TIER_LABELS = {
    defines: "Defines the meta",
    driving: "Driving the meta",
    major: "Major staple",
    played: "Played",
    fringe: "Fringe",
    rare: "Rare",
  };
  function tierBadge(tier, opts = {}) {
    if (!tier) return "";
    const cls = "tier-badge tier-" + tier + (opts.large ? " tier-badge-lg" : "");
    return `<span class="${cls}">${TIER_LABELS[tier] || tier}</span>`;
  }

  // Damerau-Levenshtein for fuzzy search.
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
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        }
      }
    }
    return d[al][bl];
  }

  function isNewCard(name) {
    const m = scryfall && scryfall[name];
    if (!m || !m.released_at) return false;
    const released = new Date(m.released_at);
    const ageWeeks = (Date.now() - released.getTime()) / (1000 * 60 * 60 * 24 * 7);
    return ageWeeks < 8;
  }

  // ── Data loading ─────────────────────────
  async function loadJson(name) {
    const r = await fetch(`${DATA_DIR}/${name}.json`);
    if (!r.ok) throw new Error(`failed to load ${name}.json`);
    return r.json();
  }

  async function loadInitial() {
    [meta, explore, scryfall] = await Promise.all([
      loadJson("meta"), loadJson("explore"), loadJson("scryfall"),
    ]);
    renderDatasetStamp();
  }

  async function loadFull() {
    if (dataReady) return;
    [cards, pairs] = await Promise.all([loadJson("cards"), loadJson("pairs")]);
    cardsByName = Object.fromEntries(cards.map((c) => [c.name, c]));
    allNames = Array.from(new Set([
      ...Object.keys(scryfall),
      ...Object.keys(cardsByName),
    ])).sort();
    dataReady = true;
    setSearchStatus("");
    if (currentRoute().type !== "home") renderRoute();
  }

  // ── Dataset stamp ─────────────────────────
  function renderDatasetStamp() {
    const stamp = $(".dataset-stamp");
    if (!stamp || !meta) return;
    const wb = meta.n_decks_by_weight || {};
    const pieces = [];
    if (wb["10"]) pieces.push(`${wb["10"]} PT Top 8`);
    if (wb["5"]) pieces.push(`${wb["5"]} PT main`);
    if (wb["3"]) pieces.push(`${wb["3"]} premier event`);
    if (wb["1"]) pieces.push(`${wb["1"]} ladder`);
    stamp.textContent = `${meta.n_decks.toLocaleString()} winning decks (${pieces.join(", ")}) · ${meta.n_weeks} weeks · ${fmtDate(meta.first_week)} to ${fmtDate(meta.last_week)}`;
  }

  // ── Search ─────────────────────────
  let searchActiveIndex = -1;
  let currentResults = [];

  function setSearchStatus(text) {
    const el = $(".search-status");
    if (el) el.textContent = text;
  }

  function searchCards(q) {
    if (!allNames || !q) return [];
    const ql = q.toLowerCase().trim();
    if (!ql) return [];
    const exact = [], prefix = [], contains = [], fuzzy = [];
    for (const n of allNames) {
      const nl = n.toLowerCase();
      if (nl === ql) exact.push(n);
      else if (nl.startsWith(ql)) prefix.push(n);
      else if (nl.includes(ql)) contains.push(n);
      else if (ql.length >= 4 && Math.abs(nl.length - ql.length) <= 3) {
        const prefixOverlap = (nl[0] === ql[0]) + (nl[1] === ql[1]);
        if (prefixOverlap >= 1) {
          const d = dlDistance(nl.slice(0, ql.length + 2), ql);
          if (d <= 2) fuzzy.push([n, d]);
        }
      }
    }
    fuzzy.sort((a, b) => a[1] - b[1]);
    const fuzzNames = fuzzy.slice(0, 10).map((x) => x[0]);
    const rank = (n) => {
      const c = cardsByName && cardsByName[n];
      return c ? -(c.centerpiece_decks * 2 + c.any_decks) : 0;
    };
    exact.sort((a, b) => rank(a) - rank(b));
    prefix.sort((a, b) => rank(a) - rank(b));
    contains.sort((a, b) => rank(a) - rank(b));
    return [...exact, ...prefix, ...contains, ...fuzzNames].slice(0, 20);
  }

  function renderSearchResults(names) {
    const box = $(".search-results");
    currentResults = names;
    searchActiveIndex = -1;
    if (!names.length) { box.classList.remove("open"); box.innerHTML = ""; return; }
    box.innerHTML = names.map((n, i) => {
      const c = cardsByName && cardsByName[n];
      const im = img(n);
      const thumb = im
        ? `<img class="search-result-thumb" src="${im}" alt="" loading="lazy">`
        : `<div class="search-result-thumb"></div>`;
      let stat = "";
      if (c) {
        const tb = c.tier ? tierBadge(c.tier) : "";
        stat = `${tb} <span class="search-result-counts">in ${c.main_decks} winning decks</span>`;
      } else {
        const isNew = isNewCard(n);
        stat = `<span class="search-result-counts ${isNew ? "search-new" : "search-void"}">${isNew ? "new, no data yet" : "no winning lists"}</span>`;
      }
      return `<div class="search-result" data-idx="${i}" data-name="${escapeHtml(n)}">
        ${thumb}
        <div class="search-result-info">
          <div class="search-result-name">${escapeHtml(n)}</div>
          <div class="search-result-stat">${stat}</div>
        </div>
      </div>`;
    }).join("");
    box.classList.add("open");
    $$(".search-result", box).forEach((el) => {
      el.addEventListener("click", () => navigateToCard(el.dataset.name));
    });
  }

  function highlightSearchResult(idx) {
    const items = $$(".search-result");
    items.forEach((el, i) => el.classList.toggle("active", i === idx));
    if (idx >= 0 && items[idx]) items[idx].scrollIntoView({ block: "nearest" });
  }

  function setupSearch() {
    const input = $(".search-input");
    const box = $(".search-results");
    if (!input) return;
    input.addEventListener("input", () => {
      if (!dataReady) { setSearchStatus("Indexing…"); return; }
      renderSearchResults(searchCards(input.value));
    });
    input.addEventListener("keydown", (e) => {
      if (!currentResults.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        searchActiveIndex = Math.min(searchActiveIndex + 1, currentResults.length - 1);
        highlightSearchResult(searchActiveIndex);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        searchActiveIndex = Math.max(searchActiveIndex - 1, 0);
        highlightSearchResult(searchActiveIndex);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const target = currentResults[searchActiveIndex >= 0 ? searchActiveIndex : 0];
        if (target) navigateToCard(target);
      } else if (e.key === "Escape") {
        input.value = "";
        renderSearchResults([]);
      }
    });
    document.addEventListener("click", (e) => {
      if (!box.contains(e.target) && e.target !== input) box.classList.remove("open");
    });
    input.addEventListener("focus", () => {
      if (currentResults.length) box.classList.add("open");
    });
  }

  // ── Deck state ─────────────────────────
  function deckCount(name) { return (deck.main || {})[name] || 0; }
  function deckCycle(name) {
    const cur = deckCount(name);
    const next = cur === 0 ? 4 : cur - 1;
    if (next === 0) delete deck.main[name];
    else deck.main[name] = next;
    saveLs(LS_DECK, deck);
    if (Object.keys(deck.main).length > 0) deckPanelClosed = false;
    applyDeckRailMode();
    renderDeckRail();
    if (currentRoute().type === "card") renderRoute();
    else refreshThumbnailDeckBadges();
  }
  function deckClear() {
    deck = { main: {}, side: {} };
    saveLs(LS_DECK, deck);
    applyDeckRailMode();
    renderDeckRail();
    if (currentRoute().type === "card") renderRoute();
    else refreshThumbnailDeckBadges();
  }
  function deckTotalMain() {
    return Object.values(deck.main || {}).reduce((a, b) => a + b, 0);
  }
  function deckCardNames() {
    return Object.keys(deck.main || {});
  }

  function refreshThumbnailDeckBadges() {
    $$(".thumb-deck-badge").forEach((el) => {
      const c = deckCount(el.dataset.name);
      el.textContent = c > 0 ? c : "+";
      el.classList.toggle("active", c > 0);
    });
  }

  // ── Adaptive companions ─────────────────────────
  // Given the current deck plus optionally the card being viewed, compute a
  // ranked list of cards (companions) by combined lift across all of them.
  // Uses geometric mean of lifts (where data exists; missing = neutral 1).
  function adaptiveCompanions(contextNames) {
    const ctx = contextNames.filter((n) => pairs[n]);
    if (!ctx.length) return { spells: [], lands: [] };
    const candidates = {};
    for (const n of ctx) {
      for (const r of pairs[n].companions) {
        if (!candidates[r.name]) candidates[r.name] = { name: r.name, lifts: {}, co: 0 };
        candidates[r.name].lifts[n] = r.lift;
        candidates[r.name].co += r.co_decks;
      }
    }
    const out = [];
    for (const c of Object.values(candidates)) {
      const liftValues = ctx.map((n) => c.lifts[n] ?? 1);
      const product = liftValues.reduce((a, b) => a * b, 1);
      c.combinedLift = Math.pow(product, 1 / liftValues.length);
      c.presentIn = Object.keys(c.lifts).length;
      // Strongest single-card relation, for the natural-frequency label
      let bestPGivenA = 0;
      for (const n of ctx) {
        const r = (pairs[n].companions || []).find((rr) => rr.name === c.name);
        if (r && r.p_b_given_a > bestPGivenA) bestPGivenA = r.p_b_given_a;
      }
      c.bestPGivenA = bestPGivenA;
      out.push(c);
    }
    out.sort((a, b) => b.combinedLift - a.combinedLift);
    return {
      spells: out.filter((c) => !isLand(c.name)),
      lands: out.filter((c) => isLand(c.name)),
    };
  }

  // ── Routing ─────────────────────────
  function navigateToCard(name) {
    if (!name) return;
    location.hash = "#card/" + slugify(name);
    const inp = $(".search-input"); if (inp) inp.value = "";
    const box = $(".search-results"); if (box) box.classList.remove("open");
  }
  function navigateHome() {
    if (location.hash) history.pushState("", document.title, location.pathname);
    renderRoute();
  }

  function currentRoute() {
    const h = location.hash || "";
    const m = h.match(/^#card\/([^?]+)/);
    if (m) return { type: "card", slug: m[1] };
    return { type: "home" };
  }

  function renderRoute() {
    const route = currentRoute();
    if (route.type === "card") renderCard(route.slug);
    else renderHome();
    window.scrollTo(0, 0);
  }

  // ── Mini card with lift bar (Cleveland-McGill: length encodes magnitude) ─
  function miniCard(name, opts = {}) {
    const im = img(name);
    const c = cardsByName && cardsByName[name];
    const tier = c && c.tier;
    const dCount = deckCount(name);
    const liftBar = opts.lift !== undefined && opts.maxLift
      ? `<div class="lift-bar"><div class="lift-bar-fill" style="width:${Math.min(100, (opts.lift / opts.maxLift) * 100).toFixed(1)}%"></div></div>`
      : "";
    const liftLabel = opts.lift !== undefined
      ? `<span class="lift-label">×${opts.lift.toFixed(1)}</span>`
      : "";
    const inDeckMark = dCount > 0
      ? `<div class="thumb-in-deck">${dCount}× in deck</div>`
      : "";
    const art = im
      ? `<div class="mini-card-art">
           <img src="${im}" alt="" loading="lazy">
           ${tier ? `<span class="thumb-tier tier-${tier}"></span>` : ""}
           <button class="thumb-deck-badge ${dCount > 0 ? "active" : ""}" data-deck-add="${escapeHtml(name)}" data-name="${escapeHtml(name)}" title="add to deck (cycles 4 → 3 → 2 → 1 → 0)">${dCount > 0 ? dCount : "+"}</button>
           ${liftBar}
         </div>`
      : `<div class="mini-card-art no-image">${escapeHtml(name)}</div>`;
    return `
      <div class="mini-card${opts.extraClass ? " " + opts.extraClass : ""}${dCount > 0 ? " in-deck" : ""}">
        ${art}
        <button class="mini-card-name-btn" data-name="${escapeHtml(name)}">${escapeHtml(name)} ${liftLabel}</button>
        ${opts.statHtml ? `<div class="mini-card-stat">${opts.statHtml}</div>` : ""}
        ${inDeckMark}
      </div>`;
  }

  function attachCardActions(container) {
    $$(".mini-card-name-btn, .catalyst-row", container).forEach((el) => {
      el.addEventListener("click", () => navigateToCard(el.dataset.name));
    });
    $$(".manabase-card", container).forEach((el) => {
      el.addEventListener("click", () => navigateToCard(el.dataset.name));
    });
    $$("[data-deck-add]", container).forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        deckCycle(el.dataset.deckAdd);
      });
    });
  }

  // ── HOME (explore) ─────────────────────────
  function renderHome() {
    const main = $(".magic-page");
    const recentRange = explore.recent_window_weeks.length
      ? `${fmtDate(explore.recent_window_weeks[0])} to ${fmtDate(explore.recent_window_weeks.at(-1))}`
      : "";

    main.innerHTML = `
      <section class="intro">
        <h1 class="intro-heading">Magic.</h1>
        <p class="intro-body">
          A card-centric explorer for MTG Standard. Built from winning lists across the
          ladder, premier events, and the Pro Tour. The angle isn't archetypes, it's
          relationships: which cards are the gravity wells, which travel together, which
          only show up when their anchor is present. Click <strong>+</strong> on any card
          to start a deck. As you add cards, the recommendations re-rank around what
          you've selected.
        </p>
        <div class="dataset-stamp" style="margin-top:18px;"></div>
      </section>

      <div class="search-shell">
        <input class="search-input" type="text" placeholder="search a card…" autocomplete="off" spellcheck="false">
        <span class="search-status">Indexing…</span>
        <div class="search-results"></div>
      </div>

      <div class="explore-grid">
        <section class="panel">
          <div class="panel-header"><h2 class="panel-title">Pillars right now</h2><span class="panel-meta">last 8 weeks · ${recentRange}</span></div>
          <p class="panel-blurb">Cards being committed to as 3-or-more copies in winning lists. If you're playing Standard, you'll see these.</p>
          <div class="card-strip" id="strip-pillars"></div>
        </section>

        <section class="panel">
          <div class="panel-header"><h2 class="panel-title">Recently risen</h2><span class="panel-meta">last 8wk vs prior 8wk</span></div>
          <p class="panel-blurb">Biggest gainers in main-deck prevalence. The cards a returning player should know exist.</p>
          <div class="card-strip" id="strip-risen"></div>
        </section>

        <section class="panel">
          <div class="panel-header"><h2 class="panel-title">Quietly disappeared</h2><span class="panel-meta">last 8wk vs prior 8wk</span></div>
          <p class="panel-blurb">What's fallen off. Don't bother crafting these even if you saw them in lists three months ago.</p>
          <div class="card-strip" id="strip-disappeared"></div>
        </section>

        <section class="panel">
          <div class="panel-header"><h2 class="panel-title">Sideboards are preparing for…</h2><span class="panel-meta">side prevalence rising</span></div>
          <p class="panel-blurb">Cards being brought to sideboards more often than they used to be. A read on what people are reaching for to answer the current meta.</p>
          <div class="card-strip" id="strip-side"></div>
        </section>

        <section class="panel">
          <div class="panel-header"><h2 class="panel-title">New arrivals that moved a shell</h2><span class="panel-meta">catalyst detection</span></div>
          <p class="panel-blurb">New cards whose own play rate is modest but whose lift-shell jumped meaningfully when they arrived. Possible signal: this card was the missing piece. Correlation, not proof.</p>
          <div id="strip-catalysts"></div>
        </section>
      </div>
    `;

    renderDatasetStamp();
    setupSearch();

    const fillStrip = (id, items, statFn) => {
      const el = $("#" + id);
      el.innerHTML = items.map((r) => miniCard(r.name, { statHtml: statFn(r) })).join("");
    };
    fillStrip("strip-pillars", explore.pillars,
      (r) => `${tierBadge(r.tier || "")}`);
    fillStrip("strip-risen", explore.risen,
      (r) => `<span class="mini-card-delta-pos">${fmtPp(r.delta)}</span>`);
    fillStrip("strip-disappeared", explore.disappeared,
      (r) => `<span class="mini-card-delta-neg">${fmtPp(r.delta)}</span>`);
    fillStrip("strip-side", explore.side_risers,
      (r) => `<span class="mini-card-delta-pos">${fmtPp(r.delta)}</span>`);

    const cat = $("#strip-catalysts");
    cat.innerHTML = explore.catalysts.map((r) => {
      const im = img(r.name);
      const thumb = im ? `<div class="catalyst-thumb"><img src="${im}" alt="" loading="lazy"></div>` : `<div class="catalyst-thumb"></div>`;
      const shellNames = r.shell.map(escapeHtml).join(", ");
      return `<div class="catalyst-row" data-name="${escapeHtml(r.name)}">
        ${thumb}
        <div class="catalyst-info">
          <div class="catalyst-name">${escapeHtml(r.name)}</div>
          <div class="catalyst-shell-trace">
            Arrived ${fmtDate(r.first_week)} · its shell (${shellNames}) moved
            <strong>${fmtPct(r.shell_before)} → ${fmtPct(r.shell_after)}</strong>
            (${fmtPp(r.shell_delta)}). Card itself only ${fmtPct(r.card_main_prevalence)} of decks.
          </div>
        </div>
      </div>`;
    }).join("");

    attachCardActions(main);
    if (dataReady) setSearchStatus("");
  }

  // ── Sparkline ─────────────────────────
  function sparklinePath(trend) {
    if (!trend.length) return "";
    const w = 600, h = 60;
    const max = Math.max(...trend.map(([, hits, tot]) => tot ? hits / tot : 0), 0.001);
    return trend.map(([, hits, tot], i) => {
      const x = (i / Math.max(trend.length - 1, 1)) * w;
      const y = h - ((tot ? hits / tot : 0) / max) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  }

  // ── Card detail ─────────────────────────
  function renderCard(slug) {
    const main = $(".magic-page");
    if (!dataReady) { main.innerHTML = `<div class="loading">Loading…</div>`; return; }
    const name = unslugify(slug);
    if (!name) {
      main.innerHTML = `<button class="detail-back">← back</button><div class="error">No card matches that name.</div>`;
      $(".detail-back").addEventListener("click", navigateHome);
      return;
    }
    const c = cardsByName[name];
    if (c) renderCardDetail(name, c);
    else renderVoidCard(name);
  }

  function renderCardDetail(name, c) {
    const main = $(".magic-page");
    const sf = scryfall[name] || {};
    const im = sf.image || sf.image_small || "";

    const hist = c.copy_hist_main || {};
    const histMax = Math.max(...["1","2","3","4"].map((k) => hist[k] || 0), 1);
    const histBars = ["1","2","3","4"].map((k) => {
      const v = hist[k] || 0;
      const pct = (v / histMax) * 100;
      return `<div class="copy-hist-bar${v ? "" : " empty"}" style="height:${Math.max(pct,3)}%" title="${v} decks ran ${k}"></div>`;
    }).join("");
    const total = c.main_decks;
    let copySummary = "";
    if (total > 0) {
      const ones = hist["1"] || 0, fours = hist["4"] || 0;
      if (fours > total * 0.7) copySummary = "almost always a 4-of";
      else if (ones > total * 0.6) copySummary = "almost always a 1-of singleton";
      else if (c.centerpiece_decks > c.flex_decks * 1.5) copySummary = "mostly a centerpiece";
      else if (c.flex_decks > c.centerpiece_decks * 1.5) copySummary = "mostly a flex slot";
      else copySummary = "split between centerpiece and flex roles";
    }

    const trend = c.weekly_main || [];
    const sideTrend = c.weekly_side || [];
    const sparkPath = sparklinePath(trend);
    const sparkSide = sparklinePath(sideTrend);
    const trendStart = trend.length ? trend[0][0] : "";
    const trendEnd = trend.length ? trend.at(-1)[0] : "";

    // ── Adaptive context: deck cards ∪ {viewed card if not in deck}
    const deckCards = deckCardNames();
    const ctx = deckCards.includes(name) ? deckCards.slice() : [...deckCards, name];
    const adaptive = adaptiveCompanions(ctx);
    const usingDeck = deckCards.length > 0;

    const renderAdaptiveStrip = (items, kind) => {
      if (!items.length) return `<div class="detail-section-empty">none above the noise floor</div>`;
      const top = items.slice(0, 18);
      const maxLift = Math.max(...top.map((c) => c.combinedLift), 0.01);
      return `<div class="card-strip">${top.map((cc) => {
        const inDeck = deckCount(cc.name) > 0;
        const stat = `<span class="freq-label">in <strong>${naturalFreq(cc.bestPGivenA)}</strong> of decks with ${kind === "single" ? "this" : "your shell"}</span>`;
        return miniCard(cc.name, {
          extraClass: "companion-card" + (inDeck ? " companion-already-in" : ""),
          lift: cc.combinedLift,
          maxLift,
          statHtml: stat,
        });
      }).join("")}</div>`;
    };

    const renderManabaseStrip = (items) => {
      if (!items.length) return "";
      const maxLift = Math.max(...items.map((c) => c.combinedLift), 0.01);
      return `<div class="manabase-row">
        <div class="manabase-label">Manabase ties</div>
        <div class="manabase-strip">${items.map((c) => {
          const im = img(c.name);
          const thumb = im ? `<img class="manabase-thumb" src="${im}" alt="" loading="lazy">` : `<div class="manabase-thumb"></div>`;
          const widthPct = Math.min(100, (c.combinedLift / maxLift) * 100).toFixed(0);
          return `<button class="manabase-card" data-name="${escapeHtml(c.name)}">${thumb}<span class="manabase-name">${escapeHtml(c.name)}</span><span class="manabase-bar"><span class="manabase-bar-fill" style="width:${widthPct}%"></span></span></button>`;
        }).join("")}</div>
      </div>`;
    };

    const adaptiveBanner = usingDeck
      ? `<div class="adaptive-banner">Recommendations adjusted for your deck (${deckCards.length} unique card${deckCards.length === 1 ? "" : "s"}). Combined lift across all of them, ranked.</div>`
      : "";

    main.innerHTML = `
      <div class="detail-toolbar">
        <button class="detail-back">← back to explore</button>
        <div class="detail-toolbar-actions">
          <button class="primary-deck-toggle ${deckCount(name) > 0 ? "in-deck" : ""}" id="primary-deck-toggle">
            ${deckCount(name) > 0 ? `${deckCount(name)}× in deck, click to cycle` : `+ add to deck`}
          </button>
        </div>
      </div>

      <div class="card-detail">
        ${im ? `<div class="card-detail-art"><img src="${im}" alt=""></div>` : `<div class="card-detail-art"></div>`}
        <div class="card-detail-info">
          <h1 class="card-detail-name">${escapeHtml(name)}</h1>
          <div class="card-detail-type">${escapeHtml(sf.type_line || "")} ${sf.set ? `· ${sf.set} ${sf.cn}` : ""}</div>
          ${c.tier ? `<div style="margin:8px 0 20px;">${tierBadge(c.tier, { large: true })}</div>` : ""}

          <div class="card-detail-stat-grid">
            <div class="stat"><div class="stat-value">${c.main_decks}</div><div class="stat-label">winning decks main · ${fmtPct(c.main_prevalence)}</div></div>
            <div class="stat"><div class="stat-value">${c.side_decks}</div><div class="stat-label">in sideboards · ${fmtPct(c.side_prevalence)}</div></div>
            <div class="stat"><div class="stat-value">${c.centerpiece_decks}</div><div class="stat-label">as 3+ copies (centerpiece)</div></div>
            <div class="stat"><div class="stat-value">${c.flex_decks}</div><div class="stat-label">as 1–2 copies (flex)</div></div>
          </div>

          ${total > 0 ? `<div class="sparkline-shell">
            <div class="sparkline-title">Copies when present in main · ${escapeHtml(copySummary)}</div>
            <div class="copy-hist">${histBars}</div>
            <div class="copy-hist-labels"><span>1</span><span>2</span><span>3</span><span>4</span></div>
          </div>` : ""}

          ${sparkPath ? `<div class="sparkline-shell">
            <div class="sparkline-title">Weekly main-deck prevalence (red) and sideboard (blue)</div>
            <svg class="sparkline" viewBox="0 0 600 60" preserveAspectRatio="none">
              ${sparkSide ? `<path class="side" d="${sparkSide}"></path>` : ""}
              <path d="${sparkPath}"></path>
            </svg>
            <div class="sparkline-axis"><span>${fmtDate(trendStart)}</span><span>${fmtDate(trendEnd)}</span></div>
          </div>` : ""}
        </div>
      </div>

      ${adaptiveBanner}

      <section class="detail-section">
        <div class="detail-section-header">
          <h3 class="detail-section-title">${usingDeck ? "What fits with your shell" : `Cards ${escapeHtml(name)} loves`}</h3>
          <span class="detail-section-explainer">${usingDeck ? "geometric mean of lifts" : "ranked by lift"}</span>
        </div>
        <p class="detail-section-blurb">
          ${usingDeck
            ? "Sorted by how often these cards travel with the cards in your deck. Cards already in your deck stay shown so you can see the shell coming together."
            : "Cards that appear with this one much more often than chance would predict. Bar length shows relative strength."}
        </p>
        ${renderAdaptiveStrip(adaptive.spells, usingDeck ? "shell" : "single")}
        ${renderManabaseStrip(adaptive.lands)}
      </section>
    `;

    $(".detail-back").addEventListener("click", navigateHome);
    $("#primary-deck-toggle").addEventListener("click", () => deckCycle(name));
    attachCardActions(main);
  }

  // ── Void card view ─────────────────────────
  function renderVoidCard(name) {
    const main = $(".magic-page");
    const sf = scryfall[name] || {};
    const im = sf.image || sf.image_small || "";
    const newCard = isNewCard(name);
    const inStandard = !!sf.released_at;

    const banner = newCard
      ? `<div class="void-banner void-new">
          <div class="void-banner-title">New from ${sf.set || "the latest set"} · released ${fmtDate(sf.released_at)}</div>
          <div class="void-banner-body">Too recent to have appeared in winning lists yet. Give it a few weeks of ladder data before deciding.</div>
        </div>`
      : inStandard
        ? `<div class="void-banner void-bad">
            <div class="void-banner-title">Not in any winning list. Effectively: do not play.</div>
            <div class="void-banner-body">Standard-legal but absent from the ${meta.n_decks.toLocaleString()} winning decks logged. If the meta shifts, this view will update.</div>
          </div>`
        : `<div class="void-banner void-bad">
            <div class="void-banner-title">Not in current Standard.</div>
            <div class="void-banner-body">This card isn't legal in current Standard.</div>
          </div>`;

    const myColors = (sf.colors || []).slice().sort().join("");
    const myCmc = sf.cmc;
    const myType = (sf.type_line || "").split("\u2014")[0].trim().split(" ").at(-1);
    const similar = [];
    if (cards) {
      for (const c of cards) {
        if (c.name === name) continue;
        const csf = scryfall[c.name] || {};
        const cColors = (csf.colors || []).slice().sort().join("");
        if (cColors !== myColors) continue;
        if (myCmc !== undefined && Math.abs((csf.cmc || 0) - myCmc) > 1) continue;
        const cType = (csf.type_line || "").split("\u2014")[0].trim().split(" ").at(-1);
        if (cType !== myType) continue;
        similar.push(c);
      }
      similar.sort((a, b) => (b.centerpiece_decks * 2 + b.any_decks) - (a.centerpiece_decks * 2 + a.any_decks));
    }
    const top = similar.slice(0, 12);

    main.innerHTML = `
      <div class="detail-toolbar">
        <button class="detail-back">← back to explore</button>
        <div class="detail-toolbar-actions">
          <button class="primary-deck-toggle ${deckCount(name) > 0 ? "in-deck" : ""}" id="primary-deck-toggle">
            ${deckCount(name) > 0 ? `${deckCount(name)}× in deck, click to cycle` : `+ add to deck`}
          </button>
        </div>
      </div>

      ${banner}

      <div class="card-detail">
        ${im ? `<div class="card-detail-art"><img src="${im}" alt=""></div>` : `<div class="card-detail-art"></div>`}
        <div class="card-detail-info">
          <h1 class="card-detail-name">${escapeHtml(name)}</h1>
          <div class="card-detail-type">${escapeHtml(sf.type_line || "")} ${sf.set ? `· ${sf.set} ${sf.cn}` : ""}</div>
        </div>
      </div>

      ${top.length ? `
        <section class="detail-section">
          <div class="detail-section-header"><h3 class="detail-section-title">Similar cards in winning lists</h3></div>
          <p class="detail-section-blurb">Same color identity, similar mana value, same primary card type. Shown in popularity order.</p>
          <div class="card-strip">${top.map((c) => miniCard(c.name, {
            statHtml: c.tier ? tierBadge(c.tier) : `${c.main_decks} decks`,
          })).join("")}</div>
        </section>
      ` : `<div class="detail-section-empty">No clean comparables in the meta.</div>`}
    `;

    $(".detail-back").addEventListener("click", navigateHome);
    $("#primary-deck-toggle").addEventListener("click", () => deckCycle(name));
    attachCardActions(main);
  }

  // ── Deck rail (persistent right column when populated) ─────────────────────
  function applyDeckRailMode() {
    const total = deckTotalMain();
    document.body.classList.toggle("has-deck", total > 0 && !deckPanelClosed);
  }

  function buildMtgaExport() {
    const lines = ["Deck"];
    const sortedMain = Object.entries(deck.main || {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    for (const [n, q] of sortedMain) {
      const sf = scryfall[n] || {};
      const setCn = sf.set && sf.cn ? ` (${sf.set}) ${sf.cn}` : "";
      lines.push(`${q} ${n}${setCn}`);
    }
    const sortedSide = Object.entries(deck.side || {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    if (sortedSide.length) {
      lines.push("", "Sideboard");
      for (const [n, q] of sortedSide) {
        const sf = scryfall[n] || {};
        const setCn = sf.set && sf.cn ? ` (${sf.set}) ${sf.cn}` : "";
        lines.push(`${q} ${n}${setCn}`);
      }
    }
    return lines.join("\n");
  }

  function deckColorIdentity() {
    const colors = new Set();
    for (const n of Object.keys(deck.main || {})) {
      const sf = scryfall[n] || {};
      for (const col of sf.colors || []) colors.add(col);
    }
    return [...colors].sort().join("");
  }

  function deckCurve() {
    const buckets = [0, 0, 0, 0, 0, 0, 0, 0];
    for (const [n, q] of Object.entries(deck.main || {})) {
      const sf = scryfall[n] || {};
      if (!sf.type_line || sf.type_line.includes("Land")) continue;
      const cmc = Math.min(7, Math.floor(sf.cmc || 0));
      buckets[cmc] += q;
    }
    return buckets;
  }

  function renderDeckRail() {
    let rail = $(".deck-rail");
    if (!rail) {
      document.body.insertAdjacentHTML("beforeend", `<aside class="deck-rail"></aside>`);
      rail = $(".deck-rail");
    }
    const total = deckTotalMain();
    if (total === 0) {
      rail.style.display = "none";
      const opener = $(".deck-opener"); if (opener) opener.classList.remove("has-cards");
      return;
    }
    rail.style.display = "flex";

    const mainEntries = Object.entries(deck.main || {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const colors = deckColorIdentity();
    const curve = deckCurve();
    const curveMax = Math.max(...curve, 1);

    rail.innerHTML = `
      <div class="deck-rail-header">
        <div class="deck-rail-title">Deck <span class="deck-rail-count">${total}/60</span></div>
        <button class="deck-rail-close" id="deck-rail-close" aria-label="hide">−</button>
      </div>

      <div class="deck-rail-meta">
        <div><span class="deck-meta-label">Colors</span> <span class="deck-meta-val">${colors || "-"}</span></div>
        <div class="deck-curve">
          ${curve.map((v, i) => `<div class="deck-curve-bar" style="height:${(v/curveMax)*100}%" title="${i === 7 ? "7+" : i}: ${v} cards"></div>`).join("")}
        </div>
        <div class="deck-curve-labels">${curve.map((_, i) => `<span>${i === 7 ? "7+" : i}</span>`).join("")}</div>
      </div>

      <div class="deck-rail-list">
        ${mainEntries.map(([n, q]) => `
          <div class="deck-line">
            <button class="deck-line-qty" data-deck-cycle="${escapeHtml(n)}">${q}</button>
            <button class="deck-line-name" data-name="${escapeHtml(n)}">${escapeHtml(n)}</button>
          </div>
        `).join("")}
      </div>

      <div class="deck-rail-actions">
        <button class="deck-action" id="deck-export">Copy MTGA import</button>
        <button class="deck-action danger" id="deck-clear">Clear</button>
      </div>
      <div class="deck-export-status" id="deck-export-status"></div>
    `;

    $("#deck-rail-close").addEventListener("click", () => {
      deckPanelClosed = true;
      applyDeckRailMode();
      rail.style.display = "none";
      const opener = $(".deck-opener"); if (opener) opener.classList.add("has-cards");
    });
    $$("[data-deck-cycle]", rail).forEach((el) => {
      el.addEventListener("click", () => deckCycle(el.dataset.deckCycle));
    });
    $$(".deck-line-name", rail).forEach((el) => {
      el.addEventListener("click", () => navigateToCard(el.dataset.name));
    });
    $("#deck-export").addEventListener("click", async () => {
      const text = buildMtgaExport();
      try {
        await navigator.clipboard.writeText(text);
        $("#deck-export-status").textContent = "Copied. Paste into MTGA's deck import.";
      } catch {
        const ta = document.createElement("textarea");
        ta.value = text; document.body.appendChild(ta); ta.select();
        try { document.execCommand("copy"); $("#deck-export-status").textContent = "Copied (fallback)."; }
        catch { $("#deck-export-status").textContent = "Copy failed."; }
        finally { document.body.removeChild(ta); }
      }
    });
    $("#deck-clear").addEventListener("click", () => {
      if (confirm("Clear the entire deck?")) deckClear();
    });

    // Reopen via a small floating button (only present after closing)
    let opener = $(".deck-opener");
    if (!opener) {
      document.body.insertAdjacentHTML("beforeend", `<button class="deck-opener" title="show deck">🃏 <span class="deck-opener-count"></span></button>`);
      opener = $(".deck-opener");
      opener.addEventListener("click", () => {
        deckPanelClosed = false;
        applyDeckRailMode();
        renderDeckRail();
      });
    }
    opener.querySelector(".deck-opener-count").textContent = total > 0 ? `${total}` : "";
    opener.classList.toggle("has-cards", deckPanelClosed && total > 0);
  }

  // ── Boot ─────────────────────────
  window.addEventListener("hashchange", renderRoute);
  window.addEventListener("storage", (e) => {
    if (e.key === LS_DECK) {
      deck = loadJsonLs(LS_DECK, { main: {}, side: {} });
      applyDeckRailMode();
      renderDeckRail();
      renderRoute();
    }
  });

  loadInitial().then(() => {
    applyDeckRailMode();
    renderDeckRail();
    renderRoute();
    loadFull();
  }).catch((err) => {
    $(".magic-page").innerHTML = `<div class="error">Couldn't load the dataset. ${escapeHtml(String(err))}</div>`;
  });
})();
