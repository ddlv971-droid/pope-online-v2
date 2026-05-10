/**
 * POPE Online — Dashboard V60
 * Correctifs ciblés sur la structure HTML existante (IDs réels)
 * ─────────────────────────────────────────────────────────────
 * BUG 1 : Persistance / retour depuis app.html → étape perdue
 * BUG 2 : Étape 3 (archiveAttachSelect, vaultExpertList) vide
 * BUG 3 : Bandeau domaine (v58DomainBadge) non hydraté
 * BUG 4 : Bandeau utilisateur (dashWelcome, expertLeftN, planN) vide
 * BUG 5 : Retour depuis app → forcé à étape 1 alors que domaine perdu
 */
(function () {
  'use strict';

  /* ─── Détection espace ───────────────────────────────── */
  var isPrivate  = /dashboard-private/i.test(location.pathname);
  var APP_URL    = isPrivate ? 'app-private.html' : 'app.html';
  var DASH_URL   = isPrivate ? 'dashboard-private.html' : 'dashboard.html';
  var VAULT_SP   = isPrivate ? 'private' : 'public';
  var STATE_KEY  = 'pope_v60_state_' + (isPrivate ? 'priv' : 'pub');
  var API_BASE   = (window.__POPE_API_BASE__ || 'https://pope-online-v2.onrender.com').replace(/\/$/, '');

  /* ─── Helpers ────────────────────────────────────────── */
  function el(id) { return document.getElementById(id); }
  function getToken() {
    return sessionStorage.getItem('pope_session_token') ||
           localStorage.getItem('pope_session_token') || '';
  }
  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  /* ─── État persistant ────────────────────────────────── */
  function saveState() {
    try {
      var data = {
        step:   window._step || 1,
        domain: window._domain || ''
      };
      // Champs de formulaire
      var fields = ['besoInTitle','descContexte','descProbleme','descObjectif',
                    'descDecision','descLivrable','descContraintes','descRisques',
                    'descActeurs','descPublic','needDeadline','descPieces',
                    'descNiveau','besoInDesc'];
      fields.forEach(function(id) {
        var e = el(id); if (e) data[id] = e.value;
      });
      var radio = document.querySelector('input[name="besoType"]:checked');
      if (radio) data.besoType = radio.value;
      var attachSel = el('archiveAttachSelect');
      if (attachSel) data.attachedGenId = attachSel.value;
      localStorage.setItem(STATE_KEY, JSON.stringify(data));
      sessionStorage.setItem(STATE_KEY, JSON.stringify(data));
    } catch(e) {}
  }

  function loadState() {
    try {
      var raw = sessionStorage.getItem(STATE_KEY) || localStorage.getItem(STATE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
  }

  function restoreState() {
    var s = loadState();
    if (!s) return false;

    // V61.1 : NE PAS restaurer le domaine au chargement initial.
    // Le domaine est restauré uniquement si on revient depuis app.html (?from=app).
    // Cela empêche l'utilisateur d'aller à l'étape > 1 sans rechoisir un domaine.
    // window._domain restera '' jusqu'à ce que l'utilisateur clique un pill.

    // Champs texte
    var fields = ['besoInTitle','descContexte','descProbleme','descObjectif',
                  'descDecision','descLivrable','descContraintes','descRisques',
                  'descActeurs','descPublic','needDeadline','descPieces',
                  'descNiveau','besoInDesc'];
    fields.forEach(function(id) {
      var e = el(id); if (e && s[id]) e.value = s[id];
    });

    // Radio
    if (s.besoType) {
      var r = document.querySelector('input[name="besoType"][value="' + s.besoType + '"]');
      if (r) r.checked = true;
    }

    return false; // V61.1 : domaine toujours vide au premier chargement
  }

  /* ─── Badge domaine (v58DomainBadge existant) ────────── */
  function updateDomainBadge(domain) {
    var badge  = el('v58DomainBadge');
    var name   = el('v58DomainName');
    var icon   = el('v58DomainIcon');
    if (!badge) return;
    if (domain) {
      badge.style.display = 'flex';
      if (name) name.textContent = domain;
      // Trouver l'icône depuis le pill sélectionné
      var pill = document.querySelector('.v5-domain-pill.selected');
      if (icon && pill) {
        icon.textContent = pill.textContent.trim().split(' ')[0] || '🎯';
      }
    } else {
      badge.style.display = 'none';
    }
  }

  /* ─── goStep corrigé (remplace la version originale) ─── */
  function goStepV60(n, force) {
    // Restaurer domaine si nécessaire avant la garde
    var s = loadState();
    if (s && s.domain && !window._domain) {
      window._domain = s.domain;
    }

    // Garde domaine pour étapes > 1
    if (n > 1 && !window._domain) {
      // Flash le domainGrid
      var g = el('domainGrid');
      if (g) {
        g.style.boxShadow = '0 0 0 3px #ef4444';
        g.style.borderRadius = '14px';
        setTimeout(function(){ g.style.boxShadow=''; g.style.borderRadius=''; }, 1500);
      }
      n = 1;
    }

    window._step = n;
    saveState();

    // Panels
    for (var i = 1; i <= 4; i++) {
      var p = el('step-panel-' + i);
      if (p) p.classList.toggle('active', i === n);
    }
    // Steps visuels
    document.querySelectorAll('.v5-step').forEach(function(s) {
      var sn = parseInt(s.dataset.step, 10);
      s.classList.toggle('active', sn === n);
      s.classList.toggle('done', sn < n);
    });

    if (n === 3) setTimeout(initStep3, 80);
    if (n === 4) { if (window.updateRecap) window.updateRecap(); }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ─── Étape 3 — Drafts IA ────────────────────────────── */
  function loadGenerations() {
    try { return JSON.parse(localStorage.getItem('pope_v54_generations') || '[]'); } catch(e) { return []; }
  }

  function initStep3() {
    fillDraftSelect();
    loadVaultFiles();
  }

  function fillDraftSelect() {
    var sel = el('archiveAttachSelect');
    if (!sel) return;
    var gens = loadGenerations();
    var s    = loadState();
    var cur  = (s && s.attachedGenId) ||
               sessionStorage.getItem('pope_v58_attached_gen') ||
               sessionStorage.getItem('pope_v54_last_generation_id') || '';

    sel.innerHTML = '<option value="">Ne pas joindre de draft préparé</option>' +
      gens.map(function(g, i) {
        var lbl = (g.title || g.usecaseLabel || 'Draft IA') + ' — ' +
                  (g.createdAt ? new Date(g.createdAt).toLocaleString('fr-FR') : '');
        var id  = g.id != null ? g.id : i;
        return '<option value="' + esc(String(id)) + '">' + esc(lbl) + '</option>';
      }).join('');

    if (cur) sel.value = cur;

    // Statut draft
    var status = el('v59DraftStatus');
    if (status) status.style.display = (gens.length && sel.value) ? 'block' : 'none';

    // Lien "Créer un draft" → app.html avec retour
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
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      credentials: 'include'
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var files = data.files || data.items || [];
      if (!files.length) {
        container.innerHTML = '<span style="color:#64748b">Aucune pièce déposée. ' +
          '<a href="vault.html?space=' + VAULT_SP + '&return=' + DASH_URL + '" ' +
          'style="color:#0079c1;font-weight:700">Déposer des pièces →</a></span>';
        return;
      }
      container.innerHTML = files.slice(0, 6).map(function(f) {
        return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f0f4f8">' +
          '<span>📄</span>' +
          '<span style="flex:1;font-size:12px;font-weight:600;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
            esc(f.original_name || f.filename || 'Fichier') + '</span>' +
          '<span style="font-size:11px;color:#94a3b8;white-space:nowrap">' +
            (f.size_kb ? f.size_kb + ' Ko' : '') + '</span>' +
          '</div>';
      }).join('') +
      '<a href="vault.html?space=' + VAULT_SP + '&return=' + DASH_URL + '?step=3" ' +
      'style="display:inline-block;margin-top:8px;font-size:12px;font-weight:700;color:#0079c1">📂 Gérer le dépôt →</a>';
    })
    .catch(function() {
      container.innerHTML = '<a href="vault.html?space=' + VAULT_SP + '&return=' + DASH_URL + '" ' +
        'style="font-size:12px;font-weight:700;color:#0079c1">📂 Accéder au dépôt sécurisé →</a>';
    });
  }

  /* ─── Bandeau utilisateur ────────────────────────────── */
  function hydrateUser() {
    var token = getToken();
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    fetch(API_BASE + '/auth/me', { method: 'GET', headers: headers, credentials: 'include' })
    .then(function(r) { if (!r.ok) throw 0; return r.json(); })
    .then(function(data) {
      var user   = data.user   || {};
      var wallet = data.wallet || {};

      // Mettre en cache
      if (user && Object.keys(user).length) {
        localStorage.setItem('pope_session_user', JSON.stringify(user));
      }

      // Prénom
      var prenom = user.full_name ? user.full_name.split(' ')[0] : (user.first_name || '');
      var greet  = el('dashWelcome');
      if (greet && prenom) greet.textContent = 'Bonjour ' + prenom + ' 👋';

      // Consultations restantes
      var leftEl = el('expertLeftN');
      if (leftEl) leftEl.textContent = wallet.expert_left != null ? wallet.expert_left : '—';

      // Plan
      var planEl = el('planN');
      if (planEl) planEl.textContent = wallet.plan_label || user.plan_label || 'Free';

      // Alerte trial
      var trialAlert = el('trialAlert');
      if (trialAlert) {
        if (wallet.status === 'trial_active' && wallet.trial_days_left != null) {
          trialAlert.removeAttribute('hidden');
          var tTitle = el('trialAlertTitle');
          var tBody  = el('trialAlertBody');
          if (tTitle) tTitle.textContent = 'Essai gratuit — ' + wallet.trial_days_left + ' jour(s) restant(s)';
          if (tBody)  tBody.textContent  = 'Souscrivez un plan pour continuer après votre essai.';
        } else if (wallet.status === 'trial_expired') {
          trialAlert.removeAttribute('hidden');
          trialAlert.style.background = 'linear-gradient(to right,#fef2f2,#fff0f0)';
          trialAlert.style.borderColor = '#fecaca';
          var tTitle2 = el('trialAlertTitle');
          var tBody2  = el('trialAlertBody');
          if (tTitle2) tTitle2.textContent = 'Période d\'essai terminée';
          if (tBody2)  tBody2.textContent  = 'Votre accès est suspendu. Choisissez un plan pour reprendre.';
        }
      }
    })
    .catch(function() {
      // Fallback depuis le cache
      try {
        var cached = JSON.parse(localStorage.getItem('pope_session_user') || 'null');
        if (cached) {
          var prenom = cached.full_name ? cached.full_name.split(' ')[0] : '';
          var greet  = el('dashWelcome');
          if (greet && prenom) greet.textContent = 'Bonjour ' + prenom + ' 👋';
        }
      } catch(e) {}
    });
  }

  /* ─── Retour depuis app.html ─────────────────────────── */
  function handleUrlParams() {
    var sp     = new URLSearchParams(location.search);
    var from   = sp.get('from');
    var step   = parseInt(sp.get('step') || '0', 10);
    var attach = sp.get('attach') === 'last';

    if (!from && !step && !attach) return;

    // Récupérer le dernier ID de génération
    if (attach) {
      var lastId = sessionStorage.getItem('pope_v54_last_generation_id') ||
                   sessionStorage.getItem('pope_v58_last_gen') || '';
      if (lastId) {
        sessionStorage.setItem('pope_v58_attached_gen', lastId);
        var s = loadState() || {};
        s.attachedGenId = lastId;
        try {
          localStorage.setItem(STATE_KEY, JSON.stringify(s));
          sessionStorage.setItem(STATE_KEY, JSON.stringify(s));
        } catch(e) {}
      }
    }

    var target = step || (attach ? 3 : 2);
    setTimeout(function() { goStepV60(target); }, 400);
  }

  /* ─── Patcher selectDomain pour sauvegarder ─────────── */
  function patchSelectDomain() {
    var orig = window.selectDomain;
    if (!orig || orig._v60patched) return;
    window.selectDomain = function(btn) {
      orig(btn);
      var domain = btn.getAttribute('data-domain');
      window._domain = domain;
      updateDomainBadge(domain);
      saveState();
    };
    window.selectDomain._v60patched = true;
  }

  /* ─── Patcher goStep pour passer par notre version ───── */
  function patchGoStep() {
    if (window.goStep && window.goStep._v60patched) return;
    window.goStep = goStepV60;
    window.goStep._v60patched = true;
  }

  /* ─── Auto-save sur saisie ───────────────────────────── */
  document.addEventListener('input', saveState, true);
  document.addEventListener('change', function(e) {
    saveState();
    if (e.target && e.target.id === 'archiveAttachSelect') {
      sessionStorage.setItem('pope_v58_attached_gen', e.target.value || '');
    }
  }, true);

  /* ─── Init ───────────────────────────────────────────── */
  function init() {
    patchSelectDomain();
    patchGoStep();

    // Restaurer l'état
    var hasDomain = restoreState();

    // V61.1 : NE PAS restaurer l'étape persistée au chargement initial.
    // L'utilisateur doit toujours repartir de l'étape 1 (choix du domaine).
    // La navigation vers une étape > 1 n'est autorisée que via handleUrlParams()
    // (retour depuis app.html avec ?from=app&step=N).
    var s = loadState(); // Déclaré pour utilisation en aval

    // Hydratation utilisateur
    hydrateUser();

    // Gérer les paramètres URL (retour de app.html)
    handleUrlParams();

    // V61.1 : initStep3 appelé UNIQUEMENT via goStepV60(3), jamais au chargement.
  }

  // Patch tardif au cas où les fonctions sont définies après ce script
  setTimeout(function() {
    patchSelectDomain();
    patchGoStep();
  }, 300);
  setTimeout(function() {
    patchSelectDomain();
    patchGoStep();
  }, 800);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(init, 80); });
  } else {
    setTimeout(init, 80);
  }

})();
