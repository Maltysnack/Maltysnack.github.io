# games HANDOFF

Index for `/games/`. Each game owns its own HANDOFF when non-trivial. Root `HANDOFF.md` covers site-wide.

## Subprojects

- [`magic/HANDOFF.md`](magic/HANDOFF.md): Magic meta-explorer (Archetypes tab in flight). Synergy-score now lives inside here.
- [`duoclue/HANDOFF.md`](duoclue/HANDOFF.md): Duoclue

## Current state (as of 18-05-2026)

- Folder reorg 18-05-2026: `games/magic.{html,js,css}` + `games/data/` + `games/synergy-score.html` collapsed into `games/magic/`. `projects/duoclue/` moved to `games/duoclue/`. Old paths deleted outright (no redirects: site has no inbound traffic).
- `dnd/` sits at the repo root, not under `/games/`, but the sidebar groups it here. Don't move without a redirect plan.

## Gotchas

- macOS case-insensitive FS: keep folder names lowercase and consistent.
