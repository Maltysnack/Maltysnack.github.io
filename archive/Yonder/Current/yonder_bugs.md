# Yonder 0.5.2 — Bug Report & Fix Context
## For use in Claude Code continuation session

---

## Project Overview
Single-file browser idle RPG (`yonder_051.html`). Four towns: Dawnhearth → Millriver → Grimhollow → Farradin. Ten classes. One-way progression. Built in layers across multiple sessions.

**Previous build:** `yonder_038.html` (clean base)
**Current build:** `yonder_051.html` (all layers applied, bugs below)

---

## New Bugs (session 2026-03-12)

### N1. Homepage Requires Scrolling to Reach "Begin Journey"
**Symptom:** Player must scroll down on the start/character-creation screen to see and click the Begin Journey button. This should never happen — the whole screen should fit above the fold.
**Fix:** Reduce padding, font sizes, or spacing on the home screen elements until the button is always visible without scrolling. Check on ~750px viewport height (phone in landscape or small laptop).

### N2. Stat Tooltips Not Working on Hover (Character Creation)
**Symptom:** Hovering stat names (STR, AGI, INT etc.) in character creation does nothing. They should show a tooltip explaining what the stat does.
**Cause:** Either the tooltip elements aren't rendering, the CSS hover state is broken, or the JS tooltip trigger isn't attached to the right elements.
**Fix:** Verify `.stat-tooltip` or equivalent elements exist and are visible on hover. Check z-index and position. Confirm JS event listeners are attached after the character creation screen renders.

### N3. Shop UI Still Broken — Character Panel Missing
**Symptom:** Shop modal is still a mess. The agreed design was character stats/equipment panel visible alongside shop items. This was not resolved in the last build.
**Fix:** Shop modal must render a two-column (or stacked) layout: left = character loadout/stats (current HP, class, equipped gear, stat block), right = shop item list. Replicate the pattern from the stat screen. Make sure the character panel updates when an item is equipped or sold.

### N4. Bounties Too Hard for New Players — Need Citizen Intro Bounties
**Symptom:** First bounty in Dawnhearth is level 5 enemy — brutal and unbeatable for a fresh character. Citizens especially need very simple intro bounties to learn the system.
**Fix:** Add a short list of 3–4 level 1–2 intro bounties at the Dawnhearth noticeboard gated to the opening state (before any bounties are completed). Very low enemy level (1–2), small reward, clear flavour text explaining bounties. These should be the first things a Citizen sees.

### N5. Day/Night Visual Inverted
**Symptom:** The sun icon appears at the top of the screen, but the background shows dark sky with stars and a large moon — it looks like night. The visual and the indicator are contradicting each other.
**Cause:** Either the time-of-day check is inverted (day check returning night hours) or the wrong background/icon is being rendered.
**Fix:** Audit `isDaytime()` or equivalent. Confirm sun shows with light sky background; moon shows with dark/stars. They must match. Double-check the hour ranges.

### N6. Bows Don't Drop / Ranger Can't Be Unlocked
**Symptom:** Player has never seen a bow item. Can't unlock the Ranger class.
**Cause:** Bows may be missing from the shop pool, loot tables, or not correctly implemented in ITEMS_DB (see old bug 13 — bow says +2 armour). Ranger unlock condition may require an item or action that never occurs.
**Fix:** Add bows to Dawnhearth shop pool and/or ensure they drop from appropriate missions. Fix bow ITEMS_DB entry (remove armour:2). Audit Ranger unlock condition — if it requires a bow, the bow must be obtainable first. Add a clear unlock hint in the game (e.g. class discovery text).

### N7. Can't Beat the Adventure Quest Even at Level 7 with Gear
**Symptom:** Adventure is still unbeatable even when geared at level 7. Combat outcome feels wrong.
**Cause:** Likely gear still not contributing to combat stats (old bug 2), adventure enemy level too high, or both. Also possible combat formula is giving enemy too much advantage.
**Fix:** This is the same root as old bug 2 (gear not contributing) plus old adventure balance issue. Priority: fix gear contribution first. Then adjust adventure enemy level down or give player a better base combat result at level 7+.

