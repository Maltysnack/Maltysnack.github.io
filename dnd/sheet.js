/* =====================================================================
   sheet.js - generic D&D 5E character sheet engine

   Reads window.CHARACTER_ID, fetches /dnd/characters/<id>.json, builds
   the entire DOM, manages localStorage state.

   To add a new character: drop a JSON in /dnd/characters/, run the
   build script, the engine handles the rest.
   ===================================================================== */

const SLUG = window.CHARACTER_ID;
const WIKI_BASE = 'https://dnd5e.wikidot.com/spell:';

let CHARACTER = null;
let state = null;
const STORAGE_KEY = () => `sheet-${SLUG}-v1`;

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

/* =====================================================================
   Derived helpers
   ===================================================================== */
const C = {
  abilityMod(key) {
    const a = CHARACTER.abilities.find(x => x.key === key);
    return Math.floor((a.score - 10) / 2);
  },
  spellMod()  { return C.abilityMod(CHARACTER.spellcastingAbility); },
  spellDC()   { return 8 + CHARACTER.profBonus + C.spellMod(); },
  spellAtk()  { return CHARACTER.profBonus + C.spellMod(); },
  initMod()   { return C.abilityMod('dex'); },
  passiveWis() {
    const skill = CHARACTER.skills.find(s => s.name === 'Perception');
    const bonus = C.abilityMod('wis') + (skill?.proficient ? CHARACTER.profBonus : 0);
    return 10 + bonus;
  },
  saveBonus(s)  { return C.abilityMod(s.ability) + (s.proficient ? CHARACTER.profBonus : 0); },
  skillBonus(s) { return C.abilityMod(s.ability) + (s.proficient ? CHARACTER.profBonus : 0); },
  fmtMod(n)     { return (n >= 0 ? '+' : '') + n; },
};

/* =====================================================================
   State
   ===================================================================== */

function makeDefaultState() {
  const slots = {};
  Object.entries(CHARACTER.spellSlots || {}).forEach(([k, n]) => {
    slots[k] = Array(n).fill(false);
  });

  const resources = {};
  (CHARACTER.resources || []).forEach(r => {
    if (r.type === 'pip') resources[r.key] = Array(r.max).fill(false);
    else if (r.type === 'counter') resources[r.key] = r.max;
    else if (r.type === 'toggle') resources[r.key] = false;
  });

  const limitedSpells = {};
  (CHARACTER.limitedSpells || []).forEach(s => {
    limitedSpells[s.key] = Array(s.count || 1).fill(false);
  });

  return {
    hp: { current: CHARACTER.combat.hpMax, max: CHARACTER.combat.hpMax, temp: 0 },
    hitDice: CHARACTER.combat.hitDiceMax,
    deathSaves: { successes: [false, false, false], failures: [false, false, false] },
    inspiration: false,
    concentration: null,
    spellSlots: slots,
    resources,
    limitedSpells,
    gold: CHARACTER.startingGold ?? 0,
    alignment: 'unaligned',
    xp: '0',
    buffs: [],
    inventory: structuredClone(CHARACTER.defaultInventory || []),
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
    const raw = localStorage.getItem(STORAGE_KEY());
    if (!raw) return def;
    const parsed = { ...def, ...JSON.parse(raw) };

    parsed.spellSlots = parsed.spellSlots || {};
    Object.entries(CHARACTER.spellSlots || {}).forEach(([k, n]) => {
      parsed.spellSlots[k] = padArr(parsed.spellSlots[k], n);
    });

    parsed.resources = parsed.resources || {};
    (CHARACTER.resources || []).forEach(r => {
      if (r.type === 'pip') {
        parsed.resources[r.key] = padArr(parsed.resources[r.key], r.max);
      } else if (r.type === 'counter') {
        const v = parsed.resources[r.key];
        parsed.resources[r.key] = (typeof v === 'number') ? clamp(v, 0, r.max) : r.max;
      } else if (r.type === 'toggle') {
        parsed.resources[r.key] = !!parsed.resources[r.key];
      }
    });

    parsed.limitedSpells = parsed.limitedSpells || {};
    (CHARACTER.limitedSpells || []).forEach(s => {
      parsed.limitedSpells[s.key] = padArr(parsed.limitedSpells[s.key], s.count || 1);
    });

    parsed.deathSaves = parsed.deathSaves || def.deathSaves;
    return parsed;
  } catch {
    return def;
  }
}

function saveState() { localStorage.setItem(STORAGE_KEY(), JSON.stringify(state)); }

/* =====================================================================
   Layout (built once on init)
   ===================================================================== */

