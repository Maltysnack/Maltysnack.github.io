# dnd HANDOFF

Scratchpad for `/games/dnd/`. Root `HANDOFF.md` covers the rest of the site.

## Current state (26-10-2026)

Rebuilt from scratch on 26-10-2026. Characters live in the visitor's browser.
No server, no Vercel, no PRs, nothing about a character is committed here.

- `/games/dnd/` lists the characters saved in this browser, with New and Import.
- `edit.html` creates a character from a form, or edits one (`?id=`).
- `sheet.html?id=` is the live sheet. Every change saves the whole record
  (character and play state) at once.
- **Save file** on the sheet downloads `{ format: "maltysnack-dnd", version, character, state }`.
  Import on the roster takes that, or a bare character JSON from the old site.

## File map

```
store.js            localStorage record per character (`dnd:<id>`), export/import, slugify
index.html          roster (inline script)
edit.html/edit.js   character form
sheet.html          loads store.js + sheet.js
sheet.js/sheet.css  sheet renderer (the old engine, now reading from store.js)
class-resources.js  class + level -> slots and resources, used by the form
dnd.css             roster + form styles
grosh-chef-lifeguard.html   redirect for the old bookmark
```

## Decisions

- **Private, per browser.** Cross-device means moving a save file. A backend
  for sync was rejected as not worth it.
- **`navigator.storage.persist()`** is requested on every page. Without it
  Safari deletes the storage after 7 days without a visit, which is the most
  likely reason the old sheet "forgot" HP and items.
- **PDF export cut**, along with the WotC template and pdf-lib. Print stays.
- **Form fills from class and level** (slots, resources, saves, hit die,
  casting ability) automatically for a new character, only on the "Fill from
  class and level" button when editing, so homebrew resources survive.
- **Rows keep the object they were built from.** Fields the form does not
  show (feature `group`, `upcoming`, `spellSource`) survive an edit. Grosh
  round-trips through the form with no change except adding `race`/`subclass`.
- **Keys are stable.** An existing resource or limited spell keeps its `key`,
  so its ticked state carries across an edit.
- **HP rule = fixed die**: max die + CON at 1st, then die/2 + 1 + CON per
  level. Used as the placeholder and the default when Max HP is left blank.
- Pip vs counter: max <= 8 is pips, above is a counter.

## Grosh

Removed from the repo. The save file is at
`~/Documents/maltysnack-archive/dnd/grosh-chef-lifeguard.json` (state left
empty). Importing it on a device that used the old sheet picks up that
device's old play state from the legacy key `sheet-grosh-chef-lifeguard-v1`,
so HP, inventory and notes carry over.

## Removed 26-10-2026

`api/` (upload + update functions), `vercel.json`, `.vercelignore`,
`vercel-out/`, the `build-dnd-index` workflow, the PDF parser, PDF export and
template, `POLISH-PROCESS.md`, `characters/`, the index build script, and the
legacy hardcoded `grosh.html` with its `app.js`/`character.js`/`style.css`.
All in git history.

## Outside this repo (maltysnack to do)

- Delete the `dnd-upload` Vercel project (team `maltysnacks-projects`).
- Revoke the GitHub PAT it held (env var `dnd_upload`).

## Gotchas

- No test suite. The rebuild was checked with a throwaway jsdom script:
  create, tick slots, damage, add loot, import Grosh with legacy state, edit
  and re-save Grosh losslessly. Never checked in a real browser by Claude.
- Sheet skills render in a CSS grid; `innerText` reads column-wise.