---

## Critical Bugs (break the game)

### 1. Town Progression Completely Blocked — Adventure Does Not Travel
**Symptom:** Completing the Dawnhearth adventure (the dangerous road fight at the gate) returns the player to Dawnhearth. There is no way to reach Millriver, Grimhollow, or Farradin.
**Intended design:** The adventure IS the journey to the next town. You fight something dangerous on the road north, survive, and arrive. It is not a separate mission — it is literally the travel itself. This is why adventures live at the gate, not the notice board.
**Cause:** `arrivesTown:'millriver'` was placed on `mr_q1` (a quest) instead of on the Millriver adventure mission. The adventure has `unlocks_adventure:true` but no `arrivesTown` flag, so `resolveJourney()` never sets `G.pendingTownArrival` and the player stays in Dawnhearth forever. There is currently no reachable path to any expansion town.
**Fix:** Move `arrivesTown:'millriver'` onto the Millriver adventure mission. Audit Grimhollow and Farradin adventure missions for the same missing flag. Remove it from `mr_q1` or repurpose that quest. Also confirm the adventure is removed from the notice board (see bug 14) — gate only.

### 2. Save Migration — Empty Notice Board / Gate
**Symptom:** Notice board shows "All current missions complete. The board will be restocked." Gate shows "No contracts posted." Nothing to do.
**Cause:** Old saves stored missions under `yonder_town_missions`. New code reads/writes `yonder_missions_dawnhearth`. On load, `getTownMissions()` returns null. `initTownMissions()` only runs in `beginGame()` and `arriveInTown()` — never on "Continue Your Story". `tickBoardExpiry()` also bails immediately on null. Board stays empty forever.
**Fix:** Call `initTownMissions()` as a fallback in `homeAction()` after loading a save, or at the top of `noticeboard()` before `tickBoardExpiry()`.

### 2. Gear Not Contributing to Combat Stats
**Symptom:** Equipping items doesn't change stats. Armour doesn't reduce damage. Bows can't be equipped. Crafted/enchanted loot items seem to do nothing.
**Cause:** `buildPlayerStats()` reads stats from `ITEMS_DB[equipped_key]`. Loot-generated items may not have a proper `key` field or `isDBItem:true`, so they're invisible to `ITEMS_DB` lookup. Stats are calculated but the combat sim may be using stale values.
**Fix:** Ensure loot items always carry a valid `key` matching an `ITEMS_DB` entry. Audit the equip function to confirm it writes the `key` not just the item object. Confirm `buildPlayerStats()` is called fresh at journey start.

### 3. Equipping Items Deletes Them
**Symptom:** Equipping an item (especially crafted/enchanted loot) removes it from the bag without putting it in the equipment slot.
**Cause:** The equip swap looks up the item by key in the bag. If the item lacks a proper `key` or the lookup fails, the slot isn't written but the item is still removed from the bag.
**Fix:** Same root as bug 2. Validate `key` exists before removing from bag; only remove after confirming slot was written.

### 4. Constitution / Stats Not Updating Visibly
**Symptom:** Levelling up and increasing CON doesn't change HP display or effective stats.
**Cause:** `buildPlayerStats()` calculates fresh `maxHp` and updates `c.maxHp` as a side effect, but `render()` reads the header HP bar from the stored value. HP bar doesn't visually update until the next journey. Also, `buildPlayerStats()` return object was changed to `hp:c.hp, maxHp:c.maxHp` — if the Plague Doctor HP recalculation block updates `c.maxHp` mid-function, the return may not reflect it.
**Fix:** Call `render()` immediately after stat choice in `chooseStat()`. Confirm the return object reads the post-calculation `c.maxHp`.

