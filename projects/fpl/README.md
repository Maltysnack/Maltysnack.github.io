# FPL Predicted XI

A Premier League fantasy predictions tool. Lives entirely under `/projects/fpl/`. If you're a parallel Claude session asked to work on this project, **stay in this folder**. The only file outside it that belongs to FPL is the GitHub Actions workflow at `.github/workflows/sync-fpl.yml` which calls `sync.js` here.

Live at [maltysnack.github.io/projects/fpl/](https://maltysnack.github.io/projects/fpl/).

## Files

| File | What it is |
|---|---|
| `index.html` | The page. All UI, prediction formula in the browser, history tracker. |
| `sync.js` | Node script. Fetches the public FPL API daily, computes per-position calibration, writes `api-cache.json`. Runs in CI via `.github/workflows/sync-fpl.yml`. |
| `api-cache.json` | Bulk cache of FPL data: players, teams, fixtures (next GW + GW+2 + GW+3), per-position calibration history. The page reads this on load. **Do not hand-edit.** It's auto-regenerated. |
| `cache.json` | Smaller user-side cache (predictions snapshot, my squad). Used by the page for the history tracker. |
| `history.json` | Past gameweek tracker output. Append-only. |

## Data flow

```
   GitHub Actions (daily 6am UTC)
        │
        ▼
   node projects/fpl/sync.js
        │
        ▼
   projects/fpl/api-cache.json   ←  committed by maltysnack
        │
        ▼
   index.html fetches it on page load,
   runs predictWithFixtures() per player,
   applies calibration factor by position,
   renders the table.
```

The prediction formula is **duplicated** between `index.html`'s `predictWithFixtures()` and `sync.js`'s `predictNode()`. They must stay in sync; calibration uses `predictNode()` to compare predicted-vs-actual after each gameweek, and the calibration factor is what the browser applies. If you change the formula, change both.

## Running the sync locally

```sh
node projects/fpl/sync.js
```

It fetches from `fantasy.premierleague.com/api/` (no auth needed) and overwrites `api-cache.json`. ~5 seconds.

## What's safe to change in this folder

- `index.html`: the UI, formula tweaks (mind the duplication note above), styling
- `sync.js`: fetcher logic, calibration math
- README.md: this file

## What's in this folder but you should leave alone

- `api-cache.json`, `cache.json`, `history.json`: generated data, don't hand-edit

## What's outside this folder that belongs to FPL

- `.github/workflows/sync-fpl.yml`: the cron + commit step. Edit if you change the schedule or what gets committed. Otherwise leave it.

## What's outside this folder that does NOT belong to FPL

Everything else. The site's stylesheet (`/style.css`), sidebar (`/sidebar.js`), other pages (`/dnd/`, `/shelf/`, etc.) are someone else's work. Don't touch them. If `index.html`'s rendering looks broken because of a sidebar or stylesheet change, raise it with maltysnack rather than fixing it here.

## Conventions inherited from the parent repo

These also apply inside this folder:

- **No em dashes anywhere.** Use commas, periods, semicolons, or restructure. `scripts/sanitize.sh` will fail the build if any em dash appears.
- **All user-facing dates are dd-mm-yyyy.** Internal data files (timestamps in JSON) can stay ISO `yyyy-mm-dd` for sortability; convert at the render layer.
- **Refer to the user as `maltysnack`** in any user-facing copy.
- **Sign commits** with `git config user.name=maltysnack`, `user.email=39046911+Maltysnack@users.noreply.github.com`. AI-assisted commits should add `Co-Authored-By: Wren <wren@maltysnack.dev>`.
