# games HANDOFF

Scratchpad for `/games/`. Root `HANDOFF.md` covers site-wide concerns.

## Pages

- `games/magic.html`: Magic meta-explorer (Cards, Decks, Pro-Tour live; Archetypes tab in flight)
- `games/synergy-score.html`: Magic card synergy scorer

## Current state (as of 18-05-2026)

- magic.html: 3 tabs live (Cards, Decks, Pro-Tour). 4th tab (Archetypes) in flight.
- synergy-score.html: stable, no in-flight work.

## In flight

- **Magic Archetypes tab (LOCAL ONLY, do not push to main).** NMF clustering of recent decks to discover card packages.
  - Uncommitted files: `games/magic.js`, `games/magic.css` (tab + UI), `games/data/cluster.py` (new, NMF script), `games/data/clusters.json` (new, 16 clusters, 87% archetype-classification).
  - Local server to view: `python3 -m http.server 8765 --bind 127.0.0.1` from repo root, then `http://127.0.0.1:8765/games/magic.html#t=archetypes`.
  - Closed cluster card = 2x2 thumbnail preview of top 4 cards.
  - Open cluster card = n×n grid spans at three discrete sizes (anchor 6×6, medium 4×4, small 2×2) on col-width 22px × row-height 30px (card aspect 0.72), dense flow, 560px max-width centered. Outer `.cluster-grid` uses `grid-auto-flow: row dense` so siblings reflow when one opens full-width.
  - Lands filtered from clustering input (they cluster by color, not strategy).
  - Search on the tab filters lists by name; cluster also matches when a using-archetype name matches.
  - "Used by archetypes" and "Travels with" sections removed from cluster open view per user.
  - Selected cards from other tabs get red outline in cluster tiles.

## Decisions pending

- **Cluster overlap dedupe.** NMF gives c1 (MG Landfall) and c13 (MG Landfall + Erode) as near-duplicates. Should post-process in `cluster.py` to merge or label as variant.
- **In-place card panel on Archetypes.** Clicking a tile should not jump to Cards tab; open a card-cluster panel inline.
- **2D force-directed graph view** as sub-toggle in Archetypes (D3). Benched per user, keep in mind.
- **Travels-with mini graph lines** inside cluster cards (SVG, opacity = co-occurrence).

## Gotchas

- Lands must stay filtered from clustering input or clusters collapse onto color buckets.

## Recent session log

- 18-05-2026: Archetypes tab grid math finalised (three discrete sizes, dense flow). HANDOFF carved out from root.
