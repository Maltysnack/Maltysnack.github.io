# games HANDOFF

Index for `/games/`. Root `HANDOFF.md` covers site-wide concerns.

## Subprojects

- [`dnd/HANDOFF.md`](dnd/HANDOFF.md): D&D character sheet engine
- [`duoclue/HANDOFF.md`](duoclue/HANDOFF.md): Duoclue, a Next.js static export

## Removed 15-10-2026

`magic/` (the Magic: The Gathering meta-explorer, including synergy-score and
its data) was deleted, along with the `magic-weekly` workflow. Recoverable
only from the pre-reset archive in `~/Documents/maltysnack-archive/`.

## Queued

**Duoclue is being rethought as a suite of phone-playable board games** with
one shared visual language. maltysnack's notes: the word bank needs to be far
bigger, the map visuals are poor and load badly on mobile, and the hard
problem to solve once and reuse is showing a large board with many locations
and pieces legibly on a small screen. That is a design-system problem first
and a content problem second, and it needs its own brainstorm before a second
game is built.

## Gotchas

- macOS case-insensitive FS: keep folder names lowercase and consistent.
- Duoclue is a built Next.js export. Its `_next/` bundles are generated; do
  not hand-edit them, and they are excluded from the sanitation sweep.
