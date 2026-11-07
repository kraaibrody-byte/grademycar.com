// Live recalls and owner complaints from NHTSA for one make/model/year.
//
// NHTSA files cars under its own names (a 2012 Lexus LS is "LS460", a BMW 3 Series is
// "328I", "330I XDRIVE", ...) and answers an unknown name with HTTP 400. So we list the
// names it has for that make and year, ask for each one that belongs to this model, and
// count each recall or complaint once. `found: false` means no name matched: that is NOT
// the same as the car having no recalls, and the page must not say it is.
(function () {
  const API = 'https://api.nhtsa.gov';
  const MAX_NAMES = 16, CONCURRENCY = 3;
  const lists = {};

  async function getResults(url) {
    const r = await fetch(url);
    if (r.status === 400 || r.status === 404) return null; // NHTSA's "no such name"
    if (!r.ok) throw new Error(`NHTSA ${r.status}`);
    const j = await r.json();
    return Array.isArray(j?.results) ? j.results : [];
  }

  // Without max= the list stops after about 20 names, which can leave out the F-150
  function namesFor(make, year) {
    const k = `${make}|${year}`;
    return lists[k] ||= getResults(`${API}/products/vehicle/models?modelYear=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}&issueType=c&max=1000`)
      .then(res => [...new Set((res || []).map(r => String(r.model).trim()))]);
  }

  // The two services spell names differently: complaints want "GS350", recalls "GS 350"
  function spellings(model, names) {
    const out = new Set([model.toUpperCase()]);
    for (const n of names) {
      out.add(n);
      out.add(n.replace(/^([A-Z]+)(\d)/, '$1 $2'));
      out.add(n.replace(/^([A-Z]+) (\d)/, '$1$2'));
    }
    return [...out].slice(0, MAX_NAMES);
  }

  function belongsTo(modelKey, nhtsaName) {
    const k = modelKey.toLowerCase().trim(), n = nhtsaName.toLowerCase();
    const bare = s => s.replace(/[^a-z0-9]/g, '');
    if (k === 'silverado' && /(2500|3500)/.test(n)) return false; // our Silverado is the 1500
    if (bare(n) === bare(k) || n.startsWith(k + ' ')) return true;
    const series = k.match(/^(\d) ?series$/); // BMW "3 Series" -> 328I, 330I XDRIVE
    if (series) return new RegExp(`^${series[1]}\\d\\d`).test(n);
    const cls = k.match(/^([a-z]{1,3})-class$/); // Mercedes "C-Class" -> C300
    if (cls) return new RegExp(`^${cls[1]} ?\\d{2,3}`).test(n);
    // Short letter names carry the engine size: Lexus "LS" -> LS460
    return /^[a-z]{1,3}$/.test(k) && new RegExp(`^${k} ?\\d`).test(n);
  }

  async function collect(make, model, year, path, idKey) {
    const mk = make.toLowerCase(), names = await namesFor(mk, year);
    const queue = spellings(model, names.filter(n => belongsTo(model, n)));
    const seen = new Map();
    let found = false;
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) {
        const nm = queue.shift();
        const res = await getResults(`${API}/${path}?make=${encodeURIComponent(mk)}&model=${encodeURIComponent(nm)}&modelYear=${encodeURIComponent(year)}`);
        if (!res) continue;
        found = true;
        for (const r of res) seen.set(r[idKey], r);
      }
    }));
    return { found, results: [...seen.values()] };
  }

  const recalls = (year, make, model) => collect(make, model, year, 'recalls/recallsByVehicle', 'NHTSACampaignNumber');
  const complaints = (year, make, model) => collect(make, model, year, 'complaints/complaintsByVehicle', 'odiNumber');

  // The facts shown for a car we haven't graded, as escaped-safe plain text
  async function factsText(year, make, model) {
    const [rec, com] = await Promise.all([
      recalls(year, make, model).catch(() => null),
      complaints(year, make, model).catch(() => null),
    ]);
    if (!rec && !com) return "Couldn't reach NHTSA just now. Try again, or check the VIN at nhtsa.gov/recalls.";
    const count = (r, one, many) => r?.found ? `${r.results.length.toLocaleString()} ${r.results.length === 1 ? one : many}` : `no ${many} found`;
    const facts = `NHTSA: ${count(rec, 'recall', 'recalls')} and ${count(com, 'owner complaint', 'owner complaints')} for this model year.`;
    const miss = !rec?.found || !com?.found ? ' NHTSA may list this car under another name, so "none found" doesn\'t prove there are none.' : '';
    return `${facts}${miss} These are raw counts, not adjusted for how many were sold, so they don't compare it with other cars. Check open recalls by VIN at nhtsa.gov/recalls.`;
  }

  window.GMCNhtsa = { recalls, complaints, factsText, belongsTo };

  // The database holds several spellings of many models: real keys plus squashed aliases
  // used for matching car listings (f-150 and f150, cx-5 and cx5). Only the real grades sit
  // on the spelled-out key, so every spelling has to lead there and only that one is listed.
  const squash = m => String(m).toLowerCase().replace(/[\s.\-&]+/g, '').replace('and', '');
  const rank = m => (m.includes('&') ? 100 : 0) + (m.match(/[\s.\-]/g) || []).length;
  const SAME_CAR = { mazda: { 3: 'mazda3', 6: 'mazda6' } }; // spellings squash can't join

  function canonicalMap(make, keys) {
    const best = {};
    for (const k of keys) {
      const s = squash(k);
      if (!(s in best) || rank(k) > rank(best[s])) best[s] = k;
    }
    const same = SAME_CAR[String(make).toLowerCase()] || {};
    for (const [from, to] of Object.entries(same)) if (keys.includes(to)) best[squash(from)] = to;
    return best;
  }
  // The key whose grades apply to this spelling, or the spelling itself if we don't know it
  const canonical = (make, keys, model) => canonicalMap(make, keys)[squash(model)] || model;
  // One entry per car, for dropdowns
  const list = (make, keys) => [...new Set(Object.values(canonicalMap(make, keys)))];

  window.GMCModels = { canonical, list };
})();
