# HANDOFF

Site-wide scratchpad. Read first thing each session, update last thing.

Project-specific state lives in each project's own HANDOFF. This doc covers cross-cutting concerns only. Never add an "In flight" or "Decisions pending" item to this doc for a specific page; put it in that page's HANDOFF.

## Project handoffs

- [`games/HANDOFF.md`](games/HANDOFF.md): games index
  - [`games/magic/HANDOFF.md`](games/magic/HANDOFF.md): Magic meta-explorer (Archetypes in flight)
  - [`games/duoclue/HANDOFF.md`](games/duoclue/HANDOFF.md): Duoclue
  - [`games/dnd/HANDOFF.md`](games/dnd/HANDOFF.md): character sheet subsystem
- [`projects/HANDOFF.md`](projects/HANDOFF.md): projects index
  - [`projects/fpl/HANDOFF.md`](projects/fpl/HANDOFF.md): FPL Predicted XI
  - [`projects/happyhour/HANDOFF.md`](projects/happyhour/HANDOFF.md): Happy Hour
  - [`projects/coffeetime/HANDOFF.md`](projects/coffeetime/HANDOFF.md): Coffee Time
  - [`projects/worldcup/HANDOFF.md`](projects/worldcup/HANDOFF.md): World Cup 2026
  - [`projects/algorithms/HANDOFF.md`](projects/algorithms/HANDOFF.md): algorithm visualisations
  - [`projects/flox/HANDOFF.md`](projects/flox/HANDOFF.md): Flox docs
- [`wren/HANDOFF.md`](wren/HANDOFF.md): Wren persona, runlog, cron (covers `/shelf/` too)
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

- ~~Loose-page reorg.~~ Done 18-05-2026: magic, duoclue, dnd, happyhour, coffeetime, worldcup, algorithms all now own their folder + HANDOFF. No redirect stubs (site has no inbound traffic from old URLs).

## Cross-cutting gotchas

- **macOS case-insensitive FS silently merges `handoff.md` and `HANDOFF.md`.** Always uppercase.
- **Multiple Claude sessions push in parallel.** Pull-rebase before non-trivial edits to shared files (`sidebar.js`, `index.html`, `style.css`, `CLAUDE.md`, root `HANDOFF.md`, `README.md`).
- **Force-pushed identity rewrites** happen when consolidating author/committer history. If local is stale: `git fetch && git reset --hard origin/main`.
- **Co-author trailer is Wren**, not Claude: `Co-Authored-By: Wren <wren@maltysnack.dev>`. CLAUDE.md spells this out.
- A handful of past commits show maltysnack's profile display name as the author rather than `maltysnack`. Same email, same account on GitHub.
