/* =====================================================================
   edit.js - create or edit a character

   ?id=<id> edits that character; no id creates a new one. Writes the
   same character schema sheet.js renders, and keeps any fields the form
   does not show. Slots, resources, saves, hit die and spellcasting
   ability fill from class + level (class-resources.js): automatically
   for a new character, on request when editing, so homebrew resources
   are never overwritten by surprise.
   ===================================================================== */

const ABILITIES = [
  ['str', 'Strength'], ['dex', 'Dexterity'], ['con', 'Constitution'],
  ['int', 'Intelligence'], ['wis', 'Wisdom'], ['cha', 'Charisma'],
];
const SKILLS = [
  ['Acrobatics', 'dex'], ['Animal Handling', 'wis'], ['Arcana', 'int'], ['Athletics', 'str'],
  ['Deception', 'cha'], ['History', 'int'], ['Insight', 'wis'], ['Intimidation', 'cha'],
  ['Investigation', 'int'], ['Medicine', 'wis'], ['Nature', 'int'], ['Perception', 'wis'],
  ['Performance', 'cha'], ['Persuasion', 'cha'], ['Religion', 'int'], ['Sleight of Hand', 'dex'],
  ['Stealth', 'dex'], ['Survival', 'wis'],
];
// hit die, saving throws, spellcasting ability
const CLASSES = {
  artificer: [8, ['con', 'int'], 'int'], barbarian: [12, ['str', 'con'], ''],
  bard: [8, ['dex', 'cha'], 'cha'], cleric: [8, ['wis', 'cha'], 'wis'],
  druid: [8, ['int', 'wis'], 'wis'], fighter: [10, ['str', 'con'], ''],
  monk: [8, ['str', 'dex'], ''], paladin: [10, ['wis', 'cha'], 'cha'],
  ranger: [10, ['str', 'dex'], 'wis'], rogue: [8, ['dex', 'int'], ''],
  sorcerer: [6, ['con', 'cha'], 'cha'], warlock: [8, ['wis', 'cha'], 'cha'],
  wizard: [6, ['int', 'wis'], 'int'],
};
const RESTS = ['short', 'long', 'never'];

const id = new URLSearchParams(location.search).get('id');
const record = id ? DND.get(id) : null;
const existing = record ? record.character : null;

const $ = sel => document.querySelector(sel);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const ordinal = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');

/* ---------- Repeating rows ---------- */

/* Each row keeps the object it was built from, so fields the form does
   not show (feature groups, "upcoming" flags) survive an edit. */
function rowEditor(name, fields, items) {
  const box = document.querySelector(`[data-rows="${name}"]`);
  const body = box.querySelector('.rows');
  function add(item = {}) {
    const row = document.createElement('div');
    row.className = 'row';
    row._orig = item;
    fields.forEach(f => {
      let el;
      if (f.opts) {
        el = document.createElement('select');
        f.opts.forEach(o => el.add(new Option(o, o)));
      } else {
        el = document.createElement('input');
        el.type = f.num ? 'number' : 'text';
        if (f.num) el.min = 0;
      }
      el.dataset.k = f.k;
      el.placeholder = f.label;
      el.setAttribute('aria-label', f.label);
      el.style.flex = f.w || '1';
      const v = f.get ? f.get(item) : item[f.k];
      if (v != null && v !== '') el.value = v;
      row.appendChild(el);
    });
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'ghost';
    del.textContent = '×';
    del.setAttribute('aria-label', 'Remove');
    del.addEventListener('click', () => row.remove());
    row.appendChild(del);
    body.appendChild(row);
  }
  box.querySelector('.add-row').addEventListener('click', () => add());
  (items || []).forEach(add);
  return {
    set(list) { body.innerHTML = ''; list.forEach(add); },
    read() {
      return [...body.children].map(row => {
        const vals = {};
        row.querySelectorAll('[data-k]').forEach(el => { vals[el.dataset.k] = el.value.trim(); });
        return { orig: row._orig, vals };
      }).filter(r => r.vals.name);
    },
  };
}

/* Stable keys: an existing item keeps its key so its used/unused state
   carries over; new ones get a slug, de-duplicated. */
