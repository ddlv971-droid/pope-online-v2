/* POPE Online V61 — correctif réel dashboards public/privé */
(function(){
  'use strict';
  var S = window.POPEV61State; if(!S) return;
  var $ = function(id){ return document.getElementById(id); };
  var $$ = function(sel){ return Array.prototype.slice.call(document.querySelectorAll(sel)); };
  function val(id){ var e=$(id); return e ? (e.value||'') : ''; }
  function setVal(id,v){ var e=$(id); if(e && v !== undefined && v !== null) e.value = v; }
  function currentStep(){ var p=$$('.v5-step-panel').find(function(x){return x.classList.contains('active');}); return p ? parseInt(p.id.replace('step-panel-',''),10) : (S.load().step||1); }
  function collectNeed(){ return {
    title: val('besoInTitle'), context: val('descContexte'), problem: val('descProbleme'), objective: val('descObjectif'), decision: val('descDecision'), deliverable: val('descLivrable'), constraints: val('descContraintes'), risks: val('descRisques'), actors: val('descActeurs'), audience: val('descPublic'), deadline: val('needDeadline'), pieces: val('descPieces'), detailLevel: val('descNiveau'), description: val('besoInDesc'), urgency: val('needUrgency'), sensitivity: val('needSensitivity'), treatment: (document.querySelector('input[name="besoType"]:checked')||{}).value || 'conseil' }; }
  function saveState(extra){
    var pill = $$('.v5-domain-pill.selected')[0];
    var st = S.load();
    var domain = (pill && pill.dataset.domain) || window._domain || st.domain || '';
    var icon = pill ? (pill.textContent.trim().split(/\s+/)[0] || '🎯') : (st.domainIcon || '🎯');
    return S.save(Object.assign({ step: currentStep(), domain: domain, domainIcon: icon, need: collectNeed(), scrollY: window.scrollY || 0 }, extra||{}));
  }
  window.saveDashboardState = saveState;
  function ensureStyles(){ if($('v61-style')) return; var css=document.createElement('style'); css.id='v61-style'; css.textContent = `
    .v61-domain-banner{display:flex;align-items:center;gap:10px;margin:0 0 16px;padding:13px 16px;border:1px solid rgba(0,121,193,.22);border-radius:16px;background:linear-gradient(135deg,#f0f8ff,#fff);box-shadow:0 10px 26px rgba(15,23,42,.06);color:#0b2440;font-weight:900}
    .v61-domain-banner small{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:#64748b;font-weight:800;margin-bottom:2px}.v61-domain-banner .name{font-size:15px}.v61-domain-banner .change{margin-left:auto;border:1px solid #dbeafe;background:#fff;color:#0079c1;border-radius:999px;padding:7px 11px;font-weight:800;cursor:pointer}
    .v60-draft-card{border:1px solid #dbeafe;background:#fff;border-radius:16px;padding:14px;margin:10px 0;box-shadow:0 8px 24px rgba(15,23,42,.05);cursor:pointer}.v60-draft-card.selected{border-color:#0079c1;background:#f0f8ff}.v60-draft-card-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.v60-draft-card-title{font-weight:900;color:#0b2440}.v60-draft-card-meta{font-size:12px;color:#64748b}.v60-draft-card-preview{font-size:13px;color:#334155;line-height:1.5;margin-top:8px}.v60-draft-card-btn{margin-top:10px;border:0;background:#0079c1;color:#fff;border-radius:999px;padding:8px 12px;font-weight:800;cursor:pointer}
    .v61-empty{border:1px dashed #cbd5e1;background:#f8fafc;border-radius:16px;padding:18px;color:#64748b;font-size:13px}.v61-doc-row{display:flex;gap:10px;align-items:center;border:1px solid #e2e8f0;border-radius:12px;padding:10px;background:#fff;margin-top:8px}.v61-doc-row button{margin-left:auto;border:0;background:#fee2e2;color:#991b1b;border-radius:8px;padding:6px 9px;cursor:pointer}.v61-upload input{width:100%;border:1px solid #dbeafe;border-radius:12px;padding:10px;background:#fff}
  `; document.head.appendChild(css); }
  function domainBannerHTML(domain, icon){ return '<div class="v61-domain-banner" data-v61-domain-banner><span style="font-size:22px">'+(icon||'🎯')+'</span><div><small>Domaine sélectionné</small><div class="name">'+escapeHtml(domain||'Aucun domaine sélectionné')+'</div></div><button class="change" type="button" data-v61-gostep="1">Changer</button></div>'; }
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function renderDomainBanners(){
    var st=S.load(); var domain=st.domain||window._domain||''; if(!domain) return;
    [2,3,4].forEach(function(n){ var panel=$('step-panel-'+n); if(!panel) return; var head=panel.querySelector('.v5-panel-head') || panel; var old=panel.querySelector('[data-v61-domain-banner]'); if(old) old.remove(); head.insertAdjacentHTML('afterbegin', domainBannerHTML(domain, st.domainIcon)); });
    var oldName=$('v58DomainName'); if(oldName) oldName.textContent=domain; var oldBadge=$('v58DomainBadge'); if(oldBadge){ oldBadge.classList.add('visible'); oldBadge.style.display='flex'; }
  }
  function restore(){
    var st=S.load();
    if(st.domain){ window._domain=st.domain; $$('.v5-domain-pill').forEach(function(b){ b.classList.toggle('selected', b.dataset.domain===st.domain); }); }
    var n=st.need||{}; setVal('besoInTitle',n.title); setVal('descContexte',n.context); setVal('descProbleme',n.problem); setVal('descObjectif',n.objective); setVal('descDecision',n.decision); setVal('descLivrable',n.deliverable); setVal('descContraintes',n.constraints); setVal('descRisques',n.risks); setVal('descActeurs',n.actors); setVal('descPublic',n.audience); setVal('needDeadline',n.deadline); setVal('descPieces',n.pieces); setVal('descNiveau',n.detailLevel); setVal('besoInDesc',n.description); setVal('needUrgency',n.urgency); setVal('needSensitivity',n.sensitivity); if(n.treatment){ var r=document.querySelector('input[name="besoType"][value="'+n.treatment+'"]'); if(r) r.checked=true; }
    renderDomainBanners(); refreshDrafts(); return st;
  }
  window.restoreDashboardState = restore;
  function setStep(n, opts){
    opts=opts||{}; if(!opts.noRestore) restore();
    if(n>1 && !(S.load().domain || window._domain)){ n=1; }
    $$('.v5-step-panel').forEach(function(p){ p.classList.toggle('active', p.id==='step-panel-'+n); });
    $$('.v5-step').forEach(function(s){ var sn=parseInt(s.dataset.step,10); s.classList.toggle('active', sn===n); s.classList.toggle('done', sn<n); });
    if(window.switchTab) { try{ window.switchTab('besoin'); }catch(e){} }
    S.save({step:n, scrollY:0, need:collectNeed(), domain: window._domain || S.load().domain || '', domainIcon:S.load().domainIcon||'🎯'});
    renderDomainBanners(); if(n===3) refreshDrafts(); if(n===4 && window.updateRecap) try{ window.updateRecap(); }catch(e){}
    setTimeout(function(){ window.scrollTo({top:0,behavior:'smooth'}); },20);
  }
  window.goStep = function(n){ setStep(parseInt(n,10)||1); };
  window.forceStep = window.goStep;
  window.selectDomain = function(btn){
    $$('.v5-domain-pill').forEach(function(b){ b.classList.remove('selected'); });
    btn.classList.add('selected');
    window._domain = btn.dataset.domain || btn.getAttribute('data-domain') || btn.textContent.trim();
    var icon = btn.textContent.trim().split(/\s+/)[0] || '🎯';
    S.save({domain:window._domain, domainIcon:icon, step:1, need:collectNeed()});
    renderDomainBanners();
  };
  function updateLinks(){ var app=S.appUrl(); ['lnkDraftTool','lnkDraftStep3'].forEach(function(id){ var a=$(id); if(a){ a.href=app; a.onclick=function(){ saveState({step:currentStep()}); return true; }; } }); $$('a[href*="app.html"],a[href*="app-private.html"]').forEach(function(a){ if(a.id==='lnkDraftTool'||a.id==='lnkDraftStep3'){return;} if(/app(-private)?\.html/.test(a.getAttribute('href')||'')){ a.href=app; a.addEventListener('click',function(){saveState({step:currentStep()});}); } }); }
  function refreshDrafts(){
    var gens=S.loadGenerations(); var sel=$('archiveAttachSelect'); var last=S.lastGenId();
    if(sel){ sel.innerHTML='<option value="">Ne pas joindre de draft préparé</option>'+gens.map(function(g){ var label=(g.title||'Draft préparé')+(g.domain?' — '+g.domain:'')+(g.createdAt?' — '+new Date(g.createdAt).toLocaleString('fr-FR'):''); return '<option value="'+escapeHtml(g.id||'')+'">'+escapeHtml(label)+'</option>'; }).join(''); if(last) sel.value=last; sel.onchange=function(){ S.save({selectedDraft:sel.value}); var st=$('v59DraftStatus'); if(st) st.style.display=sel.value?'block':'none'; renderDraftCards(); }; }
    renderDraftCards(); var st=$('v59DraftStatus'); if(st) st.style.display=(sel&&sel.value)?'block':'none'; var lnk=$('lnkDraftStep3'); if(lnk) lnk.textContent=gens.length?'Générer un nouveau draft →':'Créer un draft →';
  }
  window.refreshGenerationSelect = refreshDrafts;
  function renderDraftCards(){ var c=$('v60DraftCards'); if(!c) return; var gens=S.loadGenerations(); var selected=(($('archiveAttachSelect')||{}).value)||S.load().selectedDraft; if(!gens.length){ c.innerHTML='<div class="v61-empty">Aucun draft généré pour le moment. Cliquez sur “Créer un draft” pour préparer un document de travail, puis revenez ici pour le joindre à votre demande.</div>'; return; } c.innerHTML=gens.slice(0,5).map(function(g){ var prev=escapeHtml((g.result||'').slice(0,160)); var date=g.createdAt?new Date(g.createdAt).toLocaleString('fr-FR'):''; return '<div class="v60-draft-card '+(selected===g.id?'selected':'')+'" data-gen-id="'+escapeHtml(g.id)+'"><div class="v60-draft-card-head"><span class="v60-draft-card-title">'+escapeHtml(g.title||'Draft préparé')+'</span><span class="v60-draft-card-meta">'+escapeHtml((g.domain||S.load().domain||'')+' · '+date)+'</span></div>'+(prev?'<div class="v60-draft-card-preview">'+prev+'…</div>':'')+'<button type="button" class="v60-draft-card-btn">Sélectionner ce draft</button></div>'; }).join(''); }
  window.v60SelectDraft=function(id){ var sel=$('archiveAttachSelect'); if(sel){ sel.value=id; sel.dispatchEvent(new Event('change')); } S.save({selectedDraft:id}); refreshDrafts(); };
  function hydrateBanner(){
    var user = {}; try{ user=JSON.parse(localStorage.getItem('pope_session_user')||'{}'); }catch(e){}
    var name = (user.full_name || user.name || user.first_name || '').split(' ')[0] || '';
    if(name && $('dashWelcome')) $('dashWelcome').textContent='Bonjour '+name+' 👋';
    if($('planN') && !$('planN').textContent.trim().replace('—','')) $('planN').textContent = user.plan_label || user.plan || 'Starter';
  }
  document.addEventListener('click',function(e){ var g=e.target.closest('[data-v61-gostep]'); if(g){ e.preventDefault(); setStep(parseInt(g.dataset.v61Gostep,10)||1); return; } var card=e.target.closest('.v60-draft-card'); if(card){ e.preventDefault(); window.v60SelectDraft(card.dataset.genId); return; } var step=e.target.closest('.v5-step'); if(step){ e.preventDefault(); setStep(parseInt(step.dataset.step,10)); } }, true);
  document.addEventListener('input',function(){ saveState(); }, true); document.addEventListener('change',function(){ saveState(); }, true);
  function init(){ ensureStyles(); var old=$('needAssistantV52'); if(old) old.remove(); restore(); updateLinks(); hydrateBanner(); var params=new URLSearchParams(location.search); var step=parseInt(params.get('step')||'0',10); var attach=params.get('attach')==='last'; if(attach){ S.save({selectedDraft:S.lastGenId()}); step=3; } if(step) setStep(step); else setStep(S.load().step||1,{noRestore:true}); setTimeout(function(){renderDomainBanners(); refreshDrafts(); updateLinks();},500); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
