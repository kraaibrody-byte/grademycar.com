#!/usr/bin/env node
// Turns cached NHTSA complaint counts (scripts/fetch-nhtsa.js) into reliability grades.
//
//   node scripts/grade-from-nhtsa.js [cacheDir] [--report]
//
// Writes <cacheDir>/grades.json:
//   { "<make>/<model>": { model: {engine, transmission, overall, ...}, years: { "2014": {...} } } }
// which upload-grades.js pushes to Firebase.
//
// How a grade is made:
//  1. Complaint rate = complaints per 1,000 cars sold.
//  2. Each model year is ranked only against other cars of the SAME model year
//     (a 2012 Camry vs. every other 2012 car). Older cars pile up more complaints as
//     they wear out and newer ones haven't had time to, so cross-year comparisons
//     would mostly measure age.
//  3. Percentile -> letter on a fixed curve, so grades spread from A to F.
//  4. Overall = 40% engine + 40% transmission + 20% everything else.
//  5. Model grade = the model's average standing over its recent years, ranked
//     against the other models.

const fs = require('fs');
const path = require('path');
const { MODELS, FIRST_YEAR, LAST_YEAR, salesFor } = require('./nhtsa-models');
const { GROUP_NAMES } = require('./fetch-nhtsa');
const { KEYS: THEMES, ISSUE_THEMES } = require('../issue-themes');

const args = process.argv.slice(2);
const CACHE = path.resolve(args.find(a => !a.startsWith('--')) || path.join(__dirname, '..', '..', 'AI', 'nhtsa-cache'));
const REPORT = args.includes('--report');
const NOW = 2026.75; // complaints are counted up to this point (Oct 2026)

// Model years with fewer complaints than this are treated as "not enough data"
const MIN_COMPLAINTS = 8;

// Percentile (share of model-years doing better) -> letter. Best first.
const CURVE = [
  [0.15, 'A'], [0.25, 'A-'], [0.37, 'B+'], [0.49, 'B'], [0.60, 'B-'],
  [0.70, 'C+'], [0.79, 'C'], [0.86, 'C-'], [0.94, 'D'], [1.01, 'F'],
];
const letter = p => CURVE.find(([cut]) => p < cut)[1];

// Every complaint for this model/year across all its NHTSA names, each counted once
// (makers file the same complaint under several names, e.g. F-150 cab styles)
function cachedFiles(m, y, kind) {
  const files = [];
  for (const [mk, re] of m.src) {
    const dir = path.join(CACHE, kind, mk);
    if (!fs.existsSync(dir)) continue;
    for (const nm of fs.readdirSync(dir)) {
      if (!re.test(nm.replace(/_/g, '/'))) continue;
      const f = path.join(dir, nm, `${y}.json`);
      if (fs.existsSync(f)) files.push(f);
    }
  }
  return files;
}

function readCounts(m, y) {
  const seen = new Map(); // odiNumber -> [groupBits, themeBits]
  for (const f of cachedFiles(m, y, 'complaints-v3')) {
    for (const [id, bits, themes] of JSON.parse(fs.readFileSync(f, 'utf8'))) {
      const prev = seen.get(id) || [0, 0];
      seen.set(id, [prev[0] | bits, prev[1] | themes]);
    }
  }
  if (!seen.size) return null;
  const sum = { total: seen.size, themes: {} };
  for (const name of GROUP_NAMES) sum[name] = 0;
  for (const [bits, themes] of seen.values()) {
    GROUP_NAMES.forEach((name, i) => { if (bits & (1 << i)) sum[name]++; });
    THEMES.forEach((k, i) => { if (themes & (1 << i)) sum.themes[k] = (sum.themes[k] || 0) + 1; });
  }
  // Problem types a recall covered for this model year
  let recalled = 0;
  const campaigns = new Set();
  for (const f of cachedFiles(m, y, 'recalls')) {
    for (const [id, themes] of JSON.parse(fs.readFileSync(f, 'utf8'))) { campaigns.add(id); recalled |= themes; }
  }
  sum.recalls = campaigns.size;
  // Top problems: "stall:261:1,head:40:0" (key:complaints:recall issued)
  const ranked = Object.entries(sum.themes).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]);
  const top = ranked.slice(0, 4);
  // Always keep the worst engine/transmission problem: it's the one shown under the grade
  const dt = ranked.find(([k]) => ISSUE_THEMES[k].drivetrain);
  if (dt && !top.includes(dt)) top.push(dt);
  sum.issues = top
    .map(([k, n]) => `${k}:${n}:${recalled & (1 << THEMES.indexOf(k)) ? 1 : 0}`).join(',');
  return sum;
}

// Percentile of v within sorted ascending array (0 = best/lowest rate)
function pct(sorted, v) {
  let lo = 0, hi = sorted.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] < v) lo = mid + 1; else hi = mid; }
  let hi2 = lo;
  while (hi2 < sorted.length && sorted[hi2] === v) hi2++;
  return ((lo + hi2) / 2) / sorted.length;
}

