# Working in this repo

Read this before doing anything. It's short.

This is **maltysnack's** personal site (`maltysnack.github.io`). Plain HTML, no framework, served by GitHub Pages from `main`. Multiple Claude sessions work on it in parallel, so the rules below exist to keep things clean across sessions.

## Hard rules

These will fail CI via `scripts/sanitize.sh`:

1. **No em dashes anywhere.** Use a comma, period, semicolon, or restructure the sentence. maltysnack hates them. The script greps for the unicode em dash character and fails the build.
2. **No personal info on public pages.**
   - Refer to the user as **`maltysnack`**, never their real name.
   - The city `Melbourne` is fine. More specific isn't.
   - No personal emails, no phone numbers.
3. **No `.DS_Store` or junk files committed.** `.gitignore` already covers `.DS_Store`. Don't fight it.
4. **No broken internal links** from `sidebar.js` or `index.html`.

## Adding a new page

You **must** do all of these:

1. Create the HTML page.
2. Add it to `sidebar.js` in the right section.
3. Add a card to `index.html`'s `home-links` section.
4. `git add` the new page. CI will fail if it's untracked.

If your page is self-contained with its own design system (like Happy Hour or Duoclue), it can skip `/style.css`. It still needs to live in the sidebar and home cards.

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

## Running sanitation locally

```sh
bash scripts/sanitize.sh
```

Runs in CI on every push to `main`. If the script fails, fix the issue and push again. Don't disable the check.

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
