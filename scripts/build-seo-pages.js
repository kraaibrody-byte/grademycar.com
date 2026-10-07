#!/usr/bin/env node
// Builds the /reliability/ SEO pages from the live reliability data in Firebase.
//
//   node scripts/build-seo-pages.js
//
// Re-run after changing grades in Firebase, then commit the regenerated files.
// Writes reliability/<slug>/index.html, reliability/index.html, sitemap.xml.

const fs = require('fs');
const path = require('path');

const SITE = 'https://www.grademycar.com';
const DB_URL = 'https://grademycar-default-rtdb.firebaseio.com';
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'reliability');

// Common problems are part of the paid report in the app, so pages only say how
// many we track. Flip to true to publish them (more search content, less to sell).
const SHOW_ISSUES = false;

// Popular models only. [make key, model key, display make, display model]
// Keys must match Firebase; display names are what people search for.
const SEGMENTS = [
  { id: 'compact-cars', name: 'Compact Car', plural: 'compact cars', cars: [
    ['toyota', 'corolla', 'Toyota', 'Corolla'], ['honda', 'civic', 'Honda', 'Civic'],
    ['nissan', 'sentra', 'Nissan', 'Sentra'], ['hyundai', 'elantra', 'Hyundai', 'Elantra'],
    ['kia', 'forte', 'Kia', 'Forte'], ['mazda', 'mazda3', 'Mazda', 'Mazda3'],
    ['volkswagen', 'jetta', 'Volkswagen', 'Jetta'], ['subaru', 'impreza', 'Subaru', 'Impreza'],
    ['nissan', 'versa', 'Nissan', 'Versa'], ['volkswagen', 'golf', 'Volkswagen', 'Golf'],
    ['toyota', 'prius', 'Toyota', 'Prius'],
  ]},
  { id: 'midsize-cars', name: 'Midsize Car', plural: 'midsize cars', cars: [
    ['toyota', 'camry', 'Toyota', 'Camry'], ['honda', 'accord', 'Honda', 'Accord'],
    ['nissan', 'altima', 'Nissan', 'Altima'], ['hyundai', 'sonata', 'Hyundai', 'Sonata'],
    ['chevrolet', 'malibu', 'Chevrolet', 'Malibu'], ['kia', 'optima', 'Kia', 'Optima'],
    ['mazda', 'mazda6', 'Mazda', 'Mazda6'], ['ford', 'fusion', 'Ford', 'Fusion'],
    ['volkswagen', 'passat', 'Volkswagen', 'Passat'], ['nissan', 'maxima', 'Nissan', 'Maxima'],
  ]},
  { id: 'small-suvs', name: 'Subcompact SUV', plural: 'subcompact SUVs', cars: [
    ['honda', 'hr-v', 'Honda', 'HR-V'], ['nissan', 'kicks', 'Nissan', 'Kicks'],
    ['hyundai', 'kona', 'Hyundai', 'Kona'], ['kia', 'seltos', 'Kia', 'Seltos'],
    ['kia', 'soul', 'Kia', 'Soul'], ['chevrolet', 'trailblazer', 'Chevrolet', 'Trailblazer'],
    ['toyota', 'c-hr', 'Toyota', 'C-HR'], ['subaru', 'crosstrek', 'Subaru', 'Crosstrek'],
    ['jeep', 'compass', 'Jeep', 'Compass'], ['buick', 'encore', 'Buick', 'Encore'],
  ]},
  { id: 'compact-suvs', name: 'Compact SUV', plural: 'compact SUVs', cars: [
    ['toyota', 'rav4', 'Toyota', 'RAV4'], ['honda', 'cr-v', 'Honda', 'CR-V'],
    ['nissan', 'rogue', 'Nissan', 'Rogue'], ['chevrolet', 'equinox', 'Chevrolet', 'Equinox'],
    ['ford', 'escape', 'Ford', 'Escape'], ['hyundai', 'tucson', 'Hyundai', 'Tucson'],
    ['kia', 'sportage', 'Kia', 'Sportage'], ['mazda', 'cx-5', 'Mazda', 'CX-5'],
    ['subaru', 'forester', 'Subaru', 'Forester'], ['volkswagen', 'tiguan', 'Volkswagen', 'Tiguan'],
    ['jeep', 'cherokee', 'Jeep', 'Cherokee'], ['gmc', 'terrain', 'GMC', 'Terrain'],
    ['toyota', 'venza', 'Toyota', 'Venza'],
  ]},
  { id: 'midsize-suvs', name: 'Midsize SUV', plural: 'midsize SUVs', cars: [
    ['toyota', 'highlander', 'Toyota', 'Highlander'], ['honda', 'pilot', 'Honda', 'Pilot'],
    ['ford', 'explorer', 'Ford', 'Explorer'], ['jeep', 'grand cherokee', 'Jeep', 'Grand Cherokee'],
    ['chevrolet', 'traverse', 'Chevrolet', 'Traverse'], ['nissan', 'pathfinder', 'Nissan', 'Pathfinder'],
    ['hyundai', 'santa fe', 'Hyundai', 'Santa Fe'], ['hyundai', 'palisade', 'Hyundai', 'Palisade'],
    ['kia', 'sorento', 'Kia', 'Sorento'], ['kia', 'telluride', 'Kia', 'Telluride'],
    ['subaru', 'outback', 'Subaru', 'Outback'], ['subaru', 'ascent', 'Subaru', 'Ascent'],
    ['mazda', 'cx-9', 'Mazda', 'CX-9'], ['volkswagen', 'atlas', 'Volkswagen', 'Atlas'],
    ['ford', 'edge', 'Ford', 'Edge'], ['nissan', 'murano', 'Nissan', 'Murano'],
    ['honda', 'passport', 'Honda', 'Passport'], ['chevrolet', 'blazer', 'Chevrolet', 'Blazer'],
    ['dodge', 'durango', 'Dodge', 'Durango'], ['gmc', 'acadia', 'GMC', 'Acadia'],
    ['toyota', '4runner', 'Toyota', '4Runner'], ['buick', 'enclave', 'Buick', 'Enclave'],
  ]},
  { id: 'full-size-suvs', name: 'Full-Size SUV', plural: 'full-size SUVs', cars: [
    ['chevrolet', 'tahoe', 'Chevrolet', 'Tahoe'], ['chevrolet', 'suburban', 'Chevrolet', 'Suburban'],
    ['ford', 'expedition', 'Ford', 'Expedition'], ['gmc', 'yukon', 'GMC', 'Yukon'],
    ['toyota', 'sequoia', 'Toyota', 'Sequoia'], ['cadillac', 'escalade', 'Cadillac', 'Escalade'],
  ]},
  { id: 'off-road', name: 'Off-Road SUV', plural: 'off-road SUVs', cars: [
    ['jeep', 'wrangler', 'Jeep', 'Wrangler'], ['ford', 'bronco', 'Ford', 'Bronco'],
    ['toyota', '4runner', 'Toyota', '4Runner'], ['jeep', 'gladiator', 'Jeep', 'Gladiator'],
  ]},
  { id: 'full-size-trucks', name: 'Full-Size Truck', plural: 'full-size trucks', cars: [
    ['ford', 'f-150', 'Ford', 'F-150'], ['chevrolet', 'silverado', 'Chevrolet', 'Silverado'],
    ['dodge', 'ram', 'Ram', '1500'], ['gmc', 'sierra', 'GMC', 'Sierra'],
    ['toyota', 'tundra', 'Toyota', 'Tundra'],
  ]},
  { id: 'midsize-trucks', name: 'Midsize Truck', plural: 'midsize trucks', cars: [
    ['toyota', 'tacoma', 'Toyota', 'Tacoma'], ['ford', 'ranger', 'Ford', 'Ranger'],
    ['chevrolet', 'colorado', 'Chevrolet', 'Colorado'], ['nissan', 'frontier', 'Nissan', 'Frontier'],
    ['jeep', 'gladiator', 'Jeep', 'Gladiator'], ['honda', 'ridgeline', 'Honda', 'Ridgeline'],
  ]},
  { id: 'minivans', name: 'Minivan', plural: 'minivans', cars: [
    ['toyota', 'sienna', 'Toyota', 'Sienna'], ['honda', 'odyssey', 'Honda', 'Odyssey'],
    ['dodge', 'grand caravan', 'Dodge', 'Grand Caravan'], ['kia', 'carnival', 'Kia', 'Carnival'],
  ]},
  { id: 'sports-cars', name: 'Sports Car', plural: 'sports cars', cars: [
    ['ford', 'mustang', 'Ford', 'Mustang'], ['chevrolet', 'camaro', 'Chevrolet', 'Camaro'],
    ['dodge', 'charger', 'Dodge', 'Charger'], ['dodge', 'challenger', 'Dodge', 'Challenger'],
    ['subaru', 'wrx', 'Subaru', 'WRX'],
  ]},
  { id: 'luxury', name: 'Luxury Vehicle', plural: 'luxury vehicles', cars: [
    ['lexus', 'rx', 'Lexus', 'RX'], ['lexus', 'es', 'Lexus', 'ES'], ['lexus', 'nx', 'Lexus', 'NX'],
    ['bmw', '3 series', 'BMW', '3 Series'], ['bmw', '5 series', 'BMW', '5 Series'],
    ['bmw', 'x3', 'BMW', 'X3'], ['bmw', 'x5', 'BMW', 'X5'],
    ['mercedes-benz', 'c-class', 'Mercedes-Benz', 'C-Class'], ['mercedes-benz', 'e-class', 'Mercedes-Benz', 'E-Class'],
    ['mercedes-benz', 'glc', 'Mercedes-Benz', 'GLC'], ['mercedes-benz', 'gle', 'Mercedes-Benz', 'GLE'],
    ['acura', 'mdx', 'Acura', 'MDX'], ['acura', 'rdx', 'Acura', 'RDX'], ['acura', 'tlx', 'Acura', 'TLX'],
    ['audi', 'a4', 'Audi', 'A4'], ['audi', 'q5', 'Audi', 'Q5'],
  ]},
  { id: 'electric', name: 'Electric Vehicle', plural: 'electric vehicles', cars: [
    ['tesla', 'model 3', 'Tesla', 'Model 3'], ['tesla', 'model y', 'Tesla', 'Model Y'],
    ['tesla', 'model s', 'Tesla', 'Model S'], ['tesla', 'model x', 'Tesla', 'Model X'],
  ]},
];

