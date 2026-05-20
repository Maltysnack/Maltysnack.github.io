#!/usr/bin/env python3
"""Detect story candidates from the Magic dataset.

Runs after analyze.py + cluster.py. Scans the dataset for week-over-week
movements worth writing up and emits story_candidates.json: a shortlist of
{kind, evidence} records. It does NOT write finished stories. A human
reviews the candidates and authors stories.json (title, summary, detail,
the editorial voice). See data/stories.md for the schema and the kinds.

Candidates are a curator artifact, not a public surface: the frontend does
not load story_candidates.json.
"""

import json
import sys
from collections import defaultdict, Counter
from datetime import date
from pathlib import Path

HERE = Path(__file__).parent

# ── Tunables ────────────────────────────────────────────────────────────
RECENT_WEEKS        = 2     # a movement counts as "now" if it lands in these
PRESENCE_FLOOR      = 0.03  # a card/cluster counts as present at >= this share
RISEN_MIN_DELTA     = 0.08  # post-pt-shift: ladder-share jump, in points
RETURN_MIN_GAP      = 4     # returning-*: consecutive absent weeks
RETURN_MIN_PRIOR    = 0.05  # returning-*: peak share it held before the gap
RETURN_RECENCY      = 3     # returning-*: the return must be this fresh, in weeks
CLUSTER_SHELL_CARDS = 8     # returning-cluster: top-N members define the shell
CLUSTER_PRESENT_MIN = 3     # cluster present if >= this many shell cards seen
CONVERSION_RECENT   = 3.5   # copy-conversion: recent avg copies to read as 4-of
CONVERSION_PRIOR    = 2.5   # copy-conversion: prior avg copies ceiling
MIN_DECKS_FOR_CONV  = 6     # copy-conversion: min decks running it (noise guard)
PER_KIND_CAP        = 6     # keep each kind a shortlist, never a data dump


def ddmmyyyy(iso: str) -> str:
    p = iso.split("-")
    return f"{p[2]}-{p[1]}-{p[0]}" if len(p) == 3 else iso


def load(name, default=None):
    path = HERE / name
    if not path.exists():
        return default
    return json.loads(path.read_text())


decks    = load("decks_raw.json", [])
explore  = load("explore.json", {})
clusters = load("clusters.json", {})
stories  = load("stories.json", {"stories": []})

# Ladder decks only: the stories talk in terms of ranked-ladder share.
ladder = [d for d in decks if d.get("weight", 1) == 1 and d.get("week")]
weeks = sorted({d["week"] for d in ladder})
by_week = defaultdict(list)
for d in ladder:
    by_week[d["week"]].append(d)


def main_names(deck):
    return {c["name"] for c in deck.get("main", [])}


# Per-week card share (fraction of that week's ladder decks running the card).
week_card_share = {}
for wk in weeks:
    cnt = Counter()
    for d in by_week[wk]:
        for n in main_names(d):
            cnt[n] += 1
    n = len(by_week[wk]) or 1
    week_card_share[wk] = {c: v / n for c, v in cnt.items()}


def share(card, wk):
    return week_card_share.get(wk, {}).get(card, 0.0)


# Cards already covered by an active story, so the human can skip those.
active_story_cards = set()
for s in stories.get("stories", []):
    if s.get("status", "active") == "active":
        active_story_cards.update(s.get("cards", []))


def cluster_label(cid):
    """The archetype that leans hardest on this cluster, for a readable hint."""
    best, best_w = cid, -1.0
    for a in clusters.get("archetypes", []):
        for m in a.get("cluster_mix", []):
            if m.get("cluster") == cid and m.get("weight", 0) > best_w:
                best, best_w = a["name"], m["weight"]
    return best


# ── Kind 1: post-pt-shift ───────────────────────────────────────────────
# A card whose ladder share jumped sharply. analyze.py already ranks these
# in explore.risen; we keep the big movers and attach a shell when the same
# card shows up as a catalyst.
def detect_post_pt_shift():
    catalyst_shell = {c["name"]: c.get("shell", []) for c in explore.get("catalysts", [])}
    out = []
    for r in sorted(explore.get("risen", []), key=lambda r: -r["delta"]):
        if r["delta"] < RISEN_MIN_DELTA:
            continue
        name = r["name"]
        shell = [s for s in catalyst_shell.get(name, []) if s != name][:5]
        out.append({
            "kind": "post-pt-shift",
            "key": f"shift:{name}",
            "headline_hint": f"{name} up +{r['delta'] * 100:.0f}pp on ladder "
                             f"({r['prior'] * 100:.0f}% to {r['recent'] * 100:.0f}%)",
            "is_shell": bool(shell),
            "cards": [name] + shell,
            "stats": [
                {"label": "Prior 8wk share", "value": f"{r['prior'] * 100:.1f}%"},
                {"label": "Recent 8wk share", "value": f"{r['recent'] * 100:.1f}%"},
                {"label": "Delta", "value": f"+{r['delta'] * 100:.1f}pp"},
            ],
        })
    return out[:PER_KIND_CAP]


