// Shareable report card for a graded car, used by phone.html and index.html.
// Draws a 1080×1350 image (fits Instagram feed, TikTok photo posts and texts) and
// hands it to the native share sheet, or downloads it + copies the link on desktop.
//
//   GMCShare.share({ year, make, model, name, rating, deal, topIssue }, { toast, track })
//     rating:   { engine, transmission, overall, ev? }
//     deal:     { label, score, badge } or null (only when the premium report is open)
//     topIssue: { label, count, recall, heading } or null (from GMCIssues.headlineIssue)
(function (root) {
  const FONT = 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
  const SCORE = { 'A+': 97, 'A': 93, 'A-': 88, 'B+': 83, 'B': 78, 'B-': 73, 'C+': 68, 'C': 63, 'C-': 58, 'D+': 53, 'D': 48, 'D-': 43, 'F': 30 };

  function tone(grade) {
    const s = SCORE[grade] ?? 60;
    if (s >= 80) return { fg: '#15803D', bg: '#DCFCE7', ring: '#86EFAC', word: 'Very Good' };
    if (s >= 65) return { fg: '#B45309', bg: '#FEF3C7', ring: '#FCD34D', word: 'Good' };
    if (s >= 50) return { fg: '#C2410C', bg: '#FFEDD5', ring: '#FDBA74', word: 'Fair' };
    return { fg: '#B91C1C', bg: '#FEE2E2', ring: '#FCA5A5', word: 'Needs Caution' };
  }
  function fitText(ctx, text, maxW, size, weight) {
    do { ctx.font = `${weight} ${size}px ${FONT}`; size -= 2; } while (ctx.measureText(text).width > maxW && size > 24);
  }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

  function link(v) {
    const q = new URLSearchParams({ year: v.year, make: v.make, model: v.model, src: 'share' });
    return `https://www.grademycar.com/phone.html?${q}`;
  }

  function draw({ name, rating, deal, topIssue }) {
    const W = 1080, H = 1350, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#F8FAFC'; ctx.fillRect(0, 0, W, H);

    // Header band
    const g = ctx.createLinearGradient(0, 0, W, 330);
    g.addColorStop(0, '#0F172A'); g.addColorStop(1, '#4338CA');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 330);
    ctx.fillStyle = '#fff'; ctx.font = `800 44px ${FONT}`;
    ctx.fillText('GradeMyCar', W / 2, 96);
    ctx.fillStyle = '#C7D2FE'; ctx.font = `700 26px ${FONT}`;
    ctx.fillText('RELIABILITY REPORT CARD', W / 2, 140);
    ctx.fillStyle = '#fff';
    fitText(ctx, name, W - 120, 72, 800);
    ctx.fillText(name, W / 2, 250);

    // Overall grade
    const t = tone(rating.overall), cy = 560;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(W / 2, cy, 185, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 30; ctx.strokeStyle = t.ring; ctx.beginPath(); ctx.arc(W / 2, cy, 170, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = t.fg; ctx.font = `900 170px ${FONT}`; ctx.textBaseline = 'middle';
    ctx.fillText(rating.overall, W / 2, cy + 8);
    ctx.textBaseline = 'alphabetic';
    ctx.font = `700 26px ${FONT}`; ctx.fillStyle = '#64748B';
    ctx.fillText('OVERALL GRADE', W / 2, cy + 240);
    ctx.font = `800 52px ${FONT}`; ctx.fillStyle = t.fg;
    ctx.fillText(t.word, W / 2, cy + 305);

    // Engine + transmission tiles
    const tiles = rating.ev ? [['Motor & Battery', rating.engine], ['Drivetrain', rating.transmission]]
                            : [['Engine', rating.engine], ['Transmission', rating.transmission]];
    const tw = 440, th = 150, ty = 930, gap = 40, tx0 = (W - (tw * 2 + gap)) / 2;
    tiles.forEach(([label, grade], i) => {
      const x = tx0 + i * (tw + gap), tn = grade ? tone(grade) : { fg: '#64748B', bg: '#F1F5F9' };
      ctx.fillStyle = '#fff'; roundRect(ctx, x, ty, tw, th, 28); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#E2E8F0'; ctx.stroke();
      ctx.textAlign = 'left'; ctx.fillStyle = '#475569'; ctx.font = `700 34px ${FONT}`;
      ctx.fillText(label, x + 36, ty + th / 2 + 12);
      ctx.fillStyle = tn.bg; roundRect(ctx, x + tw - 136, ty + 28, 104, 94, 22); ctx.fill();
      ctx.textAlign = 'center'; ctx.fillStyle = tn.fg; ctx.font = `900 52px ${FONT}`;
      ctx.fillText(grade || '—', x + tw - 84, ty + th / 2 + 19);
    });

    // Up to two lines between the tiles and the footer: deal score, #1 complaint
    const lines = [];
    if (deal) lines.push([`${deal.label}: ${deal.score}/100 · ${deal.badge}`, '#4338CA', 800]);
    if (topIssue) lines.push([`${topIssue.heading}: ${topIssue.label}${topIssue.recall ? ' (recalled)' : ''}`, '#334155', 700]);
    if (!lines.length) lines.push(['Engine & transmission reliability, graded.', '#64748B', 600]);
    const ys = lines.length === 1 ? [1155] : [1130, 1185];
    lines.forEach(([text, color, weight], i) => {
      fitText(ctx, text, W - 120, 36, weight);
      ctx.fillStyle = color;
      ctx.fillText(text, W / 2, ys[i]);
    });

    // Footer
    ctx.fillStyle = '#0F172A'; ctx.fillRect(0, H - 120, W, 120);
    ctx.fillStyle = '#fff'; ctx.font = `700 36px ${FONT}`;
    ctx.fillText('Grade any car free at grademycar.com', W / 2, H - 48);

    return new Promise(res => c.toBlob(res, 'image/png'));
  }

  // Returns 'native' | 'download' | 'cancel'
  async function share(v, { toast = () => {}, track = () => {} } = {}) {
    const blob = await draw(v);
    const fileName = `grademycar-${v.year}-${v.make}-${v.model}`.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.png';
    const file = new File([blob], fileName, { type: 'image/png' });
    const url = link(v);
    const text = `The ${v.name} got a ${v.rating.overall} for reliability on GradeMyCar. Check any car here:`;
    const base = { make: v.make, model: v.model, grade: v.rating.overall };
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `${v.name}: ${v.rating.overall}`, text: `${text} ${url}` });
        track('share_grade', Object.assign({ method: 'native' }, base));
        return 'native';
      }
    } catch (e) {
      if (e && e.name === 'AbortError') { track('share_cancel', base); return 'cancel'; }
    }
    // Desktop / no file sharing: save the image and copy the link
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    let copied = false;
    try { await navigator.clipboard.writeText(`${text} ${url}`); copied = true; } catch (e) {}
    toast(copied ? 'Image saved and link copied' : 'Image saved');
    track('share_grade', Object.assign({ method: 'download' }, base));
    return 'download';
  }

  root.GMCShare = { draw, share, link };
})(window);
