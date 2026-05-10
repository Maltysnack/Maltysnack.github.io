/* =====================================================================
   /api/update  (Vercel Function)

   Receives a free-text "what changed" description plus the current
   localStorage state from a player's sheet. Opens an UPDATE PR on the
   existing dnd/characters/<slug>.json:
     - Merges state.inventory into defaultInventory (loot found in
       session becomes permanent).
     - Stores the change description + meta state in a transient
       `_pendingUpdate` field on the JSON.
     - PR body has description + state summary.
   Wren reviews, polishes properly, removes the transient field, you
   merge.

   Env vars (same as upload.js):
     GITHUB_TOKEN | dnd_upload | DND_UPLOAD | GH_TOKEN
   ===================================================================== */

const REPO = 'Maltysnack/Maltysnack.github.io';
const BASE_BRANCH = 'main';
const ALLOWED_ORIGINS = [
  'https://maltysnack.github.io',
  'http://localhost:8766',
];
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,80}[a-z0-9]$/;
const MAX_DESC = 4000;
const MAX_BODY_BYTES = 500 * 1024;

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || '';
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allow);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const token = process.env.GITHUB_TOKEN
    || process.env.dnd_upload
    || process.env.DND_UPLOAD
    || process.env.GH_TOKEN;
  if (!token) return res.status(500).json({ error: 'Server not configured (no GITHUB_TOKEN / dnd_upload).' });

  let body;
  try {
    body = req.body || {};
    if (typeof body === 'string') body = JSON.parse(body);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body.' });
  }

  if (body.website || body.url || body.honeypot) return res.status(204).end();

  const slug = (body.slug || '').toString().trim();
  const description = (body.description || '').toString().trim();
  const state = body.state || null;

  if (!slug || !SLUG_RE.test(slug)) {
    return res.status(400).json({ error: 'Invalid slug.' });
  }
  if (!description || description.length < 5) {
    return res.status(400).json({ error: 'Describe what changed (at least a few words).' });
  }
  if (description.length > MAX_DESC) {
    return res.status(400).json({ error: `Description too long (max ${MAX_DESC} chars).` });
  }

  const path = `dnd/characters/${slug}.json`;

  try {
    // 1. Get existing character JSON + sha
    const existing = await gh(`/repos/${REPO}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${BASE_BRANCH}`, token);
    const existingSha = existing.sha;
    const existingContent = JSON.parse(Buffer.from(existing.content, 'base64').toString('utf8'));

    // 2. Get base branch HEAD sha
    const baseRef = await gh(`/repos/${REPO}/git/ref/heads/${BASE_BRANCH}`, token);
    const baseSha = baseRef.object.sha;

    // 3. Create branch
    const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const branchName = `update/${slug}-${stamp}`;
    await gh(`/repos/${REPO}/git/refs`, token, {
      method: 'POST',
      body: { ref: `refs/heads/${branchName}`, sha: baseSha },
    });

    // 4. Build updated JSON: merge inventory + add transient marker
    const updated = { ...existingContent };

    let newInventoryItems = [];
    if (state && Array.isArray(state.inventory)) {
      const existingNames = new Set((existingContent.defaultInventory || []).map(i => (i.name || '').toLowerCase()));
      newInventoryItems = state.inventory.filter(i => i && i.name && !existingNames.has(i.name.toLowerCase()));
      if (newInventoryItems.length) {
        updated.defaultInventory = [...(existingContent.defaultInventory || []), ...newInventoryItems];
      }
    }

    updated._pendingUpdate = {
      description: description.slice(0, MAX_DESC),
      submittedAt: new Date().toISOString(),
      sessionState: state ? {
        hp: state.hp ?? null,
        gold: state.gold ?? null,
        notes: (state.notes || '').toString().slice(0, 2000),
        buffs: Array.isArray(state.buffs) ? state.buffs.slice(0, 50) : [],
        alignment: state.alignment ?? null,
        xp: state.xp ?? null,
        inventoryAdds: Array.isArray(state.inventory) ? state.inventory.length : 0,
      } : null,
    };

    // 5. Write the file on the new branch
    const serialized = JSON.stringify(updated, null, 2) + '\n';
    if (Buffer.byteLength(serialized, 'utf8') > MAX_BODY_BYTES) {
      return res.status(413).json({ error: 'Update payload too large.' });
    }
    const newContent = Buffer.from(serialized, 'utf8').toString('base64');

    // Explicit author/committer so commits land as `maltysnack`, not as
    // whatever name the PAT owner's profile happens to have set.
    const COMMIT_IDENTITY = {
      name: 'maltysnack',
      email: '39046911+Maltysnack@users.noreply.github.com',
    };
    await gh(`/repos/${REPO}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}`, token, {
      method: 'PUT',
      body: {
        message: `update(dnd): pending change for ${updated.identity?.name || slug}`,
        content: newContent,
        branch: branchName,
        sha: existingSha,
        committer: COMMIT_IDENTITY,
        author: COMMIT_IDENTITY,
      },
    });

    // 6. Open PR
    const truncDesc = description.length > 60 ? description.slice(0, 57) + '...' : description;
    const prBody = [
      `Auto-submitted update via the dnd sheet's update form.`,
      ``,
      `**Character**: ${escapeMd(updated.identity?.name || slug)} (\`${slug}\`)`,
      ``,
      `### What changed (player's words)`,
      `> ${escapeMd(description).replace(/\n/g, '\n> ')}`,
      ``,
      `### Session state at submission`,
      `* HP: ${state?.hp?.current ?? '?'}/${state?.hp?.max ?? '?'}${state?.hp?.temp ? ` (temp ${state.hp.temp})` : ''}`,
      `* Gold: ${state?.gold ?? '?'}`,
      `* Alignment: ${state?.alignment ?? '?'}  ·  XP: ${state?.xp ?? '?'}`,
      `* Inventory adds merged into defaultInventory: ${newInventoryItems.length} new item${newInventoryItems.length === 1 ? '' : 's'}${newInventoryItems.length ? ' (' + newInventoryItems.map(i => i.name).join(', ') + ')' : ''}`,
      `* In-session notes: ${state?.notes ? 'yes (preserved in _pendingUpdate)' : 'none'}`,
      `* Active buffs at submission: ${state?.buffs?.length ?? 0}`,
      ``,
      `---`,
      ``,
      `Wren picks up from here: interpret the description, integrate the changes into the right structured fields, then remove the \`_pendingUpdate\` field. Click Merge once it looks right.`,
    ].join('\n');

    const pr = await gh(`/repos/${REPO}/pulls`, token, {
      method: 'POST',
      body: {
        title: `Update ${updated.identity?.name || slug}: ${truncDesc}`,
        head: branchName,
        base: BASE_BRANCH,
        body: prBody,
      },
    });

    return res.status(200).json({ ok: true, prUrl: pr.html_url, prNumber: pr.number });
  } catch (err) {
    const msg = (err && err.message) || 'unknown';
    if (msg.includes(' 404 ')) {
      return res.status(404).json({ error: `Character ${slug} not found on main. Submit via the upload form first.` });
    }
    return res.status(502).json({ error: 'GitHub request failed', detail: msg.slice(0, 300) });
  }
};

async function gh(path, token, init = {}) {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'maltysnack-update-bot',
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
