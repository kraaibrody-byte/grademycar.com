#!/usr/bin/env node
// Adds the mileage at failure to the cached complaints, from NHTSA's bulk complaint
// files (the API that fetch-nhtsa.js uses doesn't include it).
//
//   node scripts/mileage-from-nhtsa.js [cacheDir]
//
// Reads  <cacheDir>/flat/COMPLAINTS_RECEIVED_*.zip  from
//        https://static.nhtsa.gov/odi/ffdd/cmpl/ (tab-separated; field list in CMPL.txt:
//        2 = ODINO, 18 = MILES "vehicle mileage at failure")
// Writes <cacheDir>/mileage.json  { odiNumber: miles }, only for complaints in the cache.
//
// NHTSA mostly stopped filling MILES around 2021 (about 83% of 2020 complaints have it,
// 15-18% since 2022), so when it's empty we take the mileage the owner wrote in the
// complaint ("blew the head gasket at 118,000 miles"). Checked against complaints that
// have both, the text figure agrees 97-100% of the time.
// grade-from-nhtsa.js picks it up when present.

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');

const CACHE = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'AI', 'nhtsa-cache'));
const FLAT = path.join(CACHE, 'flat');
let fromForm = 0, fromText = 0;
const MAX_MILES = 500000; // anything above is a typo

// "118,000 miles", "88k miles", "mileage is 88,405", "at 101000 mi". Mentions right after
// words like warranty or purchased are skipped (those aren't the mileage at failure);
// of what's left, the highest figure is the car's mileage when it was written.
const TEXT_RE = /(?:(\d{1,3}(?:,\d{3})+|\d{4,6})|(\d{2,3})\s?k)\s*(?:miles|mi\b)|mileage(?: of| is| was|:)?\s*(?:about |approximately |around )?(\d{1,3}(?:,\d{3})+|\d{4,6})/gi;
const TEXT_SKIP = /warrant|purchas|bought|bumper|powertrain|extended|certified|cpo|lease|every|interval|per gallon|mpg|away|drove \d|trip/i;
function textMiles(t) {
  let best = 0;
  for (const m of t.matchAll(TEXT_RE)) {
    if (TEXT_SKIP.test(t.slice(Math.max(0, m.index - 40), m.index))) continue;
    const v = m[1] ? +m[1].replace(/,/g, '') : m[2] ? +m[2] * 1000 : +m[3].replace(/,/g, '');
    if (v >= 100 && v <= MAX_MILES && v > best) best = v;
  }
  return best || null;
}

// Every complaint ID we grade
const ids = new Set();
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.json')) for (const [id] of JSON.parse(fs.readFileSync(p, 'utf8'))) ids.add(String(id));
  }
})(path.join(CACHE, 'complaints-v3'));
console.log('Complaints in cache:', ids.size.toLocaleString());

function readZip(file, miles) {
  return new Promise((resolve, reject) => {
    const unzip = spawn('unzip', ['-p', file]);
    const rl = readline.createInterface({ input: unzip.stdout, crlfDelay: Infinity });
    let rows = 0;
    rl.on('line', line => {
      rows++;
      const f = line.split('\t');
      const id = f[1];
      if (!ids.has(id) || miles[id]) return; // complaints repeat once per component
      const form = Number(f[17]);
      const m = form > 0 && form <= MAX_MILES ? form : textMiles(f[19] || '');
      if (m) { miles[id] = m; m === form ? fromForm++ : fromText++; }
    });
    rl.on('close', () => resolve(rows));
    unzip.on('error', reject);
  });
}

(async () => {
  const zips = fs.readdirSync(FLAT).filter(f => /^COMPLAINTS_RECEIVED_.*\.zip$/.test(f)).sort();
  if (!zips.length) { console.error('No COMPLAINTS_RECEIVED_*.zip in', FLAT); process.exit(1); }
  const miles = {};
  fromForm = 0; fromText = 0;
  for (const z of zips) {
    const rows = await readZip(path.join(FLAT, z), miles);
    console.log(`${z}: ${rows.toLocaleString()} rows`);
  }
  const n = Object.keys(miles).length;
  fs.writeFileSync(path.join(CACHE, 'mileage.json'), JSON.stringify(miles));
  console.log(`Mileage for ${n.toLocaleString()} of ${ids.size.toLocaleString()} complaints (${Math.round(100 * n / ids.size)}%: ${fromForm.toLocaleString()} from the form, ${fromText.toLocaleString()} from the text) -> ${path.join(CACHE, 'mileage.json')}`);
})().catch(e => { console.error(e); process.exit(1); });