// 1. Rates for every model-year with enough data
const rows = [];
for (const m of MODELS) {
  for (let y = FIRST_YEAR; y <= LAST_YEAR; y++) {
    if ((m.from && y < m.from) || (m.to && y > m.to)) continue;
    const c = readCounts(m, y);
    if (!c || c.total < MIN_COMPLAINTS) continue;
    const exposure = salesFor(m, y); // thousand cars sold that model year
    const eng = m.ev ? c.evdrive : c.engine;
    const other = Math.max(c.reliability - Math.max(eng, c.powertrain), 0);
    rows.push({ m, y, c, eng: eng / exposure, trn: c.powertrain / exposure, oth: other / exposure, newish: NOW - y < 3 });
  }
}
if (!rows.length) { console.error('No cached complaint data in', CACHE); process.exit(1); }

const sortNum = a => [...a].sort((x, y) => x - y);
const combine = (pe, pt, po) => 0.4 * pe + 0.4 * pt + 0.2 * po;
// Rank within each model-year cohort
const MIN_COHORT = 15;
const cohorts = {};
for (const r of rows) (cohorts[r.y] ||= []).push(r);
for (const [y, rs] of Object.entries(cohorts)) {
  // Thin cohorts (few models graded that year) borrow neighbours' cars for ranking
  let pool = rs;
  for (let d = 1; pool.length < MIN_COHORT && d < 4; d++) pool = rows.filter(r => Math.abs(r.y - y) <= d);
  const d = { eng: sortNum(pool.map(r => r.eng)), trn: sortNum(pool.map(r => r.trn)), oth: sortNum(pool.map(r => r.oth)) };
  for (const r of rs) {
    r.pe = pct(d.eng, r.eng); r.pt = pct(d.trn, r.trn); r.po = pct(d.oth, r.oth);
    r.score = combine(r.pe, r.pt, r.po);
  }
  const sc = sortNum(pool.map(r => combine(pct(d.eng, r.eng), pct(d.trn, r.trn), pct(d.oth, r.oth))));
  for (const r of rs) r.ps = pct(sc, r.score);
}

// 2. Grades per model-year and per model
const out = {};
for (const m of MODELS) {
  const mine = rows.filter(r => r.m === m);
  if (!mine.length) { console.warn('no data:', m.key); continue; }
  const years = {};
  for (const r of mine) {
    years[r.y] = {
      engine: letter(r.pe), transmission: letter(r.pt), overall: letter(r.ps),
      complaints: r.c.total, engineComplaints: m.ev ? r.c.evdrive : r.c.engine, transComplaints: r.c.powertrain,
      issues: r.c.issues, recalls: r.c.recalls,
      ...(r.newish ? { limited: true } : {}),
    };
  }
  // Model grade: average standing over the last ~10 model years people are shopping for
  const recent = mine.filter(r => r.y >= LAST_YEAR - 11 && !r.newish);
  const use = recent.length >= 3 ? recent : mine;
  const avg = k => use.reduce((s, r) => s + r[k], 0) / use.length;
  out[m.key] = {
    avg: { pe: avg('pe'), pt: avg('pt'), ps: avg('ps') },
    model: {
      source: 'nhtsa', years: `${Math.min(...use.map(r => r.y))}-${Math.max(...use.map(r => r.y))}`,
      complaints: use.reduce((s, r) => s + r.c.total, 0),
      ...(m.ev ? { ev: true } : {}),
    },
    years,
  };
}

// Rank models' average standings against each other
const vals = Object.values(out);
const md = { pe: sortNum(vals.map(v => v.avg.pe)), pt: sortNum(vals.map(v => v.avg.pt)), ps: sortNum(vals.map(v => v.avg.ps)) };
for (const v of vals) {
  Object.assign(v.model, { engine: letter(pct(md.pe, v.avg.pe)), transmission: letter(pct(md.pt, v.avg.pt)), overall: letter(pct(md.ps, v.avg.ps)) });
  delete v.avg;
}

fs.writeFileSync(path.join(CACHE, 'grades.json'), JSON.stringify(out, null, 1));
console.log(`Graded ${Object.keys(out).length} models, ${rows.length} model-years -> ${path.join(CACHE, 'grades.json')}`);

if (REPORT) {
  const tally = {};
  for (const v of Object.values(out)) tally[v.model.overall] = (tally[v.model.overall] || 0) + 1;
  console.log('Model overall grades:', CURVE.map(([, l]) => `${l}:${tally[l] || 0}`).join(' '));
  for (const [k, v] of Object.entries(out).sort((a, b) => a[0].localeCompare(b[0]))) {
    const ys = Object.entries(v.years).map(([y, g]) => `${String(y).slice(2)}:${g.engine}/${g.transmission}/${g.overall}`).join(' ');
    console.log(`${k.padEnd(28)} ${v.model.engine}/${v.model.transmission}/${v.model.overall}  | ${ys}`);
  }
}
