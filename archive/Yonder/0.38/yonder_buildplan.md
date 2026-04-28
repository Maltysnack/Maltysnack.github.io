# YONDER — v0.5.1 BUILD PLAN
# Last updated: 2026-03-09
# This is the implementation checklist. All design decisions are in yonder_gamedata.md.
# All architectural context is in yonder_context.md.

---

## BEFORE YOU START

1. Read yonder_context.md fully — especially CRITICAL PITFALLS
2. Read yonder_gamedata.md for all content specifics
3. Copy yonder_038.html to yonder_051.html
4. Open yonder_038.html in a browser and confirm Dawnhearth works end to end
5. Run node --check on the extracted script to confirm clean baseline

---

## APPROACH

Do NOT use large string-replacement scripts. The file has many near-identical lines across different functions.
Instead: for each function you need to modify, read it in full first, then edit it directly.
Work in layers. After each layer, syntax-check the script block and test Dawnhearth still works.

---

## LAYER 1 — DATA CONFIGS
Goal: add all new content to config objects. No logic changes. No new functions yet.

[ ] Add to ITEMS_DB:
    - All new class start items (spirit_staff, river_cloak, carved_bone_amulet, gnarled_staff, bark_vest, root_amulet, shepherds_crook, wool_vest, biscuit, bone_staff, void_cloak, pact_ring, shadow_daggers, offhand_shadow_dagger, dark_leather_vest, void_band, bone_saw, plague_mask, tincture_belt)
    - Key items: cursed_bone, cursed_crown
    - All Millriver shop items (21 items — see gamedata.md)
    - All Grimhollow shop items (20 items — see gamedata.md)
    - All Farradin shop items (20 items — see gamedata.md)
    - All 11 mythic items (see gamedata.md)

[ ] Add to ENEMIES array:
    - 6 Millriver enemies (lv10-15)
    - 7 Grimhollow enemies (lv18-23)
    - 5 Farradin enemies (lv26-30 including The Cursed King)

[ ] Add new class definitions for Shaman, Druid, Shepherd, Warlock, Shadowblade, Plague Doctor
    Follow exact format of existing class defs. Include: key, name, startLevel, stats, startItems[], perks[], homeTown

[ ] Add new training perks for all 6 new classes to TRAINING_PERKS object
    Follow exact format of existing entries

[ ] Add mission config objects:
    MISSIONS_MILLRIVER = { jobs:[...], bounties:[...], quest:{...}, adventure:{...} }
    MISSIONS_GRIMHOLLOW = { jobs:[...], bounties:[...], quest:{...}, adventure:{...} }
    MISSIONS_FARRADIN = { jobs:[...], bounties:[...], finalQuest:{...} }
    Each mission object should match the shape of existing missions in MISSION_POOL

[ ] Add shop pool arrays:
    SHOP_POOL_MILLRIVER = [...] (common/crafted items)
    SHOP_POOL_GRIMHOLLOW = [...] (crafted/enchanted items)
    SHOP_POOL_FARRADIN = [...] (enchanted/legendary items + mythic at low weight)

[ ] Convert MOON_QUOTES from flat array to town-keyed object:
    const MOON_QUOTES = {
      dawnhearth: [...existing quotes...],
      millriver: [...new quotes...],
      grimhollow: [...new quotes...],
      farradin: [...new quotes...]
    }

[ ] SYNTAX CHECK. [ ] TEST Dawnhearth still works.

---

## LAYER 2 — MULTI-TOWN INFRASTRUCTURE
Goal: G.currentTown wired up. Town transitions work. Missions and shop route to correct town.

[ ] Add to G init object: currentTown:'dawnhearth', startingTown:'dawnhearth', pendingTownArrival:null
[ ] Add to save(): include currentTown, startingTown, pendingTownArrival
[ ] Add to load(): G.currentTown = saved.currentTown || 'dawnhearth' (and same for the others)
[ ] Set G.startingTown = G.currentTown on character creation (in the new character init)

[ ] Write getTownMissions():
    Key = 'yonder_missions_' + G.currentTown
    Return parsed localStorage value or null

[ ] Write setTownMissions(data):
    localStorage.setItem('yonder_missions_' + G.currentTown, JSON.stringify(data))

[ ] Modify initMissions() to use getTownMissions()/setTownMissions() and route to correct pool by G.currentTown

[ ] Write getShopPool():
    if G.currentTown === 'millriver' return SHOP_POOL_MILLRIVER
    if G.currentTown === 'grimhollow' return SHOP_POOL_GRIMHOLLOW
    if G.currentTown === 'farradin' return SHOP_POOL_FARRADIN
    return SHOP_POOL (existing Dawnhearth pool)

