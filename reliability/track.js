// Analytics for the static /reliability/ SEO pages (see ANALYTICS.md).
// Reuses the site's mechanism: /attribution.js decides whether analytics is off
// (localhost, non-grademycar.com hosts, ?gmc_test=1) and tags ?internal=1 traffic.
// Loaded as a deferred module, so it never blocks rendering. When analytics is off
// Firebase is not even downloaded; events go to the console instead.
//
// Events (GA4 property G-TT0RZ0WFN0, via Firebase):
//   page_view              automatic, sent by Firebase Analytics when it initialises
//   reliability_grade_seen model pages: the overall grade shown (make, model, grade)
//   seo_cta_click          a click or form submit that leads into the app (src, make, model)
const FIREBASE = 'https://www.gstatic.com/firebasejs/12.1.0/';
const firebaseConfig = {
  apiKey: 'AIzaSyCsVQCXfyRFt7fpcE-5Xvm_P3bULlGYMIU',
  authDomain: 'grademycar.firebaseapp.com',
  databaseURL: 'https://grademycar-default-rtdb.firebaseio.com',
  projectId: 'grademycar',
  storageBucket: 'grademycar.firebasestorage.app',
  messagingSenderId: '724919836813',
  appId: '1:724919836813:web:ca0ccd5bfe7ae3de3502c4',
  measurementId: 'G-TT0RZ0WFN0'
};

const GA = window.GMCAttribution;
const OFF = !GA || GA.analyticsOff();
let logEvent = null, analytics = null;

function track(name, params) {
  const p = Object.assign({}, params, GA ? GA.common() : {});
  if (OFF || !analytics) { if (OFF) console.debug('[GMC track]', name, p); return; }
  try { logEvent(analytics, name, p); } catch (e) {}
}

// make/model come from the app links on the page (picker form or ?make=&model= links)
function carFromPage() {
  const f = document.querySelector('form.picker');
  if (f) return { make: f.elements.make && f.elements.make.value, model: f.elements.model && f.elements.model.value };
  const a = document.querySelector('a[href*="/phone.html"][href*="make="]');
  if (a) { try { const q = new URL(a.href).searchParams; return { make: q.get('make'), model: q.get('model') }; } catch (e) {} }
  return {};
}

const car = carFromPage();
const gradeEl = document.querySelector('.hero .big b');

document.addEventListener('click', e => {
  const a = e.target.closest && e.target.closest('a[href*="/phone.html"]');
  if (!a) return;
  let src = '';
  try { src = new URL(a.href).searchParams.get('src') || ''; } catch (err) {}
  track('seo_cta_click', Object.assign({ src, page_type: gradeEl ? 'model' : 'hub' }, car.make ? car : {}));
});
document.addEventListener('submit', e => {
  const f = e.target;
  if (!f || !f.classList || !f.classList.contains('picker')) return;
  const src = f.elements.src ? f.elements.src.value : '';
  track('seo_cta_click', { src, page_type: 'model', make: car.make, model: car.model });
});

(async () => {
  if (!OFF) {
    try {
      const [{ initializeApp }, an] = await Promise.all([
        import(FIREBASE + 'firebase-app.js'),
        import(FIREBASE + 'firebase-analytics.js')
      ]);
      logEvent = an.logEvent;
      analytics = an.getAnalytics(initializeApp(firebaseConfig));
      if (GA.internal()) { try { an.setUserProperties(analytics, { internal_user: 'true' }); } catch (e) {} }
    } catch (e) { return; }
  }
  if (gradeEl) track('reliability_grade_seen', { make: car.make, model: car.model, grade: gradeEl.textContent.trim() });
})();
