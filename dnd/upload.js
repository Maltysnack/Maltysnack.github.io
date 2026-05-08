/* =====================================================================
   upload.js - dnd character upload flow

   Visitor downloads the official WotC fillable PDF, fills it in, drops
   it back here. We parse the AcroForm fields, derive class resources +
   spell slots from class-resources.js, render a live preview, and let
   them download a character.json that maltysnack can drop in the repo.

   Nothing leaves the browser unless the visitor clicks Download.
   ===================================================================== */

const PDFJS_CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build/pdf.min.mjs';
const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build/pdf.worker.min.mjs';
const UPLOAD_ENDPOINT = 'https://dnd-upload-maltysnacks-projects.vercel.app/api/upload';

let pdfjsLib = null;
let draft = null;

const $u = (id) => document.getElementById(id);

async function loadPdfJs() {
  if (pdfjsLib) return pdfjsLib;
  const mod = await import(PDFJS_CDN);
  mod.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  pdfjsLib = mod;
  return pdfjsLib;
}

/* ---------- Parsing helpers ---------- */

function asText(v) { return (v ?? '').toString().trim(); }
function asInt(v, fallback = 0) {
  const n = parseInt(asText(v).replace(/[^\-0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : fallback;
}
function asMod(v) {
  // bonus values like "+5" or "-1" or "5"
  const s = asText(v).replace(/[^\-+0-9]/g, '');
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}
function abilityModFromScore(score) { return Math.floor((score - 10) / 2); }
function slugify(s) {
  return asText(s).toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseClassLine(str) {
  // "Triton Paladin (Ancients) 5" -> { classLine: full, level: 5 }
  const m = asText(str).match(/(\d+)\s*$/);
  return {
    classLine: asText(str),
    level: m ? parseInt(m[1], 10) : 1,
  };
}

const SKILL_FIELDS = [
  ['Acrobatics', 'Acrobatics', 'dex'],
  ['Animal Handling', 'Animal', 'wis'],
  ['Arcana', 'Arcana', 'int'],
  ['Athletics', 'Athletics', 'str'],
  ['Deception', 'Deception ', 'cha'],
  ['History', 'History ', 'int'],
  ['Insight', 'Insight', 'wis'],
  ['Intimidation', 'Intimidation', 'cha'],
  ['Investigation', 'Investigation ', 'int'],
  ['Medicine', 'Medicine', 'wis'],
  ['Nature', 'Nature', 'int'],
  ['Perception', 'Perception ', 'wis'],
  ['Performance', 'Performance', 'cha'],
  ['Persuasion', 'Persuasion', 'cha'],
  ['Religion', 'Religion', 'int'],
  ['Sleight of Hand', 'SleightofHand', 'dex'],
  ['Stealth', 'Stealth ', 'dex'],
  ['Survival', 'Survival', 'wis'],
];

const SAVE_FIELDS = [
  ['str', 'ST Strength'],
  ['dex', 'ST Dexterity'],
  ['con', 'ST Constitution'],
  ['int', 'ST Intelligence'],
  ['wis', 'ST Wisdom'],
  ['cha', 'ST Charisma'],
];

const ABILITY_FIELDS = [
  ['str', 'Strength', 'STR'],
  ['dex', 'Dexterity', 'DEX'],
  ['con', 'Constitution', 'CON'],
  ['int', 'Intelligence', 'INT'],
  ['wis', 'Wisdom', 'WIS'],
  ['cha', 'Charisma', 'CHA'],
];

function getField(fields, name) {
  const arr = fields[name];
  if (!arr || !arr.length) return '';
  return arr[0].value ?? '';
}

function parseSheet(fields) {
  const character = {
    schemaVersion: 1,
    id: '',
    descriptors: [],
    identity: {
      name: asText(getField(fields, 'CharacterName')),
      classLine: '',
      background: asText(getField(fields, 'Background')),
      speedLine: `Speed ${asText(getField(fields, 'Speed')) || 30}`,
      languages: '',
      otherProficiencies: '',
    },
    class: '',
    level: 1,
    profBonus: asInt(getField(fields, 'ProfBonus'), 2),
    spellcastingAbility: 'cha',
    combat: {
      ac: asInt(getField(fields, 'AC'), 10),
      hpMax: asInt(getField(fields, 'HPMax'), 10),
      hitDiceMax: asInt(getField(fields, 'HDTotal'), 1),
      hitDiceType: 'd8',
    },
    startingGold: asInt(getField(fields, 'GP')) +
                  asInt(getField(fields, 'PP')) * 10 +
                  Math.floor(asInt(getField(fields, 'SP')) / 10) +
                  Math.floor(asInt(getField(fields, 'EP')) / 2),
    abilities: [],
    saves: [],
    skills: [],
    attacks: [],
    spellSlots: {},
    resources: [],
    spells: [],
    limitedSpells: [],
    features: [],
    defaultInventory: [],
    homebrew: '',
  };

  // Class + level. The PDF has a separate "Race " field (with trailing
  // space) that the structured parser must explicitly read; otherwise the
  // race info is silently dropped (this caused gnome/human races to be
  // lost on early uploads). Prepend race to classLine if it's not already
  // baked into ClassLevel.
  const rawClassLevel = asText(getField(fields, 'ClassLevel'));
  const raceField = asText(getField(fields, 'Race '));
  let combinedClassLine = rawClassLevel;
  if (raceField && !rawClassLevel.toLowerCase().includes(raceField.toLowerCase())) {
    combinedClassLine = (raceField + ' ' + rawClassLevel).trim();
  }
  const cl = parseClassLine(combinedClassLine);
  character.identity.classLine = cl.classLine;
  character.level = cl.level || 1;
  character.class = (window.CLASS_RESOURCES?.derive(cl.classLine, cl.level, {})?.classKey) || '';

  // Languages + proficiencies (combined field)
  const profLang = asText(getField(fields, 'ProficienciesLang'));
  // Heuristic split: first line is languages, rest is other prof
  const profParts = profLang.split('\n').map(s => s.trim()).filter(Boolean);
  character.identity.languages = profParts[0] || '';
  character.identity.otherProficiencies = profParts.slice(1).join(', ');

  // Abilities
  ABILITY_FIELDS.forEach(([k, name, fname]) => {
    character.abilities.push({
      key: k,
      name,
      score: asInt(getField(fields, fname), 10),
    });
  });

  // Profile prof bonus from level if missing
  if (!character.profBonus || character.profBonus < 2) {
    character.profBonus = window.CLASS_RESOURCES?.profBonus(character.level) || 2;
  }

  const abilitiesByKey = Object.fromEntries(character.abilities.map(a => [a.key, a.score]));
  const profB = character.profBonus;

  // Saves: infer proficiency by bonus value
  SAVE_FIELDS.forEach(([k, fname]) => {
    const declared = asMod(getField(fields, fname));
    const baseMod = abilityModFromScore(abilitiesByKey[k]);
    const proficient = declared !== null && declared > baseMod;
    character.saves.push({ ability: k, proficient });
  });

  // Skills: same inference
  SKILL_FIELDS.forEach(([name, fname, ab]) => {
    const declared = asMod(getField(fields, fname));
    const baseMod = abilityModFromScore(abilitiesByKey[ab]);
    const proficient = declared !== null && declared > baseMod;
    character.skills.push({ name, ability: ab, proficient });
  });

  // Class-derived resources + spell slots (best-effort defaults; visitor can edit)
  const derived = window.CLASS_RESOURCES?.derive(cl.classLine, cl.level, abilitiesByKey);
  if (derived) {
    character.spellSlots = derived.spellSlots || {};
    character.resources = derived.resources || [];
  }

  // Hit dice type guess from class
  const HD_BY_CLASS = {
    barbarian: 'd12', bard: 'd8', cleric: 'd8', druid: 'd8',
    fighter: 'd10', monk: 'd8', paladin: 'd10', ranger: 'd10',
    rogue: 'd8', sorcerer: 'd6', warlock: 'd8', wizard: 'd6', artificer: 'd8',
  };
  if (HD_BY_CLASS[character.class]) character.combat.hitDiceType = HD_BY_CLASS[character.class];

  // Inventory from Equipment field (one line per item)
  const eq = asText(getField(fields, 'Equipment'));
  if (eq) {
    eq.split(/[\n,]/).map(s => s.trim()).filter(Boolean).forEach(line => {
      character.defaultInventory.push({ name: line, notes: '' });
    });
  }

  // Features from Features and Traits field, split by blank lines or numbered/bulleted
  const feat = asText(getField(fields, 'Features and Traits'));
  if (feat) {
    feat.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean).forEach(block => {
      const lines = block.split(/\n/);
      const head = lines[0].replace(/^[-*]\s*/, '');
      const body = lines.slice(1).join(' ').trim();
      character.features.push({ name: head, tag: '', desc: body || '(see source sheet)' });
    });
  }

  // Attacks from AttacksSpellcasting (free text) - dump as homebrew note for review
  const atk = asText(getField(fields, 'AttacksSpellcasting'));
  if (atk) {
    character.homebrew = (character.homebrew ? character.homebrew + '\n\n' : '') +
      'Attacks/Spellcasting (from sheet, please review):\n' + atk;
  }

  // Bio extras into homebrew so reviewer sees them
  const bioParts = [];
  ['PersonalityTraits ', 'Ideals', 'Bonds', 'Flaws', 'Backstory', 'Allies', 'Treasure'].forEach(f => {
    const v = asText(getField(fields, f));
    if (v) bioParts.push(`${f.trim()}: ${v}`);
  });
  if (bioParts.length) {
    character.homebrew = (character.homebrew ? character.homebrew + '\n\n' : '') + bioParts.join('\n');
  }

  // Capture every other non-empty text field the structured parser didn't touch.
  // The WotC fillable PDF has 100+ Spells fields plus other rows the parser
  // doesn't model. Dump them verbatim so the polish step can interpret.
  const handled = new Set([
    'CharacterName', 'ClassLevel', 'Background', 'PlayerName', 'Race ',
    'Alignment', 'XP', 'Inspiration',
    'STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA',
    'STRmod', 'DEXmod ', 'CONmod', 'INTmod', 'WISmod', 'CHamod',
    'ProfBonus', 'AC', 'Initiative', 'Speed',
    'HPMax', 'HPCurrent', 'HPTemp', 'HDTotal', 'HD',
    'Passive', 'ProficienciesLang', 'Equipment',
    'Features and Traits', 'AttacksSpellcasting',
    'CP', 'SP', 'EP', 'GP', 'PP',
    'PersonalityTraits ', 'Ideals', 'Bonds', 'Flaws', 'Backstory',
    'Allies', 'Treasure', 'FactionName',
    'Age', 'Height', 'Weight', 'Eyes', 'Skin', 'Hair',
    'Wpn Name', 'Wpn Name 2', 'Wpn Name 3',
    ...SAVE_FIELDS.map(f => f[1]),
    ...SKILL_FIELDS.map(f => f[1]),
  ]);

  const extras = [];
  for (const [name, arr] of Object.entries(fields)) {
    if (handled.has(name)) continue;
    if (!arr || !arr[0]) continue;
    if (arr[0].type !== 'text') continue;
    const v = (arr[0].value ?? '').toString().trim();
    if (!v) continue;
    extras.push(`  ${name}: ${v}`);
  }
  if (extras.length) {
    character.homebrew = (character.homebrew ? character.homebrew + '\n\n' : '') +
      'RAW PDF FIELDS (parser did not structure these, polish step please interpret):\n' +
      extras.join('\n');
  }

  return character;
}

/* ---------- UI ---------- */

function initUploadPanel() {
  const toggle = $u('upload-toggle');
  const panel = $u('upload-panel');
  if (!toggle || !panel) return;

  toggle.addEventListener('click', () => {
    const open = panel.hasAttribute('hidden');
    if (open) {
      panel.removeAttribute('hidden');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.textContent = 'Close upload panel';
      loadPdfJs().catch(err => {
        $u('upload-status').textContent = 'Failed to load PDF library: ' + err.message;
      });
    } else {
      panel.setAttribute('hidden', '');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = 'Upload your character';
    }
  });

  // File input + drop zone
  const dropZone = $u('upload-drop');
  const fileInput = $u('upload-file');

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });
  fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  });

  // Live updates
  ['descriptor-1', 'descriptor-2', 'slug-override', 'upload-notes'].forEach(id => {
    const el = $u(id);
    if (el) el.addEventListener('input', () => updateDraftFromForm());
  });

  $u('download-btn').addEventListener('click', downloadJson);
  const submitBtn = $u('submit-btn');
  if (submitBtn) submitBtn.addEventListener('click', submitToReviewer);
}

