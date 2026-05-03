/* =====================================================================
   reginald.js - Reginald
   ---------------------------------------------------------------------
   Edit this file for level-ups, prepared spell changes, etc.
   app.js never needs to be touched for character changes.
   ===================================================================== */

const CHARACTER = {

  /* ---------- Identity ---------- */
  identity: {
    name: 'Reginald',
    classLine: 'Human Cleric (Life) 5',
    background: 'Acolyte',
    speedLine: 'Speed 30',
    languages: 'Common, Celestial, Dwarvish',
    otherProficiencies: 'light & medium armor, shields, simple weapons, calligrapher\'s supplies',
  },

  /* ---------- Core numbers ---------- */
  profBonus: 3,
  spellcastingAbility: 'wis',

  combat: {
    ac: 18,
    hpMax: 38,
    hitDiceMax: 5,
    hitDiceType: 'd8',
  },

  startingGold: 42,

  /* ---------- Abilities ---------- */
  abilities: [
    { key: 'str', name: 'Strength',     score: 12 },
    { key: 'dex', name: 'Dexterity',    score: 10 },
    { key: 'con', name: 'Constitution', score: 14 },
    { key: 'int', name: 'Intelligence', score: 13 },
    { key: 'wis', name: 'Wisdom',       score: 18 },
    { key: 'cha', name: 'Charisma',     score: 11 },
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
    { name: 'Animal Handling', ability: 'wis', proficient: false },
    { name: 'Arcana',          ability: 'int', proficient: false },
    { name: 'Athletics',       ability: 'str', proficient: false },
    { name: 'Deception',       ability: 'cha', proficient: false },
    { name: 'History',         ability: 'int', proficient: true  },
    { name: 'Insight',         ability: 'wis', proficient: true  },
    { name: 'Intimidation',    ability: 'cha', proficient: false },
    { name: 'Investigation',   ability: 'int', proficient: false },
    { name: 'Medicine',        ability: 'wis', proficient: true  },
    { name: 'Nature',          ability: 'int', proficient: false },
    { name: 'Perception',      ability: 'wis', proficient: true  },
    { name: 'Performance',     ability: 'cha', proficient: false },
    { name: 'Persuasion',      ability: 'cha', proficient: false },
    { name: 'Religion',        ability: 'int', proficient: true  },
    { name: 'Sleight of Hand', ability: 'dex', proficient: false },
    { name: 'Stealth',         ability: 'dex', proficient: false },
    { name: 'Survival',        ability: 'wis', proficient: false },
  ],

  /* ---------- Attacks ---------- */
  attacks: [
    { name: 'Mace',           atk: '+4', notes: '1d6+1 bludgeoning', extra: '' },
    { name: 'Light Crossbow', atk: '+3', notes: '1d8 piercing, range 80/320', extra: 'loading' },
  ],

  /* ---------- Reaction ---------- */
  reaction: {
    title: 'Shield of Faith (cast)',
    desc: 'self/ally +2 AC, conc 10 min',
  },

  /* ---------- Spell slots (per level) ---------- */
  spellSlots: { 1: 4, 2: 3, 3: 2 },

  /* ---------- Class resources ---------- */
  resources: {
    layOnHandsMax: 25,        // Preserve Life pool (5 x cleric level)
    channelDivinityMax: 1,    // 1/short
    divineSenseMax: 3,        // Turn Undead - represented in Divine Sense slot
    chefTreatsMax: 0,         // unused for Reginald
  },

  /* ---------- Prepared spells ---------- */
  spells: [
    { lvl: 1, lvlLabel: '1st', name: 'Bless',             slug: 'bless',             tags: ['conc'],       desc: '3 targets +1d4 to attacks & saves' },
    { lvl: 1, lvlLabel: '1st', name: 'Cure Wounds',       slug: 'cure-wounds',       tags: [],             desc: 'touch, 1d8+4 HP' },
    { lvl: 1, lvlLabel: '1st', name: 'Guiding Bolt',      slug: 'guiding-bolt',      tags: [],             desc: '4d6 radiant, advantage on next attack' },
    { lvl: 1, lvlLabel: '1st', name: 'Healing Word',      slug: 'healing-word',      tags: ['BA'],         desc: '60 ft, 1d4+4 HP, bonus action' },
    { lvl: 1, lvlLabel: '1st', name: 'Sanctuary',         slug: 'sanctuary',         tags: ['BA'],         desc: 'WIS save or attacker picks new target' },
    { lvl: 2, lvlLabel: '2nd', name: 'Spiritual Weapon',  slug: 'spiritual-weapon',  tags: ['BA'],         desc: 'BA summon, 1d8+4 force, move 20 ft as BA' },
    { lvl: 2, lvlLabel: '2nd', name: 'Lesser Restoration', slug: 'lesser-restoration', tags: [],           desc: 'cure disease, blindness, paralyzed, poisoned' },
    { lvl: 2, lvlLabel: '2nd', name: 'Hold Person',       slug: 'hold-person',       tags: ['conc'],       desc: 'WIS save or paralyzed 1 min, save end of turn' },
    { lvl: 3, lvlLabel: '3rd', name: 'Spirit Guardians',  slug: 'spirit-guardians',  tags: ['conc'],       desc: '15 ft aura, 3d8 radiant, halve speed' },
    { lvl: 3, lvlLabel: '3rd', name: 'Mass Healing Word', slug: 'mass-healing-word', tags: ['BA'],         desc: '60 ft, 6 targets, 1d4+4 HP, BA' },
  ],

  /* ---------- Racial / once-per-long-rest spells ---------- */
  tritonSpells: [
    { key: 'sacredFlame', name: 'Sacred Flame',  slug: 'sacred-flame',  tags: [],       desc: 'cantrip - 1d8 radiant, no cover save bonus' },
  ],

  /* ---------- Scrolls (consumable) ---------- */
  scrolls: [
    { key: 'revivify',     name: 'Revivify',     slug: 'revivify',     count: 1, meta: '3rd DC13', desc: 'restore 1 HP if died within 1 min' },
    { key: 'bless',        name: 'Bless',        slug: 'bless',        count: 2, meta: '1st DC13', desc: 'spare slot for Bless' },
  ],

  /* ---------- Features ---------- */
  features: [
    { name: 'Disciple of Life',     tag: 'life domain',    desc: 'Healing spells of 1st+ level: target gains 2 + spell level extra HP.' },
    { name: 'Preserve Life',        tag: 'channel divinity', desc: '30 ft, distribute up to 25 HP among creatures (max half their HP each). Doesn\'t work on undead/constructs.' },
    { name: 'Turn Undead',          tag: 'channel divinity', desc: '30 ft, undead WIS save or run for 1 min.' },
    { name: 'Blessed Healer',       tag: 'lvl 6, upcoming', desc: 'When you cast a healing spell on another, you regain 2 + spell level HP.', upcoming: true },
    { name: 'Destroy Undead',       tag: 'turn undead',     desc: 'CR 1/2 or lower destroyed instead of turned.' },
    { name: 'Bonus Proficiency',    tag: 'life domain',     desc: 'Heavy armor proficiency.' },
    { name: 'Acolyte',              tag: 'background',      desc: 'Shelter of the Faithful: temple aid, free lifestyle while ministering.' },
  ],

  /* ---------- Default inventory ---------- */
  defaultInventory: [
    { name: 'Mace',              notes: '1d6 bludgeoning, +4 to hit' },
    { name: 'Chain Mail',        notes: 'AC 16, disadv on stealth' },
    { name: 'Shield',            notes: '+2 AC' },
    { name: 'Holy Symbol',       notes: 'amulet, focus' },
    { name: 'Light Crossbow',    notes: '1d8 piercing, range 80/320' },
    { name: 'Prayer Book',       notes: '' },
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
