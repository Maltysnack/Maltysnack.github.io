# SideQuest — Design System

## For the designer

This document describes the current CSS design token structure, where placeholders live, and what to replace/override when doing a proper design pass.

All tokens live in the `:root {}` block at the top of `projects/sidequest.html` under the comment `/* ===== DESIGN TOKENS ===== */`.

---

## Color tokens

```css
/* Replace these to retheme the entire app */
--color-bg           /* Page background — currently very dark brown #1a1208 */
--color-surface      /* Card/panel background — #2a1e0e */
--color-surface-raised /* Elevated elements — #3a2a12 */
--color-border       /* Borders and dividers — #5a4020 */
--color-gold         /* Primary accent (CTA, highlights) — #c8a84b */
--color-gold-bright  /* Hover states, active — #f0cc6e */
--color-text         /* Body text — #f0e8d0 */
--color-text-muted   /* Secondary text — #8a7a5a */
--color-success      /* Quest complete, positive — #5a9a4a */
--color-danger       /* Delete, warning — #9a3a2a */
--color-xp           /* XP toasts, bars — #7a5aaa */
```

---

## Typography tokens

```css
--font-heading    /* Cinzel (Google Fonts) — headings, titles, tab names */
--font-body       /* Crimson Text (Google Fonts) — body copy, quest names */
--font-ui         /* system-ui — small labels, numbers, UI chrome */
```

**To replace fonts:** swap the Google Fonts `<link>` in `<head>` (marked `<!-- DESIGNER: fonts -->`) and update the two variables.

---

## Logo placeholder

In `<header>`, look for:
```html
<!-- DESIGNER: Logo block — replace .sq-logo with your asset -->
<div class="sq-logo" data-designer="logo">
```

The current logo is a pure CSS/SVG shield. Replace the entire `.sq-logo` div with your asset. The header is `60px` tall; logo should fit within `44px` height.

---

## Icon system

Quest type icons and achievement badges currently use Unicode emoji. Look for `data-icon` attributes throughout — these are the replacement targets for a proper icon set.

```html
data-icon="quest-default"   <!-- Sacred rites / default quests -->
data-icon="quest-daily"     <!-- User daily quests -->
data-icon="quest-weekly"    <!-- User weekly quests -->
data-icon="mission"         <!-- Bounty board missions -->
data-icon="profile"         <!-- Adventurer's Hall tab -->
data-icon="level-up"        <!-- Level up splash -->
```

---

## Component specs

### Quest card
- Background: `--color-surface`
- Border: `1px solid --color-border`
- Border-radius: `--radius-md` (8px)
- Checked state: border-left `3px solid --color-success`, text opacity 0.5
- XP badge: pill, background `--color-xp`, font `--font-ui`

### Completion checkbox
- 28×28px circle
- Unchecked: border `2px solid --color-border`
- Checked: fill `--color-success`, white checkmark
- Animation: scale bounce on check (currently `checkPulse` keyframe)

### XP toast
- Pill shape, appears above checked item
- Color: `--color-xp`
- Animates: fade up then out over 1.4s

### Tab bar
- Fixed bottom, `60px` tall
- Active tab: `--color-gold` text + underline indicator
- Inactive: `--color-text-muted`

### Level-up splash
- Full-screen overlay, dark background
- Dragon/star illustration placeholder (currently CSS ornament)
- Title: new level name in `--font-heading`
- **DESIGNER:** This is the highest-impact moment in the app — worth a custom animation/asset

---

## Illustration placeholders

| Location | Size | Suggested asset |
|---|---|---|
| Header logo | 44×44px | Shield + sword mark |
| Empty quest board | 120×120px | Sleeping knight illustration |
| Empty bounty board | 120×120px | Empty scroll/notice board |
| Level-up splash bg | Full screen | Dragon, stars, epic scene |
| Profile avatar | 80×80px | Character portrait (changes by level) |

All placeholders have `data-designer="illustration"` attribute.

---

## Spacing scale

```css
--space-xs: 4px
--space-sm: 8px
--space-md: 16px
--space-lg: 24px
--space-xl: 40px
```

---

## Phone shell (desktop view)

On desktop the app renders inside a phone-shaped container. Specs:
- Width: `420px` max
- Height: `680px` (scrollable inner content)
- Border-radius: `32px`
- Box-shadow: `0 32px 80px rgba(0,0,0,0.6)`
- Background: matches `--color-bg`
