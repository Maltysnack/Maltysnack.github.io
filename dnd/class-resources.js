/* =====================================================================
   class-resources.js

   Lookup tables for class + level => spell slots and class resources.
   Used by the upload parser to auto-fill data the WotC sheet doesn't
   carry directly. Best-effort coverage of standard 5E classes.

   Returns an object: { spellSlots: { '1': N, ... }, resources: [...] }
   ===================================================================== */

(function () {

  // Full caster slot table (Bard, Cleric, Druid, Sorcerer, Wizard)
  const FULL_CASTER_SLOTS = {
    1:  { '1': 2 },
    2:  { '1': 3 },
    3:  { '1': 4, '2': 2 },
    4:  { '1': 4, '2': 3 },
    5:  { '1': 4, '2': 3, '3': 2 },
    6:  { '1': 4, '2': 3, '3': 3 },
    7:  { '1': 4, '2': 3, '3': 3, '4': 1 },
    8:  { '1': 4, '2': 3, '3': 3, '4': 2 },
    9:  { '1': 4, '2': 3, '3': 3, '4': 3, '5': 1 },
    10: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2 },
    11: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1 },
    12: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1 },
    13: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1, '7': 1 },
    14: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1, '7': 1 },
    15: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1, '7': 1, '8': 1 },
    16: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1, '7': 1, '8': 1 },
    17: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1, '7': 1, '8': 1, '9': 1 },
    18: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 3, '6': 1, '7': 1, '8': 1, '9': 1 },
    19: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 3, '6': 2, '7': 1, '8': 1, '9': 1 },
    20: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 3, '6': 2, '7': 2, '8': 1, '9': 1 },
  };

  // Half-caster (Paladin, Ranger)
  const HALF_CASTER_SLOTS = {
    1: {}, // none at 1
    2: { '1': 2 },
    3: { '1': 3 },
    4: { '1': 3 },
    5: { '1': 4, '2': 2 },
    6: { '1': 4, '2': 2 },
    7: { '1': 4, '2': 3 },
    8: { '1': 4, '2': 3 },
    9: { '1': 4, '2': 3, '3': 2 },
    10: { '1': 4, '2': 3, '3': 2 },
    11: { '1': 4, '2': 3, '3': 3 },
    12: { '1': 4, '2': 3, '3': 3 },
    13: { '1': 4, '2': 3, '3': 3, '4': 1 },
    14: { '1': 4, '2': 3, '3': 3, '4': 1 },
    15: { '1': 4, '2': 3, '3': 3, '4': 2 },
    16: { '1': 4, '2': 3, '3': 3, '4': 2 },
    17: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 1 },
    18: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 1 },
    19: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2 },
    20: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2 },
  };

  // Warlock (Pact Magic, restoresOn short rest, all slots same level)
  function warlockSlots(level) {
    if (level < 1) return {};
    const count = level === 1 ? 1 : level <= 10 ? 2 : level <= 16 ? 3 : 4;
    const slotLvl = Math.min(5, Math.ceil(level / 2));
    return { [String(slotLvl)]: count };
  }

  function abilityMod(score) { return Math.floor(((score || 10) - 10) / 2); }
  function profBonus(level) { return Math.floor((level - 1) / 4) + 2; }

  const BUILDERS = {
    barbarian(level) {
      const rages = level >= 17 ? 'unlimited' : level >= 12 ? 5 : level >= 6 ? 4 : level >= 3 ? 3 : 2;
      return {
        spellSlots: {},
        resources: [
          { key: 'rage', name: 'Rage', type: 'pip', max: rages === 'unlimited' ? 99 : rages, restoresOn: 'long' },
        ],
      };
    },
    bard(level, abilities) {
      const inspirationDie = level >= 15 ? 'd12' : level >= 10 ? 'd10' : level >= 5 ? 'd8' : 'd6';
      const cha = abilityMod(abilities?.cha);
      return {
        spellSlots: FULL_CASTER_SLOTS[level] || {},
        resources: [
          { key: 'bardicInspiration', name: `Bardic ${inspirationDie}`, type: 'pip', max: Math.max(1, cha), restoresOn: level >= 5 ? 'short' : 'long' },
        ],
      };
    },
    cleric(level) {
      return {
        spellSlots: FULL_CASTER_SLOTS[level] || {},
        resources: [
          { key: 'cd', name: 'Channel D.', type: 'pip', max: level >= 18 ? 3 : level >= 6 ? 2 : level >= 2 ? 1 : 0, restoresOn: 'short' },
        ].filter(r => r.max > 0),
      };
    },
    druid(level) {
      return {
        spellSlots: FULL_CASTER_SLOTS[level] || {},
        resources: [
          { key: 'wildShape', name: 'Wild Shape', type: 'pip', max: level >= 20 ? 99 : 2, restoresOn: 'short' },
        ],
      };
    },
    fighter(level) {
      return {
        spellSlots: {},
        resources: [
          { key: 'secondWind', name: 'Second Wind', type: 'toggle', restoresOn: 'short' },
          { key: 'actionSurge', name: 'Action Surge', type: 'pip', max: level >= 17 ? 2 : 1, restoresOn: 'short' },
          ...(level >= 9 ? [{ key: 'indomitable', name: 'Indomitable', type: 'pip', max: level >= 17 ? 3 : level >= 13 ? 2 : 1, restoresOn: 'long' }] : []),
        ].filter(r => level >= 2 || r.key !== 'secondWind').filter(r => level >= 2 || r.key !== 'actionSurge'),
      };
    },
    monk(level) {
      return {
        spellSlots: {},
        resources: [
          { key: 'ki', name: 'Ki', type: 'counter', max: level, restoresOn: 'short' },
        ].filter(() => level >= 2),
      };
    },
    paladin(level, abilities) {
      const cha = abilityMod(abilities?.cha);
      const resources = [
        { key: 'loh', name: 'Lay on Hands', type: 'counter', max: level * 5, restoresOn: 'long' },
      ];
      if (level >= 3) {
        resources.push({ key: 'cd', name: 'Channel D.', type: 'pip', max: 1, restoresOn: 'short' });
      }
      resources.push({ key: 'ds', name: 'Divine Sense', type: 'pip', max: 1 + Math.max(0, cha), restoresOn: 'long' });
      return {
        spellSlots: HALF_CASTER_SLOTS[level] || {},
        resources,
      };
    },
    ranger(level) {
      return {
        spellSlots: HALF_CASTER_SLOTS[level] || {},
        resources: [],
      };
    },
    rogue(level) {
      const sneakDice = Math.ceil(level / 2);
      return {
        spellSlots: {},
        resources: [
          { key: 'sneak', name: `Sneak ${sneakDice}d6`, type: 'toggle', restoresOn: 'never' },
        ],
      };
    },
    sorcerer(level) {
      return {
        spellSlots: FULL_CASTER_SLOTS[level] || {},
        resources: [
          ...(level >= 2 ? [{ key: 'sp', name: 'Sorcery Pts', type: 'counter', max: level, restoresOn: 'long' }] : []),
        ],
      };
    },
    warlock(level) {
      return {
        spellSlots: warlockSlots(level),
        resources: [],
        spellSlotsRestoresOn: 'short',
      };
    },
    wizard(level) {
      return {
        spellSlots: FULL_CASTER_SLOTS[level] || {},
        resources: [
          { key: 'arcRec', name: 'Arcane Recovery', type: 'toggle', restoresOn: 'long' },
        ],
      };
    },
    artificer(level) {
      return {
        spellSlots: HALF_CASTER_SLOTS[Math.max(1, Math.ceil(level / 2) * 2)] || {}, // artificer is half-caster but rounds up
        resources: [
          { key: 'infusions', name: 'Infusions', type: 'counter', max: Math.min(6, Math.floor((level + 4) / 4) * 2), restoresOn: 'long' },
        ].filter(() => level >= 2),
      };
    },
  };

  function classKeyFromString(str) {
    if (!str) return null;
    const s = str.toLowerCase();
    const known = ['barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk', 'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard', 'artificer'];
    return known.find(k => s.includes(k)) || null;
  }

  window.CLASS_RESOURCES = {
    /**
     * Get derived spell slots and resources for a class+level.
     * @param {string} classStr - free text like "Triton Paladin (Ancients) 5"
     * @param {number} level
     * @param {object} abilities - optional { str: 11, cha: 16, ... } for resources that scale on ability
     * @returns {{ spellSlots: object, resources: array, spellSlotsRestoresOn?: string, classKey: string|null }}
     */
    derive(classStr, level, abilities) {
      const key = classKeyFromString(classStr);
      if (!key || !BUILDERS[key]) return { spellSlots: {}, resources: [], classKey: null };
      const out = BUILDERS[key](level, abilities || {});
      return { ...out, classKey: key };
    },
    profBonus,
    abilityMod,
    classes: ['barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk', 'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard', 'artificer'],
  };

})();
