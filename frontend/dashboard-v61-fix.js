/**
 * POPE Online — V61 FIX FINAL (stabilisé V61+)
 *
 * BUGS CORRIGÉS :
 *  1. Étape 3 au chargement → init() ne saute PLUS vers l'étape persistée
 *     si elle est > 1 au premier chargement sans navigation APP
 *  2. Bandeau "Bonjour denis971" → utilise full_name, puis capitalize propre,
 *     jamais le préfixe email
 *  3. expert_left ne s'affiche pas → mapping corrigé depuis wallet
 *  4. Étapes 3 et 4 entièrement fonctionnelles (vault + recap complet)
 *  5. Retour depuis APP → toujours étape 2, jamais étape 3 auto
 */
(function () {
  'use strict';

  var isPrivate = /dashboard-private\.html/i.test(location.pathname);
  var DASH_URL  = isPrivate ? 'dashboard-private.html' : 'dashboard.html';
  var APP_URL   = isPrivate ? 'app-private.html' : 'app.html';
  var VAULT_SP  = isPrivate ? 'private' : 'public';
  var API_BASE  = (window.__POPE_API_BASE__ || 'https://pope-online-v2.onrender.com').replace(/\/$/, '');

  var STATE_KEYS = [
    'pope_v61_state_' + (isPrivate ? 'private' : 'public'),
    'pope_v60_state_' + (isPrivate ? 'priv' : 'pub'),
    'pope_v58_state_' + (isPrivate ? 'private' : 'public')
  ];

  var _bootDone = false;
  var _isFirstLoad = true; // Flag : premier chargement de session

  function $(id) { return document.getElementById(id); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function token() { return sessionStorage.getItem('pope_session_token') || localStorage.getItem('pope_session_token') || ''; }

  /* ── State ─────────────────────────────────────────── */
  function readKey(k) { try { var r = sessionStorage.getItem(k) || localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch(e) { return null; } }

  function readState() {
    for (var i = 0; i < STATE_KEYS.length; i++) {
      var s = readKey(STATE_KEYS[i]);
      if (s) return normalizeState(s);
    }
    return normalizeState({});
  }

  function normalizeState(s) {
    s = s || {};
    return {
      step:        Number(s.step || 1),
      domain:      s.domain || window._domain || '',
      domainIcon:  s.domainIcon || '🎯',
      title:       s.title || s.besoInTitle || '',
      contexte:    s.contexte || s.descContexte || '',
      probleme:    s.probleme || s.descProbleme || '',
      objectif:    s.objectif || s.descObjectif || '',
      decision:    s.decision || s.descDecision || '',
      livrable:    s.livrable || s.descLivrable || '',
      contraintes: s.contraintes || s.descContraintes || '',
      risques:     s.risques || s.descRisques || '',
      acteurs:     s.acteurs || s.descActeurs || '',
      public_c:    s.public_c || s.descPublic || '',
      deadline:    s.deadline || s.needDeadline || '',
      pieces:      s.pieces || s.descPieces || '',
      niveau:      s.niveau || s.descNiveau || '',
      desc:        s.desc || s.besoInDesc || '',
      type:        s.type || s.besoType || 'conseil',
      attachedGenId: s.attachedGenId || ''
    };
  }

  function collectFields() {
    var map = {
      title:'besoInTitle', contexte:'descContexte', probleme:'descProbleme', objectif:'descObjectif',
      decision:'descDecision', livrable:'descLivrable', contraintes:'descContraintes', risques:'descRisques',
      acteurs:'descActeurs', public_c:'descPublic', deadline:'needDeadline', pieces:'descPieces',
      niveau:'descNiveau', desc:'besoInDesc'
    };
    var out = { domain: window._domain || '', step: window._step || 1 };
    Object.keys(map).forEach(function(k) { var e = $(map[k]); if (e) out[k] = e.value || ''; });
    var r = document.querySelector('input[name="besoType"]:checked');
    if (r) out.type = r.value;
    var sel = $('archiveAttachSelect'); if (sel) out.attachedGenId = sel.value || '';
    return out;
  }

  function writeState(patch) {
    var data = normalizeState(Object.assign({}, readState(), patch || {}, collectFields()));
    var json = JSON.stringify(data);
    STATE_KEYS.forEach(function(k) { try { sessionStorage.setItem(k, json); localStorage.setItem(k, json); } catch(e) {} });
    return data;
  }

  /* ── Restauration des champs ────────────────────────── */
  function restoreFields() {
    var s = readState();
    var map = {
      besoInTitle:s.title, descContexte:s.contexte, descProbleme:s.probleme, descObjectif:s.objectif,
      descDecision:s.decision, descLivrable:s.livrable, descContraintes:s.contraintes, descRisques:s.risques,
      descActeurs:s.acteurs, descPublic:s.public_c, needDeadline:s.deadline, descPieces:s.pieces,
      descNiveau:s.niveau, besoInDesc:s.desc
    };
    Object.keys(map).forEach(function(id) { var e = $(id); if (e && map[id] && !e.value) e.value = map[id]; });
    if (s.type) { var radio = document.querySelector('input[name="besoType"][value="' + s.type + '"]'); if (radio) radio.checked = true; }
    // Domaine : restaurer UNIQUEMENT si navigation depuis APP (pas au premier chargement)
    if (s.domain && !_isFirstLoad) setDomain(s.domain, s.domainIcon, true);
    updateAccordions();
    return s;
  }

  function setDomain(domain, icon, silent) {
    if (!domain) return;
    window._domain = domain;
    try { if (typeof _domain !== 'undefined') _domain = domain; } catch(e) {}
    document.querySelectorAll('.v5-domain-pill').forEach(function(b) {
      var sel = b.getAttribute('data-domain') === domain;
      b.classList.toggle('selected', sel);
      if (sel && !icon) icon = (b.textContent || '').trim().split(' ')[0] || '🎯';
    });
    // Badge v58
    var badge = $('v58DomainBadge'), nm = $('v58DomainName'), ic = $('v58DomainIcon');
    if (badge) { badge.style.display = 'flex'; badge.classList.add('visible'); }
    if (nm) nm.textContent = domain;
    if (ic) ic.textContent = icon || '🎯';
    // Badge v56
    var badge2 = $('selectedDomainBadge'), nm2 = $('selectedDomainLabel'), ic2 = $('selectedDomainIcon');
    if (badge2) { badge2.style.display = 'block'; }
    if (nm2) nm2.textContent = domain;
    if (ic2) ic2.textContent = icon || '🎯';
    if (!silent) writeState({ domain: domain, domainIcon: icon || '🎯' });
  }

  function updateAccordions() {
    var pairs = [
      ['v58AccCtx','descContexte','prevCtx'], ['v58AccObj','descObjectif','prevObj'],
      ['v58AccCon','descContraintes','prevCon'], ['v58AccAct','descActeurs','prevAct'],
      ['v58AccPlus','besoInDesc','prevPlus']
    ];
    pairs.forEach(function(p) {
      var acc = $(p[0]), field = $(p[1]), prev = $(p[2]);
      if (!acc || !field) return;
      var val = (field.value || '').trim();
      acc.classList.toggle('has-value', !!val);
      if (prev && val) prev.textContent = val.slice(0, 70) + (val.length > 70 ? '…' : '');
    });
  }

  /* ── Navigation entre étapes ──────────────────────────
     RÈGLE CLEF : showStep(1) toujours si pas de domain.
     renderStep3() appelé UNIQUEMENT si on va à l'étape 3.
     Jamais d'appel automatique à renderStep3() dans init().
  ─────────────────────────────────────────────────────── */
  function showStep(n, opts) {
    opts = opts || {};
    n = parseInt(n, 10) || 1;

    // Garde domaine strict
    if (n > 1 && !window._domain) n = 1;

    window._step = n;
    try { if (typeof _step !== 'undefined') _step = n; } catch(e) {}

    document.querySelectorAll('.v5-step-panel').forEach(function(p) {
      var active = p.id === 'step-panel-' + n;
      p.classList.toggle('active', active);
      p.style.display = active ? 'block' : 'none';
    });
    document.querySelectorAll('.v5-step').forEach(function(s) {
      var sn = parseInt(s.dataset.step, 10);
      s.classList.toggle('active', sn === n);
      s.classList.toggle('done', sn < n);
    });

    writeState({ step: n });

    // Contenu conditionnel par étape
    if (n === 3) renderStep3();
    if (n === 4) renderStep4();

    if (!opts.noScroll) {
      var activePanel = document.getElementById('step-panel-' + n);
      if (activePanel) {
        setTimeout(function() { activePanel.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }

  /* ── Étape 3 : drafts + vault ──────────────────────── */
  function loadGenerations() {
    try {
      var a = JSON.parse(localStorage.getItem('pope_v54_generations') || '[]');
      if (a.length) return a;
      return JSON.parse(localStorage.getItem('pope_v53_generations') || '[]');
    } catch(e) { return []; }
  }

  function selectedDraftId() {
    return sessionStorage.getItem('pope_v61_attached_gen') ||
           sessionStorage.getItem('pope_v58_attached_gen') ||
           sessionStorage.getItem('pope_v54_last_generation_id') ||
           readState().attachedGenId || '';
  }

  function renderStep3() {
    console.log('[POPE V61] renderStep3 appelé — gens:', loadGenerations().length);
    var sel = $('archiveAttachSelect');
    var gens = loadGenerations();
    var cur  = selectedDraftId();

    if (sel) {
      sel.innerHTML = '<option value="">Ne pas joindre de draft préparé</option>' +
        gens.map(function(g, i) {
          var id  = String(g.id != null ? g.id : i);
          var lbl = (g.title || g.usecaseLabel || 'Draft IA') +
                    (g.createdAt ? ' — ' + new Date(g.createdAt).toLocaleString('fr-FR') : '');
          return '<option value="' + esc(id) + '">' + esc(lbl) + '</option>';
        }).join('');
      if (cur) sel.value = cur;
      sel.onchange = function() {
        sessionStorage.setItem('pope_v61_attached_gen', sel.value || '');
        sessionStorage.setItem('pope_v58_attached_gen', sel.value || '');
        writeState({ attachedGenId: sel.value || '' });
      };
    }

    var status = $('v59DraftStatus');
    if (status) {
      var hasDraft = gens.length && sel && sel.value;
      status.style.display = hasDraft ? 'block' : 'none';
      status.textContent   = hasDraft ? '✅ Draft disponible et sélectionné' : '';
    }

    var lnk = $('lnkDraftStep3');
    if (lnk) { lnk.href = APP_URL + '?from=dashboard&step=2'; lnk.textContent = gens.length ? 'Voir / modifier le draft →' : 'Créer un draft (optionnel) →'; }
    var topDraft = $('lnkDraftTool');
    if (topDraft) topDraft.href = APP_URL + '?from=dashboard&step=2';

    // Si aucun draft : afficher un message incitatif sous le select
    var noDraftMsg = $('v61NoDraftMsg');
    if (!noDraftMsg && sel && !gens.length) {
      noDraftMsg = document.createElement('p');
      noDraftMsg.id = 'v61NoDraftMsg';
      noDraftMsg.style.cssText = 'font-size:12px;color:#64748b;margin-top:8px;line-height:1.6';
      noDraftMsg.innerHTML = '💡 Vous pouvez soumettre directement sans draft. L'outil IA est optionnel.';
      sel.after(noDraftMsg);
    }

    renderVaultList();
  }

  function renderVaultList() {
    var c = $('vaultExpertList'); if (!c) return;
    var t = token();
    var manageUrl = 'vault.html?space=' + VAULT_SP + '&return=' + encodeURIComponent(DASH_URL + '?step=3');
    var fallback  = '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">' +
                    '<span style="color:#64748b;font-size:12px">Aucune pièce dans le dépôt sécurisé — optionnel.</span>' +
                    '<a href="' + manageUrl + '" style="font-size:12px;font-weight:700;color:#0079c1;white-space:nowrap">📂 Déposer des pièces →</a></div>';
    if (!t) { c.innerHTML = fallback; return; }
    c.innerHTML = '<span style="color:#64748b;font-style:italic">⏳ Chargement du dépôt…</span>';
    fetch(API_BASE + '/vault/list?space=' + VAULT_SP, {
      headers: { Authorization: 'Bearer ' + t },
      credentials: 'include'
    })
    .then(function(r) { return r.ok ? r.json() : Promise.reject(); })
    .then(function(data) {
      var files = data.files || data.items || [];
      if (!files.length) { c.innerHTML = fallback; return; }
      sessionStorage.setItem('pope_v61_vault_files', JSON.stringify(files));
      c.innerHTML = files.slice(0, 8).map(function(f) {
        return '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #eef2f7">' +
               '📄<span style="flex:1;font-weight:600;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
               esc(f.original_name || f.filename || f.name || 'Document') + '</span>' +
               '<span style="font-size:11px;color:#64748b">' + esc(f.size_kb ? f.size_kb + ' Ko' : '') + '</span></div>';
      }).join('') + '<a href="' + manageUrl + '" class="v5-btn-ghost-sm" style="display:inline-block;margin-top:10px">📂 Gérer le dépôt →</a>';
    })
    .catch(function() { c.innerHTML = fallback; });
  }

  /* ── Étape 4 : récapitulatif ────────────────────────── */
  function buildDescription(s) {
    s = s || readState();
    var rows = [
      ['Contexte', s.contexte], ['Problème', s.probleme], ['Objectif', s.objectif],
      ['Décision attendue', s.decision], ['Livrable attendu', s.livrable],
      ['Contraintes', s.contraintes], ['Risques', s.risques],
      ['Acteurs / échéances', s.acteurs], ['Pièces', s.pieces], ['Précisions', s.desc]
    ];
    return rows.filter(function(r) { return (r[1] || '').trim(); })
               .map(function(r) { return r[0] + ' : ' + r[1]; }).join('\n');
  }
  window.buildFullDescription = function() { return buildDescription(writeState()); };

  function renderStep4() {
    // Appeler updateRecap de dashboard-v5.js pour pré-remplir recapDomain/Title/Type/Quota
    if (typeof window.updateRecap === 'function') {
      try { window.updateRecap(); } catch(e) {}
    }
    var s = writeState({ step: 4 });
    var typeLabel = s.type === 'surmesure' ? '📋 Accompagnement approfondi / Sur Mesure' : '🎯 Conseil Expert';
    var put = function(id, v) { var e = $(id); if (e) e.textContent = v || '—'; };
    put('recapDomain', s.domain);
    put('recapTitle',  s.title);
    put('recapType',   typeLabel);
    var leftEl = $('expertLeftN');
    put('recapQuota', (leftEl ? leftEl.textContent : '—') + ' demande(s) experte(s) disponible(s)');

    // Bloc étendu (draft + vault + résumé)
    var card = document.querySelector('#step-panel-4 .v5-recap-card');
    if (card && !$('v61FinalRecap')) {
      card.insertAdjacentHTML('beforeend', '<div id="v61FinalRecap"></div>');
    }
    var recap = $('v61FinalRecap');
    if (recap) {
      var gens = loadGenerations();
      var sid  = selectedDraftId();
      var g    = gens.filter(function(x, i) { return String(x.id != null ? x.id : i) === String(sid); })[0];
      var docs = []; try { docs = JSON.parse(sessionStorage.getItem('pope_v61_vault_files') || '[]'); } catch(e) {}
      recap.innerHTML =
        '<div class="v5-recap-row"><span class="v5-recap-key">Draft IA joint</span><span class="v5-recap-val">' +
        esc(g ? (g.title || g.usecaseLabel || 'Draft IA sélectionné') : 'Aucun draft sélectionné') + '</span></div>' +
        '<div class="v5-recap-row"><span class="v5-recap-key">Pièces déposées</span><span class="v5-recap-val">' +
        esc(docs.length ? docs.length + ' pièce(s) dans le dépôt sécurisé' : 'Aucune pièce détectée') + '</span></div>' +
        '<div style="margin-top:12px;padding:12px 14px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;color:#475569;font-size:13px;line-height:1.7">' +
        '<strong>Résumé du besoin :</strong><br>' +
        esc((buildDescription(s) || 'Aucun contexte détaillé saisi.').slice(0, 900)) + '</div>';
    }
  }

  /* ── Bandeau utilisateur ────────────────────────────────
     BUG CORRIGÉ : utilise full_name en priorité, capitalize
     le premier mot, ne jamais utiliser le préfixe email
  ─────────────────────────────────────────────────────── */
  function capitalize(s) {
    s = String(s || '').trim();
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }

  function extractFirstName(u) {
    u = u || {};
    // Priorité 1 : full_name → premier mot (ex: "Denis Delver" → "Denis")
    if (u.full_name && u.full_name.trim()) {
      return capitalize(u.full_name.trim().split(/\s+/)[0]);
    }
    // Priorité 2 : name
    if (u.name && u.name.trim()) {
      return capitalize(u.name.trim().split(/\s+/)[0]);
    }
    // Priorité 3 : first_name
    if (u.first_name && u.first_name.trim()) {
      return capitalize(u.first_name.trim());
    }
    // Priorité 4 : given_name (OAuth)
    if (u.given_name && u.given_name.trim()) {
      return capitalize(u.given_name.trim());
    }
    // JAMAIS le préfixe email — retourner vide
    return '';
  }

  function paintUser(u, w) {
    u = u || {}; w = w || {};

    // Prénom correct
    var firstName = extractFirstName(u);
    var greet = $('dashWelcome');
    if (greet) greet.textContent = 'Bonjour' + (firstName ? ' ' + firstName : '') + ' 👋';

    // Plan actif
    var plan = w.plan_label || w.plan || 'Free';
    var planEl = $('planN'); if (planEl) planEl.textContent = plan;

    // Conseils experts restants — champ exact du backend : expert_left
    var left = '—';
    if (w.expert_left != null)      left = String(w.expert_left);
    else if (w.expert_remaining != null) left = String(w.expert_remaining);
    else if (w.consultations_left != null) left = String(w.consultations_left);
    var leftEl = $('expertLeftN'); if (leftEl) leftEl.textContent = left;
  }

  function hydrateUser() {
    // Affichage immédiat depuis cache
    try {
      var cached = JSON.parse(localStorage.getItem('pope_session_user') || 'null');
      if (cached) {
        var cachedWallet = JSON.parse(localStorage.getItem('pope_session_wallet') || 'null') || {};
        paintUser(cached, cachedWallet);
      }
    } catch(e) {}

    // Appel API
    var headers = { 'Content-Type': 'application/json' };
    var t = token(); if (t) headers.Authorization = 'Bearer ' + t;
    fetch(API_BASE + '/auth/me', { headers: headers, credentials: 'include' })
      .then(function(r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function(data) {
        if (data.user)   localStorage.setItem('pope_session_user',   JSON.stringify(data.user));
        if (data.wallet) localStorage.setItem('pope_session_wallet', JSON.stringify(data.wallet));
        paintUser(data.user || {}, data.wallet || {});
      })
      .catch(function() {}); // Silencieux — le cache a déjà été affiché
  }

  /* ── Patch des fonctions window ─────────────────────── */
  function patchPublicFns() {
    window.goStep = function(n) { showStep(Number(n) || 1); };
    window.goStep._v61patched = true;

    // Logout robuste : nettoyer toutes les clés connues
    if (!document._v61LogoutWired) {
      document._v61LogoutWired = true;
      document.addEventListener('click', function(e) {
        var btn = e.target && e.target.closest ? e.target.closest('[data-logout]') : null;
        if (!btn) return;
        e.preventDefault(); e.stopPropagation();
        ['pope_session_active','pope_session_token','pope_session_user',
         'pope_session_wallet','pope_plan_label','pope_account_space','pope_token',
         'pope_v61_state_public','pope_v61_state_private',
         'pope_v60_state_pub','pope_v60_state_priv',
         'pope_v58_state_public','pope_v58_state_private'
        ].forEach(function(k){ try{localStorage.removeItem(k);sessionStorage.removeItem(k);}catch(ex){} });
        var target = (document.body && document.body.getAttribute('data-logout-target')) ||
                     (/private/.test(location.pathname) ? 'private.html' : 'public.html');
        try { fetch(API_BASE+'/auth/logout',{method:'POST',credentials:'include',
          headers:{'Content-Type':'application/json','Authorization':'Bearer '+(token()||'')}
        }).catch(function(){}); } catch(ex) {}
        setTimeout(function(){ window.location.href = target; }, 120);
      }, true);
    }

    window.selectDomain = function(btn) {
      var domain = btn && btn.getAttribute('data-domain');
      var icon   = btn && (btn.textContent || '').trim().split(' ')[0];
      if (!domain) return;
      setDomain(domain, icon);
      _isFirstLoad = false;
      // V61.2 : rester sur l'étape 1, l'utilisateur clique "Continuer" lui-même
    };

    window.saveDashboardState  = function() { writeState(); };
    window.loadDashboardState  = readState;
    window.restoreDashboardState = restoreFields;

    var oldSubmit = window.submitBesoin;
    window.submitBesoin = function() {
      writeState();
      renderStep4();
      if (typeof oldSubmit === 'function') return oldSubmit();
    };
  }

  function patchLinks() {
    document.querySelectorAll('a[href="app.html"],a[href="app-private.html"],#lnkDraftTool').forEach(function(a) {
      a.href = APP_URL + '?from=dashboard&step=2';
    });
    document.querySelectorAll('a[href^="vault.html"]').forEach(function(a) {
      if (a.href.indexOf('return=') === -1)
        a.href = 'vault.html?space=' + VAULT_SP + '&return=' + encodeURIComponent(DASH_URL + '?step=3');
    });
  }

  /* ── Gestion URL au retour depuis APP ───────────────────
     Règle métier V61+ :
     - from=app → toujours étape 2 (l'utilisateur relit son besoin)
     - step=N explicite dans l'URL → respecté seulement si N <= 2
     - état persisté → utilisé SEULEMENT si on revient avec step > 1
       et que le domain est connu
     - PREMIER CHARGEMENT sans paramètre → toujours étape 1
  ─────────────────────────────────────────────────────── */
  function resolveTargetStep() {
    var sp     = new URLSearchParams(location.search);
    var fromApp = sp.get('from') === 'app';
    var step    = parseInt(sp.get('step') || '0', 10);
    var attach  = sp.get('attach') === 'last';

    // Mémoriser le dernier draft si attach=last
    if (attach) {
      var last = sessionStorage.getItem('pope_v54_last_generation_id') ||
                 sessionStorage.getItem('pope_v58_last_gen') || '';
      if (last) {
        sessionStorage.setItem('pope_v61_attached_gen', last);
        sessionStorage.setItem('pope_v58_attached_gen', last);
        writeState({ attachedGenId: last });
      }
    }

    // Retour depuis APP → étape 2, restaurer le domain
    if (fromApp) {
      _isFirstLoad = false;
      var s = readState();
      if (s.domain) {
        // Forcer window._domain AVANT showStep pour que la garde ne bloque pas
        window._domain = s.domain;
        try { if (typeof _domain !== 'undefined') _domain = s.domain; } catch(ex) {}
        setDomain(s.domain, s.domainIcon, true);
      }
      restoreFields();
      return 2;
    }

    // Paramètre step explicite dans l'URL
    if (step >= 1 && step <= 4) {
      _isFirstLoad = false;
      var s2 = readState();
      if (s2.domain) setDomain(s2.domain, s2.domainIcon, true);
      restoreFields();
      return step;
    }

    // PREMIER CHARGEMENT (pas de paramètre URL) → toujours étape 1
    // L'utilisateur DOIT choisir son domaine
    _isFirstLoad = true;
    restoreFields(); // Restaure les champs texte uniquement (pas le domain)
    return 1;
  }

  /* ── Init ─────────────────────────────────────────── */
  function init() {
    if (_bootDone) return; _bootDone = true;

    patchPublicFns();
    patchLinks();
    hydrateUser();

    var target = resolveTargetStep();

    // Naviguer vers la cible — showStep(1) si pas de domain (garde interne)
    showStep(target, { noScroll: true });

    // Re-patch tardif pour rattraper les inits asynchrones (dashboard-v5.js module)
    setTimeout(function() {
      patchPublicFns();
      patchLinks();
      // Ne pas re-naviguer ici — juste re-patcher les fonctions
    }, 600);
  }

  // Auto-save sur saisie
  document.addEventListener('input',  function() { updateAccordions(); writeState(); }, true);
  document.addEventListener('change', function() { updateAccordions(); writeState(); }, true);

  // Démarrage
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(init, 100); });
  } else {
    setTimeout(init, 100);
  }

})();