const SCORE = { 'A+': 97, 'A': 93, 'A-': 88, 'B+': 83, 'B': 78, 'B-': 73, 'C+': 68, 'C': 63, 'C-': 58, 'D+': 53, 'D': 48, 'D-': 43, 'F': 30 };
const score = g => SCORE[g] ?? 60;
const tone = g => { const s = score(g); return s >= 80 ? 'good' : s >= 65 ? 'ok' : 'bad'; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const miles = n => Number(n).toLocaleString('en-US');
const ordinal = n => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const article = g => /^[AEF]/.test(g) ? 'an' : 'a';

function verdict(g) {
  const s = score(g);
  if (s >= 88) return 'Excellent reliability';
  if (s >= 78) return 'Above-average reliability';
  if (s >= 68) return 'Average reliability';
  return 'Below-average reliability';
}

async function loadData() {
  const r = await fetch(`${DB_URL}/reliability.json`);
  if (!r.ok) throw new Error(`Firebase fetch failed: ${r.status}`);
  return r.json();
}

// One entry per unique car; a car can sit in more than one segment (4Runner, WRX, Gladiator)
function collectCars(data) {
  const cars = new Map();
  for (const seg of SEGMENTS) {
    for (const [make, model, makeName, modelName] of seg.cars) {
      const key = `${make}/${model}`;
      const rating = data[make]?.grades?.[model];
      if (!rating?.overall) { console.warn(`skip ${key}: no grade in Firebase`); continue; }
      if (!cars.has(key)) {
        cars.set(key, {
          make, model, makeName, modelName,
          name: `${makeName} ${modelName}`,
          slug: slugify(`${makeName} ${modelName}`),
          rating, life: data[make]?.lifespan?.[model] || null, segments: [],
        });
      }
      cars.get(key).segments.push(seg);
    }
  }
  return cars;
}

function rankIn(seg, car, cars) {
  const peers = seg.cars.map(([mk, md]) => cars.get(`${mk}/${md}`)).filter(Boolean);
  const sorted = [...peers].sort((a, b) => score(b.rating.overall) - score(a.rating.overall));
  const mine = score(car.rating.overall);
  return { rank: sorted.findIndex(p => score(p.rating.overall) === mine) + 1, total: peers.length, sorted };
}

function head({ title, description, canonical, jsonld }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="GradeMyCar">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${SITE}/icon128.png">
<meta name="twitter:card" content="summary">
<link rel="icon" href="/reliability/logo.png">
<link rel="stylesheet" href="/reliability/style.css">
${jsonld.map(j => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n')}
</head>
<body>
<header class="top"><div class="wrap">
  <a class="logo" href="/"><img src="/reliability/logo.png" alt="" width="32" height="32"><b>Grade<span>MyCar</span></b></a>
  <a class="topcta" href="/phone.html?src=seo_nav">Grade a car</a>
</div></header>
`;
}

const FOOT = `<footer class="foot"><div class="wrap">
  <p>Grades are estimates for a make and model across model years, not a specific vehicle. Always get a pre-purchase inspection and check open recalls by VIN.</p>
  <p><a href="/">Home</a> · <a href="/reliability/">All reliability grades</a> · <a href="/phone.html?src=seo_foot">Grade a car</a> · <a href="/privacy.html">Privacy</a> · <a href="/terms.html">Terms</a></p>
</div></footer>
</body>
</html>
`;

function yearPicker(car, src) {
  const now = new Date().getFullYear();
  const years = [];
  for (let y = now + 1; y >= 2000; y--) years.push(`<option value="${y}"${y === now - 4 ? ' selected' : ''}>${y}</option>`);
  return `<form class="picker" action="/phone.html" method="get">
    <input type="hidden" name="make" value="${esc(car.make)}">
    <input type="hidden" name="model" value="${esc(car.model)}">
    <input type="hidden" name="src" value="${src}">
    <label>Model year <select name="year">${years.join('')}</select></label>
    <button type="submit">Grade my ${esc(car.modelName)}</button>
  </form>`;
}

function carPage(car, cars) {
  const { rating, life, name } = car;
  const seg = car.segments[0];
  const { rank, total, sorted } = rankIn(seg, car, cars);
  const eng = rating.engine, trn = rating.transmission, ovr = rating.overall;
  const v = verdict(ovr);

  let weak = '';
  if (eng && trn && score(eng) - score(trn) >= 10) weak = `The transmission (${trn}) is the weaker of its two major components, so ask for transmission service records and pay close attention to shifting on a test drive.`;
  else if (eng && trn && score(trn) - score(eng) >= 10) weak = `The engine (${eng}) is the weaker of its two major components, so ask for oil-change records and have a mechanic check for leaks and oil consumption.`;
  else if (eng && trn) weak = `Its engine (${eng}) and transmission (${trn}) grade about the same, so neither stands out as a weak point.`;

  const rankLine = total > 1
    ? `It ranks ${ordinal(rank)} of ${total} ${seg.plural} we grade.`
    : '';
  const summary = `The ${name} earns ${article(ovr)} ${ovr} overall reliability grade from GradeMyCar, with ${article(eng)} ${eng} for its engine and ${article(trn)} ${trn} for its transmission. ${rankLine} ${weak}`.replace(/\s+/g, ' ').trim();

  const lifeAnswer = life?.avgLifespan
    ? `A well-maintained ${name} typically lasts around ${miles(life.avgLifespan)} miles${life.maxReported ? `, and owners have reported examples reaching ${miles(life.maxReported)} miles` : ''}.${life.percentReach250k ? ` About ${life.percentReach250k}% reach 250,000 miles.` : ''}`
    : null;

  const faqs = [
    [`Is the ${name} reliable?`, `${v}. ${summary}`],
    [`Is the ${name} transmission reliable?`, `GradeMyCar grades the ${name} transmission ${article(trn)} ${trn} (${verdict(trn).toLowerCase()}). Reliability varies by model year, so grade the specific year you're looking at.`],
    [`Is the ${name} engine reliable?`, `GradeMyCar grades the ${name} engine ${article(eng)} ${eng} (${verdict(eng).toLowerCase()}).`],
  ];
  if (lifeAnswer) faqs.splice(1, 0, [`How many miles will a ${name} last?`, lifeAnswer]);

  const issues = life?.commonIssues || [];
  const issuesBlock = issues.length
    ? SHOW_ISSUES
      ? `<section class="card"><h2>Known ${esc(name)} problems</h2><ul>${issues.map(i => `<li>${esc(i)}</li>`).join('')}</ul></section>`
      : `<section class="card teaser"><h2>Known ${esc(name)} problems</h2>
         <p>We track ${issues.length} known problem area${issues.length > 1 ? 's' : ''} for the ${esc(name)}, including which model years they affect. They're in the full report, along with miles remaining and a deal score for the car you're looking at.</p>
         <a class="btn" href="/phone.html?year=${new Date().getFullYear() - 4}&make=${encodeURIComponent(car.make)}&model=${encodeURIComponent(car.model)}&src=seo_issues">See ${esc(car.modelName)} problems</a></section>`
    : '';

  const lifeBlock = life?.avgLifespan ? `<section class="card"><h2>How long does the ${esc(name)} last?</h2>
    <div class="stats">
      <div><b>${miles(life.avgLifespan)}</b><span>Typical lifespan (miles)</span></div>
      ${life.maxReported ? `<div><b>${miles(life.maxReported)}</b><span>Highest reported (miles)</span></div>` : ''}
      ${life.percentReach250k ? `<div><b>${life.percentReach250k}%</b><span>Reach 250,000 miles</span></div>` : ''}
    </div></section>` : '';

  const compare = car.segments.map(s => {
    const r = rankIn(s, car, cars);
    return `<section class="card"><h2>${esc(name)} vs. other ${esc(s.plural)}</h2>
    <table class="cmp"><thead><tr><th>Model</th><th>Engine</th><th>Trans.</th><th>Overall</th></tr></thead><tbody>
    ${r.sorted.map(p => `<tr${p === car ? ' class="me"' : ''}><td>${p === car ? esc(p.name) : `<a href="/reliability/${p.slug}/">${esc(p.name)}</a>`}</td>
      <td><span class="g ${tone(p.rating.engine)}">${esc(p.rating.engine || '—')}</span></td>
      <td><span class="g ${tone(p.rating.transmission)}">${esc(p.rating.transmission || '—')}</span></td>
      <td><span class="g ${tone(p.rating.overall)}">${esc(p.rating.overall)}</span></td></tr>`).join('\n')}
    </tbody></table>
    <p class="more"><a href="/reliability/#${s.id}">Most reliable ${esc(s.plural)} →</a></p></section>`;
  }).join('\n');

  const canonical = `${SITE}/reliability/${car.slug}/`;
  const title = `${name} Reliability: ${ovr} Grade, Engine ${eng}, Transmission ${trn} | GradeMyCar`;
  const description = `Is the ${name} reliable? It gets ${article(ovr)} ${ovr} overall: ${eng} engine, ${trn} transmission${life?.avgLifespan ? `, about ${miles(life.avgLifespan)}-mile lifespan` : ''}. Compare it to other ${seg.plural} and grade any model year free.`;
  const jsonld = [
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Reliability Grades', item: `${SITE}/reliability/` },
      { '@type': 'ListItem', position: 2, name: `${name} Reliability`, item: canonical },
    ]},
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  ];

  return head({ title, description, canonical, jsonld }) + `<main class="wrap">
  <nav class="crumbs"><a href="/reliability/">Reliability grades</a> › <a href="/reliability/#${seg.id}">${esc(seg.plural[0].toUpperCase() + seg.plural.slice(1))}</a> › ${esc(name)}</nav>
  <h1>${esc(name)} Reliability Grade</h1>
  <div class="row top-row">
  <section class="hero">
    <div class="big ${tone(ovr)}"><b>${esc(ovr)}</b><span>Overall</span></div>
    <div class="side">
      <p class="verdict ${tone(ovr)}">${esc(v)}</p>
      <div class="pair">
        <div><span>Engine</span><b class="g ${tone(eng)}">${esc(eng)}</b></div>
        <div><span>Transmission</span><b class="g ${tone(trn)}">${esc(trn)}</b></div>
      </div>
    </div>
  </section>
  <section class="card cta">
    <h2>Grade a specific ${esc(name)}</h2>
    <p>Reliability changes from year to year. Pick a model year to see its grade, then add mileage and price to get a deal score and estimated miles remaining.</p>
    ${yearPicker(car, 'seo_page')}
  </section>
  </div>
  <p class="lede">${esc(summary)}</p>

  <div class="row">${lifeBlock}${issuesBlock}</div>
  <div class="row">
  <div class="col">${compare}</div>
  <section class="card faq"><h2>${esc(name)} reliability FAQ</h2>
    ${faqs.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('\n')}
  </section>
  </div>
</main>
` + FOOT;
}

