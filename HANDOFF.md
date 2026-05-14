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

- Nothing maltysnack is mid-edit on right now.

## Decisions pending

- (none yet)

## Gotchas

- The browser FPL formula in `projects/fpl/index.html` is duplicated in `projects/fpl/sync.js`. They must stay aligned. Calibration relies on the Node version producing the same numbers the browser would.
- A handful of past commits show maltysnack's GitHub profile display name as the author rather than `maltysnack`. Same email, so they map to the same account on GitHub. Future commits via the web UI inherit the profile name; maltysnack has decided this is fine.
- Vercel functions in `api/upload.js` and `api/update.js` need an explicit `committer`/`author` payload to commit as `maltysnack` rather than the PAT owner's profile. Already done; if a future edit removes those fields, the upload PRs will start showing the profile display name again.
- The two flox docs pages and projects/fpl/index.html use `data-layout="full"`. Don't accidentally drop the attribute when editing those files.

## Things that would surprise the next session

- `dnd/.claude/launch.json` is occasionally untracked and re-appears as a warning in sanitize. Safe to ignore.
- Force-pushed history rewrites happen on this repo when consolidating identity. If you have a stale local clone after one, `git fetch` then `git reset --hard origin/main`.
- Multiple Claude sessions push in parallel. Pull-rebase before non-trivial edits to shared files (`sidebar.js`, `index.html`, `style.css`, `CLAUDE.md`, `README.md`).
