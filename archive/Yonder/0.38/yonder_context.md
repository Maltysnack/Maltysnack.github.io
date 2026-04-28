# YONDER — HANDOFF CONTEXT
# Version: v0.5.1 build target
# Last updated: 2026-03-09
# Purpose: Full context for any Claude instance picking up this build

---

## WHAT IS YONDER

Single-file browser idle RPG. Everything in one HTML file — no framework, no build step, vanilla JS + CSS.
Player creates a character, runs missions from a noticeboard, levels up, buys gear, unlocks classes, progresses through towns.
Atmospheric and text-driven. All text is in world voice. No mechanical language visible to the player. Player figures things out.

---

## FILE TO BUILD FROM

  yonder_038.html — verified clean, Dawnhearth fully working

DO NOT use yonder_039.html (inventory bug — buildBuffsHTML missing const pills declaration).
DO NOT use yonder_050.html (multiple logic bugs from string-replacement patching).

Copy 038 to yonder_051.html and build there.

---

## WHAT IS BUILT (v0.3.8)

Single town: Dawnhearth
Buildings: Ashen Flagon (tavern), Iron Vault (bank), Ember Church + Graveyard, Noticeboard, Ember Sanctum, Morrow's Sundries, East Gate / Ranger Post
Classes: Citizen, Knight, Ranger, Acolyte
Training system: 3 ranks per perk, costs [30, 60, 100]gp
Mission types: job (safe), bounty (combat), quest (harder), adventure (hardest, eventually town-transition)
Noticeboard: rotating missions with timers, enemy stats shown on cards
Combat: simulateCombat() — turn-based sim, physical/magic dmg, crit, armour, buffs/debuffs, animated replay
Shop: 6 rotating slots with per-slot timers
Inventory: equipped slots (head, shoulder, body, gloves, boots, amulet, ring1, ring2, weapon, offhand, pack, pack2) + bag
Potions: healing potion auto-triggers at 30% HP; buff potions str/agi/crit/speed last 3 combats
Buffs/debuffs panel: displayed in loadout and in combat header
Tavern: drink/sleep/rumours, locked during activity
Diary: unread star indicator, persisted
Graveyard: headstones with name/class/cause, banned from new character reuse
Save/load: localStorage full G state
Holy relic: once per bloodline, unlocks Acolyte
Kin intro scene: fullscreen fade on new character
Milestones/Chronicle: one-time flags, running log
Passive mid-journey events: 35% chance at 60% progress
Combat conditions: dark (bow penalty, magic bonus), cramped (2H penalty)

---

## KEY GLOBAL STATE (G object)

G.c — current character: name, charClass, level, xp, hp, maxHp, str, agi, int, con, gold, bag[], equipped{}, debuffs[], potionBuffs[], training{}, classHistory[], deaths
G.journey — active mission state (null when not on mission)
G.journeyEnded — flag to prevent double-resolve
G.tavernActivity — truthy while tavern activity running
G.diaryUnread — unread count
G.lastCombatSim — last sim result for replay
G.milestones — Set of milestone keys already triggered
G.graveyard — array of death records
G.vault — heirloom items persisted across deaths
G.unlocked — array of unlocked class keys

NEW in v0.5.1 (add to G, save, and load with fallbacks):
  G.currentTown — string: 'dawnhearth'|'millriver'|'grimhollow'|'farradin' (default: 'dawnhearth')
  G.startingTown — string: town player started in this life (set on char create, used in ending text)
  G.pendingTownArrival — string|null: next town to arrive at after adventure completes

---

## ARCHITECTURE PATTERNS

All game config at top of file: ITEMS_DB, ENEMIES, MISSIONS, CLASS_DEFS, TRAINING_PERKS, SHOP_POOL
Building interactions via modal: openModal(id) / closeModal() / setModal(title, bodyHTML)
Each building has a function: ashenFlagon(), ironVault(), church(), noticeboard(), etc.
simulateCombat(playerStats, enemyStats) returns {events[], won, finalPH, finalEH, player, enemy}
buildPlayerStats() computes all stats from equipped + class perks + training + active buffs
tickJourney() called on timer, advances mission progress bar
save() / load() — JSON to localStorage key 'yonder_save'
Kin lines: KIN_NPC_LINES config object keyed by building name
Moon quotes: MOON_QUOTES — convert from flat array to town-keyed object (see gamedata)
render() — main re-render of town screen

---

## WHAT TO BUILD (v0.5.1)

All content is in yonder_gamedata.md. Build in this order. Verify syntax and test Dawnhearth still works after each layer.

