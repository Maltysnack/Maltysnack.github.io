# HANDOFF

Site-wide scratchpad. Read `CLAUDE.md` first, then this, then the HANDOFF for
whatever folder you are touching.

Project-specific state lives in each project's own HANDOFF. This doc covers
cross-cutting concerns only.

## There are two sites

| | This repo | The portfolio |
|---|---|---|
| What | maltysnack's hobby site | The professional portfolio |
| URL | `maltysnack.github.io`, live | Local only, no domain yet |
| Repo | Public, `Maltysnack/Maltysnack.github.io` | `~/Documents/portfolio`, not pushed anywhere |
| Identity | `maltysnack`, never the real name | Real name, never `maltysnack` |
| Stack | Plain HTML, no framework, GitHub Pages | Astro 5, static |
| Layout | Normal scrolling pages | Every page is a no-scroll deck |
| Contents | Everything | A curated subset |

**They share one design** (palette, type, top bar) and are meant to look like
one person made them. They do not share layout: this site scrolls, that one
does not.

**Git identity is set per repo.** That is the mechanism that stops the two
mixing, and it matters: 30 commits in this repo's history once carried the
real name and a personal Gmail. The repo was deleted and recreated on
15-10-2026 with a single clean commit to remove them. Do not undo that.

Nothing in this repo may reference the portfolio. The dependency runs one
way: the portfolio reaches across to here, never the reverse.

## Design system

`design/palette.css` is the **canonical source of colour and type for both
sites**. Edit colours or fonts there, never in `style.css`, or the two sites
drift. `style.css` imports it and holds only site-specific tokens: sidebar
colours, type scale, spacing, layout widths.

The portfolio copies the file in with its own `npm run sync:design`
(`--check` verifies it is current without writing, for CI).

- Display: Fraunces. Body: Inter. Figures: JetBrains Mono, tabular.
- Accent `#a83b2a` light, `#e0705a` dark.
- Chrome is a **top bar**, not a sidebar. Pages still ship
  `<aside class="sidebar">`; `sidebar.js` fills it with bar markup and
  `style.css` lays it out horizontally, so site-wide chrome changes need no
  page edits.

## Cache-busting is mandatory

`style.css`, `sidebar.js`, `sheet.js` and the algorithm modules all carry
`?v=N`. **Bump the version in every referencing page whenever you change
one.**

This has silently hidden finished work three times: the D&D sheet engine, the
algorithm modules, and an entire redesign that looked like it had never
deployed. If a change "isn't live", check this before anything else. Confirm
with `curl` what the server actually serves rather than trusting a browser.

## Project handoffs

- [`projects/HANDOFF.md`](projects/HANDOFF.md): projects index
  - [`projects/fpl/HANDOFF.md`](projects/fpl/HANDOFF.md): FPL bot dashboard
  - [`projects/worldcup/HANDOFF.md`](projects/worldcup/HANDOFF.md): World Cup 2026
  - [`projects/flox/HANDOFF.md`](projects/flox/HANDOFF.md): Flox language
  - [`projects/algorithms/HANDOFF.md`](projects/algorithms/HANDOFF.md): algorithm visualisations
  - [`projects/flock/HANDOFF.md`](projects/flock/HANDOFF.md): flock simulator
- [`games/HANDOFF.md`](games/HANDOFF.md): games index
  - [`games/dnd/HANDOFF.md`](games/dnd/HANDOFF.md): D&D character sheet
  - [`games/duoclue/HANDOFF.md`](games/duoclue/HANDOFF.md): Duoclue

## Current state (26-10-2026)

Live and working. Seven pages in the nav: FPL, World Cup, Flox, Algorithms,
Flock, dnd, Duoclue.

**Removed 15-10-2026** and recoverable only from the pre-reset archive:
Wren (persona, runlog, weekly cron), the Shelf and its writings,
`negative-space.html`, Magic: The Gathering, Happy Hour, Coffee Time,
Filmclub, and Flox's dormant Stripe/Supabase layer. The README generator
(`scripts/build-readme.py`) still exists; `README.md` is generated from each
page's `<meta name="description">`.

**Archive of everything before the reset:** `~/Documents/maltysnack-archive/`
holds two verified git bundles with the full 666-commit history and a
worktree snapshot. Local branch `archive/pre-reset-history` has the old
commits too.

## Site-wide infrastructure

- Layout system: `data-layout="prose|page|wide|full"` on `<main>`. Do not
  hardcode max-widths.
- Favicons: `sidebar.js` injects them via `FAVICON_VERSION`. Bump there when
  icons change.
- Pre-commit hook: `scripts/hooks/pre-commit`. Activate per clone with
  `git config core.hooksPath scripts/hooks`.
- Sanitise: `scripts/sanitize.sh` runs in CI and pre-commit. Check `[9]`
  resolves every JS module import, which plain link-checking misses: a page
  can return 200 while being broken at runtime.