function buildLayout() {
  document.body.innerHTML = `
    <div class="meta-strip">
      <span><strong id="meta-name"></strong></span>
      <span id="meta-class"></span>
      <span id="meta-bg"></span>
      <span>Alignment: <span class="editable" id="alignment" contenteditable="true"></span></span>
      <span>XP: <span class="editable" id="xp" contenteditable="true"></span></span>
      <span>GP: <span class="editable" id="gold" contenteditable="true"></span></span>
      <span id="meta-speed"></span>
      <span id="meta-langs"></span>
      <span id="meta-prof"></span>
    </div>

    <section class="hero">
      <div class="h-item h-hp">
        <span class="h-label">HP</span>
        <span class="h-big editable" id="hp-current" contenteditable="true"></span>
        <span class="muted">/ <span class="editable" id="hp-max" contenteditable="true"></span></span>
        <span class="muted h-sub">temp <span class="editable" id="hp-temp" contenteditable="true"></span></span>
        <div class="h-bar"><div id="hp-fill" class="hp-fill"></div></div>
      </div>
      <div class="h-div"></div>
      <div class="h-item">
        <span class="h-label">AC</span>
        <span class="h-big" id="hero-ac"></span>
      </div>
      <div class="h-div"></div>
      <div class="h-item h-stats">
        <span><strong id="hero-init"></strong> <span class="muted">init</span></span>
        <span><strong id="hero-dc"></strong> <span class="muted">DC</span></span>
        <span><strong id="hero-atk"></strong> <span class="muted">atk</span></span>
        <span><strong id="hero-prof"></strong> <span class="muted">prof</span></span>
        <span><strong id="hero-pp"></strong> <span class="muted">PP</span></span>
        <span><strong><span class="editable" id="hd-current" contenteditable="true"></span>/<span id="hd-max"></span></strong> <span class="muted">HD</span></span>
      </div>
      <div class="h-div"></div>
      <div class="h-item h-conc">
        <span class="h-label">Conc</span>
        <span id="conc-active" class="conc-name">none</span>
        <button id="conc-clear" class="ghost">drop</button>
      </div>
      <div class="h-div"></div>
      <div class="h-item h-reaction">
        <span class="h-label">Reaction</span>
        <strong id="reaction-title"></strong>
        <span class="muted" id="reaction-desc"></span>
      </div>
      <div class="h-div"></div>
      <div class="h-item">
        <button class="pip-toggle" id="inspiration"></button>
        <span class="muted">insp</span>
      </div>
      <div class="h-div"></div>
      <div class="h-item">
        <span class="h-label">Death</span>
        <div class="pips" id="ds-success"></div>
        <span class="muted">/</span>
        <div class="pips" id="ds-failure"></div>
      </div>
    </section>

    <section class="slots-bar" id="slots-bar"></section>

    <main class="three-col">

      <section class="stats-col">
        <div class="block">
          <h2>Abilities</h2>
          <ul class="check-list big" id="abilities"></ul>
        </div>
        <div class="block">
          <h2>Saves</h2>
          <ul class="check-list big" id="saves"></ul>
        </div>
        <div class="block fill">
          <h2>Skills</h2>
          <ul class="check-list big" id="skills"></ul>
        </div>
      </section>

      <section class="active-col">
        <div class="block">
          <h2>Attacks</h2>
          <table class="attacks">
            <tbody id="attacks-body"></tbody>
          </table>
        </div>

        <div class="block">
          <h2>Prepared Spells <span class="hint">click to cast</span></h2>
          <ul class="spell-list" id="all-spells"></ul>
        </div>

        <div class="block fill">
          <h2>Features &amp; Traits</h2>
          <ul class="feat-list" id="features-list"></ul>
        </div>
      </section>

      <section class="extras-col">
        <div class="block">
          <h2>Active Buffs</h2>
          <ul id="buffs-list"></ul>
          <form id="buff-form" class="add-form">
            <input type="text" id="buff-name" placeholder="name">
            <input type="text" id="buff-notes" placeholder="effect, duration">
            <button type="submit">add</button>
          </form>
        </div>

        <div id="limited-spells-container"></div>

        <div class="block">
          <h2>Equipment</h2>
          <ul id="inventory-list"></ul>
          <form id="inv-form" class="add-form">
            <input type="text" id="inv-name" placeholder="item">
            <input type="text" id="inv-notes" placeholder="notes">
            <button type="submit">add</button>
          </form>
        </div>

        <div class="block fill">
          <h2>Notes</h2>
          <textarea id="notes" placeholder="session notes, NPCs, plot threads"></textarea>
        </div>

        <div class="block update-block">
          <h2>Update sheet <span class="hint">level-ups, loot, spell swaps</span></h2>
          <textarea id="update-description" placeholder="leveled up to 6, took Sentinel feat, found a +1 longbow, picked up a magic missile scroll..."></textarea>
          <div class="update-row">
            <button id="update-submit" type="button">Submit changes</button>
            <span id="update-status" class="update-status muted"></span>
          </div>
        </div>
      </section>

    </main>

    <footer class="footer">
      <button id="short-rest" class="big">Short Rest</button>
      <button id="long-rest" class="big primary">Long Rest</button>
      <span class="spacer"></span>
      <button id="export-btn" class="ghost">Export</button>
      <label class="ghost btn-label">
        Import
        <input type="file" id="import-input" accept="application/json" hidden>
      </label>
      <button id="reset-btn" class="ghost danger">Reset</button>
    </footer>
  `;
}