[ ] Modify shop slot generation to use getShopPool()

[ ] Write arriveInTown(town):
    G.currentTown = town
    Add travel diary entry (see gamedata.md for text per transition)
    Add arrival diary entry
    Reset missions (clear town mission key from localStorage, re-init)
    Reset shop slots (clear yonder_shop_slots)
    applyTownTheme(town)
    save()
    render()

[ ] Write applyTownTheme(town):
    document.body.setAttribute('data-town', town)
    (CSS vars swap via [data-town="millriver"] selectors added in Layer 3)

[ ] Write renderTownBuildings():
    Returns HTML string for the 7 building tiles of G.currentTown
    Dawnhearth: returns existing static building HTML (or leave that as-is in the HTML template)
    Expansion towns: generate building tiles dynamically with correct labels and onclick handlers

[ ] Modify render() to call renderTownBuildings() and inject result

[ ] In resolveJourney():
    After combat/mission outcome resolved, check if j.mission.arrivesTown is set
    If so: G.pendingTownArrival = j.mission.arrivesTown

[ ] In proceedToTown(died):
    If !died && G.pendingTownArrival:
      const dest = G.pendingTownArrival
      G.pendingTownArrival = null
      save()
      setTimeout(() => arriveInTown(dest), 400)
      return
    (rest of existing proceedToTown logic continues normally)

[ ] Death/restart: when character dies, spawn new character at class's homeTown at class's startLevel
    Read homeTown from class definition. If 'millriver', 'grimhollow', etc — set G.currentTown accordingly before render.

[ ] Graveyard: stamp G.currentTown on death record object when addToGraveyard() is called
    Filter graveyard display by G.currentTown when rendering graves

[ ] SYNTAX CHECK. [ ] TEST Dawnhearth works. [ ] TEST mission completion clears G.journey correctly.

---

## LAYER 3 — CSS
Goal: Town palettes, visual effects. No JS logic changes.

