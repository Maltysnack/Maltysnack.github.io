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
  let stories = null;     // hand-curated narratives, loaded with the initial bundle
  // Synergy scores are computed ad-hoc from raw decks against the current
  // selection + bans, then cached. Cleared whenever selection or bans change.
  let _scoresMap = null;
  let _scoresKey = "";

  // ── Selection + Bans (mirrored to URL hash #sel=a,b&ban=x,y&t=cards) ──
  let selection = parseHashList("sel");
  let bans = parseHashList("ban");
  let showLands = false;     // lands toggle near "what fits" header
  let searchQuery = "";      // live search input value, drives results strip
  let viewMode = "fits";     // "fits" (top-fit recs) or "off-meta" (lift inversion)
  let breakdownFor = null;   // which card has its score-breakdown popover open
  let shapePanelOpen = false; // selection shape settings panel toggle
  let tagFilter = null;      // optional tag to filter recs to (e.g. "removal")
  let tagBoosts = new Set(); // tags currently boosted (multi-select)
  let tagInteractionMode = "boost"; // "boost" or "filter"

  // Top-level tab. "cards" = explorer, "pros" = pro deck list, "stories" = digest.
  const VALID_TABS = ["cards", "pros", "stories"];
  let currentTab = (function () {
    const m = (location.hash || "").match(/[#&]t=([^&]*)/);
    const t = m && decodeURIComponent(m[1]);
    return VALID_TABS.includes(t) ? t : "cards";
  })();

  function parseHashList(key) {
    const m = (location.hash || "").match(new RegExp("[#&]" + key + "=([^&]*)"));
    if (!m) return [];
    return m[1].split(",").filter(Boolean).map(decodeURIComponent);
  }
  function writeHash() {
    const parts = [];
    if (currentTab && currentTab !== "cards") parts.push("t=" + encodeURIComponent(currentTab));
    if (selection.length) parts.push("sel=" + selection.map(encodeURIComponent).join(","));
    if (bans.length) parts.push("ban=" + bans.map(encodeURIComponent).join(","));
    const newHash = parts.length ? "#" + parts.join("&") : "";
    if (newHash !== location.hash) {
      history.replaceState(null, "", location.pathname + newHash);
    }
  }
  function setTab(t) {
    if (!VALID_TABS.includes(t) || t === currentTab) return;
    currentTab = t;
    // Tab change closes any open per-card popover so it doesn't dangle
    breakdownFor = null;
    writeHash();
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  // Backward compat shim: old name
  function writeSelectionToHash() { writeHash(); }
  function invalidateScores() { _scoresMap = null; _scoresKey = ""; }

  function selectionAdd(name) {
    if (!name || selection.includes(name)) return;
    bans = bans.filter((n) => n !== name);   // adding to selection unbans
    selection = [...selection, name];
    searchQuery = "";                         // clear the search so the user sees the new state
    invalidateScores();
    writeHash();
    render();
  }
  function selectionRemove(name) {
    selection = selection.filter((n) => n !== name);
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
  const CURVE_K = 8;             // bumped from 4.5: with per-tier blend, raw values are smaller
  const SEMANTIC_CAP = 30;
  const COVERAGE_POWER = 2;      // partial-match weight = (k/n)^COVERAGE_POWER

  // Per-tier scoring. Each tier computes its own conditional probability and
  // robustness against its own deck pool, then we blend with TIER_BLEND_WEIGHTS.
  // PT Top 8 gets a substantial vote even with tiny sample because that's the
  // signal the user cares about most. Adjustable from one place.
  const TIER_WEIGHT_MAP = {
    1:  "ladder",
    3:  "premier",
    5:  "pt_main",
    10: "pt_top8",
  };
  const TIER_BLEND_WEIGHTS = {
    ladder:   0.15,
    premier:  0.20,
    pt_main:  0.30,
    pt_top8:  0.35,
  };
  // Per-tier robustness reference: full-confidence threshold scales with
  // typical tier size. 2 of 8 PT Top 8 decks should feel substantial; 2 of
  // 600 ladder decks should not.
  const TIER_ROBUSTNESS_REF = {
    ladder:   100,
    premier:  15,
    pt_main:  10,
    pt_top8:  3,
  };

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

  // Recency decay within the pair-stats window. Decks closer to "now" get a
  // small bonus over decks at the edge of the 12-week window. Helps the score
  // respond to meta shifts faster when a new set drops without changing the
  // window itself. Linear: 1.25x at the most-recent week, 1.0x at cutoff.
  // Stored as a function of week string so we can cache.
  let _weekDecayCache = null;
  function deckRecencyMult(week) {
    if (!week || !meta) return 1;
    if (!_weekDecayCache) {
      _weekDecayCache = new Map();
      const cutoff = meta.pair_window_first_week;
      const last = meta.last_week;
      if (cutoff && last) {
        const cutMs = new Date(cutoff).getTime();
        const lastMs = new Date(last).getTime();
        const span = lastMs - cutMs;
        // Pre-fill nothing; computed on demand
        _weekDecayCache.set("__span__", span);
        _weekDecayCache.set("__cut__", cutMs);
      }
    }
    const span = _weekDecayCache.get("__span__");
    const cut = _weekDecayCache.get("__cut__");
    if (!span || !cut) return 1;
    const t = new Date(week).getTime();
    const frac = Math.max(0, Math.min(1, (t - cut) / span));
    return 1 + 0.25 * frac;
  }

  // Compute one tier's signal for every candidate.
  // Returns Map(name -> {pCond, robustness, signal, coDecks, decksWithSel, tierLift}).
  // Now also computes per-tier baseline prevalence for "tier lift" (pCond / pBase
  // within this tier). Exposes how "selection-specific" a card is vs. just being
  // a popular tier-wide pick.
  function computeTierSignal(tierDecks, tier) {
    const result = new Map();
    if (!tierDecks.length || !selection.length) return result;

    const selSet = new Set(selection);
    const n = selection.length;

    // Per-tier baseline: weighted prevalence of each card in this tier's pool
    let tierTotalW = 0;
    const tierBaseW = new Map();
    for (const d of tierDecks) {
      const w = (d.weight || 1) * deckRecencyMult(d.week);
      tierTotalW += w;
      for (const c of d.main || []) {
        tierBaseW.set(c.name, (tierBaseW.get(c.name) || 0) + w);
      }
    }

    // Selection-aware co-occurrence
    let totalSelW = 0;
    const candidateCo = new Map();
    for (const d of tierDecks) {
      const main = d.main || [];
      const names = new Set(main.map((c) => c.name));
      let matched = 0;
      for (const s of selection) if (names.has(s)) matched++;
      if (matched === 0) continue;
      const selFrac = matched / n;
      const recencyMult = deckRecencyMult(d.week);
      const matchWeight = (d.weight || 1) * recencyMult * Math.pow(selFrac, COVERAGE_POWER);
      totalSelW += matchWeight;
      for (const c of main) {
        if (selSet.has(c.name)) continue;
        candidateCo.set(c.name, (candidateCo.get(c.name) || 0) + matchWeight);
      }
    }
    if (totalSelW === 0) return result;

    const ref = TIER_ROBUSTNESS_REF[tier] || 100;
    for (const [name, coW] of candidateCo) {
      const pCond = coW / totalSelW;
      const robustness = Math.min(Math.sqrt(coW / ref), 1);
      const signal = pCond * robustness;
      // Within-tier lift: how much above the tier's own baseline is this card?
      // pCond/pBase. >1 means specifically tied to the selection; ~1 means
      // just popular in the tier regardless of selection.
      const pBaseTier = (tierBaseW.get(name) || 0) / Math.max(tierTotalW, 1);
      const tierLift = pBaseTier > 0 ? pCond / pBaseTier : 0;
      result.set(name, { pCond, robustness, signal, coDecks: coW, tierLift, pBaseTier });
    }
    return result;
  }

  // Compute the score map for the current selection + bans. Caches by key.
  // Returns Map(name -> { score, breakdown }).
  //
  // Per-tier-then-blend approach (option D from the design discussion):
  //   1. Split the recent, ban-filtered deck pool into ladder / premier /
  //      pt_main / pt_top8 sub-pools by deck.weight.
  //   2. For each tier, compute (pCond, robustness, signal) for every
  //      candidate.
  //   3. Blend tier signals with TIER_BLEND_WEIGHTS, renormalised across
  //      tiers that actually have data for the pair. So a card in PT Top 8
  //      decks but not in ladder doesn't get its score watered down by an
  //      absent-ladder zero; the PT signal carries it.
  //   4. Apply novelty discount on overall baseline + tag-balance multiplier.
  //   5. Map raw blend through the asymptotic curve.
  function computeScoreMap() {
    if (!decks) return null;
    const key = JSON.stringify({ s: selection, b: bans, m: viewMode, t: [...tagBoosts] });
    if (_scoresKey === key && _scoresMap) return _scoresMap;
    _scoresKey = key;

    const cutoff = (meta && meta.pair_window_first_week) || "";
    const banSet = new Set(bans);

    // Pool: recent decks that don't contain any banned card, split by tier
    const tierDecks = { ladder: [], premier: [], pt_main: [], pt_top8: [] };
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
      const tier = TIER_WEIGHT_MAP[d.weight || 1];
      if (tier) tierDecks[tier].push(d);
    }

    // Baseline prevalence across the full pool, for novelty
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

    // Per-tier signals
    const tierSignals = {
      ladder:  computeTierSignal(tierDecks.ladder,  "ladder"),
      premier: computeTierSignal(tierDecks.premier, "premier"),
      pt_main: computeTierSignal(tierDecks.pt_main, "pt_main"),
      pt_top8: computeTierSignal(tierDecks.pt_top8, "pt_top8"),
    };
    // All candidates we have any tier signal for
    const allCandidates = new Set();
    for (const tier in tierSignals) for (const n of tierSignals[tier].keys()) allCandidates.add(n);

    const profile = selectionTagProfile();

    for (const name of allCandidates) {
      if (banSet.has(name)) continue;
      if (!isLegal(name)) continue;
      const baseW = baseline.get(name) || 0;
      const pBase = baseW / Math.max(totalW, 1);

      // Blend: tiers with data each contribute their weight, normalised to
      // the active set so absent tiers don't dilute.
      let blended = 0, weightUsed = 0;
      const tierBreakdown = {};
      for (const [tier, w] of Object.entries(TIER_BLEND_WEIGHTS)) {
        const entry = tierSignals[tier].get(name);
        if (!entry) continue;
        blended += entry.signal * w;
        weightUsed += w;
        tierBreakdown[tier] = {
          pCond: Math.round(entry.pCond * 1000) / 1000,
          coDecks: Math.round(entry.coDecks * 10) / 10,
          tierLift: Math.round(entry.tierLift * 100) / 100,
          pBaseTier: Math.round(entry.pBaseTier * 1000) / 1000,
        };
      }
      if (weightUsed === 0) continue;
      blended /= weightUsed;  // normalise to active tiers

      // Off-meta lens: re-shape the blended signal to peak at mid-prevalence
      let raw, label;
      if (viewMode === "off-meta") {
        let mid = 0;
        if (blended >= 0.04 && blended <= 0.40) {
          mid = 1 - Math.abs(blended - 0.18) / 0.22;
        }
        const novelty = 1 / (1 + (NOVELTY_K * 0.6) * pBase);
        raw = mid * novelty;
        label = "off-meta";
      } else {
        const novelty = 1 / (1 + NOVELTY_K * pBase);
        raw = blended * novelty;
        label = "fits";
      }

      const tagMult = tagBalanceMultiplier(name, profile);
      raw *= tagMult;

      if (tagBoosts.size) {
        const cTags = new Set(tagsFor(name));
        let matches = 0;
        for (const t of tagBoosts) if (cTags.has(t)) matches++;
        if (matches > 0) raw *= (1 + 0.5 * matches);
        else raw *= 0.85;
      }

      const score = Math.round(Math.min(99, Math.max(0, 99 * (1 - Math.exp(-CURVE_K * raw)))));
      if (score > 0) {
        scores.set(name, {
          score,
          mode: label,
          breakdown: {
            blended: Math.round(blended * 1000) / 1000,
            pBase: Math.round(pBase * 1000) / 1000,
            tagMult: Math.round(tagMult * 100) / 100,
            tiers: tierBreakdown,
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
    // Selection / ban chips live above all tabs except Stories. Stories is a
    // reading view; the chip strip clutters it without offering useful action.
    const showSelectionStrip = currentTab !== "stories";
    root.innerHTML = `
      ${renderPageHeader()}
      ${renderTabNav()}
      ${showSelectionStrip ? renderSelection() : ""}
      ${currentTab === "cards" ? renderMatchingListsTag() : ""}
      ${renderTabContent()}
      <footer class="dataset-stamp" id="dataset-stamp"></footer>
    `;
    fillDatasetStamp();
    if (currentTab === "cards" || currentTab === "pros") wireSearch();
    wireTabNav();
    wireCardClicks();
  }

  function renderPageHeader() {
    return `
      <header class="page-header">
        <h1 class="page-title">Magic: The Gathering</h1>
        <div class="page-sub">Standard meta explorer</div>
        <div class="format-disclosure" title="All input data comes from magic.gg Bo3 Traditional ranked ladder, premier events (RCQ, RC) and the Pro Tour. Bo1 ladder is not included. This biases the picture toward control and midrange shells; pure aggro and combo are typically over-represented in Bo1.">
          <span class="format-badge">Bo3 only</span>
          <span class="format-note">ladder + premier + Pro Tour</span>
        </div>
      </header>
    `;
  }

  function renderTabNav() {
    const tab = (id, label, sub) => {
      const active = currentTab === id ? " active" : "";
      return `<button class="tab-btn${active}" data-tab="${id}">
        <span class="tab-label">${escapeHtml(label)}</span>
        <span class="tab-sub">${escapeHtml(sub)}</span>
      </button>`;
    };
    return `
      <nav class="tab-nav" aria-label="Sections">
        ${tab("cards", "Cards", "search, synergies, landing")}
        ${tab("pros", "Pro decks", "premier + Pro Tour lists")}
        ${tab("stories", "Stories", "clusters, digest, narrative")}
      </nav>
    `;
  }

  function renderTabContent() {
    if (currentTab === "pros") return renderProsTab();
    if (currentTab === "stories") return renderStoriesTab();
    return renderCardsTab();
  }

  function renderCardsTab() {
    return `
      ${renderSearch()}
      ${renderSearchResultsSection()}
      ${selection.length ? renderRecommendations() : renderLanding()}
    `;
  }

  function renderProsTab() {
    if (!decks) {
      return `
        ${renderSearch()}
        ${renderSearchResultsSection()}
        <div class="loading">loading the deck pool&hellip;</div>
      `;
    }
    const proDecks = decks.filter((d) => (d.weight || 1) >= 3);
    const banSet = new Set(bans);
    const filtered = proDecks.filter((d) => {
      const names = new Set((d.main || []).map((c) => c.name));
      if (bans.length && [...names].some((n) => banSet.has(n))) return false;
      if (selection.length && !selection.every((n) => names.has(n))) return false;
      return true;
    });
    filtered.sort((a, b) => ((b.weight || 1) - (a.weight || 1)) || (b.week || "").localeCompare(a.week || ""));
    _matchingCache = filtered;

    const subParts = [];
    subParts.push(`${filtered.length} list${filtered.length === 1 ? "" : "s"}`);
    if (selection.length) subParts.push("containing your selection");
    if (bans.length) subParts.push("no banned cards");

    if (!filtered.length) {
      const reason = selection.length
        ? "no pro list contains all your selected cards together"
        : "no pro decks in the current window";
      return `
        ${renderSearch()}
        ${renderSearchResultsSection()}
        <section class="sec">
          <header class="sec-header">
            <h2 class="sec-title">Pro decks</h2>
            <span class="sec-sub">no matching lists</span>
          </header>
          <div class="rec-empty">${reason}</div>
        </section>
      `;
    }

    return `
      ${renderSearch()}
      ${renderSearchResultsSection()}
      <section class="sec">
        <header class="sec-header">
          <h2 class="sec-title">Pro decks</h2>
          <span class="sec-sub">${escapeHtml(subParts.join(" · "))}</span>
        </header>
        <div class="lists-body">${filtered.map((d, i) => renderDeck(d, i)).join("")}</div>
      </section>
    `;
  }

  // Kind labels for the story-kind badge
  const STORY_KIND_META = {
    "returning-cluster": { label: "returning cluster" },
    "copy-conversion":   { label: "4-of conversion" },
    "post-pt-shift":     { label: "post-PT shift" },
    "returning-card":    { label: "returning card" },
    "pt-vs-ladder":      { label: "PT vs ladder" },
    "color-gap":         { label: "color gap" },
  };

  function statusLabel(s) {
    if (s === "resolved")  return "resolved";
    if (s === "withdrawn") return "withdrawn";
    return "active";
  }

  function renderStoriesTab() {
    if (!stories || !stories.stories || !stories.stories.length) {
      return `
        <section class="sec stories-sec">
          <header class="sec-header">
            <h2 class="sec-title">Stories</h2>
            <span class="sec-sub">no stories this week</span>
          </header>
          <div class="stories-intro"><p>Detector found nothing worth surfacing this week.</p></div>
        </section>
      `;
    }

    // Current week = max week across all stories, unless explicitly set
    const currentWeek = stories.current_week || stories.stories.reduce((acc, s) => (s.week || "") > acc ? s.week : acc, "");
    const current = stories.stories.filter((s) => s.week === currentWeek);
    const older   = stories.stories.filter((s) => s.week !== currentWeek);

    const currentHtml = current.length
      ? `<div class="stories-list">${current.map(renderStory).join("")}</div>`
      : `<div class="rec-empty">no new stories this week</div>`;

    return `
      <section class="sec stories-sec">
        <header class="sec-header">
          <h2 class="sec-title">Stories</h2>
          <span class="sec-sub">week of ${fmtDate(currentWeek)} · ${current.length} active</span>
        </header>
        <div class="stories-header">
          <div class="stories-window">${escapeHtml(stories.window_label || "")}</div>
        </div>
        ${currentHtml}
        ${renderStoriesArchive(older)}
      </section>
    `;
  }

  function renderStoriesArchive(older) {
    if (!older.length) return "";
    // Group by week, sort weeks desc
    const byWeek = {};
    for (const s of older) {
      const w = s.week || "unknown";
      if (!byWeek[w]) byWeek[w] = [];
      byWeek[w].push(s);
    }
    const weeks = Object.keys(byWeek).sort().reverse();
    const totalWord = older.length === 1 ? "story" : "stories";
    const weekWord = weeks.length === 1 ? "week" : "weeks";
    return `
      <details class="stories-archive">
        <summary class="archive-toggle">${older.length} ${totalWord} from ${weeks.length} previous ${weekWord}</summary>
        <div class="archive-content">
          ${weeks.map((w) => {
            const ss = byWeek[w];
            const word = ss.length === 1 ? "story" : "stories";
            return `
              <details class="archive-week" open>
                <summary class="archive-week-head">week of ${fmtDate(w)} · ${ss.length} ${word}</summary>
                <div class="archive-week-list">${ss.map(renderArchivedStory).join("")}</div>
              </details>
            `;
          }).join("")}
        </div>
      </details>
    `;
  }

  function renderArchivedStory(s) {
    const status = s.status || "active";
    return `
      <details class="archive-story" data-story-id="${escapeAttr(s.id || "")}">
        <summary class="archive-story-head">
          <span class="archive-story-status status-${status}">${statusLabel(status)}</span>
          <span class="archive-story-title">${escapeHtml(s.title || "")}</span>
          ${s.summary ? `<span class="archive-story-summary">${escapeHtml(s.summary)}</span>` : ""}
        </summary>
        <div class="archive-story-body">${renderStoryInner(s)}</div>
      </details>
    `;
  }

  function renderStory(s) {
    return `<article class="story" data-story-id="${escapeAttr(s.id || "")}">${renderStoryInner(s)}</article>`;
  }

  function renderStoryInner(s) {
    const kindMeta = STORY_KIND_META[s.kind] || { label: s.kind || "story" };
    const status = s.status || "active";
    const statusBadge = status !== "active"
      ? `<span class="story-status status-${status}">${statusLabel(status)}${s.status_note ? ": " + escapeHtml(s.status_note) : ""}</span>`
      : "";

    const cards = (s.cards || []).filter((n) => scryfall && scryfall[n]);
    const loadBtn = cards.length >= 2 ? `
      <button class="story-load" data-story-load="${escapeAttr(s.id || "")}" title="replace your selection with these cards">
        load into selection
      </button>
    ` : "";
    const cardThumbs = cards.length ? `
      <div class="story-cards-wrap">
        <div class="story-cards">
          ${cards.map((n) => {
            const im = img(n);
            return `<div class="story-card-thumb" role="button" tabindex="0" data-name="${escapeAttr(n)}" data-preview="${escapeAttr(n)}" title="${escapeAttr(n)}">
              ${im ? `<img src="${im}" alt="" loading="lazy">` : `<div class="story-card-noimg">${escapeHtml(n)}</div>`}
              <div class="story-card-name">${escapeHtml(n)}</div>
            </div>`;
          }).join("")}
        </div>
        ${loadBtn}
      </div>
    ` : "";

    const stats = (s.stats || []).length ? `
      <dl class="story-stats">
        ${s.stats.map((st) => `
          <div class="story-stat-row">
            <dt class="story-stat-label">${escapeHtml(st.label || "")}</dt>
            <dd class="story-stat-value">${escapeHtml(st.value || "")}</dd>
          </div>
        `).join("")}
      </dl>
    ` : "";

    const timeline = (s.timeline || []).length ? `
      <div class="story-timeline">
        ${s.timeline.map((t) => `
          <div class="story-timeline-row">
            <span class="story-timeline-period">${escapeHtml(t.period || "")}</span>
            <span class="story-timeline-note">${escapeHtml(t.note || "")}</span>
          </div>
        `).join("")}
      </div>
    ` : "";

    return `
      <header class="story-head">
        <span class="story-kind">${escapeHtml(kindMeta.label)}</span>
        ${statusBadge}
        <h3 class="story-title">${escapeHtml(s.title || "")}</h3>
      </header>
      ${s.summary ? `<p class="story-summary">${escapeHtml(s.summary)}</p>` : ""}
      ${stats}
      ${s.detail ? `<p class="story-detail">${escapeHtml(s.detail)}</p>` : ""}
      ${timeline}
      ${cardThumbs}
    `;
  }

  // Indicator that sits between selection and search, "outside" the selection
  // box but visually anchored to it. Shown only when selection has cards.
  // Non-interactive count indicator. The full list lives on the Pro decks tab.
  function renderMatchingListsTag() {
    if (!selection.length) return "";
    if (!decks) {
      return `<div class="match-tag-row"><span class="match-tag match-tag-empty">checking pro lists&hellip;</span></div>`;
    }
    // Pro decks tab shows weight >= 3 only. The indicator must match that
    // filter, otherwise a ladder-only shell shows "2 pro lists" but the
    // Pro decks tab is empty.
    const pro = matchingDecks().filter((d) => (d.weight || 1) >= 3);
    const ladder = matchingDecks().filter((d) => (d.weight || 1) === 1);
    if (pro.length === 0) {
      const ladderNote = ladder.length ? ` · ${ladder.length} ladder list${ladder.length === 1 ? "" : "s"} match` : "";
      return `<div class="match-tag-row"><span class="match-tag match-tag-empty">no pro list contains all selected cards${ladderNote}</span></div>`;
    }
    return `<div class="match-tag-row"><span class="match-tag match-tag-count">${pro.length} pro list${pro.length === 1 ? "" : "s"} contain${pro.length === 1 ? "s" : ""} your selection</span></div>`;
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
    const hasShape = selection.length > 0;
    const cog = hasShape
      ? `<button class="search-cog ${shapePanelOpen ? "active" : ""}" id="search-cog" title="selection shape & filters" aria-label="open shape and filters">⚙</button>`
      : "";
    return `
      <div class="search-shell">
        <input class="search-input" type="text" placeholder="search…  try t:creature  c:ur  cmc<=3" autocomplete="off" spellcheck="false" value="${escapeAttr(searchQuery)}">
        ${cog}
      </div>
      ${hasShape && shapePanelOpen ? renderShapeWidget() : ""}
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
        ${(explore.pt_picks || []).length ? section(
          "What the pros brought that the ladder hasn't",
          "over-indexed at Pro Tour main vs ladder",
          renderGrid((explore.pt_picks || []).map((r) => {
            const ratioStr = r.ratio_capped >= 999
              ? "ladder 0%"
              : `${r.ratio_capped.toFixed(1)}× ladder`;
            return {
              name: r.name,
              line: `PT ${(r.pt_share * 100).toFixed(0)}% · ${ratioStr}`,
            };
          }))
        ) : ""}
        ${(explore.bridges || []).length ? section(
          "Bridge cards",
          "cards that connect two partners who rarely share decks",
          renderBridges(explore.bridges)
        ) : ""}
        ${section("New arrivals that moved a shell", "catalyst detection",
          renderGrid(explore.catalysts.map((r) => ({
            name: r.name,
            line: `arrived ${fmtDate(r.first_week)} · its shell moved +${(r.shell_delta * 100).toFixed(1)}pp`,
          })))
        )}
      </div>
    `;
  }

  // Bridges have a specific structure: the bridge card + two partners that
  // rarely meet. Render as a row with the bridge thumb on the left and the
  // two partners as small thumbnails to its right.
  function renderBridges(bridges) {
    if (!bridges || !bridges.length) return "";
    return `<div class="bridge-list">${bridges.map((r) => {
      const left = scryfall[r.left];
      const right = scryfall[r.right];
      const leftIm = left ? (left.image_small || left.image || "") : "";
      const rightIm = right ? (right.image_small || right.image || "") : "";
      const im = img(r.name);
      return `<div class="bridge-row" data-name="${escapeAttr(r.name)}" data-preview="${escapeAttr(r.name)}">
        <button class="bridge-main" data-name="${escapeAttr(r.name)}" data-preview="${escapeAttr(r.name)}">
          ${im ? `<img class="bridge-img" src="${im}" alt="">` : `<div class="bridge-img bridge-noimg">${escapeHtml(r.name)}</div>`}
          <div class="bridge-name">${escapeHtml(r.name)}</div>
        </button>
        <div class="bridge-conn">
          <div class="bridge-conn-side">
            ${leftIm ? `<img class="bridge-side-img" src="${leftIm}" alt="" data-preview="${escapeAttr(r.left)}">` : ""}
            <div class="bridge-side-text">
              <div class="bridge-side-name">${escapeHtml(r.left)}</div>
              <div class="bridge-side-pct">${(r.p_left * 100).toFixed(0)}%</div>
            </div>
          </div>
          <div class="bridge-conn-cross">
            cross ${(r.cross_p * 100).toFixed(0)}%
          </div>
          <div class="bridge-conn-side">
            ${rightIm ? `<img class="bridge-side-img" src="${rightIm}" alt="" data-preview="${escapeAttr(r.right)}">` : ""}
            <div class="bridge-side-text">
              <div class="bridge-side-name">${escapeHtml(r.right)}</div>
              <div class="bridge-side-pct">${(r.p_right * 100).toFixed(0)}%</div>
            </div>
          </div>
        </div>
      </div>`;
    }).join("")}</div>`;
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

    // Pro-list browsing happens on the Pro decks tab now. This page is just
    // the recommendations grid.
    return `
      <div class="stacked">
        ${sectionWithToggle(title, subtitle, renderGrid(items))}
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

  // Cache of the most-recently-rendered deck array, so deck-card actions
  // (copy to MTGA, load into selection) can resolve idx -> deck object.
  // Set by renderProsTab.
  let _matchingCache = null;

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
      return `<li class="${inSel ? "deck-line-hit" : ""}"><span class="deck-line-q">${c.qty}</span><button class="deck-line-name" data-name="${escapeAttr(c.name)}" data-preview="${escapeAttr(c.name)}">${escapeHtml(c.name)}</button></li>`;
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
  // Modal copy count from cards.json's copy_hist_main. Returns a short string
  // like "×4" or "×1–2" or "×3–4" reflecting how the card typically plays.
  // Helps the user know if a 95-scoring card is a 4-of staple or a 1-of flex.
  function copyCountHint(name) {
    const c = cardData(name);
    const hist = c && c.copy_hist_main;
    if (!hist) return "";
    const buckets = ["1","2","3","4"].map(k => [k, hist[k] || 0]);
    const total = buckets.reduce((s, [, v]) => s + v, 0);
    if (total < 4) return "";  // too few samples to call
    // Sort buckets by count desc
    buckets.sort((a, b) => b[1] - a[1]);
    const top = buckets[0][1];
    // Modes: which counts have ≥ 70% of the top bucket?
    const modes = buckets.filter(([, v]) => v >= top * 0.7).map(([k]) => parseInt(k)).sort();
    if (modes.length === 1) return `×${modes[0]}`;
    if (modes.length >= 2) {
      const lo = modes[0], hi = modes[modes.length - 1];
      return lo === hi ? `×${lo}` : `×${lo}–${hi}`;
    }
    return "";
  }

  function renderThumb(item) {
    const name = item.name;
    const im = img(name);
    const inSel = selection.includes(name);
    const score = typeof item.score === "number" ? item.score : null;
    const cls = score !== null ? scoreColorClass(score) : "";
    const showBreakdown = breakdownFor === name;
    const copies = score !== null ? copyCountHint(name) : "";
    return `<div class="thumb${inSel ? " in-sel" : ""}${showBreakdown ? " breakdown-open" : ""}" role="button" tabindex="0" data-name="${escapeAttr(name)}" data-preview="${escapeAttr(name)}" title="${escapeAttr(name)}">
      ${im ? `<img class="thumb-img" src="${im}" alt="" loading="lazy">` : `<div class="thumb-img thumb-noimg">${escapeHtml(name)}</div>`}
      ${score !== null ? `<span class="thumb-score ${cls}" data-score-link role="button" tabindex="0">${score}${copies ? `<span class="thumb-copies">${copies}</span>` : ""}</span>` : ""}
      ${showBreakdown ? renderBreakdownPopover(name) : ""}
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
    const tagDelta = b.tagMult > 1.02 ? `+${Math.round((b.tagMult - 1) * 100)}% balance bonus` :
                     b.tagMult < 0.98 ? `−${Math.round((1 - b.tagMult) * 100)}% balance malus` : "";

    // Tier rows: ladder / premier / pt_main / pt_top8
    // Show both per-tier conditional and the in-tier lift (pCond / pBase_tier).
    // Lift > 1.5 marked as "specific" (this card is tied to selection beyond
    // its own tier popularity). Lift ~1 means "just popular in this tier."
    const tierLabel = { ladder: "Ladder", premier: "Premier", pt_main: "PT main", pt_top8: "PT Top 8" };
    const tierRows = ["pt_top8", "pt_main", "premier", "ladder"]
      .filter(t => b.tiers && b.tiers[t])
      .map(t => {
        const row = b.tiers[t];
        const pct = Math.round(row.pCond * 100);
        const liftStr = row.tierLift && row.tierLift > 0
          ? (row.tierLift >= 1.5 ? `×${row.tierLift.toFixed(1)} specific`
             : row.tierLift >= 1.1 ? `×${row.tierLift.toFixed(1)}`
             : `×${row.tierLift.toFixed(1)} ambient`)
          : "";
        return `<div class="bd-tier-row">
          <span class="bd-tier-label">${tierLabel[t]}</span>
          <span class="bd-tier-val">${pct}% <span class="bd-tier-co">(${row.coDecks})</span></span>
          <span class="bd-tier-lift">${liftStr}</span>
        </div>`;
      }).join("");

    return `<div class="bd-popover" data-bd="1">
      <div class="bd-row bd-name">${escapeHtml(name)}</div>
      <div class="bd-row bd-mode">${entry.mode === "off-meta" ? "off-meta lens" : "what-fits lens"}</div>
      ${tagsHtml}
      <div class="bd-tier-list">
        <div class="bd-tier-header">per-tier conditional probability</div>
        ${tierRows}
      </div>
      ${tagDelta ? `<div class="bd-tier-note">${tagDelta}</div>` : ""}
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

  function wireTabNav() {
    $$(".tab-btn").forEach((el) => {
      el.addEventListener("click", () => setTab(el.dataset.tab));
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
    // Click outside any open breakdown popover closes it
    if (breakdownFor) {
      const closeOnOutside = (e) => {
        if (!e.target.closest(".bd-popover") && !e.target.closest("[data-score-link]")) {
          breakdownFor = null;
          document.removeEventListener("click", closeOnOutside, true);
          render();
        }
      };
      setTimeout(() => document.addEventListener("click", closeOnOutside, true), 0);
    }
    // Hover preview wiring (covers grid thumbs AND deck-list rows)
    setupHoverPreview();
    // Bridge rows on the landing
    $$(".bridge-main").forEach((el) => {
      el.addEventListener("click", () => selectionToggle(el.dataset.name));
    });
    $$(".bridge-side-img").forEach((el) => {
      el.addEventListener("click", () => selectionToggle(el.dataset.preview));
    });
    // Story-card thumbs (Stories tab): click adds to selection, then bounce to Cards tab
    $$(".story-card-thumb").forEach((el) => {
      el.addEventListener("click", () => {
        selectionAdd(el.dataset.name);
        setTab("cards");
      });
      el.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        selectionAdd(el.dataset.name);
        setTab("cards");
      });
    });
    // "Load into selection" button on stories: replace selection with the
    // story's full card list, then jump to Cards tab.
    $$("[data-story-load]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = el.dataset.storyLoad;
        const story = stories && stories.stories && stories.stories.find((s) => s.id === id);
        if (!story || !story.cards || !story.cards.length) return;
        const valid = story.cards.filter((n) => scryfall && scryfall[n]);
        if (!valid.length) return;
        if (selection.length && !confirm(`Replace your current selection (${selection.length} card${selection.length === 1 ? "" : "s"}) with the ${valid.length}-card shell from this story?`)) return;
        selection = [...new Set(valid)];
        bans = bans.filter((n) => !selection.includes(n));
        invalidateScores();
        writeHash();
        setTab("cards");
        if (currentTab === "cards") render();  // setTab no-ops if already there
      });
    });
    // Settings cog opens / closes the selection shape panel
    const cog = $("#search-cog");
    if (cog) cog.addEventListener("click", () => {
      shapePanelOpen = !shapePanelOpen;
      render();
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
    // stories.json is optional; if it 404s we just hide the Stories tab content
    const results = await Promise.all([
      loadJson("meta"),
      loadJson("explore"),
      loadJson("scryfall"),
      loadJson("stories").catch(() => null),
    ]);
    [meta, explore, scryfall, stories] = results;
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

  // ── Hover preview ──
  // Single floating element shows a big version of any card you hover over.
  // Works for grid thumbs and pro-list card names. Positions itself near the
  // hovered element, flipping side to stay in viewport.
  let _previewEl = null;
  function getPreviewEl() {
    if (_previewEl) return _previewEl;
    _previewEl = document.createElement("div");
    _previewEl.className = "card-preview";
    _previewEl.style.display = "none";
    document.body.appendChild(_previewEl);
    return _previewEl;
  }
  function positionPreview(rect) {
    const el = _previewEl;
    if (!el) return;
    const pw = 280;        // matches CSS width
    const ph = 391;        // 488/680 aspect ratio
    const margin = 12;
    const vw = window.innerWidth, vh = window.innerHeight;
    // Prefer right side of element
    let left = rect.right + margin;
    if (left + pw > vw - margin) left = rect.left - pw - margin;
    if (left < margin) left = Math.max(margin, vw - pw - margin);
    let top = rect.top + (rect.height / 2) - (ph / 2);
    if (top + ph > vh - margin) top = vh - ph - margin;
    if (top < margin) top = margin;
    el.style.left = left + "px";
    el.style.top = top + "px";
  }
  function showPreview(name, anchor) {
    const sf = scryfall && scryfall[name];
    if (!sf) return;
    const src = sf.image || sf.image_small;
    if (!src) return;
    const el = getPreviewEl();
    el.innerHTML = `<img src="${src}" alt="">`;
    el.style.display = "block";
    positionPreview(anchor.getBoundingClientRect());
  }
  function hidePreview() {
    if (_previewEl) _previewEl.style.display = "none";
  }
  // Delegated mouseover/mouseout. Re-binding per render would be needed
  // wireCardClicks runs each render, but mouseover delegation can be on body
  // and survive across renders. So this only attaches once.
  let _previewBound = false;
  function setupHoverPreview() {
    if (_previewBound) return;
    _previewBound = true;
    document.body.addEventListener("mouseover", (e) => {
      const tgt = e.target.closest("[data-preview]");
      if (tgt) showPreview(tgt.dataset.preview, tgt);
    });
    document.body.addEventListener("mouseout", (e) => {
      const tgt = e.target.closest("[data-preview]");
      if (!tgt) return;
      // Only hide if moving outside the previewable element entirely
      const to = e.relatedTarget;
      if (to && tgt.contains(to)) return;
      hidePreview();
    });
    // Also hide on scroll so it doesn't dangle in the wrong place
    window.addEventListener("scroll", hidePreview, { passive: true });
  }

  // ── Boot ──
  window.addEventListener("hashchange", () => {
    selection = parseHashList("sel");
    bans = parseHashList("ban");
    const m = (location.hash || "").match(/[#&]t=([^&]*)/);
    const t = m && decodeURIComponent(m[1]);
    if (VALID_TABS.includes(t)) currentTab = t;
    else currentTab = "cards";
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
