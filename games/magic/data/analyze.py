#!/usr/bin/env python3
"""Compute card-level stats from decks_raw.json.

All counts are WEIGHTED by deck.weight (ladder=1, premier=3, PT=5, Top8=10).
Cards get a popularity tier based on their weighted centerpiece prevalence.

Outputs:
  cards.json:    per-card weighted stats, tier, copy histogram, weekly trends
  pairs.json:    top spell-companions / satellites / anchors by weighted lift
  explore.json:  pillars, recently risen, quietly disappeared, side risers,
                 set-anchored catalysts
  meta.json:     dataset summary
"""

import json
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).parent
RAW = HERE / "decks_raw.json"
SCRYFALL = HERE / "scryfall.json"

MIN_SUPPORT = 30           # weighted-deck floor for pair stats and trend data
PAIR_FLOOR = 8             # weighted co-occurrence floor for any pair (lower for recency)
TOP_N_PAIRS = 16           # how many to keep per relationship strip
RECENT_WEEKS = 8           # window for "recent" panels (risen / disappeared)
PAIR_RECENT_WEEKS = 12     # synergy score window: pair stats only count last 12 weeks
NEW_ARRIVAL_WEEKS = 30     # catalyst candidate window
NEW_ARRIVAL_MIN_DECKS = 10 # weighted-deck minimum for catalyst eligibility
CENTERPIECE_THRESHOLD = 3  # 3+ copies = centerpiece

# Tier thresholds, on weighted centerpiece prevalence (excluding basic lands).
# Absolute thresholds preserve cross-time meaning per design discussion.
TIER_BOUNDARIES = [
    (0.10, "defines"),
    (0.05, "driving"),
    (0.02, "major"),
    (0.005, "played"),
    (0.001, "fringe"),
]

BASIC_LANDS = {"Plains", "Island", "Swamp", "Mountain", "Forest", "Wastes"}


def load_decks():
    return json.loads(RAW.read_text())


def load_land_set() :
    """Names of every card whose Scryfall type_line includes 'Land'.
    Lands are excluded from tier classification and from explore panels:
    "Steam Vents defines the meta" is technically true but useless."""
    if not SCRYFALL.exists():
        return set(BASIC_LANDS)
    sf = json.loads(SCRYFALL.read_text())
    return {n for n, m in sf.items()
            if isinstance(m, dict) and "Land" in (m.get("type_line", "") or "")} | BASIC_LANDS


def tier_for(centerpiece_prevalence: float, name: str, lands) -> str:
    if name in lands:
        return None
    for threshold, label in TIER_BOUNDARIES:
        if centerpiece_prevalence >= threshold:
            return label
    return "rare"


