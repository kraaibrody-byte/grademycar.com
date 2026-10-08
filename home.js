// Homepage hero grader, live example cards and header shadow (index.html).
// Reads the public reliability data straight from Firebase, like phone.html does.
(function () {
  'use strict';

  const DB_URL = 'https://grademycar-default-rtdb.firebaseio.com';
  const SCORE = { 'A+': 97, 'A': 93, 'A-': 88, 'B+': 83, 'B': 78, 'B-': 73, 'C+': 68, 'C': 63, 'C-': 58, 'D+': 53, 'D': 48, 'D-': 43, 'F': 30 };
  const score = g => SCORE[g] ?? 60;
  const tone = g => { const s = score(g); return s >= 80 ? 't-good' : s >= 65 ? 't-ok' : 't-bad'; };
  const toneColor = g => ({ 't-good': '#16A34A', 't-ok': '#D97706', 't-bad': '#DC2626' })[tone(g)];
  function verdict(g) {
    const s = score(g);
    if (s >= 88) return 'Excellent reliability';
    if (s >= 78) return 'Above-average reliability';
    if (s >= 68) return 'Average reliability';
    if (s >= 55) return 'Below-average reliability';
    return 'Poor reliability';
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtMake = m => (window.formatMake ? window.formatMake(m) : m);
  const fmtModel = m => (window.formatModel ? window.formatModel(m) : m);
  const track = (name, params) => { try { window.gmcTrack && window.gmcTrack(name, params); } catch (e) {} };
  const $ = id => document.getElementById(id);

  async function getJSON(path) {
    const r = await fetch(`${DB_URL}/${path}.json`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  // Grade for one make/model/year: the model-year grade when we have one, else the model's
  function gradeFor(makeData, model, year) {
    const base = makeData?.grades?.[model];
    const y = makeData?.years?.[model]?.[year];
    if (y?.o) {
      return { engine: y.e, transmission: y.t, overall: y.o, ev: !!base?.ev, complaints: y.n, limited: !!y.l,
               yearGraded: true, issues: window.GMCIssues ? GMCIssues.parseIssues(y.i) : [] };
    }
    if (base?.overall) return { ...base, yearGraded: false, issues: [] };
    return null;
  }

  // Header shadow once the page scrolls
  const header = $('lp-header');
  if (header) {
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ── Scroll reveal ────────────────────────────────────────────────────────
  // home.css hides [data-reveal] only under html.lp-js, so if anything here fails
  // the page still shows everything.
  const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealables = document.querySelectorAll('[data-reveal], [data-reveal-children]');
  function countUp(el) {
    const target = Number(el.dataset.count);
    const fmt = n => el.dataset.format === 'k' ? `${Math.round(n / 1000)}K` : String(Math.round(n));
    if (reduceMotion) { el.textContent = fmt(target); return; }
    const start = performance.now(), dur = 1400;
    const step = t => {
      const p = Math.min(1, (t - start) / dur), eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(target * eased);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function reveal(el) {
    el.classList.add('is-in');
    el.querySelectorAll('[data-count]').forEach(countUp);
  }
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { reveal(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealables.forEach(el => io.observe(el));
  } else {
    revealables.forEach(reveal);
  }

  // ── Phone: sticky "Grade a car" once the hero is off screen ─────────────
  const sticky = $('lp-sticky-cta'), hero = $('grade'), finalCta = document.querySelector('.lp-final');
  if (sticky && hero) {
    const onScrollCta = () => {
      const pastHero = hero.getBoundingClientRect().bottom < 0;
      const atFinal = finalCta && finalCta.getBoundingClientRect().top < window.innerHeight;
      sticky.classList.toggle('show', pastHero && !atFinal);
    };
    window.addEventListener('scroll', onScrollCta, { passive: true });
    onScrollCta();
  }

  // ── Hero grader ──────────────────────────────────────────────────────────
  const form = $('hg-form');
  if (!form) return;
  const yearSel = $('hg-year'), makeSel = $('hg-make'), modelSel = $('hg-model');
  const makeCache = {};
  let shown = null; // what the result card is showing, for Share

  const now = new Date().getFullYear();
  for (let y = now + 1; y >= 1995; y--) yearSel.insertAdjacentHTML('beforeend', `<option value="${y}">${y}</option>`);

  async function loadMake(make) {
    if (!makeCache[make]) makeCache[make] = getJSON(`reliability/${encodeURIComponent(make)}`).catch(e => { delete makeCache[make]; throw e; });
    return makeCache[make];
  }

  fetch(`${DB_URL}/reliability.json?shallow=true`).then(r => r.json()).then(keys => {
    const makes = Object.keys(keys || {}).sort((a, b) => fmtMake(a).localeCompare(fmtMake(b)));
    makeSel.insertAdjacentHTML('beforeend', makes.map(k => `<option value="${esc(k)}">${esc(fmtMake(k))}</option>`).join(''));
  }).catch(() => {});

  makeSel.addEventListener('change', async () => {
    modelSel.disabled = true;
    modelSel.innerHTML = '<option value="">Loading…</option>';
    if (!makeSel.value) { modelSel.innerHTML = '<option value="">Model</option>'; return; }
    try {
      const data = await loadMake(makeSel.value);
      const models = Object.keys(data?.grades || {}).sort((a, b) => fmtModel(a).localeCompare(fmtModel(b)));
      modelSel.innerHTML = '<option value="">Model</option>' + models.map(m => `<option value="${esc(m)}">${esc(fmtModel(m))}</option>`).join('');
      modelSel.disabled = false;
    } catch (e) {
      modelSel.innerHTML = '<option value="">Couldn\'t load models</option>';
    }
  });

  function render({ year, make, model, rating }, live) {
    const name = `${year} ${fmtMake(make)} ${fmtModel(model)}`;
    shown = { year, make, model, name, rating, topIssue: rating.issues?.[0] || null, deal: null };

    $('hg-tag').textContent = live ? 'Your result' : 'Example';
    $('hg-tag').classList.toggle('live', live);
    $('hg-name').textContent = name;
    const v = $('hg-verdict');
    v.textContent = verdict(rating.overall);
    v.className = 'lp-result-verdict ' + tone(rating.overall);

    const ring = $('hg-ring'), fg = $('hg-ring-fg'), letter = $('hg-grade');
    letter.textContent = rating.overall;
    letter.className = tone(rating.overall);
    fg.style.stroke = toneColor(rating.overall);
    fg.style.strokeDashoffset = 326.7;
    ring.classList.remove('pop');
    void ring.offsetWidth; // restart the animation
    ring.classList.add('pop');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      fg.style.strokeDashoffset = String(326.7 * (1 - score(rating.overall) / 100));
    }));

    $('hg-eng-label').textContent = rating.ev ? 'Motor & battery' : 'Engine';
    $('hg-trn-label').textContent = rating.ev ? 'Drivetrain' : 'Transmission';
    for (const [id, g] of [['hg-eng', rating.engine], ['hg-trn', rating.transmission]]) {
      $(id).textContent = g || '—';
      $(id).className = 'lp-g ' + (g ? tone(g) : '');
    }

    const top = rating.issues?.[0];
    $('hg-issue').style.display = top ? '' : 'none';
    if (top) {
      $('hg-issue-text').textContent = top.label;
      $('hg-issue-meta').textContent = `${top.count.toLocaleString()} reports${top.recall ? ' · Recall issued' : ''}`;
    }

    const q = new URLSearchParams({ year, make, model, src: live ? 'home_hero' : 'home_example' });
    $('hg-full').href = `/phone.html?${q}`;
    $('hg-note').textContent = rating.yearGraded
      ? `From ${Number(rating.complaints).toLocaleString()} owner complaints filed with NHTSA for the ${year} model year${rating.limited ? '. Newer model year, so this grade may change.' : '.'}`
      : rating.source === 'nhtsa'
        ? `No grade for ${year} specifically, so this is the model's grade across ${rating.years} from NHTSA owner complaints.`
        : 'Model-level estimate across model years.';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const year = yearSel.value, make = makeSel.value, model = modelSel.value;
    if (!year || !make || !model) return;
    const card = $('hg-result');
    card.classList.add('loading');
    try {
      const rating = gradeFor(await loadMake(make), model, year);
      if (!rating) { $('hg-note').textContent = `We don't have data for the ${fmtMake(make)} ${fmtModel(model)} yet.`; return; }
      render({ year, make, model, rating }, true);
      track('hero_grade', { make, model, year: String(year), grade: rating.overall });
      if (window.innerWidth < 980) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (err) {
      $('hg-note').textContent = "Couldn't load grades. Check your connection and try again.";
    } finally {
      card.classList.remove('loading');
    }
  });

  // Live example on load (the static markup is the fallback)
  loadMake('ford').then(d => {
    const rating = gradeFor(d, 'focus', '2014');
    if (rating && !shown) render({ year: '2014', make: 'ford', model: 'focus', rating }, false);
  }).catch(() => {});

  function toast(msg) {
    let t = $('lookup-toast');
    if (!t) { t = document.createElement('div'); t.id = 'lookup-toast'; t.className = 'lookup-toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._hide); t._hide = setTimeout(() => t.classList.remove('show'), 2200);
  }
  $('hg-share').addEventListener('click', async () => {
    const v = shown || { year: '2014', make: 'ford', model: 'focus', name: '2014 Ford Focus',
                         rating: { engine: 'D', transmission: 'F', overall: 'F' }, topIssue: null, deal: null };
    const btn = $('hg-share');
    btn.disabled = true;
    try { await GMCShare.share(v, { toast, track }); } finally { btn.disabled = false; }
  });

  // ── Example cards ────────────────────────────────────────────────────────
  document.querySelectorAll('.lp-ex').forEach(async el => {
    const [make, model, year] = el.dataset.car.split('/');
    el.href = `/reliability/${el.dataset.slug}/`;
    el.classList.add('skeleton');
    el.innerHTML = `<div class="lp-ex-top"><div><div class="lp-ex-year">${esc(year)}</div><div class="lp-ex-name">${esc(el.dataset.name)}</div></div><div class="lp-ex-grade"></div></div><div class="lp-ex-issue">&nbsp;</div>`;
    try {
      const y = await getJSON(`reliability/${encodeURIComponent(make)}/years/${encodeURIComponent(model)}/${year}`);
      if (!y?.o) throw new Error('no data');
      const top = window.GMCIssues ? GMCIssues.parseIssues(y.i)[0] : null;
      el.classList.remove('skeleton');
      el.style.setProperty('--strip', toneColor(y.o));
      el.innerHTML = `
        <div class="lp-ex-top">
          <div><div class="lp-ex-year">${esc(year)} · ${esc(verdict(y.o))}</div><div class="lp-ex-name">${esc(el.dataset.name)}</div></div>
          <div class="lp-ex-grade ${tone(y.o)}">${esc(y.o)}</div>
        </div>
        <div class="lp-ex-issue">${score(y.o) >= 78
          ? `Only <b>${Number(y.n).toLocaleString()}</b> owner complaints for this model year`
          : top ? `#1 complaint: <b>${esc(top.label)}</b>${top.recall ? ' (recalled)' : ''}` : `${Number(y.n).toLocaleString()} owner complaints`}</div>`;
    } catch (e) {
      el.remove();
    }
  });
})();