### Layer 1 — Data only (no logic changes)
Add to ITEMS_DB: all new class start items, Millriver shop items, Grimhollow shop items, Farradin shop items, mythic items, cursed_bone, cursed_crown
Add to ENEMIES: all Millriver, Grimhollow, Farradin enemies
Add new class definitions for Shaman, Druid, Shepherd, Warlock, Shadowblade, Plague Doctor
Add new training perks for all 6 new classes
Add mission config objects: MISSIONS_MILLRIVER, MISSIONS_GRIMHOLLOW, MISSIONS_FARRADIN
Add shop pool arrays: SHOP_POOL_MILLRIVER, SHOP_POOL_GRIMHOLLOW, SHOP_POOL_FARRADIN
Convert MOON_QUOTES from flat array to {dawnhearth:[...], millriver:[...], grimhollow:[...], farradin:[...]}

### Layer 2 — Multi-town infrastructure
Add G.currentTown, G.startingTown, G.pendingTownArrival to G init and to save()/load() with fallbacks
Write arriveInTown(town): resets missions, shop slots, applies theme, adds arrival diary, calls render()
Write getTownMissions() / setTownMissions(): read/write town mission state to per-town localStorage key
Make initMissions() route to correct pool based on G.currentTown
Make getShopPool() return correct pool based on G.currentTown
Update death/restart: class home towns, correct start level
Update graveyard: stamp town field on death records
In resolveJourney(): check if mission has arrivesTown field, set G.pendingTownArrival
In proceedToTown(): if G.pendingTownArrival set, call arriveInTown after delay

