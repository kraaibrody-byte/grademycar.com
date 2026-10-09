// First-touch UTM attribution, shared by index.html and phone.html.
// Loaded in <head> so it reads the landing URL before any script rewrites it.
// The first visit that carries UTMs is kept in localStorage and never overwritten;
// GMCAttribution.params() returns it as event params to attach to sign_up.
(function(){
  var KEY='gmc_first_touch', FIELDS=['utm_source','utm_medium','utm_campaign'];
  try{
    var q=new URLSearchParams(location.search), touch={}, found=false;
    FIELDS.forEach(function(k){ var v=q.get(k); if(v){ touch[k]=v.slice(0,100); found=true; } });
    if(found && !localStorage.getItem(KEY)){
      touch.landing_page=location.pathname;
      touch.ts=Date.now();
      localStorage.setItem(KEY,JSON.stringify(touch));
    }
  }catch(e){}
  window.GMCAttribution={
    params:function(){
      try{
        var t=JSON.parse(localStorage.getItem(KEY)||'null');
        if(!t) return {};
        var out={};
        FIELDS.forEach(function(k){ if(t[k]) out['first_'+k]=t[k]; });
        if(t.landing_page) out.first_landing_page=t.landing_page;
        return out;
      }catch(e){ return {}; }
    }
  };
})();
