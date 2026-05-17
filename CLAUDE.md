# Working in this repo

Read this and then `HANDOFF.md` before doing anything. Then read the HANDOFF for whichever folder you're touching.

This is maltysnack's personal site (`maltysnack.github.io`). Plain HTML, no framework, served by GitHub Pages from `main`. Multiple Claude sessions work on it in parallel.

## Response style

Short. Blunt. Almost rude. Straight to the point. State the result, stop.

- No preamble. No "Great question." No "Let me know if..." No recap of what the user just said.
- No closing summaries of what you just did. The diff already shows it.
- One sentence beats one paragraph. One word beats one sentence when it works.
- Tables only when comparing 3+ items along 2+ dimensions. Otherwise prose.
- Long-form only if the user types **"explain"** or **"why"**. Otherwise stay terse.

## Workflow rules

- **Do not open the preview panel.** Edit files quietly. Never reference the preview pop-up in chat. The user wants a silent workflow.
- **Never `Read` a file after editing.** The Edit tool already verified the change.
- For "where is X used" questions: delegate to the Explore agent. Don't grep + Read into your own context.
- Use `--oneline`, `head -20`, `tail -5`, `-n 5` by default. Never list more than needed.
- Plan the edit before reading. If you're reading "to see what's there," stop and ask what specifically you're looking for.
- Conversation over ~50k tokens, or shifting to unrelated work: recommend a fresh session.

## Context bar

The site is linked in job applications. Tone is honest, considered, personal.

- **OK**: quirky voice, drop caps, opinions about typography, personal projects with a clear point.
- **Not OK**: profanity in user-facing copy, politics, hot takes, slurs, oversharing, edgy humor without payoff, anything that wouldn't survive a stranger evaluating maltysnack as a candidate.
- **Borderline, ask first**: jokes that might land flat without context, technical takedowns of named companies or people, anything that names individuals other than maltysnack.

Sanitize has a soft profanity warning. Editorial judgment beyond that is the writer's job.

## Hard rules (CI-enforced by `scripts/sanitize.sh`)

1. **No em dashes anywhere.** Use a comma, period, semicolon, or restructure. The script greps for the unicode em dash and fails the build.
2. **No personal info on public pages.** Refer to the user as `maltysnack`, never their real name. No city, region, or location identifiers. No personal emails or phone numbers. (City-name data inside an app's content, e.g. a world-clock list, is fine; identifying maltysnack as living somewhere isn't.)
3. **No `.DS_Store` or junk files committed.** `.gitignore` covers them; don't fight it.
4. **No broken internal links** from `sidebar.js` or `index.html`.
5. **All user-facing dates are `dd-mm-yyyy`.** Internal data files can stay ISO `yyyy-mm-dd` for sortability; convert at the render layer.

## HANDOFF discipline

HANDOFFs are layered:

- `/HANDOFF.md` (root): site-wide only. Build, deploy, sanitize, layout tokens, sidebar/README rules, parallel-session warnings, link list to every per-project HANDOFF. **Never** put "In flight" or "Decisions pending" items for a specific page here.
- `<folder>/HANDOFF.md`: that folder's state. In-flight features, decisions pending, gotchas, recent session log. Lives in the folder so it travels with the code.

Update the project HANDOFF for any in-flight or finished work. Update the root only for site-wide changes or to add/remove an entry in the link list. Commit HANDOFF changes with the rest of the work.

**Write to the HANDOFF as you go, not at the end.** Continuity across sessions depends on the HANDOFF reflecting reality at any cut-point, not just the moment you stop. After every concrete change (a moved file, a fixed bug, a decision made, a path you chose not to take), write the one line that captures it. If the session crashes mid-flight, the next session reads where you left off; if you forget and write nothing, that context is gone.

### Stay in your folder

When a session is about one project, edit only inside that project's folder. Identify the folder from the user's request, follow the root HANDOFF link list down to that folder's HANDOFF, and operate there.

Touching anything outside the project folder requires an explicit reason:

