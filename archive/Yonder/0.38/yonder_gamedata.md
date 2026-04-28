# YONDER — GAME DATA REFERENCE
# Version: v0.5.1 target (base: yonder_038.html)
# Last updated: 2026-03-09
# All content is locked. Do not make design decisions from this file.

---

## TOWNS

### Dawnhearth — Town 1 (BUILT)
Frontier tutorial town. No mention of Farradin anywhere.
Classes: Citizen, Knight, Ranger, Acolyte
  --black:#050403 | --deep:#0d0a07 | --stone:#181410 | --mud:#231d14 | --ash:#332a1e
  --bone:#7a6e5c | --parchment:#b89a5c | --gold:#c9963a | --ember:#b84a25
  --ember-dim:#6e2d15 | --text:#a89878 | --text-dim:#5a4f3d | --text-bright:#c8b890
Buildings (L to R): Ashen Flagon, Iron Vault, Ember Church+Graveyard, Noticeboard, Ember Sanctum, Morrow's Sundries, East Gate (Ranger Post)
Arrival diary: "[Name] arrives in Dawnhearth. The fires burn as they always have."

### Millriver — Town 2 (v0.5.1)
River town. Waterwheel centrepiece. Farradin mentioned occasionally and in passing only.
Classes: Shaman, Druid, Shepherd
  --river-deep:#0d1a1f | --river-stone:#1e2e30 | --river-moss:#2a3d35
  --river-fog:#8aaa9a | --river-teal:#4a9a8a | --river-wood:#3d2a1a
Buildings (L to R): Waterfront Inn, Counting House, Ferryman's Shrine, Noticeboard, Guild Hall, Trading Post, The Mill
Waterwheel: CSS animated rotation behind The Mill. Not clickable.
Arrival diary: "[Name] reaches Millriver. The wheel is turning. The river is loud enough that the quiet underneath it takes a moment to notice."
Travel diary (DH to MR): "Left Dawnhearth on the King's Road. The fires were still burning when I looked back. I stopped looking back after the first hill."

### Grimhollow — Town 3 (v0.5.1)
Dying forest. Ancient trees, bioluminescent glow, rot. Farradin mentioned frequently and with weight.
Classes: Warlock, Shadowblade, Plague Doctor
  --grim-dark:#070d07 | --grim-stone:#111a11 | --grim-rot:#1a2a1a
  --grim-fog:#6a7a6a | --grim-glow:#7aff5a (pulses on The Hollow building ONLY) | --grim-pale:#c8d4c0
Ambient: sparse drifting green particles, very low opacity, CSS-only.
Buildings (L to R): Rotting Flagon, The Crypt, Thornwall Shrine, Noticeboard, The Hollow, Apothecary, Grimgate
Arrival diary: "Made it to Grimhollow. The road was passable. I didn't write down everything I saw on it."
Travel diary (MR to GH): "The road north out of Millriver gets quiet fast. The trees get older. The wheel sound fades. After that it's just the road and whatever's on it."

### Farradin — Town 4, Final (v0.5.1)
Capital city. Castle silhouette offset right behind Castle Gate, one lit window upper-left. No new classes.
  --far-deep:#0a0b10 | --far-stone:#141620 | --far-grey:#1e2030
  --far-fog:#7a7a90 | --far-gold:#8a7a40 | --far-bright:#c8c8d8
Buildings (L to R): Crown & Stone, Farradin Vault, Cathedral, Noticeboard, Royal Provisioner, Castle Gate
Arrival diary: "[Name] reaches Farradin. The castle is right there. I could see it from the gate. The king's banner is still flying. I don't know why that's the part that bothers me."
Travel diary (GH to FAR): "The dark road is behind me. Farradin is ahead. The emissary's letters are still in my pack. I don't know why I kept them."

### Progression rules
One-way track. No returning.
Death: restart at that class's home town at that class's start level. Not always Dawnhearth.
Each town arrival: full reset of missions, noticeboard, shop slots.
Graveyard: death records carry a town field, filtered per town.
Adventures are town-transition missions. Gate shows adventure only after signature quest complete.
Quest rarity colours: Dawnhearth=default, Millriver=purple, Grimhollow=orange, Farradin=red.

---

## KIN LINES

