/**
 * POPE Online — Dashboard V60 (correctif définitif v2)
 *
 * BUGS CORRIGÉS :
 *   1. Flash étape 1 au retour APP → neutralisation de l'URL + verrouillage goStep
 *   2. Badge domaine absent → showDomainBadge() appelée via v58 lors du restore
 *   3. Étapes 3/4 vides → window.goStep verrouillé via Object.defineProperty
 *   4. Bandeau utilisateur → retry robuste
 *
 * STRATÉGIE :
 *   - dashboard-v5.js (module async) réécrit window.goStep avec une version locale
 *     dont _domain est une variable de closure non accessible → étapes 3/4 bloquées
 *   - On verrouille window.goStep via Object.defineProperty dès que possible
 *   - On neutralise ?attach=last dans l'URL AVANT que dashboard-v5.js ne la lise
 *   - Le badge domaine utilise classList.add('visible') (CSS v58-styles.css)
 */
(function () {
  'use strict';

  var isPrivate = /dashboard-private/i.test(location.pathname);
  var APP_URL   = isPrivate ? 'app-private.html' : 'app.html';
  var DASH_URL  = isPrivate ? 'dashboard-private.html' : 'dashboard.html';
  var VAULT_SP  = isPrivate ? 'private' : 'public';
  var API_BASE  = (window.__POPE_API_BASE__ || 'https://pope-online-v2.onrender.com').replace(/\/$/, '');

  var STATE_KEYS = [
    'pope_v58_state_' + (isPrivate ? 'private' : 'public'),
    'pope_v60_state_' + (isPrivate ? 'priv' : 'pub'),
    'pope_need_state_' + (isPrivate ? 'private' : 'public'),
    'pope_need_state_v61_' + (isPrivate ? 'private' : 'public')
  ];

  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s||'').replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];}); }
  function getToken() { return sessionStorage.getItem('pope_session_token')||localStorage.getItem('pope_session_token')||''; }

  function readState() {
    for (var i = 0; i < STATE_KEYS.length; i++) {
      var raw = sessionStorage.getItem(STATE_KEYS[i]) || localStorage.getItem(STATE_KEYS[i]);
      if (raw) { try { return JSON.parse(raw); } catch(e) {} }
    }
    return {};
  }

  // Résoudre le domaine depuis toutes les sources
  function resolveDomain() {
    if (window._domain) return window._domain;
    var pill = document.querySelector('.v5-domain-pill.selected');
    if (pill && pill.getAttribute('data-domain')) return pill.getAttribute('data-domain');
    var st = readState();
    if (st.domain) return st.domain;
    return '';
  }

  /* ════════════════════════════════════════════════════════
     BADGE DOMAINE
     v58-styles.css : .v58-domain-badge { display:none }
                      .v58-domain-badge.visible { display:flex }
     Doit utiliser classList.add('visible'), PAS style.display
  ════════════════════════════════════════════════════════ */
  function showDomainBadge(domain, icon) {
    var badge = el('v58DomainBadge');
    if (!badge) return;
    if (domain) {
      var nameEl = el('v58DomainName');
      var iconEl = el('v58DomainIcon');
      if (nameEl) nameEl.textContent = domain;
      if (iconEl && icon) iconEl.textContent = icon;
      else if (iconEl) {
        // Récupérer l'icône depuis le pill sélectionné
        var pill = document.querySelector('.v5-domain-pill.selected');
        if (pill) iconEl.textContent = pill.textContent.trim().split(/\s+/)[0] || '🎯';
      }
      badge.classList.add('visible');
    } else {
      badge.classList.remove('visible');
    }
  }

  /* ════════════════════════════════════════════════════════
     goStep V60 — version définitive
     Gère directement les panels sans déléguer à _origGoStep
     car goStep_v5_local bloque sur _domain de closure.
  ════════════════════════════════════════════════════════ */
  function goStepV60(n) {
    n = parseInt(n, 10) || 1;

    // Synchroniser window._domain depuis toutes les sources
    var domain = resolveDomain();
    if (domain) window._domain = domain;

    if (n > 1 && !window._domain) {
      var g = el('domainGrid');
      if (g) {
        g.style.boxShadow = '0 0 0 3px #ef4444';
        g.style.borderRadius = '14px';
        setTimeout(function(){ g.style.boxShadow=''; g.style.borderRadius=''; }, 1500);
      }
      return;
    }

    window._step = n;

    // Mettre à jour panels
    for (var i = 1; i <= 4; i++) {
      var p = el('step-panel-' + i);
      if (p) p.classList.toggle('active', i === n);
    }
    // Mettre à jour indicateurs
    document.querySelectorAll('.v5-step').forEach(function(s) {
      var sn = parseInt(s.dataset.step, 10);
      s.classList.toggle('active', sn === n);
      s.classList.toggle('done',   sn < n);
    });

    // Afficher le badge domaine sur étape 2
    if (n === 2 && window._domain) showDomainBadge(window._domain);

    // Actions par étape
    if (n === 3) setTimeout(initStep3, 80);
    if (n === 4) setTimeout(function(){ if (window.updateRecap) window.updateRecap(); }, 80);

    // Sauvegarder
    if (window.saveDashboardState) window.saveDashboardState();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ════════════════════════════════════════════════════════
     VERROUILLAGE de window.goStep
     Object.defineProperty empêche dashboard-v5.js (module async)
     de réécrire window.goStep avec sa version locale.
     Si quelqu'un tente d'écrire, on log et on ignore.
  ════════════════════════════════════════════════════════ */
  var _goStepLocked = false;

  function lockGoStep() {
    if (_goStepLocked) return;
    try {
      Object.defineProperty(window, 'goStep', {
        get: function() { return goStepV60; },
        set: function() { /* tentative d'écrasement ignorée */ },
        configurable: true // permet de re-définir si nécessaire
      });
      window.forceStep = goStepV60;
      _goStepLocked = true;
    } catch(e) {
      // Fallback si defineProperty échoue (rare)
      window.goStep    = goStepV60;
      window.forceStep = goStepV60;
    }
  }

  /* ════════════════════════════════════════════════════════
     NEUTRALISATION de l'URL avant que dashboard-v5.js la lise
     
     dashboard-v5.js (module defer) lit location.search pour
     détecter ?attach=last et appelle goStep(3) à 350ms.
     On nettoie l'URL AVANT son exécution (on est un script
     classique, on s'exécute AVANT les modules).
     
     On stocke les paramètres dans sessionStorage pour les
     traiter nous-mêmes proprement.
  ════════════════════════════════════════════════════════ */
  function captureAndCleanUrl() {
    var sp     = new URLSearchParams(location.search);
    var from   = sp.get('from');
    var step   = parseInt(sp.get('step') || '0', 10);
    var attach = sp.get('attach') === 'last';

    if (!from && !step && !attach) return null;

    // Sauvegarder les params en sessionStorage
    var params = { from: from, step: step, attach: attach };
    try { sessionStorage.setItem('pope_v60_pending_nav', JSON.stringify(params)); } catch(e) {}

    // Nettoyer l'URL MAINTENANT (avant que dashboard-v5.js lise location.search)
    // dashboard-v5.js est defer → s'exécute après les scripts classiques
    // On a donc le temps de nettoyer avant lui
    try {
      history.replaceState({}, '', location.pathname);
    } catch(e) {}

    return params;
  }

  /* ════════════════════════════════════════════════════════
     handleUrlParams — corrige le BUG 1 (flash + saut étape 3)
  ════════════════════════════════════════════════════════ */
  function handleUrlParams(params) {
    if (!params) {
      // Lire depuis sessionStorage (mis en place par captureAndCleanUrl)
      try {
        var raw = sessionStorage.getItem('pope_v60_pending_nav');
        if (!raw) return;
        params = JSON.parse(raw);
        sessionStorage.removeItem('pope_v60_pending_nav');
      } catch(e) { return; }
    }

    var from   = params.from;
    var step   = params.step;
    var attach = params.attach;

    if (!from && !step && !attach) return;

    // Récupérer l'ID du dernier draft
    var lastId = '';
    if (attach) {
      lastId = sessionStorage.getItem('pope_v54_last_generation_id') ||
               sessionStorage.getItem('pope_v58_last_gen') ||
               sessionStorage.getItem('pope_v53_last_generation_id') || '';
      if (lastId) {
        sessionStorage.setItem('pope_v58_attached_gen', lastId);
        sessionStorage.setItem('pope_v58_last_gen', lastId);
      }
    }

    var target;
    if (from === 'app') {
      // Retour depuis APP : étape 3 SEULEMENT si draft réel confirmé
      target = (attach && lastId) ? 3 : 2;
    } else {
      target = step || (attach ? 3 : 2);
    }

    // Naviguer directement — window.goStep est verrouillé = goStepV60
    // Pas besoin de setTimeout, le domain est déjà restauré par v58 init(50ms)
    // et nous init(80ms) → on est à DOMContentLoaded+80ms minimum
    function doNav() {
      // S'assurer que le domain est restauré avant de naviguer
      if (window.restoreDashboardState) window.restoreDashboardState();
      var domain = resolveDomain();
      if (domain) window._domain = domain;
      goStepV60(target);
      if (target === 3) setTimeout(initStep3, 150);
    }

    // Attendre que v58 ait fini son init (il a un setTimeout 50ms interne)
    // v58 handleUrlParams est dans son init à 50ms, appelle forceStep à 50+250=300ms
    // Notre goStepV60 verrouillé → forceStep = goStepV60 également
    // On navigue à 350ms pour être sûr d'être APRÈS v58 (300ms)
    setTimeout(doNav, 350);
  }

  /* ════════════════════════════════════════════════════════
     Étape 3 : drafts IA + vault
  ════════════════════════════════════════════════════════ */
  function loadGenerations() {
    var keys = [
      'pope_v54_generations',
      'pope_v53_generations',
      'pope_generations_v61_' + (isPrivate ? 'private' : 'public')
    ];
    var all = [], seen = {};
    keys.forEach(function(k) {
      try {
        var arr = JSON.parse(localStorage.getItem(k) || '[]');
        (arr||[]).forEach(function(g) {
          if (g && g.id && !seen[g.id]) { seen[g.id] = true; all.push(g); }
        });
      } catch(e) {}
    });
    return all.sort(function(a,b){ return new Date(b.createdAt||0)-new Date(a.createdAt||0); });
  }

  function initStep3() {
    fillDraftSelect();
    loadVaultFiles();
  }

  function fillDraftSelect() {
    var sel = el('archiveAttachSelect');
    if (!sel) return;
    var gens = loadGenerations();
    var cur  = sessionStorage.getItem('pope_v58_attached_gen') ||
               sessionStorage.getItem('pope_v58_last_gen') ||
               sessionStorage.getItem('pope_v54_last_generation_id') ||
               sessionStorage.getItem('pope_v53_last_generation_id') || '';

    sel.innerHTML = '<option value="">Ne pas joindre de draft préparé</option>' +
      gens.map(function(g) {
        var lbl = (g.title||g.usecaseLabel||'Draft IA') +
                  (g.domain ? ' — '+g.domain : '') +
                  (g.createdAt ? ' — '+new Date(g.createdAt).toLocaleString('fr-FR') : '');
        return '<option value="'+esc(String(g.id))+'">'+esc(lbl)+'</option>';
      }).join('');

    if (cur) sel.value = cur;
    sel.onchange = function() { sessionStorage.setItem('pope_v58_attached_gen', sel.value||''); };

    var status = el('v59DraftStatus');
    if (status) status.style.display = (gens.length && sel.value) ? 'block' : 'none';

    var lnk = el('lnkDraftStep3');
    if (lnk) {
      lnk.href = APP_URL + '?from=dashboard&step=2';
      if (gens.length) lnk.textContent = 'Voir l\'outil →';
    }
  }

  function loadVaultFiles() {
    var container = el('vaultExpertList');
    if (!container) return;
    var token = getToken();
    if (!token) {
      container.innerHTML = '<span style="color:#64748b">Connexion requise pour accéder au dépôt.</span>';
      return;
    }
    container.innerHTML = '<span style="color:#64748b;font-style:italic">⏳ Chargement…</span>';
    fetch(API_BASE + '/vault/list?space=' + VAULT_SP, {
      headers: { 'Authorization': 'Bearer '+token, 'Content-Type': 'application/json' },
      credentials: 'include'
    })
    .then(function(r) { return r.ok ? r.json() : {files:[]}; })
    .then(function(data) {
      var files = data.files || data.items || [];
      if (!files.length) {
        container.innerHTML = '<span style="color:#64748b">Aucune pièce déposée. '+
          '<a href="vault.html?space='+VAULT_SP+'&return='+DASH_URL+'" style="color:#0079c1;font-weight:700">Déposer des pièces →</a></span>';
        return;
      }
      container.innerHTML = files.slice(0,6).map(function(f) {
        return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f0f4f8">'+
          '<span>📄</span>'+
          '<span style="flex:1;font-size:12px;font-weight:600;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(f.original_name||f.filename||'Fichier')+'</span>'+
          '<span style="font-size:11px;color:#94a3b8;">'+(f.size_kb?f.size_kb+' Ko':'')+'</span></div>';
      }).join('') +
      '<a href="vault.html?space='+VAULT_SP+'&return='+DASH_URL+'?step=3" style="display:inline-block;margin-top:8px;font-size:12px;font-weight:700;color:#0079c1">📂 Gérer le dépôt →</a>';
    })
    .catch(function() {
      container.innerHTML = '<a href="vault.html?space='+VAULT_SP+'&return='+DASH_URL+'" style="font-size:12px;font-weight:700;color:#0079c1">📂 Accéder au dépôt sécurisé →</a>';
    });
  }

  /* ════════════════════════════════════════════════════════
     Bandeau utilisateur — BUG 4
  ════════════════════════════════════════════════════════ */
  var _hydrated = false;

  function hydrateUser() {
    if (_hydrated) return;
    var greet = el('dashWelcome');
    if (greet && greet.textContent && greet.textContent !== 'Bonjour 👋' && greet.textContent.length > 10) {
      _hydrated = true; return;
    }
    var token = getToken();
    if (!token) { setTimeout(hydrateUser, 500); return; }

    fetch(API_BASE + '/auth/me', {
      method: 'GET',
      headers: { 'Authorization': 'Bearer '+token, 'Content-Type': 'application/json' },
      credentials: 'include'
    })
    .then(function(r) { if (!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
    .then(function(data) {
      var u = data.user||{}, w = data.wallet||{};
      _hydrated = true;
      try { localStorage.setItem('pope_session_user', JSON.stringify({user:u,wallet:w})); } catch(e) {}
      var fn = (u.full_name||u.name||u.prenom||'').trim().split(/\s+/)[0];
      var g = el('dashWelcome'); if (g && fn) g.textContent = 'Bonjour '+fn+' 👋';
      var l = el('expertLeftN'); if (l) l.textContent = (w.expert_left!=null)?String(w.expert_left):'—';
      var p = el('planN'); if (p) p.textContent = w.plan_label||w.plan||'Free';
      var ta = el('trialAlert');
      if (ta && w.status === 'trial_active' && w.trial_days_left != null) {
        ta.removeAttribute('hidden');
        var t1=el('trialAlertTitle'),b1=el('trialAlertBody');
        if(t1) t1.textContent='Essai gratuit — '+w.trial_days_left+' jour(s) restant(s)';
        if(b1) b1.textContent='Souscrivez un plan pour continuer après votre essai.';
      } else if (ta && w.status === 'trial_expired') {
        ta.removeAttribute('hidden');
        ta.style.background='linear-gradient(to right,#fef2f2,#fff0f0)';
        ta.style.borderColor='#fecaca';
        var t2=el('trialAlertTitle'),b2=el('trialAlertBody');
        if(t2) t2.textContent='Période d\'essai terminée';
        if(b2) b2.textContent='Votre accès est suspendu. Choisissez un plan pour reprendre.';
        var ov=el('trialExpiredOverlay'); if(ov) ov.removeAttribute('hidden');
      }
    })
    .catch(function() {
      try {
        var c = JSON.parse(localStorage.getItem('pope_session_user')||'null');
        if (c && c.user) {
          var fn=(c.user.full_name||c.user.name||'').trim().split(/\s+/)[0];
          var g=el('dashWelcome'); if(g&&fn) g.textContent='Bonjour '+fn+' 👋';
          var w=c.wallet||{};
          var l=el('expertLeftN'); if(l) l.textContent=(w.expert_left!=null)?String(w.expert_left):'—';
          var p=el('planN'); if(p) p.textContent=w.plan_label||'Free';
          _hydrated = true;
        }
      } catch(e) {}
      if (!_hydrated) setTimeout(hydrateUser, 2000);
    });
  }

  /* ─── Patch selectDomain → badge + sync domain ─────── */
  function patchSelectDomain() {
    var orig = window.selectDomain;
    if (!orig || orig._v60patched) return;
    window.selectDomain = function(btn) {
      orig(btn); // v58 wrapper → appelle v5 original + showDomainBadge
      if (btn) {
        var domain = btn.getAttribute('data-domain') || '';
        var icon   = btn.textContent.trim().split(/\s+/)[0] || '🎯';
        window._domain = domain;
        showDomainBadge(domain, icon); // double garantie
      }
      if (window.saveDashboardState) window.saveDashboardState();
    };
    window.selectDomain._v60patched = true;
  }

  /* ─── Auto-save ─────────────────────────────────────── */
  document.addEventListener('input', function() {
    if (window.saveDashboardState) window.saveDashboardState();
  }, true);
  document.addEventListener('change', function(e) {
    if (window.saveDashboardState) window.saveDashboardState();
    if (e.target && e.target.id === 'archiveAttachSelect') {
      sessionStorage.setItem('pope_v58_attached_gen', e.target.value||'');
    }
  }, true);

  /* ════════════════════════════════════════════════════════
     EXÉCUTION IMMÉDIATE (avant DOMContentLoaded)
     dashboard-v60.js est un script classique → s'exécute
     pendant le parsing HTML, AVANT les modules defer
     → on peut capturer et nettoyer l'URL dès maintenant
  ════════════════════════════════════════════════════════ */
  var _pendingParams = captureAndCleanUrl();

  /* ─── Init (DOMContentLoaded + 80ms) ────────────────── */
  function init() {
    // 1. Verrouiller goStep EN PREMIER — avant tout le reste
    lockGoStep();

    // 2. Patcher selectDomain
    patchSelectDomain();

    // 3. Restaurer l'état (v58 l'a fait à 50ms, on s'assure)
    if (window.restoreDashboardState) {
      window.restoreDashboardState();
      // Rafficher le badge domaine après restauration
      var domain = resolveDomain();
      if (domain) showDomainBadge(domain);
    }

    // 4. Bandeau utilisateur
    setTimeout(hydrateUser, 300);

    // 5. Navigation depuis URL (params capturés au chargement du script)
    handleUrlParams(_pendingParams);

    // 6. Vérification tardive bandeau
    setTimeout(function() {
      var g = el('dashWelcome');
      if (!g || g.textContent === 'Bonjour 👋' || g.textContent.length <= 10) hydrateUser();
      else _hydrated = true;
    }, 1000);

    // 7. Re-lock goStep périodiquement par sécurité
    setTimeout(lockGoStep, 500);
    setTimeout(lockGoStep, 1500);
    setTimeout(function() { patchSelectDomain(); }, 400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(init, 80); });
  } else {
    setTimeout(init, 80);
  }

})();
