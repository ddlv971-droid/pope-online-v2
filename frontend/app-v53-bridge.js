// V5.3 — relie la génération au parcours dashboard et permet de joindre le draft à l’étape Documents
(function(){
  'use strict';
  var isPrivate=/app-private\.html$/i.test(location.pathname);
  var dash=isPrivate?'dashboard-private.html':'dashboard.html';
  function byId(id){return document.getElementById(id);} 
  function readGens(){try{return JSON.parse(localStorage.getItem('pope_v53_generations')||'[]');}catch(e){return[];}}
  function writeGens(arr){localStorage.setItem('pope_v53_generations',JSON.stringify(arr.slice(0,20)));}
  function val(id){var e=byId(id); return e ? (e.value||e.textContent||'').trim() : '';}
  function rawOutput(){var o=byId('output'); return o ? (o.dataset.raw || o.innerText || o.textContent || '').trim() : '';}
  function currentPayload(){
    var out=rawOutput(); if(!out) return null;
    var use=byId('usecase');
    return {id:'gen_'+Date.now(), title:val('objective')||val('context')||'Draft préparé', usecaseLabel:use?(use.options[use.selectedIndex]?.text||use.value):'Draft préparé', createdAt:new Date().toISOString(), prompt:{context:val('context'), objective:val('objective')}, result:out, source:isPrivate?'app-private':'app'};
  }
  function saveCurrent(){
    var p=currentPayload(); if(!p) return null;
    var arr=readGens();
    arr.unshift(p); writeGens(arr); sessionStorage.setItem('pope_v53_last_generation_id',p.id); return p;
  }
  function addReturnButtons(){
    var nav=document.querySelector('.v40-topbar-nav');
    if(nav && !byId('v53ReturnDashboard')){
      var a=document.createElement('a'); a.className='v40-topbar-btn'; a.id='v53ReturnDashboard'; a.href=dash+'?from=app&attach=last&step=2'; a.textContent='↩ Retour parcours';
      a.addEventListener('click',function(){saveCurrent();});
      nav.insertBefore(a,nav.firstChild);
    }
    var mob=document.getElementById('v40MobileMenu');
    if(mob && !byId('v53ReturnDashboardMob')){
      var ma=document.createElement('a'); ma.id='v53ReturnDashboardMob'; ma.href=dash+'?from=app&attach=last&step=2'; ma.textContent='↩ Retour parcours'; ma.addEventListener('click',function(){saveCurrent();}); mob.insertBefore(ma,mob.firstChild);
    }
    var mission=byId('resultMissionLink'); if(mission) mission.style.display='none';
    var expert=byId('resultExpertLink'); if(expert){ expert.href=dash+'?from=app&attach=last&step=2'; expert.addEventListener('click',function(){saveCurrent();}); }
    var next=byId('nextActions');
    if(next && !byId('v53BackToJourney')){
      var b=document.createElement('a'); b.className='v36-next-btn'; b.id='v53BackToJourney'; b.href=dash+'?from=app&attach=last&step=2';
      b.innerHTML='<span class="v36-next-btn-icon">↩</span><div class="v36-next-btn-text"><strong>Revenir au parcours</strong><span>Joindre ce draft à ma demande expert</span></div>';
      b.addEventListener('click',function(){saveCurrent();});
      var btns=next.querySelector('.v36-next-btns'); if(btns) btns.insertBefore(b,btns.firstChild);
    }
  }
  document.addEventListener('click',function(e){
    var t=e.target.closest('#btnArchiveCurrent,#btnExport,#v53BackToJourney,#v53ReturnDashboard,#v53ReturnDashboardMob'); if(t) saveCurrent();
  });
  var obs=new MutationObserver(addReturnButtons); obs.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',addReturnButtons); setTimeout(addReturnButtons,600);
})();
