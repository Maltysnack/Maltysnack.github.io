# Portfolio overhaul: design

**Date:** 15-10-2026
**Status: SUPERSEDED 23-10-2026. Kept for the reasoning, not the plan.**

> This spec assumed **one site**, pseudonymous, with the overhaul applied to
> this repo. That is no longer the plan. What actually happened:
>
> - **Two sites.** This repo stayed the hobby site; a separate portfolio
>   repo (`~/Documents/portfolio`, Astro, real name) was created. See
>   `CLAUDE.md` and the root `HANDOFF.md`.
> - **The pseudonym was already broken.** 30 commits carried the real name
>   and a personal Gmail, so the repo was deleted and recreated.
> - **Filmclub is excluded for a different reason** than recorded below:
>   it is no longer deployed and the link is dead.
> - **World Cup is out of scope**; maltysnack handles it separately.
> - **Both sites share one design** (`design/palette.css`), which this spec
>   did not anticipate.
> - **No-scroll is a ground rule** for the portfolio and for this site's
>   home page. The rest of this site still scrolls.
>
> Sections 6 to 9 (Flox, Algorithms, FPL, tooling) are still the live plan
> and most of Algorithms and the tooling work is done.
**Scope:** site shell, Flox, Algorithms, FPL. World Cup and the Lab experiments are out of scope.

---

## 1. Purpose

`maltysnack.github.io` becomes a portfolio site, submitted in the "personal website"
field of job applications. The current site presents itself as "a small site by
maltysnack. Films, projects, games, and a slow gallery". That framing reads as a
hobby site. The work underneath it is stronger than its presentation.

**Audience:** a graduate and associate developer hiring panel, plus a
non-technical screener who sees the site first. Both skim. The site has roughly
ninety seconds to establish that the person behind it can build and reason about
software.

**Success criteria:**

1. A reviewer who spends ninety seconds on the site leaves able to name what was
   built and why it is not trivial.
2. Nothing on the site needs an apology or an explanation of why it is unfinished.
3. maltysnack is willing to attach the URL to an application without hesitating.

**Non-goals.** Not a blog. Not a CV. No about page, no biography, no contact
details, no outbound links. The site carries what was built; the resume carries
who built it.

---

## 2. Decisions already taken

These were settled in brainstorming. Recorded with rationale so a later session
does not relitigate them.

| Decision | Rationale |
|---|---|
| Stays pseudonymous as `maltysnack` | maltysnack's call, made with the tradeoff stated: a reviewer cannot connect the site to an application. |
| Filmclub excluded entirely | maltysnack's call, made with the tradeoff stated: it is the strongest shipped evidence available. |
| No contact details, no GitHub link | maltysnack's call. Consequence: no path from the site to commit history, so the FPL sync cadence and the World Cup forecast timestamp cannot be independently verified by a reviewer. Footer is built so a link can be added in one line. |
| Astro, static output | Absorbs existing pages nearly unchanged. One source of truth for nav and tokens. |
| Plain CSS with custom properties, no Tailwind | Load-bearing. Every existing page already styles via `var(--token)`. Token-only changes port those pages; Tailwind would force rewrites. |
| Domain deferred | Lowest priority. `astro.config.mjs` carries a single `site` value to change later. |
| Australian spelling, enforced in CI | Site-wide and permanent. |

---

## 3. Information architecture

```
/                  home: short intro, project cards with live preview thumbnails
/football/         index: forecasting under uncertainty, the shared premise
/football/fpl/     the autonomous bot, single-screen dashboard
/football/worldcup/  OUT OF SCOPE, route reserved, page untouched
/flox/             one page: what it is, worked examples, interactive
/algorithms/       three demos, restructured for a ninety-second read
/lab/              index for new experiments
```

`/projects/` disappears as a path segment. It added a level without adding
meaning. The root `HANDOFF.md` records that the site has no inbound traffic from
old URLs, so no redirect stubs are needed.