### 5. Double Combat / Adventure Instant-Kill (Dev Skip Related)
**Symptom:** Adventure enemy one-shots player at level 16–17 with good gear. Replay unavailable after. Suspected dev skip interaction.
**Cause:** `devSkip()` sets `G.journey.endTime` to now+800ms. If the journey tick fires during or just after a skip, `resolveJourney()` may be called twice — second run starts with player already at reduced HP from first sim. Also if gear isn't contributing (bug 2), player is effectively fighting naked regardless of level.
**Fix:** Add a guard in `resolveJourney()` — it already checks `G.journeyEnded` but confirm that flag is set before any async/tick re-entry. Also fix gear contribution (bug 2) before assessing adventure balance.

### 6. Holy Relic Quest Gives No Reward
**Symptom:** Completed the holy relic quest, received no item reward.
**Cause:** `resolveJourney()` checks `j.mission._isHolyRelic` to trigger loot drop. This flag is added dynamically in `getActiveMissions()` but is never stored in localStorage. When the journey is loaded back from save, `j.mission._isHolyRelic` is undefined.
**Fix:** Either store the flag in the journey object when the mission is accepted (`startMission()`), or check `j.mission.id === 'holy_relic'` instead of the dynamic flag.

---

## Significant Bugs (impair experience)

### 7. Acolyte Starts Without a Weapon
**Cause:** `CLASS_CONFIG.Acolyte.startItems` is `['cloth_robe','healing_potion','blessed_amulet']` — no weapon. Falls back to bare-hands with wooden_sword stats but nothing appears in loadout.
**Fix:** Add a starter staff (e.g. `basic_staff`) to Acolyte `startItems`.

### 8. Acolyte Combat Replay Broken
**Symptom:** Replay goes on and on, health bars jump after enemy is dead.
**Cause:** Acolyte's `lay on hands` heals every 5 enemy hits, keeping the player alive long enough for the 300-loop cap to be reached. Events array is huge. Replay shows 18 events but they're from mid-combat states — HP values in `ev.pH/ev.eH` diverge from actual final state. Bars jump because events reference mid-sim values.
**Fix:** Cap the loop earlier for Acolyte builds, or trim the events array to only include events up to first `eH === 0`. Don't render events after enemy is dead.

### 9. Acolyte Can't Join After Completing Holy Relic
**Cause:** Church join button requires `disc.includes('Acolyte')`. `addUnlocked('Acolyte')` is called in `resolveJourney()`. However if the Citizen completed the relic via the `_isCitizen` tutorial path, the `completeMission()` citizen branch fires instead of the relic branch, so `holy_relic_done` may not be set and `addUnlocked` may not run.
**Fix:** Audit `completeMission()` — the `isCitizen` branch should not prevent the holy relic flag from being set. They're independent concerns.

### 10. "On Quest" Status Stuck After Returning
**Cause:** `h-status` is set to the journey type on departure and never reset. `proceedToTown()` calls `render()` but `render()` doesn't touch `h-status`.
**Fix:** Add `document.getElementById('h-status').textContent = 'IN TOWN'` to `proceedToTown()` in the non-death branch.

### 11. Training Spend Doesn't Update UI Immediately
**Cause:** After `buyTraining()`, `render()` is called but the training modal HTML isn't refreshed. The gold number in the modal is stale.
**Fix:** Call `academy()` (or whichever modal rendered the training UI) after `buyTraining()` to re-render the modal in place.

### 12. Training Armour Not Visibly Changing Reduction
**Cause:** `siege_stance` adds to `totalArmour` in `buildPlayerStats()`, converted to `Math.min(0.75, totalArmour * 0.03)`. The loadout display may be showing raw armour numbers from item stats rather than the computed reduction. Also tied to bug 4 — stats not refreshing.
**Fix:** Confirm the loadout armour display reads from `buildPlayerStats().armour` (the computed percentage) not from raw item stats.

