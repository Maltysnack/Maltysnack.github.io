# Wren's polish process for D&D character submissions

Reference document. The process is uniform across submissions so two characters get treated the same way given the same inputs. Maltysnack reads this when reviewing PRs to confirm Wren followed it.

## When this applies

Two pipelines produce PRs that need polishing:

| pipeline | trigger | PR title prefix |
|---|---|---|
| **Upload** | new character via `/games/dnd/` upload form | `New character: <name>` |
| **Update** | `Update sheet` form on the live sheet | `Update <name>: <first 60 chars>` |

Both go through the same polish process. The difference is whether the character JSON exists yet (upload = new) or is being modified (update = diff against main).

## Step 1: Read the submission inputs

Three places to look:

1. **PR body**: contains the player's free-text description plus a state summary. **The description is the authoritative human intent.** Read it first.
2. **The JSON in the PR**: parsed values from the PDF (upload) or the existing JSON plus session state (update).
3. **For uploads**: the `homebrew` field will contain a `RAW PDF FIELDS` dump of every text field the structured parser didn't consume. Spell rows live here, with field names like `Spells 1014`, `Spells 1022`, etc. Higher numbers = lower spell levels in the WotC PDF (cantrips ~1014–1021, lvl 1 ~1022–1034, lvl 2 ~1035–1047, etc.). Treat as informational; verify against the player's class + RAW.

If the input contradicts RAW, **trust RAW**. The player can override anything by writing it explicitly in the description.

## Step 2: Resolve identity + level

Set the canonical values for these before anything else, because they cascade.

| field | source | rule |
|---|---|---|
| `identity.classLine` | input | reformat to `"<Race> <Class> (<Subclass>) <Level>"`. Subclass goes in parens so the browse-card parser italicises it. Examples: `"Triton Paladin (Ancients) 5"`, `"Hexblade Warlock (Hexblade) 5"`. If race is homebrew, keep the player's word. |
| `class` | derived | lowercase base class, one of the 13 standard. |
| `level` | input | integer. Trailing digit on classLine in the PDF often gets misparsed; fix here. |
| `profBonus` | RAW table | `floor((level-1)/4) + 2`. |
| `spellcastingAbility` | RAW per class | bard/paladin/sorcerer/warlock = cha; cleric/druid/ranger = wis; wizard/artificer = int. Override if input contradicts. |

## Step 3: Combat block (HP, AC, hit dice)

| field | rule |
|---|---|
| `combat.hpMax` | RAW: `8/10/12 (lvl 1 max d8/d10/d12) + (level-1) * (avg roll + CON mod)`. Avg of d6=4, d8=5, d10=6, d12=7. If player wrote different, override and note in PR comment. |
| `combat.ac` | derive from worn armor + DEX (capped by armor type) + shield. If player's AC has no math justification, override to what the rules give and call out in the PR comment. Magic items granting +X must be explicitly mentioned in description or notes. |
| `combat.hitDiceMax` | always equal to level. |
| `combat.hitDiceType` | by class: barbarian d12; fighter/paladin/ranger d10; bard/cleric/druid/monk/rogue/warlock d8; sorcerer/wizard d6; artificer d8. |

## Step 4: Abilities + saves + skills

- **abilities[]**: trust input. If a magic item explicitly bumps a score (e.g. `+1 CHA hat`, `Headband of Intellect`), bake the bump into the score and document the source in the corresponding inventory entry's `notes` field.
- **saves[]**: 6 entries, ability + proficient flag. Class fixes the two proficient saves: barbarian str+con; bard dex+cha; cleric wis+cha; druid int+wis; fighter str+con; monk str+dex; paladin wis+cha; ranger str+dex; rogue dex+int; sorcerer con+cha; warlock wis+cha; wizard int+wis; artificer con+int. Override the input.
- **skills[]**: 18 entries, ability + proficient flag. Background grants 2; class grants N from a list; race may grant 1; expertise (rogue/bard) doubles prof but engine doesn't model expertise yet. Read description for player's picks; otherwise use class-default skill pool with sensible picks.

## Step 5: Resources + spell slots

Use `class-resources.js` derive() as the baseline. **Always include the standard class resources for the level**, even if the player didn't mention them.

Examples:
- Paladin lvl 3+: Lay on Hands (counter, max=lvl*5, long), Channel Divinity (pip, 1, short), Divine Sense (pip, 1+CHA mod, long)
- Warlock 5: spell slots `{ "3": 2 }` with `spellSlotsRestoresOn: "short"`
- Fighter 2+: Second Wind (toggle, short), Action Surge (pip, 1 or 2, short), Indomitable (pip, lvl-scaled, long) at 9+
- Monk 2+: Ki (pip if max ≤ 8, counter otherwise, short)
- Bard 5+: Bardic Inspiration (pip, max=CHA mod, short)
- Sorcerer 2+: Sorcery Pts (pip if ≤ 8, counter otherwise, long)
- Battle Master Fighter 3+: Sup. Dice d8 (pip, 4-6 max, short)