**Navigation** is a slim persistent top bar: `maltysnack` at left as the home
link, then Football, Flox, Algorithms, Lab. Four items, no dropdowns, no
hamburger above 600px. `sidebar.js` and the sidebar pattern are retired.

Football is a real index page rather than a dropdown because the two football
projects share a premise worth stating once: both are forecasts that are later
checked against what actually happened.

---

## 4. Visual language

The current site reads as amateur mainly because every page is set in one
typeface at three sizes with no editorial structure. Type is the lever.

- **Display:** a serif (Newsreader or Fraunces) for page titles and section
  openers. One serif headline over sans body separates a designed site from a
  defaulted one, and an editorial serif suits writing about models and forecasts.
- **Body:** Inter. Already loaded, already doing its job.
- **Figures:** JetBrains Mono for every number, score, probability and code
  sample, with tabular numerals so columns of probabilities align.

**Colour** moves off the current generic red to a single restrained accent
against warm paper in light mode and deep ink in dark. A separate **data
palette** is defined alongside the UI palette: one categorical set, one
sequential ramp, one diverging ramp, all checked for contrast and for
colour-blind safety. Most of this site is charts, so chart colour is a design
system in its own right and is specified, not improvised per page.

**Layout** is a 12-column grid. Prose holds at roughly 68 characters.
Visualisations go full-bleed and break the text column. That contrast between
tight text and wide data is where the perceived quality comes from.

**Motion** is minimal. Transitions on interaction only. No scroll-triggered
reveals; they age badly and they slow a reviewer who is skimming.

**Watermark.** The Rule 30 mark is kept, bottom-right, unlinked and
unexplained. It is hand-written inline SVG, not an image: an elementary
cellular automaton run for seven generations across eleven cells from a single
seed, with the seed shown in accent red. Standalone vector copies live at
`assets/rule30.svg`, `assets/rule30-currentcolor.svg` and `assets/rule30.pdf`,
generated from an actual simulation so the geometry matches.

---

## 5. Technical approach

**Astro 5, no UI framework.** No React, no Vue. Interactive pieces stay as plain
`<script>` tags and ES modules, which is what Algorithms already is.

**No Tailwind.** See section 2.

**Deploy:** one GitHub Action builds Astro and publishes to Pages. Add
`.nojekyll`. URL stays `maltysnack.github.io` until a domain is chosen.

**FPL data flow is preserved.** A private engine pushes `dashboard.json` into
this repo twice daily. That file moves to `public/data/fpl/` and the page keeps
fetching it at runtime, so the sync workflow needs only a path change and the
bot is never blocked on a site build.

### Deleted

`wren/` including the persona, `_runlog.md` and the weekly report cron;
`shelf/` and all its writings including `negative-space.html` and
`langtons-ant.html`; `games/magic/`; `projects/happyhour/`;
`projects/coffeetime/`; `films/`; `sidebar.js`; `_config.yml`;
`scripts/build-readme.py`; `vercel.json`; `vercel-out/`;
`.github/workflows/magic-weekly.yml`; `.github/workflows/build-dnd-index.yml`.

Flox's commercial layer is deleted outright: `api/flox-checkout.js`,
`api/flox-portal.js`, `api/flox-webhook.js`, `projects/flox/cloud/`,
`projects/flox/playground/cloud/`, `projects/flox/GO-LIVE.md`.

All recoverable from git history.

### Deployed but unlinked

Duoclue and D&D stay live at their URLs, reachable by direct link, absent from
all navigation. Each gets `<meta name="robots" content="noindex, nofollow">`
and a `robots.txt` disallow. `api/upload.js` and `api/update.js` are retained
because D&D depends on them.

Consequence to accept: the sanitation orphan check is retired, so nothing
mechanically guarantees these stay unlinked. The spelling and personal-info
checks still cover them.

---

## 6. Flox

