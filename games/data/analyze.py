#!/usr/bin/env python3
"""Compute card-level stats from decks_raw.json.

Outputs:
  cards.json     — per-card prevalence, copy histogram, weekly trend, side trend
  pairs.json     — per-card top companions / satellites / anchors by lift
  explore.json   — pillars, recently risen, quietly disappeared, side risers,
                   set-anchored catalysts
  meta.json      — dataset summary
"""

import json
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

HERE = Path(__file__).parent
RAW = HERE / "decks_raw.json"

# Cards must appear in at least this many decks for pair stats and trends.
MIN_SUPPORT = 30
# Co-occurrence floor for pair stats (suppress fluke pairings).
PAIR_FLOOR = 10
# How many companions/satellites/anchors to keep per card.
TOP_N_PAIRS = 12
# Weeks-window for "recent" panels (pillars, risen, disappeared).
RECENT_WEEKS = 8
# A card is a candidate "new arrival" for catalyst analysis if its first week
# was within the last NEW_ARRIVAL_WEEKS weeks of the dataset and it has at
# least NEW_ARRIVAL_MIN_DECKS appearances.
NEW_ARRIVAL_WEEKS = 30
NEW_ARRIVAL_MIN_DECKS = 15

# Centerpiece = decks running 3+ copies main.  Flex = decks running 1-2 copies main.
CENTERPIECE_THRESHOLD = 3


def load_decks():
    return json.loads(RAW.read_text())


