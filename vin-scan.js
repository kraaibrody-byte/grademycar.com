// Scan a VIN barcode with the phone's camera (door jamb, windshield or auction sticker).
// Used by dealers.html and shops.html: GMCScanVin(vin => ...) opens a full-screen camera
// view and calls back with a 17-character VIN. The barcode reader (@zxing/browser, about
// 400 KB) loads only the first time someone taps Scan, so it costs nothing otherwise.
(function (root) {
  const ZXING = 'https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/umd/zxing-browser.min.js';
  let loading = null;
  const load = () => loading || (loading = new Promise((ok, fail) => {
    if (root.ZXingBrowser) return ok();
    const s = document.createElement('script');
    s.src = ZXING; s.onload = ok; s.onerror = () => { loading = null; fail(new Error('Couldn\'t load the scanner. Check your connection.')); };
    document.head.appendChild(s);
  }));

  // Code 39 VIN labels often carry a leading "I" (import) or trailing check character
  function toVin(text) {
    const t = String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const m = t.match(/[A-HJ-NPR-Z0-9]{17}/);
    return m ? m[0] : null;
  }

  const supported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && root.isSecureContext !== false;

  function open(onVin) {
    const wrap = document.createElement('div');
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', 'Scan VIN barcode');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:100;background:#000;display:flex;flex-direction:column;font-family:Inter,-apple-system,sans-serif';
    wrap.innerHTML = `
      <div style="position:relative;flex:1;overflow:hidden">
        <video playsinline muted style="width:100%;height:100%;object-fit:cover"></video>
        <div style="position:absolute;left:6%;right:6%;top:42%;height:16%;border:3px solid #818CF8;border-radius:12px;box-shadow:0 0 0 9999px rgba(0,0,0,.45)"></div>
      </div>
      <div style="background:#0B1220;color:#E2E8F0;padding:16px 18px calc(16px + env(safe-area-inset-bottom));display:grid;gap:10px">
        <div data-s style="font-size:14px;line-height:1.45">Starting camera…</div>
        <div style="font-size:12px;color:#94A3B8">Point at the VIN barcode on the driver's door jamb, the windshield sticker or the auction label.</div>
        <button data-x style="border:0;border-radius:10px;padding:12px;font:600 15px Inter,sans-serif;background:#fff;color:#0B1220;cursor:pointer">Cancel</button>
      </div>`;
    document.body.appendChild(wrap);
    const status = t => { wrap.querySelector('[data-s]').textContent = t; };
    let controls = null, done = false;
    const close = () => {
      done = true;
      try { controls && controls.stop(); } catch (e) {}
      wrap.remove();
      document.removeEventListener('keydown', onKey);
    };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    wrap.querySelector('[data-x]').onclick = close;

    load().then(async () => {
      if (done) return;
      const reader = new root.ZXingBrowser.BrowserMultiFormatReader();
      controls = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } } },
        wrap.querySelector('video'),
        result => {
          if (done || !result) return;
          const vin = toVin(result.getText());
          if (!vin) { status('That barcode isn\'t a VIN. Try the one on the door jamb.'); return; }
          if (navigator.vibrate) navigator.vibrate(60);
          close();
          onVin(vin);
        });
      if (done) { controls.stop(); return; }
      status('Hold steady over the barcode…');
    }).catch(err => {
      const denied = err && /NotAllowed|Permission/i.test(err.name + err.message);
      status(denied ? 'Camera access is off. Allow the camera for this site in your browser settings, or type the VIN.' : (err.message || 'Couldn\'t start the camera. Type the VIN instead.'));
    });
  }

  root.GMCScanVin = Object.assign(open, { supported, toVin });
})(window);