function keyed(list) {
  const seen = new Set();
  return list.map(item => {
    let key = item.key || DND.slugify(item.name) || 'item';
    while (seen.has(key)) key += '-';
    seen.add(key);
    return { ...item, key };
  });
}

/* ---------- Build the form ---------- */

function buildChecks() {
  $('#abilities').innerHTML = ABILITIES.map(([k, n]) => `
    <label class="ab"><span>${n}</span><input type="number" id="ab-${k}" min="1" max="30" value="10"></label>`).join('');
  $('#cast-ability').innerHTML = '<option value="">none</option>' +
    ABILITIES.map(([k, n]) => `<option value="${k}">${n}</option>`).join('');
  $('#saves').innerHTML = ABILITIES.map(([k, n]) => `
    <label class="check"><input type="checkbox" id="save-${k}"> ${n}</label>`).join('');
  $('#skills').innerHTML = SKILLS.map(([n, a]) => `
    <label class="check"><input type="checkbox" data-skill="${n}"> ${n} <span class="muted">${a}</span></label>`).join('');
  $('#slots').innerHTML = Array.from({ length: 9 }, (_, i) => `
    <label class="slot"><span>${ordinal(i + 1)}</span><input type="number" id="slot-${i + 1}" min="0" max="9" placeholder="0"></label>`).join('');
  $('#class').innerHTML = Object.keys(CLASSES).map(c => `<option value="${c}">${cap(c)}</option>`).join('');
  $('#level').innerHTML = Array.from({ length: 20 }, (_, i) => `<option>${i + 1}</option>`).join('');
}

const lists = {};