### Dawnhearth (BUILT — see KIN_NPC_LINES in game file)

### Millriver
Waterfront Inn (Nessa, barkeep): "I've had people from every road come through that door. The ones from Dawnhearth always look like they're still surprised the world got bigger."
Counting House (Aldric, clerk): "The river takes things and gives things back. We write down what it gives. What it takes we leave off the ledger."
Ferryman's Shrine (the Ferryman): "The river has a name. We don't say it. Names give things expectations."
Noticeboard (unsigned): "The wheel turns. The water moves. The work doesn't stop because something upstream is wrong."
Guild Hall (Maren, warden): "We study what grows and what doesn't and why. The why is the part nobody else bothers with."
Trading Post (Ossel): "Came up from Dawnhearth road two years ago. Stayed because the rates are better. That's all. That's enough."
The Mill (old Cob): "She runs day and night. Has done since my father's father. The wheel doesn't care what's in the water. It just turns."

### Grimhollow
Rotting Flagon (Brek): "I've been pouring drinks in this place for thirty years. The faces change. The drinks don't. Neither does the dark."
The Crypt (Mold): "People worry about keeping their valuables near the dead. The dead don't steal. I've checked. Extensively."
Thornwall Shrine (note on stone): "Something was worshipped here before the town. The town grew around it without asking permission."
Noticeboard (old nailed notice): "Work still gets done here. We are still a town. The glow is just the glow. It's been the glow for years."
The Hollow (no text, a sound): "(The wood hums at a frequency just below hearing. You feel it in your back teeth.)"
Apothecary (the Doctor, masked): "Come in. Everything on the left bench is for healing. Everything on the right bench is for something else. Don't touch the right bench."
Grimgate (guard, not looking): "The road to Farradin is open. That doesn't mean it's safe. Those aren't the same thing and people keep confusing them."

### Farradin
Crown & Stone (barkeep, no name): "We serve good wine here. The conversation is quiet. We prefer it that way. We strongly prefer it that way."
Farradin Vault (vaultkeeper): "The vault has been here longer than the castle. We find that fact useful to remember."
Cathedral (a priest, not the head one): "The cathedral is open to all. The head priest is available by appointment. The appointment book is full. It has been full for some time."
Noticeboard (official notice, stamped): "By order of the royal administration. All matters of civic concern are being addressed. There is no cause for alarm. Please return to your homes."
Royal Provisioner (shopkeeper, careful): "We stock only the finest. The supply lines from the outer towns have been irregular lately. We make do. Everyone makes do."
Castle Gate (guard, looking through you): "The castle is not open to visitors at this time. Move along please. Have a good evening. Move along."

---

## MOON QUOTES

Dawnhearth quotes are currently a flat array (MOON_QUOTES). Convert to a town-keyed object:
  const MOON_QUOTES = { dawnhearth: [...existing quotes...], millriver: [...], grimhollow: [...], farradin: [...] }
openMoon() should pick from MOON_QUOTES[G.currentTown||'dawnhearth'].

### Millriver quotes
"I have watched this river longer than the river has watched itself. It remembers everything that passes through it. So do I."
"The fog is not mine. I only make it visible. What it hides was always there."
"Dawnhearth is a long way behind you now. The fires still burn there. They don't know you've left."

### Grimhollow quotes
"The glow is not me. I want to be clear about that. I have standards."
"I have watched this forest since before the town. The town is a recent development. The forest has opinions about it."
"You came from Dawnhearth. Through Millriver. The road gets harder from here. You already knew that."
"Something in Farradin is wrong. I can see Farradin from here. I can see everything from here. That is not always a gift."

### Farradin quotes
"I can see the castle from here. I can always see the castle from here. The light in that window has not moved in three years."
"You made it. Most don't. The ones who did are in the graveyard near the gate. That is not meant to discourage you."
"Dawnhearth is very far away now. The fires still burn. They always burn. Finish this and you can rest."
"The king is awake. He is always awake now. He has been waiting for someone to come up that road. He will know it is you before you knock."

---

## ENEMIES

Formula: hp=8+(lv*4), dmgMin=lv*1.2, dmgMax=lv*2.2, armour=min(35%, lv*0.4%)