**Current state:** 2,036 lines implementing a real three-stage language,
`Scanner` to `Parser` to `Interpreter`, with flow tables, Markov maps, path
tracing and a grid simulation. Presented across four routes as a documentation
site for a product that does not exist.

**Target:** one page. Short description of what Flox is, then two or three
worked examples, then river flow, then Markov chains. Minimal and interactive.
Scope stays small.

The playground, grammar reference and gallery collapse into that single page as
inline editable examples rather than separate routes. The interpreter is
untouched; it is the asset. What changes is that it is presented through a few
small examples instead of a documentation site, and that no product claim is
made anywhere.

Lead with a program and its output side by side, above the fold, so the idea
lands before any prose.

---

## 7. Algorithms

**Current state:** three demos, all working. Sliding-tile puzzle, grid
pathfinding with walls, and TSP via genetic algorithm and ant colony
optimisation. Backed by `algo-core.mjs`, `algo-grid.mjs`, `algo-tile.mjs`,
`algo-tsp.mjs` and an 851-line `algo-viz.js`.

**Problem:** the page demonstrates without explaining, and two of the three
demos are hard to follow. Specific defects, from maltysnack's review:

| Demo | Defect | Fix |
|---|---|---|
| Sliding tile | Runs so fast the behaviour is unreadable. Jumps between states. | Speed control defaulting to slow, a step-through button, and tiles animating between positions so the move is visible rather than only its result. |
| Grid pathfinding | Works well: fast, clear, smooth. Only `randomise walls` produces uniform noise that reads as clutter. | Lower wall density with clustered obstacles. Same difficulty, legible map. |
| TSP | Weakest. Runs 30 ants but draws only the single best tour, so most of the computation is invisible. Also does not reach the optimum, which is mathematically correct but reads as a bug. | Draw the whole population faintly behind the best tour, so candidate solutions are visibly converging. Show the best-known tour alongside and report the gap as a percentage. |

On the TSP optimality point: the page should state plainly that these are
metaheuristics with no optimality guarantee, and that reaching within a few
percent of optimal in milliseconds is the achievement, where exact search is
factorial. Framing the limitation as the lesson converts the page's weakest
moment into its most informative one.

**Structure.** Each demo opens with one sentence naming the problem, runs on
load at a watchable speed, and closes with one line on what it proves. Introduce,
demonstrate, explain, three times. Written for a reviewer with ninety seconds.

---

## 8. FPL

**Current state:** 472 lines. Season line against game average, head-to-head,
locked squad on a pitch, transfer ledger, decision logs, model accuracy
(predicted against actual, pooled bias by position, captaincy hindsight), next
gameweek predictions with bookmaker win probability, and a model card. Fed by
`dashboard.json` from a private engine twice daily.

**Target:** a single dashboard that fits the viewport without scrolling, with
elements sized in proportion to their importance and no wasted space.

That means dropping panels, not shrinking them. Proposed hierarchy:

1. **Model accuracy, largest.** It is the credibility of everything else.
2. **Season line and head-to-head**, medium.
3. **Current squad and next-gameweek summary**, compact.

Removed from the main view: transfer ledger, full decision log, model card.

**Tension to resolve in implementation:** "unscrollable" on a 375px phone and on
a 27in monitor are different layouts. This is a responsive dashboard that fits
each viewport, not one fixed canvas. Below a breakpoint the grid reflows and the
lowest-priority panels are dropped rather than compressed.

**Privacy rule is preserved exactly:** planned transfers, captain and chip for
an undecided gameweek are never published. Squads, transfers and decision logs
appear only once a deadline has passed. This rule is stated on the page, because
a model that publishes before the deadline and never edits afterwards is the
reason the accuracy figures carry any weight.

**Framing:** forecast calibration against market odds, not betting. Same maths,
same bookmaker comparison already present.

---

## 9. Tooling

### sanitise.sh

`scripts/sanitize.sh` is renamed `scripts/sanitise.sh`, along with its CI
workflow and the pre-commit hook.

