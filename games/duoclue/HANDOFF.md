# duoclue HANDOFF

Scratchpad for `/games/duoclue/`. Parent `games/HANDOFF.md` lists sibling games; root `HANDOFF.md` covers site-wide.

## Current state (as of 18-05-2026)

- Self-contained page with its own design system (skips `/style.css`).
- Moved 18-05-2026 from `/projects/duoclue/` to `/games/duoclue/` (sidebar already groups it under Games). Old path deleted.
- **Next.js asset paths bumped 18-05-2026.** The static export had `assetPrefix: "/projects/duoclue"` baked into HTML + JS chunks + CSS, so the page rendered unstyled at the new path. All `/projects/duoclue` → `/games/duoclue` swept across html/js/css/txt. If the upstream Duoclue repo is rebuilt and re-exported, set `assetPrefix: "/games/duoclue"` (next.config.js) before exporting, or repeat this sweep.
- No in-flight work.
