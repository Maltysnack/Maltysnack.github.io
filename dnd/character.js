/* =====================================================================
   character.js - Grosh
   ---------------------------------------------------------------------
   This is the ONLY file you need to edit for level-ups, prepared spell
   changes, new attacks, ASIs, found loot defaults, etc.
   app.js never needs to be touched for character changes.

   Derived values (Spell DC, Spell Atk, Init, save/skill bonuses, etc.)
   are computed automatically from the inputs below - change the inputs,
   the values follow.

   Manually-tracked: AC (depends on armor worn), HP max (depends on rolls
   and CON), and the spell list / features list (you choose what to prep).
   ===================================================================== */

const CHARACTER = {

  /* ---------- Identity ---------- */
  identity: {
    name: 'Grosh',
    classLine: 'Triton Paladin (Ancients) 5',
    background: 'Chef',
    speedLine: 'Speed 30 (swim 30)',
    languages: 'Common, Primordial',
    otherProficiencies: "armor, shields, simple & martial weapons, Cook's Utensils",
  },

  /* ---------- Core numbers ---------- */
  profBonus: 3,
  spellcastingAbility: 'cha',  // drives spell DC and spell attack

  combat: {
    ac: 17,
    hpMax: 42,
    hitDiceMax: 5,
    hitDiceType: 'd10',
  },

  startingGold: 58,

  /* ---------- Abilities ---------- */
  abilities: [
    { key: 'str', name: 'Strength',     score: 11 },
    { key: 'dex', name: 'Dexterity',    score: 18 },
    { key: 'con', name: 'Constitution', score: 16 },
    { key: 'int', name: 'Intelligence', score: 10 },
    { key: 'wis', name: 'Wisdom',       score: 14 },
    { key: 'cha', name: 'Charisma',     score: 16 },
  ],

  /* ---------- Saves ---------- */
  saves: [
    { ability: 'str', proficient: false },
    { ability: 'dex', proficient: false },
    { ability: 'con', proficient: false },
    { ability: 'int', proficient: false },
    { ability: 'wis', proficient: true  },
    { ability: 'cha', proficient: true  },
  ],

  /* ---------- Skills ---------- */
  skills: [
    { name: 'Acrobatics',      ability: 'dex', proficient: false },
    { name: 'Animal Handling', ability: 'wis', proficient: true  },
    { name: 'Arcana',          ability: 'int', proficient: false },
    { name: 'Athletics',       ability: 'str', proficient: true  },
    { name: 'Deception',       ability: 'cha', proficient: false },
    { name: 'History',         ability: 'int', proficient: false },
    { name: 'Insight',         ability: 'wis', proficient: false },
    { name: 'Intimidation',    ability: 'cha', proficient: false },
    { name: 'Investigation',   ability: 'int', proficient: false },
    { name: 'Medicine',        ability: 'wis', proficient: true  },
    { name: 'Nature',          ability: 'int', proficient: false },
    { name: 'Perception',      ability: 'wis', proficient: false },
    { name: 'Performance',     ability: 'cha', proficient: false },
    { name: 'Persuasion',      ability: 'cha', proficient: true  },
    { name: 'Religion',        ability: 'int', proficient: false },
    { name: 'Sleight of Hand', ability: 'dex', proficient: false },
    { name: 'Stealth',         ability: 'dex', proficient: false },
    { name: 'Survival',        ability: 'wis', proficient: true  },
  ],

  /* ---------- Attacks ---------- */
  attacks: [
    { name: 'Trident', atk: '+7', notes: '1d8+4 piercing', extra: 'extra attack (two per Attack action)' },
    { name: 'Smite',   atk: '',   notes: '2d8 radiant after a melee hit, +1d8 per slot above 1st', extra: 'declare after hit' },
  ],

  /* ---------- Reaction ---------- */
  reaction: {
    title: 'Interception',
    desc: 'ally hit within 5 ft → reduce by 1d10+3',
  },

  /* ---------- Spell slots (per level) ---------- */
  spellSlots: { 1: 4, 2: 2 },

  /* ---------- Class resources ---------- */
  resources: {
    layOnHandsMax: 25,        // 5 × paladin level
    channelDivinityMax: 1,    // per short rest
    divineSenseMax: 4,        // 1 + CHA mod
    chefTreatsMax: 3,         // = prof bonus
  },

  /* ---------- Prepared spells ---------- */
  spells: [
    { lvl: 1, lvlLabel: '1st', name: 'Bless',               slug: 'bless',                tags: ['conc'],            desc: '3 targets +1d4 to attacks & saves' },
    { lvl: 1, lvlLabel: '1st', name: 'Shield of Faith',     slug: 'shield-of-faith',      tags: ['conc', 'BA'],      desc: '+2 AC to one target' },
    { lvl: 1, lvlLabel: '1st', name: 'Ensnaring Strike',    slug: 'ensnaring-strike',     tags: ['conc', 'BA', 'oath'], desc: 'next melee hit restrains, STR save to escape' },
    { lvl: 1, lvlLabel: '1st', name: 'Speak with Animals',  slug: 'speak-with-animals',   tags: ['oath'],            desc: 'talk to beasts, 10 min' },
    { lvl: 1, lvlLabel: '1st', name: 'Purify Food & Drink', slug: 'purify-food-and-drink', tags: [],                  desc: 'cleanse 5 ft of food/water' },
    { lvl: 2, lvlLabel: '2nd', name: 'Moonbeam',            slug: 'moonbeam',             tags: ['conc', 'oath'],    desc: '5 ft cylinder, 2d10 radiant on enter/start, move 60 ft as BA' },
    { lvl: 2, lvlLabel: '2nd', name: 'Misty Step',          slug: 'misty-step',           tags: ['BA', 'oath'],      desc: 'teleport 30 ft' },
    { lvl: 2, lvlLabel: '2nd', name: 'Find Steed',          slug: 'find-steed',           tags: [],                  desc: 'summon mount (your crocodile)' },
    { lvl: 2, lvlLabel: '2nd', name: 'Prayer of Healing',   slug: 'prayer-of-healing',    tags: ['10min'],           desc: '6 targets 2d8+3 HP, 10 min cast' },
  ],

  /* ---------- Triton (1/long rest) ---------- */
  tritonSpells: [
    { key: 'fogCloud',    name: 'Fog Cloud',     slug: 'fog-cloud',     tags: ['conc'], desc: '20 ft sphere, heavily obscured' },
    { key: 'gustOfWind',  name: 'Gust of Wind',  slug: 'gust-of-wind',  tags: ['conc'], desc: '60 ft line, STR save or push 15 ft' },
    { key: 'wallOfWater', name: 'Wall of Water', slug: 'wall-of-water', tags: ['conc'], desc: '30x10 ft wall, halves fire dmg through it' },
  ],

  /* ---------- Scrolls (consumable) ---------- */
  scrolls: [
    { key: 'dimensionDoor', name: 'Dimension Door', slug: 'dimension-door', count: 2, meta: '4th DC14', desc: 'teleport self up to 500 ft' },
    { key: 'charmMonster',  name: 'Charm Monster',  slug: 'charm-monster',  count: 1, meta: '4th DC14', desc: 'one creature charmed 1 hr, WIS save' },
    { key: 'counterspell',  name: 'Counterspell',   slug: 'counterspell',   count: 1, meta: '3rd DC13', desc: 'interrupt spell ≤3rd auto, higher needs check' },
  ],

  /* ---------- Features ---------- */
  features: [
    { name: 'Interception',      tag: 'reaction',         desc: 'Ally hit within 5 ft, reduce damage by 1d10+3. Need shield/weapon.' },
    { name: 'Extra Attack',      tag: '',                 desc: 'Two attacks per Attack action.' },
    { name: 'Divine Smite',      tag: '',                 desc: 'Burn slot after melee hit: 2d8 radiant +1d8/slot above 1st, +1d8 vs fiend/undead. Crits double dice.' },
    { name: 'Lay on Hands',      tag: '25 HP pool',       desc: 'Touch to heal, or 5 HP to cure disease/poison. Useless on undead/constructs.' },
    { name: 'Divine Sense',      tag: '4/long',           desc: 'Action: detect celestials/fiends/undead within 60 ft.' },
    { name: 'Divine Health',     tag: '',                 desc: 'Immune to disease.' },
    { name: 'Channel Divinity',  tag: '1/short',          desc: "Nature's Wrath (10 ft, STR/DEX DC 14, restrain) or Turn the Faithless (30 ft, WIS DC 14, fey/fiends turned)." },
    { name: 'Chef',              tag: 'background',       desc: '3 treats/short rest, 8 temp HP each. Allies spending HD on short rest near you get +3 HP.' },
    { name: 'Triton',            tag: 'race',             desc: 'Amphibious, swim 30, cold resist, darkvision 60, talk to water beasts, Fog Cloud / Gust / Wall of Water 1/long.' },
    { name: 'Aura of Protection', tag: 'lvl 6, upcoming', desc: 'Allies in 10 ft add +3 to all saves while you are conscious.', upcoming: true },
  ],

  /* ---------- Default inventory ---------- */
  defaultInventory: [
    { name: 'Trident',           notes: '1d8+4 piercing, +7 to hit' },
    { name: 'Half Plate Armour', notes: 'AC 17, disadv on stealth' },
    { name: 'Greatsword',        notes: '2d6 slashing, loot' },
    { name: "Cook's Utensils",   notes: '' },
  ],
};

/* =====================================================================
   Derived helpers - read from CHARACTER, do not edit
   ===================================================================== */

const C = {
  abilityMod(key) {
    const score = CHARACTER.abilities.find(a => a.key === key).score;
    return Math.floor((score - 10) / 2);
  },
  spellMod() { return C.abilityMod(CHARACTER.spellcastingAbility); },
  spellDC()  { return 8 + CHARACTER.profBonus + C.spellMod(); },
  spellAtk() { return CHARACTER.profBonus + C.spellMod(); },
  initMod()  { return C.abilityMod('dex'); },
  passiveWis() {
    const skill = CHARACTER.skills.find(s => s.name === 'Perception');
    const bonus = C.abilityMod('wis') + (skill?.proficient ? CHARACTER.profBonus : 0);
    return 10 + bonus;
  },
  saveBonus(s) {
    return C.abilityMod(s.ability) + (s.proficient ? CHARACTER.profBonus : 0);
  },
  skillBonus(s) {
    return C.abilityMod(s.ability) + (s.proficient ? CHARACTER.profBonus : 0);
  },
  fmtMod(n) { return (n >= 0 ? '+' : '') + n; },
};