### Dawnhearth (BUILT — ENEMIES array in game file)
lv1 Giant Rat | lv2 Cave Frog | lv3 Rabid Crow | lv4 Vampire Bat | lv5 Goblin Scout
lv6 Rotting Zombie | lv7 Grave Skeleton | lv8 Bandit Cutpurse | lv9 Timber Wolf | lv10 Giant Spider
lv11 Kobold Pack | lv12 Ghoul | lv13 Marsh Toad | lv14 Bandit Thug | lv15 Harpy Fledgling | lv18 Forest Wraith

### Millriver (add to ENEMIES)
lv10 Marshwolf: "Lean and fast. The river has made it patient."
lv11 Road Brigand: "Not the first. Not the last. Committed to the work."
lv12 Dock Thug: "Heavy hands. Light conscience."
lv13 Bog Wraith: "Something that sank and did not stay sunk."
lv14 River Merfolk: "Old things. They did not choose this fight."
lv15 Forest Stalker: "Has been watching the road for some time. Decided you were the problem."

### Grimhollow (add to ENEMIES)
lv18 Canopy Crawler: "The trees gave it cover for years. It forgot what sunlight looked like."
lv19 Rot Hound: "The rot got in before the loyalty went out."
lv20 Hollow Revenant: "Left something in the wood a long time ago. Still looking for it."
lv20 Farradin Guard: "Serving. Or something that used to be serving."
lv21 Cursed Traveller: "Took the wrong road. The road kept them."
lv22 Undead Emissary: "The letters are still in its satchel. Nobody read them."
lv23 Dark Road Shade: "The road makes things sometimes. This is one of them."

### Farradin (add to ENEMIES)
lv26 Cursed Royal Guard: "The uniform is still pressed. The mind is not."
lv27 Palace Wraith: "Still patrolling. Still waiting for an order that will not come."
lv27 Warehouse Shade: "Something that used the dark for long enough it became part of it."
lv28 Turned Royal Messenger: "The message never arrived. The messenger never left."
lv30 The Cursed King: "He did not want this. He has been waiting for someone to end it."
  BOSS — special at 50% HP: pause combat, show: "Don't stop. This is the kindest thing anyone has done for me in years."
  On win: guaranteed cursed_crown drop. No other loot roll. No XP loot. Just the crown.

---

## CLASSES

### Citizen | lv1 | 8/8/8/8 | wooden_sword | BUILT
Perk: Unremarkable (flavour only)
Home: Dawnhearth

### Knight | lv3 | STR12/AGI8/INT6/CON10 | chipped_sword+wooden_shield+leather_vest | BUILT
Perks: OathOfSteel(+5% sword dmg) + ShieldWall(+10% dmg reduction with shield)
Training at Ember Sanctum: IronArm(+6% melee dmg/rank), SiegeStance(+3 armour/rank), Rally(heal 12% maxHP on kill/rank)
Unlock: complete any bounty at lv3+
Home: Dawnhearth

### Ranger | lv3 | STR8/AGI12/INT7/CON9 | short_bow+leather_cap+worn_boots | BUILT
Perks: LightFoot(AGI 0.5%/pt speed) + HuntersEye(+8% crit w/bow)
Training at East Gate: HawkEye(+5% bow crit/rank), BladeDance(+8% dagger dmg/rank), FleetFoot(-0.15s/rank)
Unlock: find short_bow as loot
Home: Dawnhearth

### Acolyte | lv5 | STR6/AGI8/INT12/CON10 | cloth_robe+healing_potion+blessed_amulet | BUILT
Perks: LayOnHands(heal 15% maxHP per 5 hits received) + Ward(+10% magic resistance)
Training at Ember Church: Smite(+8% magic dmg/rank), Mend(+3HP per hit taken/rank), Ward(+4% resistance/rank)
Unlock: complete holy_relic quest
Home: Dawnhearth

### Shaman | lv4 | STR7/AGI9/INT12/CON10 | spirit_staff+river_cloak+carved_bone_amulet | v0.5.1
Perks: SpiritBond(+10% elemental dmg) + RiverSense(+8% all resistance)
Training at Ferryman's Shrine: Stormcall(+8% magic dmg/rank), Stormwall(+5% resistance/rank), AncestralShield(+4% dmg reduction/rank)
Unlock: complete "Something in the Water" (Millriver signature quest)
NPC: figure standing knee-deep in river at dusk. "You fought the river's children. The river noticed. Come back when the tide is low."
Home: Millriver