## Decisions pending

- **Duoclue has no top bar.** It is a Next.js export with its own chrome, so
  on every screen size there is no way back to the rest of the site except
  the browser. Add the bar, or leave it a standalone full-screen game.
- `.github/workflows/sync-fpl.yml.disabled` is left untracked on purpose.
  See `projects/fpl/HANDOFF.md`.

## Decided

- **Data repos own a `DISPLAY.md` (26-10-2026).** Any repo that publishes to
  this site (FPL engine, worldcup) keeps a `DISPLAY.md` at its root saying
  what the page shows and why: the point, the headline, panels in priority
  order, what never to show, the data contract, the voice. The rule lives in
  the global `~/.claude/CLAUDE.md`, so new sessions in those repos maintain it.
  Before building or redesigning a data page here, read the source repo's
  `DISPLAY.md` first; this repo owns only the design. If there is none, ask
  for one rather than guessing. This came from the FPL single-screen
  dashboard, which picked panels without a brief and read as random data.

- **No-scroll is per page, not site-wide (23-10-2026).** The home page and
  the FPL dashboard fit the viewport. World Cup, Duoclue and the D&D sheet are
  apps with their own layouts, and Flox and Algorithms are reading pages; all
  of those scroll. Making a page fit is a redesign of that page (drop panels,
  do not shrink them), never a global CSS switch.

## Recent session log

- **26-10-2026 (later):** D&D rebuilt: characters made with a form and kept in
  the browser, save files for backup, sheet on the site palette. `api/`,
  Vercel config and the upload pipeline deleted; nothing on this site runs on
  Vercel any more. See `games/dnd/HANDOFF.md`.

- **26-10-2026:** Algorithms reframed: an intro line and a "What it shows"
  line per demo, TSP now draws a dashed reference tour (Held-Karp, proven
  optimal up to 15 cities, 2-opt above) and reports the gap, demos autorun
  when their board scrolls into view; modules at `?v=15`. Phone audit of the
  whole site: Algorithms buttons wrap under 480px, everything else fits
  except the two items in Decisions pending. Flox repo `CLAUDE.md` now points
  at `projects/flox/` here. DISPLAY.md rule added (see Decided). World Cup v2
  merged by its own session.

- **23-10-2026 (later):** FPL rebuilt as a single-screen dashboard. Flox cut
  to one page of live examples; playground and docs routes deleted. No-scroll
  settled as per page (see Decided). New Flock page (3D boids, vendored
  three.js); `sidebar.js` bumped to `?v=4` on every page for the nav entry.
  `style.css` to `?v=7`: on phones the nav scrolls sideways inside the bar
  (seven links overflowed the page) and home cards go two per row so all
  seven fit. Then `style.css` v8 and `sidebar.js` v5: the nav fades at its
  right edge on phones and scrolls the current page's link into view.
- **23-10-2026:** Home page made no-scroll (`<body class="fit">`), cards laid
  out as a grid; avatar restored to the bar. All docs and HANDOFFs brought
  up to date. Shared design system. `design/palette.css` made canonical
  for both sites; duplicate declarations stripped from `style.css` (they came
  after the import and would have silently won). Sidebar replaced by the
  portfolio's top bar across all pages. `style.css` and `sidebar.js`
  versioned.
- **22-10-2026:** D&D persistence fixed: editable fields committed only on
  blur, which does not fire on tab close, app switch or phone sleep, so a
  session's HP was lost. Unsubmitted add-item text now persists too.
  Algorithms: TSP draws the whole population (it ran invisibly and drew only
  the final tour), search paced so convergence is watchable, wall generation
  changed from uniform noise to grown segments, tile playback slowed with a
  speed control and step-through. FPL `PUBLISH_PAT` re-granted after the repo
  recreate; sync healthy again.
- **15-10-2026:** Repo deleted and recreated to scrub 30 commits carrying the
  real name and personal email, plus 9 pull requests. Sections removed per
  the list above. Flox gallery deleted (it imported a module removed with the
  cloud layer, so the page returned 200 while broken).

## Cross-cutting gotchas

- **macOS case-insensitive FS silently merges `handoff.md` and
  `HANDOFF.md`.** Always uppercase.
- **Multiple Claude sessions push in parallel.** Pull-rebase before
  non-trivial edits to shared files (`sidebar.js`, `index.html`, `style.css`,
  `design/palette.css`, `CLAUDE.md`, this file, `README.md`).
- **`.claude/launch.json` is gitignored but was once tracked.** It holds a
  local path to the portfolio. Never commit it; that would publish the link
  between the two sites.
- A later CSS rule only overrides the properties it actually declares. The
  top bar needed an explicit `flex-direction: row` because the earlier
  `.sidebar` rule set `column`.
