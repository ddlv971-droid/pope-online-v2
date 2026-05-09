/**
 * POPE Online — App Bridge V60
 * Corrige l'URL de retour : step=2 sans draft, step=3 si draft généré
 */
(function () {
  'use strict';

  var isPrivate = /app-private/i.test(location.pathname)||
                  (document.body&&document.body.getAttribute('data-forced-space')==='private');
  var DASH = isPrivate ? 'dashboard-private.html' : 'dashboard.html';
  var space = isPrivate ? 'private' : 'public';

  function hasOutput() {
    var ids=['output','resultBody','resultText','resultCard'];
    for(var i=0;i<ids.length;i++){
      var e=document.getElementById(ids[i]);
      if(e){var t=(e.dataset&&e.dataset.raw)||e.innerText||e.textContent||'';if(t.trim().length>20)return true;}
    }
    return false;
  }

  function buildUrl() {
    return hasOutput()
      ? DASH+'?from=app&attach=last&step=3'
      : DASH+'?from=app&step=2';
  }

  function wire() {
    var url = buildUrl();
    ['v53ReturnDashboard','v53ReturnDashboardMob','v53BackToJourney',
     'resultExpertLink','resultMissionLink','topbarHomeLink','appHomeLink'].forEach(function(id){
      var a=document.getElementById(id); if(a&&a.tagName==='A') a.href=url;
    });
    document.querySelectorAll('a[href="'+DASH+'"]').forEach(function(a){ a.href=url; });
    document.querySelectorAll('.v40-topbar-btn,.v40-mobile-menu a,#v40MobileMenu a').forEach(function(a){
      if((a.getAttribute('href')||'').indexOf(DASH)===0) a.href=url;
    });
  }

  /* Intercepter setItem pour capter le dernier ID de génération */
  var orig = Storage.prototype.setItem;
  Storage.prototype.setItem = function(k,v){
    orig.apply(this,arguments);
    if(k==='pope_v54_generations'||k==='pope_v53_generations'||k==='pope_generations_v61_'+space){
      try{
        var a=JSON.parse(v);
        if(Array.isArray(a)&&a.length&&a[0].id){
          var id=String(a[0].id);
          sessionStorage.setItem('pope_v54_last_generation_id',id);
          sessionStorage.setItem('pope_v58_last_gen',id);
          sessionStorage.setItem('pope_v53_last_generation_id',id);
          setTimeout(wire,100);
        }
      }catch(e){}
    }
  };

  /* Observer le DOM pour recâbler après génération */
  var out=document.getElementById('output');
  if(out){
    var mo=new MutationObserver(function(){setTimeout(wire,300);});
    mo.observe(out,{childList:true,subtree:true,characterData:true});
  }

  function init(){
    wire();
    setTimeout(wire,600);
    setTimeout(wire,1500);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',function(){setTimeout(init,100);});
  } else { setTimeout(init,100); }

})();
