/* =====================================================================
   app.js - Grosh sheet logic
   ---------------------------------------------------------------------
   Reads CHARACTER (from character.js) for all static data.
   Manages dynamic state (HP, slots, buffs, etc.) in localStorage.
   Don't edit this for character changes - edit character.js.
   ===================================================================== */

const STORAGE_KEY = CHARACTER.identity.name.toLowerCase().replace(/\s+/g, '-') + '-character-v1';
const WIKI_BASE = 'https://dnd5e.wikidot.com/spell:';

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

/* ---------- State ---------- */

function makeDefaultState() {
  return {
    hp: { current: CHARACTER.combat.hpMax, max: CHARACTER.combat.hpMax, temp: 0 },
    hitDice: CHARACTER.combat.hitDiceMax,
    deathSaves: { successes: [false, false, false], failures: [false, false, false] },
    inspiration: false,
    concentration: null,
    spellSlots: Object.fromEntries(
      Object.entries(CHARACTER.spellSlots).map(([k, n]) => [k, Array(n).fill(false)])
    ),
    layOnHands: CHARACTER.resources.layOnHandsMax,
    channelDivinity: false,
    divineSense: Array(CHARACTER.resources.divineSenseMax).fill(false),
    chefTreats: Array(CHARACTER.resources.chefTreatsMax).fill(false),
    tritonSpells: Object.fromEntries(CHARACTER.tritonSpells.map(s => [s.key, false])),
    scrolls: Object.fromEntries(CHARACTER.scrolls.map(s => [s.key, Array(s.count).fill(false)])),
    gold: CHARACTER.startingGold,
    alignment: 'unaligned',
    xp: '0',
    buffs: [],
    inventory: structuredClone(CHARACTER.defaultInventory),
    notes: '',
  };
}

function padArr(arr, len) {
  const a = Array.isArray(arr) ? arr : [];
  return Array(len).fill(false).map((_, i) => !!a[i]);
}

function loadState() {
  const def = makeDefaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return def;
    const parsed = { ...def, ...JSON.parse(raw) };
    // Normalize array sizes against current CHARACTER (so leveling/changes don't desync)
    parsed.spellSlots = parsed.spellSlots || {};
    Object.entries(CHARACTER.spellSlots).forEach(([k, n]) => {
      parsed.spellSlots[k] = padArr(parsed.spellSlots[k], n);
    });
    parsed.divineSense = padArr(parsed.divineSense, CHARACTER.resources.divineSenseMax);
    parsed.chefTreats = padArr(parsed.chefTreats, CHARACTER.resources.chefTreatsMax);
    parsed.scrolls = parsed.scrolls || {};
    CHARACTER.scrolls.forEach(s => {
      parsed.scrolls[s.key] = padArr(parsed.scrolls[s.key], s.count);
    });
    parsed.tritonSpells = parsed.tritonSpells || {};
    CHARACTER.tritonSpells.forEach(s => {
      if (typeof parsed.tritonSpells[s.key] !== 'boolean') parsed.tritonSpells[s.key] = false;
    });
    parsed.deathSaves = parsed.deathSaves || def.deathSaves;
    return parsed;
  } catch { return def; }
}

function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

let state = loadState();

/* =====================================================================
   Render
   ===================================================================== */

function render() {
  renderMeta();
  renderHero();
  renderAbilities();
  renderSaves();
  renderSkills();
  renderHP();
  renderHD();
  renderDeathSaves();
  renderInspiration();
  renderConcentration();
  renderSpellSlots();
  renderLoH();
  renderCD();
  renderDivineSense();
  renderTreats();
  renderTritonSpells();
  renderScrolls();
  renderAttacks();
  renderSpells();
  renderFeatures();
  renderBuffs();
  renderInventory();
  document.getElementById('gold').textContent = state.gold;
  document.getElementById('alignment').textContent = state.alignment;
  document.getElementById('xp').textContent = state.xp;
  document.getElementById('notes').value = state.notes;
  saveState();
}

/* ---------- Static identity / hero values ---------- */

