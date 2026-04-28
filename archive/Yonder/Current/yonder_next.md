# Yonder — Next Session Notes
# Current build: yonder_051.html (public as projects/yonder.html)
# Last updated: 2026-03-13

---

## BUGS FIXED (sessions 2026-03-11 / 2026-03-12)

- Bug 1: Town progression unblocked — added 'The Road North' adventure with arrivesTown:'millriver'
- Bug 2: Save migration — initTownMissions() now called on Continue with no active journey
- Bug 3/4: Gear contribution fixed — loot generator now uses ITEMS_DB items from town pool
- Bug 5: Stats/HP bar now updates immediately after levelling up
- Bug 7: Acolyte now starts with cracked_staff
- Bug 10: h-status resets to IN TOWN on return
- Bug 14: Adventures filtered out of noticeboard (gate only)
- Bug 16: Tavern lock uses G.tavernActivity flag, works across all towns
- Academy: expansion class training now accessible
- buyTraining: modal refreshes for all town buildings

## NEW FEATURES ADDED (2026-03-13)

- GAME_VERSION='0.52' constant at script top; home screen shows 'v0.52' in grey corner (bumped opacity to 0.6, size to 10px)
- Shop eq-compare tiles: min-height:64px + rarity border-left accent (CSS + wired in shop() eqHtml)
- buyItem(): auto-equips to empty slot on purchase; pack→pack2 overflow; diary message notes "equipped"
- bagItemAction(): pack→pack2 overflow when equipping from bag
- getRumourHint(town): pool of 5 flavour hints per town (dawnhearth/millriver/grimhollow/farradin)
- resolveTavern() drink overhaul: 8 outcomes — small find, rumour, speed buff (3 charges), lucky hand, card game, scuffle, hangover debuff, quiet night+XP; fixed hardcoded 'The Ashen Flagon'
- Sleep now also clears potionBuff debuffs (hangover clears on rest)
- buildBuffsHTML(): respects b.label and b.debuff for custom labels and negative pills
- buildPlayerStats(): hangover potionBuff applies -1 Agility for 3 combats
- Stat tooltips: Agility now says "crit + damage with bows and daggers" (was "attack speed + crit")
- Mobile: portrait overlay forces landscape rotation prompt (640px breakpoint)
- AUDIO: 6 new building sounds — playShopBell, playChant, playTavern, playVault, playPaper, playAcademy
- AUDIO: openModal() routes building-specific SFX instead of always playDoor()
- AUDIO: startTownAmbience(town) — per-town profiles (drone freq/wind/crackle varies by town)
- AUDIO: Grimhollow gets distant howl loop (_startHowl), Millriver gets river-like wind, Farradin gets higher drone
- Pack 2 slot: now visible in loadout and shop equip panels
- Potions only activate on combat missions (bounty/quest/adventure), not jobs
- applyMissionConditions(): cold (-5 HP if no body armour), dark (bow damage/crit halved), cramped (2H damage -25%), climbing (rope +5 HP / no rope -3-8 dmg)
- conditions added to 15+ missions across all 4 towns (dark, cold, cramped, climbing)
- renderCombat(): displays condition notes as italic combat log events (penalty=red, bonus=green)
- Day/night cycle indicator in HUD header (🌅/☀️/🌇/🌙 based on real time)

## NEW FEATURES ADDED (2026-03-12)

- simulateCombat: Plague Doctor Miasma (2 dmg/turn to enemy while plague_mask equipped)
- simulateCombat: Biscuit intervention (10% + 8%/rank chance to halve incoming dmg; doubled with crook_of_ages)
- simulateCombat: Last Stand — the_undying_vest lets player survive at 1hp once per combat
- simulateCombat: Ashwalker — heals 8% max HP on kill
- buildPlayerStats: Shadowblade dual-dagger bonus (+15% dmg, +0.1 speed)
- buildPlayerStats: Pale Bow perk applies +20% crit
- renderCombat: event log lines for miasma, biscuit, laststand, ashwalker

---

## REMAINING BUGS

### Bug 6 — Holy Relic no reward
Probably fixed incidentally (j.mission.id==='holy_relic' fallback exists). Needs in-game verification.

### Bug 8 — Acolyte combat replay broken
Lay On Hands keeps player alive past 300-loop cap. Events array too large. Replay bars jump.
Fix: trim events array to first eH===0 event; don't render events after enemy is dead.

### Bug 9 — Acolyte can't join after holy relic (citizen path)
completeMission() citizen branch may skip holy_relic_done flag.
Fix: audit completeMission() — isCitizen and holy_relic_done are independent concerns.

### Bug 11 — Training spend doesn't update UI immediately
buyTraining() re-renders modal but diary message has hardcoded Dawnhearth building names.
Minor polish only.

### Bug 12 — Training armour not visibly changing reduction
Loadout may show raw armour not computed reduction %. Tied to stats display, not combat.

---

## REMAINING FEATURES TO BUILD

### High priority
- Shepherd Night Watch unlock: tavern drink in Millriver has % chance of Night Watch rumour → adds mission to noticeboard
- Warlock cursed_bone pickup: add to bag → immediately check Warlock unlock → show NPC encounter
- Plague Doctor 4-bounties check: after each Grimhollow bounty, check if all 4 done → trigger NPC encounter

### Polish
- ~~Rumours (Bug 17)~~ DONE: 8-outcome tavern drink table with rumour hints, buffs, debuffs
- Heirlooms auto-vault on death: biscuit and sigil_ring should survive death via saveVaultHeirlooms()
- Ending screen: cursed_crown equip should show confirm dialog before triggering showEnding()

### Design feature ideas (logged, not yet implemented)
- Weather system: random weather per town (rain, fog, clear, storm) affecting town screen visuals and adding condition modifiers to missions
- Character portrait/silhouette: class-based ASCII/emoji silhouette on loadout screen that changes with equipped gear

### Mechanics not yet implemented
- crit_plus_20 (pale_bow): already in buildPlayerStats ✓
- vuln_stack (voidreaper): each hit stacks enemy vulnerability — not yet in simulateCombat
- double_magic (worldstaff): magic damage doubled — not yet in simulateCombat
- biscuit_double (crook_of_ages): already in simulateCombat ✓
- reduce_enemy_crit (watcher's hood): not yet in simulateCombat
- mission_speed (cloak_of_long_road): mission duration reduced — not yet in startMission()
- heal_on_kill (ashwalker): already in simulateCombat ✓
- block_return (aegis_of_fallen): reflected damage on block — not yet in simulateCombat

---

## WORKFLOW REMINDER

1. Edit: Yonder/Current/yonder_051.html
2. Archive old public file: cp projects/yonder.html Yonder/Archive/yonder_0XX.html
3. Copy new build to public: cp Yonder/Current/yonder_051.html projects/yonder.html
4. Commit and push both
