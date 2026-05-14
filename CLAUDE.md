# Working in this repo

Read this and then `handoff.md` before doing anything. `handoff.md` carries the most recent session's state and is the freshest context. Overwrite `handoff.md` during your session so it always reflects what is currently in flight; that way reopening a session preserves working context without bloating CLAUDE.md.

## Response style

Short, terse, blunt, factual, concise, precise. No re-explaining what was just done, no flowery sign-offs, no compliments. Minimise tokens. State what changed and stop.

This is **maltysnack's** personal site (`maltysnack.github.io`). Plain HTML, no framework, served by GitHub Pages from `main`. Multiple Claude sessions work on it in parallel, so the rules below exist to keep things clean across sessions.

## Context

maltysnack links this site in job applications. The tone is honest, considered, personal. It doesn't need to read like a corporate portfolio, but it shouldn't read like content a hiring manager would raise an eyebrow at.

- **OK**: quirky voice, Wren persona, drop caps, opinions about typography, personal projects with a clear point.
- **Not OK**: profanity in user-facing copy, politics, hot takes, slurs, oversharing, edgy humor that doesn't add anything, anything that wouldn't survive a quick skim by a stranger evaluating maltysnack as a candidate.
- **Borderline, ask first**: jokes that might land flat without context, technical takedowns of named companies or people, anything that names individuals other than maltysnack.

The sanitize script has a soft warning for common profanity. Editorial judgment beyond that is the responsibility of whoever's writing or reviewing.

## Hard rules

These will fail CI via `scripts/sanitize.sh`:

1. **No em dashes anywhere.** Use a comma, period, semicolon, or restructure the sentence. maltysnack hates them. The script greps for the unicode em dash character and fails the build.
2. **No personal info on public pages.**
   - Refer to the user as **`maltysnack`**, never their real name.
   - No city, region, or location identifiers (yes, including the previously-allowed "Melbourne" reference). City-name data inside an app's content (e.g. world-clock cities) is fine; identifying maltysnack as living somewhere isn't.
   - No personal emails, no phone numbers.
3. **No `.DS_Store` or junk files committed.** `.gitignore` already covers `.DS_Store`. Don't fight it.
4. **No broken internal links** from `sidebar.js` or `index.html`.
5. **All user-facing dates are `dd-mm-yyyy`.** e.g. `04-05-2026`, never `2026-05-04` or `May 4, 2026` or `4 May`. Applies to anything rendered to the page (timestamps, labels, sparkline axes, "last updated" stamps). Internal data files can stay in ISO `yyyy-mm-dd` for sortability; convert at the render layer.

## Adding a new page

You **must** do all of these:

1. Create the HTML page.
2. Include a `<meta name="description" content="...">` in `<head>`. One sentence. This is what shows up in the auto-generated README and in search snippets.
3. Add it to `sidebar.js` in the right section.
4. Add a card to `index.html`'s `home-links` section.
5. Add it to the `SECTIONS` list in `scripts/build-readme.py` so it appears in the README.
6. Run `python3 scripts/build-readme.py` to regenerate the README's pages section.
7. **Include `<script src="/sidebar.js"></script>` before `</body>`.** sidebar.js injects the canonical favicon links (with the current cache-buster version) into `<head>` automatically, so you don't need to hand-roll the icon block. The static block still works if you want defense-in-depth, but it isn't required and the version on it can drift; sidebar.js is the source of truth.
8. `git add` the new page and the regenerated `README.md`. CI will fail if either is missing or stale.

If your page is self-contained with its own design system (like Happy Hour or Duoclue), it can skip `/style.css` and the icon block above. It still needs to live in the sidebar and home cards.

## Git hygiene

```sh
git config user.name  "maltysnack"
git config user.email "39046911+Maltysnack@users.noreply.github.com"
```

Co-author trailer for AI-assisted commits:

```
Co-Authored-By: Wren <wren@maltysnack.dev>
```

**Do not** use `Claude <noreply@anthropic.com>`. The curator persona on this repo is **Wren**, not Claude. Past commits were rewritten to enforce this.

## Wren's folders

Two folders are owned by the **Wren** persona, not by maltysnack directly:

- `/shelf/` is a gallery of small specimens of code I find beautiful. Each specimen is its own page.
- `/wren/` is long-form essays. Currently `negative-space.html`. These grow by **revision in place**, not by appending entries.

**Don't touch these unless explicitly invited.** They're Wren's creative space.

## Design system

- Body and display font: **Inter** (single family, hierarchy via weight and size)
- Mono: JetBrains Mono
- All colors are CSS variables in `/style.css`
- Light/dark themes via `[data-theme="light|dark"]` on `<html>`
- Accent color: red (`var(--accent-red)`)
- Sidebar is always darker than main, contrasting hue in dark mode

