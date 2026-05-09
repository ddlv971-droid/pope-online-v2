/**
 * POPE Online — Dashboard V60 (correctif v3 - définitif)
 *
 * BUGS CORRIGÉS :
 *
 * 1. Flash étape 1 → masquage immédiat de step-panel-1 si retour APP détecté,
 *    navigation à DCL+80ms (pas 350ms)
 *
 * 2. Domaine en mémoire / badge persistant → au chargement sur étape 1,
 *    on NE restaure PAS le domaine visuellement (pills, window._domain, badge).
 *    Les champs texte sont restaurés mais le domaine doit être rechoisit.
 *    window._domain est vidé jusqu'à ce que l'user clique un domaine.
 *
 * 3. window.goStep verrouillé via Object.defineProperty → dashboard-v5.js
 *    (module defer) ne peut plus réécrire goStep avec sa version locale.
 *    goStepV60 gère directement les panels ET appelle initStep3/updateRecap.
 *
 * 4. Bandeau utilisateur → retry robuste avec cache fallback.
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

  function resolveDomain() {
    if (window._domain) return window._domain;
    var pill = document.querySelector('.v5-domain-pill.selected');
    if (pill && pill.getAttribute('data-domain')) return pill.getAttribute('data-domain');
    var st = readState();
    if (st.domain) return st.domain;
    return '';
  }

  /* ─── Badge domaine (.visible via CSS v58-styles.css) ── */
  function showDomainBadge(domain, icon) {
    var badge = el('v58DomainBadge');
    if (!badge) return;
    if (domain) {
      var nameEl = el('v58DomainName'), iconEl = el('v58DomainIcon');
      if (nameEl) nameEl.textContent = domain;
      if (iconEl) {
        if (icon) { iconEl.textContent = icon; }
        else {
          var pill = document.querySelector('.v5-domain-pill.selected');
          if (pill) iconEl.textContent = pill.textContent.trim().split(/\s+/)[0] || '🎯';
        }
      }
      badge.classList.add('visible');
    } else {
      badge.classList.remove('visible');
    }
  }

  function hideDomainBadge() {
    var badge = el('v58DomainBadge');
    if (badge) badge.classList.remove('visible');
  }

  /* ════════════════════════════════════════════════════════
     goStep V60 — gestion directe des panels
     Ne délègue PAS à _origGoStep car goStep_v5 bloque sur
     _domain de closure.
  ════════════════════════════════════════════════════════ */
  function goStepV60(n) {
    n = parseInt(n, 10) || 1;

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

    for (var i = 1; i <= 4; i++) {
      var p = el('step-panel-' + i);
      if (p) p.classList.toggle('active', i === n);
    }
    document.querySelectorAll('.v5-step').forEach(function(s) {
      var sn = parseInt(s.dataset.step, 10);
      s.classList.toggle('active', sn === n);
      s.classList.toggle('done',   sn < n);
    });

    if (n === 2 && window._domain) showDomainBadge(window._domain);
    if (n === 3) setTimeout(initStep3, 80);
    if (n === 4) setTimeout(function(){ if (window.updateRecap) window.updateRecap(); }, 80);

    if (window.saveDashboardState) window.saveDashboardState();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ════════════════════════════════════════════════════════
     VERROUILLAGE window.goStep
     Empêche dashboard-v5.js (module defer) de réécrire goStep.
  ════════════════════════════════════════════════════════ */
  function lockGoStep() {
    try {
      Object.defineProperty(window, 'goStep', {
        get: function() { return goStepV60; },
        set: function() { /* ignoré */ },
        configurable: true
      });
    } catch(e) {
      window.goStep = goStepV60;
    }
    window.forceStep = goStepV60;
  }

  /* ════════════════════════════════════════════════════════
     CAPTURE URL + MASQUAGE IMMÉDIAT DU FLASH
     
     Ce bloc s'exécute PENDANT le parsing HTML (script classique),
     AVANT les modules defer (dashboard-v5.js).
     
     Si from=app détecté : on masque step-panel-1 immédiatement
     pour qu'il ne soit jamais visible. Le bon panel sera affiché
     dans init() à DCL+80ms.
  ════════════════════════════════════════════════════════ */
  var _pendingNav = null;

  (function captureUrl() {
    var sp     = new URLSearchParams(location.search);
    var from   = sp.get('from');
    var step   = parseInt(sp.get('step') || '0', 10);
    var attach = sp.get('attach') === 'last';

    if (!from && !step && !attach) return;

    _pendingNav = { from: from, step: step, attach: attach };
    try { sessionStorage.setItem('pope_v60_nav', JSON.stringify(_pendingNav)); } catch(e) {}

    // Nettoyer l'URL pour que dashboard-v5.js ne la lise pas
    try { history.replaceState({}, '', location.pathname); } catch(e) {}

    // Masquer step-panel-1 IMMÉDIATEMENT pour éviter le flash
    // On injecte un style inline avant même que le DOM soit prêt
    if (from === 'app' || step > 1) {
      var style = document.createElement('style');
      style.id = 'v60-no-flash';
      style.textContent = '#step-panel-1 { display: none !important; }';
      // Injecter dans <head> si disponible, sinon dans <html>
      var head = document.head || document.querySelector('head') || document.documentElement;
      if (head) head.appendChild(style);
    }
  })();

  /* ════════════════════════════════════════════════════════
     handleUrlParams — exécuté dans init() (DCL+80ms)
     À ce moment : v58 restoreDashboardState déjà appelé (DCL+50ms)
     → window._domain disponible
     → on navigue IMMÉDIATEMENT sans setTimeout supplémentaire
  ════════════════════════════════════════════════════════ */
  function handleUrlParams() {
    var nav = _pendingNav;
    if (!nav) {
      try {
        var raw = sessionStorage.getItem('pope_v60_nav');
        if (!raw) return;
        nav = JSON.parse(raw);
      } catch(e) { return; }
    }
    sessionStorage.removeItem('pope_v60_nav');

    var from   = nav.from;
    var step   = nav.step;
    var attach = nav.attach;
    if (!from && !step && !attach) return;

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
      target = (attach && lastId) ? 3 : 2;
    } else {
      target = step || (attach ? 3 : 2);
    }

    // Naviguer immédiatement (domain déjà restauré par v58 init à DCL+50ms)
    goStepV60(target);
    if (target === 3) setTimeout(initStep3, 150);

    // Retirer le style anti-flash maintenant que la navigation est faite
    var noFlash = document.getElementById('v60-no-flash');
    if (noFlash) noFlash.parentNode && noFlash.parentNode.removeChild(noFlash);
  }

  /* ════════════════════════════════════════════════════════
     RESTAURATION DOMAINE — BUG 2
     
     v58 restoreDashboardState() restaure domain + pills + badge
     ce qui permet d'aller à étape 2 sans rechoisir un domain.
     
     On overrides restoreDashboardState pour :
     - Restaurer les champs texte ✓
     - NE PAS restaurer le domain/pills/badge si on est à l'étape 1 ✗
     - Effacer window._domain si step=1 (ou si pas de navigation en cours)
     
     Exception : si une navigation vers étape 2+ est en cours (pendingNav),
     on laisse v58 restaurer le domain normalement.
  ════════════════════════════════════════════════════════ */
  function wrapRestoreDashboardState() {
    var origRestore = window.restoreDashboardState;
    if (!origRestore || origRestore._v60wrapped) return;

    window.restoreDashboardState = function() {
      var result = origRestore.apply(this, arguments);

      // Si navigation vers étape 2+ : garder le domain restauré
      if (_pendingNav && (_pendingNav.step > 1 || _pendingNav.from === 'app')) {
        return result;
      }

      // Sinon (chargement normal étape 1) : effacer le domain pour forcer le choix
      window._domain = '';
      hideDomainBadge();
      // Déselectionner tous les pills
      document.querySelectorAll('.v5-domain-pill').forEach(function(b) {
        b.classList.remove('selected');
      });

      return false; // retourner false = pas de domain = étape 1 obligatoire
    };
    window.restoreDashboardState._v60wrapped = true;
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
    if (!token) { container.innerHTML = '<span style="color:#64748b">Connexion requise.</span>'; return; }
    container.innerHTML = '<span style="color:#64748b;font-style:italic">⏳ Chargement…</span>';
    fetch(API_BASE + '/vault/list?space='+VAULT_SP, {
      headers: { 'Authorization': 'Bearer '+token, 'Content-Type': 'application/json' },
      credentials: 'include'
    })
    .then(function(r) { return r.ok ? r.json() : {files:[]}; })
    .then(function(data) {
      var files = data.files || data.items || [];
      if (!files.length) {
        container.innerHTML = '<span style="color:#64748b">Aucune pièce déposée. ' +
          '<a href="vault.html?space='+VAULT_SP+'&return='+DASH_URL+'" style="color:#0079c1;font-weight:700">Déposer →</a></span>';
        return;
      }
      container.innerHTML = files.slice(0,6).map(function(f) {
        return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f0f4f8">' +
          '<span>📄</span>' +
          '<span style="flex:1;font-size:12px;font-weight:600;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(f.original_name||f.filename||'Fichier')+'</span>' +
          '<span style="font-size:11px;color:#94a3b8;">'+(f.size_kb?f.size_kb+' Ko':'')+'</span></div>';
      }).join('') +
      '<a href="vault.html?space='+VAULT_SP+'&return='+DASH_URL+'?step=3" style="display:inline-block;margin-top:8px;font-size:12px;font-weight:700;color:#0079c1">📂 Gérer le dépôt →</a>';
    })
    .catch(function() {
      container.innerHTML = '<a href="vault.html?space='+VAULT_SP+'&return='+DASH_URL+'" style="font-size:12px;font-weight:700;color:#0079c1">📂 Accéder au dépôt →</a>';
    });
  }

  /* ════════════════════════════════════════════════════════
     Bandeau utilisateur
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
      if (ta) {
        if (w.status==='trial_active' && w.trial_days_left!=null) {
          ta.removeAttribute('hidden');
          var t1=el('trialAlertTitle'),b1=el('trialAlertBody');
          if(t1) t1.textContent='Essai gratuit — '+w.trial_days_left+' jour(s) restant(s)';
          if(b1) b1.textContent='Souscrivez un plan pour continuer après votre essai.';
        } else if (w.status==='trial_expired') {
          ta.removeAttribute('hidden');
          ta.style.background='linear-gradient(to right,#fef2f2,#fff0f0)';
          ta.style.borderColor='#fecaca';
          var t2=el('trialAlertTitle'),b2=el('trialAlertBody');
          if(t2) t2.textContent='Période d\'essai terminée';
          if(b2) b2.textContent='Votre accès est suspendu. Choisissez un plan pour reprendre.';
          var ov=el('trialExpiredOverlay'); if(ov) ov.removeAttribute('hidden');
        }
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

  /* ─── Patch selectDomain ─────────────────────────────── */
  function patchSelectDomain() {
    var orig = window.selectDomain;
    if (!orig || orig._v60patched) return;
    window.selectDomain = function(btn) {
      // NE PAS appeler orig car il utilise selectedDomainBadge (pas v58DomainBadge)
      // Gérer nous-même
      document.querySelectorAll('.v5-domain-pill').forEach(function(b) { b.classList.remove('selected'); });
      btn.classList.add('selected');
      var domain = btn.getAttribute('data-domain') || '';
      var icon   = btn.textContent.trim().split(/\s+/)[0] || '🎯';
      window._domain = domain;
      showDomainBadge(domain, icon);
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
     INIT — DCL + 80ms
     À ce stade :
     - v58 a déjà tourné (+50ms) : domain restauré, goStep patché
     - On verrouille goStep, on wrappe restoreState, on navigue
  ════════════════════════════════════════════════════════ */
  function init() {
    // 1. Verrouiller window.goStep EN PREMIER
    lockGoStep();

    // 2. Wrapper restoreDashboardState avant que v58 ne l'appelle encore
    wrapRestoreDashboardState();

    // 3. Patcher selectDomain
    patchSelectDomain();

    // 4. Bandeau utilisateur
    setTimeout(hydrateUser, 200);

    // 5. Naviguer si retour depuis APP (SANS setTimeout — domain déjà dispo depuis v58+50ms)
    handleUrlParams();

    // 6. Vérification bandeau tardive
    setTimeout(function() {
      var g = el('dashWelcome');
      if (!g || g.textContent === 'Bonjour 👋' || g.textContent.length <= 10) hydrateUser();
      else _hydrated = true;
    }, 1200);

    // 7. Re-lock par sécurité (rattraper d'éventuels overwrites tardifs)
    setTimeout(lockGoStep, 300);
    setTimeout(lockGoStep, 800);
    setTimeout(patchSelectDomain, 400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(init, 80); });
  } else {
    setTimeout(init, 80);
  }

})();