### 13. Bow Says +2 Armour
**Cause:** Data entry error in the bow's item definition in `ITEMS_DB`.
**Fix:** Remove `armour:2` from the bow's stats object.

### 14. Adventure Shown on Notice Board
**Symptom:** Adventure contract appears on the notice board. Should only appear at the gate.
**Fix:** In `noticeboard()`, filter out `type === 'adventure'` from the missions rendered. Adventures are already separately surfaced in `gateModal()`.

### 15. Tavern Can't Be Closed During Activity
**Symptom:** Close button hidden during sleep/drink activity. Player is trapped in modal.
**Cause:** Intentional design but too restrictive. Players can't access bag or other modals while resting.
**Fix:** Allow closing the modal but keep the activity timer running in the background. The activity resolves on the next tick regardless of modal state.

### 16. Tavern Activity Lock Uses Hardcoded Name
**Cause:** `overlayClick` checks `m-title === 'The Ashen Flagon'` to block modal closing during tavern activity. In Millriver/Grimhollow/Farradin the tavern has a different name, so the lock doesn't work.
**Fix:** Use a flag (`G.tavernActivity` is truthy) rather than the modal title string.

### 17. Rumours Have No Interesting Outcome
**Cause:** Drink/rumour event logs flavour text and gives XP. No branching, no item discovery, no class hints. Stub never implemented.
**Fix (design):** Add a small outcome table — chance of item find, class hint text, chronicle entry, small gold find, or debuff (hangover).

---

## Next Build Features (Queued)

### Level-Up Stat Boost (per class)
Each class automatically gains +1 to their associated stat on level-up, in addition to the player's +1 stat of choice and +4 HP. Citizens get +4 HP only (no class stat bonus).

Class → auto stat:
- Knight → STR
- Ranger → AGI
- Acolyte → INT
- (define the rest to match class identity when implementing)

**So a full level-up gives:** +4 HP + class stat (+1) + player choice (+1) = net +4 HP and +2 stats total, except Citizen who gets +4 HP + player choice (+1 stat) only.

---

## Balance Notes

### Bounties Scaling Too Fast
Enemy levels in bounty missions are hardcoded regardless of player level. A level 6 enemy is brutal at character level 1–2. No dynamic scaling exists.
**Fix approach:** Either gate bounties by minimum player level, or scale enemy level as `Math.max(missionBaseLevel, playerLevel - 2)`.

### Adventure Currently Unbeatable
Combination of gear not contributing (bug 2) and possible double-combat (bug 5) makes adventures unwinnable even at level 17 with good equipment. Do not assess adventure balance until bugs 2 and 5 are fixed.

### Heirlooms Should Auto-Vault on Death
Items with `heirloom:true` should be moved to the vault during the death flow, not lost with the rest of the bag. Currently only the `biscuit` is flagged `heirloom:true`. The sigil ring likely should be too. Confirm the death handler (wherever `addToGraveyard` is called) strips heirloom items from `G.bag` and passes them to `saveVaultHeirlooms()` before wiping.

---

## Architecture Notes for Claude Code

- **Do not use string-replacement scripts.** Read each function fully before modifying.
- **All JS strings with apostrophes must use double quotes or template literals.**
- **Every new G field needs: default in G object + included in `save()` + loaded in `homeAction()` with fallback.**
- `G.journey=null` and `G.journeyEnded=false` appear in BOTH `resolveJourney()` AND `proceedToTown()`. Read both before touching either.
- `buildPlayerStats()` has side effects — it updates `c.maxHp` and `c.hp` directly. Be careful about call order.
- `getTownMissions()` and `setTownMissions()` now use `getTownMissionKey()` which is town-scoped. The old `yonder_town_missions` key is abandoned (migration issue, see bug 1).
- Loot items generated at runtime may not match `ITEMS_DB` keys. This is the root of most gear-related bugs.
