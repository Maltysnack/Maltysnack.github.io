#!/usr/bin/env node
/* =====================================================================
   build-dnd-index.js

   Walks /dnd/characters/*.json (excluding index.json), writes
   /dnd/characters/index.json with summary fields for the browse page,
   and ensures /dnd/<id>.html shim exists for each character.

   Usage:  node dnd/scripts/build-dnd-index.js
   Exits non-zero on slug collisions or invalid JSON.
   ===================================================================== */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const CHARS_DIR = path.join(ROOT, 'dnd', 'characters');
const DND_DIR = path.join(ROOT, 'dnd');
const INDEX_PATH = path.join(CHARS_DIR, 'index.json');

const SHIM_TEMPLATE = (id, name) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name} - Character Sheet</title>
  <link rel="stylesheet" href="/dnd/sheet.css">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png?v=3" />
  <link rel="icon" href="/favicon.ico?v=3" sizes="any" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=3" />
  <link rel="manifest" href="/manifest.json?v=3" />
  <meta name="theme-color" content="#13110d" />
</head>
<body>
  <script>window.CHARACTER_ID = '${id}';</script>
  <script src="/dnd/sheet.js"></script>
</body>
</html>
`;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function main() {
  if (!fs.existsSync(CHARS_DIR)) {
    console.error(`Characters dir missing: ${CHARS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(CHARS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'index.json');

  const characters = [];
  const seen = new Map();
  let errors = 0;

  for (const f of files) {
    const fp = path.join(CHARS_DIR, f);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(fp, 'utf-8'));
    } catch (err) {
      console.error(`FAIL: ${f}: ${err.message}`);
      errors++;
      continue;
    }

    const id = data.id || path.basename(f, '.json');
    if (seen.has(id)) {
      console.error(`FAIL: slug collision "${id}": ${f} vs ${seen.get(id)}`);
      errors++;
      continue;
    }
    seen.set(id, f);

    if (path.basename(f, '.json') !== id) {
      console.error(`FAIL: filename ${f} does not match id "${id}"`);
      errors++;
      continue;
    }

    if (!data.identity?.name) {
      console.error(`FAIL: ${f}: missing identity.name`);
      errors++;
      continue;
    }

    characters.push({
      id,
      name: data.identity.name,
      descriptors: data.descriptors || [],
      classLine: data.identity.classLine || '',
      class: data.class || '',
      level: data.level || 0,
      background: data.identity.background || '',
    });

    // ensure shim exists
    const shimPath = path.join(DND_DIR, `${id}.html`);
    if (!fs.existsSync(shimPath)) {
      fs.writeFileSync(shimPath, SHIM_TEMPLATE(id, data.identity.name));
      console.log(`+ created shim ${path.relative(ROOT, shimPath)}`);
    }
  }

  if (errors > 0) {
    console.error(`\n${errors} error(s). Index not written.`);
    process.exit(1);
  }

  characters.sort((a, b) => a.name.localeCompare(b.name));

  const out = {
    schemaVersion: 1,
    generatedAt: todayIso(),
    characters,
  };

  fs.writeFileSync(INDEX_PATH, JSON.stringify(out, null, 2) + '\n');
  console.log(`Wrote ${path.relative(ROOT, INDEX_PATH)} (${characters.length} character${characters.length === 1 ? '' : 's'}).`);

  // warn on orphan shims (html exists in /dnd/ that doesn't match a character or known relic)
  const knownRelics = new Set(['index.html', 'grosh.html']);
  const allDndHtml = fs.readdirSync(DND_DIR).filter(f => f.endsWith('.html'));
  const orphans = allDndHtml.filter(f => !knownRelics.has(f) && !seen.has(path.basename(f, '.html')));
  if (orphans.length > 0) {
    console.warn(`\nOrphan HTML shims (no matching character JSON):`);
    orphans.forEach(f => console.warn(`  ${f}`));
  }
}

main();
