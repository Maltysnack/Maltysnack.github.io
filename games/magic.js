/* ═══════════════════════════════════════
   magic.js, meta explorer interactions
   Loads data lazily, owns search + routing + rendering.
═══════════════════════════════════════ */

(function () {
  const DATA_DIR = "/games/data";

  // State
  let cards = null;        // [{name, ...}, ...]
  let cardsByName = null;  // {name: card}
  let pairs = null;        // {name: {companions, satellites, anchors}}
  let scryfall = null;     // {name: {image, image_small, ...}}
  let explore = null;
  let meta = null;
  let dataReady = false;

  // DOM
  const $ = (sel) => document.querySelector(sel);

  function fmtPct(v, digits = 1) {
    return (v * 100).toFixed(digits) + "%";
  }

  function fmtPp(v) {
    const sign = v >= 0 ? "+" : "−";
    return sign + Math.abs(v * 100).toFixed(1) + "pp";
  }

  function img(name, kind = "small") {
    if (!scryfall) return "";
    const m = scryfall[name];
    if (!m) return "";
    return kind === "small" ? m.image_small : m.image;
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function slugify(name) {
    return encodeURIComponent(name.toLowerCase().replace(/\s+/g, "-").replace(/[^\w\-/]/g, ""));
  }

  function unslugify(slug) {
    if (!cards) return null;
    const want = decodeURIComponent(slug).toLowerCase().replace(/[^a-z0-9]+/g, "");
    for (const c of cards) {
      const norm = c.name.toLowerCase().replace(/[^a-z0-9]+/g, "");
      if (norm === want) return c.name;
    }
    return null;
  }

  // ── Data loading ─────────────────────────
  async function loadJson(name) {
    const r = await fetch(`${DATA_DIR}/${name}.json`);
    if (!r.ok) throw new Error(`failed to load ${name}.json`);
    return r.json();
  }

  async function loadInitial() {
    // scryfall is needed by explore-panel thumbnails, so it's part of the
    // initial bundle. cards + pairs are lazy-loaded for search and detail.
    [meta, explore, scryfall] = await Promise.all([
      loadJson("meta"),
      loadJson("explore"),
      loadJson("scryfall"),
    ]);
    renderDatasetStamp();
  }

  async function loadFull() {
    if (dataReady) return;
    [cards, pairs] = await Promise.all([
      loadJson("cards"),
      loadJson("pairs"),
    ]);
    cardsByName = Object.fromEntries(cards.map((c) => [c.name, c]));
    dataReady = true;
    setSearchStatus("");
    // Re-render the open card detail (explore panels already have their imagery)
    if (currentRoute().type === "card") renderRoute();
  }

  // ── Dataset stamp ─────────────────────────
  function renderDatasetStamp() {
    const stamp = $(".dataset-stamp");
    if (stamp && meta) {
      stamp.textContent = `${meta.n_decks.toLocaleString()} winning decks · ${meta.n_weeks} weeks · ${meta.first_week} → ${meta.last_week}`;
    }
  }

  // ── Search ─────────────────────────
  let searchActiveIndex = -1;
  let currentResults = [];

  function setSearchStatus(text) {
    const el = $(".search-status");
    if (el) el.textContent = text;
  }

  function searchCards(q) {
    if (!cards || !q) return [];
    const ql = q.toLowerCase();
    const exact = [];
    const prefix = [];
    const contains = [];
    for (const c of cards) {
      const nl = c.name.toLowerCase();
      if (nl === ql) exact.push(c);
      else if (nl.startsWith(ql)) prefix.push(c);
      else if (nl.includes(ql)) contains.push(c);
    }
    // Rank by how often they appear (centerpiece first, then any)
    const rank = (c) => -(c.centerpiece_decks * 2 + c.any_decks);
    exact.sort((a, b) => rank(a) - rank(b));
    prefix.sort((a, b) => rank(a) - rank(b));
    contains.sort((a, b) => rank(a) - rank(b));
    return [...exact, ...prefix, ...contains].slice(0, 20);
  }

  function renderSearchResults(results) {
    const box = $(".search-results");
    currentResults = results;
    searchActiveIndex = -1;
    if (!results.length) {
      box.classList.remove("open");
      box.innerHTML = "";
      return;
    }
    box.innerHTML = results.map((c, i) => {
      const im = img(c.name, "small");
      const thumb = im
        ? `<img class="search-result-thumb" src="${im}" alt="" loading="lazy">`
        : `<div class="search-result-thumb"></div>`;
      const stat = c.centerpiece_decks > 0
        ? `${c.centerpiece_decks} decks as 3+ copies · ${c.flex_decks} as 1-2`
        : `${c.any_decks} decks (mostly sideboard)`;
      return `
        <div class="search-result" data-idx="${i}" data-name="${escapeHtml(c.name)}">
          ${thumb}
          <div class="search-result-info">
            <div class="search-result-name">${escapeHtml(c.name)}</div>
            <div class="search-result-stat">${stat}</div>
          </div>
        </div>`;
    }).join("");
    box.classList.add("open");

    box.querySelectorAll(".search-result").forEach((el) => {
      el.addEventListener("click", () => {
        navigateToCard(el.dataset.name);
      });
    });
  }

  function highlightSearchResult(idx) {
    const items = document.querySelectorAll(".search-result");
    items.forEach((el, i) => el.classList.toggle("active", i === idx));
    if (idx >= 0 && items[idx]) {
      items[idx].scrollIntoView({ block: "nearest" });
    }
  }

  function setupSearch() {
    const input = $(".search-input");
    const box = $(".search-results");

    input.addEventListener("input", () => {
      if (!dataReady) {
        setSearchStatus("Indexing…");
        return;
      }
      renderSearchResults(searchCards(input.value.trim()));
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
        if (target) navigateToCard(target.name);
      } else if (e.key === "Escape") {
        input.value = "";
        renderSearchResults([]);
      }
    });

    document.addEventListener("click", (e) => {
      if (!box.contains(e.target) && e.target !== input) {
        box.classList.remove("open");
      }
    });

    input.addEventListener("focus", () => {
      if (currentResults.length) box.classList.add("open");
    });
  }

  // ── Routing ─────────────────────────
  function navigateToCard(name) {
    location.hash = "#card/" + slugify(name);
    $(".search-input").value = "";
    $(".search-results").classList.remove("open");
  }

  function navigateHome() {
    if (location.hash) {
      history.pushState("", document.title, location.pathname);
    }
    renderRoute();
  }

  function currentRoute() {
    const h = location.hash || "";
    const m = h.match(/^#card\/(.+)$/);
    if (m) return { type: "card", slug: m[1] };
    return { type: "home" };
  }

  function renderRoute() {
    const route = currentRoute();
    if (route.type === "card") {
      renderCard(route.slug);
    } else {
      renderHome();
    }
    window.scrollTo(0, 0);
  }

  // ── Mini card renderer ─────────────────────────
  function miniCard(name, opts = {}) {
    const im = img(name, "small");
    const art = im
      ? `<div class="mini-card-art"><img src="${im}" alt="" loading="lazy"></div>`
      : `<div class="mini-card-art no-image">${escapeHtml(name)}</div>`;
    const stat = opts.statHtml || "";
    const nameClass = im ? "mini-card-name" : "mini-card-name visually-hidden";
    return `
      <button class="mini-card${opts.extraClass ? " " + opts.extraClass : ""}" data-name="${escapeHtml(name)}">
        ${opts.overlayHtml || ""}
        ${art}
        ${im ? `<div class="mini-card-name">${escapeHtml(name)}</div>` : ""}
        ${stat ? `<div class="mini-card-stat">${stat}</div>` : ""}
      </button>`;
  }

  function attachMiniCardClicks(container) {
    container.querySelectorAll(".mini-card, .catalyst-row").forEach((el) => {
      el.addEventListener("click", () => {
        navigateToCard(el.dataset.name);
      });
    });
  }

  // ── Home / Explore ─────────────────────────
  function renderHome() {
    const main = $(".magic-page");
    const recentRange = explore.recent_window_weeks.length
      ? `${explore.recent_window_weeks[0]} → ${explore.recent_window_weeks.at(-1)}`
      : "";
    const priorRange = explore.prior_window_weeks.length
      ? `${explore.prior_window_weeks[0]} → ${explore.prior_window_weeks.at(-1)}`
      : "";

    main.innerHTML = `
      <section class="intro">
        <h1 class="intro-heading">Magic.</h1>
        <p class="intro-body">
          A card-centric explorer for MTG Standard. Built from the weekly
          ladder lists magic.gg publishes &mdash; only decks that hit the
          6-0 cutoff. Not popularity, just what wins. The angle isn't
          archetypes, it's relationships: which cards are the gravity
          wells, which travel together, which only show up when their
          anchor is present.
        </p>
        <div class="dataset-stamp" style="margin-top:18px;"></div>
      </section>

      <div class="search-shell">
        <input class="search-input" type="text" placeholder="search a card&hellip;" autocomplete="off" spellcheck="false">
        <span class="search-status">Indexing&hellip;</span>
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
          <p class="panel-blurb">
            Biggest gainers in main-deck prevalence. The cards a returning
            player should know exist.
          </p>
          <div class="card-strip" id="strip-risen"></div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <h2 class="panel-title">Quietly disappeared</h2>
            <span class="panel-meta">last 8wk vs prior 8wk</span>
          </div>
          <p class="panel-blurb">
            What's fallen off. Don't bother crafting these even if you
            saw them in lists three months ago.
          </p>
          <div class="card-strip" id="strip-disappeared"></div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <h2 class="panel-title">Sideboards are preparing for…</h2>
            <span class="panel-meta">side prevalence rising</span>
          </div>
          <p class="panel-blurb">
            Cards being brought to sideboards more often than they used
            to be. A read on what people are reaching for to answer the
            current meta.
          </p>
          <div class="card-strip" id="strip-side"></div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <h2 class="panel-title">New arrivals that moved a shell</h2>
            <span class="panel-meta">catalyst detection</span>
          </div>
          <p class="panel-blurb">
            New cards whose own play rate is modest but whose lift-shell
            (the cards they travel with) jumped meaningfully when they
            arrived. Possible signal: this card was the missing piece.
            Correlation, not proof.
          </p>
          <div id="strip-catalysts"></div>
        </section>

      </div>
    `;

    renderDatasetStamp();
    setupSearch();

    const pillars = $("#strip-pillars");
    pillars.innerHTML = explore.pillars.map((r) => miniCard(r.name, {
      statHtml: `<strong>${fmtPct(r.recent_centerpiece_prevalence)}</strong> as 3+`,
    })).join("");

    const risen = $("#strip-risen");
    risen.innerHTML = explore.risen.map((r) => miniCard(r.name, {
      statHtml: `<span class="mini-card-delta-pos">${fmtPp(r.delta)}</span> · now ${fmtPct(r.recent)}`,
    })).join("");

    const disappeared = $("#strip-disappeared");
    disappeared.innerHTML = explore.disappeared.map((r) => miniCard(r.name, {
      statHtml: `<span class="mini-card-delta-neg">${fmtPp(r.delta)}</span> · now ${fmtPct(r.recent)}`,
    })).join("");

    const side = $("#strip-side");
    side.innerHTML = explore.side_risers.map((r) => miniCard(r.name, {
      statHtml: `<span class="mini-card-delta-pos">${fmtPp(r.delta)}</span> · ${fmtPct(r.recent)} of sides`,
    })).join("");

    const cat = $("#strip-catalysts");
    cat.innerHTML = explore.catalysts.map((r) => {
      const im = img(r.name, "small");
      const thumb = im ? `<div class="catalyst-thumb"><img src="${im}" alt="" loading="lazy"></div>` : `<div class="catalyst-thumb"></div>`;
      const shellNames = r.shell.map(escapeHtml).join(", ");
      return `
        <div class="catalyst-row" data-name="${escapeHtml(r.name)}">
          ${thumb}
          <div class="catalyst-info">
            <div class="catalyst-name">${escapeHtml(r.name)}</div>
            <div class="catalyst-shell-trace">
              Arrived ${r.first_week} · its shell (${shellNames})
              moved <strong>${fmtPct(r.shell_before)} → ${fmtPct(r.shell_after)}</strong>
              (${fmtPp(r.shell_delta)}). Card itself only ${fmtPct(r.card_main_prevalence)} of decks.
            </div>
          </div>
        </div>`;
    }).join("");

    attachMiniCardClicks(main);
    if (dataReady) setSearchStatus("");
  }

  // ── Card detail ─────────────────────────
  function sparklinePath(trend) {
    if (!trend.length) return "";
    const w = 600;
    const h = 60;
    const max = Math.max(...trend.map(([, hits, tot]) => tot ? hits / tot : 0), 0.001);
    const points = trend.map(([wk, hits, tot], i) => {
      const x = (i / Math.max(trend.length - 1, 1)) * w;
      const y = h - ((tot ? hits / tot : 0) / max) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return points.join(" ");
  }

  function renderCard(slug) {
    const main = $(".magic-page");
    if (!dataReady) {
      main.innerHTML = `<div class="loading">Loading dataset&hellip;</div>`;
      return;
    }
    const name = unslugify(slug);
    if (!name || !cardsByName[name]) {
      main.innerHTML = `
        <button class="detail-back">&larr; back</button>
        <div class="error">Card not found in the dataset.</div>`;
      $(".detail-back").addEventListener("click", navigateHome);
      return;
    }

    const c = cardsByName[name];
    const p = pairs[name];
    const sf = scryfall[name] || {};
    const im = sf.image || sf.image_small || "";

    // Copy histogram (1, 2, 3, 4 copies)
    const hist = c.copy_hist_main || {};
    const histMax = Math.max(...["1","2","3","4"].map((k) => hist[k] || 0), 1);
    const histBars = ["1","2","3","4"].map((k) => {
      const v = hist[k] || 0;
      const pct = (v / histMax) * 100;
      return `<div class="copy-hist-bar${v ? "" : " empty"}" style="height:${Math.max(pct, 3)}%" title="${v} decks ran ${k}"></div>`;
    }).join("");

    // Headline copy summary
    const total = c.main_decks;
    let copySummary = "";
    if (total > 0) {
      const ones = hist["1"] || 0;
      const fours = hist["4"] || 0;
      if (fours > total * 0.7) copySummary = "almost always a 4-of";
      else if (ones > total * 0.6) copySummary = "almost always a 1-of singleton";
      else if (c.centerpiece_decks > c.flex_decks * 1.5) copySummary = "mostly a centerpiece";
      else if (c.flex_decks > c.centerpiece_decks * 1.5) copySummary = "mostly a flex slot";
      else copySummary = "split between centerpiece and flex roles";
    }

    // Sparkline
    const trend = c.weekly_main || [];
    const sideTrend = c.weekly_side || [];
    const sparkPath = sparklinePath(trend);
    const sparkSide = sparklinePath(sideTrend);
    const trendStart = trend.length ? trend[0][0] : "";
    const trendEnd = trend.length ? trend.at(-1)[0] : "";

    const renderStrip = (items, statFn) => {
      if (!items || !items.length) return `<div class="detail-section-empty">none above the noise floor</div>`;
      return `<div class="card-strip">${items.map((r) => miniCard(r.name, {
        extraClass: "companion-card",
        overlayHtml: r.lift !== undefined ? `<div class="companion-lift">×${r.lift.toFixed(1)}</div>` : "",
        statHtml: statFn(r),
      })).join("")}</div>`;
    };

    main.innerHTML = `
      <button class="detail-back">&larr; back to explore</button>

      <div class="card-detail">
        ${im ? `<div class="card-detail-art"><img src="${im}" alt=""></div>` : `<div class="card-detail-art"></div>`}
        <div class="card-detail-info">
          <h1 class="card-detail-name">${escapeHtml(name)}</h1>
          <div class="card-detail-type">${escapeHtml(sf.type_line || "")} ${sf.set ? `· ${sf.set} ${sf.cn}` : ""}</div>

          <div class="card-detail-stat-grid">
            <div class="stat">
              <div class="stat-value">${c.main_decks}</div>
              <div class="stat-label">decks main · ${fmtPct(c.main_prevalence)}</div>
            </div>
            <div class="stat">
              <div class="stat-value">${c.side_decks}</div>
              <div class="stat-label">decks side · ${fmtPct(c.side_prevalence)}</div>
            </div>
            <div class="stat">
              <div class="stat-value">${c.centerpiece_decks}</div>
              <div class="stat-label">as 3+ copies (centerpiece)</div>
            </div>
            <div class="stat">
              <div class="stat-value">${c.flex_decks}</div>
              <div class="stat-label">as 1–2 copies (flex)</div>
            </div>
          </div>

          ${total > 0 ? `
          <div class="sparkline-shell">
            <div class="sparkline-title">Copies when present in main · ${escapeHtml(copySummary)}</div>
            <div class="copy-hist">${histBars}</div>
            <div class="copy-hist-labels">
              <span>1</span><span>2</span><span>3</span><span>4</span>
            </div>
          </div>` : ""}

          ${sparkPath ? `
          <div class="sparkline-shell">
            <div class="sparkline-title">Weekly main-deck prevalence (red) and sideboard (blue)</div>
            <svg class="sparkline" viewBox="0 0 600 60" preserveAspectRatio="none">
              ${sparkSide ? `<path class="side" d="${sparkSide}"></path>` : ""}
              <path d="${sparkPath}"></path>
            </svg>
            <div class="sparkline-axis">
              <span>${trendStart}</span>
              <span>${trendEnd}</span>
            </div>
          </div>` : ""}
        </div>
      </div>

      ${p ? `
        <section class="detail-section">
          <div class="detail-section-header">
            <h3 class="detail-section-title">Cards ${escapeHtml(name)} loves</h3>
            <span class="detail-section-explainer">ranked by lift</span>
          </div>
          <p class="detail-section-blurb">
            Cards that appear with this one much more often than chance would
            predict. The lift number on each thumbnail tells you the multiplier
            over baseline.
          </p>
          ${renderStrip(p.companions, (r) => `<strong>${(r.p_b_given_a*100).toFixed(0)}%</strong> of its decks · ${r.co_decks} together`)}
        </section>

        <section class="detail-section">
          <div class="detail-section-header">
            <h3 class="detail-section-title">Cards this leans on</h3>
            <span class="detail-section-explainer">anchors</span>
          </div>
          <p class="detail-section-blurb">
            Cards that show up in most of this card's decks but where the
            reverse isn't true, they're bigger than this card. Useful for
            "what shell does this live in".
          </p>
          ${renderStrip(p.anchors, (r) => `${(r.p_b_given_a*100).toFixed(0)}% / ${(r.p_a_given_b*100).toFixed(0)}%`)}
        </section>

        <section class="detail-section">
          <div class="detail-section-header">
            <h3 class="detail-section-title">Cards that lean on this</h3>
            <span class="detail-section-explainer">satellites</span>
          </div>
          <p class="detail-section-blurb">
            Cards that mostly only show up when this one is present. If you
            see things here, this card is anchoring something.
          </p>
          ${renderStrip(p.satellites, (r) => `${(r.p_a_given_b*100).toFixed(0)}% / ${(r.p_b_given_a*100).toFixed(0)}%`)}
        </section>
      ` : `
        <div class="detail-section-empty">
          Below the support floor (${meta.min_support_decks} decks), not enough appearances to compute reliable companions.
        </div>
      `}
    `;

    $(".detail-back").addEventListener("click", navigateHome);
    attachMiniCardClicks(main);
  }

  // ── Boot ─────────────────────────
  window.addEventListener("hashchange", renderRoute);

  loadInitial().then(() => {
    renderRoute();
    loadFull();  // background-load full data
  }).catch((err) => {
    document.querySelector(".magic-page").innerHTML =
      `<div class="error">Couldn't load the dataset. ${escapeHtml(String(err))}</div>`;
  });
})();