function showError(msg) {
  document.body.innerHTML = `
    <div style="max-width:600px;margin:80px auto;padding:24px;border:1px solid #d0d7de;border-radius:6px;font-family:-apple-system,BlinkMacSystemFont,sans-serif">
      <h1 style="margin:0 0 12px;font-size:18px">Couldn't load this character</h1>
      <p style="margin:0;color:#57606a;font-size:13px">${msg}</p>
      <p style="margin:16px 0 0;font-size:12px"><a href="/dnd/">&larr; back to characters</a></p>
    </div>
  `;
}

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
  renderResources();
  renderAttacks();
  renderSpells();
  renderLimitedSpells();
  renderFeatures();
  renderBuffs();
  renderInventory();
  document.getElementById('gold').textContent = state.gold;
  document.getElementById('alignment').textContent = state.alignment;
  document.getElementById('xp').textContent = state.xp;
  document.getElementById('notes').value = state.notes;
  saveState();
}

function set(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

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
  if (CHARACTER.reaction) {
    set('reaction-title', CHARACTER.reaction.title);
    set('reaction-desc', CHARACTER.reaction.desc);
  }
}

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

/* ---------- Slots bar: spell slots + resources ---------- */

function renderSpellSlots() {
  const bar = document.getElementById('slots-bar');
  bar.innerHTML = '';

  // spell slots first, ordered by level
  const slotLevels = Object.keys(CHARACTER.spellSlots || {}).sort((a, b) => +a - +b);
  slotLevels.forEach(lvl => {
    const block = document.createElement('div');
    block.className = 'slot-block';
    const tier = document.createElement('span');
    tier.className = 'slot-tier';
    tier.textContent = ordinal(lvl);
    block.appendChild(tier);
    const pipsEl = document.createElement('div');
    pipsEl.className = 'big-pips';
    state.spellSlots[lvl].forEach((used, i) => {
      const pip = document.createElement('div');
      pip.className = 'pip' + (used ? ' used' : '');
      pip.title = `${ordinal(lvl)} level slot`;
      pip.addEventListener('click', () => {
        state.spellSlots[lvl][i] = !state.spellSlots[lvl][i];
        render();
      });
      pipsEl.appendChild(pip);
    });
    block.appendChild(pipsEl);
    bar.appendChild(block);
  });

  if (slotLevels.length && (CHARACTER.resources || []).length) {
    const div = document.createElement('div');
    div.className = 'slot-divider';
    bar.appendChild(div);
  }
}

function renderResources() {
  const bar = document.getElementById('slots-bar');
  (CHARACTER.resources || []).forEach(r => {
    const block = document.createElement('div');
    block.className = 'slot-block';
    const tier = document.createElement('span');
    tier.className = 'slot-tier';
    if (r.type === 'counter') tier.classList.add('loh');
    tier.textContent = r.name;
    block.appendChild(tier);

    if (r.type === 'pip') {
      const pipsEl = document.createElement('div');
      pipsEl.className = 'big-pips';
      state.resources[r.key].forEach((used, i) => {
        const pip = document.createElement('div');
        pip.className = 'pip' + (used ? ' used' : '');
        pip.title = r.name;
        pip.addEventListener('click', () => {
          state.resources[r.key][i] = !state.resources[r.key][i];
          render();
        });
        pipsEl.appendChild(pip);
      });
      block.appendChild(pipsEl);
    } else if (r.type === 'counter') {
      const num = document.createElement('span');
      num.className = 'loh-num';
      num.innerHTML = `<span class="editable" id="res-${r.key}-current" contenteditable="true">${state.resources[r.key]}</span>/<span>${r.max}</span>`;
      block.appendChild(num);
    } else if (r.type === 'toggle') {
      const pipsEl = document.createElement('div');
      pipsEl.className = 'big-pips';
      const pip = document.createElement('div');
      pip.className = 'pip' + (state.resources[r.key] ? ' used' : '');
      pip.title = r.name;
      pip.addEventListener('click', () => {
        state.resources[r.key] = !state.resources[r.key];
        render();
      });
      pipsEl.appendChild(pip);
      block.appendChild(pipsEl);
    }
    bar.appendChild(block);
  });

  // wire up counter editables (post-DOM)
  (CHARACTER.resources || []).forEach(r => {
    if (r.type !== 'counter') return;
    const el = document.getElementById(`res-${r.key}-current`);
    if (!el) return;
    el.addEventListener('blur', () => {
      const v = parseInt(el.textContent, 10);
      if (isNaN(v) || v < 0) { render(); return; }
      state.resources[r.key] = clamp(v, 0, r.max);
      render();
    });
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
    });
  });
}

