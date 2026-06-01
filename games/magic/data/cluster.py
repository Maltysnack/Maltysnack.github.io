#!/usr/bin/env python3
"""
cluster.py: discover latent card packages via NMF.

Output: clusters.json with cluster definitions, cluster pairings, and
per-archetype cluster mixes. Clusters are numbered; a human assigns
display names later.

N is auto-selected by training a tiny classifier to predict the pro
archetype label from each deck's cluster weights, and picking the
smallest N where accuracy plateaus.
"""

import json
from collections import defaultdict, Counter
from pathlib import Path

import numpy as np
from sklearn.decomposition import NMF
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score

HERE = Path(__file__).parent
DECKS = json.load(open(HERE / "decks_raw.json"))
META  = json.load(open(HERE / "meta.json"))
SCRY  = json.load(open(HERE / "scryfall.json"))

WINDOW_START = META["pair_window_first_week"]
CARD_SUPPORT_MIN = 10   # weighted-deck floor for a card to enter the matrix
N_CANDIDATES = [12, 16, 20, 24, 30, 40]
RANDOM_SEED  = 42

# ── 1. Filter to recent decks, collect cards ────────────────────────────
recent_idxs = [i for i, d in enumerate(DECKS) if d.get("week", "") >= WINDOW_START]
recent = [DECKS[i] for i in recent_idxs]

def is_land(name):
    sf = SCRY.get(name, {})
    return "Land" in (sf.get("type_line") or "")

card_weight = Counter()
for d in recent:
    w = d.get("weight", 1)
    for c in d.get("main", []):
        if is_land(c["name"]):
            continue  # lands cluster by color identity, not strategy
        card_weight[c["name"]] += w

cards = sorted(c for c, w in card_weight.items() if w >= CARD_SUPPORT_MIN)
card_idx = {c: i for i, c in enumerate(cards)}
print(f"Recent decks: {len(recent)}, cards above support: {len(cards)}")

# ── 2. Build deck × card matrix; replicate by integer weight ─────────────
# NMF doesn't take sample weights, so we duplicate weight-3/5/10 decks.
rows = []
deck_meta = []  # parallel array of {weight, week, subtitle, source_idx}
for src_idx, d in enumerate(recent):
    w = int(d.get("weight", 1))
    row = np.zeros(len(cards), dtype=np.float32)
    for c in d.get("main", []):
        i = card_idx.get(c["name"])
        if i is None: continue
        # qty/4 capped at 1: 4-of contributes 1.0, 1-of contributes 0.25
        row[i] = min(c.get("qty", 1) / 4.0, 1.0)
    # Replicate by weight so heavier decks pull NMF harder
    for _ in range(w):
        rows.append(row)
        deck_meta.append({
            "src_idx": src_idx,
            "weight": w,
            "week": d.get("week", ""),
            "subtitle": d.get("subtitle", "").strip(),
        })

X = np.vstack(rows)
print(f"Matrix shape: {X.shape}  (weighted-replicated decks × cards)")

# ── 3. Run NMF at each candidate N, score via archetype classification ───
def labeled_mask():
    return np.array([bool(m["subtitle"]) for m in deck_meta])

mask = labeled_mask()
labels = np.array([m["subtitle"] for m in deck_meta])
labeled_count = mask.sum()
print(f"Labeled decks (with archetype subtitle): {labeled_count}")
print()

results = []
for n in N_CANDIDATES:
    nmf = NMF(n_components=n, init="nndsvda", random_state=RANDOM_SEED,
              max_iter=500, tol=1e-4, beta_loss="frobenius")
    W = nmf.fit_transform(X)  # decks × n
    H = nmf.components_       # n × cards

    # Classification score: predict archetype from W rows
    Wl = W[mask]
    yl = labels[mask]
    if len(set(yl)) < 2:
        continue
    clf = LogisticRegression(max_iter=2000, n_jobs=1)
    score = cross_val_score(clf, Wl, yl, cv=5, n_jobs=1).mean()
    recon = nmf.reconstruction_err_
    results.append((n, score, recon, W, H))
    print(f"N={n:3d}  archetype-classification accuracy={score:.3f}  reconstruction_err={recon:.1f}")

# Pick smallest N where accuracy is within 0.02 of the max
max_score = max(r[1] for r in results)
chosen = None
for n, score, recon, W, H in results:
    if score >= max_score - 0.02:
        chosen = (n, score, recon, W, H)
        break
n, score, recon, W, H = chosen
print(f"\nChosen N: {n}  (accuracy {score:.3f}, max was {max_score:.3f})")

# ── 3.5. Merge near-duplicate clusters ──────────────────────────────────
# NMF occasionally produces two clusters that share most of their top cards
# (e.g., two Landfall variants). Detect any pair whose H rows (full
# cluster-over-cards distributions) have cosine similarity >= 0.6 and merge:
# sum the H rows and W columns, then renumber. Cosine on the weighted H is
# better than Jaccard on top-N names because it (a) accounts for cards
# *both* clusters care about regardless of rank position and (b) doesn't
# falsely separate variants that swap a single card in their top 10.
COSINE_THRESHOLD = 0.6

def cosine(a, b):
    na = np.linalg.norm(a)
    nb = np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return float(a @ b / (na * nb))

