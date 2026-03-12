# maltysnack.github.io

Personal site at [maltysnack.github.io](https://maltysnack.github.io). Films, projects, words, and games.

---

## Structure

```
/
├── index.html              — Homepage
├── style.css               — Global styles (shared by all pages)
├── sidebar.js              — Universal sidebar (inject on every page)
├── proveyourself.html      — Weekly quiz
├── quiz-data.js            — Quiz questions (updated weekly via scheduled task)
├── shop.html               — Shop
├── busyboy.html            — BusyBoy (chat-based calendar)
├── red-rebels.html         — Red Rebels
│
├── films/
│   ├── haikureview.html    — Haiku film reviews
│   └── SPOILERALERT.html   — Spoiler-heavy film discussions
│
├── games/
│   └── mtgarena.html       — MTG Arena (Standard format + draft data + account tracker)
│
├── projects/
│   ├── yonder.html         — Yonder (browser idle RPG, single-file vanilla JS)
│   ├── mothership.html     — Mothership (LÖVE2D card strategy game devlog)
│   ├── trolley-run.html    — Trolley Run (HTML5 Canvas physics game)
│   ├── saltysnacks.html    — Saltysnacks (recipe collection with nutrition calculator)
│   └── sidequest.html      — SideQuest (PWA habit tracker)
│
├── writings/
│   ├── thoughts.html       — Thoughts / essays
│   └── poems.html          — Poems
│
└── mothership/
    └── main.lua            — Mothership game (LÖVE2D source)
```

---

## Projects

### Yonder
Browser idle RPG. Single `.html` file, no framework, no build step. Currently at v0.53.
- Class system (Citizen → Knight / Acolyte / Ranger)
- Turn-based combat, 4-town progression, inventory, shop, bank, training
- Bloodline Talents — cross-character progression via localStorage

### Mothership
Strategic card game in LÖVE2D (Lua). Run with `love mothership/`.
- Roguelike deck builder. Cards connect via corner slots to build attack/defence layers.
- Goal: destroy the opponent's mothership

### Trolley Run
HTML5 Canvas physics game. Four independent caster wheels make control deliberately chaotic.
- Custom 2D physics, WASD + mobile tilt, wheel jamming mechanic

### Saltysnacks
Recipe collection. No ads. Just ingredients and method.
- Tag filtering, search, interactive nutrition calculator

### SideQuest
PWA habit tracker. Daily quests, XP, levelling. Installable to iOS home screen.

### BusyBoy
Chat-based calendar. Type events in natural language — it parses and saves them.

---

## Sidebar

`sidebar.js` is the single source of truth for navigation. Include on every page:

```html
<aside class="sidebar"></aside>
<script src="/sidebar.js"></script>
```

Root-relative path works for all subdirectories on GitHub Pages.

---

## proveyourself quiz

Questions live in `quiz-data.js` as the `QUIZ_DATA` object. Updated weekly via a Claude scheduled task. 20 questions across 5 categories: Politics, Sport, Entertainment, Science & Tech, General Knowledge.

---

## Dev notes

- No build step. Everything is vanilla HTML/CSS/JS.
- GitHub Pages serves from `main` branch.
- `_config.yml` suppresses Jekyll processing.
- `style.css` defines CSS custom properties used across all pages.
