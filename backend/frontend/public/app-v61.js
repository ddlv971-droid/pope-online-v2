/* POPE Online V61 — app/app-private deviennent une extension du dashboard */
(function(){
  'use strict';
  var S=window.POPEV61State; if(!S) return;
  var $=function(id){return document.getElementById(id);};
  function val(id){var e=$(id); return e?(e.value||e.textContent||'').trim():'';}
  function output(){ var ids=['output','resultBody','resultText']; for(var i=0;i<ids.length;i++){ var e=$(ids[i]); if(e){ var t=(e.dataset&&e.dataset.raw)||e.innerText||e.textContent||''; if(t.trim()) return t.trim(); } } var card=$('resultCard'); return card?(card.innerText||'').trim():''; }
  function prefill(){ var st=S.load(), n=st.need||{}; var ctx=$('context'), obj=$('objective'); if(ctx && !ctx.value){ var parts=[]; if(st.domain) parts.push('Domaine : '+st.domain); if(n.title) parts.push('Objet : '+n.title); if(n.context) parts.push('Contexte : '+n.context); if(n.problem) parts.push('Problème : '+n.problem); if(n.objective) parts.push('Objectif : '+n.objective); if(n.constraints) parts.push('Contraintes : '+n.constraints); if(n.risks) parts.push('Points sensibles : '+n.risks); if(n.actors) parts.push('Acteurs : '+n.actors); if(n.audience) parts.push('Destinataire : '+n.audience); if(n.deadline) parts.push('Échéance : '+n.deadline); if(n.pieces) parts.push('Pièces disponibles : '+n.pieces); if(n.description) parts.push('Précisions : '+n.description); ctx.value=parts.join('\n'); }
    if(obj && !obj.value) obj.value=n.objective||n.title||''; updateReturn(false); }
  function currentGeneration(){ var out=output(); if(!out) return null; var st=S.load(), n=st.need||{}; var use=$('usecase'); return { id:'gen_'+Date.now(), title:val('objective')||n.title||'Draft préparé', usecaseLabel: use ? ((use.options&&use.selectedIndex>=0&&use.options[use.selectedIndex].text)||use.value||'Draft préparé') : 'Draft préparé', createdAt:new Date().toISOString(), result:out, domain:st.domain||'', prompt:{context:val('context'), objective:val('objective')}, source:S.isPrivate?'app-private':'app' }; }
  function saveCurrent(){ var g=currentGeneration(); if(g) return S.saveGeneration(g); return null; }
  window.POPEV61SaveCurrentGeneration=saveCurrent;
  function targetUrl(){ return S.dashUrl(2, false); }
  function updateReturn(ready){ var href=targetUrl(); ['btnRetourDashboard','v53ReturnDashboard','v53ReturnDashboardMob','resultExpertLink','resultMissionLink','v53BackToJourney'].forEach(function(id){ var a=$(id); if(a){ a.href=href; a.onclick=function(){saveCurrent(); return true;}; }}); var info=$('v58RetourInfo'); if(info){ var st=S.load(); info.textContent = output() ? 'Draft prêt et conservé : retournez à l’étape Besoin, puis cliquez sur Continuer pour le joindre.' : (st.domain ? 'Domaine : '+st.domain+' — votre contexte est conservé.' : 'Retour à votre parcours conservé.'); } var b=$('v58DraftReady'); if(b && output()) b.classList.add('visible'); }
  function fixHeaderLinks(){ var dash=S.dashUrl(2,false); document.querySelectorAll('a[href="dashboard.html"],a[href="dashboard-private.html"],#topbarHomeLink').forEach(function(a){ a.href=dash; a.addEventListener('click',function(){ saveCurrent(); }); }); }
  window.addEventListener('pope_generation_done',function(e){ if(e.detail) S.saveGeneration(e.detail); setTimeout(function(){updateReturn(true);},100); });
  document.addEventListener('click',function(e){ var a=e.target.closest('#btnRetourDashboard,#resultExpertLink,#resultMissionLink,#v53BackToJourney,#v53ReturnDashboard,#v53ReturnDashboardMob'); if(a){ saveCurrent(); } }, true);
  var obs=new MutationObserver(function(){ updateReturn(); fixHeaderLinks(); }); obs.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  function init(){ prefill(); fixHeaderLinks(); updateReturn(); setInterval(updateReturn,1500); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