function buildLists(c) {
  lists.attacks = rowEditor('attacks', [
    { k: 'name', label: 'Name', w: '2' },
    { k: 'atk', label: 'To hit', w: '0 0 70px' },
    { k: 'notes', label: 'Damage, notes', w: '3' },
  ], c.attacks);
  lists.spells = rowEditor('spells', [
    { k: 'lvl', label: 'Level', opts: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'], w: '0 0 64px' },
    { k: 'name', label: 'Spell', w: '2' },
    { k: 'tags', label: 'conc, BA', w: '0 0 100px', get: s => (s.tags || []).join(', ') },
    { k: 'desc', label: 'Short note', w: '3' },
  ], c.spells);
  lists.limited = rowEditor('limited', [
    { k: 'group', label: 'Racials, Scrolls, Items', w: '1' },
    { k: 'name', label: 'Spell', w: '2' },
    { k: 'count', label: 'Uses', num: true, w: '0 0 64px' },
    { k: 'restoresOn', label: 'Restores', opts: RESTS, w: '0 0 84px' },
    { k: 'desc', label: 'Short note', w: '2' },
  ], c.limitedSpells);
  lists.resources = rowEditor('resources', [
    { k: 'name', label: 'Resource', w: '2' },
    { k: 'max', label: 'Max', num: true, w: '0 0 64px', get: r => r.max ?? 1 },
    { k: 'restoresOn', label: 'Restores', opts: RESTS, w: '0 0 84px' },
  ], c.resources);
  lists.features = rowEditor('features', [
    { k: 'name', label: 'Feature', w: '2' },
    { k: 'tag', label: '1/short, reaction', w: '1' },
    { k: 'desc', label: 'What it does', w: '4' },
  ], c.features);
  lists.traits = rowEditor('traits', [
    { k: 'name', label: 'Trait', w: '2' },
    { k: 'desc', label: 'What it does', w: '4' },
  ], c.racialTraits);
  lists.inventory = rowEditor('inventory', [
    { k: 'name', label: 'Item', w: '2' },
    { k: 'notes', label: 'Notes', w: '3' },
  ], c.defaultInventory);
}

/* Old characters only have a classLine like "Triton Paladin (Ancients) 5". */
function splitClassLine(c) {
  const m = (c.identity.classLine || '').match(new RegExp(`^(.*?)\\s*\\b${c.class}\\b\\s*(?:\\((.*?)\\))?`, 'i'));
  return { race: m ? m[1] : '', subclass: m && m[2] ? m[2] : '' };
}

function fill(c) {
  const idn = c.identity;
  const split = splitClassLine(c);
  $('#name').value = idn.name || '';
  $('#race').value = idn.race ?? split.race;
  $('#class').value = c.class || 'fighter';
  $('#subclass').value = idn.subclass ?? split.subclass;
  $('#level').value = c.level || 1;
  $('#background').value = idn.background || '';
  $('#speed').value = idn.speedLine || '';
  $('#languages').value = idn.languages || '';
  $('#profs').value = idn.otherProficiencies || '';
  c.abilities.forEach(a => { $(`#ab-${a.key}`).value = a.score; });
  $('#cast-ability').value = c.spellcastingAbility || '';
  c.saves.forEach(s => { $(`#save-${s.ability}`).checked = !!s.proficient; });
  c.skills.forEach(s => {
    const el = document.querySelector(`[data-skill="${s.name}"]`);
    if (el) el.checked = !!s.proficient;
  });
  $('#ac').value = c.combat.ac ?? '';
  $('#hp').value = c.combat.hpMax ?? '';
  $('#hit-die').value = c.combat.hitDiceType || 'd8';
  $('#reaction-title').value = c.reaction?.title || '';
  $('#reaction-desc').value = c.reaction?.desc || '';
  setSlots(c.spellSlots || {});
  $('#pact').checked = c.spellSlotsRestoresOn === 'short';
}

function setSlots(slots) {
  for (let i = 1; i <= 9; i++) $(`#slot-${i}`).value = slots[i] || '';
}

function scores() {
  return Object.fromEntries(ABILITIES.map(([k]) => [k, +$(`#ab-${k}`).value || 10]));
}

/* Class + level defaults. `full` also sets saves, hit die and casting
   ability, which only a new character should get without asking. */
function fillFromClass(full) {
  const cls = $('#class').value;
  const level = +$('#level').value;
  const d = CLASS_RESOURCES.derive(cls, level, scores());
  setSlots(d.spellSlots);
  $('#pact').checked = d.spellSlotsRestoresOn === 'short';
  lists.resources.set(d.resources.map(r => ({ ...r, max: r.max ?? 1 })));
  if (!full) return;
  const [die, saves, cast] = CLASSES[cls];
  $('#hit-die').value = 'd' + die;
  ABILITIES.forEach(([k]) => { $(`#save-${k}`).checked = saves.includes(k); });
  $('#cast-ability').value = cast;
  updateHpHint();
}

/* Fixed-die HP: max die + CON at 1st, then half die + 1 + CON per level. */
function suggestedHp() {
  const die = parseInt($('#hit-die').value.slice(1), 10);
  const con = CLASS_RESOURCES.abilityMod(scores().con);
  const level = +$('#level').value;
  return Math.max(1, die + con + (level - 1) * (die / 2 + 1 + con));
}

function updateHpHint() { $('#hp').placeholder = suggestedHp(); }

/* ---------- Save ---------- */

function collect() {
  const name = $('#name').value.trim();
  const cls = $('#class').value;
  const level = +$('#level').value;
  const race = $('#race').value.trim();
  const subclass = $('#subclass').value.trim();
  const sc = scores();
  const hpMax = +$('#hp').value || suggestedHp();
  const slots = {};
  for (let i = 1; i <= 9; i++) {
    const n = +$(`#slot-${i}`).value;
    if (n > 0) slots[i] = n;
  }
  const base = existing || {};
  return {
    ...base,
    schemaVersion: 1,
    id: base.id || DND.newId(name),
    identity: {
      ...(base.identity || {}),
      name, race, subclass,
      classLine: [race, cap(cls) + (subclass ? ` (${subclass})` : ''), level].filter(Boolean).join(' '),
      background: $('#background').value.trim(),
      speedLine: $('#speed').value.trim(),
      languages: $('#languages').value.trim(),
      otherProficiencies: $('#profs').value.trim(),
    },
    class: cls,
    level,
    profBonus: CLASS_RESOURCES.profBonus(level),
    spellcastingAbility: $('#cast-ability').value || null,
    combat: {
      ...(base.combat || {}),
      ac: +$('#ac').value || 10,
      hpMax,
      hitDiceMax: level,
      hitDiceType: $('#hit-die').value,
    },
    abilities: ABILITIES.map(([key, n]) => ({ key, name: n, score: sc[key] })),
    saves: ABILITIES.map(([ability]) => ({ ability, proficient: $(`#save-${ability}`).checked })),
    skills: SKILLS.map(([n, ability]) => ({
      name: n, ability, proficient: document.querySelector(`[data-skill="${n}"]`).checked,
    })),
    reaction: $('#reaction-title').value.trim()
      ? { ...(base.reaction || {}), title: $('#reaction-title').value.trim(), desc: $('#reaction-desc').value.trim() }
      : null,
    spellSlots: slots,
    spellSlotsRestoresOn: $('#pact').checked ? 'short' : null,
    resources: keyed(lists.resources.read().map(({ orig, vals }) => {
      const max = Math.max(1, +vals.max || 1);
      return { ...orig, name: vals.name, max, type: max <= 8 ? 'pip' : 'counter', restoresOn: vals.restoresOn };
    })),
    attacks: lists.attacks.read().map(({ orig, vals }) => ({ ...orig, ...vals })),
    spells: lists.spells.read().map(({ orig, vals }) => {
      const lvl = +vals.lvl;
      return {
        ...orig,
        lvl, lvlLabel: lvl ? ordinal(lvl) : 'C',
        name: vals.name, slug: DND.slugify(vals.name),
        tags: vals.tags.split(',').map(t => t.trim()).filter(Boolean),
        desc: vals.desc,
      };
    }).sort((a, b) => a.lvl - b.lvl),
    limitedSpells: keyed(lists.limited.read().map(({ orig, vals }) => ({
      ...orig,
      group: vals.group || 'Other',
      name: vals.name, slug: DND.slugify(vals.name),
      count: Math.max(1, +vals.count || 1),
      restoresOn: vals.restoresOn,
      desc: vals.desc,
    }))),
    features: lists.features.read().map(({ orig, vals }) => ({ ...orig, ...vals })),
    racialTraits: lists.traits.read().map(({ orig, vals }) => ({ ...orig, ...vals })),
    defaultInventory: lists.inventory.read().map(({ orig, vals }) => ({ ...orig, ...vals })),
  };
}

function save(e) {
  e.preventDefault();
  if (!$('#name').value.trim()) { $('#name').focus(); return; }
  const character = collect();
  const state = record?.state || null;
  if (state && state.hp) {
    // A changed max HP should move the sheet with it, without healing.
    state.hp.max = character.combat.hpMax;
    state.hp.current = Math.min(state.hp.current, state.hp.max);
    state.hitDice = Math.min(state.hitDice, character.combat.hitDiceMax);
  }
  try {
    DND.put(character.id, { character, state });
  } catch (err) {
    alert('Could not save in this browser: ' + err.message);
    return;
  }
  location.href = `/games/dnd/sheet.html?id=${encodeURIComponent(character.id)}`;
}

/* ---------- Init ---------- */

buildChecks();
const blank = {
  identity: {}, abilities: [], saves: [], skills: [], combat: {},
};
buildLists(existing || blank);
if (existing) {
  fill(existing);
  $('#title').textContent = `Edit ${existing.identity.name}`;
  $('#cancel').href = `/games/dnd/sheet.html?id=${encodeURIComponent(id)}`;
  $('#inventory-box').hidden = true; // live inventory is edited on the sheet
  $('#delete').hidden = false;
  $('#delete').addEventListener('click', () => {
    if (!confirm(`Delete ${existing.identity.name} from this browser? Export a save file first if you want to keep them.`)) return;
    DND.remove(id);
    location.href = '/games/dnd/';
  });
} else {
  if (id) $('#title').textContent = 'Character not found, creating a new one';
  $('#class').value = 'fighter';
  fillFromClass(true);
  $('#class').addEventListener('change', () => fillFromClass(true));
  $('#level').addEventListener('change', () => fillFromClass(false));
}
$('#refill').addEventListener('click', () => fillFromClass(false));
['#hit-die', '#level', '#ab-con'].forEach(s => $(s).addEventListener('change', updateHpHint));
updateHpHint();
$('#form').addEventListener('submit', save);