function ordinal(n) {
  const num = +n;
  const s = ['th', 'st', 'nd', 'rd'];
  const v = num % 100;
  return num + (s[(v - 20) % 10] || s[v] || s[0]);
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
  (CHARACTER.spells || []).forEach(s => {
    ul.appendChild(buildSpellRow({ ...s, onClickRow: () => castPreparedSpell(s) }));
  });
}

function renderLimitedSpells() {
  const container = document.getElementById('limited-spells-container');
  container.innerHTML = '';

  // Standard slots that always render even if empty, in this order
  const STANDARD_GROUPS = ['Racials', 'Scrolls'];

  // group by `group` field, preserving first-seen order; ensure standards exist
  const groups = [];
  const groupMap = {};

  STANDARD_GROUPS.forEach(name => {
    groupMap[name] = { name, items: [] };
    groups.push(groupMap[name]);
  });

  (CHARACTER.limitedSpells || []).forEach(s => {
    if (!groupMap[s.group]) {
      groupMap[s.group] = { name: s.group, items: [] };
      groups.push(groupMap[s.group]);
    }
    groupMap[s.group].items.push(s);
  });

  groups.forEach(g => {
    const block = document.createElement('div');
    block.className = 'block';
    const h2 = document.createElement('h2');
    h2.textContent = g.name;
    block.appendChild(h2);

    const ul = document.createElement('ul');
    ul.className = 'spell-list compact';
    if (g.items.length === 0) {
      const li = document.createElement('li');
      li.style.cssText = 'color:var(--faint);font-size:11px;font-style:italic;padding:4px 0;';
      li.textContent = 'none';
      ul.appendChild(li);
    }
    g.items.forEach(s => {
      const usesArr = state.limitedSpells[s.key];
      // for multi-count items (scrolls with 2 charges), render one row per charge
      const total = s.count || 1;
      for (let i = 0; i < total; i++) {
        const used = usesArr[i];
        ul.appendChild(buildSpellRow({
          lvlLabel: '',
          name: s.name,
          slug: s.slug,
          tags: s.tags || [],
          extraTag: s.meta,
          used,
          desc: s.desc,
          onClickRow: () => {
            const isConc = s.tags && s.tags.includes('conc');
            if (!used && isConc && state.concentration && state.concentration !== s.name) {
              if (!confirm(`Cast ${s.name}? Drops concentration on ${state.concentration}.`)) return;
            }
            state.limitedSpells[s.key][i] = !used;
            if (!used && isConc) state.concentration = s.name;
            render();
          },
        }));
      }
    });
    block.appendChild(ul);
    container.appendChild(block);
  });
}

function renderAttacks() {
  const tbody = document.getElementById('attacks-body');
  tbody.innerHTML = '';
  (CHARACTER.attacks || []).forEach(a => {
    const tr = document.createElement('tr');
    const extra = a.extra ? ` <em class="muted">- ${a.extra}</em>` : '';
    tr.innerHTML = `<td></td><td></td><td></td>`;
    tr.children[0].textContent = a.name;
    tr.children[1].textContent = a.atk;
    tr.children[2].innerHTML = a.notes + extra;
    tbody.appendChild(tr);
  });
}

function renderFeatures() {
  const ul = document.getElementById('features-list');
  ul.innerHTML = '';
  (CHARACTER.features || []).forEach(f => {
    const li = document.createElement('li');
    if (f.upcoming) li.className = 'upcoming';
    const tag = f.tag ? ` <span class="muted">(${f.tag})</span>` : '';
    li.innerHTML = `<span class="feat-name">${f.name}${tag}</span><span class="feat-desc">${f.desc}</span>`;
    ul.appendChild(li);
  });
}

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
      <button class="remove-btn" title="remove">&times;</button>
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
      <button class="remove-btn" title="remove">&times;</button>
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

