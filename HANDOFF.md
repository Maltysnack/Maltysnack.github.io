# HANDOFF

Living scratchpad. Read first thing each session, update last thing.

## Current state (as of 13-05-2026)

- Site is in good shape and being linked in job applications.
- Tone bar in `CLAUDE.md` under "Context": personal but not edgy.
- Pages auto-listed in `README.md` from `<meta name="description">` per page. Run `python3 scripts/build-readme.py` after adding or renaming a sidebar page.
- Layout system: `data-layout="prose|page|wide|full"` on `<main>`. Don't hardcode max-widths.
- Favicons: `sidebar.js` injects them via `FAVICON_VERSION`. Bump there when icons change.
- Wren routine fires Wed + Sun ~09:00 Melbourne. Logs every run (ship or skip) to `/wren/_runlog.md`.
- Editorial sanitize routine fires Sun ~10:00 Melbourne. Quiet janitor sweep.
- Pre-commit hook lives at `scripts/hooks/pre-commit`. Activate per clone with `git config core.hooksPath scripts/hooks`.

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

- The browser FPL formula in `projects/fpl/index.html` is duplicated in `projects/fpl/sync.js`. They must stay aligned. Calibration relies on the Node version producing the same numbers the browser would.
- A handful of past commits show maltysnack's GitHub profile display name as the author rather than `maltysnack`. Same email, so they map to the same account on GitHub. Future commits via the web UI inherit the profile name; maltysnack has decided this is fine.
- Vercel functions in `api/upload.js` and `api/update.js` need an explicit `committer`/`author` payload to commit as `maltysnack` rather than the PAT owner's profile. Already done; if a future edit removes those fields, the upload PRs will start showing the profile display name again.
- The two flox docs pages and projects/fpl/index.html use `data-layout="full"`. Don't accidentally drop the attribute when editing those files.

## Things that would surprise the next session

- `dnd/.claude/launch.json` is occasionally untracked and re-appears as a warning in sanitize. Safe to ignore.
- Force-pushed history rewrites happen on this repo when consolidating identity. If you have a stale local clone after one, `git fetch` then `git reset --hard origin/main`.
- Multiple Claude sessions push in parallel. Pull-rebase before non-trivial edits to shared files (`sidebar.js`, `index.html`, `style.css`, `CLAUDE.md`, `README.md`).
- **Case-insensitive macOS filesystem will silently merge `handoff.md` and `HANDOFF.md`.** Always use the uppercase `HANDOFF.md` for this file. If you `Write` lowercase, you overwrite the existing one.
- **Co-author trailer should be `Co-Authored-By: Wren <wren@maltysnack.dev>`**, not Claude. CLAUDE.md spells this out. Several recent commits used the wrong trailer; doesn't break CI but worth fixing forward.