function hubPage(cars) {
  const canonical = `${SITE}/reliability/`;
  const title = 'Most Reliable Cars, SUVs & Trucks: Reliability Grades by Model | GradeMyCar';
  const description = 'Engine, transmission and overall reliability grades for the most popular cars, SUVs, trucks and minivans, ranked by class. Find the most reliable used car for you.';
  const sections = SEGMENTS.map(seg => {
    const peers = seg.cars.map(([mk, md]) => cars.get(`${mk}/${md}`)).filter(Boolean)
      .sort((a, b) => score(b.rating.overall) - score(a.rating.overall));
    return `<section class="card" id="${seg.id}"><h2>Most reliable ${esc(seg.plural)}</h2>
    <table class="cmp"><thead><tr><th>#</th><th>Model</th><th>Engine</th><th>Trans.</th><th>Overall</th></tr></thead><tbody>
    ${peers.map((p, i) => `<tr><td>${i + 1}</td><td><a href="/reliability/${p.slug}/">${esc(p.name)}</a></td>
      <td><span class="g ${tone(p.rating.engine)}">${esc(p.rating.engine || '—')}</span></td>
      <td><span class="g ${tone(p.rating.transmission)}">${esc(p.rating.transmission || '—')}</span></td>
      <td><span class="g ${tone(p.rating.overall)}">${esc(p.rating.overall)}</span></td></tr>`).join('\n')}
    </tbody></table></section>`;
  }).join('\n');

  const jsonld = [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url: canonical }];
  return head({ title, description, canonical, jsonld }) + `<main class="wrap">
  <h1>Car Reliability Grades by Model</h1>
  <p class="lede">Engine, transmission and overall reliability grades for the cars people are actually shopping for, ranked within each class. Tap a model for its lifespan and how it compares, or grade a specific model year in the app.</p>
  <nav class="jump">${SEGMENTS.map(s => `<a href="#${s.id}">${esc(s.plural[0].toUpperCase() + s.plural.slice(1))}</a>`).join('')}</nav>
  <div class="grid2">${sections}</div>
</main>
` + FOOT;
}

function sitemap(cars) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [`${SITE}/`, `${SITE}/phone.html`, `${SITE}/reliability/`, ...[...cars.values()].map(c => `${SITE}/reliability/${c.slug}/`)];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`;
}

(async () => {
  const data = await loadData();
  const cars = collectCars(data);

  // Clear old model pages so removed cars don't linger
  for (const entry of fs.existsSync(OUT) ? fs.readdirSync(OUT, { withFileTypes: true }) : []) {
    if (entry.isDirectory()) fs.rmSync(path.join(OUT, entry.name), { recursive: true });
  }
  fs.mkdirSync(OUT, { recursive: true });

  for (const car of cars.values()) {
    const dir = path.join(OUT, car.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), carPage(car, cars));
  }
  fs.writeFileSync(path.join(OUT, 'index.html'), hubPage(cars));
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap(cars));
  console.log(`Built ${cars.size} model pages + hub + sitemap`);
})().catch(e => { console.error(e); process.exit(1); });