function wireEvents() {
  document.getElementById('inspiration').addEventListener('click', () => {
    state.inspiration = !state.inspiration;
    render();
  });

  document.getElementById('conc-clear').addEventListener('click', () => {
    state.concentration = null;
    render();
  });

  bindEditableNumber('hp-current', v => { state.hp.current = clamp(v, 0, state.hp.max); });
  bindEditableNumber('hp-max',     v => { state.hp.max = v; state.hp.current = Math.min(state.hp.current, v); });
  bindEditableNumber('hp-temp',    v => { state.hp.temp = v; });
  bindEditableNumber('hd-current', v => { state.hitDice = clamp(v, 0, CHARACTER.combat.hitDiceMax); });
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

  document.getElementById('update-submit').addEventListener('click', async () => {
    const desc = document.getElementById('update-description').value.trim();
    const status = document.getElementById('update-status');
    const btn = document.getElementById('update-submit');
    if (desc.length < 5) {
      status.textContent = 'Describe what changed (at least a few words).';
      status.className = 'update-status warn';
      return;
    }
    btn.disabled = true;
    status.textContent = 'Submitting...';
    status.className = 'update-status info';
    try {
      const res = await fetch('https://dnd-upload-maltysnacks-projects.vercel.app/api/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: SLUG,
          description: desc,
          state,
          website: '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      status.innerHTML = `Submitted &rarr; <a href="${data.prUrl}" target="_blank" rel="noopener">PR #${data.prNumber}</a>. Wren will polish, maltysnack merges.`;
      status.className = 'update-status ok';
      document.getElementById('update-description').value = '';
    } catch (err) {
      status.textContent = `Submit failed: ${err.message}`;
      status.className = 'update-status error';
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('short-rest').addEventListener('click', () => {
    if (!confirm('Short rest? Restores resources marked 1/short, any limited spells with restoresOn=short, and (Pact Magic) spell slots if spellSlotsRestoresOn=short.')) return;
    (CHARACTER.resources || []).forEach(r => {
      if (r.restoresOn !== 'short') return;
      if (r.type === 'pip') state.resources[r.key] = Array(r.max).fill(false);
      else if (r.type === 'counter') state.resources[r.key] = r.max;
      else if (r.type === 'toggle') state.resources[r.key] = false;
    });
    (CHARACTER.limitedSpells || []).forEach(s => {
      if (s.restoresOn === 'short') state.limitedSpells[s.key] = Array(s.count || 1).fill(false);
    });
    // Warlock Pact Magic slots restore on short rest when configured
    if (CHARACTER.spellSlotsRestoresOn === 'short') {
      Object.entries(CHARACTER.spellSlots || {}).forEach(([k, n]) => {
        state.spellSlots[k] = Array(n).fill(false);
      });
    }
    render();
  });

  document.getElementById('long-rest').addEventListener('click', () => {
    if (!confirm('Long rest? Restores HP, slots, all class resources (short and long), and limited spells (except scrolls / restoresOn=never). Drops concentration.')) return;
    state.hp.current = state.hp.max;
    state.hp.temp = 0;
    state.hitDice = CHARACTER.combat.hitDiceMax;
    Object.entries(CHARACTER.spellSlots || {}).forEach(([k, n]) => {
      state.spellSlots[k] = Array(n).fill(false);
    });
    (CHARACTER.resources || []).forEach(r => {
      if (r.restoresOn === 'never') return;
      if (r.type === 'pip') state.resources[r.key] = Array(r.max).fill(false);
      else if (r.type === 'counter') state.resources[r.key] = r.max;
      else if (r.type === 'toggle') state.resources[r.key] = false;
    });
    (CHARACTER.limitedSpells || []).forEach(s => {
      if (s.restoresOn === 'long' || s.restoresOn === 'short') {
        state.limitedSpells[s.key] = Array(s.count || 1).fill(false);
      }
    });
    state.deathSaves = { successes: [false, false, false], failures: [false, false, false] };
    state.concentration = null;
    render();
  });

  document.getElementById('export-btn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${SLUG}-${new Date().toISOString().split('T')[0]}.json`;
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
}

/* =====================================================================
   Init
   ===================================================================== */

async function init() {
  if (!SLUG) {
    showError('No CHARACTER_ID set on this page.');
    return;
  }
  try {
    const res = await fetch(`/dnd/characters/${SLUG}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    CHARACTER = await res.json();
  } catch (err) {
    showError(`Could not load /dnd/characters/${SLUG}.json. (${err.message})`);
    return;
  }
  buildLayout();
  state = loadState();
  wireEvents();
  render();
}

init();