# ── Kind 2: pt-vs-ladder ────────────────────────────────────────────────
# Cards the pros over-index on that the ladder has not picked up. One bundled
# candidate, since the story is the pattern, not any single card.
def detect_pt_vs_ladder():
    picks = explore.get("pt_picks", [])[:PER_KIND_CAP]
    if not picks:
        return []
    return [{
        "kind": "pt-vs-ladder",
        "key": "pt-vs-ladder",
        "headline_hint": f"{len(picks)} cards over-indexed at the Pro Tour vs ladder",
        "is_shell": False,
        "cards": [p["name"] for p in picks],
        "stats": [
            {"label": p["name"],
             "value": f"{p['pt_share'] * 100:.0f}% PT, {p['ladder_share'] * 100:.1f}% ladder"}
            for p in picks
        ],
    }]


# ── Gap detection shared by returning-card and returning-cluster ────────
def find_return(present):
    """present: list[bool] over `weeks`. Returns (gap_start, gap_end, run_start)
    when the series ends in a present run that (a) started within the last
    RETURN_RECENCY weeks, (b) is preceded by a >= RETURN_MIN_GAP run of absent
    weeks, itself preceded by at least one present week. None otherwise.

    The recency check matters: without it a shell that returned months ago and
    has been present ever since would still be flagged as "returning" today."""
    if not present or not present[-1]:
        return None
    run_start = len(present) - 1
    while run_start > 0 and present[run_start - 1]:
        run_start -= 1
    if run_start < len(present) - RETURN_RECENCY:
        return None
    gap_end = run_start - 1
    j = gap_end
    while j >= 0 and not present[j]:
        j -= 1
    gap_len = gap_end - j
    if gap_len < RETURN_MIN_GAP or j < 0:
        return None
    if not any(present[:j + 1]):
        return None
    return (j + 1, gap_end, run_start)


# ── Kind 3: returning-card ──────────────────────────────────────────────
def detect_returning_card():
    recent_cards = set()
    for wk in weeks[-RECENT_WEEKS:]:
        for c, s in week_card_share[wk].items():
            if s >= PRESENCE_FLOOR:
                recent_cards.add(c)
    out = []
    for card in recent_cards:
        present = [share(card, wk) >= PRESENCE_FLOOR for wk in weeks]
        r = find_return(present)
        if not r:
            continue
        gap_start, gap_end, run_start = r
        prior_peak = max((share(card, weeks[t]) for t in range(gap_start)), default=0)
        if prior_peak < RETURN_MIN_PRIOR:
            continue
        out.append({
            "kind": "returning-card",
            "key": f"return-card:{card}",
            "headline_hint": f"{card} back after a "
                             f"{gap_end - gap_start + 1}-week absence",
            "is_shell": False,
            "cards": [card],
            "_sort": prior_peak,
            "stats": [
                {"label": "Peak before gap", "value": f"{prior_peak * 100:.0f}%"},
                {"label": "Gap",
                 "value": f"{ddmmyyyy(weeks[gap_start])} to {ddmmyyyy(weeks[gap_end])} "
                          f"({gap_end - gap_start + 1} weeks, 0 appearances)"},
                {"label": "Return", "value": f"{share(card, weeks[-1]) * 100:.0f}% "
                                             f"({ddmmyyyy(weeks[-1])})"},
            ],
        })
    out.sort(key=lambda c: -c.pop("_sort"))
    return out[:PER_KIND_CAP]


# ── Kind 4: returning-cluster ───────────────────────────────────────────
def cluster_density(shell, wk):
    """How many of the cluster's shell cards appear in any ladder deck that week."""
    seen = set()
    for d in by_week.get(wk, []):
        names = main_names(d)
        for s in shell:
            if s in names:
                seen.add(s)
    return len(seen)


