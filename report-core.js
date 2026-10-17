// The customer report a shop texts from shops.html, shared by shops.html (preview)
// and r/index.html (the page the customer opens), so both always show the same thing.
// Needs issue-themes.js (window.GMCIssues) and report-core.css.
//
// A report is the shop's details plus a car: {shop, shopPhone, make, model, year, miles,
// vin6?, note?}. The grade itself always comes from reliability/{make}/years/{model}/{year}
// = {o, e, t, n, i, x, l}, never from the report.
//
// Wording rule: these are problems common on this model year, never a diagnosis of the
// customer's car. The shop's note is shown in its own box, labelled as from the shop.
(function (root) {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const cap = s => String(s).replace(/(^|[\s-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
  const NAMES = { bmw: 'BMW', gmc: 'GMC', 'cr-v': 'CR-V', 'hr-v': 'HR-V', 'cx-5': 'CX-5', 'cx-9': 'CX-9', 'c-hr': 'C-HR', 'f-150': 'F-150', rx: 'RX', es: 'ES', gs: 'GS', nx: 'NX', mdx: 'MDX', rdx: 'RDX', tlx: 'TLX', a4: 'A4', q5: 'Q5', x3: 'X3', x5: 'X5', wrx: 'WRX', glc: 'GLC', gle: 'GLE', mazda3: 'Mazda3', mazda6: 'Mazda6' };
  const pretty = s => NAMES[s] || cap(s);
  const carName = r => `${r.year} ${pretty(r.make)} ${pretty(r.model)}`;
  const gClass = g => !g ? 'na' : /^[AB]/.test(g) ? 'good' : /^C/.test(g) ? 'ok' : 'bad';
  const drivetrain = () => new Set(Object.entries(root.GMCIssues.ISSUE_THEMES).filter(([, t]) => t.drivetrain).map(([k]) => k));

  // Grade plus where these miles sit in each problem's p25–p75 owner-reported mileage
  // (why.mi, in thousands). focus = the problem to know about at this mileage, if any.
  function analyze(y, miles) {
    if (!y || !y.o) return null;
    const DT = drivetrain();
    const mi = (y.x && y.x.mi) || {};
    const k = (miles || 0) / 1000;
    const probs = root.GMCIssues.parseIssues(y.i).map(p => {
      const w = mi[p.key] || null;
      let state = null;
      if (w && miles) state = k >= w[0] && k <= w[2] ? 'in' : k < w[0] ? (w[0] - k <= 15 ? 'near' : 'before') : 'past';
      return { ...p, win: w, state, drive: DT.has(p.key) };
    });
    const order = { in: 0, near: 1 };
    const focus = probs.filter(p => p.state === 'in' || p.state === 'near')
      .sort((a, b) => (b.drive - a.drive) || (order[a.state] - order[b.state]) || b.count - a.count)[0] || null;
    return { o: y.o, e: y.e, t: y.t, n: y.n || 0, limited: !!y.l, rank: y.x && y.x.ok && y.x.c ? [y.x.ok, y.x.c] : null, probs, focus };
  }

  function winBar(w, miles) {
    if (!w) return '';
    const pct = v => Math.min(100, (v / 200) * 100);
    return `<div class="win"><div class="band" style="left:${pct(w[0])}%;width:${pct(w[2]) - pct(w[0])}%"></div>${miles ? `<div class="pin" style="left:calc(${pct(miles / 1000)}% - 1px)"></div>` : ''}</div>`;
  }
  function whereText(p, miles) {
    if (!p.win) return '<div class="where">Not enough mileage reports to show when it usually happens.</div>';
    const [p25, med, p75] = p.win, k = Math.round(miles / 1000);
    const s = {
      in: `Owners usually report this at ${p25}–${p75}k miles. This car is at ${k}k, inside that range.`,
      near: `Owners usually report this at ${p25}–${p75}k miles. This car is at ${k}k, just before that range.`,
      before: `Owners usually report this at ${p25}–${p75}k miles (median ${med}k). This car is at ${k}k.`,
      past: `Owners usually report this at ${p25}–${p75}k miles. This car is at ${k}k, past that range.`,
    }[p.state];
    return `<div class="where ${p.state}">${s}</div>`;
  }

  // The report page body. r: the report; y: that model year's grade data.
  function reportHTML(r, y) {
    const a = analyze(y, r.miles);
    const name = carName(r), shop = esc(r.shop || 'Your mechanic');
    const head = `<div class="rp-shop"><div><b>${shop}</b><small>Sent you this reliability report</small></div><span class="gm">GradeMyCar</span></div>`;
    if (!a) return `${head}<div class="rp-body"><h2>${esc(name)}</h2><div class="rcard">We don't have a grade for this model year yet.</div></div>`;
    const focusLine = a.focus ? `<b>${esc(a.focus.label)}</b> is the one to know about at this mileage.`
      : 'None of the common problems for this model year usually show up at this mileage.';
    const recalled = a.probs.some(p => p.recall);
    const tel = String(r.shopPhone || '').replace(/[^\d+]/g, '');
    return `${head}<div class="rp-body">
      <div><div class="rp-sub">${Number(r.miles).toLocaleString()} miles${r.vin6 ? ' · VIN ending ' + esc(r.vin6) : ''}</div><h2>${esc(name)}</h2></div>
      ${r.note ? `<div class="note-shop"><small>Note from ${shop}</small>${esc(r.note)}</div>` : ''}
      <div class="rcard">
        <div class="circles"><div><span class="gc ${gClass(a.e)}">${esc(a.e)}</span>Engine</div><div><span class="gc ${gClass(a.t)}">${esc(a.t)}</span>Transmission</div><div><span class="gc ${gClass(a.o)}">${esc(a.o)}</span>Overall</div></div>
        <div class="rank">Grade for the ${esc(r.year)} model year, from ${a.n.toLocaleString()} owner complaints to NHTSA${a.rank ? `. Ranked #${a.rank[0]} of ${a.rank[1]} ${esc(r.year)} vehicles (1 = fewest complaints per car sold)` : ''}.${a.limited ? ' This year has limited data so far.' : ''}</div>
      </div>
      <div class="rcard">
        <div class="rsec">Problems common on this model year</div>
        <div class="rfine">${focusLine}</div>
        <div class="legend"><span><i></i>Where most owners report it</span><span><i class="p"></i>This car's miles</span></div>
        ${a.probs.map(p => `<div class="prob"><div class="h"><span>${esc(p.label)}${p.recall ? '<span class="badge">Recall</span>' : ''}</span><small>${p.count.toLocaleString()} reports</small></div>
          ${p.win ? winBar(p.win, r.miles) + '<div class="scale"><span>0</span><span>100k</span><span>200k</span></div>' : ''}${whereText(p, r.miles)}</div>`).join('') || '<div class="where">No common problems reported.</div>'}
      </div>
      ${recalled ? `<div class="rcard rsmall"><b>Recalls were issued</b> for problems marked Recall. Ask ${shop} or any dealer to check open recalls on this VIN, or look it up at <a href="https://www.nhtsa.gov/recalls" target="_blank" rel="noopener">nhtsa.gov/recalls</a>. Recall repairs are free.</div>` : ''}
      ${tel ? `<a class="rp-call" href="tel:${esc(tel)}">Call ${shop}</a>` : ''}
      <div class="rfine">This is not a diagnosis of this car. It shows what owners of the ${esc(name)} commonly report to NHTSA, so you can see the pattern behind your mechanic's advice. ${shop} does not pay to change grades, and can't. More at <a href="https://grademycar.com" target="_blank" rel="noopener">grademycar.com</a>.</div>
    </div>`;
  }

  // What the tech checks in the bay, in the order owners report problems. Not sent to the customer.
  function bayHTML(r, y) {
    const a = analyze(y, r.miles);
    if (!a) return '';
    return a.probs.map(p => `<label class="chk"><input type="checkbox"><div><b>${esc(p.label)}</b>${p.state === 'in' ? ' <span class="pill ok">In usual mileage</span>' : p.state === 'near' ? ' <span class="pill">Just before usual mileage</span>' : ''}${p.recall ? ' <span class="badge">Recall</span>' : ''}<div class="sub">${esc(p.tip || '')}</div></div></label>`).join('');
  }

  root.GMCReport = { analyze, reportHTML, bayHTML, carName, pretty, gClass, esc };
})(typeof window !== 'undefined' ? window : globalThis);
