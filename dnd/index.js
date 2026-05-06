/* =====================================================================
   index.js - dnd browse page
   Loads /dnd/characters/index.json, handles search / sort / filter /
   pagination on the card grid.
   ===================================================================== */

const PAGE_SIZE = 50;
const CLASSES_5E = [
  'Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk',
  'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard', 'Artificer'
];

function parseClassLine(line) {
  if (!line) return { race: '', baseClass: '', subclass: '', level: null };
  const subMatch = line.match(/\(([^)]+)\)/);
  const subclass = subMatch ? subMatch[1].trim() : '';
  const stripped = line.replace(/\([^)]+\)/, ' ').replace(/\s+/g, ' ').trim();
  const lvlMatch = stripped.match(/(\d+)\s*$/);
  const level = lvlMatch ? parseInt(lvlMatch[1], 10) : null;
  const noLvl = stripped.replace(/\d+\s*$/, '').trim();

  let baseClass = '';
  let race = noLvl;
  for (const c of CLASSES_5E) {
    const re = new RegExp(`\\b${c}\\b`, 'i');
    if (re.test(noLvl)) {
      baseClass = c;
      race = noLvl.replace(re, '').trim();
      break;
    }
  }
  return { race, baseClass, subclass, level };
}

let allCharacters = [];
let filtered = [];
let page = 1;

const $ = (id) => document.getElementById(id);

async function init() {
  try {
    const res = await fetch('/dnd/characters/index.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    allCharacters = data.characters || [];
  } catch (err) {
    showError(`Couldn't load character index. (${err.message})`);
    return;
  }

  populateClassFilter();
  wireEvents();
  applyFiltersAndRender();
}

function showError(msg) {
  $('character-grid').innerHTML = `<p class="empty-state">${msg}</p>`;
}

function populateClassFilter() {
  const sel = $('filter-class');
  // include only classes that appear in the current set, plus a few standards for futureproofing
  const present = new Set();
  allCharacters.forEach(c => {
    const hay = `${c.classLine || ''} ${c.class || ''}`.toLowerCase();
    if (!hay.trim()) return;
    const found = CLASSES_5E.find(cls => hay.includes(cls.toLowerCase()));
    if (found) present.add(found);
  });
  CLASSES_5E.forEach(cls => {
    const opt = document.createElement('option');
    opt.value = cls;
    opt.textContent = cls;
    if (!present.has(cls)) opt.disabled = true;
    sel.appendChild(opt);
  });
}

function wireEvents() {
  let searchTimer;
  $('search').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { page = 1; applyFiltersAndRender(); }, 150);
  });
  $('sort').addEventListener('change', () => { page = 1; applyFiltersAndRender(); });
  $('filter-class').addEventListener('change', () => { page = 1; applyFiltersAndRender(); });
  $('filter-level').addEventListener('change', () => { page = 1; applyFiltersAndRender(); });

  $('prev-page').addEventListener('click', () => {
    if (page > 1) { page--; applyFiltersAndRender(); window.scrollTo({ top: 0 }); }
  });
  $('next-page').addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (page < totalPages) { page++; applyFiltersAndRender(); window.scrollTo({ top: 0 }); }
  });
}

function applyFiltersAndRender() {
  const q = $('search').value.trim().toLowerCase();
  const klass = $('filter-class').value;
  const lvl = $('filter-level').value;
  const sort = $('sort').value;

  filtered = allCharacters.filter(c => {
    if (q) {
      const hay = `${c.name} ${(c.descriptors || []).join(' ')} ${c.classLine || c.class || ''} ${c.background || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    const classHay = `${c.classLine || ''} ${c.class || ''}`.toLowerCase();
    if (klass && !classHay.includes(klass.toLowerCase())) return false;
    if (lvl && String(c.level) !== lvl) return false;
    return true;
  });

  filtered.sort((a, b) => {
    switch (sort) {
      case 'name-asc':  return (a.name || '').localeCompare(b.name || '');
      case 'name-desc': return (b.name || '').localeCompare(a.name || '');
      case 'level-asc': return (a.level || 0) - (b.level || 0);
      case 'level-desc': return (b.level || 0) - (a.level || 0);
      case 'class-asc': return (a.class || '').localeCompare(b.class || '');
      default: return 0;
    }
  });

  renderCards();
  renderPagination();
}

function renderCards() {
  const grid = $('character-grid');
  grid.innerHTML = '';

  if (filtered.length === 0) {
    grid.innerHTML = `<p class="empty-state">No characters match.</p>`;
    return;
  }

  const start = (page - 1) * PAGE_SIZE;
  const slice = filtered.slice(start, start + PAGE_SIZE);

  slice.forEach(c => {
    const a = document.createElement('a');
    a.className = 'home-card character-card';
    a.href = `/dnd/${c.id}.html`;

    const desc = (c.descriptors || []).join(' · ');
    const parts = parseClassLine(c.classLine || c.class || '');
    const headParts = [parts.race, parts.baseClass].filter(Boolean).join(' ');
    const lvl = parts.level || c.level;

    a.innerHTML = `
      <span class="character-info">
        <span class="home-card-title"></span>
        <span class="card-descriptors"></span>
        <span class="char-meta">
          <strong class="char-head"></strong>
          <span class="char-level"></span>
          <em class="char-subclass"></em>
        </span>
      </span>
      <span class="home-card-arrow">&rarr;</span>
    `;
    a.querySelector('.home-card-title').textContent = c.name;
    a.querySelector('.card-descriptors').textContent = desc;
    a.querySelector('.char-head').textContent = headParts || (c.classLine || '');
    a.querySelector('.char-level').textContent = lvl ? `Lv ${lvl}` : '';
    a.querySelector('.char-subclass').textContent = parts.subclass;
    grid.appendChild(a);
  });
}

function renderPagination() {
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  $('page-info').textContent = `${filtered.length} character${filtered.length === 1 ? '' : 's'}` +
    (totalPages > 1 ? ` · page ${page} of ${totalPages}` : '');
  $('prev-page').disabled = page <= 1;
  $('next-page').disabled = page >= totalPages;
  $('pagination').style.display = totalPages > 1 ? 'flex' : 'none';
}

init();
