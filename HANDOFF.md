# HANDOFF

Living scratchpad. Read first thing each session, update last thing. Overwrite freely; this is a snapshot, not a log.

> **For anything dnd-related, see [`/dnd/HANDOFF.md`](dnd/HANDOFF.md).** That subsystem has its own scratchpad; this doc stays site-wide.

## Current state (as of 18-05-2026)

- Site is in good shape and being linked in job applications.
- Tone bar in `CLAUDE.md` under "Context": personal but not edgy.
- Pages auto-listed in `README.md` from `<meta name="description">` per page. Run `python3 scripts/build-readme.py` after adding or renaming a sidebar page.
- Layout system: `data-layout="prose|page|wide|full"` on `<main>`. Don't hardcode max-widths.
- Favicons: `sidebar.js` injects them via `FAVICON_VERSION`. Bump there when icons change.
- Wren routine fires Wed + Sun ~09:00. Logs every run (ship or skip) to `/wren/_runlog.md`.
- Editorial sanitize routine fires Sun ~10:00. Quiet janitor sweep.
- Pre-commit hook lives at `scripts/hooks/pre-commit`. Activate per clone with `git config core.hooksPath scripts/hooks`.

## Recently shipped (happyhour / coffeetime track)

- **happyhour + coffeetime pages**: cinematic full-bleed slideshow per city. Photo via `happyhour-proxy.vercel.app` (Vercel proxy hides Unsplash key). Weather via Open-Meteo. ~280 cities embedded inline. Drinks/coffees curated for ~150 cities. Local-language toasts/greetings. Real flagcdn flags. Regional minimap (continent-zoomed). Sequential fade-through-dark transition (4.5s fade, 600ms gap). 12hr time. Sister-link toggle (`happyhour. · coffeetime`) next to wordmark; coffeetime is an easter egg, not in sidebar/index. Empty state cross-recommends.
- **Photo quality bump (last change shipped)**: proxy now builds image URL from `urls.raw` with `w=2400&q=85` default (`?res=widget` returns 1080w/q82). Was using `urls.regular` (1080w fixed) which looked upscaled on retina/1440+.
- **Scriptable widgets** at `widgets/{happyhour,coffeetime}.js`. User asked these be **frozen** &mdash; do not update unless explicitly requested. Website-only focus from here.

## In flight

- **Magic meta-explorer Archetypes tab (LOCAL ONLY, do not push).** New 4th tab on `/games/magic.html`. Uses NMF clustering of recent decks to discover card packages.
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
- **In-place card panel on Archetypes.** Clicking a tile should not jump to Cards tab. Open a card-cluster panel inline.
- **2D force-directed graph view** as sub-toggle in Archetypes (D3). Benched per user, keep in mind.
- **Travels-with mini graph lines** inside cluster cards (SVG, opacity = co-occurrence).
- **Story signal detector in cron** + Tuesday GitHub-issue auto-open. Before next data refresh.

## Gotchas

- The browser FPL formula in `projects/fpl/index.html` is duplicated in `projects/fpl/sync.js`. They must stay aligned.
- A handful of past commits show maltysnack's profile display name as the author rather than `maltysnack`. Same email, maps to the same account on GitHub.
- Vercel functions in `api/upload.js` and `api/update.js` need an explicit `committer`/`author` payload to commit as `maltysnack` rather than the PAT owner's profile. Already done; if removed, upload PRs revert to showing the PAT owner's display name.
- The two flox docs pages and `projects/fpl/index.html` use `data-layout="full"`. Don't accidentally drop the attribute.

## Things that would surprise the next session

- Force-pushed history rewrites happen when consolidating identity. If your local is stale after one, `git fetch && git reset --hard origin/main`.
- Multiple Claude sessions push in parallel. Pull-rebase before non-trivial edits to shared files (`sidebar.js`, `index.html`, `style.css`, `CLAUDE.md`, `HANDOFF.md`, `README.md`).
- **Case-insensitive macOS filesystem will silently merge `handoff.md` and `HANDOFF.md`.** Always use uppercase. If you `Write` lowercase, you overwrite the existing one.
- **Co-author trailer should be `Co-Authored-By: Wren <wren@maltysnack.dev>`**, not Claude. CLAUDE.md spells this out.
