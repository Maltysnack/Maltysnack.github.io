#!/usr/bin/env python3
"""Compute card-level stats from decks_raw.json.

All counts are WEIGHTED by deck.weight (ladder=1, premier=3, PT=5, Top8=10).
Cards get a popularity tier based on their weighted centerpiece prevalence.

Outputs:
  cards.json     — per-card weighted stats, tier, copy histogram, weekly trends
  pairs.json     — top spell-companions / satellites / anchors by weighted lift
  explore.json   — pillars, recently risen, quietly disappeared, side risers,
                   set-anchored catalysts
  meta.json      — dataset summary
"""

import json
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).parent
RAW = HERE / "decks_raw.json"
SCRYFALL = HERE / "scryfall.json"

MIN_SUPPORT = 30           # weighted-deck floor for pair stats and trend data
PAIR_FLOOR = 10            # weighted co-occurrence floor for any pair
TOP_N_PAIRS = 12           # how many to keep per relationship strip
RECENT_WEEKS = 8           # window for "recent" panels
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


def load_land_set() -> set[str]:
    """Names of every card whose Scryfall type_line includes 'Land'.
    Lands are excluded from tier classification and from explore panels:
    "Steam Vents defines the meta" is technically true but useless."""
    if not SCRYFALL.exists():
        return set(BASIC_LANDS)
    sf = json.loads(SCRYFALL.read_text())
    return {n for n, m in sf.items()
            if isinstance(m, dict) and "Land" in (m.get("type_line", "") or "")} | BASIC_LANDS


def tier_for(centerpiece_prevalence: float, name: str, lands: set[str]) -> str | None:
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

    deck_main_sets = []  # (set of card names, weight) for pair co-occurrence

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

        deck_main_sets.append((set(m), w))

    weeks_sorted = sorted(w for w in week_total_w if w)

    # ── per-card aggregates ──
    cards = {}
    all_names = set(main_w) | set(side_w)
    for name in all_names:
        copies = main_copies.get(name, [])
        copy_hist = Counter(copies)
        cp_prev = centerpiece_w[name] / total_weight
        cards[name] = {
            "name": name,
            "main_decks": int(round(main_w[name])),
            "side_decks": int(round(side_w[name])),
            "centerpiece_decks": int(round(centerpiece_w[name])),
            "flex_decks": int(round(flex_w[name])),
            "main_prevalence": main_w[name] / total_weight,
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

    # ── pair stats: weighted lift ──
    eligible = [n for n, c in cards.items() if c["main_decks"] >= MIN_SUPPORT]
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
        pa = main_w[a] / total_weight
        scored = []
        for b, ab_w in co_w[a].items():
            if ab_w < PAIR_FLOOR:
                continue
            pb = main_w[b] / total_weight
            pab = ab_w / total_weight
            lift = pab / (pa * pb)
            p_b_given_a = ab_w / main_w[a]
            p_a_given_b = ab_w / main_w[b]
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

    explore = {
        "pillars": pillars[:18],
        "risen": [r for r in risen if r["delta"] > 0.005][:18],
        "disappeared": [r for r in disappeared if r["delta"] < -0.005][:12],
        "side_risers": side_risers[:12],
        "catalysts": catalysts[:12],
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
          f"disappeared={len(explore['disappeared'])} "
          f"side_risers={len(explore['side_risers'])} catalysts={len(explore['catalysts'])}")


if __name__ == "__main__":
    main()