### Druid | lv4 | STR9/AGI10/INT10/CON11 | gnarled_staff+bark_vest+root_amulet | v0.5.1
Perks: Thornward(+8% armour) + GroveSense(+5% crit in wilderness)
Training at Guild Hall: Entangle(enemy speed +0.2s/rank), RootSnare(enemy speed +0.3s/rank), WildShape(+7% all dmg/rank)
Unlock: complete Ferryman's Problem bounty + any one other Millriver bounty
NPC: old woman pressing palm against dead tree outside Guild Hall. "It's not dead. Just waiting. Like most things. You've got the patience for it. Come inside when you're ready."
Home: Millriver

### Shepherd | lv4 | STR10/AGI9/INT7/CON14 | shepherds_crook+wool_vest+biscuit | v0.5.1
Perks: Steadfast(CON gives +3HP/pt not +2) + Biscuit(10%/attack absorb half incoming dmg, log: "Biscuit steps in front of it.")
Training at The Mill: FlockLeader(+6% all dmg/rank), WoolArmour(+4 armour/rank), BiscuitFocused(Biscuit chance +8%/rank)
Unlock chain: Waterfront Inn drink -> rumour roll -> "Night Watch at the Mill" on noticeboard -> complete
  Mission return: "You stayed awake. Mostly. The sheep saw to that. Old Cob comes out at dawn with a nod. She's following you now. You've decided her name is Biscuit."
  Diary: "Sat with the mill wheel all night. A sheep arrived about an hour in and wouldn't leave. Every time I started to drift off she'd nudge me back awake. Stayed that way until dawn. I don't know what to make of it. She's following me now. I've decided her name is Biscuit."
NPC: very old farmer on fence post, sheep beside him. "You're looking at her like she's just a sheep. Go on then. She'll let you know."
Home: Millriver

### Warlock | lv6 | STR6/AGI8/INT14/CON10 | bone_staff+void_cloak+pact_ring | v0.5.1
Perks: DarkPact(drain 5% dmg dealt as HP per hit) + Hex(15% chance: debuff enemy -20% dmg for 3 hits)
Training at The Hollow: SoulDrain(life drain +3%/rank), CurseMark(Hex chance +8%/rank), VoidShield(-5% dmg taken/rank)
Unlock: pick up cursed_bone from "Farradin's Shadow" bounty drop (Cursed Traveller lv21, 60% drop)
NPC: figure outside The Hollow that night, does not knock. "You found one of those. Interesting. Most people drop them. You didn't." Walks to door. "Come in when you're ready. Mind the glow."
Home: Grimhollow

### Shadowblade | lv6 | STR9/AGI15/INT7/CON9 | shadow_daggers+offhand_shadow_dagger+dark_leather_vest+void_band | v0.5.1
Perks: FirstBlood(first strike +40% dmg) + ShadowStep(AGI reduces speed 0.6%/pt not 0.5%)
Dual wield: Shadowblade only — dagger in weapon AND offhand slot: +15% dmg, +0.1s speed
Training at Thornwall Shrine: Vanish(10%/rank avoid hit entirely, log: "Gone."), BladeFlurry(+7% dagger dmg/rank), PoisonEdge(3 poison dmg x rank per enemy turn, 3 turns)
Unlock: complete "The Hollow Man" bounty
NPC: sitting on shrine steps, unheard. "You moved quietly out there. Not quietly enough but quietly. Come back tomorrow at the same time." Gone before you turn.
Home: Grimhollow

### Plague Doctor | lv6 | STR7/AGI9/INT11/CON13 | bone_saw+plague_mask+tincture_belt | v0.5.1
Perks: TinctureBelt(heal 20% maxHP post-combat — not a potion, not consumed) + Miasma(enemy takes 2 passive dmg per player turn)
Training at Apothecary: ToxicBlade(+5 poison on hit/rank), Resilience(+6 CON for HP/rank), FieldExtraction(Tincture Belt +8%/rank)
Unlock: complete all four Grimhollow bounties
NPC: Apothecary doorway, mask on. "Four jobs. All the ugly ones. You didn't flinch at any of it. Come in. Don't touch anything on the left bench."
Home: Grimhollow

