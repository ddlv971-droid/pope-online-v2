/**
 * POPE Online — Dashboard V60 (correctif définitif)
 *
 * BUGS CORRIGÉS :
 *   1. Retour APP → toujours étape 2 (sauf draft réel confirmé + attach=last)
 *   2. Étape 3 vide → clés d'état unifiées, garde domaine corrigée
 *   3. Étape 4 vide → garde domaine corrigée, updateRecap fiable
 *   4. Bandeau utilisateur → retry robuste avec cache fallback
 */
(function () {
  'use strict';

  var isPrivate = /dashboard-private/i.test(location.pathname);
  var APP_URL   = isPrivate ? 'app-private.html' : 'app.html';
  var DASH_URL  = isPrivate ? 'dashboard-private.html' : 'dashboard.html';
  var VAULT_SP  = isPrivate ? 'private' : 'public';
  var API_BASE  = (window.__POPE_API_BASE__ || 'https://pope-online-v2.onrender.com').replace(/\/$/, '');

  // Toutes les clés d'état connues (v58 écrit dans pope_v58_state_*)
  var STATE_KEYS = [
    'pope_v58_state_' + (isPrivate ? 'private' : 'public'),
    'pope_v60_state_' + (isPrivate ? 'priv' : 'pub'),
    'pope_need_state_' + (isPrivate ? 'private' : 'public'),
    'pope_need_state_v61_' + (isPrivate ? 'private' : 'public')
  ];

  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s||'').replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];}); }
  function getToken() { return sessionStorage.getItem('pope_session_token')||localStorage.getItem('pope_session_token')||''; }

  // Lire l'état depuis n'importe quelle clé connue
  function readState() {
    for (var i = 0; i < STATE_KEYS.length; i++) {
      var raw = sessionStorage.getItem(STATE_KEYS[i]) || localStorage.getItem(STATE_KEYS[i]);
      if (raw) { try { return JSON.parse(raw); } catch(e) {} }
    }
    return {};
  }

  // Résoudre le domaine depuis toutes les sources disponibles
  function resolveDomain() {
    if (window._domain) return window._domain;
    var pill = document.querySelector('.v5-domain-pill.selected');
    if (pill && pill.getAttribute('data-domain')) return pill.getAttribute('data-domain');
    var st = readState();
    if (st.domain) return st.domain;
    return '';
  }

  /* ════════════════════════════════════════════════════════
     goStep V60 — version définitive
     Corrige le BUG 2 et BUG 3 : la garde domaine utilise
     resolveDomain() qui lit TOUTES les sources, évitant
     que l'étape 3/4 soit bloquée à cause d'un domain vide
     dans une clé différente de celle que v58 a remplie.
  ════════════════════════════════════════════════════════ */
  function goStepV60(n) {
    n = parseInt(n, 10) || 1;

    // Synchroniser window._domain avant la garde
    var domain = resolveDomain();
    if (domain) window._domain = domain;

    if (n > 1 && !window._domain) {
      var g = el('domainGrid');
      if (g) {
        g.style.boxShadow = '0 0 0 3px #ef4444';
        g.style.borderRadius = '14px';
        setTimeout(function(){ g.style.boxShadow=''; g.style.borderRadius=''; }, 1500);
      }
      return; // ne pas modifier _step, rester sur l'étape actuelle
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

    if (n === 3) setTimeout(initStep3, 80);
    if (n === 4) setTimeout(function(){ if (window.updateRecap) window.updateRecap(); }, 80);

    if (window.saveDashboardState) window.saveDashboardState();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ════════════════════════════════════════════════════════
     handleUrlParams — corrige le BUG 1
     
     Règle stricte :
     - from=app + attach=last + draft réel → étape 3
     - from=app sans draft réel → étape 2 (TOUJOURS)
     - Écrase le résultat de dashboard-v58.js handleUrlParams
       en s'exécutant 50ms après lui (v58: 250ms, nous: 300ms)
  ════════════════════════════════════════════════════════ */
  function handleUrlParams() {
    var sp     = new URLSearchParams(location.search);
    var from   = sp.get('from');
    var step   = parseInt(sp.get('step') || '0', 10);
    var attach = sp.get('attach') === 'last';

    if (!from && !step && !attach) return;

    // Récupérer l'ID du dernier draft si attach=last
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
      // ═══ RÈGLE CLÉ ═══
      // Retour depuis l'APP : étape 3 SEULEMENT si draft réel confirmé
      // Sinon toujours étape 2
      target = (attach && lastId) ? 3 : 2;
    } else {
      target = step || (attach ? 3 : 2);
    }

    // S'exécute à 300ms, APRÈS dashboard-v58 handleUrlParams (250ms)
    setTimeout(function() {
      goStepV60(target);
      if (target === 3) setTimeout(initStep3, 150);
    }, 300);
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
        (arr || []).forEach(function(g) {
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
        var lbl = (g.title || g.usecaseLabel || 'Draft IA') +
                  (g.domain ? ' — ' + g.domain : '') +
                  (g.createdAt ? ' — ' + new Date(g.createdAt).toLocaleString('fr-FR') : '');
        return '<option value="' + esc(String(g.id)) + '">' + esc(lbl) + '</option>';
      }).join('');

    if (cur) sel.value = cur;

    sel.onchange = function() {
      sessionStorage.setItem('pope_v58_attached_gen', sel.value || '');
    };

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
    if (!token) { container.innerHTML = '<span style="color:#64748b">Connexion requise pour accéder au dépôt.</span>'; return; }
    container.innerHTML = '<span style="color:#64748b;font-style:italic">⏳ Chargement…</span>';
    fetch(API_BASE + '/vault/list?space=' + VAULT_SP, {
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      credentials: 'include'
    })
    .then(function(r) { return r.ok ? r.json() : { files: [] }; })
    .then(function(data) {
      var files = data.files || data.items || [];
      if (!files.length) {
        container.innerHTML = '<span style="color:#64748b">Aucune pièce déposée. <a href="vault.html?space=' + VAULT_SP + '&return=' + DASH_URL + '" style="color:#0079c1;font-weight:700">Déposer des pièces →</a></span>';
        return;
      }
      container.innerHTML = files.slice(0,6).map(function(f) {
        return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f0f4f8">' +
          '<span>📄</span>' +
          '<span style="flex:1;font-size:12px;font-weight:600;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(f.original_name||f.filename||'Fichier') + '</span>' +
          '<span style="font-size:11px;color:#94a3b8;">' + (f.size_kb ? f.size_kb + ' Ko' : '') + '</span></div>';
      }).join('') +
      '<a href="vault.html?space=' + VAULT_SP + '&return=' + DASH_URL + '?step=3" style="display:inline-block;margin-top:8px;font-size:12px;font-weight:700;color:#0079c1">📂 Gérer le dépôt →</a>';
    })
    .catch(function() {
      container.innerHTML = '<a href="vault.html?space=' + VAULT_SP + '&return=' + DASH_URL + '" style="font-size:12px;font-weight:700;color:#0079c1">📂 Accéder au dépôt sécurisé →</a>';
    });
  }

  /* ════════════════════════════════════════════════════════
     Bandeau utilisateur — BUG 4
     Attend que le token soit disponible, retry robuste,
     ne réécrit pas si le module ES a déjà rempli.
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
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      credentials: 'include'
    })
    .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function(data) {
      var u = data.user || {}, w = data.wallet || {};
      _hydrated = true;
      try { localStorage.setItem('pope_session_user', JSON.stringify({user:u, wallet:w})); } catch(e) {}
      var fn = (u.full_name||u.name||u.prenom||'').trim().split(/\s+/)[0];
      var g = el('dashWelcome'); if (g && fn) g.textContent = 'Bonjour ' + fn + ' 👋';
      var l = el('expertLeftN'); if (l) l.textContent = (w.expert_left!=null)?String(w.expert_left):'—';
      var p = el('planN'); if (p) p.textContent = w.plan_label||w.plan||'Free';
      var ta = el('trialAlert');
      if (ta) {
        if (w.status === 'trial_active' && w.trial_days_left != null) {
          ta.removeAttribute('hidden');
          var t1=el('trialAlertTitle'),b1=el('trialAlertBody');
          if(t1) t1.textContent='Essai gratuit — '+w.trial_days_left+' jour(s) restant(s)';
          if(b1) b1.textContent='Souscrivez un plan pour continuer après votre essai.';
        } else if (w.status === 'trial_expired') {
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

  /* ─── Patcher selectDomain ───────────────────────────── */
  function patchSelectDomain() {
    var orig = window.selectDomain;
    if (!orig || orig._v60patched) return;
    window.selectDomain = function(btn) {
      orig(btn);
      if (btn) window._domain = btn.getAttribute('data-domain') || window._domain || '';
      if (window.saveDashboardState) window.saveDashboardState();
    };
    window.selectDomain._v60patched = true;
  }

  function patchGoStep() {
    if (window.goStep === goStepV60) return;
    window.goStep    = goStepV60;
    window.forceStep = goStepV60;
  }

  /* ─── Auto-save ──────────────────────────────────────── */
  document.addEventListener('input', function() {
    if (window.saveDashboardState) window.saveDashboardState();
  }, true);
  document.addEventListener('change', function(e) {
    if (window.saveDashboardState) window.saveDashboardState();
    if (e.target && e.target.id === 'archiveAttachSelect') {
      sessionStorage.setItem('pope_v58_attached_gen', e.target.value || '');
    }
  }, true);

  /* ─── Init ───────────────────────────────────────────── */
  function init() {
    patchSelectDomain();
    patchGoStep();
    if (window.restoreDashboardState) window.restoreDashboardState();
    setTimeout(hydrateUser, 300);
    handleUrlParams();
    var st = readState();
    if (st.step === 3 && resolveDomain()) setTimeout(initStep3, 200);
    setTimeout(function() {
      var g = el('dashWelcome');
      if (!g || !g.textContent || g.textContent === 'Bonjour 👋' || g.textContent.length <= 10) {
        hydrateUser();
      } else { _hydrated = true; }
    }, 900);
  }

  // Patches tardifs pour rattraper les inits asynchrones
  [200, 700, 1200].forEach(function(ms) {
    setTimeout(function() { patchSelectDomain(); patchGoStep(); }, ms);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(init, 80); });
  } else {
    setTimeout(init, 80);
  }

})();
