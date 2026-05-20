# magic HANDOFF

Scratchpad for `/games/magic/`. Parent `games/HANDOFF.md` lists sibling games; root `HANDOFF.md` covers site-wide concerns.

## Pages

- `games/magic/index.html`: Magic meta-explorer (Cards, Decks, Pro-Tour, Archetypes, all live)
- `games/magic/synergy-score.html`: Magic card synergy scorer (shares `magic.css`)

## Current state (as of 20-05-2026)

- 4 tabs live (Cards, Decks, Pro-Tour, Archetypes).
- Folder reorg done 18-05-2026: was `games/magic.{html,js,css}` + `games/data/`, now `games/magic/{index.html,magic.js,magic.css}` + `games/magic/data/`. `DATA_DIR` in `magic.js` updated. No redirect from old path (site has no inbound traffic).
- **Weekly workflow is broken on `main`.** `magic-weekly.yml` on `main` still calls the pre-reorg `games/data/` paths, so every scheduled run fails in ~12s (last good run 12-05-2026). The working tree has the corrected paths but the fix was never committed. Commit + push `magic-weekly.yml` to fix; until then the dataset goes stale.
- Dataset re-pulled and re-run locally 20-05-2026 (data through week 18-05). All `games/magic/data/` files are fresh and consistent but uncommitted.

## Live

- **Archetypes tab.** NMF clustering of recent decks to discover card packages. Shipped 18-05-2026 in commit `2f0cc12` (previously flagged LOCAL ONLY; gate lifted).
  - Files: `games/magic/magic.js`, `games/magic/magic.css` (tab + UI), `games/magic/data/cluster.py` (NMF script), `games/magic/data/clusters.json` (~17 clusters, ~92% archetype-classification; count varies per run).
  - Local server to view: `python3 -m http.server 8765 --bind 127.0.0.1` from repo root, then `http://127.0.0.1:8765/games/magic/#t=archetypes`.
  - Closed cluster card = 2x2 thumbnail preview of top 4 cards.
  - Open cluster card = n×n grid spans at three discrete sizes (anchor 6×6, medium 4×4, small 2×2) on col-width 22px × row-height 30px (card aspect 0.72), dense flow, 560px max-width centered. Outer `.cluster-grid` uses `grid-auto-flow: row dense` so siblings reflow when one opens full-width.
  - Lands filtered from clustering input (they cluster by color, not strategy).
  - Search on the tab filters lists by name; cluster also matches when a using-archetype name matches.
  - "Used by archetypes" and "Travels with" sections removed from cluster open view per user.
  - Selected cards from other tabs get red outline in cluster tiles.

- **Stories tab + candidate detector.** `stories.json` is hand-curated narrative; the Stories tab renders current-week stories plus an auto-archive (`renderStoriesArchive`) that collapses older-week stories on its own. `detect_stories.py` runs after the pipeline and emits `story_candidates.json`: a shortlist of metagame movements worth writing up, never finished prose. Flow: detect, human drafts, review together, explicit approval before anything reaches `stories.json`. Schema, the 6 story kinds, and detector thresholds are documented in `games/magic/data/stories.md`. `story_candidates.json` is a curator artifact, not loaded by the frontend.

## Decisions pending

- **Meta Map removed 20-05-2026.** The UMAP deck scatter was an illegible data dump; deleted, not reworked. The Archetypes tab is now archetype list + cluster list only. No replacement viz built.
- **Matchup data is the real gap.** The site shows prevalence, not performance. A field-share view is buildable from current data; a matchup matrix is not (the scrape has decklists, no match results). melee.gg scraping is the non-dodgy path to a matchup matrix but is a sizeable pipeline project; MTGO Challenge standings give a cheaper per-archetype win-rate. Both deferred as too big for now.
- **Sankey view** (archetype → cluster mix flows) remains an option for the "archetype is a mixture" thesis. Not scheduled.

## Gotchas

- Lands must stay filtered from clustering input or clusters collapse onto color buckets.
- `synergy-score.html` shares `magic.css`; keep selectors that don't conflict with its `.ss-*` scope. Moved into `games/magic/` 18-05-2026.

## Audit findings (20-05-2026), resolved

