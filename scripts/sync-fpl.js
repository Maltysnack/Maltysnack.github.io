#!/usr/bin/env node
/**
 * scripts/sync-fpl.js
 * Fetches FPL bootstrap-static + fixtures for the current/next GW,
 * then compares last-GW predictions vs actual scores to update
 * per-position calibration factors (EMA, α=0.3, 4-week window).
 *
 * Writes a slim cache to projects/fpl-api-cache.json
 * Runs via GitHub Actions - no CORS issues here.
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const FPL = 'https://fantasy.premierleague.com/api/';
const OUT  = path.join(__dirname, '..', 'projects', 'fpl-api-cache.json');

function getOnce(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      timeout: 30000,
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
    req.on('timeout', () => req.destroy(new Error('Timeout')));
  });
}

async function get(url, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    try { return await getOnce(url); }
    catch (e) {
      if (i === attempts) throw e;
      const delay = 2000 * i;
      console.warn(`  ${url} attempt ${i} failed (${e.message}), retrying in ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
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

const TEAM_FIELDS    = ['id','name','short_name','code','strength_overall_home','strength_overall_away'];
const EVENT_FIELDS   = ['id','name','deadline_time','is_next','is_current','is_previous','finished'];
const FIXTURE_FIELDS = ['id','event','team_h','team_a','team_h_difficulty','team_a_difficulty','finished'];

function slim(obj, fields) {
  const out = {};
  for (const f of fields) if (obj[f] !== undefined) out[f] = obj[f];
  return out;
}

// ─── Prediction formula ───────────────────────────────────────────────────────
// Mirrors predictWithFixtures() in fantasyfootball.html.
// IMPORTANT: keep in sync with the browser version when formula changes.
// Uses FDR fallback only (no Odds API here); csFactor=1.0 (neutral).
// Calibration corrects for systematic per-position bias, so fixture-level
// noise averages out over the 4-GW window.
function predictNode(player, fixList) {
  if (!fixList || !fixList.length) return 0;
  const avail = player.chance_of_playing_next_round === null
    ? 1.0 : player.chance_of_playing_next_round / 100;
  if (avail === 0) return 0;

  const ep         = parseFloat(player.ep_next) || 0;
  const form       = parseFloat(player.form)    || 0;
  const seasonAvg  = player.total_points / Math.max(1, player.minutes / 90);
  const xgi90      = parseFloat(player.expected_goal_involvements_per_90) || 0;
  const xgc90      = parseFloat(player.expected_goals_conceded_per_90)    || 0;
  const isPenTaker = player.penalties_order === 1;

  const mins90       = Math.max(1, player.minutes / 90);
  const apps         = Math.max(1, player.minutes / 65);
  const csRate       = (player.clean_sheets  || 0) / apps;
  const goalsPer90   = (player.goals_scored  || 0) / mins90;
  const assistsPer90 = (player.assists       || 0) / mins90;
  const savesPer90   = (player.saves         || 0) / mins90;

  const fix    = fixList[0];
  const isHome = fix.team_h === player.team;
  const fdr    = isHome ? fix.team_h_difficulty : fix.team_a_difficulty;
  const fixtureMod = (fdr === 2 ? 1.12 : fdr === 3 ? 1.00 : fdr === 4 ? 0.87 : 0.72)
                   * (isHome ? 1.04 : 0.97);

  let base;
  if (player.element_type === 1) {
    const csProb     = csRate * 0.5 + Math.max(0, 1.0 - xgc90 / 2.0) * 0.5;
    const csBonus    = csProb * 2.0;  // csFactor=1.0 (neutral, no odds)
    const savesBonus = savesPer90 / 3;
    base = ep * 0.40 + form * 0.20 + seasonAvg * 0.10 + csBonus * 0.20 + savesBonus * 0.10;
  } else if (player.element_type === 2) {
    const csProb = csRate * 0.5 + Math.max(0, 1.0 - xgc90 / 2.0) * 0.5;
    const csBonus = csProb * 2.0;
    const attRet  = (xgi90 * 5) * 0.5 + (goalsPer90 * 6 + assistsPer90 * 3) * 0.5;
    base = ep * 0.40 + form * 0.20 + seasonAvg * 0.10 + csBonus * 0.20 + attRet * 0.10;
  } else if (player.element_type === 3) {
    const attRet = (xgi90 * 5) * 0.5 + (goalsPer90 * 5 + assistsPer90 * 3) * 0.5;
    base = ep * 0.35 + form * 0.20 + seasonAvg * 0.10 + attRet * 0.35;
  } else {
    const attRet = (xgi90 * 4) * 0.5 + (goalsPer90 * 4 + assistsPer90 * 3) * 0.5;
    base = ep * 0.35 + form * 0.20 + seasonAvg * 0.10 + attRet * 0.35;
  }

  if (isPenTaker) base += 0.4;

  if (fixList.length > 1) {
    const epPart = ep * (player.element_type <= 2 ? 0.40 : 0.35);
    base = epPart + (base - epPart) * 1.6;
  }

  return Math.max(0, base * fixtureMod * avail);
}

// ─── Calibration engine ───────────────────────────────────────────────────────
// For each position, computes avg(actual) / avg(predicted) for the last GW,
// then blends into a rolling EMA. Stored in fpl-api-cache.json under "calibration".
//
// Shape: { updatedGw, factors: {1,2,3,4}, history: [{gwId, raw, ema}, ...] }
async function computeCalibration(elements, lastGwId, lastGwFixtures, existingCal) {
  if (!lastGwId || !lastGwFixtures || !lastGwFixtures.length) {
    return existingCal || null;
  }

  // Skip if this GW was already processed
  if (existingCal && existingCal.updatedGw === lastGwId) {
    console.log(`  Calibration already current for GW${lastGwId}, reusing.`);
    return existingCal;
  }

  // Build fixture map for last GW
  const fixMap = {};
  lastGwFixtures.forEach(f => {
    if (!fixMap[f.team_h]) fixMap[f.team_h] = [];
    if (!fixMap[f.team_a]) fixMap[f.team_a] = [];
    fixMap[f.team_h].push(f);
    fixMap[f.team_a].push(f);
  });

  // Fetch actual player scores for last GW
  let liveData;
  try {
    console.log(`  Fetching GW${lastGwId} live scores...`);
    liveData = await get(`${FPL}event/${lastGwId}/live/`);
  } catch (e) {
    console.warn(`  Calibration skipped - live fetch failed: ${e.message}`);
    return existingCal || null;
  }

  const actualPts  = {};
  const actualMins = {};
  liveData.elements.forEach(el => {
    actualPts[el.id]  = el.stats.total_points;
    actualMins[el.id] = el.stats.minutes;
  });

  // Collect (predicted, actual) pairs by position.
  // Only players who played >= 45 mins - below that the formula's signals
  // (CS, saves, goals) don't apply cleanly and would add noise.
  const byPos = { 1: [], 2: [], 3: [], 4: [] };
  elements.forEach(p => {
    const fixtures = fixMap[p.team];
    if (!fixtures) return;
    const mins = actualMins[p.id];
    const act  = actualPts[p.id];
    if (mins === undefined || mins < 45) return;
    const pred = predictNode(p, fixtures);
    if (pred < 0.5) return;  // formula gave near-zero → player was flagged unavailable
    byPos[p.element_type].push({ pred, act });
  });

  // EMA: new = α * thisWeek + (1-α) * old
  const ALPHA      = 0.3;
  const MIN_SAMPLE = 5;           // need at least N players per position to trust signal
  const CLAMP      = [0.65, 1.50]; // hard rails - never correct by more than ±35%

  const posNames = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };
  const factors  = {};
  const rawSnap  = {};

  for (const pos of [1, 2, 3, 4]) {
    const group     = byPos[pos];
    const oldFactor = existingCal?.factors?.[pos] ?? 1.0;

    if (group.length >= MIN_SAMPLE) {
      const avgPred = group.reduce((s, g) => s + g.pred, 0) / group.length;
      const avgAct  = group.reduce((s, g) => s + g.act,  0) / group.length;
      const raw     = Math.min(CLAMP[1], Math.max(CLAMP[0], avgAct / avgPred));
      rawSnap[pos]  = +raw.toFixed(3);
      factors[pos]  = +(ALPHA * raw + (1 - ALPHA) * oldFactor).toFixed(3);

      const dir  = factors[pos] > oldFactor ? '▲' : factors[pos] < oldFactor ? '▼' : '=';
      const bias = ((raw - 1) * 100).toFixed(1);
      console.log(
        `  ${posNames[pos]} (n=${group.length}): avgPred=${avgPred.toFixed(2)} ` +
        `avgAct=${avgAct.toFixed(2)} rawBias=${bias}% ` +
        `ema: ${oldFactor} → ${factors[pos]} ${dir}`
      );
    } else {
      console.log(`  ${posNames[pos]}: only ${group.length} samples (need ${MIN_SAMPLE}), keeping ×${oldFactor}`);
      rawSnap[pos] = null;
      factors[pos] = oldFactor;
    }
  }

  // Append to rolling history (keep last 4 GWs, skip duplicates)
  const history = [...(existingCal?.history || [])];
  if (!history.find(h => h.gwId === lastGwId)) {
    history.push({ gwId: lastGwId, raw: rawSnap, ema: { ...factors } });
  }

  return {
    updatedGw: lastGwId,
    factors,
    history: history.slice(-4)
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Fetching bootstrap-static...');
  const bootstrap = await get(`${FPL}bootstrap-static/`);

  const events   = bootstrap.events.map(e => slim(e, EVENT_FIELDS));
  const teams    = bootstrap.teams.map(t => slim(t, TEAM_FIELDS));
  const elements = bootstrap.elements.map(e => slim(e, ELEMENT_FIELDS));

  const nextEv   = events.find(e => e.is_next) || events.find(e => !e.finished) || events[events.length - 1];
  const lastEv   = events.filter(e => e.finished).slice(-1)[0];
  const nextGwId = nextEv ? nextEv.id : null;
  const lastGwId = lastEv ? lastEv.id : (nextGwId ? nextGwId - 1 : null);

  let nextGwFixtures = [];
  let lastGwFixtures = [];
  let gw2Fixtures    = [];
  let gw3Fixtures    = [];

  // GW+2 and GW+3 IDs - check against the events list to avoid fetching past the season end
  const eventIds = new Set(events.map(e => e.id));
  const gw2Id    = nextGwId && eventIds.has(nextGwId + 1) ? nextGwId + 1 : null;
  const gw3Id    = nextGwId && eventIds.has(nextGwId + 2) ? nextGwId + 2 : null;

  if (nextGwId) {
    console.log(`Fetching fixtures for GW${nextGwId}...`);
    nextGwFixtures = (await get(`${FPL}fixtures/?event=${nextGwId}`)).map(f => slim(f, FIXTURE_FIELDS));
  }

  if (lastGwId && lastGwId !== nextGwId) {
    console.log(`Fetching fixtures for GW${lastGwId}...`);
    lastGwFixtures = (await get(`${FPL}fixtures/?event=${lastGwId}`)).map(f => slim(f, FIXTURE_FIELDS));
  }

  if (gw2Id) {
    console.log(`Fetching fixtures for GW${gw2Id} (3-GW plan)...`);
    try { gw2Fixtures = (await get(`${FPL}fixtures/?event=${gw2Id}`)).map(f => slim(f, FIXTURE_FIELDS)); }
    catch(e) { console.warn(`  GW${gw2Id} fixtures unavailable: ${e.message}`); }
  }

  if (gw3Id) {
    console.log(`Fetching fixtures for GW${gw3Id} (3-GW plan)...`);
    try { gw3Fixtures = (await get(`${FPL}fixtures/?event=${gw3Id}`)).map(f => slim(f, FIXTURE_FIELDS)); }
    catch(e) { console.warn(`  GW${gw3Id} fixtures unavailable: ${e.message}`); }
  }

  // Read previous cache for existing calibration state
  let existingCal = null;
  try {
    existingCal = JSON.parse(fs.readFileSync(OUT, 'utf8')).calibration || null;
  } catch (e) { /* first run or missing file - start fresh */ }

  // Compute / update calibration
  console.log('Computing calibration...');
  const calibration = await computeCalibration(elements, lastGwId, lastGwFixtures, existingCal);

  const cache = {
    updatedAt: new Date().toISOString(),
    nextGwId,
    lastGwId,
    gw2Id,
    gw3Id,
    events,
    teams,
    elements,
    nextGwFixtures,
    lastGwFixtures,
    gw2Fixtures,
    gw3Fixtures,
    calibration
  };

  fs.writeFileSync(OUT, JSON.stringify(cache));
  console.log(`Wrote ${OUT} (${Math.round(fs.statSync(OUT).size / 1024)} KB)`);

  if (calibration) {
    const f = calibration.factors;
    console.log(`Calibration factors: GKP×${f[1]} DEF×${f[2]} MID×${f[3]} FWD×${f[4]}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
