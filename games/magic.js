/* ═══════════════════════════════════════
   magic.js, meta explorer interactions.
   Routes: #card/<slug>, #web?pin=a,b,c, # (home).
   State: pins + deck, persisted in localStorage.
═══════════════════════════════════════ */

(function () {
  const DATA_DIR = "/games/data";
  const LS_PINS = "magic.pins";
  const LS_DECK = "magic.deck";

  // ── State ─────────────────────────────────────────────
  let cards = null;            // [{name, ...}, ...] (in-dataset)
  let cardsByName = null;
  let pairs = null;
  let scryfall = null;         // includes in-dataset + Standard-legal-only cards
  let allNames = null;         // sorted name list across cards + scryfall (for search)
  let explore = null;
  let meta = null;
  let dataReady = false;
  let pins = loadJsonLs(LS_PINS, []);
  let deck = loadJsonLs(LS_DECK, { main: {}, side: {} });

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

  // dd-mm-yyyy per CLAUDE.md hard rule 5. Internal data stays ISO for sortability.
  function fmtDate(iso) {
    if (!iso || typeof iso !== "string") return "";
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
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
    for (const n of allNames) {
      if (normalizeName(n) === want) return n;
    }
    return null;
  }

  // Tier display
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
    return `<span class="${cls}" title="${TIER_LABELS[tier] || tier}">${TIER_LABELS[tier] || tier}</span>`;
  }

  // Damerau-Levenshtein distance (handles transposition, useful for typos like "colostorm")
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

  // ── Data loading ─────────────────────────────────────────────
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
        // Cheap pre-filter: only run DL if the first 2 chars share at least 1
        const prefixOverlap = (nl[0] === ql[0]) + (nl[1] === ql[1]);
        if (prefixOverlap >= 1) {
          const d = dlDistance(nl.slice(0, ql.length + 2), ql);
          if (d <= 2) fuzzy.push([n, d]);
        }
      }
    }
    fuzzy.sort((a, b) => a[1] - b[1]);
    const fuzzNames = fuzzy.slice(0, 10).map((x) => x[0]);

    // Rank by importance within each tier of match
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
    if (!names.length) {
      box.classList.remove("open");
      box.innerHTML = "";
      return;
    }
    box.innerHTML = names.map((n, i) => {
      const c = cardsByName && cardsByName[n];
      const im = img(n);
      const thumb = im
        ? `<img class="search-result-thumb" src="${im}" alt="" loading="lazy">`
        : `<div class="search-result-thumb"></div>`;
      let stat = "";
      if (c) {
        const tb = c.tier ? tierBadge(c.tier) : "";
        stat = `${tb} <span class="search-result-counts">${c.main_decks} decks</span>`;
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

  // ── Pin & Deck state ─────────────────────────
  function isPinned(name) { return pins.includes(name); }
  function togglePin(name) {
    if (isPinned(name)) pins = pins.filter((p) => p !== name);
    else pins = [...pins, name];
    saveLs(LS_PINS, pins);
    renderPinStrip();
  }
  function clearPins() { pins = []; saveLs(LS_PINS, pins); renderPinStrip(); renderRoute(); }

  function deckCount(name, zone = "main") {
    return (deck[zone] || {})[name] || 0;
  }
  function deckCycle(name) {
    // Click to cycle main: 0 → 4 → 3 → 2 → 1 → 0
    const cur = deckCount(name, "main");
    const next = cur === 0 ? 4 : cur - 1;
    if (next === 0) delete deck.main[name];
    else deck.main[name] = next;
    saveLs(LS_DECK, deck);
    renderDeckPanel();
    // Re-render any card detail to update its inline deck control
    if (currentRoute().type === "card") refreshDeckControls();
  }
  function deckClear() {
    deck = { main: {}, side: {} };
    saveLs(LS_DECK, deck);
    renderDeckPanel();
    if (currentRoute().type === "card") refreshDeckControls();
  }
  function deckTotalMain() {
    return Object.values(deck.main || {}).reduce((a, b) => a + b, 0);
  }

  function refreshDeckControls() {
    $$("[data-deck-controls-for]").forEach((el) => {
      const n = el.dataset.deckControlsFor;
      el.outerHTML = renderDeckControlsFor(n);
    });
    $$(".thumb-deck-badge").forEach((el) => {
      const n = el.dataset.name;
      const c = deckCount(n);
      el.textContent = c > 0 ? c : "+";
      el.classList.toggle("active", c > 0);
    });
  }

  // ── Routing ─────────────────────────
  function navigateToCard(name) {
    if (!name) return;
    location.hash = "#card/" + slugify(name);
    const inp = $(".search-input");
    if (inp) inp.value = "";
    const box = $(".search-results");
    if (box) box.classList.remove("open");
  }
  function navigateHome() {
    if (location.hash) history.pushState("", document.title, location.pathname);
    renderRoute();
  }
  function navigateToWeb() {
    if (pins.length < 2) return;
    location.hash = "#web";
  }

  function currentRoute() {
    const h = location.hash || "";
    let m = h.match(/^#card\/([^?]+)/);
    if (m) return { type: "card", slug: m[1] };
    m = h.match(/^#web/);
    if (m) return { type: "web" };
    return { type: "home" };
  }

  function renderRoute() {
    const route = currentRoute();
    if (route.type === "card") renderCard(route.slug);
    else if (route.type === "web") renderWeb();
    else renderHome();
    window.scrollTo(0, 0);
  }

  // ── Pin chip strip ─────────────────────────
  function renderPinStrip() {
    const strip = $(".pin-strip");
    if (!strip) return;
    if (!pins.length) {
      strip.classList.remove("visible");
      strip.innerHTML = "";
      return;
    }
    strip.classList.add("visible");
    const chips = pins.map((n) => {
      const im = img(n);
      const thumb = im ? `<img src="${im}" alt="">` : "";
      return `<span class="pin-chip" data-name="${escapeHtml(n)}">
        ${thumb}<span class="pin-chip-name">${escapeHtml(n)}</span>
        <button class="pin-chip-x" data-remove="${escapeHtml(n)}" aria-label="unpin">×</button>
      </span>`;
    }).join("");
    const action = pins.length >= 2
      ? `<button class="pin-strip-action" id="show-web">show web of connections →</button>`
      : `<span class="pin-strip-hint">pin one more card to see what they share</span>`;
    strip.innerHTML = `
      <span class="pin-strip-label">Pinned</span>
      <div class="pin-strip-chips">${chips}</div>
      ${action}
      <button class="pin-strip-clear" id="clear-pins" title="clear all pins">clear</button>
    `;
    $$(".pin-chip", strip).forEach((el) => {
      el.addEventListener("click", (e) => {
        if (e.target.matches(".pin-chip-x")) return;
        navigateToCard(el.dataset.name);
      });
    });
    $$(".pin-chip-x", strip).forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        togglePin(el.dataset.remove);
      });
    });
    const showWeb = $("#show-web", strip);
    if (showWeb) showWeb.addEventListener("click", navigateToWeb);
    $("#clear-pins", strip).addEventListener("click", clearPins);
  }

  // ── Mini card renderer ─────────────────────────
  function miniCard(name, opts = {}) {
    const im = img(name);
    const c = cardsByName && cardsByName[name];
    const tier = c && c.tier;
    const art = im
      ? `<div class="mini-card-art"><img src="${im}" alt="" loading="lazy">
           ${tier ? `<span class="thumb-tier tier-${tier}" title="${TIER_LABELS[tier]}"></span>` : ""}
           <button class="thumb-pin-toggle ${isPinned(name) ? "active" : ""}" data-pin="${escapeHtml(name)}" title="${isPinned(name) ? "unpin" : "pin to compare"}">📌</button>
           <button class="thumb-deck-badge ${deckCount(name) > 0 ? "active" : ""}" data-deck-add="${escapeHtml(name)}" data-name="${escapeHtml(name)}" title="add to deck (cycles 4→3→2→1→0)">${deckCount(name) > 0 ? deckCount(name) : "+"}</button>
         </div>`
      : `<div class="mini-card-art no-image">${escapeHtml(name)}</div>`;
    return `
      <div class="mini-card${opts.extraClass ? " " + opts.extraClass : ""}">
        ${opts.overlayHtml || ""}
        ${art}
        <button class="mini-card-name-btn" data-name="${escapeHtml(name)}">${escapeHtml(name)}</button>
        ${opts.statHtml ? `<div class="mini-card-stat">${opts.statHtml}</div>` : ""}
      </div>`;
  }

  function attachCardActions(container) {
    $$(".mini-card-name-btn, .catalyst-row", container).forEach((el) => {
      el.addEventListener("click", () => navigateToCard(el.dataset.name));
    });
    $$(".manabase-card", container).forEach((el) => {
      el.addEventListener("click", () => navigateToCard(el.dataset.name));
    });
    $$(".thumb-pin-toggle", container).forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        togglePin(el.dataset.pin);
        el.classList.toggle("active");
      });
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
          A card-centric explorer for MTG Standard. Built from winning lists
          across the ladder, premier events, and the Pro Tour. The angle isn't
          archetypes, it's relationships: which cards are the gravity wells,
          which travel together, which only show up when their anchor is present.
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
          <div class="panel-header">
            <h2 class="panel-title">Pillars right now</h2>
            <span class="panel-meta">last 8 weeks · ${recentRange}</span>
          </div>
          <p class="panel-blurb">
            Cards being committed to as 3-or-more copies in winning lists.
            If you're playing Standard, you'll see these.
          </p>
          <div class="card-strip" id="strip-pillars"></div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <h2 class="panel-title">Recently risen</h2>
            <span class="panel-meta">last 8wk vs prior 8wk</span>
          </div>
          <p class="panel-blurb">Biggest gainers in main-deck prevalence. The cards a returning player should know exist.</p>
          <div class="card-strip" id="strip-risen"></div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <h2 class="panel-title">Quietly disappeared</h2>
            <span class="panel-meta">last 8wk vs prior 8wk</span>
          </div>
          <p class="panel-blurb">What's fallen off. Don't bother crafting these even if you saw them in lists three months ago.</p>
          <div class="card-strip" id="strip-disappeared"></div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <h2 class="panel-title">Sideboards are preparing for…</h2>
            <span class="panel-meta">side prevalence rising</span>
          </div>
          <p class="panel-blurb">Cards being brought to sideboards more often than they used to be. A read on what people are reaching for to answer the current meta.</p>
          <div class="card-strip" id="strip-side"></div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <h2 class="panel-title">New arrivals that moved a shell</h2>
            <span class="panel-meta">catalyst detection</span>
          </div>
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
      (r) => `<strong>${fmtPct(r.recent_centerpiece_prevalence)}</strong> as 3+`);
    fillStrip("strip-risen", explore.risen,
      (r) => `<span class="mini-card-delta-pos">${fmtPp(r.delta)}</span> · now ${fmtPct(r.recent)}`);
    fillStrip("strip-disappeared", explore.disappeared,
      (r) => `<span class="mini-card-delta-neg">${fmtPp(r.delta)}</span> · now ${fmtPct(r.recent)}`);
    fillStrip("strip-side", explore.side_risers,
      (r) => `<span class="mini-card-delta-pos">${fmtPp(r.delta)}</span> · ${fmtPct(r.recent)} of sides`);

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
            Arrived ${fmtDate(r.first_week)} · its shell (${shellNames})
            moved <strong>${fmtPct(r.shell_before)} → ${fmtPct(r.shell_after)}</strong>
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

  // ── Deck inline controls ─────────────────────────
  function renderDeckControlsFor(name) {
    const cur = deckCount(name);
    const cls = cur > 0 ? "in-deck" : "";
    return `<button class="deck-control ${cls}" data-deck-controls-for="${escapeHtml(name)}" data-name="${escapeHtml(name)}">
      ${cur > 0 ? `<span class="deck-control-count">${cur}×</span> in deck` : "+ add to deck"}
    </button>`;
  }

  // ── Card detail ─────────────────────────
  function renderCard(slug) {
    const main = $(".magic-page");
    if (!dataReady) {
      main.innerHTML = `<div class="loading">Loading…</div>`;
      return;
    }
    const name = unslugify(slug);
    if (!name) {
      main.innerHTML = `<button class="detail-back">← back</button><div class="error">No card matches that name.</div>`;
      $(".detail-back").addEventListener("click", navigateHome);
      return;
    }
    const c = cardsByName[name];   // may be undefined for void cards
    if (c) renderCardDetail(name, c);
    else renderVoidCard(name);
  }

  function renderCardDetail(name, c) {
    const main = $(".magic-page");
    const p = pairs[name];
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

    const stripFor = (items, statFn) => {
      if (!items || !items.length) return `<div class="detail-section-empty">none above the noise floor</div>`;
      return `<div class="card-strip">${items.map((r) => miniCard(r.name, {
        extraClass: "companion-card",
        overlayHtml: r.lift !== undefined ? `<div class="companion-lift">×${r.lift.toFixed(1)}</div>` : "",
        statHtml: statFn(r),
      })).join("")}</div>`;
    };
    const renderStrip = (items, statFn) => {
      if (!items || !items.length) return `<div class="detail-section-empty">none above the noise floor</div>`;
      const spells = items.filter((r) => !isLand(r.name));
      const lands = items.filter((r) => isLand(r.name));
      let out = stripFor(spells, statFn);
      if (lands.length) {
        out += `<div class="manabase-row">
          <div class="manabase-label">Manabase ties</div>
          <div class="manabase-strip">${lands.map((r) => {
            const im = img(r.name);
            const thumb = im ? `<img class="manabase-thumb" src="${im}" alt="" loading="lazy">` : `<div class="manabase-thumb"></div>`;
            return `<button class="manabase-card" data-name="${escapeHtml(r.name)}" title="${escapeHtml(r.name)} · ×${r.lift.toFixed(1)}">${thumb}<span class="manabase-name">${escapeHtml(r.name)}</span></button>`;
          }).join("")}</div>
        </div>`;
      }
      return out;
    };

    const buildAroundButton = p && p.companions.length
      ? `<button class="build-around-btn" id="build-around">build a deck around this →</button>`
      : "";

    main.innerHTML = `
      <div class="detail-toolbar">
        <button class="detail-back">← back to explore</button>
        <div class="detail-toolbar-actions">
          <button class="pin-toggle ${isPinned(name) ? "active" : ""}" id="detail-pin">${isPinned(name) ? "★ pinned" : "☆ pin"}</button>
          ${renderDeckControlsFor(name)}
          ${buildAroundButton}
        </div>
      </div>

      <div class="card-detail">
        ${im ? `<div class="card-detail-art"><img src="${im}" alt=""></div>` : `<div class="card-detail-art"></div>`}
        <div class="card-detail-info">
          <h1 class="card-detail-name">${escapeHtml(name)}</h1>
          <div class="card-detail-type">${escapeHtml(sf.type_line || "")} ${sf.set ? `· ${sf.set} ${sf.cn}` : ""}</div>
          ${c.tier ? `<div style="margin:8px 0 20px;">${tierBadge(c.tier, { large: true })}</div>` : ""}

          <div class="card-detail-stat-grid">
            <div class="stat"><div class="stat-value">${c.main_decks}</div><div class="stat-label">main · ${fmtPct(c.main_prevalence)}</div></div>
            <div class="stat"><div class="stat-value">${c.side_decks}</div><div class="stat-label">side · ${fmtPct(c.side_prevalence)}</div></div>
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

      ${p ? `
        <section class="detail-section">
          <div class="detail-section-header"><h3 class="detail-section-title">Cards ${escapeHtml(name)} loves</h3><span class="detail-section-explainer">ranked by lift</span></div>
          <p class="detail-section-blurb">Cards that appear with this one much more often than chance would predict. Lift on each thumbnail tells you the multiplier over baseline.</p>
          ${renderStrip(p.companions, (r) => `<strong>${(r.p_b_given_a*100).toFixed(0)}%</strong> of its decks · ${r.co_decks} together`)}
        </section>
        <section class="detail-section">
          <div class="detail-section-header"><h3 class="detail-section-title">Cards this leans on</h3><span class="detail-section-explainer">anchors</span></div>
          <p class="detail-section-blurb">Cards that show up in most of this card's decks but where the reverse isn't true, they're bigger than this card. Useful for "what shell does this live in".</p>
          ${renderStrip(p.anchors, (r) => `${(r.p_b_given_a*100).toFixed(0)}% / ${(r.p_a_given_b*100).toFixed(0)}%`)}
        </section>
        <section class="detail-section">
          <div class="detail-section-header"><h3 class="detail-section-title">Cards that lean on this</h3><span class="detail-section-explainer">satellites</span></div>
          <p class="detail-section-blurb">Cards that mostly only show up when this one is present. If you see things here, this card is anchoring something.</p>
          ${renderStrip(p.satellites, (r) => `${(r.p_a_given_b*100).toFixed(0)}% / ${(r.p_b_given_a*100).toFixed(0)}%`)}
        </section>
      ` : `<div class="detail-section-empty">Below the support floor (${meta.min_support_decks} decks), not enough appearances to compute reliable companions.</div>`}
    `;

    $(".detail-back").addEventListener("click", navigateHome);
    $("#detail-pin").addEventListener("click", () => {
      togglePin(name);
      const btn = $("#detail-pin");
      btn.classList.toggle("active");
      btn.textContent = isPinned(name) ? "★ pinned" : "☆ pin";
    });
    const dc = $('[data-deck-controls-for="' + escapeHtml(name).replace(/"/g, '\\"') + '"]');
    if (dc) dc.addEventListener("click", () => deckCycle(name));
    const ba = $("#build-around");
    if (ba) ba.addEventListener("click", () => buildAround(name));
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
            <div class="void-banner-title">Not seen in any winning list. Effectively: do not play.</div>
            <div class="void-banner-body">Standard-legal but absent from the ${meta.n_decks.toLocaleString()} winning decks logged. If the meta shifts, this view will update.</div>
          </div>`
        : `<div class="void-banner void-bad">
            <div class="void-banner-title">Not in current Standard.</div>
            <div class="void-banner-body">This card isn't legal in current Standard. It won't appear in winning lists by definition.</div>
          </div>`;

    // Similar cards: same colors + cmc±1 + same primary type
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
          <button class="pin-toggle ${isPinned(name) ? "active" : ""}" id="detail-pin">${isPinned(name) ? "★ pinned" : "☆ pin"}</button>
          ${renderDeckControlsFor(name)}
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
          <div class="detail-section-header">
            <h3 class="detail-section-title">Cards in the same color, mana value, and type that ${newCard ? "are" : "do"} appear in winning lists</h3>
          </div>
          <p class="detail-section-blurb">Same color identity, similar mana value, same primary card type. Shown in popularity order.</p>
          <div class="card-strip">${top.map((c) => miniCard(c.name, {
            statHtml: c.tier ? tierBadge(c.tier) : `${c.main_decks} decks`,
          })).join("")}</div>
        </section>
      ` : `<div class="detail-section-empty">No clean comparables in the meta.</div>`}
    `;

    $(".detail-back").addEventListener("click", navigateHome);
    $("#detail-pin").addEventListener("click", () => {
      togglePin(name);
      const btn = $("#detail-pin");
      btn.classList.toggle("active");
      btn.textContent = isPinned(name) ? "★ pinned" : "☆ pin";
    });
    const dc = $('[data-deck-controls-for="' + escapeHtml(name).replace(/"/g, '\\"') + '"]');
    if (dc) dc.addEventListener("click", () => deckCycle(name));
    attachCardActions(main);
  }

  // ── Web view (multi-card intersection) ─────────────────────────
  function renderWeb() {
    const main = $(".magic-page");
    if (!dataReady) { main.innerHTML = `<div class="loading">Loading…</div>`; return; }
    if (pins.length < 2) {
      main.innerHTML = `<div class="error">Need at least 2 pinned cards to show a web. Pin some and come back.</div>`;
      return;
    }

    // For each pin, get its companion lift map. Then aggregate.
    const pinned = pins.filter((n) => pairs[n]);
    if (!pinned.length) {
      main.innerHTML = `<button class="detail-back">← back</button><div class="error">None of your pinned cards have enough data to compute relationships.</div>`;
      $(".detail-back").addEventListener("click", navigateHome);
      return;
    }

    // companion[name] = { lifts: { pinName: lift }, allPins: bool }
    const companion = {};
    for (const pin of pinned) {
      for (const r of pairs[pin].companions) {
        if (!companion[r.name]) companion[r.name] = { name: r.name, lifts: {}, co: 0 };
        companion[r.name].lifts[pin] = r.lift;
        companion[r.name].co += r.co_decks;
      }
    }

    const all = [], some = [];
    for (const c of Object.values(companion)) {
      if (pins.includes(c.name)) continue; // don't list pinned cards as companions of themselves
      const presentIn = Object.keys(c.lifts).length;
      // Geometric mean of lifts across all pins (1 if missing for a pin)
      const liftValues = pinned.map((p) => c.lifts[p] ?? 1);
      const product = liftValues.reduce((a, b) => a * b, 1);
      const geomean = Math.pow(product, 1 / liftValues.length);
      c.geomean = geomean;
      c.presentIn = presentIn;
      if (presentIn === pinned.length) all.push(c);
      else some.push(c);
    }
    all.sort((a, b) => b.geomean - a.geomean);
    some.sort((a, b) => b.presentIn - a.presentIn || b.geomean - a.geomean);

    const renderCompanionStrip = (items, includeSubsetBadges) => {
      if (!items.length) return `<div class="detail-section-empty">none above the noise floor</div>`;
      const spells = items.filter((c) => !isLand(c.name));
      const lands = items.filter((c) => isLand(c.name));
      const liftBadge = (c) => `<div class="companion-lift">×${c.geomean.toFixed(1)}</div>`;
      const subsetBadge = (c) => includeSubsetBadges
        ? `<div class="web-subset-badge">${c.presentIn}/${pinned.length}</div>`
        : "";
      const stat = (c) => includeSubsetBadges
        ? `with ${pinned.filter((p) => c.lifts[p]).map((p) => p.split(" ")[0]).join(" + ")}`
        : `lift ×${c.geomean.toFixed(1)} across all pins`;
      let out = `<div class="card-strip">${spells.map((c) => miniCard(c.name, {
        extraClass: "companion-card",
        overlayHtml: liftBadge(c) + subsetBadge(c),
        statHtml: stat(c),
      })).join("")}</div>`;
      if (lands.length) {
        out += `<div class="manabase-row">
          <div class="manabase-label">Manabase ties</div>
          <div class="manabase-strip">${lands.map((c) => {
            const im = img(c.name);
            const thumb = im ? `<img class="manabase-thumb" src="${im}" alt="" loading="lazy">` : `<div class="manabase-thumb"></div>`;
            return `<button class="manabase-card" data-name="${escapeHtml(c.name)}" title="${escapeHtml(c.name)} · ×${c.geomean.toFixed(1)}">${thumb}<span class="manabase-name">${escapeHtml(c.name)}</span></button>`;
          }).join("")}</div>
        </div>`;
      }
      return out;
    };

    main.innerHTML = `
      <div class="detail-toolbar">
        <button class="detail-back">← back</button>
        <div class="detail-toolbar-actions"><button class="pin-toggle" id="clear-pins-btn">clear all pins</button></div>
      </div>
      <h1 class="page-title">Web of connections</h1>
      <p class="page-subtitle">${pinned.length} cards pinned. The cards below appear with all of them, or some of them, more than chance would predict.</p>

      <div class="web-pinned-row">
        ${pinned.map((n) => {
          const im = img(n);
          return `<div class="web-pin-card">
            ${im ? `<img src="${im}" alt="">` : ""}
            <div class="web-pin-name">${escapeHtml(n)}</div>
            <button class="web-pin-remove" data-remove="${escapeHtml(n)}">unpin</button>
          </div>`;
        }).join("")}
      </div>

      <section class="detail-section">
        <div class="detail-section-header"><h3 class="detail-section-title">In all of these decks</h3><span class="detail-section-explainer">geometric mean of lifts</span></div>
        <p class="detail-section-blurb">Cards that travel with every one of your pins, ranked by combined lift. The strongest signal for "what else belongs here".</p>
        ${renderCompanionStrip(all.slice(0, 18), false)}
      </section>

      <section class="detail-section">
        <div class="detail-section-header"><h3 class="detail-section-title">In some of these decks</h3><span class="detail-section-explainer">subset companions</span></div>
        <p class="detail-section-blurb">Cards that travel with a subset of your pins. Useful for "what bridges these together" or "what's a near-miss".</p>
        ${renderCompanionStrip(some.slice(0, 18), true)}
      </section>
    `;

    $(".detail-back").addEventListener("click", navigateHome);
    $("#clear-pins-btn").addEventListener("click", () => { clearPins(); navigateHome(); });
    $$(".web-pin-remove").forEach((el) => {
      el.addEventListener("click", () => togglePin(el.dataset.remove));
    });
    attachCardActions(main);
  }

  // ── Build around ─────────────────────────
  function buildAround(name) {
    const p = pairs[name];
    if (!p) return;
    const seed = [{ name, qty: 4 }];
    for (const r of p.companions.slice(0, 14)) {
      const c = cardsByName[r.name];
      if (!c) continue;
      const hist = c.copy_hist_main || {};
      // Mode of copy histogram
      let bestK = 4, bestV = 0;
      for (const k of ["1","2","3","4"]) {
        if ((hist[k] || 0) > bestV) { bestV = hist[k]; bestK = parseInt(k); }
      }
      seed.push({ name: r.name, qty: bestK });
    }
    deck = { main: {}, side: {} };
    for (const s of seed) deck.main[s.name] = s.qty;
    saveLs(LS_DECK, deck);
    renderDeckPanel(true);
  }

  // ── Deck panel ─────────────────────────
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
    const buckets = [0, 0, 0, 0, 0, 0, 0, 0]; // 0,1,2,3,4,5,6,7+
    for (const [n, q] of Object.entries(deck.main || {})) {
      const sf = scryfall[n] || {};
      if (!sf.type_line || sf.type_line.includes("Land")) continue;
      const cmc = Math.min(7, Math.floor(sf.cmc || 0));
      buckets[cmc] += q;
    }
    return buckets;
  }

  let deckPanelOpen = false;
  function renderDeckPanel(forceOpen = false) {
    let panel = $(".deck-panel");
    if (!panel) {
      document.body.insertAdjacentHTML("beforeend", `<aside class="deck-panel"></aside>`);
      panel = $(".deck-panel");
    }
    const total = deckTotalMain();
    if (forceOpen || total > 0) deckPanelOpen = true;
    panel.classList.toggle("open", deckPanelOpen);

    const mainEntries = Object.entries(deck.main || {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const colors = deckColorIdentity();
    const curve = deckCurve();
    const curveMax = Math.max(...curve, 1);

    panel.innerHTML = `
      <div class="deck-panel-header">
        <div class="deck-panel-title">Deck <span class="deck-panel-count">${total}/60</span></div>
        <button class="deck-panel-close" id="deck-panel-close" aria-label="close">×</button>
      </div>

      ${total === 0 ? `<div class="deck-panel-empty">Add cards from the explorer using the <strong>+</strong> button on any thumbnail. Click again to cycle 4 → 3 → 2 → 1 → 0.</div>` : ""}

      ${total > 0 ? `
        <div class="deck-panel-meta">
          <div><span class="deck-meta-label">Colors</span> <span class="deck-meta-val">${colors || "-"}</span></div>
          <div class="deck-curve">
            ${curve.map((v, i) => `<div class="deck-curve-bar" style="height:${(v/curveMax)*100}%" title="${i === 7 ? "7+" : i}: ${v} cards"></div>`).join("")}
          </div>
          <div class="deck-curve-labels">${curve.map((_, i) => `<span>${i === 7 ? "7+" : i}</span>`).join("")}</div>
        </div>

        <div class="deck-panel-list">
          ${mainEntries.map(([n, q]) => `
            <div class="deck-line">
              <button class="deck-line-qty" data-deck-cycle="${escapeHtml(n)}">${q}</button>
              <button class="deck-line-name" data-name="${escapeHtml(n)}">${escapeHtml(n)}</button>
            </div>
          `).join("")}
        </div>

        <div class="deck-panel-actions">
          <button class="deck-action" id="deck-export">Copy MTGA import</button>
          <button class="deck-action danger" id="deck-clear">Clear deck</button>
        </div>
        <div class="deck-export-status" id="deck-export-status"></div>
      ` : ""}
    `;

    $("#deck-panel-close").addEventListener("click", () => {
      deckPanelOpen = false;
      panel.classList.remove("open");
    });
    $$("[data-deck-cycle]", panel).forEach((el) => {
      el.addEventListener("click", () => deckCycle(el.dataset.deckCycle));
    });
    $$(".deck-line-name", panel).forEach((el) => {
      el.addEventListener("click", () => navigateToCard(el.dataset.name));
    });
    const exp = $("#deck-export");
    if (exp) {
      exp.addEventListener("click", async () => {
        const text = buildMtgaExport();
        try {
          await navigator.clipboard.writeText(text);
          $("#deck-export-status").textContent = "Copied. Paste into MTGA's deck import.";
        } catch {
          // Fallback: select a textarea
          const ta = document.createElement("textarea");
          ta.value = text; document.body.appendChild(ta); ta.select();
          try { document.execCommand("copy"); $("#deck-export-status").textContent = "Copied (fallback)."; }
          catch { $("#deck-export-status").textContent = "Copy failed. Select manually:\n" + text.slice(0, 80) + "…"; }
          finally { document.body.removeChild(ta); }
        }
      });
    }
    const clr = $("#deck-clear");
    if (clr) clr.addEventListener("click", () => {
      if (confirm("Clear the entire deck?")) deckClear();
    });

    // Persistent toolbar button to open the panel even when closed
    let opener = $(".deck-opener");
    if (!opener) {
      document.body.insertAdjacentHTML("beforeend", `<button class="deck-opener" title="open deck">🃏 <span class="deck-opener-count"></span></button>`);
      opener = $(".deck-opener");
      opener.addEventListener("click", () => {
        deckPanelOpen = !deckPanelOpen;
        panel.classList.toggle("open", deckPanelOpen);
      });
    }
    const cnt = $(".deck-opener-count");
    cnt.textContent = total > 0 ? `${total}` : "";
    opener.classList.toggle("has-cards", total > 0);
  }

  // ── Boot ─────────────────────────
  window.addEventListener("hashchange", renderRoute);
  window.addEventListener("storage", (e) => {
    if (e.key === LS_PINS) { pins = loadJsonLs(LS_PINS, []); renderPinStrip(); }
    if (e.key === LS_DECK) { deck = loadJsonLs(LS_DECK, { main: {}, side: {} }); renderDeckPanel(); }
  });

  loadInitial().then(() => {
    // Inject pin strip before main content
    if (!$(".pin-strip")) {
      $(".magic-page").insertAdjacentHTML("beforebegin", `<div class="pin-strip"></div>`);
    }
    renderPinStrip();
    renderDeckPanel();
    renderRoute();
    loadFull();
  }).catch((err) => {
    $(".magic-page").innerHTML = `<div class="error">Couldn't load the dataset. ${escapeHtml(String(err))}</div>`;
  });
})();