function renderMeta() {
  set('meta-name', CHARACTER.identity.name);
  set('meta-class', CHARACTER.identity.classLine);
  set('meta-bg', CHARACTER.identity.background);
  set('meta-speed', CHARACTER.identity.speedLine);
  set('meta-langs', 'Languages: ' + CHARACTER.identity.languages);
  set('meta-prof', 'Prof: ' + CHARACTER.identity.otherProficiencies);
}

function renderHero() {
  set('hero-ac', CHARACTER.combat.ac);
  set('hero-init', C.fmtMod(C.initMod()));
  set('hero-dc', C.spellDC());
  set('hero-atk', C.fmtMod(C.spellAtk()));
  set('hero-prof', C.fmtMod(CHARACTER.profBonus));
  set('hero-pp', C.passiveWis());
  set('hd-max', CHARACTER.combat.hitDiceMax);
  set('reaction-title', CHARACTER.reaction.title);
  set('reaction-desc', CHARACTER.reaction.desc);
}

function set(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/* ---------- Abilities / Saves / Skills ---------- */

function renderAbilities() {
  const ul = document.getElementById('abilities');
  ul.innerHTML = '';
  CHARACTER.abilities.forEach(a => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="prof-dot" style="visibility:hidden"></span>
      <span class="check-mod">${C.fmtMod(C.abilityMod(a.key))}</span>
      <span class="check-name">${a.name}</span>
      <span class="check-ability">${a.score}</span>
    `;
    ul.appendChild(li);
  });
}

function renderSaves() {
  const ul = document.getElementById('saves');
  ul.innerHTML = '';
  const sorted = [...CHARACTER.saves].sort((a, b) => b.proficient - a.proficient);
  sorted.forEach(s => {
    const ab = CHARACTER.abilities.find(a => a.key === s.ability);
    const li = document.createElement('li');
    if (s.proficient) li.className = 'is-prof';
    li.innerHTML = `
      <span class="prof-dot ${s.proficient ? 'on' : ''}"></span>
      <span class="check-mod">${C.fmtMod(C.saveBonus(s))}</span>
      <span class="check-name">${ab.name}</span>
    `;
    ul.appendChild(li);
  });
}

function renderSkills() {
  const ul = document.getElementById('skills');
  ul.innerHTML = '';
  const sorted = [...CHARACTER.skills].sort((a, b) => {
    if (a.proficient !== b.proficient) return b.proficient - a.proficient;
    return a.name.localeCompare(b.name);
  });
  sorted.forEach(s => {
    const li = document.createElement('li');
    if (s.proficient) li.className = 'is-prof';
    li.innerHTML = `
      <span class="prof-dot ${s.proficient ? 'on' : ''}"></span>
      <span class="check-mod">${C.fmtMod(C.skillBonus(s))}</span>
      <span class="check-name">${s.name}</span>
      <span class="check-ability">${s.ability}</span>
    `;
    ul.appendChild(li);
  });
}

/* ---------- HP / HD / Death saves ---------- */

function renderHP() {
  set('hp-current', state.hp.current);
  set('hp-max', state.hp.max);
  set('hp-temp', state.hp.temp);
  const pct = state.hp.current / state.hp.max;
  document.getElementById('hp-fill').style.width = `${clamp(pct, 0, 1) * 100}%`;
}

function renderHD() { set('hd-current', state.hitDice); }

function renderDeathSaves() {
  ['success', 'failure'].forEach(kind => {
    const container = document.getElementById('ds-' + kind);
    container.innerHTML = '';
    const arr = kind === 'success' ? state.deathSaves.successes : state.deathSaves.failures;
    arr.forEach((on, i) => {
      const pip = document.createElement('div');
      pip.className = 'pip' + (on ? '' : ' used');
      pip.addEventListener('click', () => { arr[i] = !arr[i]; render(); });
      container.appendChild(pip);
    });
  });
}

/* ---------- Inspiration / Concentration ---------- */

function renderInspiration() {
  document.getElementById('inspiration').classList.toggle('on', state.inspiration);
}

function renderConcentration() {
  const span = document.getElementById('conc-active');
  if (state.concentration) {
    span.textContent = state.concentration;
    span.classList.remove('empty');
  } else {
    span.textContent = 'none';
    span.classList.add('empty');
  }
}

/* ---------- Spell slots / class resources ---------- */

function renderSpellSlots() {
  document.querySelectorAll('[data-slots]').forEach(container => {
    const lvl = container.dataset.slots;
    container.innerHTML = '';
    state.spellSlots[lvl].forEach((used, i) => {
      const pip = document.createElement('div');
      pip.className = 'pip' + (used ? ' used' : '');
      pip.title = `${lvl === '1' ? '1st' : '2nd'} level slot`;
      pip.addEventListener('click', () => {
        state.spellSlots[lvl][i] = !state.spellSlots[lvl][i];
        render();
      });
      container.appendChild(pip);
    });
  });
}

function renderLoH() {
  set('loh-current', state.layOnHands);
  set('loh-max', CHARACTER.resources.layOnHandsMax);
}

function renderCD() {
  const c = document.getElementById('cd-pip');
  if (!c) return;
  c.innerHTML = '';
  const pip = document.createElement('div');
  pip.className = 'pip' + (state.channelDivinity ? ' used' : '');
  pip.addEventListener('click', () => { state.channelDivinity = !state.channelDivinity; render(); });
  c.appendChild(pip);
}

function renderDivineSense() { renderPipArray('ds-pips', state.divineSense); }
function renderTreats() { renderPipArray('treats-pips', state.chefTreats); }

function renderPipArray(id, arr) {
  const c = document.getElementById(id);
  if (!c) return;
  c.innerHTML = '';
  arr.forEach((used, i) => {
    const pip = document.createElement('div');
    pip.className = 'pip' + (used ? ' used' : '');
    pip.addEventListener('click', () => { arr[i] = !arr[i]; render(); });
    c.appendChild(pip);
  });
}

/* ---------- Spell rendering ---------- */

function buildSpellRow({ lvlLabel, name, slug, tags = [], used, onClickRow, extraTag, desc }) {
  const row = document.createElement('li');
  row.className = 'spell-row' + (used ? ' used' : '');

  const lvlEl = document.createElement('span');
  lvlEl.className = 'lvl';
  lvlEl.textContent = lvlLabel || '';

  const nameEl = document.createElement('span');
  nameEl.className = 'name';
  const link = document.createElement('a');
  link.href = WIKI_BASE + slug;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = name;
  link.addEventListener('click', e => e.stopPropagation());
  nameEl.appendChild(link);
  if (desc) {
    const d = document.createElement('span');
    d.className = 'spell-desc muted';
    d.textContent = desc;
    nameEl.appendChild(d);
  }

  const tagWrap = document.createElement('span');
  tagWrap.className = 'tags';
  tags.forEach(t => {
    const tag = document.createElement('span');
    tag.className = 'tag';
    if (t === 'conc') {
      tag.classList.add('conc');
      tag.textContent = 'C';
      if (state.concentration === name) tag.classList.add('active');
    } else if (t === 'BA') {
      tag.textContent = 'BA';
    } else if (t === 'oath') {
      tag.classList.add('oath');
      tag.textContent = 'O';
      tag.title = 'Oath spell (always prepared)';
    } else {
      tag.textContent = t;
    }
    tagWrap.appendChild(tag);
  });
  if (extraTag) {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = extraTag;
    tagWrap.appendChild(tag);
  }

  row.appendChild(lvlEl);
  row.appendChild(nameEl);
  row.appendChild(tagWrap);

  if (onClickRow) row.addEventListener('click', onClickRow);
  return row;
}

function castPreparedSpell(spell) {
  let useLvl = null;
  for (let l = spell.lvl; l <= 9; l++) {
    const slots = state.spellSlots[l];
    if (slots && slots.some(u => !u)) { useLvl = l; break; }
  }
  if (useLvl === null) {
    alert(`No spell slot available for ${spell.name}.`);
    return;
  }
  const isConc = spell.tags && spell.tags.includes('conc');
  if (isConc && state.concentration && state.concentration !== spell.name) {
    if (!confirm(`Cast ${spell.name}? Drops concentration on ${state.concentration}.`)) return;
  }
  const slots = state.spellSlots[useLvl];
  slots[slots.findIndex(u => !u)] = true;
  if (isConc) state.concentration = spell.name;
  render();
}

function renderSpells() {
  const ul = document.getElementById('all-spells');
  ul.innerHTML = '';
  CHARACTER.spells.forEach(s => {
    ul.appendChild(buildSpellRow({ ...s, onClickRow: () => castPreparedSpell(s) }));
  });
}

function renderTritonSpells() {
  const ul = document.getElementById('triton-list');
  ul.innerHTML = '';
  CHARACTER.tritonSpells.forEach(s => {
    const used = state.tritonSpells[s.key];
    ul.appendChild(buildSpellRow({
      ...s,
      lvlLabel: '',
      used,
      onClickRow: () => {
        const isConc = s.tags && s.tags.includes('conc');
        if (!used && isConc && state.concentration && state.concentration !== s.name) {
          if (!confirm(`Cast ${s.name}? Drops concentration on ${state.concentration}.`)) return;
        }
        state.tritonSpells[s.key] = !used;
        if (!used && isConc) state.concentration = s.name;
        render();
      },
    }));
  });
}

function renderScrolls() {
  const ul = document.getElementById('scrolls-list');
  ul.innerHTML = '';
  CHARACTER.scrolls.forEach(s => {
    state.scrolls[s.key].forEach((used, i) => {
      ul.appendChild(buildSpellRow({
        lvlLabel: '',
        name: s.name,
        slug: s.slug,
        tags: [],
        extraTag: s.meta,
        used,
        desc: s.desc,
        onClickRow: () => { state.scrolls[s.key][i] = !state.scrolls[s.key][i]; render(); },
      }));
    });
  });
}

/* ---------- Attacks ---------- */

function renderAttacks() {
  const tbody = document.getElementById('attacks-body');
  tbody.innerHTML = '';
  CHARACTER.attacks.forEach(a => {
    const tr = document.createElement('tr');
    const extra = a.extra ? ` <em class="muted">- ${a.extra}</em>` : '';
    tr.innerHTML = `<td></td><td></td><td></td>`;
    tr.children[0].textContent = a.name;
    tr.children[1].textContent = a.atk;
    tr.children[2].innerHTML = a.notes + extra;
    tbody.appendChild(tr);
  });
}

/* ---------- Features ---------- */

function renderFeatures() {
  const ul = document.getElementById('features-list');
  ul.innerHTML = '';
  CHARACTER.features.forEach(f => {
    const li = document.createElement('li');
    if (f.upcoming) li.className = 'upcoming';
    const tag = f.tag ? ` <span class="muted">(${f.tag})</span>` : '';
    li.innerHTML = `<span class="feat-name">${f.name}${tag}</span><span class="feat-desc">${f.desc}</span>`;
    ul.appendChild(li);
  });
}

/* ---------- Buffs / Inventory ---------- */

function renderBuffs() {
  const ul = document.getElementById('buffs-list');
  ul.innerHTML = '';
  if (state.buffs.length === 0) {
    const li = document.createElement('li');
    li.style.cssText = 'color:var(--faint);font-size:11px;font-style:italic;padding:4px 0;';
    li.textContent = 'no active buffs';
    ul.appendChild(li);
    return;
  }
  state.buffs.forEach((b, i) => {
    const li = document.createElement('li');
    li.className = 'buff-item';
    li.innerHTML = `
      <div class="buff-content">
        <div class="buff-name"></div>
        <div class="buff-notes"></div>
      </div>
      <button class="remove-btn" title="remove">×</button>
    `;
    li.querySelector('.buff-name').textContent = b.name;
    li.querySelector('.buff-notes').textContent = b.notes || '';
    li.querySelector('.remove-btn').addEventListener('click', () => { state.buffs.splice(i, 1); render(); });
    ul.appendChild(li);
  });
}

function renderInventory() {
  const ul = document.getElementById('inventory-list');
  ul.innerHTML = '';
  state.inventory.forEach((item, i) => {
    const li = document.createElement('li');
    li.className = 'inv-item';
    li.innerHTML = `
      <span class="inv-name"></span>
      <span class="inv-notes"></span>
      <button class="remove-btn" title="remove">×</button>
    `;
    li.querySelector('.inv-name').textContent = item.name;
    li.querySelector('.inv-notes').textContent = item.notes || '';
    li.querySelector('.remove-btn').addEventListener('click', () => { state.inventory.splice(i, 1); render(); });
    ul.appendChild(li);
  });
}

/* =====================================================================
   Events
   ===================================================================== */

document.getElementById('inspiration').addEventListener('click', () => {
  state.inspiration = !state.inspiration;
  render();
});

document.getElementById('conc-clear').addEventListener('click', () => {
  state.concentration = null;
  render();
});

function bindEditableNumber(id, setter, opts = {}) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('blur', () => {
    const v = parseInt(el.textContent, 10);
    if (isNaN(v) || v < (opts.min ?? 0)) { render(); return; }
    setter(v);
    render();
  });
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
  });
}

function bindEditableText(id, setter) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('blur', () => { setter(el.textContent.trim()); render(); });
  el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } });
}

bindEditableNumber('hp-current', v => { state.hp.current = clamp(v, 0, state.hp.max); });
bindEditableNumber('hp-max',     v => { state.hp.max = v; state.hp.current = Math.min(state.hp.current, v); });
bindEditableNumber('hp-temp',    v => { state.hp.temp = v; });
bindEditableNumber('hd-current', v => { state.hitDice = clamp(v, 0, CHARACTER.combat.hitDiceMax); });
bindEditableNumber('loh-current',v => { state.layOnHands = clamp(v, 0, CHARACTER.resources.layOnHandsMax); });
bindEditableNumber('gold',       v => { state.gold = v; });

bindEditableText('alignment', v => { state.alignment = v; });
bindEditableText('xp',        v => { state.xp = v; });

document.getElementById('notes').addEventListener('input', e => { state.notes = e.target.value; saveState(); });

document.getElementById('buff-form').addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('buff-name').value.trim();
  const notes = document.getElementById('buff-notes').value.trim();
  if (!name) return;
  state.buffs.push({ name, notes });
  document.getElementById('buff-name').value = '';
  document.getElementById('buff-notes').value = '';
  render();
});

document.getElementById('inv-form').addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('inv-name').value.trim();
  const notes = document.getElementById('inv-notes').value.trim();
  if (!name) return;
  state.inventory.push({ name, notes });
  document.getElementById('inv-name').value = '';
  document.getElementById('inv-notes').value = '';
  render();
});

/* ---------- Rests ---------- */

document.getElementById('short-rest').addEventListener('click', () => {
  if (!confirm('Short rest? Restores Channel Divinity and Chef treats.')) return;
  state.channelDivinity = false;
  state.chefTreats = state.chefTreats.map(() => false);
  render();
});

document.getElementById('long-rest').addEventListener('click', () => {
  if (!confirm('Long rest? Restores HP, slots, Lay on Hands, Channel Divinity, Divine Sense, Triton spells, Chef treats. Drops concentration. Scrolls remain consumed.')) return;
  state.hp.current = state.hp.max;
  state.hp.temp = 0;
  state.hitDice = CHARACTER.combat.hitDiceMax;
  state.spellSlots = Object.fromEntries(
    Object.entries(CHARACTER.spellSlots).map(([k, n]) => [k, Array(n).fill(false)])
  );
  state.layOnHands = CHARACTER.resources.layOnHandsMax;
  state.channelDivinity = false;
  state.divineSense = Array(CHARACTER.resources.divineSenseMax).fill(false);
  state.tritonSpells = Object.fromEntries(CHARACTER.tritonSpells.map(s => [s.key, false]));
  state.chefTreats = Array(CHARACTER.resources.chefTreatsMax).fill(false);
  state.deathSaves = { successes: [false, false, false], failures: [false, false, false] };
  state.concentration = null;
  render();
});

/* ---------- Export / Import / Reset ---------- */

document.getElementById('export-btn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `grosh-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('import-input').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const def = makeDefaultState();
      state = { ...def, ...JSON.parse(reader.result) };
      render();
    } catch { alert('Could not parse JSON file.'); }
  };
  reader.readAsText(file);
});

document.getElementById('reset-btn').addEventListener('click', () => {
  if (!confirm('Reset to defaults? Wipes all current state.')) return;
  state = makeDefaultState();
  render();
});

render();