def detect_returning_cluster():
    out = []
    for cl in clusters.get("clusters", []):
        shell = [m["name"] for m in cl.get("members", [])[:CLUSTER_SHELL_CARDS]]
        if len(shell) < CLUSTER_PRESENT_MIN:
            continue
        dens = [cluster_density(shell, wk) for wk in weeks]
        present = [d >= CLUSTER_PRESENT_MIN for d in dens]
        r = find_return(present)
        if not r:
            continue
        gap_start, gap_end, run_start = r
        peak_before = max(dens[:gap_start], default=0)
        label = cluster_label(cl["id"])
        out.append({
            "kind": "returning-cluster",
            "key": f"return-cluster:{cl['id']}",
            "headline_hint": f"{label} shell ({cl['id']}) back after a "
                             f"{gap_end - gap_start + 1}-week gap",
            "is_shell": True,
            "cards": shell,
            "_sort": peak_before,
            "stats": [
                {"label": "Shell", "value": f"{cl['id']} ({label}), "
                                            f"top {len(shell)} cards"},
                {"label": "Peak density before gap",
                 "value": f"{peak_before} of {len(shell)} cards"},
                {"label": "Gap",
                 "value": f"{ddmmyyyy(weeks[gap_start])} to {ddmmyyyy(weeks[gap_end])} "
                          f"({gap_end - gap_start + 1} weeks)"},
                {"label": "Return",
                 "value": f"{dens[-1]} of {len(shell)} cards ({ddmmyyyy(weeks[-1])})"},
            ],
        })
    out.sort(key=lambda c: -c.pop("_sort"))
    return out[:PER_KIND_CAP]


# ── Kind 5: copy-conversion ─────────────────────────────────────────────
# A card the ladder used to splash as a 1-of or 2-of and now runs as a 4-of.
def detect_copy_conversion():
    def avg_copies(wks):
        total = defaultdict(int)
        decks_with = defaultdict(int)
        for wk in wks:
            for d in by_week.get(wk, []):
                for c in d.get("main", []):
                    total[c["name"]] += c["qty"]
                    decks_with[c["name"]] += 1
        return ({n: total[n] / decks_with[n] for n in total}, decks_with)

    recent_wks = weeks[-RECENT_WEEKS:]
    prior_wks = weeks[-(RECENT_WEEKS + 6):-RECENT_WEEKS]
    if not prior_wks:
        return []
    recent_avg, recent_count = avg_copies(recent_wks)
    prior_avg, _ = avg_copies(prior_wks)
    out = []
    for name, r in recent_avg.items():
        p = prior_avg.get(name)
        if p is None or recent_count[name] < MIN_DECKS_FOR_CONV:
            continue
        if r >= CONVERSION_RECENT and p <= CONVERSION_PRIOR:
            out.append({
                "kind": "copy-conversion",
                "key": f"convert:{name}",
                "headline_hint": f"{name} converted from a {p:.1f}-of to a {r:.1f}-of",
                "is_shell": False,
                "cards": [name],
                "_sort": r - p,
                "stats": [
                    {"label": "Prior avg copies", "value": f"{p:.2f}"},
                    {"label": "Recent avg copies", "value": f"{r:.2f}"},
                    {"label": "Recent decks running it", "value": str(recent_count[name])},
                ],
            })
    out.sort(key=lambda c: -c.pop("_sort"))
    return out[:PER_KIND_CAP]


def main():
    if not weeks:
        print("no ladder decks found; nothing to detect", file=sys.stderr)
        return
    candidates = []
    for fn in (detect_post_pt_shift, detect_pt_vs_ladder, detect_returning_card,
               detect_returning_cluster, detect_copy_conversion):
        candidates.extend(fn())
    for c in candidates:
        c["already_in_stories"] = any(n in active_story_cards for n in c["cards"])

    out = {
        "generated_at": date.today().isoformat(),
        "current_week": weeks[-1],
        "window_weeks": weeks[-8:],
        "candidate_count": len(candidates),
        "candidates": candidates,
    }
    (HERE / "story_candidates.json").write_text(json.dumps(out, indent=2))

    by_kind = Counter(c["kind"] for c in candidates)
    print(f"wrote story_candidates.json: {len(candidates)} candidates", file=sys.stderr)
    for kind, n in sorted(by_kind.items()):
        print(f"  {n:2}  {kind}", file=sys.stderr)
    fresh = sum(1 for c in candidates if not c["already_in_stories"])
    print(f"  {fresh} not yet covered by an active story", file=sys.stderr)


if __name__ == "__main__":
    main()