function setStatus(msg, kind = 'info') {
  const s = $u('upload-status');
  s.textContent = msg;
  s.className = 'upload-status ' + kind;
}

async function handleFile(file) {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    setStatus('That doesn\'t look like a PDF.', 'error');
    return;
  }
  setStatus('Reading PDF...', 'info');
  try {
    const lib = await loadPdfJs();
    const buf = await file.arrayBuffer();
    const pdf = await lib.getDocument({ data: buf, useWorker: true }).promise;
    const fields = await pdf.getFieldObjects();
    if (!fields || Object.keys(fields).length === 0) {
      setStatus("This PDF has no form fields. Make sure it's the WotC fillable sheet (link above).", 'error');
      return;
    }
    draft = parseSheet(fields);
    if (!draft.identity.name) {
      setStatus('Parsed, but no character name found. Did you fill in the sheet?', 'warn');
    } else {
      setStatus(`Parsed ${draft.identity.name}.`, 'ok');
    }
    updateDraftFromForm(); // apply initial slug + descriptors
    showFormSection();
    renderPreview();
  } catch (err) {
    console.error(err);
    setStatus('Failed to parse PDF: ' + err.message, 'error');
  }
}

function showFormSection() {
  $u('upload-form-section').removeAttribute('hidden');
  $u('upload-preview-section').removeAttribute('hidden');
  // Pre-fill slug from name
  const slugEl = $u('slug-override');
  if (!slugEl.value && draft.identity.name) {
    slugEl.value = slugify(draft.identity.name);
    rebuildSlug();
  }
}