parent = list(range(n))
def find(x):
    while parent[x] != x:
        parent[x] = parent[parent[x]]
        x = parent[x]
    return x
def union(a, b):
    ra, rb = find(a), find(b)
    if ra != rb:
        parent[max(ra, rb)] = min(ra, rb)

merge_log = []
for i in range(n):
    for j in range(i + 1, n):
        sim = cosine(H[i], H[j])
        if sim >= COSINE_THRESHOLD:
            union(i, j)
            merge_log.append((i, j, sim))

groups = defaultdict(list)
for i in range(n):
    groups[find(i)].append(i)
if len(groups) < n:
    n_merged = n - len(groups)
    merged_groups = [g for g in groups.values() if len(g) > 1]
    print(f"\nMerging {n_merged} duplicate cluster(s) into {len(merged_groups)} group(s):")
    for i, j, sim in merge_log:
        print(f"  c{i} <-> c{j}  cosine={sim:.3f}")
    keep_order = sorted(groups.keys())
    new_n = len(keep_order)
    new_H = np.zeros((new_n, H.shape[1]))
    new_W = np.zeros((W.shape[0], new_n))
    for new_idx, root in enumerate(keep_order):
        for member in groups[root]:
            new_H[new_idx] += H[member]
            new_W[:, new_idx] += W[:, member]
    H, W, n = new_H, new_W, new_n

# ── 4. Per-cluster top cards ────────────────────────────────────────────
TOP_CARDS_PER_CLUSTER = 14

clusters_out = []
for ci in range(n):
    weights = H[ci]
    top_idx = np.argsort(-weights)[:TOP_CARDS_PER_CLUSTER]
    # Keep cards with non-trivial weight
    members = []
    for ti in top_idx:
        w = float(weights[ti])
        if w < 0.05: break
        members.append({
            "name": cards[ti],
            "weight": round(w, 3),
        })
    # Distinctiveness: how concentrated is this cluster on its top card vs the rest of H?
    top_w = float(weights.max())
    # Members count for sizing the cluster (above some threshold)
    over_threshold = int((weights > 0.1).sum())
    clusters_out.append({
        "id": f"c{ci}",
        "members": members,
        "top_weight": round(top_w, 3),
        "member_count": over_threshold,
    })

# ── 5. Per-archetype cluster mix ────────────────────────────────────────
# For each named archetype, average the deck cluster weights of its members.
arch_decks = defaultdict(list)
for i, m in enumerate(deck_meta):
    if m["subtitle"]:
        arch_decks[m["subtitle"]].append(i)

archetypes_out = []
for arch, idxs in arch_decks.items():
    if len(idxs) < 3: continue   # need at least 3 decks for a meaningful average
    avg = W[idxs].mean(axis=0)
    # Normalize
    total = avg.sum()
    if total == 0: continue
    norm = avg / total
    mix = []
    for ci in np.argsort(-norm)[:6]:
        v = float(norm[ci])
        if v < 0.05: break
        mix.append({"cluster": f"c{ci}", "weight": round(v, 3)})
    archetypes_out.append({
        "name": arch,
        "deck_count": len(idxs) // max(deck_meta[idxs[0]]["weight"], 1),  # dedupe weight replication
        "cluster_mix": mix,
    })

archetypes_out.sort(key=lambda a: -a["deck_count"])

# ── 6. Cluster × cluster co-occurrence (compatibility) ──────────────────
# For each deck, threshold its cluster weights at 0.15 of its max cluster weight.
# A cluster pair co-occurs in a deck if both pass the threshold.
THRESH_FRAC = 0.15
cluster_decks = [set() for _ in range(n)]
unique_decks = set()  # use src_idx to dedupe replication
for i, m in enumerate(deck_meta):
    src = m["src_idx"]
    if src in unique_decks: continue
    unique_decks.add(src)
    row = W[i]
    if row.max() == 0: continue
    cutoff = row.max() * THRESH_FRAC
    for ci, v in enumerate(row):
        if v >= cutoff:
            cluster_decks[ci].add(src)

# Pairs: P(B in deck | A in deck)
pair_out = []
for ci in range(n):
    if len(cluster_decks[ci]) < 5: continue
    row = []
    for cj in range(n):
        if cj == ci or len(cluster_decks[cj]) < 5: continue
        inter = len(cluster_decks[ci] & cluster_decks[cj])
        p_cond = inter / len(cluster_decks[ci])
        if p_cond < 0.05: continue
        row.append({"cluster": f"c{cj}", "p_cond": round(p_cond, 3)})
    row.sort(key=lambda x: -x["p_cond"])
    pair_out.append({
        "cluster": f"c{ci}",
        "deck_count": len(cluster_decks[ci]),
        "partners": row[:6],
    })

# ── 7. Write output ────────────────────────────────────────────────────
out = {
    "generated_at": META.get("last_week", ""),
    "n_clusters": n,
    "n_decks_used": len(unique_decks),
    "archetype_classification_accuracy": round(score, 3),
    "clusters": clusters_out,
    "archetypes": archetypes_out,
    "cluster_pairings": pair_out,
}
out_path = HERE / "clusters.json"
out_path.write_text(json.dumps(out, indent=2))
print(f"\nWrote {out_path}")
print(f"  {len(clusters_out)} clusters, {len(archetypes_out)} archetypes with cluster mix")
