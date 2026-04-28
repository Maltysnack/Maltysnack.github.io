#!/usr/bin/env node
/**
 * scripts/sync-fpl.js
 * Fetches FPL bootstrap-static + fixtures for the current/next GW
 * and writes a slim cache to projects/fpl-api-cache.json
 * Runs via GitHub Actions — no CORS issues here.
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const OUT = path.join(__dirname, '..', 'projects', 'fpl-api-cache.json');

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FPL-cache-bot/1.0)',
        'Accept':     'application/json'
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        try { resolve(JSON.parse(body)); }
        catch(e) { reject(new Error(`JSON parse error: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(new Error('Timeout')); });
  });
}

// Only keep the fields the page actually uses
const ELEMENT_FIELDS = [
  'id','web_name','first_name','second_name',
  'element_type','team','team_code',
  'ep_next','form','total_points','minutes',
  'now_cost','cost_change_event','cost_change_start',
  'selected_by_percent',
  'status','chance_of_playing_next_round','news',
  'penalties_order','penalties_text',
  'transfers_in_event','transfers_out_event',
  'expected_goal_involvements_per_90',
  'expected_goals_conceded_per_90',
  'ict_index','points_per_game',
  'goals_scored','assists','clean_sheets',
  'saves','yellow_cards','red_cards'
];

const TEAM_FIELDS   = ['id','name','short_name','code','strength_overall_home','strength_overall_away'];
const EVENT_FIELDS  = ['id','name','deadline_time','is_next','is_current','is_previous','finished'];
const FIXTURE_FIELDS = ['id','event','team_h','team_a','team_h_difficulty','team_a_difficulty','finished'];

function slim(obj, fields) {
  const out = {};
  for (const f of fields) if (obj[f] !== undefined) out[f] = obj[f];
  return out;
}

async function main() {
  console.log('Fetching bootstrap-static...');
  const bootstrap = await get('https://fantasy.premierleague.com/api/bootstrap-static/');

  const events   = bootstrap.events.map(e => slim(e, EVENT_FIELDS));
  const teams    = bootstrap.teams.map(t => slim(t, TEAM_FIELDS));
  const elements = bootstrap.elements.map(e => slim(e, ELEMENT_FIELDS));

  const nextEv = events.find(e => e.is_next) || events.find(e => !e.finished) || events[events.length - 1];
  const lastEv = events.filter(e => e.finished).slice(-1)[0];
  const nextGwId = nextEv ? nextEv.id : null;
  const lastGwId = lastEv ? lastEv.id : (nextGwId ? nextGwId - 1 : null);

  let nextGwFixtures = [];
  let lastGwFixtures = [];

  if (nextGwId) {
    console.log(`Fetching fixtures for GW${nextGwId}...`);
    const raw = await get(`https://fantasy.premierleague.com/api/fixtures/?event=${nextGwId}`);
    nextGwFixtures = raw.map(f => slim(f, FIXTURE_FIELDS));
  }

  if (lastGwId && lastGwId !== nextGwId) {
    console.log(`Fetching fixtures for GW${lastGwId}...`);
    const raw = await get(`https://fantasy.premierleague.com/api/fixtures/?event=${lastGwId}`);
    lastGwFixtures = raw.map(f => slim(f, FIXTURE_FIELDS));
  }

  const cache = {
    updatedAt:       new Date().toISOString(),
    nextGwId,
    lastGwId,
    events,
    teams,
    elements,
    nextGwFixtures,
    lastGwFixtures
  };

  fs.writeFileSync(OUT, JSON.stringify(cache));
  console.log(`Wrote ${OUT} (${Math.round(fs.statSync(OUT).size / 1024)} KB)`);
}

main().catch(err => { console.error(err); process.exit(1); });