### Layer 3 — CSS
Add town palette vars injected by arriveInTown (set data-town attribute on body, use CSS attribute selectors)
Waterwheel: CSS keyframe rotation, positioned behind The Mill building tile
Grimhollow particles: sparse drifting green dots, CSS keyframe, very low opacity, pointer-events:none overlay
Farradin castle silhouette: CSS shape or SVG, offset right, behind Castle Gate tile, one lit window
Mythic rarity colour: deep amber (#c8862a) for item name text
Grimhollow glow pulse: CSS animation on The Hollow building tile only (--grim-glow:#7aff5a)
Quest colour classes: .quest-millriver (purple), .quest-grimhollow (orange), .quest-farradin (red)

### Layer 4 — Building modals
For each expansion town, write the building modal functions following existing patterns exactly.
Millriver: waterfrontInn(), countingHouse(), ferrymansShrine(), mrNoticeboard(), guildHall(), tradingPost(), theMill()
Grimhollow: rottingFlagon(), theCrypt(), thornwallShrine(), ghNoticeboard(), theHollow(), apothecary(), grimgate()
Farradin: crownAndStone(), farradinVault(), cathedral(), farNoticeboard(), royalProvisioner(), castleGate()
Noticeboard functions: read from getTownMissions(), render missions using existing mission card patterns
Taverns: same mechanics as Ashen Flagon (drink, sleep, rumours) — just different names and kin lines
Banks: same mechanics as Iron Vault
Shrines/training buildings: same mechanics as Ember Sanctum and Ember Church
Shop buildings: same mechanics as Morrow's Sundries, use town shop pool
Class encounter modals: shown when unlock conditions met (see class data in gamedata.md)
renderTownBuildings(): called by render(), injects correct building HTML for current town

### Layer 5 — New mechanics
In buildPlayerStats():
  Shepherd Steadfast: if Steadfast trained, CON gives +3HP/pt not +2
  Shadowblade ShadowStep: if trained, agi speed bonus is 0.6%/pt not 0.5%
  Shadowblade dual wield: if class=Shadowblade AND dagger in weapon AND dagger in offhand: dmg*1.15, speed+0.1
  Warlock DarkPact: flag player.darkPactPct for use in simulateCombat
  Warlock Hex: flag player.hexChance for use in simulateCombat
  Plague Doctor Miasma: flag player.miasma=true if plague_mask equipped
  Plague Doctor TinctureBelt: flag player.tinctureBelt=true if tincture_belt in pack slot
  All new training perks read from G.c.training{} using perk key

In simulateCombat():
  Biscuit: at start of each player dmg receive, if biscuit item in any pack slot, roll 10% (+ BiscuitFocused rank*8%). On success, halve incoming dmg, log "Biscuit steps in front of it."
  crook_of_ages mythic: if equipped, double Biscuit chance, log "Biscuit has had enough."
  Warlock DarkPact: after player deals dmg, heal player.darkPactPct% of dmg dealt. Log: "[Name] draws life from the wound."
  Warlock Hex: 15% chance per hit (+ CurseMark rank*8%), apply debuff -20% enemy dmg for 3 hits. Log: "The hex takes hold."
  Plague Doctor Miasma: at start of each enemy turn, enemy takes 2 flat dmg. Log: "The air is wrong here."
  Shadowblade Vanish: per-hit, if Vanish trained, roll 10%/rank to avoid hit entirely. Log: "Gone."
  Shadowblade PoisonEdge: hits apply poison (3 dmg x rank per enemy turn, 3 turns). Stack/refresh each hit.
  Acolyte Mend: per enemy hit received, if Mend trained, heal rank*3 HP. (This was in 0.3.8, check it's still working)
  Cursed King at 50% HP: push special event to log, pause replay momentarily, show his line
  last_stand mythic: if HP would go to 0 or below, set to 1 instead — once per combat flag

Post-combat (in resolveJourney, after combat, before returning to town):
  Plague Doctor TinctureBelt: if player.tinctureBelt, heal 20% maxHP (+ FieldExtraction rank*8%). Not a potion.
  poison damage over time: tracked per turn in combat sim, applied correctly in replay

### Layer 6 — Flow, UI, ending
openMoon(): pick quote from MOON_QUOTES[G.currentTown||'dawnhearth']
Kin lines: extend KIN_NPC_LINES with millriver/grimhollow/farradin keys (see gamedata.md)
Class unlock flow: NPC encounter modal shown when conditions met, player chooses to join
Night Watch Shepherd path: tavern drink has small % chance to surface rumour, which adds Night Watch to noticeboard
cursed_bone pickup: add to bag, immediately check Warlock unlock, show NPC encounter
Plague Doctor check: after each Grimhollow bounty complete, check if all 4 done, if so trigger NPC encounter
showEnding(): full screen, text fade sequence line by line, Begin Again / Rest Here buttons
bagItemAction(): before equipping cursed_crown, intercept with confirm dialog. If confirmed, showEnding().
Chronicle: add ending milestone entry on win
doReset(): ensure vault heirlooms and biscuit cleared appropriately on full reset

---

## CRITICAL PITFALLS — LEARN FROM PAST FAILURES

### The most important rule
Read the COMPLETE function before touching it. Do not search for a target string and patch around it.
Multiple functions share near-identical lines. Patching by string match will hit the wrong one.

Specific duplicated lines to be aware of:
  G.journey=null — appears in both resolveJourney() AND proceedToTown()
  G.journeyEnded=false — same
  completeMission(...) call context
  save(); render(); — appears everywhere

Always anchor edits to the function signature + first 3-4 unique lines to confirm you're in the right function.

### String quoting
All JS strings that contain apostrophes MUST use double quotes or template literals.
Single-quoted strings with apostrophes will silently break the entire script at parse time.
Example of wrong: 'The merfolk don't speak'
Example of right: "The merfolk don't speak"
Every piece of flavour text must be checked for apostrophes before writing.

### Save/load
Every new field added to G must be:
  1. Added to G init with a default value
  2. Serialised in save()
  3. Deserialised in load() with a safe fallback (e.g. G.currentTown = saved.currentTown || 'dawnhearth')
Skipping the fallback will break any existing save file.

### Biscuit
Heirloom. Must survive death and appear in vault. Cannot be lost.
Checked by item KEY not by slot. Check bag AND both pack slots.
Does not get its own slot type — it sits in pack/pack2 like any pack item.
crook_of_ages doubles its intervention chance — check for that item key when rolling.

### Ending screen
Must show confirm dialog before equipping cursed_crown. Equip = no going back.
G.startingTown must be set at character creation and persisted. Ending text references it.

### Shadowblade dual wield
Class-specific check only — only applies if G.c.charClass === 'Shadowblade'.
Check weapon slot type AND offhand slot type both === 'dagger'.

### Modal overflow
All modal content must fit without scrolling. Keep building modals compact. Fixed-height tiles.

### World voice
Never break immersion with mechanical language in player-facing text.
Wrong: "You have completed the bounty. Bonus: Druid unlocked."
Right: The NPC encounter plays, and they invite you in.
The player should discover class unlocks through world interactions, not UI popups.

### G.currentTown default
Dawnhearth characters have no G.currentTown set in existing saves. Always fall back to 'dawnhearth'.

### Testing checklist after each layer
- Dawnhearth still fully playable (existing saves load, all buildings work, combat works)
- Inventory opens without error (buildBuffsHTML needs const pills=[] declared)
- Missions complete and G.journey clears correctly
- No remaining 'still away' state after mission return
