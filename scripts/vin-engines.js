#!/usr/bin/env node
// Works out which engine each cached complaint's car has, from the partial VIN in
// NHTSA's bulk complaint files (the API that fetch-nhtsa.js uses doesn't include it).
//
//   node scripts/vin-engines.js [cacheDir]
//
// Reads  <cacheDir>/flat/COMPLAINTS_RECEIVED_*.zip (field 14 = VIN, counting from 0).
//        NHTSA keeps only the first 11 characters: maker, model/engine codes, check
//        digit, model year and plant. That's enough to decode the engine about 90% of
//        the time; the serial number it leaves out doesn't matter.
// Writes <cacheDir>/vins.json        { odiNumber: "1FMCU0GX*D" } (positions 1-8, then the year)
//        <cacheDir>/vin-decode.json  { "1FMCU0GX*D": { l: "1.6", c: 4 } }  (l = liters, "" if unknown)
//
// Owners stopped filling in the bulk files' own cylinders/drivetrain fields around 2009,
// so the VIN is the only engine information left. Patterns are decoded with NHTSA's vPIC
// batch decoder, 50 per request; decodes are cached, so re-runs only ask for new ones.
// grade-from-nhtsa.js picks both files up when present.

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');

const CACHE = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'AI', 'nhtsa-cache'));
const FLAT = path.join(CACHE, 'flat');
const VINS = path.join(CACHE, 'vins.json');
const DECODE = path.join(CACHE, 'vin-decode.json');
const VPIC = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVINValuesBatch/';
const BATCH = 50;

// Positions 1-8 and 10 (the model year). The check digit (9) and plant (11) don't
// change the engine, and dropping them shrinks ~800k VINs to ~40k patterns.
const VIN_RE = /^[A-HJ-NPR-Z0-9]{11}$/;
const patternOf = v => (VIN_RE.test(v) ? v.slice(0, 8) + '*' + v[9] : null);

// Every complaint ID we grade
const ids = new Set();
for (const kind of ['complaints-v3', 'complaints-bulk']) {
  const root = path.join(CACHE, kind);
  if (!fs.existsSync(root)) continue;
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.json')) for (const [id] of JSON.parse(fs.readFileSync(p, 'utf8'))) ids.add(String(id));
    }
  })(root);
}

function readZip(file, vins) {
  return new Promise((resolve, reject) => {
    const unzip = spawn('unzip', ['-p', file]);
    const rl = readline.createInterface({ input: unzip.stdout, crlfDelay: Infinity });
    rl.on('line', line => {
      const f = line.split('\t');
      const id = f[1];
      if (!ids.has(id) || vins[id]) return;
      const p = patternOf((f[14] || '').trim().toUpperCase());
      if (p) vins[id] = p;
    });
    rl.on('close', resolve);
    unzip.on('error', reject);
  });
}

const sleep = ms => new Promise(res => setTimeout(res, ms));
async function decodeBatch(patterns) {
  // vPIC wants 17 characters; * marks the positions we don't have
  const body = 'format=json&data=' + encodeURIComponent(patterns.map(p => p + '*******').join(';'));
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(VPIC, {
        method: 'POST', body,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0 (Macintosh) GradeMyCar-data/1.0' },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const res = (await r.json()).Results || [];
      if (res.length !== patterns.length) throw new Error(`asked ${patterns.length}, got ${res.length}`);
      return res;
    } catch (e) {
      if (i >= 5) throw e;
      await sleep(3000 * (i + 1));
    }
  }
}

// Same rule as engineText() in phone.html: the cc figure is the most reliable size
function liters(x) {
  const cc = Number(x.DisplacementCC) > 0 ? Number(x.DisplacementCC) / 1000 : null;
  const l = Number(x.DisplacementL) > 0 ? Number(x.DisplacementL) : null;
  const v = cc ?? l;
  return v ? v.toFixed(1) : '';
}

(async () => {
  const zips = fs.readdirSync(FLAT).filter(f => /^COMPLAINTS_RECEIVED_.*\.zip$/.test(f)).sort();
  if (!zips.length) { console.error('No COMPLAINTS_RECEIVED_*.zip in', FLAT); process.exit(1); }
  console.log('Complaints in cache:', ids.size.toLocaleString());

  const vins = {};
  for (const z of zips) { await readZip(path.join(FLAT, z), vins); console.log('read', z); }
  fs.writeFileSync(VINS, JSON.stringify(vins));
  const n = Object.keys(vins).length;
  console.log(`Usable VIN for ${n.toLocaleString()} of ${ids.size.toLocaleString()} complaints (${Math.round(100 * n / ids.size)}%) -> ${VINS}`);

  const decoded = fs.existsSync(DECODE) ? JSON.parse(fs.readFileSync(DECODE, 'utf8')) : {};
  const todo = [...new Set(Object.values(vins))].filter(p => !decoded[p]);
  console.log(`${Object.keys(decoded).length.toLocaleString()} patterns already decoded, ${todo.length.toLocaleString()} to go`);
  const save = () => { fs.writeFileSync(`${DECODE}.tmp`, JSON.stringify(decoded)); fs.renameSync(`${DECODE}.tmp`, DECODE); };
  for (let i = 0; i < todo.length; i += BATCH) {
    const chunk = todo.slice(i, i + BATCH);
    const res = await decodeBatch(chunk);
    chunk.forEach((p, k) => { decoded[p] = { l: liters(res[k]), c: Number(res[k].EngineCylinders) || 0 }; });
    if ((i / BATCH) % 20 === 19) { save(); console.log(`  ${i + chunk.length}/${todo.length}`); }
    await sleep(200);
  }
  save();
  const known = Object.values(decoded).filter(d => d.l).length;
  console.log(`Engine size known for ${known.toLocaleString()} of ${Object.keys(decoded).length.toLocaleString()} patterns -> ${DECODE}`);
})().catch(e => { console.error(e); process.exit(1); });