---

## MISSIONS

### Dawnhearth (BUILT)
Citizen tutorial: ct1-ct4 jobs, cb1-cb3 bounties
Jobs: j1-j6 | Bounties: b1-b6 | Quests: q1-q4 | Adventures: a1-a3
Holy relic: "The Broken Chapel" — Grave Skeleton lv7 — reward: blessed_amulet — unlocks Acolyte

### Millriver (v0.5.1)
Jobs:
  mr_j1 "Flour Run" — Carry mill output to the Counting House before the merchants arrive.
  mr_j2 "Catch Count" — Dock inventory before the morning traders come in.
  mr_j3 "Courier Work" — Sealed letter to the Trading Post. Don't read it.
  mr_j4 "Night Watch at the Mill" — Hidden. Unlocked only by tavern drink rumour roll. Shepherd unlock path.

Bounties:
  mr_b1 "River Wolves" — Marshwolf lv10
  mr_b2 "The Toll Man" — Road Brigand lv11
  mr_b3 "Dock Rats" — Dock Thug lv12
  mr_b4 "The Ferryman's Problem" — Bog Wraith lv13 | on complete: trigger Druid NPC encounter

Signature Quest:
  "Something in the Water" — River Merfolk lv14
  Return: "The fishermen went out this morning. Nobody asked what you found up there."
  On complete: trigger Shaman NPC encounter, unlock adventure slot

Adventure (unlocked after quest):
  "The King's Road North" — Forest Stalker lv15 — arrivesTown: grimhollow

### Grimhollow (v0.5.1)
Jobs:
  gh_j1 "Lamp Duty" — Refill twelve street lamps before dusk.
  gh_j2 "The Herbalist's List" — Specimens from the treeline. Check the list before touching anything that glows.
  gh_j3 "Grave Keeping" — The cemetery needs maintenance. It always does.
  gh_j4 "Message from Millriver" — Sealed letter to the elder. She already knows what it says.

Bounties:
  gh_b1 "The Canopy Crawler" — Canopy Crawler lv18
  gh_b2 "Rot Hounds" — Rot Hound lv19
  gh_b3 "The Hollow Man" — Hollow Revenant lv20 | on complete: trigger Shadowblade NPC encounter
  gh_b4 "Farradin's Shadow" — Cursed Traveller lv21 | on complete: 60% chance drop cursed_bone -> trigger Warlock NPC encounter

Signature Quest:
  "The Lost Emissary" — Undead Emissary lv22 + Farradin Guard x2 lv20
  Return: "You don't tell the elder what the letters said. She doesn't ask."
  Note: if all 4 bounties already done when quest completes, trigger Plague Doctor NPC encounter at Apothecary
  On complete: unlock adventure slot

Adventure (unlocked after quest):
  "Into the Dark Road" — Dark Road Shade lv23 — arrivesTown: farradin

### Farradin (v0.5.1)
Jobs:
  far_j1 "The Count" — Back-room inventory for the Royal Provisioner.
  far_j2 "Courier to the Cathedral" — Sealed parcel before the evening bell.
  far_j3 "The Guard's Errand" — Pickup from the east quarter. Don't ask what it is.
  far_j4 "Lamp Oil" — Refill the Cathedral colonnade. It takes longer than it should.

Bounties:
  far_b1 "The Market After Dark" — Cursed Royal Guard lv26
  far_b2 "The East Quarter" — Palace Wraith lv27
  far_b3 "The Courier Who Didn't Arrive" — Turned Royal Messenger lv28
  far_b4 "Old Debts" — Warehouse Shade lv27

Final Quest (available from Castle Gate on arrival — no unlock gating needed):
  "The Crown and the Curse" — The Cursed King lv30
  At 50% HP: pause log, show "Don't stop. This is the kindest thing anyone has done for me in years."
  On win: add cursed_crown to bag. Show diary. Render home screen.

---

## ITEMS

