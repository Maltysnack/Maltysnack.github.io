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

If you'll be editing a shared file (sidebar.js, index.html, style.css), do it quickly and push so you don't sit on an outdated tree. The longer you hold a stale tree, the more likely you'll merge-conflict with another session that just shipped a feature.