def main():
    decks = load_decks()
    n_decks = len(decks)
    total_weight = sum(d["weight"] for d in decks)
    lands = load_land_set()

    main_w = defaultdict(float)         # weighted decks containing card in main
    side_w = defaultdict(float)
    centerpiece_w = defaultdict(float)
    flex_w = defaultdict(float)
    main_copies = defaultdict(list)     # raw copy counts (unweighted; for the histogram)
    by_week_main_w = defaultdict(lambda: defaultdict(float))
    by_week_side_w = defaultdict(lambda: defaultdict(float))
    week_total_w = defaultdict(float)
    first_week = {}

    deck_main_sets = []  # (set of card names, weight) for pair co-occurrence (RECENT only)

    # Compute the recency cutoff first by sorting all weeks
    all_weeks = sorted({d.get("week", "") for d in decks if d.get("week")})
    pair_cutoff_week = all_weeks[-PAIR_RECENT_WEEKS] if len(all_weeks) >= PAIR_RECENT_WEEKS else (all_weeks[0] if all_weeks else "")

    # Recent prevalence (12-week window) for the synergy score's novelty discount
    recent_main_w = defaultdict(float)
    recent_total_w = 0.0

    for deck in decks:
        w = deck["weight"]
        wk = deck.get("week", "")
        week_total_w[wk] += w
        m = {c["name"]: c["qty"] for c in deck.get("main", [])}
        s = {c["name"]: c["qty"] for c in deck.get("side", [])}

        for name, qty in m.items():
            main_w[name] += w
            main_copies[name].append(qty)
            by_week_main_w[wk][name] += w
            if qty >= CENTERPIECE_THRESHOLD:
                centerpiece_w[name] += w
            else:
                flex_w[name] += w
            if name not in first_week or wk < first_week[name]:
                first_week[name] = wk

        for name in s:
            side_w[name] += w
            by_week_side_w[wk][name] += w
            if name not in first_week or wk < first_week[name]:
                first_week[name] = wk

        # Pair stats and recent prevalence: only count decks in the recent window
        if wk and wk >= pair_cutoff_week:
            deck_main_sets.append((set(m), w))
            recent_total_w += w
            for name in m:
                recent_main_w[name] += w

    weeks_sorted = sorted(w for w in week_total_w if w)

    # ── per-card aggregates ──
    cards = {}
    all_names = set(main_w) | set(side_w)
    for name in all_names:
        copies = main_copies.get(name, [])
        copy_hist = Counter(copies)
        cp_prev = centerpiece_w[name] / total_weight
        recent_prev = (recent_main_w[name] / recent_total_w) if recent_total_w else 0
        cards[name] = {
            "name": name,
            "main_decks": int(round(main_w[name])),
            "recent_main_decks": int(round(recent_main_w[name])),
            "side_decks": int(round(side_w[name])),
            "centerpiece_decks": int(round(centerpiece_w[name])),
            "flex_decks": int(round(flex_w[name])),
            "main_prevalence": main_w[name] / total_weight,
            "recent_main_prevalence": recent_prev,  # used by synergy score
            "centerpiece_prevalence": cp_prev,
            "flex_prevalence": flex_w[name] / total_weight,
            "side_prevalence": side_w[name] / total_weight,
            "avg_copies_main": (sum(copies) / len(copies)) if copies else 0,
            "copy_hist_main": {str(k): copy_hist[k] for k in sorted(copy_hist)},
            "first_week": first_week.get(name, ""),
            "tier": tier_for(cp_prev, name, lands),
        }

    # raw any_decks count (unweighted, for sample-size context)
    any_count = Counter()
    for deck in decks:
        seen = {c["name"] for c in deck.get("main", [])}
        seen |= {c["name"] for c in deck.get("side", [])}
        for name in seen:
            any_count[name] += 1
    for name, c in cards.items():
        c["any_decks"] = any_count[name]

    # ── weekly trend (for charts) ──
    for name, c in cards.items():
        if c["main_decks"] + c["side_decks"] >= MIN_SUPPORT:
            tm, ts = [], []
            for wk in weeks_sorted:
                tot = week_total_w[wk]
                tm.append([wk, round(by_week_main_w[wk].get(name, 0), 2), round(tot, 2)])
                ts.append([wk, round(by_week_side_w[wk].get(name, 0), 2), round(tot, 2)])
            c["weekly_main"] = tm
            c["weekly_side"] = ts

    # ── pair stats: weighted lift, RECENT 12-WEEK WINDOW ONLY ──
    # eligible = cards with enough recent appearances to warrant pair stats.
    # We use a lower floor than MIN_SUPPORT because the recent window is smaller.
    RECENT_MIN = max(8, MIN_SUPPORT // 4)
    eligible = [n for n, c in cards.items() if c["recent_main_decks"] >= RECENT_MIN]
    eligible_set = set(eligible)
    co_w = defaultdict(lambda: defaultdict(float))
    for s, w in deck_main_sets:
        relevant = [c for c in s if c in eligible_set]
        for i, a in enumerate(relevant):
            for b in relevant[i + 1:]:
                co_w[a][b] += w
                co_w[b][a] += w

    pairs = {}
    for a in eligible:
        pa = recent_main_w[a] / recent_total_w if recent_total_w else 0
        if pa == 0:
            continue
        scored = []
        for b, ab_w in co_w[a].items():
            if ab_w < PAIR_FLOOR:
                continue
            pb = recent_main_w[b] / recent_total_w
            pab = ab_w / recent_total_w
            lift = pab / (pa * pb) if pa * pb > 0 else 0
            p_b_given_a = ab_w / recent_main_w[a] if recent_main_w[a] else 0
            p_a_given_b = ab_w / recent_main_w[b] if recent_main_w[b] else 0
            scored.append({
                "name": b,
                "co_decks": int(round(ab_w)),
                "lift": round(lift, 3),
                "p_b_given_a": round(p_b_given_a, 3),
                "p_a_given_b": round(p_a_given_b, 3),
            })

        companions = sorted(scored, key=lambda r: r["lift"], reverse=True)[:TOP_N_PAIRS]
        satellites = sorted(
            [r for r in scored if r["p_a_given_b"] - r["p_b_given_a"] > 0.2],
            key=lambda r: r["p_a_given_b"] - r["p_b_given_a"],
            reverse=True,
        )[:TOP_N_PAIRS]
        anchors = sorted(
            [r for r in scored if r["p_b_given_a"] - r["p_a_given_b"] > 0.2],
            key=lambda r: r["p_b_given_a"] - r["p_a_given_b"],
            reverse=True,
        )[:TOP_N_PAIRS]
        pairs[a] = {"companions": companions, "satellites": satellites, "anchors": anchors}

    # ── explore panels ──
    recent = weeks_sorted[-RECENT_WEEKS:]
    prior = weeks_sorted[-2 * RECENT_WEEKS:-RECENT_WEEKS]

    def window_prevalence(card, weeks, source):
        tot = sum(week_total_w[w] for w in weeks)
        if tot == 0:
            return 0
        hits = sum(source[w].get(card, 0) for w in weeks)
        return hits / tot

    pillars, risen, disappeared = [], [], []
    for name, c in cards.items():
        if name in lands:
            continue  # lands are excluded from explore panels
        if c["main_decks"] + c["side_decks"] < MIN_SUPPORT:
            continue
        rc = window_prevalence(name, recent, by_week_main_w)
        pr = window_prevalence(name, prior, by_week_main_w)
        delta = rc - pr
        pillars.append({
            "name": name,
            "recent_centerpiece_prevalence": round(c["centerpiece_prevalence"], 4),
            "recent_main_prevalence": round(rc, 4),
            "tier": c.get("tier"),
        })
        risen.append({"name": name, "delta": round(delta, 4),
                      "recent": round(rc, 4), "prior": round(pr, 4)})
        disappeared.append({"name": name, "delta": round(delta, 4),
                            "recent": round(rc, 4), "prior": round(pr, 4)})

    pillars.sort(key=lambda r: r["recent_centerpiece_prevalence"], reverse=True)
    risen.sort(key=lambda r: r["delta"], reverse=True)
    disappeared.sort(key=lambda r: r["delta"])

    side_risers = []
    for name, c in cards.items():
        if c["side_decks"] < MIN_SUPPORT:
            continue
        rs = window_prevalence(name, recent, by_week_side_w)
        ps = window_prevalence(name, prior, by_week_side_w)
        delta = rs - ps
        if delta <= 0:
            continue
        side_risers.append({"name": name, "delta": round(delta, 4),
                            "recent": round(rs, 4), "prior": round(ps, 4)})
    side_risers.sort(key=lambda r: r["delta"], reverse=True)

    # ── catalyst detection ──
    catalysts = []
    cutoff_week = weeks_sorted[-NEW_ARRIVAL_WEEKS] if len(weeks_sorted) >= NEW_ARRIVAL_WEEKS else weeks_sorted[0]
    for name, c in cards.items():
        if c["main_decks"] < NEW_ARRIVAL_MIN_DECKS:
            continue
        fw = c.get("first_week", "")
        if not fw or fw < cutoff_week:
            continue
        if name not in pairs:
            continue
        shell = [r["name"] for r in pairs[name]["companions"][:8]]
        if len(shell) < 3:
            continue
        before_weeks = [w for w in weeks_sorted if w < fw][-RECENT_WEEKS:]
        after_weeks = [w for w in weeks_sorted if w >= fw][:RECENT_WEEKS]
        if len(before_weeks) < 3 or len(after_weeks) < 3:
            continue

        def shell_prev(weeks, _shell=shell, _wk_lookup=set):
            tot = sum(week_total_w[w] for w in weeks)
            if tot == 0:
                return 0
            wks = set(weeks)
            hits = 0.0
            for d in decks:
                if d["week"] not in wks:
                    continue
                main_names = {c["name"] for c in d.get("main", [])}
                if sum(1 for s in _shell if s in main_names) >= 3:
                    hits += d["weight"]
            return hits / tot

        before = shell_prev(before_weeks)
        after = shell_prev(after_weeks)
        if before == 0 and after == 0:
            continue
        delta = after - before
        if delta <= 0.02:
            continue
        catalysts.append({
            "name": name,
            "first_week": fw,
            "shell": shell[:5],
            "shell_before": round(before, 4),
            "shell_after": round(after, 4),
            "shell_delta": round(delta, 4),
            "card_main_prevalence": round(c["main_prevalence"], 4),
        })
    catalysts.sort(key=lambda r: r["shell_delta"], reverse=True)

    # ── Tier-divergent picks (what pros chose that ladder hasn't) ──
    # Cards whose share in PT main is significantly higher than in ladder.
    # The ratio surfaces "the cutting edge that hasn't trickled down."
    pt_main_decks_recent = [d for d in decks if d.get("weight") == 5
                            and d.get("week", "") >= (pair_cutoff_week or "")]
    ladder_decks_recent = [d for d in decks if d.get("weight") == 1
                           and d.get("week", "") >= (pair_cutoff_week or "")]
    pt_main_total = sum(d["weight"] for d in pt_main_decks_recent)
    ladder_total = sum(d["weight"] for d in ladder_decks_recent)
    pt_main_prev = defaultdict(float)
    ladder_prev = defaultdict(float)
    for d in pt_main_decks_recent:
        for c in d.get("main", []):
            pt_main_prev[c["name"]] += d["weight"]
    for d in ladder_decks_recent:
        for c in d.get("main", []):
            ladder_prev[c["name"]] += d["weight"]

    pt_picks = []
    for name in pt_main_prev:
        if name in lands:
            continue
        pt_share = pt_main_prev[name] / pt_main_total if pt_main_total else 0
        lad_share = ladder_prev.get(name, 0) / ladder_total if ladder_total else 0
        if pt_share < 0.05:  # too small a PT presence to be meaningful
            continue
        spread = pt_share - lad_share
        if spread < 0.05:    # PT lead must be at least 5pp over ladder
            continue
        ratio = (pt_share / lad_share) if lad_share > 0 else float("inf")
        pt_picks.append({
            "name": name,
            "pt_share": round(pt_share, 4),
            "ladder_share": round(lad_share, 4),
            "spread": round(spread, 4),
            "ratio_capped": min(ratio, 999) if ratio != float("inf") else 999,
        })
    # Sort by ratio (∞ first), then by spread
    pt_picks.sort(key=lambda r: (r["ratio_capped"], r["spread"]), reverse=True)

    # ── Bridge cards (cross-archetype: high lift to two partners who rarely meet) ──
    # A bridge B has P(X|B) and P(Y|B) both high, but P(Y|X) is low.
    # These are cards that move across archetypes without locking into one.
    #
    # Compute everything directly from the recent deck pool. pairs.json is
    # truncated to top-N companions per card, so its cross-lookup misses many
    # real pairs; for this analysis we need the full matrix.
    recent_decks = [d for d in decks if d.get("week", "") >= (pair_cutoff_week or "")]
    # full weighted prevalence in recent pool
    full_prev = defaultdict(float)
    for d in recent_decks:
        w = d["weight"]
        for c in d.get("main", []):
            full_prev[c["name"]] += w
    # weighted pair co-occurrence
    full_co = defaultdict(lambda: defaultdict(float))
    for d in recent_decks:
        w = d["weight"]
        names = list({c["name"] for c in d.get("main", [])})
        for i, a in enumerate(names):
            for b in names[i + 1:]:
                full_co[a][b] += w
                full_co[b][a] += w

    bridges = []
    for a, ap in pairs.items():
        if a in lands:
            continue
        if cards.get(a, {}).get("recent_main_decks", 0) < MIN_SUPPORT:
            continue
        strong = []
        for r in ap.get("companions", []):
            if r["name"] in lands:
                continue
            if r["p_b_given_a"] >= 0.4 and cards.get(r["name"], {}).get("recent_main_decks", 0) >= MIN_SUPPORT:
                strong.append((r["p_b_given_a"], r["name"]))
        if len(strong) < 2:
            continue
        best_pair = None
        best_cross = 1.0
        for i in range(len(strong)):
            for j in range(i + 1, len(strong)):
                p1, b1 = strong[i]
                p2, b2 = strong[j]
                co_b1b2 = full_co[b1].get(b2, 0)
                p_b1 = full_prev[b1]
                cross = co_b1b2 / p_b1 if p_b1 > 0 else 0
                if cross < best_cross:
                    best_cross = cross
                    best_pair = (b1, b2, p1, p2, cross)
        if best_pair is None or best_cross > 0.25:
            continue
        b1, b2, p1, p2, cross = best_pair
        bridges.append({
            "name": a,
            "left": b1,
            "right": b2,
            "p_left": round(p1, 3),
            "p_right": round(p2, 3),
            "cross_p": round(cross, 3),
            "score": round((p1 * p2) - cross, 3),
        })
    bridges.sort(key=lambda r: r["score"], reverse=True)

    explore = {
        "pillars": pillars[:18],
        "risen": [r for r in risen if r["delta"] > 0.005][:18],
        "disappeared": [r for r in disappeared if r["delta"] < -0.005][:12],
        "side_risers": side_risers[:12],
        "catalysts": catalysts[:12],
        "pt_picks": pt_picks[:14],
        "bridges": bridges[:10],
        "recent_window_weeks": recent,
        "prior_window_weeks": prior,
    }

    weights_breakdown = Counter(d["weight"] for d in decks)
    meta = {
        "n_decks": n_decks,
        "n_decks_by_weight": {str(w): n for w, n in sorted(weights_breakdown.items())},
        "total_weighted_decks": round(total_weight, 2),
        "n_weeks": len(weeks_sorted),
        "first_week": weeks_sorted[0] if weeks_sorted else None,
        "last_week": weeks_sorted[-1] if weeks_sorted else None,
        "pair_window_weeks": PAIR_RECENT_WEEKS,
        "pair_window_first_week": pair_cutoff_week,
        "pair_window_total_weighted": round(recent_total_w, 2),
        "n_cards_total": len(cards),
        "n_cards_above_support": len(eligible),
        "min_support_decks": MIN_SUPPORT,
        "tier_boundaries": [{"min_centerpiece_prevalence": t, "label": l}
                            for t, l in TIER_BOUNDARIES],
        "weights_explained": {
            "1": "Traditional Bo3 ladder lists",
            "3": "Premier event Top cuts (Champions Cup, RC, Spotlight, etc.)",
            "5": "Pro Tour main field",
            "10": "Pro Tour Top 8",
        },
    }

    (HERE / "cards.json").write_text(json.dumps(list(cards.values()), separators=(",", ":")))
    (HERE / "pairs.json").write_text(json.dumps(pairs, separators=(",", ":")))
    (HERE / "explore.json").write_text(json.dumps(explore, separators=(",", ":")))
    (HERE / "meta.json").write_text(json.dumps(meta, indent=2))

    print(f"{len(cards)} cards, {len(eligible)} above support")
    print(f"  decks: {n_decks} actual, {round(total_weight,1)} weighted")
    print(f"  by tier: " + ", ".join(
        f"{label}={sum(1 for c in cards.values() if c['tier']==label)}"
        for _, label in TIER_BOUNDARIES + [(0, "rare")]))
    print(f"  pillars={len(explore['pillars'])} risen={len(explore['risen'])} "
          f"catalysts={len(explore['catalysts'])} pt_picks={len(explore['pt_picks'])} "
          f"bridges={len(explore['bridges'])}")


if __name__ == "__main__":
    main()
