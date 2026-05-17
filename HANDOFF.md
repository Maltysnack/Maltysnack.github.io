# HANDOFF

Site-wide scratchpad. Read first thing each session, update last thing.

Project-specific state lives in each project's own HANDOFF. This doc covers cross-cutting concerns only. Never add an "In flight" or "Decisions pending" item to this doc for a specific page; put it in that page's HANDOFF.

## Project handoffs

- [`dnd/HANDOFF.md`](dnd/HANDOFF.md): character sheet subsystem
- [`games/HANDOFF.md`](games/HANDOFF.md): Magic meta-explorer (in flight), synergy-score
- [`projects/HANDOFF.md`](projects/HANDOFF.md): happyhour, coffeetime, worldcup, algorithms (loose pages)
- [`projects/fpl/HANDOFF.md`](projects/fpl/HANDOFF.md): FPL tracker
- [`projects/flox/HANDOFF.md`](projects/flox/HANDOFF.md): flox docs
- [`projects/duoclue/HANDOFF.md`](projects/duoclue/HANDOFF.md): duoclue
- [`wren/HANDOFF.md`](wren/HANDOFF.md): Wren persona, runlog, cron
- [`api/HANDOFF.md`](api/HANDOFF.md): Vercel functions

## Current state (as of 18-05-2026)

- Site is in good shape and linked in job applications.
- Tone bar: see `CLAUDE.md` "Context".
- Repo lives at `/Users/milo/Documents/Maltysnack.github.io` (moved 18-05-2026 from `/Documents/GitHub/`; old `~/maltysnack-site` clone retired).

## Site-wide infrastructure

- Pages auto-listed in `README.md` from `<meta name="description">` per page. Run `python3 scripts/build-readme.py` after adding or renaming a sidebar page.
- Layout system: `data-layout="prose|page|wide|full"` on `<main>`. Don't hardcode max-widths.
- Favicons: `sidebar.js` injects them via `FAVICON_VERSION`. Bump there when icons change.
- Pre-commit hook: `scripts/hooks/pre-commit`. Activate per clone with `git config core.hooksPath scripts/hooks`.
- Sanitize: `scripts/sanitize.sh` runs in CI and pre-commit.

## Decisions pending (cross-cutting)

- **Loose-page reorg.** Several projects sit as loose files at the parent-folder level (`games/magic.{html,js,css}`, `projects/happyhour.html`, `projects/coffeetime.html`, `projects/worldcup.html` + 4 json, `projects/algorithms.html` + 5 algo files). Plan is to move each into its own folder (e.g. `projects/worldcup/index.html` + data) so each project owns its scope. URL stability matters (site is linked in job apps), so this needs redirect stubs from the old paths. Do as a follow-up, one project at a time, not in a single sweep.

## Cross-cutting gotchas

- **macOS case-insensitive FS silently merges `handoff.md` and `HANDOFF.md`.** Always uppercase.
- **Multiple Claude sessions push in parallel.** Pull-rebase before non-trivial edits to shared files (`sidebar.js`, `index.html`, `style.css`, `CLAUDE.md`, root `HANDOFF.md`, `README.md`).
- **Force-pushed identity rewrites** happen when consolidating author/committer history. If local is stale: `git fetch && git reset --hard origin/main`.
- **Co-author trailer is Wren**, not Claude: `Co-Authored-By: Wren <wren@maltysnack.dev>`. CLAUDE.md spells this out.
- A handful of past commits show maltysnack's profile display name as the author rather than `maltysnack`. Same email, same account on GitHub.