[ ] Add CSS variable swap rules using data-town attribute:
    [data-town="millriver"] { --deep: #0d1a1f; --stone: #1e2e30; ... (all river vars) }
    [data-town="grimhollow"] { --deep: #070d07; --stone: #111a11; ... (all grim vars) }
    [data-town="farradin"] { --deep: #0a0b10; --stone: #141620; ... (all far vars) }
    Use the exact palette values from gamedata.md

[ ] Waterwheel animation:
    CSS keyframe @keyframes spin { to { transform: rotate(360deg) } }
    .waterwheel { animation: spin 8s linear infinite; position: absolute; ... }
    Positioned behind The Mill building tile. [data-town="millriver"] .waterwheel { display: block }
    Hidden by default.

[ ] Grimhollow particles:
    Small divs injected by arriveInTown('grimhollow'), removed on leaving
    CSS keyframe drift — slow upward float with slight sway
    Colour: rgba(122, 255, 90, 0.15) — very low opacity
    pointer-events: none, position: fixed, z-index: low

[ ] Farradin castle silhouette:
    CSS-drawn or inline SVG dark shape behind Castle Gate building tile
    One lit window: small rectangle, slightly warm colour
    [data-town="farradin"] .castle-silhouette { display: block }
    Hidden by default.

[ ] Mythic rarity text colour:
    .rarity-mythic { color: #c8862a }
    Apply wherever item rarity is rendered

[ ] Grimhollow glow pulse on The Hollow ONLY:
    .building-hollow .bld-label { animation: glowPulse 3s ease-in-out infinite }
    @keyframes glowPulse { 0%,100% { color: var(--grim-pale) } 50% { color: #7aff5a; text-shadow: 0 0 8px #7aff5a } }

[ ] Quest colour classes:
    .quest-millriver { color: #9a6abf }
    .quest-grimhollow { color: #b87040 }
    .quest-farradin { color: #b84040 }
    Apply to quest-type mission cards

[ ] SYNTAX CHECK. [ ] TEST all town visuals render correctly.

---

## LAYER 4 — BUILDING MODALS
Goal: All expansion town building interactions work. Follow existing patterns exactly.

For each building, write a function following the same pattern as existing buildings:
- setModal(title, body) to display
- Read kin line from KIN_NPC_LINES
- Compact layout, no scroll overflow

[ ] Extend KIN_NPC_LINES with millriver, grimhollow, farradin keys (text in gamedata.md)

[ ] Millriver buildings:
    waterfrontInn() — same mechanics as ashenFlagon(): drink, sleep, rumours. Rumour can roll Night Watch.
    countingHouse() — same mechanics as ironVault(): deposit, withdraw
    ferrymansShrine() — Shaman training if unlocked, kin line, flavour. Same pattern as church().
    mrNoticeboard() — read getTownMissions(), display active jobs/bounties/quest/adventure. Same pattern as existing noticeboard().
    guildHall() — Druid training if unlocked, kin line, flavour
    tradingPost() — shop, reads SHOP_POOL_MILLRIVER. Same pattern as morrowansSundries().
    theMill() — Shepherd training if unlocked, kin line, flavour. Adventures depart from here.

[ ] Grimhollow buildings:
    rottingFlagon() — tavern
    theCrypt() — bank
    thornwallShrine() — Shadowblade training
    ghNoticeboard() — noticeboard
    theHollow() — Warlock training. The glow pulse is on the building tile, not the modal.
    apothecary() — Plague Doctor training + shop (reads SHOP_POOL_GRIMHOLLOW)
    grimgate() — adventure departure, disabled until signature quest complete

[ ] Farradin buildings:
    crownAndStone() — tavern
    farradinVault() — bank
    cathedral() — healing (50% missing HP, same as church healing prayer mechanic) + blessing
    farNoticeboard() — noticeboard
    royalProvisioner() — shop (reads SHOP_POOL_FARRADIN)
    castleGate() — final quest departure, always available in Farradin

[ ] Class encounter modals (separate from building modals):
    showClassEncounter(className) — full-width encounter modal with NPC text and "Join" button
    Called when class unlock conditions are met (see each class in gamedata.md)
    Knight and Acolyte already have encounter patterns in existing code — follow those

[ ] renderTownBuildings() — complete implementation injecting correct 7-building row per town

[ ] SYNTAX CHECK. [ ] TEST all modals open. [ ] TEST noticeboard shows correct missions per town.

---

## LAYER 5 — NEW MECHANICS
Goal: All new class perks and item specials work in combat and stat calculation.

[ ] In buildPlayerStats() — add blocks for each new class:
    Shaman: SpiritBond +10% elemental, RiverSense +8% resistance, Stormcall/Stormwall/AncestralShield from training
    Druid: Thornward +8% armour, GroveSense +5% crit (check mission type for wilderness), Entangle/RootSnare/WildShape from training
    Shepherd: Steadfast (CON*3 HP/pt if trained), FlockLeader/WoolArmour from training
    Warlock: DarkPact and Hex flagged, SoulDrain/CurseMark/VoidShield from training
    Shadowblade: FirstBlood flagged, ShadowStep (agi*0.6%), dual-wield check, Vanish/BladeFlurry/PoisonEdge from training
    Plague Doctor: TinctureBelt flagged, Miasma flagged from plague_mask, ToxicBlade/Resilience/FieldExtraction from training

[ ] In simulateCombat() — add new perk hooks. Add in clearly marked sections, not interleaved with existing logic:
    Biscuit intervention: per enemy hit, before damage applied to player
    crook_of_ages: doubles Biscuit chance when equipped
    Warlock DarkPact: per player hit, after damage applied to enemy
    Warlock Hex: per player hit, chance to apply debuff
    Plague Doctor Miasma: start of each enemy turn, flat 2 damage to enemy
    Shadowblade Vanish: per enemy hit, chance to avoid entirely
    Shadowblade PoisonEdge: per player hit, apply/refresh poison stack
    Shadowblade dual-wield: damage and speed already computed in buildPlayerStats, just ensure it flows through
    The Cursed King 50% HP event: check in main combat loop, push once (use a flag)
    last_stand mythic (the_undying_vest): intercept lethal hit, set HP to 1, set flag to prevent repeat
    Poison damage: applied per enemy turn if active stacks exist

[ ] Post-combat in resolveJourney():
    Plague Doctor TinctureBelt: if player.tinctureBelt, after combat win, heal 20% maxHP (+ FieldExtraction)
    cursed_drain (cursed_satchel): +3HP on kill — implement in simulateCombat kill event
    gold bonuses: counting_house_lockbox (+10%), the_kings_purse (+25%) — already handled if getActiveLoot() multiplies gold by equipped item bonuses

[ ] Shepherd Steadfast: HP formula: player_hp = 10 + (lv*2) + (con * (steadfast_trained ? 3 : 2))
    This affects both buildPlayerStats() and anywhere maxHP is recalculated

[ ] Night Watch unlock chain:
    In waterfrontInn() drink rumour roll: small % chance to surface Night Watch job
    Add Night Watch to noticeboard: mission with hidden:true, only appears via rumour
    On Night Watch complete: add biscuit to bag, trigger Shepherd NPC encounter

[ ] cursed_bone pickup:
    When cursed_bone added to bag (from bounty loot roll): trigger showClassEncounter('Warlock')

[ ] SYNTAX CHECK. [ ] TEST each new class in combat. [ ] TEST Biscuit intervention logs. [ ] TEST Dawnhearth classes unaffected.

---

## LAYER 6 — UI, FLOW, ENDING
Goal: Town transitions feel right, class unlocks are smooth, ending works.

[ ] openMoon(): pick from MOON_QUOTES[G.currentTown||'dawnhearth'] instead of flat array

[ ] getTavernName(): return correct tavern name per G.currentTown
    dawnhearth: "Ashen Flagon", millriver: "Waterfront Inn", grimhollow: "Rotting Flagon", farradin: "Crown and Stone"

[ ] Diary entries: arriveInTown() adds correct arrival diary. Adventure missions add travel diary on mission start.

[ ] Class unlock polish:
    Knight: existing (complete bounty at lv3+)
    Ranger: existing (find short_bow)
    Acolyte: existing (holy relic)
    Shaman: after "Something in the Water" completes, trigger encounter on return to town
    Druid: after Ferryman's Problem + one other bounty, trigger encounter on return to town
    Shepherd: Night Watch complete triggers encounter
    Warlock: cursed_bone pickup triggers encounter immediately
    Shadowblade: after "The Hollow Man" completes, trigger encounter
    Plague Doctor: after all 4 GH bounties done, trigger encounter at next Apothecary visit

[ ] showEnding():
    Full screen overlay, dark background, faint castle
    Text blocks fade in one by one with setTimeout delays
    Populate [Name], [Class], [G.startingTown] from G.c and G.startingTown
    Show buttons after all text visible

[ ] bagItemAction() equip intercept for cursed_crown:
    Before equipping, show confirm: "The crown is cold in your hands. You know what happens next. Are you certain?"
    If confirmed: equip it, immediately call showEnding()

[ ] endingBeginAgain(): full doReset(), show create screen
[ ] endingRestHere(): mark G.c.ending_done=true, save(), return to home screen, disable departure buttons

[ ] Chronicle ending milestone: add gold milestone entry on win (text in gamedata.md)

[ ] doReset(): clear yonder_missions_millriver, yonder_missions_grimhollow, yonder_missions_farradin, yonder_shop_slots, yonder_vault_heirlooms from localStorage on full reset

[ ] Final walkthrough:
    New DH character: all original content works
    Travel to Millriver: theme changes, buildings correct, missions correct, shop correct
    Travel to Grimhollow: same checks
    Travel to Farradin: same checks
    Kill Cursed King: crown drops, equip, ending triggers, beginning again works
    Death in each town: respawn at correct home town for class
    Heirlooms: survive death correctly, appear in vault

[ ] FINAL SYNTAX CHECK. [ ] FULL PLAY TEST.

---

## NOTES ON SPECIFIC TRICKY AREAS

### resolveJourney vs proceedToTown
resolveJourney() handles: XP/gold/rep award, combat, loot, class unlock checks, mission completion, pendingTownArrival set
proceedToTown(died) handles: G.journey=null, G.journeyEnded=false, screen transition
These are TWO different functions. Read both in full before touching either.
The line G.journey=null appears in BOTH. The line G.journeyEnded=false appears in BOTH.
Only touch the one you mean to touch.

### completeMission(type, isCitizen)
Called from resolveJourney BEFORE G.journey is cleared.
It needs G.journey.mission to still be accessible when it runs.
Expansion bounty completion checks (class unlocks, Plague Doctor check) go here, using G.journey.mission.id to identify which bounty.

### buildPlayerStats() structure
Read the full function before adding. It builds in order:
1. Base stats from class
2. Equipped item bonuses
3. Training bonuses (existing: Knight, Ranger, Acolyte)
4. Class perk calculations
5. Condition modifiers
Add new class training blocks at step 3 in a clearly marked section. Do not interleave.

### simulateCombat() structure
Read the full function before adding. The main loop is:
  while both alive:
    if player turn: player attacks enemy
    else: enemy attacks player
    advance time
New perk hooks go at clearly marked points within the turn. Do not restructure the loop.
IMPORTANT: add // --- NEW PERK: [name] --- comments to mark every new block.

### Biscuit is an heirloom
In addToGraveyard() or wherever vault heirlooms are collected on death:
biscuit has heirloom:true — it should land in G.vault not be lost.
On new character creation: vault heirlooms stay in vault (existing behaviour), player can retrieve via Iron Vault/Counting House/etc.
The vault text for biscuit is: "Someone left this. Wouldn't say who. The sheep seems to know you."
