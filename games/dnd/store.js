/* =====================================================================
   store.js - characters live in this browser's localStorage

   One key per character: `dnd:<id>` -> { character, state }.
   A save file is the same record plus a format tag, so export and
   import are a JSON round trip.
   ===================================================================== */

(function () {
  const PREFIX = 'dnd:';
  const FORMAT = 'maltysnack-dnd';

  // Safari deletes script-written storage after 7 days without a visit
  // unless the site is granted persistent storage.
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  function slugify(s) {
    // Matches wikidot spell URLs: "Purify Food & Drink" -> purify-food-and-drink
    return String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/['\u2019]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function get(id) {
    try { return JSON.parse(localStorage.getItem(PREFIX + id)); } catch { return null; }
  }

  function put(id, record) {
    localStorage.setItem(PREFIX + id, JSON.stringify(record));
  }

  function list() {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key.startsWith(PREFIX)) continue;
      const rec = get(key.slice(PREFIX.length));
      if (rec && rec.character) out.push(rec);
    }
    return out.sort((a, b) => a.character.identity.name.localeCompare(b.character.identity.name));
  }

  function remove(id) { localStorage.removeItem(PREFIX + id); }

  function newId(name) {
    return (slugify(name) || 'character') + '-' + Date.now().toString(36);
  }

  function exportFile(id) {
    const rec = get(id);
    if (!rec) return;
    const blob = new Blob([JSON.stringify({ format: FORMAT, version: 1, ...rec }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${id}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* Accepts a save file, or a bare character JSON from the old site.
     Returns the id, or null if the user declines to replace a character. */
  async function importFile(file) {
    const data = JSON.parse(await file.text());
    const character = data.format === FORMAT ? data.character : data;
    if (!character || !character.id || !character.identity || !Array.isArray(character.abilities)) {
      throw new Error('Not a character file.');
    }
    if (get(character.id) && !confirm(`Replace ${character.identity.name} in this browser with the imported file?`)) return null;
    let state = data.format === FORMAT ? data.state : null;
    // Play state the old site kept for this character, on this device.
    if (!state) {
      try { state = JSON.parse(localStorage.getItem(`sheet-${character.id}-v1`)); } catch { state = null; }
    }
    put(character.id, { character, state: state || null });
    return character.id;
  }

  window.DND = { get, put, list, remove, newId, slugify, exportFile, importFile };
})();
