# handoff

Last updated: 2026-05-13.

Overwrite this during any session. Keep it short. State of play follows.

## In flight: Magic meta-explorer Archetypes tab (LOCAL ONLY, not pushed)

Files modified, uncommitted:
- `games/magic.js`, `games/magic.css`: added 4th tab "Archetypes"
- `games/data/cluster.py`: new, NMF cluster discovery
- `games/data/clusters.json`: new, 16 clusters at N selected by archetype-label classification (87% accuracy)

Local server: `python3 -m http.server 8765 --bind 127.0.0.1` from repo root. URL: `http://127.0.0.1:8765/games/magic.html#t=archetypes`.

User explicitly said do NOT push the archetypes tab to live yet. Everything else (bug fixes, story edits, etc.) goes to main as normal.

Open design questions:
- Tile sizing inside open clusters. Currently n×n grid spans at 3 discrete sizes (anchor 6×6, medium 4×4, small 2×2) with col-width 22px × row-height 30px to maintain card aspect, dense flow, 560px max-width centered. Iterated through several approaches; latest is closest to user's vision. Closed state = simple 2×2 preview of top 4.
- Outer cluster-grid uses `grid-auto-flow: row dense` so other cards reflow when one opens full-width.
- "Used by archetypes" and "travels with" chip sections removed from cluster expansion per user request.
- Search on Archetypes tab filters lists by name (cluster also matches via archetype name match).
- Selected cards from other tabs get red outline in cluster tiles (cross-tab visual link).

## Pushed to main this session

- `b8842af` is_shell flag on stories; load button only shows for cluster/shell stories
- `3e338ed` Synergy fix: require 2-of-N selection match. Banner when selection is incoherent.
- `afc7964` Bridge cards section removed from Cards landing
- earlier: stories tab + archive + status badges, Bo3 disclosure, tab refactor, etc.

## Things on the backlog (designed, not built)

- Cluster overlap dedupe: c1 and c13 are near-duplicates (MG Landfall + Erode variant). Should merge or label as variant in `cluster.py` post-processing.
- In-place card panel: clicking a card in Archetypes should not jump to Cards tab. Instead, expand a card-cluster panel within Archetypes.
- 2D force-directed graph view as a sub-toggle inside Archetypes (D3, no 3D). Substantial build, benched per user.
- "Travels with" graph lines: SVG lines from cluster tiles to partner clusters, opacity = co-occurrence. Mini version of graph view inside each cluster card.
- Story signal detector in cron + Tuesday-morning GitHub issue auto-open with signals. To be built before next data refresh.
- Schema bounds for stories.json (max summary length etc.): decided against. Conversation-review is the safety net.
- Cluster naming: leave numbered (c0...) until hand-named. Co-occurrence ≠ function, so auto-naming by function would mislabel.

## Notes on user preferences

- Auto-push completed work to main on this repo (per memory file). Exception: anything explicitly marked local-only by user.
- No em dashes anywhere (CI-enforced).
- dd-mm-yyyy date format for user-facing strings.
- Stories writing voice: short, numeric, no flavor verbs (anchored, surged, showcased, parsimonious, on the back of, etc.). 1-sentence summary + stats block + optional 1-2 sentence detail.
- Stories ship as JSON the user reviews in conversation before write to disk. No auto-publish from cron.
- Reminder system: GitHub issue auto-opened by Tuesday cron, body contains the week's signals.