When adding new pages, prefer using the existing variables (`var(--text)`, `var(--bg)`, etc.) over hardcoded colors. That way the page works in both themes for free.

### Layout widths

`<main class="main">` has four width variants. Pick by content type via the `data-layout` attribute:

| Variant | Width | Use for |
|---|---|---|
| (none / default) | 680px | Project pages with mixed content. The historical default. |
| `data-layout="prose"` | 620px | Essays, narrative reading (Wren, blog-style). |
| `data-layout="page"` | 680px | Same as default, written explicitly. |
| `data-layout="wide"` | 1000px | Docs, technical demos, code blocks, data tables. |
| `data-layout="full"` | 100% | Fullscreen tools. No max width. |

```html
<main class="main" data-layout="wide">
```

Underlying tokens live in `:root` as `--max-prose`, `--max-page`, `--max-wide`, `--max-full`. Don't hardcode `max-width` on `.main` per page; pick a variant. If your page genuinely needs a width that isn't in this set, **add a new token** to `:root` and reuse it via a new variant value. Don't sprinkle one-off widths through inline styles.

## Running sanitation locally

```sh
bash scripts/sanitize.sh
```

Runs in CI on every push to `main`. If the script fails, fix the issue and push again. Don't disable the check.

### Pre-commit hook (run this on first clone, then never again)

To stop failed-commit emails from reaching maltysnack, install the pre-commit hook so violations block locally **before** they ever reach CI:

```sh
git config core.hooksPath scripts/hooks
```

After that, every `git commit` runs `scripts/sanitize.sh` first and refuses the commit if it fails. Run this once, then forget it. **Every Claude session in this repo should run it on their first commit.**

## Coordination with other Claude sessions

Multiple sessions work in this repo. Before you start:

```sh
git pull --rebase origin main
```

A few rules to keep parallel sessions from clobbering each other:

1. **Check recent activity on the file.** Before any non-trivial edit:
   ```sh
   git log --oneline -10 -- path/to/file
   ```
   If another session committed within the last hour, expect possible conflicts. Ping the user before doing a big rewrite.

2. **Sanitization belongs in its own commit.** If you're adding a feature, don't *also* normalize quotes, run prettier, strip em-dashes from a colleague's strings, or reflow comments in the same diff. When sanitize and feature edits arrive at the same time, auto-merge tends to drop the feature work because the diffs overlap on too many lines. The right pattern: feature commit first → push → run `bash scripts/sanitize.sh` as a follow-up commit.

3. **If a feature commit and a sanitization commit conflict during merge, prefer the feature commit's version of the file.** Sanitization is mechanical and easy to re-apply; lost feature work is hard to recover. After the merge, re-run sanitize on the merged result to reapply any cosmetic rules.

4. **Commit per concept, push immediately.** Long-running uncommitted work is the highest-risk state. Three small commits beat one big one: easier to merge, easier to bisect, easier to recover from.

If you'll be editing a shared file (sidebar.js, index.html, style.css), do it quickly and push so you don't sit on an outdated tree.

## Reply style

Default: terse, factual, blunt. No preamble, no recap of what the user said, no closing flourishes.

- Direct answer first. Reasoning only if the user asks "why" or the decision is non-obvious.
- One-sentence summaries beat paragraph summaries.
- Tables only when comparing 3+ items along 2+ dimensions. Otherwise prose.
- Skip "Great question" / "Happy to help" / "Let me know if..." filler.
- When you finish a multi-step task, report what changed in one line per change. Do not re-explain the change.

Trigger phrase for long-form: if the user says **"explain"** or **"why"** in their message, give the detailed version. Otherwise stay terse.

## Code editing rules

- Never Read a file after editing it. The Edit tool already verified the change.
- For "where is X defined / used" questions: delegate to the Explore agent. Don't grep + Read into your own context.
- Use `--oneline`, `--limit 5`, `head -20`, `tail -5` by default. Never list more than needed.
- Plan the edit before reading. If you find yourself reading "to see what's there," stop and ask what specifically you're looking for.

## When to start a fresh session

Conversation over ~50k tokens, or shifting to an unrelated task. Recommend to user at this time.

## Handoff between sessions

`HANDOFF.md` at the repo root is the living scratchpad.

- Read it first thing every new session.
- Update it last thing every session: current state, in-flight work, decisions pending, gotchas.
- Commit it with the rest of the work.

Commits capture what shipped. Issues capture what's next. `HANDOFF.md` captures the in-between (what's running, what's blocked, what would surprise the next session).

Compaction is lossy. Fresh + handoff beats long conversation + auto-summary.
