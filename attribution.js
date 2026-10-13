// First-touch UTM attribution and analytics flags, shared by index.html, phone.html
// and success.html. Loaded in <head> so it runs before Firebase Analytics reads the URL.
//
// - The first visit that carries UTMs is kept in localStorage and never overwritten;
//   GMCAttribution.params() returns it as event params to attach to sign_up.
// - utm_source spellings are normalized in the address bar before GA sees them
//   (ig, insta -> instagram; fb -> facebook), so reports show one source per platform.
// - Flags for your own devices, set by opening any page once with:
//     ?internal=1   tag all your events internal (filter them out of reports); ?internal=0 undoes it
//     ?gmc_test=1   send no analytics at all from this browser;                 ?gmc_test=0 undoes it
//     ?gmc_debug=1  show this browser's events in GA4 DebugView;               ?gmc_debug=0 undoes it
(function(){
  var KEY='gmc_first_touch', FIELDS=['utm_source','utm_medium','utm_campaign','utm_content'];
  var SOURCES={ig:'instagram',insta:'instagram','l.instagram.com':'instagram',fb:'facebook','m.facebook.com':'facebook',tt:'tiktok',yt:'youtube'};
  function get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function set(k,v){ try{ if(v===null) localStorage.removeItem(k); else localStorage.setItem(k,v); }catch(e){} }
  try{
    var u=new URL(location.href), q=u.searchParams, changed=false;
    var src=q.get('utm_source');
    if(src){
      var norm=src.trim().toLowerCase();
      norm=SOURCES[norm]||norm;
      if(norm!==src){ q.set('utm_source',norm); changed=true; }
    }
    if(q.has('internal')){ set('gmc_internal',q.get('internal')==='0'?null:'1'); q.delete('internal'); changed=true; }
    if(q.has('gmc_test')){ set('gmc_test',q.get('gmc_test')==='0'?null:'1'); q.delete('gmc_test'); changed=true; }
    if(q.has('gmc_debug')){ set('gmc_debug',q.get('gmc_debug')==='0'?null:'1'); q.delete('gmc_debug'); changed=true; }
    if(changed) history.replaceState(history.state,'',u.pathname+(q.toString()?'?'+q.toString():'')+u.hash);

    var touch={}, found=false;
    FIELDS.forEach(function(k){ var v=q.get(k); if(v){ touch[k]=v.slice(0,100); found=true; } });
    if(found && !get(KEY)){
      touch.landing_page=location.pathname;
      touch.ts=Date.now();
      set(KEY,JSON.stringify(touch));
    }
  }catch(e){}

  function cookie(name){
    var m=document.cookie.match(new RegExp('(?:^|; )'+name.replace(/[.$?*|{}()[\]\\/+^]/g,'\\$&')+'=([^;]*)'));
    return m?decodeURIComponent(m[1]):null;
  }
  var LOCAL=/^(localhost|127\.0\.0\.1|\[::1\]|)$/.test(location.hostname)||/\.(localhost|test)$/.test(location.hostname);

  window.GMCAttribution={
    params:function(){
      try{
        var t=JSON.parse(get(KEY)||'null');
        if(!t) return {};
        var out={};
        FIELDS.forEach(function(k){ if(t[k]) out['first_'+k]=t[k]; });
        if(t.landing_page) out.first_landing_page=t.landing_page;
        return out;
      }catch(e){ return {}; }
    },
    // No analytics from local testing or from a browser flagged with ?gmc_test=1
    analyticsOff:function(){ return LOCAL||get('gmc_test')==='1'; },
    internal:function(){ return get('gmc_internal')==='1'; },
    // Params added to every custom event
    common:function(){
      var o=get('gmc_internal')==='1'?{internal:'true',traffic_type:'internal'}:{};
      if(get('gmc_debug')==='1') o.debug_mode=true;
      return o;
    },
    // GA's ids for this browser, read from its cookies, so the server can report a
    // purchase as the same visitor (Measurement Protocol). Either can be null.
    gaIds:function(measurementId){
      var ga=cookie('_ga'), clientId=null, sessionId=null;
      if(ga){ var p=ga.split('.'); if(p.length>=4) clientId=p[p.length-2]+'.'+p[p.length-1]; }
      var s=cookie('_ga_'+String(measurementId||'').replace(/^G-/,''));
      if(s){ var m=s.match(/^GS\d\.\d\.s?(\d+)/); if(m) sessionId=m[1]; }
      return {clientId:clientId, sessionId:sessionId};
    }
  };
})();