- shared files (`sidebar.js`, `index.html`, `style.css`, `scripts/build-readme.py`, root `HANDOFF.md`, `README.md`) only when the change genuinely needs to be visible site-wide (new page, new layout token, sidebar entry, README regen).
- another project's folder only if the user asks for cross-project work.

If you find yourself about to create a file outside the project folder, stop and ask. Cross-cutting edits are the most common source of merge conflicts between parallel sessions.

Compaction is lossy. Fresh + layered handoffs beats long conversation + auto-summary.

## Adding a new page

1. Create the HTML page inside its own folder (`<folder>/index.html`). Don't drop loose `.html` files at a parent level.
2. Include `<meta name="description" content="...">` in `<head>`. One sentence. Used by the README generator and search snippets.
3. Add it to `sidebar.js` in the right section.
4. Add a card to `index.html`'s `home-links` section.
5. Add it to the `SECTIONS` list in `scripts/build-readme.py`.
6. Run `python3 scripts/build-readme.py` to regenerate `README.md`.
7. Include `<script src="/sidebar.js"></script>` before `</body>`. Sidebar.js injects the canonical favicon links into `<head>` automatically; don't hand-roll the icon block.
8. `git add` the page and the regenerated `README.md`. CI fails if either is missing or stale.
9. If the page is non-trivial (in-flight features, decisions pending, own wiring like a Vercel function or cron), create `<folder>/HANDOFF.md` and add it to the root HANDOFF link list. Otherwise, mention it under the closest parent index HANDOFF.

Self-contained pages with their own design system can skip `/style.css` and the icon block. They still need a sidebar entry and home card.

## Design system

- Body and display font: **Inter** (single family, hierarchy via weight and size)
- Mono: JetBrains Mono
- All colors are CSS variables in `/style.css`
- Light/dark via `[data-theme="light|dark"]` on `<html>`
- Accent: red (`var(--accent-red)`)
- Sidebar is darker than main, contrasting hue in dark mode

Prefer CSS variables (`var(--text)`, `var(--bg)`, etc.) over hardcoded colors so themes work for free.

### Layout widths

`<main class="main">` has width variants via `data-layout`:

| Variant | Width | Use for |
|---|---|---|
| (default) | 680px | Project pages with mixed content |
| `prose` | 620px | Essays, narrative reading |
| `page` | 680px | Same as default, explicit |
| `wide` | 1000px | Docs, technical demos, code blocks, data tables |
| `full` | 100% | Fullscreen tools |

Tokens live in `:root` as `--max-prose`, `--max-page`, `--max-wide`, `--max-full`. Don't hardcode `max-width` on `.main` per page. If you genuinely need a new width, add a token + variant, don't sprinkle inline styles.

## Git hygiene

```sh
git config user.name  "maltysnack"
git config user.email "39046911+Maltysnack@users.noreply.github.com"
```

Co-author trailer for AI-assisted commits:

```
Co-Authored-By: Wren <wren@maltysnack.dev>
```

Do not use `Claude <noreply@anthropic.com>`. The curator persona on this repo is Wren.

## Sanitize + pre-commit

```sh
bash scripts/sanitize.sh
```

Runs in CI on every push to `main`. If it fails, fix and push again. Don't disable the check.

Install the pre-commit hook once per clone so violations block locally:

```sh
git config core.hooksPath scripts/hooks
```

## Coordination with other sessions

Pull-rebase before non-trivial edits to shared files (`sidebar.js`, `index.html`, `style.css`, `CLAUDE.md`, root `HANDOFF.md`, `README.md`):

```sh
git pull --rebase origin main
```

1. **Check file activity.** Before any non-trivial edit: `git log --oneline -10 -- path/to/file`. If another session committed within the hour, expect conflicts.
2. **Sanitize in its own commit.** Don't mix feature edits and cosmetic normalisation; merges drop the feature work.
3. **Conflicts: prefer the feature commit's version.** Sanitize is mechanical and easy to re-apply; lost feature work is hard to recover.
4. **Commit per concept, push immediately.** Three small commits beat one big one.
