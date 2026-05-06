/* =====================================================================
   /api/upload  (Vercel Function)

   Receives a parsed-and-confirmed character JSON from /dnd/ and opens
   a pull request against this repo adding the file to dnd/characters/.

   Env vars required (set in Vercel dashboard):
     GITHUB_TOKEN  fine-grained PAT, Contents R/W + Pull requests R/W
                   scoped to Maltysnack/Maltysnack.github.io
   ===================================================================== */

const REPO = 'Maltysnack/Maltysnack.github.io';
const BASE_BRANCH = 'main';
const ALLOWED_ORIGINS = [
  'https://maltysnack.github.io',
  'http://localhost:8766', // local dev preview
];
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,80}[a-z0-9]$/;
const MAX_BODY_BYTES = 200 * 1024; // 200KB hard cap, characters are ~10KB

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || '';
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allow);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(500).json({ error: 'Server not configured (no GITHUB_TOKEN).' });

  let body;
  try {
    body = req.body || {};
    if (typeof body === 'string') body = JSON.parse(body);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body.' });
  }

  // Honeypot: bots fill hidden fields, humans don't
  if (body.website || body.url || body.honeypot) {
    return res.status(204).end();
  }

  const character = body.character;
  const notes = (body.notes || '').toString().slice(0, 4000);

  if (!character || typeof character !== 'object') {
    return res.status(400).json({ error: 'Missing character.' });
  }
  if (!character.id || !SLUG_RE.test(character.id)) {
    return res.status(400).json({ error: 'Invalid character.id (expected lowercase letters, digits, hyphens).' });
  }
  if (!character.identity?.name || character.identity.name.length > 80) {
    return res.status(400).json({ error: 'Missing or oversized identity.name.' });
  }
  const serialized = JSON.stringify(character, null, 2) + '\n';
  if (Buffer.byteLength(serialized, 'utf8') > MAX_BODY_BYTES) {
    return res.status(413).json({ error: 'Character JSON too large.' });
  }

  try {
    // 1. Resolve base branch SHA
    const baseRef = await gh(`/repos/${REPO}/git/ref/heads/${BASE_BRANCH}`, token);
    const baseSha = baseRef.object.sha;

    // 2. Create branch
    const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const branchName = `upload/${character.id}-${stamp}`;
    await gh(`/repos/${REPO}/git/refs`, token, {
      method: 'POST',
      body: { ref: `refs/heads/${branchName}`, sha: baseSha },
    });

    // 3. Add the character file on that branch
    const path = `dnd/characters/${character.id}.json`;
    const content = Buffer.from(serialized, 'utf8').toString('base64');
    await gh(`/repos/${REPO}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}`, token, {
      method: 'PUT',
      body: {
        message: `feat(dnd): add character ${character.identity.name}`,
        content,
        branch: branchName,
      },
    });

    // 4. Open PR
    const prBody = [
      `Auto-submitted via the dnd upload form.`,
      ``,
      `**Character**: ${escapeMd(character.identity.name)} (\`${character.id}\`)`,
      `**Class**: ${escapeMd(character.identity.classLine || '(unknown)')}`,
      `**Descriptors**: ${(character.descriptors || []).map(escapeMd).join(', ') || '(none)'}`,
      ``,
      `**Notes from uploader**:`,
      notes ? '> ' + escapeMd(notes).replace(/\n/g, '\n> ') : '> (none)',
      ``,
      `---`,
      ``,
      `To accept: review \`${path}\`, click **Merge**. Then locally pull and run \`node scripts/build-dnd-index.js\` to rebuild the index + shim.`,
    ].join('\n');

    const pr = await gh(`/repos/${REPO}/pulls`, token, {
      method: 'POST',
      body: {
        title: `New character: ${character.identity.name}`,
        head: branchName,
        base: BASE_BRANCH,
        body: prBody,
      },
    });

    return res.status(200).json({ ok: true, prUrl: pr.html_url, prNumber: pr.number });
  } catch (err) {
    const msg = (err && err.message) || 'unknown';
    return res.status(502).json({ error: 'GitHub request failed', detail: msg.slice(0, 300) });
  }
};

async function gh(path, token, init = {}) {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'maltysnack-upload-bot',
  };
  const opts = { method: init.method || 'GET', headers };
  if (init.body) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(init.body);
  }
  const r = await fetch(`https://api.github.com${path}`, opts);
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`GH ${r.status} ${path}: ${text.slice(0, 200)}`);
  }
  return r.json();
}

function escapeMd(s) {
  return String(s ?? '').replace(/[<>]/g, ch => ({ '<': '&lt;', '>': '&gt;' }[ch]));
}