Add subclass-specific resources (Hexblade's Curse 1/short, Sorcerer metamagic via SP, Battle Master superiority dice, etc.) on top.

**Pip vs counter rule**: max ≤ 8 → `type: "pip"` (clickable circle per use). max > 8 → `type: "counter"` (current/max integer). Lay on Hands is the standard counter case (25 pool); Sorcery Points / Ki / Infusions cross into counter at high levels but stay pips for most-played levels (1–10). The `dieType()` helper in class-resources.js picks automatically.

## Step 6: Attacks

3-column table: name, atk modifier, notes. Every attack the character can make goes here.

- **Weapon attacks**: atk = prof + ability mod + magic bonus. Damage = die + ability mod + magic bonus.
- **Spell attacks** like Eldritch Blast: atk = prof + spellcasting mod.
- **Cantrip damage scales** (Eldritch Blast, Fire Bolt, Sacred Flame): note the beam count or die scaling at the current level.
- **Homebrew weapons**: trust the player's mechanics, label `homebrew` in the extra column.

Keep notes terse: `1d8+4 piercing` not `1d8+4 piercing damage`. Use `extra` for caveats (extra atk, finesse, conc trigger, etc.). One line per attack.

## Step 7: Spells

Two arrays:

- **`spells[]`**: prepared / known spells castable from spell slots. One entry per spell, with `lvl`, `lvlLabel` (`Cant`, `1st`, `2nd`...), `name`, `slug` (5e.wikidot URL slug, lowercase + hyphens), `tags` (`conc`, `BA`, `RX`, `oath`, `homebrew`, etc.), `desc` (terse: just mechanics).
- **`limitedSpells[]`**: spells with their own charges (racial 1/long, scrolls). Each has `group` (use `"Racials"` or `"Scrolls"` for the standard slots), `key`, `name`, `slug`, `count`, `restoresOn` (`short` / `long` / `never`), `tags`, `desc`, optional `meta` (e.g. `"4th DC14"` for scrolls).

**Spell sources**: if the subclass adds spells to the always-known list (Paladin oath, Warlock patron expanded, Cleric domain, etc.), set `spellSource` on the character to a short note like `"includes Fiend expanded list"`. The engine renders this italic and right-aligned in the Prepared Spells header. **Don't** add a separate feature for the expanded list.

**Misspellings**: correct silently. `eldritch blase` → Eldritch Blast. `decption` → Deception. `magic missle` → Magic Missile.

**Wrong column placement**: silently move spells to their actual level. Hellish Rebuke is 1st even if the player wrote it in the 2nd-level row.

**Description sourcing**: write your own concise mechanical description from RAW. Examples:
- Misty Step → "teleport 30 ft" (BA)
- Fireball → "8d6 fire 20 ft sphere, DEX save"
- Hex → "+1d6 necrotic on hits, dis on chosen check, 1 hr conc"

If the spell isn't in standard 5E (homebrew), trust the player's description but tighten it.

## Step 8: Reaction

Set `reaction.title` + `reaction.desc` if the character has a key reaction. Keep both terse so the hero strip doesn't overflow:
- Paladin Interception: "ally hit w/in 5 ft, reduce by 1d10+3"
- Warlock w/ Hellish Rebuke prepared: "2d10 fire when hit, save half"

Don't list every possible reaction (opportunity attacks, counterspell etc.). One signature reaction.

## Step 9: Racial traits

`racialTraits[]` array on the character. Each entry: `{ name, desc }`. Renders in the Racials block above any racial spells. Examples:
- Triton: Amphibious, Swim 30, Cold resist, Darkvision 60, Talk to water beasts
- Goliath: Powerful Build, Stone's Endurance, Mountain Born
- Half-Orc: Darkvision, Menacing, Relentless Endurance, Savage Attacks
- Tiefling: Darkvision, Hellish Resistance, Infernal Legacy

Racial **spells** with charges (Triton 1/long, Tiefling Hellish Rebuke 1/long, etc.) go in `limitedSpells[]` with `group: "Racials"`. Passive racial features stay in `racialTraits`.

**Don't put racial stuff in `features[]`.** That section is for class + background features.

## Step 10: Features

What goes here:
- Class features (Pact Magic, Divine Smite, Extra Attack, Sneak Attack)
- Subclass features (Hexblade's Curse, Dark One's Blessing, Aura of Protection)
- Invocations (warlock)
- Background feature (Chef's "Specialty", Entertainer's "By Popular Demand", etc.)
- Upcoming features (set `upcoming: true` for a faded display)

What does NOT go here:
- Racial passives (use `racialTraits`)
- Magic items (use `defaultInventory`, with bonus baked into ability/AC + noted in the `notes` field)
- Subclass spell list (use `spellSource` string)
- Spell-cast effects (use `spells[]` with proper tags)

Description style: 1 short fragment, telegraph language. `"+CHA mod dmg per EB beam"` not `"You add your Charisma modifier to the damage of each Eldritch Blast beam."`.

## Step 11: Inventory

`defaultInventory[]` with `name` + `notes`. Magic items live here with their effect summarised in notes. Examples:
- `{ name: "Hat of CHA +1", notes: "homebrew, +1 CHA while worn" }`
- `{ name: "+1 Longbow", notes: "1d8+1 piercing, 150/600" }`
- `{ name: "Cloak of Protection", notes: "+1 AC and saves" }`

If the item has stats that affect the character (CHA bump, AC bump, save bonus), bake the effect into the relevant field (abilities, combat.ac, etc.) and reference the source in the item's notes.

If the item has its own attack profile (a weapon), also add an entry to `attacks[]`.

## Step 12: Homebrew rules

The `homebrew` string field is reserved for **truly homebrew gameplay rules** that don't fit any structured field. Most submissions don't need it. Examples:
- "All resting requires twice as long in this campaign."
- "Crits explode (reroll max dice)."

Magic items, custom spells, custom features all go in their proper structured field with a `homebrew` tag, not here.

## Step 13: Cascading recalcs (the hardest part)

Whenever an ability score changes (level-up ASI, magic item bump, etc.), recompute everything that derives from it:

| changed | recompute |
|---|---|
| any ability score | mod, save bonus (if proficient), skill bonus (for skills using that ability) |
| spellcasting ability | spell DC = `8 + prof + mod`, spell atk = `prof + mod`, all spell-attack atk values in `attacks[]`, all "+CHA mod" / "+WIS mod" mentions in feature descriptions |
| level | profBonus, hit dice max, spell slots (re-derive), class resources (re-derive max), HP max (add new hit-die avg + CON), passive perception |
| CON | HP max (per-level CON contribution), CON save |
| DEX | initiative, AC if light/medium armor, ranged attack bonuses |
| STR | weapon attacks using STR, athletics |
| WIS | passive perception, perception save, wisdom save |

Always recompute and update **all** affected fields. Half-baked updates (e.g. CHA changed but spell DC stayed at old value) are the most common bug.

## Step 14: Final passes

Before pushing the polish:

1. **Remove `_pendingUpdate`** (update PRs). Transient field, don't keep it in the merged JSON.
2. **Remove the `RAW PDF FIELDS` dump** from `homebrew` (upload PRs). Replace with `""` if no actual homebrew rules remain.
3. **Verify hero strip doesn't overflow**: the longest reaction description should fit on the line. If it'd wrap, shorten it.
4. **Verify attack rows are one-line each**: name + atk + notes should fit on a single row at default width.
5. **Verify spell descriptions are telegraph-style**: no "you can" / "the spell allows" / etc.
6. **Verify subclass spell-list note** is in `spellSource`, not in features.
7. **Verify magic items are in inventory + their effects baked into stats**, not in features.
8. **Comment on the PR** with a summary of what changed and why, so maltysnack can review without reading the diff.

## Step 15: Push and merge

For uploads (Wren creates polish on the upload PR's branch):
- `git checkout <pr-branch>`
- Edit the JSON
- Commit with message `polish(dnd): wren rewrites <name>` (or `polish(dnd): integrate <name> session update PR` for updates)
- Push
- Comment on the PR

Maltysnack reviews, clicks Merge. The build action regenerates `index.json` and the per-character HTML shim, pushes back to main with `[skip ci]`. Live within ~60s of merge.

## Edge cases

- **Player picked an unbalanced build** (CHA 9 Warlock with Agonizing Blast): trust the input, note in the relevant feature description that it's currently providing little value.
- **Player chose homebrew race**: keep the race string, write `racialTraits` based on closest standard race + note "homebrew" in one trait. Speed defaults to 30, languages default to "Common, [race name]".
- **Race specified but subrace missing** (e.g. "Gnome" with no Forest/Rock pick): make a sensible default pick based on the build (Forest Gnome for stealth/illusion sorts of builds, Rock Gnome for tinkers, Hill Dwarf for mostly-CON builds, etc.). Fill in the subrace's RAW racial traits. Flag the choice in the PR comment so the player can confirm or swap. Mark anything dependent on the choice (extra cantrip from Forest Gnome, etc.) with a `RAW default` tag if the player didn't write it explicitly.
- **Standard vs Variant Human**: if the upload says just "Human" with no further info, default to **Standard Human** (+1 to all ability scores, +1 language). Variant Human (+1 to two stats, +1 skill, +1 feat) requires the player to specify which feat and which stats; flag in the PR comment if there's any signal of feats. Cascading recalcs when applying Standard Human to existing scores: every ability mod that crosses an even-number threshold needs follow-on updates (saves, skills, attacks, AC if DEX changes, HP if CON changes, spell DC + atk if the casting stat changes).
- **Conflicting inputs** (description says level 6, JSON says level 5): prefer the description since it represents the player's intent at this submission. Recalculate everything from level 6.
- **Vague description** ("got better at fighting"): ask for clarification in a PR comment instead of guessing wildly. Don't merge until clarified.
- **Sub-class not specified** (player gave class but no subclass): leave a `Patron` / `Oath` / etc. feature entry marked `upcoming: true` describing the choice, set spellcasting fields based on base class only.
- **Multi-classing**: not yet supported by the engine. Treat as the primary class only and note the multiclass in homebrew or features.