Four of its eight checks lose their subject in this overhaul: broken internal
links, orphaned pages, and favicon coverage all read `sidebar.js`; README sync
calls `build-readme.py`. All four are removed or rebuilt.

**Retained:** em dashes (fail), junk files (fail), personal information (fail),
profanity (warn).

The personal-information check matters more after this overhaul, not less: with
the site deliberately pseudonymous, it is the only mechanism preventing a
careless paste from publishing a name that was deliberately withheld.

**New:**

- **Astro build must succeed.** Fail on a broken build.
- **Internal links resolve against build output** rather than a hand-maintained
  nav. More accurate than the check it replaces.
- **Australian spelling.** Fail, not warn.

### Australian spelling check

Two tiers, because `color` and `center` are CSS properties and JS identifiers
and a naive grep fails on every stylesheet.

- **Tier 1, prose** (`.md`, and text content in `.astro` and `.html`): full word
  list. `organise`, `optimise`, `analyse`, `recognise`, `customise`, `summarise`,
  `visualise`, `prioritise`, `specialise`, `apologise`; `behaviour`, `colour`,
  `favour`, `labour`; `centre`, `metre`, `theatre`; `licence` and `practice` as
  nouns, `license` and `practise` as verbs; `enrol`, `travelled`, `cancelled`,
  `modelling`, `learnt`; `programme` except a computer program.
- **Tier 2, code** (`.js`, `.mjs`, `.css`, `.astro` script and style blocks):
  narrower list, safe against identifiers. The `-ise`/`-isation` family plus
  `behaviour`, `favour`, `labour`, and `colour` only where it is not a CSS
  property, a custom property name, or part of an identifier.

**Both tiers skip inline code spans and fenced code blocks in Markdown.** This
spec itself demonstrates why: it has to name the CSS properties `color` and
`center` to explain the check, and a checker that cannot tell prose from code
would fail the document describing it.

Known existing violation to fix: `style.css:35` comment reads "your favorite".

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| Porting breaks absolute-path dependencies. Algorithms uses ESM imports and FPL fetches JSON by absolute path; grep finds neither. | Per the repo's own rule on structural moves: for every moved page, run a local server and confirm each asset reference resolves. Non-200 means a hardcoded old path. |
| FPL sync breaks silently. A path change could break a twice-daily job nothing is watching. | Verify the sync end to end after the move, before phase close. |
| "Unscrollable" FPL dashboard proves impossible at some viewport without hiding something important. | Accepted and planned for: panels drop by priority below a breakpoint rather than compress. |
| Spelling check produces false positives in code and becomes noise people disable. | Two-tier design above. Validate against the existing codebase before enabling as a failure. |
| Subagent implementation drifts from this spec. | Each agent briefed to read its project's code and HANDOFF first; work reviewed against this spec before commit. |

---

## 11. Phases

Each phase ends with a working site and a commit.

1. **Scaffold.** Astro installed alongside the current site. Design tokens, top
   bar, home page, Football index, Lab index. Nothing deleted, so the live site
   is unaffected if work stalls.
2. **Port.** Flox, Algorithms and FPL rebuilt per sections 6 to 8 on the new
   routes and tokens. Each verified against a local server before the next.
3. **Remove.** Deletions and the noindex work per section 5. `CLAUDE.md`, root
   `HANDOFF.md` and per-folder HANDOFFs rewritten in this phase, not after: the
   current `CLAUDE.md` describes a sidebar, a README generator and a Wren
   persona that will no longer exist, and a stale instruction file is worse than
   none.
4. **Tooling.** `sanitise.sh` rebuilt, spelling check enabled, CI and pre-commit
   updated.

Out of scope, each needing its own spec: World Cup maintenance, the flock
simulator, the daily puzzle.

---

## 12. Verification

- Every page: local server, confirm every asset reference returns 200.
- Every page: light and dark, 375px and desktop.
- All internal links resolve against build output.
- FPL sync verified end to end.
- `sanitise.sh` passes, including the new spelling check.
