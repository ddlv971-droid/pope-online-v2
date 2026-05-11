// App V5.4 — rattachement du draft au parcours dashboard
(function(){
  function isPrivate(){return /app-private\.html/i.test(location.pathname);} function dashboardUrl(){return isPrivate()?'dashboard-private.html':'dashboard.html';}
  function saveDraftToDashboard(){
    var out=document.getElementById('outputText')||document.getElementById('resultText')||document.querySelector('[data-result], .result-content, #resultCard');
    var text=(out&&(out.innerText||out.textContent)||'').trim();
    if(!text || /^Cliquez sur|^Erreur/i.test(text)) return null;
    var title=(document.getElementById('objective')?.value||document.getElementById('usecase')?.selectedOptions?.[0]?.textContent||'Draft préparé').trim();
    var rec={id:'gen_'+Date.now(),title:title,usecaseLabel:document.getElementById('usecase')?.selectedOptions?.[0]?.textContent||'Draft préparé',createdAt:new Date().toISOString(),prompt:{context:document.getElementById('context')?.value||'',objective:document.getElementById('objective')?.value||'',facts:document.getElementById('facts')?.value||''},result:text,space:isPrivate()?'private':'public'};
    try{ var arr=JSON.parse(localStorage.getItem('pope_v54_generations')||'[]'); arr.unshift(rec); localStorage.setItem('pope_v54_generations',JSON.stringify(arr.slice(0,30))); localStorage.setItem('pope_v53_generations',JSON.stringify(arr.slice(0,30))); sessionStorage.setItem('pope_v54_last_generation_id',rec.id); sessionStorage.setItem('pope_v53_last_generation_id',rec.id);}catch(e){}
    return rec;
  }
  function goBack(){ saveDraftToDashboard(); location.href=dashboardUrl()+'?from=app&attach=last&step=2'; }
  function patchHeader(){
    document.querySelectorAll('a[href="dashboard.html"],a[href="dashboard-private.html"]').forEach(function(a){ a.href=dashboardUrl()+'?from=app&attach=last&step=2'; a.textContent='↩ Retour parcours'; });
    if(!document.getElementById('v54ReturnBtn')){ var nav=document.querySelector('.v40-topbar-nav'); if(nav){ var b=document.createElement('button'); b.id='v54ReturnBtn'; b.type='button'; b.className='v40-topbar-btn'; b.textContent='↩ Retour au parcours'; b.addEventListener('click',goBack); nav.insertBefore(b,nav.firstChild); }}
    var mob=document.getElementById('v40MobileMenu'); if(mob && !document.getElementById('v54ReturnMobile')){ var a=document.createElement('a'); a.id='v54ReturnMobile'; a.href='#'; a.textContent='↩ Retour au parcours'; a.addEventListener('click',function(e){e.preventDefault();goBack();}); mob.insertBefore(a,mob.firstChild); }
  }
  document.addEventListener('click',function(e){ var b=e.target.closest('#btnGenerate,#btnArchiveCurrent'); if(b) setTimeout(saveDraftToDashboard,1500); });
  window.addEventListener('beforeunload',saveDraftToDashboard); document.addEventListener('DOMContentLoaded',patchHeader); patchHeader();
})();