### Rarity colours
worn: grey | common: white | crafted: green | enchanted: blue | legendary: gold | mythic: deep amber (#c8862a or similar)

### Loot weights by mission type
job: 0% loot
bounty: 25% chance (worn 25, common 55, crafted 18, enchanted 2)
quest: 55% chance (worn 10, common 40, crafted 35, enchanted 14, legendary 1)
adventure: 100% chance (common 15, crafted 35, enchanted 35, legendary 12, mythic 3)
Cursed King: win grants one extra guaranteed mythic roll (plus any normal loot)

### Start and quest items (not in shop rotation)
wooden_sword, chipped_sword, short_bow, rusty_shield, wooden_shield, leather_cap, leather_vest, cloth_robe, worn_boots, rope, healing_potion, blessed_amulet
sigil_ring: ring, heirloom:true, +3 all stats — granted at bloodline start

### New class start items (add to ITEMS_DB, not in shop)
spirit_staff: weapon, staff, magical, 6-11dmg, 2.0s | "A carved length of river wood. The carvings are not decorative."
river_cloak: shoulder, +3ar, +1CON
carved_bone_amulet: amulet, +2INT, +1CON
gnarled_staff: weapon, staff, magical, 5-10dmg, 2.1s | "Old wood. The knots are load-bearing."
bark_vest: body, +5ar
root_amulet: amulet, +2CON, +1INT
shepherds_crook: weapon, sword_1h, 4-8dmg, 2.0s | "Not designed for this. Effective anyway."
wool_vest: body, +4ar, +2CON
biscuit: pack, heirloom:true, icon:sheep | "Her name is Biscuit. She has seen things. She is fine."
  special: if in any pack slot, 10%/attack to absorb half incoming dmg. Log: "Biscuit steps in front of it."
  vault retrieval text: "Someone left this. Wouldn't say who. The sheep seems to know you."
bone_staff: weapon, staff, magical, 8-14dmg, 1.9s, +1INT
void_cloak: shoulder, +4ar, +1INT
pact_ring: ring, +2INT, +1STR
shadow_daggers: weapon, dagger, 6-11dmg, 1.1s, 10%crit
offhand_shadow_dagger: offhand, dagger, 4-8dmg, 8%crit
dark_leather_vest: body, +5ar, +1AGI
void_band: ring, +4INT, +2AGI
bone_saw: weapon, sword_1h, 7-13dmg, 2.0s, special:poison(1dmg/turn x3 turns)
plague_mask: head, +4ar, +2CON, passive:miasma (enemy takes 2dmg/player turn when equipped — checked in simulateCombat)
tincture_belt: pack, special:tincture (heal 20% maxHP post-combat — not a potion, never consumed)

### Unique items
cursed_bone: key item, not equippable, not sellable
  drops from Cursed Traveller (60%). Add to bag. Triggers Warlock NPC encounter.
cursed_crown: head, mythic, +6STR, +6AGI, +6INT, +6CON, +20ar, icon:crown, heirloom:false
  "Cold. Heavier than it looks. He wanted you to have it."
  Equipping triggers ending. Show confirm dialog before equip.

### Millriver shop pool (common/crafted)
river_ground_shortsword: sword_1h 4-8 1.8s common 40gp
millriver_hunting_bow: bow 5-9 2.2s 6%crit common 45gp
ferryhand_knife: dagger 3-7 1.3s 8%crit common 35gp
current_staff: staff magical 4-9 2.0s common 40gp
riverman_axe: axe 7-13 2.2s crafted 65gp
tidebound_dagger: dagger 5-10 1.2s 10%crit crafted 70gp
millwater_staff: staff magical 7-14 1.9s crafted 75gp
longbow_of_current: bow 8-14 2.3s 8%crit crafted 70gp
oilcloth_vest: body +4ar common 35gp
river_fishers_cap: head +2ar +1AGI common 25gp
waxed_travelling_cloak: shoulder +2ar +1CON common 28gp
rivermans_boots: boots +1AGI +1STR common 22gp
scaled_river_vest: body +7ar crafted 60gp
millhaven_trading_cloak: shoulder +4ar +2INT crafted 55gp
waterproofed_gauntlets: gloves +2ar +2STR crafted 50gp
current_blessed_boots: boots +2AGI +1CON crafted 48gp
river_stone_ring: ring +2CON common 30gp
ferrymanspendant: amulet +2INT +1CON common 32gp
tide_buckler: offhand shield +5ar crafted 55gp
counting_house_lockbox: pack gold+10% crafted 60gp
whetstone_of_current: pack speed-0.1s crafted 45gp

### Grimhollow shop pool (crafted/enchanted)
thornwood_staff: staff magical 9-16 1.9s crafted 90gp
hollow_carved_dagger: dagger 7-13 1.1s 12%crit crafted 85gp
rotwood_axe: axe 10-18 2.3s crafted 88gp
gloombow: bow 10-17 2.2s 10%crit crafted 90gp
boneblade: sword_1h 12-20 1.7s +2STR enchanted 130gp
wraithstaff: staff magical 13-22 1.8s +3INT enchanted 140gp
shadowfang_dagger: dagger 9-17 1.0s 15%crit +2AGI enchanted 135gp
plague_saw: sword_1h 11-19 2.0s poison(3dmg/turn x3) enchanted 128gp
bark_plate_vest: body +9ar crafted 85gp
gloom_hood: head +3ar +2INT crafted 72gp
spore_cloak: shoulder +4ar +2CON crafted 78gp
hollow_bark_gauntlets: gloves +3ar +2STR crafted 75gp
shroudweave_vest: body +12ar +2CON enchanted 120gp
glowmoss_hood: head +5ar +3INT enchanted 110gp
wraith_stitched_cloak: shoulder +5ar +2AGI enchanted 115gp
gravedigger_boots: boots +3AGI +2CON enchanted 105gp
rot_iron_buckler: offhand shield +7ar crafted 82gp
grimhollow_talisman: amulet +4CON +2STR enchanted 112gp
cursed_satchel: pack +3INT drain(+3HP/kill) enchanted 125gp
bone_aegis: offhand shield +10ar +2CON enchanted 130gp

### Farradin shop pool (enchanted/legendary)
royal_guardsmans_blade: sword_1h 14-23 1.7s +3STR enchanted 160gp
cathedral_staff: staff magical 15-25 1.8s +4INT enchanted 165gp
kings_road_bow: bow 13-22 2.0s 14%crit +2AGI enchanted 158gp
farradin_court_dagger: dagger 11-20 0.95s 16%crit +3AGI enchanted 162gp
the_penitent_sword: sword_1h 18-30 1.6s +4STR +2CON legendary 280gp | "Carried by a knight who walked this road before you. The blade remembers."
voidcallers_staff: staff magical 20-34 1.7s +5INT +2AGI legendary 295gp | "It hums at a frequency just below hearing. The court mages pretend not to notice."
the_last_arrow: bow 17-29 1.9s 20%crit +4AGI legendary 285gp | "Someone kept this for a reason. You may never know what it was."
shadowpiercer: dagger 14-25 0.9s 22%crit +4AGI legendary 290gp | "Made for someone who needed to be somewhere quickly and then somewhere else."
palace_guard_vest: body +14ar +3STR enchanted 155gp
farradin_plate_coif: head +7ar +3CON enchanted 142gp
royal_courier_cloak: shoulder +6ar +3AGI enchanted 148gp
ironweave_gauntlets: gloves +5ar +3STR enchanted 140gp
the_wardens_vest: body +18ar +4CON +2STR legendary 320gp | "Last worn by someone who stood at a door for thirty years and then didn't."
the_hollow_crown_ceremonial: head +8ar +4INT +2CON legendary 310gp | "A ceremonial piece. The real one is upstairs. This one is just gold."
gravecloak: shoulder +8ar +3AGI +3CON legendary 315gp | "Came into the city from the Grimhollow road. Previous owner not located."
farradin_tower_shield: offhand shield +16ar +3STR legendary 325gp | "Heavy. Worth it."
signet_of_court: ring +4STR +2CON enchanted 150gp
archivists_ring: ring +5INT +2AGI enchanted 152gp
cathedral_amulet: amulet +4CON +3INT enchanted 148gp
the_kings_purse: pack gold+25% +5CON legendary 300gp | "Still has coins in it from before. Nobody counted them."
wardens_aegis: offhand shield +14ar +4CON legendary 318gp | "It has stopped things it shouldn't have been able to stop."

### Mythic items (Farradin shop ~3% weight each; also one guaranteed on Cursed King kill)
ashwalker: sword_1h 22-36 1.5s +6STR +4CON 500gp | perk: heal 8% maxHP on kill | "Forged in Dawnhearth, or so the story goes. The story is probably wrong. The sword doesn't correct people."
the_pale_bow: bow 20-34 1.8s +6AGI +4INT 520gp | perk: +20% crit flat | "Nobody remembers who made it. The arrows it fires remember where they've been."
voidreaper: dagger 16-28 0.85s 25%crit +6AGI +3STR 510gp | perk: crits add 5% dmg vulnerability (max 3 stacks) | "Light enough to forget you're carrying it. Enemies don't make that mistake."
the_worldstaff: staff magical 24-40 1.7s +7INT +4CON 530gp | perk: 15% chance double magic dmg | "Older than Farradin. Older than the kingdom. Possibly older than the problem."
crook_of_ages: sword_1h 18-30 1.9s +5STR +5CON 490gp | perk: if biscuit in any pack slot, Biscuit intervention chance doubled, log: "Biscuit has had enough." | "The same crook. Older. The sheep recognises it immediately."
the_undying_vest: body +22ar +5CON +4STR 540gp | perk: if HP reaches 0, set to 1 instead — once per combat | "There's a dent in it that shouldn't be survivable. Clearly it was."
the_watchers_hood: head +10ar +5INT +4AGI 525gp | perk: enemy crit chance -15% flat | "The previous owner saw everything coming. Didn't help them in the end. Might help you."
cloak_of_long_road: shoulder +10ar +4AGI +4CON 515gp | perk: mission duration -15% | "Has dust from Dawnhearth still in the hem. And Millriver mud. And Grimhollow dark. And something from before all of that."
the_unbroken_ring: ring +5STR +5AGI +5INT +5CON 550gp | perk: all dmg treated as whichever type (phys/magic) is higher | "No inscription. No history anyone can verify. Just a ring that fits every finger it's tried on."
aegis_of_fallen: offhand shield +20ar +5CON +3STR 545gp | perk: 50% of blocked dmg returned as HP | "Heavy. Worth it. The inscription on the inside says the same thing."
the_kings_road_pack: pack +4CON +3STR 500gp | perk: healing potion triggers at 40%HP not 30%, heals 65%maxHP not 50% | "Packed by someone who knew the road was long. They were right about that and wrong about coming back."

---

## FORMULAS AND TIMING

mission durations: job=60s, bounty=180s, quest=480s, adventure=1200s
tavern: drink=150s, sleep=450s

player HP: 10 + (lv*2) + (con*2)
  Shepherd Steadfast: CON gives +3HP/pt instead of +2

armour %: min(75%, armour_points*3%)
physical dmg bonus: floor(str*0.4) on phys weapons
magic dmg bonus: floor(int*0.4) on magic weapons
AGI speed: speed - (agi*0.5%) default
  Shadowblade ShadowStep perk: agi*0.6%
  Shadowblade dual wield (dagger weapon + dagger offhand): +15% dmg, +0.1s speed

class start levels: Citizen 1, Knight 3, Ranger 3, Acolyte 5, Shaman 4, Druid 4, Shepherd 4, Warlock 6, Shadowblade 6, Plague Doctor 6

---

## ENDING SCREEN

Triggered by equipping cursed_crown. Show confirm dialog first.
Full screen. Castle faint behind text. Text fades in line by line.

"The king is at rest."
[pause]
"[Name] of [Class]. Who came from [G.startingTown] and walked the long road to Farradin. Who crossed the river at Millriver. Who passed through the dark at Grimhollow. Who stood in the throne room at the end and did what was asked."
[pause]
"The crown is cold. The kingdom is quiet. The fires burn in Dawnhearth as they always have."
[pause]
"[Name] is written in the Chronicle. The road is still there. Someone else will walk it."
[long pause then buttons]

Buttons:
  "Begin Again" — full reset, new character
  "Rest Here" — return home screen, mark character complete, no further play

Chronicle milestone (gold):
"[Name], [Class] of [G.startingTown]. Walked the King's Road from beginning to end. Stood in Farradin Castle and brought peace to the kingdom. The crown passed to steadier hands."
