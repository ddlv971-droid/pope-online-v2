/**
 * POPE Online — Dashboard V60
 * Correctifs : retour APP, étapes 3/4, bandeau utilisateur
 */
(function () {
  'use strict';

  var isPrivate = /dashboard-private/i.test(location.pathname);
  var APP_URL   = isPrivate ? 'app-private.html' : 'app.html';
  var DASH_URL  = isPrivate ? 'dashboard-private.html' : 'dashboard.html';
  var VAULT_SP  = isPrivate ? 'private' : 'public';
  var API_BASE  = (window.__POPE_API_BASE__ || 'https://pope-online-v2.onrender.com').replace(/\/$/, '');
  var STATE_KEY = 'pope_v58_state_' + (isPrivate ? 'private' : 'public');

  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s||'').replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];}); }
  function getToken() { return sessionStorage.getItem('pope_session_token')||localStorage.getItem('pope_session_token')||''; }

  /* ── Badge domaine via CSS (classList.add visible) ── */
  function showBadge(domain) {
    var badge = el('v58DomainBadge'); if (!badge) return;
    if (domain) {
      var n=el('v58DomainName'); if(n) n.textContent=domain;
      badge.classList.add('visible');
    } else {
      badge.classList.remove('visible');
    }
  }

  /* ── Lire état persisté (clé v58) ── */
  function loadSavedState() {
    try {
      var raw = sessionStorage.getItem(STATE_KEY)||localStorage.getItem(STATE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
  }

  /* ── BUG 1 : retour depuis APP ──────────────────────
     app-v60-bridge hardcode step=3&attach=last.
     On intercepte l'URL ici et on décide nous-mêmes
     de la cible : étape 2 sauf si draft confirmé.
  ─────────────────────────────────────────────────── */
  function handleUrlParams() {
    var sp     = new URLSearchParams(location.search);
    var from   = sp.get('from');
    var step   = parseInt(sp.get('step')||'0', 10);
    var attach = sp.get('attach') === 'last';

    if (!from && !step && !attach) return;

    var lastId = '';
    if (attach) {
      lastId = sessionStorage.getItem('pope_v54_last_generation_id')||
               sessionStorage.getItem('pope_v58_last_gen')||
               sessionStorage.getItem('pope_v53_last_generation_id')||'';
      if (lastId) sessionStorage.setItem('pope_v58_attached_gen', lastId);
    }

    // Règle : retour APP → étape 2 toujours, sauf draft réel confirmé → étape 3
    var target = (from==='app') ? ((attach&&lastId) ? 3 : 2) : (step||(attach?3:2));

    // Restaurer le domaine avant de naviguer
    var saved = loadSavedState();
    if (saved && saved.domain && !window._domain) {
      window._domain = saved.domain;
    }

    setTimeout(function() {
      if (window.goStep) window.goStep(target);
      if (target === 3) setTimeout(initStep3, 150);
    }, 150);
  }

  /* ── BUG 2 & 3 : étapes 3 et 4 ──────────────────── */
  function loadGenerations() {
    var keys = ['pope_v54_generations','pope_v53_generations',
                'pope_generations_v61_'+(isPrivate?'private':'public')];
    var all=[], seen={};
    keys.forEach(function(k){
      try { (JSON.parse(localStorage.getItem(k)||'[]')||[]).forEach(function(g){
        if(g&&g.id&&!seen[g.id]){seen[g.id]=true;all.push(g);}
      }); } catch(e){}
    });
    return all.sort(function(a,b){return new Date(b.createdAt||0)-new Date(a.createdAt||0);});
  }

  function initStep3() {
    /* Select des drafts */
    var sel = el('archiveAttachSelect');
    if (sel) {
      var gens = loadGenerations();
      var cur  = sessionStorage.getItem('pope_v58_attached_gen')||
                 sessionStorage.getItem('pope_v58_last_gen')||
                 sessionStorage.getItem('pope_v54_last_generation_id')||'';
      sel.innerHTML = '<option value="">Ne pas joindre de draft préparé</option>' +
        gens.map(function(g){
          var lbl=(g.title||g.usecaseLabel||'Draft IA')+
                  (g.domain?' — '+g.domain:'')+
                  (g.createdAt?' — '+new Date(g.createdAt).toLocaleString('fr-FR'):'');
          return '<option value="'+esc(String(g.id))+'">'+esc(lbl)+'</option>';
        }).join('');
      if (cur) sel.value = cur;
      sel.onchange = function(){ sessionStorage.setItem('pope_v58_attached_gen', sel.value||''); };
      var st = el('v59DraftStatus');
      if (st) st.style.display = (gens.length&&sel.value)?'block':'none';
      var lnk = el('lnkDraftStep3');
      if (lnk) { lnk.href=APP_URL+'?from=dashboard&step=2'; if(gens.length) lnk.textContent='Voir l\'outil →'; }
    }
    /* Vault */
    loadVaultFiles();
  }

  function loadVaultFiles() {
    var box = el('vaultExpertList'); if (!box) return;
    var tok = getToken();
    if (!tok) { box.innerHTML='<span style="color:#64748b">Connexion requise.</span>'; return; }
    box.innerHTML='<span style="color:#64748b;font-style:italic">⏳ Chargement…</span>';
    fetch(API_BASE+'/vault/list?space='+VAULT_SP,{
      headers:{'Authorization':'Bearer '+tok,'Content-Type':'application/json'},
      credentials:'include'
    })
    .then(function(r){return r.ok?r.json():{files:[]};})
    .then(function(data){
      var files=data.files||data.items||[];
      if(!files.length){
        box.innerHTML='<span style="color:#64748b">Aucune pièce déposée. '+
          '<a href="vault.html?space='+VAULT_SP+'&return='+DASH_URL+'" style="color:#0079c1;font-weight:700">Déposer →</a></span>';
        return;
      }
      box.innerHTML=files.slice(0,6).map(function(f){
        return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f0f4f8">'+
          '<span>📄</span>'+
          '<span style="flex:1;font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(f.original_name||f.filename||'Fichier')+'</span>'+
          '<span style="font-size:11px;color:#94a3b8;">'+(f.size_kb?f.size_kb+' Ko':'')+'</span></div>';
      }).join('')+
      '<a href="vault.html?space='+VAULT_SP+'&return='+DASH_URL+'?step=3" style="display:inline-block;margin-top:8px;font-size:12px;font-weight:700;color:#0079c1">📂 Gérer le dépôt →</a>';
    })
    .catch(function(){
      box.innerHTML='<a href="vault.html?space='+VAULT_SP+'&return='+DASH_URL+'" style="font-size:12px;font-weight:700;color:#0079c1">📂 Accéder au dépôt →</a>';
    });
  }

  /* ── BUG 4 : bandeau utilisateur ─────────────────── */
  var _done = false;
  function hydrateUser() {
    if (_done) return;
    var g = el('dashWelcome');
    if (g && g.textContent && g.textContent !== 'Bonjour 👋' && g.textContent.length > 10) { _done=true; return; }
    var tok = getToken();
    if (!tok) { setTimeout(hydrateUser, 600); return; }
    fetch(API_BASE+'/auth/me',{method:'GET',headers:{'Authorization':'Bearer '+tok,'Content-Type':'application/json'},credentials:'include'})
    .then(function(r){if(!r.ok)throw 0;return r.json();})
    .then(function(d){
      _done=true;
      var u=d.user||{}, w=d.wallet||{};
      try{localStorage.setItem('pope_session_user',JSON.stringify({user:u,wallet:w}));}catch(e){}
      var fn=(u.full_name||u.name||'').trim().split(/\s+/)[0];
      if(g&&fn) g.textContent='Bonjour '+fn+' 👋';
      var l=el('expertLeftN'); if(l) l.textContent=(w.expert_left!=null)?String(w.expert_left):'—';
      var p=el('planN'); if(p) p.textContent=w.plan_label||'Free';
      var ta=el('trialAlert');
      if(ta&&w.status==='trial_active'&&w.trial_days_left!=null){
        ta.removeAttribute('hidden');
        var t1=el('trialAlertTitle'),b1=el('trialAlertBody');
        if(t1)t1.textContent='Essai gratuit — '+w.trial_days_left+' jour(s) restant(s)';
        if(b1)b1.textContent='Souscrivez un plan pour continuer après votre essai.';
      } else if(ta&&w.status==='trial_expired'){
        ta.removeAttribute('hidden');ta.style.background='linear-gradient(to right,#fef2f2,#fff0f0)';ta.style.borderColor='#fecaca';
        var t2=el('trialAlertTitle'),b2=el('trialAlertBody');
        if(t2)t2.textContent='Période d\'essai terminée';
        if(b2)b2.textContent='Votre accès est suspendu. Choisissez un plan pour reprendre.';
        var ov=el('trialExpiredOverlay');if(ov)ov.removeAttribute('hidden');
      }
    })
    .catch(function(){
      try{
        var c=JSON.parse(localStorage.getItem('pope_session_user')||'null');
        if(c&&c.user){
          var fn=(c.user.full_name||'').trim().split(/\s+/)[0];
          if(g&&fn){g.textContent='Bonjour '+fn+' 👋';_done=true;}
          var w=c.wallet||{};
          var l=el('expertLeftN');if(l)l.textContent=(w.expert_left!=null)?String(w.expert_left):'—';
          var p=el('planN');if(p)p.textContent=w.plan_label||'Free';
        }
      }catch(e){}
      if(!_done) setTimeout(hydrateUser,2000);
    });
  }

  /* ── Restauration au chargement ──────────────────── */
  function restoreOnLoad() {
    // Restaurer domaine + badge depuis l'état v58
    var saved = loadSavedState();
    if (saved && saved.domain) {
      window._domain = saved.domain;
      document.querySelectorAll('.v5-domain-pill').forEach(function(b){
        b.classList.toggle('selected', b.getAttribute('data-domain')===saved.domain);
      });
      showBadge(saved.domain);
    }
  }

  /* ── Patch goStep pour initStep3/vault ───────────── */
  function patchGoStep() {
    var orig = window.goStep;
    if (!orig || orig._v60) return;
    window.goStep = function(n) {
      orig.apply(this, arguments);
      if (parseInt(n,10)===3) setTimeout(initStep3, 100);
      if (parseInt(n,10)===4) setTimeout(function(){ if(window.updateRecap) window.updateRecap(); }, 100);
    };
    window.goStep._v60 = true;
  }

  /* ── Auto-save ───────────────────────────────────── */
  document.addEventListener('input', function(){
    if(window.saveDashboardState) window.saveDashboardState();
  }, true);
  document.addEventListener('change', function(e){
    if(window.saveDashboardState) window.saveDashboardState();
    if(e.target&&e.target.id==='archiveAttachSelect')
      sessionStorage.setItem('pope_v58_attached_gen',e.target.value||'');
  }, true);

  /* ── Init ────────────────────────────────────────── */
  function init() {
    restoreOnLoad();
    setTimeout(hydrateUser, 200);
    handleUrlParams();
    // Patcher goStep après que dashboard-v5.js l'a réexposé
    setTimeout(patchGoStep, 100);
    setTimeout(patchGoStep, 700);
    // Vérification bandeau tardive (si module ES a déjà rempli)
    setTimeout(function(){
      var g=el('dashWelcome');
      if(!g||g.textContent==='Bonjour 👋'||g.textContent.length<=10) hydrateUser();
      else _done=true;
    }, 1000);
  }

  if (document.readyState==='loading') {
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(init, 80); });
  } else {
    setTimeout(init, 80);
  }

})();
