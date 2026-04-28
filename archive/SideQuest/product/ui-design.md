# SideQuest — UI Design Reference

## WoW Classic Quest Log (the reference)

WoW Classic quest log UX breakdown:
- Left panel: list of quest names, grouped under zone/category headers, collapsible
- Right panel: selected quest — description, objectives (with 0/5 style counters), XP/gold reward, "Abandon Quest" red button
- Visual language: parchment texture, serif/gothic font, leather border, yellow/gold quest names
- Completed objectives: green with checkmark, struck through
- Quest difficulty colour: grey (trivial) → green → yellow → orange → red (skull)
- No animations — it's a data view. Functional, not flashy.
- You scroll the left panel. The right panel is fixed.

What makes it feel good:
1. Information density — you see a lot at once without feeling cramped
2. Clear hierarchy — category > quest name > objectives > rewards
3. The rewards panel makes you want to complete it — seeing the XP number makes it real
4. You can always see your full obligation at a glance

---

## PWA standalone mode problems (critical fixes needed first)

### Problem 1: The sidebar.js is completely wrong for an app
The current app shows the website's burger menu and sidebar. When installed to iOS home screen, the app MUST show no browser chrome and no website navigation. This is the single biggest "this isn't an app" signal. Fix: detect standalone mode with `window.navigator.standalone` and suppress all website-level chrome (sidebar, header, site nav) entirely.

### Problem 2: The phone shell CSS fights the real viewport
The current code renders the app inside a 420px "phone shell" container designed for desktop preview. On an actual phone this creates double-viewport weirdness — the inner scroll and the outer scroll fight each other. The phone shell should only appear on desktop (viewport > 768px). On mobile, the app should be 100vw × 100vh with nothing around it.

### Problem 3: The bottom tab bar overlaps content
The fixed bottom nav sits on top of the last quest items. On iPhone with home indicator, this needs `padding-bottom: env(safe-area-inset-bottom)` to push content clear of the system gesture area.

### Problem 4: There's no sense of world
Opening the app feels like opening a themed web page. A habit tracker competing with Habitica needs a sense of place from second one.

---

## Proposed home screen flow

### State 1: First launch (no character)
Full-screen fantasy landscape background (see below). Centre screen: a large glowing golden ❗ — the WoW quest marker. Below it: "Your adventure begins here." Tapping the ❗ starts character creation.

### State 2: Quests available (standard morning state)
Same landscape background, but the ❗ is now floating, pulsing gently. Above it: "3 quests awaiting." Tapping enters the quest log view.

### State 3: All quests complete (evening/done state)
The ❗ becomes a golden ✓ or a shield icon. The landscape background shifts to a warmer/sunset tone. "All duties fulfilled. Rest well." Tapping shows the summary screen.

The home screen IS the quest marker. Nothing else. The quest log is one tap away, not the default view. This is a meaningful UX choice — it preserves the "you're in a world" feeling rather than dumping you into a list.

---

## The background landscape

### Why CSS/SVG silhouette is the right call (not a photo)
1. Loads instantly, works offline, scales perfectly to any screen size
2. Can be animated (clouds drifting, stars twinkling, day/night cycle)
3. Feels intentional, not "we couldn't afford art"
4. Designer can swap in real art later without changing HTML structure

### What it should look like
Bottom layer: dark ground/hills silhouette
Middle layer: castle silhouette on a hill (right of centre)
Upper layers: sky with stars or gradient depending on time of day
Parallax: slight layer separation on scroll or device tilt

CSS layers using absolute-positioned divs, each with a gradient or SVG path. The castle is an SVG path. Simple, crisp, no blur needed at the silhouette layer. The blurriness can come from a gaussian-blur on the mid-ground layers only.

### Time of day sync
Background changes with actual time of day:
- 5am–7am: dawn (pink/gold gradient sky, stars fading)
- 7am–6pm: day (deep blue sky, castle visible)
- 6pm–8pm: dusk (amber/red horizon)
- 8pm–5am: night (dark blue/black, stars, moon)

This costs nothing (CSS custom properties updated by JS from `new Date().getHours()`) and makes the app feel alive.

---

## Quest log design (WoW Classic style)

### Layout
Left panel (40%): quest list
- Grouped under: DAILIES / WEEKLIES / QUESTS
- Each group is collapsible with a header row (WoW uses these as zone names)
- Quest item: difficulty dot + quest name + completion indicator (○ or ✓)
- Incomplete dailies pulse very subtly
- Tapping a quest selects it and shows details in right panel

Right panel (60%): selected quest details
- Quest title (large, gold)
- Flavour description (italic, parchment style)
- Objectives section: list of trackable goals with counters when relevant
- Rewards section: XP value, any item rewards
- Action button: "Mark Complete" (or auto-complete indicator if HealthKit-linked)
- "Abandon Quest" for user-added quests (dangerous, red, confirmation required)

### Mobile adaptation
On mobile (< 768px): the list and detail panel are full-screen, swipe or back-button between them. List is default. Tap quest → slide to detail. This is standard iOS pattern (UINavigationController equivalent).

---

## Section naming (final)

| Old name | New name | Why |
|---|---|---|
| Sacred Rites | Dailies | "Sacred Rites" is evocative but confusing. Dailies is universal MMO language. |
| Daily Quests | Dailies (merged) | No reason to separate defaults from user dailies. They're all dailies. |
| Weekly Quests | Weeklies | Clear, correct. |
| Bounty Board | Quests | One-off tasks. "Bounties" implies hunting. "Quests" is correct. |

---

## Character creation (onboarding) — needs building

Currently: none. User is dropped into a quest list with no context.

What it should be:
1. Landscape background + ❗ prompt
2. Tap ❗ → "A new adventurer approaches Dawnhearth. What is your path?"
3. Horizontal scroll of class cards (Knight, Ranger, Acolyte, etc.)
4. Each class card: icon, name, one-line flavour, primary stat
5. Tap to select → confirmation screen with class summary and "Begin your journey"
6. Quest log appears, first time with a short intro quest already in the list: "Talk to the Questmaster" (just a welcome note)

The class choice should affect:
- Which quests appear as dailies by default (flavoured per class)
- The avatar in the profile tab
- The auto-stat boost on level-up (already implemented in Yonder)

---

## Critical issues not yet addressed

1. **No onboarding.** First-time experience is the most important thing to build. Currently there is none.
2. **The font Cinzel looks good but is heavy for body text.** Quest names are fine. Descriptions in Cinzel are hard to read on small screens. Body text needs a readable serif, not a display font.
3. **The gold-on-dark color scheme has low contrast in places.** Needs an accessibility pass. Some text is below 4.5:1 contrast ratio required for readability.
4. **The Add Quest form is in a tab.** In WoW you don't go to a different screen to add a quest — you interact with an NPC in the world. The "add quest" flow should feel like visiting a quest-giver, not filling out a form.
5. **No empty state for a new user.** If someone installs the app and has no quests yet (before defaults load), they see nothing. There needs to be a "the board is empty" state that's inviting, not blank.