function rebuildSlug() {
  // Auto-suggest slug from name + descriptors when slug-override is "auto"
  const d1 = slugify($u('descriptor-1').value);
  const d2 = slugify($u('descriptor-2').value);
  const base = slugify($u('slug-override').value) || slugify(draft?.identity?.name || '');
  const parts = [base, d1, d2].filter(Boolean);
  return parts.join('-');
}

function updateDraftFromForm() {
  if (!draft) return;
  const d1 = slugify($u('descriptor-1').value);
  const d2 = slugify($u('descriptor-2').value);
  draft.descriptors = [d1, d2].filter(Boolean);

  const nameSlug = slugify($u('slug-override').value) || slugify(draft.identity.name);
  const fullSlug = [nameSlug, d1, d2].filter(Boolean).join('-');
  draft.id = fullSlug;
  $u('preview-slug').textContent = fullSlug ? `${fullSlug}.json` : '(needs name + 2 descriptors)';
  const ready = !!(nameSlug && d1 && d2);
  $u('download-btn').disabled = !ready;
  const submit = $u('submit-btn');
  if (submit) submit.disabled = !ready;

  draft.homebrew = combineHomebrew();
  renderPreview();
}

function combineHomebrew() {
  const userNotes = $u('upload-notes').value.trim();
  // Keep parsed homebrew (bio extras, attacks free text) and prepend user notes
  const parsed = (draft?._parsedHomebrew ?? draft?.homebrew ?? '');
  if (!draft._parsedHomebrew) draft._parsedHomebrew = parsed; // freeze original parse
  if (userNotes && draft._parsedHomebrew) return userNotes + '\n\n---\n' + draft._parsedHomebrew;
  return userNotes || draft._parsedHomebrew || '';
}

