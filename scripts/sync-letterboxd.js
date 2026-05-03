#!/usr/bin/env node
// Fetches the Letterboxd RSS feed and prepends any new diary entries to films.json.
// Haiku lines are pulled from the review text written on Letterboxd.
// Run manually or via GitHub Actions.

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const LBXD_USER  = 'maltysnack';
const FILMS_PATH = path.join(__dirname, '..', 'films.json');
const RSS_URL    = `https://letterboxd.com/${LBXD_USER}/rss/`;

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchUrl(res.headers.location));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end',  () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// Extract a tag's text content (handles CDATA and plain text)
function getTag(xml, tag) {
  const re = new RegExp(
    `<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${tag}>`, 'i'
  );
  const m = re.exec(xml);
  return m ? (m[1] !== undefined ? m[1] : (m[2] || '')).trim() : '';
}

// Pull the poster image URL from the description HTML
function parsePoster(descHtml) {
  const m = /<img[^>]+src="([^"]+)"/i.exec(descHtml);
  return m ? m[1] : '';
}

// Pull the review text (haiku lines) from the description HTML,
// stripping the poster image and star-rating paragraph
function parseHaiku(descHtml) {
  const text = descHtml
    .replace(/<p[^>]*>\s*<img[^>]*>\s*<\/p>/gi, '')   // remove poster <p>
    .replace(/<p[^>]*>[★½\s]*<\/p>/gi, '')             // remove rating <p>
    .replace(/<\/p>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .trim();
  return text.split('\n').map(l => l.trim()).filter(Boolean);
}

function parseItems(xmlText) {
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRe.exec(xmlText)) !== null) {
    const raw   = match[1];
    const title = getTag(raw, 'letterboxd:filmTitle')
                || getTag(raw, 'title').replace(/,\s*\d{4}.*$/, '').trim();
    const year  = parseInt(getTag(raw, 'letterboxd:filmYear')) || 0;
    const date  = getTag(raw, 'letterboxd:watchedDate');
    const uriM  = /<link>([^<]+)<\/link>/i.exec(raw);
    const uri   = uriM ? uriM[1].trim() : getTag(raw, 'guid');
    const desc  = getTag(raw, 'description');
    const poster = parsePoster(desc);
    const haiku  = parseHaiku(desc);
    if (title) items.push({ title: title.trim(), year, date, uri, poster, haiku, review: '' });
  }
  return items;
}

async function main() {
  console.log('Fetching Letterboxd RSS…');
  let xmlText;
  try {
    xmlText = await fetchUrl(RSS_URL);
  } catch (e) {
    console.error('Failed to fetch RSS:', e.message);
    process.exit(1);
  }

  const rssItems = parseItems(xmlText);
  console.log(`Parsed ${rssItems.length} items from RSS`);

  const films = fs.existsSync(FILMS_PATH)
    ? JSON.parse(fs.readFileSync(FILMS_PATH, 'utf8'))
    : [];

  const existing = new Set(films.map(f => `${f.title}|${f.year}`));
  let added = 0;

  // Prepend new items (RSS is newest-first, so iterate in reverse to keep order)
  for (const item of [...rssItems].reverse()) {
    const key = `${item.title}|${item.year}`;
    if (!existing.has(key)) {
      films.unshift(item);
      existing.add(key);
      added++;
      console.log(`  + ${item.title} (${item.year})`);
    }
  }

  if (added > 0) {
    fs.writeFileSync(FILMS_PATH, JSON.stringify(films, null, 2));
    console.log(`Done - added ${added} new ${added === 1 ? 'entry' : 'entries'} to films.json`);
  } else {
    console.log('No new entries - films.json unchanged');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
