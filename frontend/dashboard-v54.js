// Dashboard V5.4 — nettoyage UX + retour draft vers parcours + aides intégrées à la description
(function(){
  function byId(id){return document.getElementById(id);} function qsa(s){return Array.prototype.slice.call(document.querySelectorAll(s));}
  function esc(s){return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function dashUrl(){return /dashboard-private\.html/i.test(location.pathname)?'dashboard-private.html':'dashboard.html';}
  function injectStyle(){ if(byId('v54style'))return; var st=document.createElement('style'); st.id='v54style'; st.textContent='.v5-top-nav a[href*="app"],.v5-top-nav a[href*="expert"],.v40-topbar-nav a[href*="app"],.v40-topbar-nav a[href*="expert"]{display:none!important}.v54-inline-help{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 10px}.v54-inline-help button{border:1px solid #d6e7f5;background:#fff;border-radius:999px;padding:8px 10px;font-size:12px;font-weight:800;cursor:pointer}.v5-helpchips{display:none!important}.v53-choice-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important;align-items:stretch!important}.v53-choice-card{min-height:105px!important;padding:16px!important;display:flex!important;gap:12px!important;align-items:flex-start!important;overflow:visible!important}.v53-choice-card input{width:auto!important;min-width:16px!important}.v53-choice-card div{white-space:normal!important;overflow:visible!important;line-height:1.35!important}.v53-choice-card span{display:block!important;margin-top:5px!important;color:#516474!important}.v5-ia-block strong::after{content:" — à joindre ensuite à l’étape Documents";font-weight:700;color:#516474}.v5-ia-block a::before{content:"↗ ";}.v54-help-chip{border:1px solid #d6e7f5;background:#fff;border-radius:999px;padding:7px 12px;font-size:12px;font-weight:700;cursor:pointer;color:#1a6fa8;transition:background .15s}.v54-help-chip:hover{background:#eaf4fd}.v5-attach-head strong{font-size:15px}@media(max-width:720px){.v53-choice-grid{grid-template-columns:1fr!important}}'; document.head.appendChild(st);}
  function ensureHelpNearDescription(){ var desc=byId('besoInDesc'); if(!desc || byId('v54InlineHelp')) return; /* v55: chips now in HTML, skip injection */ var group=desc.closest('.v5-field-group')||desc.parentElement; var help=document.createElement('div'); help.id='v54InlineHelp'; help.className='v54-inline-help'; help.innerHTML='<button type="button" data-add-need="Contexte :\nObjectif recherché :\nContraintes connues :\nÉchéance :\nDocuments disponibles :\nLivrable attendu :">➕ Trame complète</button><button type="button" data-add-need="Points de vigilance juridique / financier / organisationnel :">⚠️ Points de vigilance</button><button type="button" data-add-need="Résultat idéal attendu de l’expert :">🎯 Résultat attendu</button><button type="button" data-add-need="Questions précises à trancher :">❓ Questions à trancher</button>'; desc.after(help); }
  function improveDraftLinks(){
  qsa('a[href="app.html"],a[href="app-private.html"],a[id="lnkDraftTool"]').forEach(function(a){
    var base=a.getAttribute('href').split('?')[0];
    a.href=base+'?from=dashboard-step2';
    if(a.textContent.indexOf('→')>-1) a.textContent='Préparer un draft puis revenir →';
    a.addEventListener('click',function(){ saveStep2State(); });
  });
}
  function loadLocalGenerations(){ try{return JSON.parse(localStorage.getItem('pope_v54_generations')||localStorage.getItem('pope_v53_generations')||'[]');}catch(e){return[];} }
  function populateGenerationSelectV54(){ var sel=byId('archiveAttachSelect'); if(!sel)return; var gens=loadLocalGenerations(); var cur=sel.value||sessionStorage.getItem('pope_v54_last_generation_id')||sessionStorage.getItem('pope_v53_last_generation_id')||''; sel.innerHTML='<option value="">Ne pas joindre de draft préparé</option>'+gens.map(function(g,i){return '<option value="'+esc(g.id||i)+'">'+esc((g.title||g.usecaseLabel||'Draft préparé')+' — '+(g.createdAt?new Date(g.createdAt).toLocaleString('fr-FR'):''))+'</option>';}).join(''); if(cur) sel.value=cur; }
  function saveStep2State(){ try{ var data={domain:qsa('.v5-domain-pill.selected')[0]?.dataset.domain||'', title:byId('besoInTitle')?.value||'', desc:byId('besoInDesc')?.value||'', contexte:byId('descContexte')?.value||'', objectif:byId('descObjectif')?.value||'', contraintes:byId('descContraintes')?.value||'', acteurs:byId('descActeurs')?.value||'', deadline:byId('needDeadline')?.value||'', pieces:byId('descPieces')?.value||'', type:document.querySelector('input[name="besoType"]:checked')?.value||'conseil'}; sessionStorage.setItem('pope_v54_dashboard_state_'+dashUrl(),JSON.stringify(data)); }catch(e){} }
  function restoreStep2State(){ try{ var raw=sessionStorage.getItem('pope_v54_dashboard_state_'+dashUrl()); if(!raw)return; var d=JSON.parse(raw); if(d.domain){ qsa('.v5-domain-pill').forEach(function(b){ if(b.dataset.domain===d.domain){ b.classList.add('selected'); if(window.selectDomain) window.selectDomain(b); }}); } [['besoInTitle','title'],['besoInDesc','desc'],['descContexte','contexte'],['descObjectif','objectif'],['descContraintes','contraintes'],['descActeurs','acteurs'],['needDeadline','deadline'],['descPieces','pieces']].forEach(function(x){var e=byId(x[0]); if(e && d[x[1]]) e.value=d[x[1]];}); var r=document.querySelector('input[name="besoType"][value="'+(d.type||'conseil')+'"]'); if(r)r.checked=true; }catch(e){} }
  document.addEventListener('click',function(e){ var add=e.target.closest('[data-add-need]'); if(add){ var d=byId('besoInDesc'); if(d){ d.value=(d.value?d.value+'\n\n':'')+add.getAttribute('data-add-need'); d.focus(); saveStep2State(); }} var link=e.target.closest('a[href*="app.html"],a[href*="app-private.html"]'); if(link) saveStep2State(); });
  document.addEventListener('input',saveStep2State,true); document.addEventListener('change',function(e){ saveStep2State(); if(e.target&&e.target.id==='archiveAttachSelect') sessionStorage.setItem('pope_v54_attached_generation_id',e.target.value||''); },true);
  var oldGo=window.goStep; window.goStep=function(n){ if(oldGo) oldGo(n); setTimeout(function(){injectStyle();ensureHelpNearDescription();improveDraftLinks();if(n===3)populateGenerationSelectV54();restoreStep2State();},50); };
  document.addEventListener('DOMContentLoaded',function(){injectStyle();ensureHelpNearDescription();improveDraftLinks();restoreStep2State(); var _sp=new URLSearchParams(location.search);
    if(_sp.get('attach')==='last'){
      setTimeout(function(){
        if(window.switchTab)window.switchTab('besoin');
        // Si retour depuis app (from=app), aller à l'étape 2 pour décrire le besoin et joindre à l'étape 3
        // Si attach seul (ancien comportement), aller directement à l'étape 3
        var fromApp=_sp.get('from')==='app';
        if(window.goStep) window.goStep(fromApp ? 2 : 3);
        populateGenerationSelectV54();
        // Sauvegarder l'id de la dernière génération pour présélection à l'étape 3
        var lastGen=sessionStorage.getItem('pope_v54_last_generation_id')||sessionStorage.getItem('pope_v53_last_generation_id')||'';
        if(lastGen) sessionStorage.setItem('pope_v54_attached_generation_id',lastGen);
      },250);
    } });
  injectStyle(); setTimeout(function(){ensureHelpNearDescription();improveDraftLinks();restoreStep2State();populateGenerationSelectV54();},300);
})();