function renderPreview() {
  const out = $u('preview-output');
  // strip the internal _parsedHomebrew tag before showing
  const clean = JSON.parse(JSON.stringify(draft));
  delete clean._parsedHomebrew;
  out.textContent = JSON.stringify(clean, null, 2);
}

function cleanDraft() {
  const clean = JSON.parse(JSON.stringify(draft));
  delete clean._parsedHomebrew;
  return clean;
}

function downloadJson() {
  if (!draft || !draft.id) return;
  const clean = cleanDraft();
  const blob = new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${draft.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
  setStatus(`Downloaded ${draft.id}.json. You can also click "Submit for review" to email it directly.`, 'ok');
}

async function submitToReviewer() {
  if (!draft || !draft.id) return;
  const btn = $u('submit-btn');
  btn.disabled = true;
  setStatus('Submitting to maltysnack...', 'info');
  try {
    const payload = {
      character: cleanDraft(),
      notes: $u('upload-notes').value.trim(),
      website: '',
    };
    const res = await fetch(UPLOAD_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = data?.error || `HTTP ${res.status}`;
      throw new Error(detail);
    }
    setStatus(`Submitted! maltysnack will review. PR: ${data.prUrl || '(opened)'}`, 'ok');
  } catch (err) {
    setStatus(`Submit failed: ${err.message}. You can still download the file and send it manually.`, 'error');
  } finally {
    btn.disabled = !(draft.id && draft.descriptors?.length === 2);
  }
}

initUploadPanel();