def main():
    decks = load_decks()
    n_decks = len(decks)

    main_count = Counter()
    side_count = Counter()
    centerpiece_count = Counter()
    flex_count = Counter()
    main_copies = defaultdict(list)
    by_week_main = defaultdict(Counter)
    by_week_side = defaultdict(Counter)
    by_week_centerpiece = defaultdict(Counter)
    week_totals = Counter()
    first_week = {}   # card -> first week appeared (any zone)

    deck_main_sets = []

    for deck in decks:
        wk = deck.get("week", "")
        week_totals[wk] += 1
        m = {c["name"]: c["qty"] for c in deck.get("main", [])}
        s = {c["name"]: c["qty"] for c in deck.get("side", [])}

        for name, qty in m.items():
            main_count[name] += 1
            main_copies[name].append(qty)
            by_week_main[wk][name] += 1
            if qty >= CENTERPIECE_THRESHOLD:
                centerpiece_count[name] += 1
                by_week_centerpiece[wk][name] += 1
            else:
                flex_count[name] += 1
            if name not in first_week or wk < first_week[name]:
                first_week[name] = wk

        for name in s:
            side_count[name] += 1
            by_week_side[wk][name] += 1
            if name not in first_week or wk < first_week[name]:
                first_week[name] = wk

        deck_main_sets.append(set(m))

    weeks_sorted = sorted(week_totals)

    # --- per-card aggregates ---
    cards = {}
    for name in set(main_count) | set(side_count):
        copies = main_copies.get(name, [])
        copy_hist = Counter(copies)
        cards[name] = {
            "name": name,
            "main_decks": main_count[name],
            "side_decks": side_count[name],
            "any_decks": main_count[name] + side_count[name] - sum(
                1 for d in decks
                if any(c["name"] == name for c in d.get("main", []))
                and any(c["name"] == name for c in d.get("side", []))
            ),
            "centerpiece_decks": centerpiece_count[name],
            "flex_decks": flex_count[name],
            "main_prevalence": main_count[name] / n_decks,
            "centerpiece_prevalence": centerpiece_count[name] / n_decks,
            "flex_prevalence": flex_count[name] / n_decks,
            "side_prevalence": side_count[name] / n_decks,
            "avg_copies_main": (sum(copies) / len(copies)) if copies else 0,
            "copy_hist_main": {str(k): copy_hist[k] for k in sorted(copy_hist)},
            "first_week": first_week.get(name, ""),
        }

    # any_decks computation above is O(n²), let me redo it more efficiently
    any_count = Counter()
    for deck in decks:
        seen = {c["name"] for c in deck.get("main", [])}
        seen |= {c["name"] for c in deck.get("side", [])}
        for name in seen:
            any_count[name] += 1
    for name, c in cards.items():
        c["any_decks"] = any_count[name]

    # --- weekly trend (always include for any card with ≥ MIN_SUPPORT) ---
    for name, c in cards.items():
        if c["main_decks"] + c["side_decks"] >= MIN_SUPPORT:
            trend_main = []
            trend_side = []
            for wk in weeks_sorted:
                tot = week_totals[wk]
                trend_main.append([wk, by_week_main[wk].get(name, 0), tot])
                trend_side.append([wk, by_week_side[wk].get(name, 0), tot])
            c["weekly_main"] = trend_main
            c["weekly_side"] = trend_side

    # --- pair stats: lift, P(B|A), P(A|B) on the main-deck signal ---
    eligible = [n for n, c in cards.items() if c["main_decks"] >= MIN_SUPPORT]
    eligible_set = set(eligible)
    co = defaultdict(Counter)
    for s in deck_main_sets:
        relevant = [c for c in s if c in eligible_set]
        for i, a in enumerate(relevant):
            for b in relevant[i + 1:]:
                co[a][b] += 1
                co[b][a] += 1

    pairs = {}
    for a in eligible:
        pa = main_count[a] / n_decks
        scored = []
        for b, ab in co[a].items():
            if ab < PAIR_FLOOR:
                continue
            pb = main_count[b] / n_decks
            pab = ab / n_decks
            lift = pab / (pa * pb)
            p_b_given_a = ab / main_count[a]
            p_a_given_b = ab / main_count[b]
            scored.append({
                "name": b,
                "co_decks": ab,
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

        pairs[a] = {
            "companions": companions,
            "satellites": satellites,
            "anchors": anchors,
        }

    # --- explore panels ---
    recent = weeks_sorted[-RECENT_WEEKS:]
    prior = weeks_sorted[-2 * RECENT_WEEKS:-RECENT_WEEKS]

    def window_prevalence(card, weeks, source):
        total = sum(week_totals[w] for w in weeks)
        if total == 0:
            return 0
        hits = sum(source[w].get(card, 0) for w in weeks)
        return hits / total

    pillars = []
    risen = []
    disappeared = []
    for name in cards:
        if cards[name]["any_decks"] < MIN_SUPPORT:
            continue
        recent_centerpiece = window_prevalence(name, recent, by_week_centerpiece)
        recent_main = window_prevalence(name, recent, by_week_main)
        prior_main = window_prevalence(name, prior, by_week_main)
        delta_main = recent_main - prior_main
        # Skip basic lands from pillars (uninteresting)
        if name in {"Plains", "Island", "Forest", "Mountain", "Swamp", "Wastes"}:
            continue
        pillars.append({
            "name": name,
            "recent_centerpiece_prevalence": round(recent_centerpiece, 4),
            "recent_main_prevalence": round(recent_main, 4),
        })
        risen.append({
            "name": name,
            "delta": round(delta_main, 4),
            "recent": round(recent_main, 4),
            "prior": round(prior_main, 4),
        })
        disappeared.append({
            "name": name,
            "delta": round(delta_main, 4),
            "recent": round(recent_main, 4),
            "prior": round(prior_main, 4),
        })

    pillars.sort(key=lambda r: r["recent_centerpiece_prevalence"], reverse=True)
    risen.sort(key=lambda r: r["delta"], reverse=True)
    disappeared.sort(key=lambda r: r["delta"])

    # Sideboard risers
    side_risers = []
    for name in cards:
        if cards[name]["side_decks"] < MIN_SUPPORT:
            continue
        recent_side = window_prevalence(name, recent, by_week_side)
        prior_side = window_prevalence(name, prior, by_week_side)
        delta = recent_side - prior_side
        if delta <= 0:
            continue
        side_risers.append({
            "name": name,
            "delta": round(delta, 4),
            "recent": round(recent_side, 4),
            "prior": round(prior_side, 4),
        })
    side_risers.sort(key=lambda r: r["delta"], reverse=True)

    # --- catalyst detection ---
    # For each card whose first appearance was in the last NEW_ARRIVAL_WEEKS:
    # find its top-lift companions (the shell), then compute that shell's
    # combined prevalence in the windows before vs after the card arrived.
    catalysts = []
    cutoff_week = weeks_sorted[-NEW_ARRIVAL_WEEKS] if len(weeks_sorted) >= NEW_ARRIVAL_WEEKS else weeks_sorted[0]

    for name, c in cards.items():
        if c["main_decks"] < NEW_ARRIVAL_MIN_DECKS:
            continue
        fw = c.get("first_week", "")
        if not fw or fw < cutoff_week:
            continue

        # Find shell: top-lift companions, but only need at least 3 to evaluate
        if name not in pairs:
            continue
        shell = [r["name"] for r in pairs[name]["companions"][:8]]
        if len(shell) < 3:
            continue

        # Define windows around first appearance
        before_weeks = [w for w in weeks_sorted if w < fw][-RECENT_WEEKS:]
        after_weeks = [w for w in weeks_sorted if w >= fw][:RECENT_WEEKS]
        if len(before_weeks) < 3 or len(after_weeks) < 3:
            continue

        def shell_prev(weeks):
            tot = sum(week_totals[w] for w in weeks)
            if tot == 0:
                return 0
            hits = 0
            for d in decks:
                if d["week"] not in weeks:
                    continue
                main_names = {c["name"] for c in d.get("main", [])}
                if sum(1 for s in shell if s in main_names) >= 3:
                    hits += 1
            return hits / tot

        before = shell_prev(before_weeks)
        after = shell_prev(after_weeks)
        if before == 0 and after == 0:
            continue
        delta = after - before
        if delta <= 0.02:  # at least 2pp shell rise to count
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

    meta = {
        "n_decks": n_decks,
        "n_weeks": len(weeks_sorted),
        "first_week": weeks_sorted[0] if weeks_sorted else None,
        "last_week": weeks_sorted[-1] if weeks_sorted else None,
        "n_cards_total": len(cards),
        "n_cards_above_support": len(eligible),
        "min_support_decks": MIN_SUPPORT,
    }

    (HERE / "cards.json").write_text(json.dumps(list(cards.values()), separators=(",", ":")))
    (HERE / "pairs.json").write_text(json.dumps(pairs, separators=(",", ":")))
    (HERE / "explore.json").write_text(json.dumps(explore, separators=(",", ":")))
    (HERE / "meta.json").write_text(json.dumps(meta, indent=2))

    print(f"{len(cards)} cards, {len(eligible)} above support, "
          f"{n_decks} decks, {len(weeks_sorted)} weeks")
    print(f"  pillars={len(explore['pillars'])} risen={len(explore['risen'])} "
          f"disappeared={len(explore['disappeared'])} "
          f"side_risers={len(explore['side_risers'])} catalysts={len(explore['catalysts'])}")


if __name__ == "__main__":
    main()
