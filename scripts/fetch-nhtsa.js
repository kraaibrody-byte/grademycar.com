#!/usr/bin/env node
// Downloads NHTSA owner-complaint counts for every model in nhtsa-models.js.
//
//   node scripts/fetch-nhtsa.js [cacheDir]
//
// Saves complaint IDs and which part groups they mention (not complaint text) to
// <cacheDir>/complaints-v2/<make>/<model>/<year>.json. Cached files are skipped, so
// re-runs only fetch what's missing. Delete the cache to pull fresh numbers.

const fs = require('fs');
const path = require('path');
const { MODELS, FIRST_YEAR, LAST_YEAR } = require('./nhtsa-models');
const { themeBits } = require('../issue-themes');

const CACHE = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'AI', 'nhtsa-cache'));
const API = 'https://api.nhtsa.gov';
const CONCURRENCY = 4;

// Complaint groups (a complaint counts once per group even if it lists several parts)
const GROUPS = {
  engine: /ENGINE|FUEL\/PROPULSION|FUEL SYSTEM|HYBRID PROPULSION/,
  powertrain: /POWER TRAIN/,
  evdrive: /HYBRID PROPULSION|ELECTRICAL SYSTEM|FUEL\/PROPULSION/,
  reliability: /ENGINE|FUEL|POWER TRAIN|HYBRID|ELECTRICAL|STEERING|SUSPENSION|SERVICE BRAKES|VEHICLE SPEED CONTROL|ELECTRONIC STABILITY|STRUCTURE|LATCHES|VISIBILITY|EXTERIOR LIGHTING|BACK OVER|FORWARD COLLISION|LANE DEPARTURE|PARKING BRAKE/,
};
const GROUP_NAMES = Object.keys(GROUPS); // bit i of a complaint's flags = GROUP_NAMES[i]

const sleep = ms => new Promise(res => setTimeout(res, ms));
async function getJSON(url, tries = 8) {
  for (let i = 0; i < tries; i++) {
    try {
      // NHTSA's firewall rejects Node's default user agent with 403
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh) GradeMyCar-data/1.0', Accept: 'application/json' } });
      if (r.status === 400 || r.status === 404) return { results: [] }; // NHTSA's "no data"
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      await sleep(250);
      return j;
    } catch (e) {
      if (i === tries - 1) throw new Error(`${url}: ${e.message}`);
      // 403 = rate limited; back off hard
      await sleep((/403/.test(e.message) ? 30000 : 3000) * (i + 1));
    }
  }
}

async function cached(file, fn) {
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const v = await fn();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(v));
  return v;
}

async function pool(items, fn) {
  let i = 0, done = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (i < items.length) {
      const item = items[i++];
      await fn(item);
      if (++done % 50 === 0) console.log(`  ${done}/${items.length}`);
    }
  });
  await Promise.all(workers);
}

// NHTSA model names a make has complaints for in a given year
function modelNames(make, year) {
  return cached(path.join(CACHE, 'models', make, `${year}.json`), async () => {
    const j = await getJSON(`${API}/products/vehicle/models?modelYear=${year}&make=${encodeURIComponent(make)}&issueType=c`);
    return [...new Set((j.results || []).map(r => r.model.trim().toUpperCase()))];
  });
}

// Complaints for one NHTSA make/model/year, as [[odiNumber, groupBits, themeBits], ...]
// (themeBits = problem types the owner describes, see issue-themes.js).
// IDs are kept because makers file one complaint under several model names
// (F-150 SUPER CREW / SUPERCAB / REGULAR CAB), and the grader must count it once.
function complaintIds(make, model, year) {
  const file = path.join(CACHE, 'complaints-v3', make, model.replace(/[\/\\]/g, '_'), `${year}.json`);
  return cached(file, async () => {
    const j = await getJSON(`${API}/complaints/complaintsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${year}`);
    return (j.results || []).map(c => {
      const comps = String(c.components || '').toUpperCase();
      let bits = 0;
      GROUP_NAMES.forEach((name, i) => { if (GROUPS[name].test(comps)) bits |= 1 << i; });
      return [c.odiNumber, bits, themeBits(c.summary)];
    });
  });
}


// Recalls for one NHTSA make/model/year, as [[campaignNumber, themeBits], ...]
function recallIds(make, model, year) {
  const file = path.join(CACHE, 'recalls', make, model.replace(/[\/\\]/g, '_'), `${year}.json`);
  return cached(file, async () => {
    const j = await getJSON(`${API}/recalls/recallsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${year}`);
    return (j.results || []).map(r => [r.NHTSACampaignNumber, themeBits(`${r.Component} ${r.Summary} ${r.Consequence}`)]);
  });
}

module.exports = { GROUP_NAMES };
if (require.main !== module) return;

(async () => {
  console.log('Cache:', CACHE);
  const makes = [...new Set(MODELS.flatMap(m => m.src.map(s => s[0])))];
  const years = [];
  for (let y = FIRST_YEAR; y <= LAST_YEAR; y++) years.push(y);

  console.log(`Step 1: model names for ${makes.length} makes × ${years.length} years`);
  const names = {};
  await pool(makes.flatMap(mk => years.map(y => [mk, y])), async ([mk, y]) => {
    (names[mk] ||= {})[y] = await modelNames(mk, y);
  });

  // Every NHTSA make/model/year that belongs to one of our models
  const jobs = [];
  const unmatched = [];
  for (const m of MODELS) {
    let hits = 0;
    for (const y of years) {
      if ((m.from && y < m.from) || (m.to && y > m.to)) continue;
      for (const [mk, re] of m.src) {
        for (const nm of names[mk][y] || []) if (re.test(nm)) { jobs.push([mk, nm, y]); hits++; }
      }
    }
    if (!hits) unmatched.push(m.key);
  }
  if (unmatched.length) console.warn('No NHTSA names matched:', unmatched.join(', '));

  console.log(`Step 2: complaint counts for ${jobs.length} make/model/years`);
  await pool(jobs, ([mk, nm, y]) => complaintIds(mk, nm, y));
  console.log(`Step 3: recalls for ${jobs.length} make/model/years`);
  await pool(jobs, ([mk, nm, y]) => recallIds(mk, nm, y));
  console.log('Done');
})().catch(e => { console.error(e); process.exit(1); });

