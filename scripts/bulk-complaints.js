#!/usr/bin/env node
// Fills gaps in the API complaint cache from NHTSA's bulk complaint files.
//
//   node scripts/bulk-complaints.js [cacheDir]
//
// Reads  <cacheDir>/flat/COMPLAINTS_RECEIVED_*.zip  (https://static.nhtsa.gov/odi/ffdd/cmpl/,
//        tab-separated, one row per complaint component: 1 = ODINO, 3 = MAKETXT,
//        4 = MODELTXT, 5 = YEARTXT, 11 = COMPDESC, 19 = CDESCR, counting from 0)
// Writes <cacheDir>/complaints-bulk/<make>/<model name>/<year>.json in the same
//        [[odiNumber, groupBits, themeBits], ...] format as fetch-nhtsa.js, for every bulk
//        name one of our models matches (same src rules and year range).
//
// Why: the API misses complaints the bulk files have. Names it never lists (2000-2004
// Dodge RAM 1500), years it returns almost empty (2016 GMC Sierra 1500: 49 of 348), and
// thousands of F-150s. grade-from-nhtsa.js reads the API cache first and adds only
// complaints it lacks from here, so a complaint the API has keeps its exact parts and themes.
//
// Prints each model's coverage: the share of bulk complaints the API cache already had.
// A model under COVERAGE_WARN is listed, so a new gap shows up instead of hiding.

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');
const { MODELS, FIRST_YEAR, LAST_YEAR } = require('./nhtsa-models');
const { GROUPS, GROUP_NAMES } = require('./fetch-nhtsa');
const { themeBits } = require('../issue-themes');

const CACHE = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'AI', 'nhtsa-cache'));
const FLAT = path.join(CACHE, 'flat');
const OUT = path.join(CACHE, 'complaints-bulk');
const COVERAGE_WARN = 0.95;

const inRange = (m, y) => !((m.from && y < m.from) || (m.to && y > m.to) || m.skip?.includes(y));
const safe = name => name.replace(/[\/\\]/g, '_');

// Which of our models a bulk make/name/year belongs to (cached per make|name)
const matchCache = new Map();
function modelsFor(make, name) {
  const k = `${make}|${name}`;
  if (!matchCache.has(k)) {
    matchCache.set(k, MODELS.filter(m => m.src.some(([mk, re]) => mk.toUpperCase() === make && re.test(name))));
  }
  return matchCache.get(k);
}

function readZip(file, rows) {
  return new Promise((resolve, reject) => {
    const unzip = spawn('unzip', ['-p', file]);
    const rl = readline.createInterface({ input: unzip.stdout, crlfDelay: Infinity });
    rl.on('line', line => {
      const f = line.split('\t');
      const y = +f[5];
      if (!(y >= FIRST_YEAR && y <= LAST_YEAR)) return;
      const make = (f[3] || '').trim().toUpperCase(), name = (f[4] || '').trim().toUpperCase();
      const models = modelsFor(make, name);
      if (!models.some(m => inRange(m, y))) return;
      const key = `${make}|${name}|${y}`;
      const byId = rows.get(key) || new Map();
      rows.set(key, byId);
      const id = Number(f[1]);
      const comps = (f[11] || '').toUpperCase();
      let bits = byId.get(id)?.[0] || 0;
      GROUP_NAMES.forEach((g, i) => { if (GROUPS[g].test(comps)) bits |= 1 << i; });
      byId.set(id, [bits, byId.get(id)?.[1] ?? themeBits(f[19] || '')]);
    });
    rl.on('close', resolve);
    unzip.on('error', reject);
  });
}

// IDs the API cache has for a model/year (all its NHTSA names, all src makes)
const dirCache = {};
function apiIds(m, y) {
  const ids = new Set();
  for (const [mk, re] of m.src) {
    const dir = path.join(CACHE, 'complaints-v3', mk);
    for (const nm of (dirCache[dir] ||= fs.existsSync(dir) ? fs.readdirSync(dir) : [])) {
      if (!re.test(nm.replace(/_/g, '/'))) continue;
      const f = path.join(dir, nm, `${y}.json`);
      if (fs.existsSync(f)) for (const [id] of JSON.parse(fs.readFileSync(f, 'utf8'))) ids.add(Number(id));
    }
  }
  return ids;
}

(async () => {
  const zips = fs.readdirSync(FLAT).filter(f => /^COMPLAINTS_RECEIVED_.*\.zip$/.test(f)).sort();
  if (!zips.length) { console.error('No COMPLAINTS_RECEIVED_*.zip in', FLAT); process.exit(1); }
  const rows = new Map(); // "MAKE|NAME|YEAR" -> Map(odi -> [groupBits, themeBits])
  for (const z of zips) { await readZip(path.join(FLAT, z), rows); console.log('read', z); }

  // Written to a fresh folder, then swapped in, so a failed run leaves the old one intact
  const tmp = `${OUT}.tmp`;
  fs.rmSync(tmp, { recursive: true, force: true });
  for (const [key, byId] of rows) {
    const [make, name, y] = key.split('|');
    const file = path.join(tmp, make.toLowerCase(), safe(name), `${y}.json`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify([...byId].map(([id, [b, t]]) => [id, b, t])));
  }
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.renameSync(tmp, OUT);
  console.log(`Wrote ${rows.size} make/name/years to ${OUT}`);

  // Coverage of the API cache against the bulk files, per model
  let all = 0, got = 0;
  const low = [];
  for (const m of MODELS) {
    let bulk = 0, have = 0;
    for (let y = FIRST_YEAR; y <= LAST_YEAR; y++) {
      if (!inRange(m, y)) continue;
      const api = apiIds(m, y);
      const ids = new Set();
      for (const [key, byId] of rows) {
        const [make, name, yy] = key.split('|');
        if (+yy === y && modelsFor(make, name).includes(m)) for (const id of byId.keys()) ids.add(id);
      }
      bulk += ids.size;
      for (const id of ids) if (api.has(id)) have++;
    }
    all += bulk; got += have;
    if (bulk && have / bulk < COVERAGE_WARN) low.push(`  ${m.key}: API had ${have} of ${bulk} (${(100 * have / bulk).toFixed(1)}%)`);
  }
  console.log(`API cache had ${(100 * got / all).toFixed(2)}% of ${all.toLocaleString()} bulk complaints; the rest now come from the bulk files`);
  if (low.length) console.log(`Models under ${COVERAGE_WARN * 100}% API coverage (filled from bulk):\n${low.join('\n')}`);
})().catch(e => { console.error(e); process.exit(1); });
