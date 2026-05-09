/* POPE Online V61 — correctif définitif dashboard public/privé
   Objectif : script réellement chargé, retour APP stable sur étape 2,
   étapes 3/4 visibles, drafts IA persistants, bandeau utilisateur hydraté. */
(function(){
  'use strict';
  var S = window.POPEV61State;
  if (!S) { console.warn('[V61] POPEV61State manquant'); return; }

  var $ = function(id){ return document.getElementById(id); };
  var $$ = function(sel){ return Array.prototype.slice.call(document.querySelectorAll(sel)); };
  var API_BASE = (window.__POPE_API_BASE__ || (location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://pope-online-v2.onrender.com')).replace(/\/$/, '');
  var DASH_URL = S.isPrivate ? 'dashboard-private.html' : 'dashboard.html';
  var APP_URL = S.isPrivate ? 'app-private.html?from=dashboard&step=2' : 'app.html?from=dashboard&step=2';
  var VAULT_SPACE = S.isPrivate ? 'private' : 'public';

  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function val(id){ var e=$(id); return e ? (e.value || '') : ''; }
  function setVal(id,v){ var e=$(id); if(e && v !== undefined && v !== null) e.value = v; }
  function token(){ return sessionStorage.getItem('pope_session_token') || localStorage.getItem('pope_session_token') || ''; }
  function currentStep(){ var p = $$('.v5-step-panel').find(function(x){ return x.classList.contains('active'); }); return p ? parseInt((p.id||'').replace('step-panel-',''),10) : (S.load().step || 1); }

  function collectNeed(){ return {
    title: val('besoInTitle'), context: val('descContexte'), problem: val('descProbleme'), objective: val('descObjectif'), decision: val('descDecision'),
    deliverable: val('descLivrable'), constraints: val('descContraintes'), risks: val('descRisques'), actors: val('descActeurs'), audience: val('descPublic'),
    deadline: val('needDeadline'), pieces: val('descPieces'), detailLevel: val('descNiveau'), description: val('besoInDesc'), urgency: val('needUrgency'),
    sensitivity: val('needSensitivity'), treatment: (document.querySelector('input[name="besoType"]:checked')||{}).value || 'conseil'
  }; }

  function saveState(extra){
    var pill = $$('.v5-domain-pill.selected')[0];
    var st = S.load();
    var domain = (pill && (pill.dataset.domain || pill.getAttribute('data-domain'))) || window._domain || st.domain || '';
    var icon = pill ? (pill.textContent.trim().split(/\s+/)[0] || '🎯') : (st.domainIcon || '🎯');
    return S.save(Object.assign({ step: currentStep(), domain: domain, domainIcon: icon, need: collectNeed(), scrollY: window.scrollY || 0 }, extra || {}));
  }
  window.saveDashboardState = saveState;

  function ensureStyles(){
    if ($('v61-style')) return;
    var css = document.createElement('style'); css.id = 'v61-style';
    css.textContent = '.v61-domain-banner{display:flex;align-items:center;gap:10px;margin:0 0 16px;padding:13px 16px;border:1px solid rgba(0,121,193,.22);border-radius:16px;background:linear-gradient(135deg,#f0f8ff,#fff);box-shadow:0 10px 26px rgba(15,23,42,.06);color:#0b2440;font-weight:900}.v61-domain-banner small{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:#64748b;font-weight:800;margin-bottom:2px}.v61-domain-banner .name{font-size:15px}.v61-domain-banner .change{margin-left:auto;border:1px solid #dbeafe;background:#fff;color:#0079c1;border-radius:999px;padding:7px 11px;font-weight:800;cursor:pointer}.v60-draft-card{border:1px solid #dbeafe;background:#fff;border-radius:16px;padding:14px;margin:10px 0;box-shadow:0 8px 24px rgba(15,23,42,.05);cursor:pointer}.v60-draft-card.selected{border-color:#0079c1;background:#f0f8ff}.v60-draft-card-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.v60-draft-card-title{font-weight:900;color:#0b2440}.v60-draft-card-meta{font-size:12px;color:#64748b}.v60-draft-card-preview{font-size:13px;color:#334155;line-height:1.5;margin-top:8px}.v60-draft-card-btn{margin-top:10px;border:0;background:#0079c1;color:#fff;border-radius:999px;padding:8px 12px;font-weight:800;cursor:pointer}.v61-empty{border:1px dashed #cbd5e1;background:#f8fafc;border-radius:16px;padding:14px;color:#64748b;font-size:13px}.v61-vault-row{display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #eef2f7}.v61-recap-extra{margin-top:12px}.v61-recap-extra h3{font-size:14px;color:#0b2440;margin:0 0 8px}.v61-recap-pill{display:inline-flex;align-items:center;gap:6px;border:1px solid #dbeafe;background:#f8fbff;border-radius:999px;padding:7px 10px;margin:4px 6px 4px 0;font-size:12px;font-weight:800;color:#0b2440}';
    document.head.appendChild(css);
  }

  function renderDomainBanners(){
    var st = S.load(); var domain = st.domain || window._domain || ''; if(!domain) return;
    [2,3,4].forEach(function(n){
      var panel = $('step-panel-'+n); if(!panel) return;
      var old = panel.querySelector('[data-v61-domain-banner]'); if(old) old.remove();
      var head = panel.querySelector('.v5-panel-head') || panel;
      head.insertAdjacentHTML('afterbegin','<div class="v61-domain-banner" data-v61-domain-banner><span style="font-size:22px">'+escapeHtml(st.domainIcon||'🎯')+'</span><div><small>Domaine sélectionné</small><div class="name">'+escapeHtml(domain)+'</div></div><button class="change" type="button" data-v61-gostep="1">Changer</button></div>');
    });
    var badge=$('v58DomainBadge'), name=$('v58DomainName'); if(name) name.textContent=domain; if(badge){ badge.classList.add('visible'); badge.style.display='flex'; }
  }

  function restore(){
    var st = S.load();
    if(st.domain){ window._domain = st.domain; $$('.v5-domain-pill').forEach(function(b){ b.classList.toggle('selected', (b.dataset.domain||b.getAttribute('data-domain')) === st.domain); }); }
    var n = st.need || {};
    setVal('besoInTitle',n.title); setVal('descContexte',n.context); setVal('descProbleme',n.problem); setVal('descObjectif',n.objective); setVal('descDecision',n.decision); setVal('descLivrable',n.deliverable); setVal('descContraintes',n.constraints); setVal('descRisques',n.risks); setVal('descActeurs',n.actors); setVal('descPublic',n.audience); setVal('needDeadline',n.deadline); setVal('descPieces',n.pieces); setVal('descNiveau',n.detailLevel); setVal('besoInDesc',n.description); setVal('needUrgency',n.urgency); setVal('needSensitivity',n.sensitivity);
    if(n.treatment){ var r=document.querySelector('input[name="besoType"][value="'+n.treatment+'"]'); if(r) r.checked = true; }
    renderDomainBanners(); refreshDrafts(); loadVaultFiles(); updateV61Recap(); return st;
  }
  window.restoreDashboardState = restore;

  function goStepV61(n, opts){
    opts = opts || {}; n = parseInt(n,10) || 1;
    if(!opts.noRestore) restore();
    if(n > 1 && !(S.load().domain || window._domain)) n = 1;
    $$('.v5-step-panel').forEach(function(p){ p.classList.toggle('active', p.id === 'step-panel-'+n); });
    $$('.v5-step').forEach(function(s){ var sn=parseInt(s.dataset.step,10); s.classList.toggle('active', sn===n); s.classList.toggle('done', sn<n); });
    if(window.switchTab){ try{ window.switchTab('besoin'); }catch(e){} }
    S.save({ step:n, need:collectNeed(), domain: window._domain || S.load().domain || '', domainIcon:S.load().domainIcon || '🎯', scrollY:0 });
    renderDomainBanners();
    if(n === 3){ refreshDrafts(); loadVaultFiles(); }
    if(n === 4){ updateV61Recap(); if(window.updateRecap){ try{ window.updateRecap(); }catch(e){} } updateV61Recap(); }
    setTimeout(function(){ window.scrollTo({top:0, behavior:'smooth'}); }, 20);
  }
  window.goStep = goStepV61;
  window.forceStep = goStepV61;

  window.selectDomain = function(btn){
    $$('.v5-domain-pill').forEach(function(b){ b.classList.remove('selected'); });
    btn.classList.add('selected');
    window._domain = btn.dataset.domain || btn.getAttribute('data-domain') || btn.textContent.trim();
    var icon = btn.textContent.trim().split(/\s+/)[0] || '🎯';
    S.save({domain:window._domain, domainIcon:icon, step:1, need:collectNeed()});
    renderDomainBanners();
  };

  function updateLinks(){
    ['lnkDraftTool','lnkDraftStep3'].forEach(function(id){ var a=$(id); if(a){ a.href = APP_URL; a.onclick = function(){ saveState({step:2}); return true; }; } });
    $$('a[href*="app.html"],a[href*="app-private.html"]').forEach(function(a){ if(a.id==='lnkDraftTool'||a.id==='lnkDraftStep3') return; a.href = APP_URL; a.addEventListener('click',function(){ saveState({step:2}); }); });
    $$('a[href*="vault.html"]').forEach(function(a){ var href=a.getAttribute('href')||''; if(href.indexOf('return=')>=0) a.href='vault.html?space='+VAULT_SPACE+'&return='+encodeURIComponent(DASH_URL+'?step=3'); });
  }

  function refreshDrafts(){
    var gens = S.loadGenerations(); var sel = $('archiveAttachSelect'); var st = S.load(); var selected = st.selectedDraft || S.lastGenId();
    if(sel){
      sel.innerHTML = '<option value="">Ne pas joindre de draft préparé</option>' + gens.map(function(g){ var label=(g.title||g.usecaseLabel||'Draft préparé')+(g.domain?' — '+g.domain:'')+(g.createdAt?' — '+new Date(g.createdAt).toLocaleString('fr-FR'):''); return '<option value="'+escapeHtml(g.id||'')+'">'+escapeHtml(label)+'</option>'; }).join('');
      if(selected) sel.value = selected;
      sel.onchange = function(){ S.save({selectedDraft:sel.value}); var status=$('v59DraftStatus'); if(status) status.style.display = sel.value ? 'block' : 'none'; renderDraftCards(); updateV61Recap(); };
    }
    var status=$('v59DraftStatus'); if(status) status.style.display = (sel && sel.value) ? 'block' : 'none';
    var lnk=$('lnkDraftStep3'); if(lnk) lnk.textContent = gens.length ? 'Générer un nouveau draft →' : 'Créer un draft →';
    renderDraftCards(); updateV61Recap();
  }
  window.refreshGenerationSelect = refreshDrafts;

  function ensureDraftCardsContainer(){
    if($('v60DraftCards')) return $('v60DraftCards');
    var sel=$('archiveAttachSelect'); if(!sel) return null;
    var div=document.createElement('div'); div.id='v60DraftCards'; div.style.marginTop='10px';
    sel.parentNode.insertBefore(div, sel.nextSibling.nextSibling || sel.nextSibling);
    return div;
  }
  function renderDraftCards(){
    var c = ensureDraftCardsContainer(); if(!c) return;
    var gens=S.loadGenerations(); var selected=(($('archiveAttachSelect')||{}).value) || S.load().selectedDraft;
    if(!gens.length){ c.innerHTML='<div class="v61-empty">Aucun draft généré pour le moment. Cliquez sur “Créer un draft” pour préparer un document de travail, puis revenez ici pour le joindre à votre demande.</div>'; return; }
    c.innerHTML=gens.slice(0,5).map(function(g){ var prev=escapeHtml((g.result||g.output||'').slice(0,180)); var date=g.createdAt?new Date(g.createdAt).toLocaleString('fr-FR'):''; return '<div class="v60-draft-card '+(selected===g.id?'selected':'')+'" data-gen-id="'+escapeHtml(g.id)+'"><div class="v60-draft-card-head"><span class="v60-draft-card-title">'+escapeHtml(g.title||g.usecaseLabel||'Draft préparé')+'</span><span class="v60-draft-card-meta">'+escapeHtml((g.domain||S.load().domain||'')+' · '+date)+'</span></div>'+(prev?'<div class="v60-draft-card-preview">'+prev+'…</div>':'')+'<button type="button" class="v60-draft-card-btn">Sélectionner ce draft</button></div>'; }).join('');
  }
  window.v60SelectDraft = function(id){ var sel=$('archiveAttachSelect'); if(sel){ sel.value=id; sel.dispatchEvent(new Event('change')); } S.save({selectedDraft:id}); refreshDrafts(); };

  function loadVaultFiles(){
    var c=$('vaultExpertList'); if(!c) return;
    var t=token();
    if(!t){ c.innerHTML='<span style="color:#64748b">Connexion requise pour afficher le dépôt sécurisé.</span>'; return; }
    fetch(API_BASE + '/vault/list?space=' + encodeURIComponent(VAULT_SPACE), { credentials:'include', headers:{'Authorization':'Bearer '+t,'Content-Type':'application/json'} })
      .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
      .then(function(data){ var files=data.files || data.items || []; S.save({documents:files}); if(!files.length){ c.innerHTML='<span style="color:#64748b">Aucune pièce déposée. <a href="vault.html?space='+VAULT_SPACE+'&return='+encodeURIComponent(DASH_URL+'?step=3')+'" style="color:#0079c1;font-weight:800">Déposer des pièces →</a></span>'; return; } c.innerHTML=files.slice(0,6).map(function(f){ return '<div class="v61-vault-row"><span>📄</span><span style="flex:1;font-weight:700;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escapeHtml(f.original_name||f.filename||f.name||'Fichier')+'</span><span style="font-size:11px;color:#94a3b8">'+escapeHtml(f.size_kb?f.size_kb+' Ko':'')+'</span></div>'; }).join('') + '<a href="vault.html?space='+VAULT_SPACE+'&return='+encodeURIComponent(DASH_URL+'?step=3')+'" style="display:inline-block;margin-top:8px;font-size:12px;font-weight:800;color:#0079c1">📂 Gérer le dépôt →</a>'; updateV61Recap(); })
      .catch(function(){ c.innerHTML='<span style="color:#64748b">Dépôt sécurisé non chargé. <a href="vault.html?space='+VAULT_SPACE+'&return='+encodeURIComponent(DASH_URL+'?step=3')+'" style="color:#0079c1;font-weight:800">Ouvrir le dépôt →</a></span>'; });
  }

  function updateV61Recap(){
    var st=S.load(), n=st.need||{}, gens=S.loadGenerations();
    function put(id,v){ var e=$(id); if(e) e.textContent = v || '—'; }
    put('recapDomain', st.domain || window._domain || '—');
    put('recapTitle', n.title || val('besoInTitle') || '—');
    put('recapType', ((n.treatment||'conseil') === 'surmesure') ? '📋 Accompagnement approfondi' : '🎯 Conseil expert 48h');
    put('recapQuota', (($('expertLeftN')||{}).textContent || '—'));
    var card = document.querySelector('#step-panel-4 .v5-recap-card'); if(!card) return;
    var old=$('v61RecapExtra'); if(old) old.remove();
    var selected = st.selectedDraft || (($('archiveAttachSelect')||{}).value) || '';
    var draft = gens.find(function(g){ return g.id === selected; });
    var docs = st.documents || [];
    card.insertAdjacentHTML('beforeend','<div id="v61RecapExtra" class="v61-recap-extra"><h3>Éléments joints</h3><div><span class="v61-recap-pill">🛠️ Draft IA : '+escapeHtml(draft ? (draft.title||draft.usecaseLabel||'Draft sélectionné') : 'aucun')+'</span><span class="v61-recap-pill">📂 Pièces dépôt : '+escapeHtml(String(docs.length||0))+'</span></div><h3 style="margin-top:12px">Contexte conservé</h3><div style="font-size:13px;color:#475569;line-height:1.5">'+escapeHtml((n.context||n.description||val('descContexte')||'Aucune précision complémentaire renseignée.')).slice(0,500)+'</div></div>');
  }

  function hydrateBanner(){
    var cached={}; try{ cached=JSON.parse(localStorage.getItem('pope_session_user')||'{}'); }catch(e){}
    var cachedWallet={}; try{ cachedWallet=JSON.parse(localStorage.getItem('pope_session_wallet')||'{}'); }catch(e){}
    renderUser(cached, cachedWallet);
    var t=token(); if(!t) return;
    fetch(API_BASE+'/auth/me',{credentials:'include',headers:{'Authorization':'Bearer '+t,'Content-Type':'application/json'}})
      .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
      .then(function(data){ if(data.user) localStorage.setItem('pope_session_user',JSON.stringify(data.user)); if(data.wallet) localStorage.setItem('pope_session_wallet',JSON.stringify(data.wallet)); renderUser(data.user||{}, data.wallet||{}); })
      .catch(function(){});
  }
  function renderUser(u,w){
    u=u||{}; w=w||{};
    var name=(u.first_name || u.firstname || u.prenom || u.full_name || u.name || '').split(' ')[0];
    if($('dashWelcome')) $('dashWelcome').textContent = name ? ('Bonjour '+name+' 👋') : 'Bonjour 👋';
    if($('planN')) $('planN').textContent = w.plan_label || u.plan_label || u.plan || 'Free';
    if($('expertLeftN')) $('expertLeftN').textContent = (w.expert_left ?? w.expertLeft ?? u.expert_left ?? '—');
  }

  document.addEventListener('click',function(e){
    var g=e.target.closest('[data-v61-gostep]'); if(g){ e.preventDefault(); goStepV61(parseInt(g.dataset.v61Gostep,10)||1); return; }
    var card=e.target.closest('.v60-draft-card'); if(card){ e.preventDefault(); window.v60SelectDraft(card.dataset.genId); return; }
    var step=e.target.closest('.v5-step'); if(step){ e.preventDefault(); goStepV61(parseInt(step.dataset.step,10)); }
  }, true);
  document.addEventListener('input',function(){ saveState(); }, true);
  document.addEventListener('change',function(){ saveState(); }, true);

  function init(){
    ensureStyles();
    var old=$('needAssistantV52'); if(old) old.remove();
    restore(); updateLinks(); hydrateBanner();
    var params = new URLSearchParams(location.search);
    var requestedStep = parseInt(params.get('step') || '0', 10);
    // V61 : le retour depuis app reste strictement sur l'étape 2, même si un draft existe.
    if (params.get('from') === 'app') requestedStep = 2;
    goStepV61(requestedStep || S.load().step || 1, {noRestore:true});
    setTimeout(function(){ renderDomainBanners(); refreshDrafts(); loadVaultFiles(); updateLinks(); updateV61Recap(); hydrateBanner(); }, 500);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