Surfaced during a full-site audit sweep on 20-05-2026, all fixed same day.

- HANDOFF Archetypes-status contradiction reconciled (all 4 tabs marked live).
- `loadFull()` rejection now caught: sets `fullLoadFailed`, `fillDatasetStamp()` appends a red "dataset partially loaded" warning to the footer.
- Hover preview image built via DOM (`createElement`/`replaceChildren`) instead of `innerHTML` templating; no XSS surface if an upstream is ever swapped for untrusted input.
- Hover preview image `alt` now set to the card name.

## Recent session log

- 18-05-2026: Folder reorg: magic + data + synergy-score moved into `games/magic/`. Old paths deleted.
- 18-05-2026: Archetypes tab grid math finalised (three discrete sizes, dense flow). HANDOFF carved out from root.
- 18-05-2026: `.github/workflows/magic-weekly.yml` repointed at new `games/magic/data/` paths, added `cluster.py` step + numpy/sklearn install. Runs Tuesdays 12:00 UTC (after magic.gg's Monday ladder post). Premier events (Champions Cup, RC, Spotlight, Magic Series, etc.) come in automatically via `/decklists` and `/news` index discovery in `scrape.py`.
- 18-05-2026: Archetypes tab pass: travels-with row (top 3 partner clusters by p_cond) inside open cluster cards; in-place card panel when clicking a tile in an open cluster (image + cost + type + oracle + add/jump actions); hide-single-cluster-archetypes toggle (default ON, top-weight≥0.85 threshold); cluster dedupe in `cluster.py` via cosine on full H rows (threshold 0.6). 16→14 clusters: c0+c15 (Izzet Prowess variants) and c1+c13 (MG Landfall variants) merged. Classification accuracy unchanged at 0.868.
- 18-05-2026: **Meta Map** added at the top of the Archetypes tab. 2D UMAP projection (cosine on L1-normalised W rows, n_neighbors=15, min_dist=0.18) of every unique deck in cluster-weight space. SVG render. Points coloured by dominant cluster, sized by source weight (ladder small → PT Top 8 big). Cluster regions as soft circles sized by spread + member count. Centroid labels show top card per cluster. Controls: source-weight filter, week-start filter, cluster-pairing arcs toggle, reset view. Drag to pan, scroll to zoom (cursor-anchored). Hover any point → tooltip with archetype/event/week/mix. Click → side panel with full decklist (resolves via `meta_map.decks[i].raw` → `decks_raw.json`). Legend doubles as a cluster filter. Tab-local search query highlights matching archetypes/titles on the map. Adds `umap-learn` dep to `magic-weekly.yml`. The legend + side panel sit in a 240px right column; canvas is 580px tall on desktop, collapses to a stacked layout below 900px.
- 20-05-2026: Meta Map (UMAP scatter) deleted. Removed `renderMetaMap*` / `wireMetaMap` / map state / the experimental alpha gate from `magic.js`, `.meta-map-*` + `.experimental-*` from `magic.css`, the UMAP section from `cluster.py`, `umap-learn` from `magic-weekly.yml`. `clusters.json` no longer carries `meta_map` (15547 → 1965 lines). Archetype-tab pass (in-place card panel, hide-pure toggle, cluster dedupe) kept and now committable clean.
- 20-05-2026: Smoke-tested the pipeline end to end on a fresh pull (3289 decks, data through week 18-05). Fixed two `scrape.py` bugs: a magic.gg CMS id leaking into a card name (`Kaito, Bane of Nightmares [bGPbmuxtex3AmlffwZUqv]`, now stripped via `ID_SUFFIX_RE`), and the Tokyo Champions Cup page mislabeling its `event_name` as Kyoto (`fix_event_name` trusts the slug city over the HTML attribute). Re-ran enrich/analyze/cluster clean (17 clusters, classification 0.92, 0 unresolved cards).
- 20-05-2026: Story candidate detector added. `detect_stories.py` runs after `cluster.py` in `magic-weekly.yml` and emits `story_candidates.json` for 5 of 6 story kinds (`color-gap` stays manual). `data/stories.md` documents the schema, kinds, thresholds, and the detect/draft/review/approve flow. Stories are never auto-pushed; `stories.json` stays out of the workflow commit list.
