/**
 * POPE Online — Dashboard V60 (correctif V60.1)
 * ─────────────────────────────────────────────────────────────
 * BUG 1 : Retour depuis APP → saut automatique vers étape 3
 *         (cause : handleUrlParams de V58 lit step=3 hardcodé)
 * BUG 2 : Étape 3 vide — drafts IA non affichés
 *         (cause : renderDraftCards absent, #v60DraftCards manquant)
 * BUG 3 : Étape 4 vide — récapitulatif non appelé
 *         (cause : patchGoStep de V58 écrase updateRecap())
 * BUG 4 : Bandeau utilisateur vide
 *         (cause : catch{} silencieux dans le module natif + race condition)
 */
(function () {
  'use strict';

  /* ─── Détection espace ───────────────────────────────── */
  var isPrivate = /dashboard-private/i.test(location.pathname);
  var APP_URL   = isPrivate ? 'app-private.html' : 'app.html';
  var DASH_URL  = isPrivate ? 'dashboard-private.html' : 'dashboard.html';
  var VAULT_SP  = isPrivate ? 'private' : 'public';
  var space     = isPrivate ? 'private' : 'public';
  var API_BASE  = (window.__POPE_API_BASE__ || 'https://pope-online-v2.onrender.com').replace(/\/$/, '');

  /* ─── Clés de state (toutes versions) ───────────────── */
  var STATE_KEYS = [
    'pope_need_state_' + space,        // canonique V63
    'pope_need_state_v61_' + space,    // V61
    'pope_v60_state_' + (isPrivate ? 'priv' : 'pub'), // ancienne V60
    'pope_v58_state_' + space          // V58
  ];

  /* ─── Helpers ────────────────────────────────────────── */
  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c];
    });
  }
  function getToken() {
    return sessionStorage.getItem('pope_session_token') ||
           localStorage.getItem('pope_session_token') || '';
  }

  /* ─── Lecture d'état multi-clés ─────────────────────── */
  function readState() {
    for (var i = 0; i < STATE_KEYS.length; i++) {
      var raw = sessionStorage.getItem(STATE_KEYS[i]) || localStorage.getItem(STATE_KEYS[i]);
      if (raw) { try { return JSON.parse(raw); } catch (e) {} }
    }
    return {};
  }

  function writeState(patch) {
    var base = readState();
    var next = Object.assign({}, base, patch || {});
    if (patch && patch.need) next.need = Object.assign({}, base.need || {}, patch.need);
    next.updatedAt = new Date().toISOString();
    var json = JSON.stringify(next);
    STATE_KEYS.forEach(function (k) {
      try { sessionStorage.setItem(k, json); localStorage.setItem(k, json); } catch (e) {}
    });
    return next;
  }

  /* ═══════════════════════════════════════════════════════
     BUG 1 — Retour depuis APP
     Stratégie : réécrire l'URL avant que dashboard-v58.js
     ne l'analyse (son init s'exécute à DOMContentLoaded + 50ms,
     son handleUrlParams à + 250ms).
     On force step=2 sauf si attach=last est explicitement présent.
  ═══════════════════════════════════════════════════════ */
  (function interceptReturnFromApp() {
    var sp     = new URLSearchParams(location.search);
    var from   = sp.get('from');
    var attach = sp.get('attach') === 'last';

    if (from !== 'app') return;

    /* Cible correcte */
    var target = attach ? 3 : 2;

    /* Nettoyer l'URL pour neutraliser handleUrlParams de V58 */
    try { history.replaceState({}, '', location.pathname); } catch (e) {}

    /* Sauvegarder la cible dans le state pour que la restauration
       d'état V58 ne réécrive pas une étape précédente. */
    writeState({ step: target });

    /* Appliquer le saut après les inits de V58 (250ms) et V5 */
    setTimeout(function () {
      var go = window.goStep || window.forceStep;
      if (typeof go === 'function') {
        go(target, true);
      } else {
        /* Fallback direct DOM */
        for (var i = 1; i <= 4; i++) {
          var p = el('step-panel-' + i);
          if (p) {
            p.classList.toggle('active', i === target);
            p.style.display = (i === target) ? 'block' : 'none';
          }
        }
        document.querySelectorAll('.v5-step').forEach(function (s) {
          var n = parseInt(s.dataset.step, 10);
          s.classList.toggle('active', n === target);
          s.classList.toggle('done',   n <  target);
        });
      }
      if (target === 3) setTimeout(initStep3, 150);
    }, 350);
  })();

  /* ═══════════════════════════════════════════════════════
     BUG 2 — Étape 3 : drafts IA
  ═══════════════════════════════════════════════════════ */
  function loadGenerations() {
    var keys = ['pope_generations_v61_' + space, 'pope_v54_generations', 'pope_v53_generations'];
    var all = [], seen = {};
    keys.forEach(function (k) {
      try {
        var arr = JSON.parse(localStorage.getItem(k) || '[]');
        (arr || []).forEach(function (g) {
          if (g && g.id && !seen[g.id]) { seen[g.id] = true; all.push(g); }
        });
      } catch (e) {}
    });
    return all.sort(function (a, b) {
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }

  function initStep3() {
    fillDraftSelect();
    renderDraftCards();
    loadVaultFiles();
  }

  function fillDraftSelect() {
    var sel = el('archiveAttachSelect');
    if (!sel) return;
    var gens = loadGenerations();
    var st   = readState();
    var cur  = st.selectedDraft ||
               sessionStorage.getItem('pope_v58_last_gen') ||
               sessionStorage.getItem('pope_v54_last_generation_id') || '';

    sel.innerHTML = '<option value="">Ne pas joindre de draft préparé</option>' +
      gens.map(function (g) {
        var lbl = (g.title || g.usecaseLabel || 'Draft IA') +
                  (g.domain ? ' — ' + g.domain : '') +
                  (g.createdAt ? ' — ' + new Date(g.createdAt).toLocaleString('fr-FR') : '');
        return '<option value="' + esc(String(g.id)) + '">' + esc(lbl) + '</option>';
      }).join('');

    if (cur) sel.value = cur;

    sel.onchange = function () {
      writeState({ selectedDraft: sel.value });
      renderDraftCards();
    };

    /* Badge statut */
    var badge = el('v59DraftStatus');
    if (badge) badge.style.display = (gens.length && sel.value) ? 'block' : 'none';

    /* Lien "Créer un draft" */
    var lnk = el('lnkDraftStep3');
    if (lnk) {
      lnk.href = APP_URL + '?from=dashboard&step=2';
      lnk.textContent = gens.length ? 'Voir l\'outil →' : 'Créer un draft →';
    }
  }

  function renderDraftCards() {
    var gens     = loadGenerations();
    var st       = readState();
    var selected = (el('archiveAttachSelect') || {}).value || st.selectedDraft || '';

    /* Créer le conteneur si absent */
    var container = el('v60DraftCards');
    if (!container) {
      var panel = el('step-panel-3');
      if (!panel) return;
      container = document.createElement('div');
      container.id = 'v60DraftCards';
      container.style.cssText = 'margin-top:12px;display:flex;flex-direction:column;gap:10px;';
      var sel = el('archiveAttachSelect');
      if (sel && sel.parentNode) sel.parentNode.insertBefore(container, sel.nextSibling);
      else panel.appendChild(container);
    }

    if (!gens.length) {
      container.innerHTML = '<div style="padding:14px;border:1px dashed rgba(15,35,80,.2);' +
        'border-radius:14px;background:#fafbfc;color:#526070;font-size:13px;">' +
        'Aucun draft généré pour le moment. Cliquez sur <strong>Créer un draft →</strong> ' +
        'puis revenez ici pour le joindre à votre demande.</div>';
      return;
    }

    container.innerHTML = gens.slice(0, 5).map(function (g) {
      var isSel   = selected === g.id;
      var date    = g.createdAt ? new Date(g.createdAt).toLocaleString('fr-FR') : '';
      var preview = String(g.result || g.output || '').slice(0, 180);
      return '<div class="v60-draft-card" data-gen-id="' + esc(g.id) + '" style="' +
        'border:1.5px solid ' + (isSel ? '#0f2d5c' : 'rgba(15,35,80,.12)') + ';' +
        'border-radius:14px;padding:12px 14px;cursor:pointer;' +
        'background:' + (isSel ? '#f0f5ff' : '#fff') + ';">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">' +
        '<strong style="font-size:13px;color:#102044;">' + esc(g.title || g.usecaseLabel || 'Draft') + '</strong>' +
        '<span style="font-size:11px;color:#64748b;">' + esc((g.domain || '') + (date ? ' · ' + date : '')) + '</span>' +
        '</div>' +
        (preview ? '<div style="font-size:12px;color:#475569;line-height:1.5;margin-bottom:8px;">' + esc(preview) + '…</div>' : '') +
        '<button type="button" data-select-draft="' + esc(g.id) + '" style="' +
        'font-size:12px;padding:5px 12px;border-radius:8px;cursor:pointer;' +
        'border:1.5px solid ' + (isSel ? '#0f2d5c' : '#cbd5e1') + ';' +
        'background:' + (isSel ? '#0f2d5c' : '#f8fafc') + ';' +
        'color:' + (isSel ? '#fff' : '#334155') + ';">' +
        (isSel ? '✅ Draft sélectionné' : 'Sélectionner ce draft') + '</button>' +
        '</div>';
    }).join('');

    /* Délégation de clic */
    container.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-select-draft]');
      if (!btn) return;
      var id = btn.getAttribute('data-select-draft');
      var s = el('archiveAttachSelect');
      if (s) s.value = id;
      writeState({ selectedDraft: id });
      renderDraftCards();
    });
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
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var files = data.files || data.items || [];
      if (!files.length) {
        container.innerHTML = 'Aucune pièce déposée. ' +
          '<a href="vault.html?space=' + VAULT_SP + '&return=' + DASH_URL + '" ' +
          'style="color:#0079c1;font-weight:700">Déposer des pièces →</a>';
        return;
      }
      container.innerHTML = files.slice(0, 6).map(function (f) {
        return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;' +
          'border-bottom:1px solid #f0f4f8">' +
          '<span>📄</span>' +
          '<span style="flex:1;font-size:12px;font-weight:600;color:#0f172a;' +
          'overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
          esc(f.original_name || f.filename || 'Fichier') + '</span>' +
          '<span style="font-size:11px;color:#94a3b8;white-space:nowrap">' +
          (f.size_kb ? f.size_kb + ' Ko' : '') + '</span></div>';
      }).join('') +
      '<a href="vault.html?space=' + VAULT_SP + '&return=' + DASH_URL + '?step=3" ' +
      'style="display:inline-block;margin-top:8px;font-size:12px;font-weight:700;color:#0079c1">' +
      '📂 Gérer le dépôt →</a>';
    })
    .catch(function () {
      container.innerHTML = '<a href="vault.html?space=' + VAULT_SP + '&return=' + DASH_URL + '" ' +
        'style="font-size:12px;font-weight:700;color:#0079c1">📂 Accéder au dépôt sécurisé →</a>';
    });
  }

  /* ═══════════════════════════════════════════════════════
     BUG 3 — Étape 4 : récapitulatif
  ═══════════════════════════════════════════════════════ */
  function buildRecap() {
    var st    = readState();
    var need  = st.need || {};

    /* Récupérer les valeurs en direct si les champs sont dans le DOM */
    function fieldVal(id) {
      var e = el(id); return e ? (e.value || '') : '';
    }
    var title  = fieldVal('besoInTitle')  || need.title   || '—';
    var radio  = document.querySelector('input[name="besoType"]:checked');
    var type   = (radio && radio.value)   || need.treatment || 'conseil';
    var tLabel = type === 'surmesure' ? '📋 Sur Mesure' : '🎯 Conseil Expert (48h)';
    var leftEl = el('expertLeftN');
    var quota  = leftEl ? leftEl.textContent.trim() : '—';
    var domain = st.domain || window._domain || '—';

    function set(id, val) { var e = el(id); if (e) e.textContent = val; }
    set('recapDomain', domain);
    set('recapTitle',  title);
    set('recapType',   tLabel);
    set('recapQuota',  quota + ' Conseil(s) Expert disponible(s)');

    /* Draft sélectionné */
    var gens     = loadGenerations();
    var selDraft = (el('archiveAttachSelect') || {}).value || st.selectedDraft || '';
    var draft    = gens.filter(function (g) { return g.id === selDraft; })[0];
    var recapDraft = el('recapDraft');
    if (recapDraft) recapDraft.textContent = draft ? (draft.title || 'Draft sélectionné') : 'Aucun';
  }

  /* Exposer pour compatibilité avec le script inline de dashboard.html */
  window.updateRecap = buildRecap;

  /* ═══════════════════════════════════════════════════════
     BUG 4 — Bandeau utilisateur
     Retry robuste si le module natif a échoué silencieusement.
  ═══════════════════════════════════════════════════════ */
  function hydrateUser() {
    /* Ne pas écraser si le prénom est déjà affiché */
    var greet = el('dashWelcome');
    if (greet && greet.textContent && greet.textContent !== 'Bonjour 👋' &&
        greet.textContent.length > 10) return;

    var token = getToken();
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    fetch(API_BASE + '/auth/me', { method: 'GET', headers: headers, credentials: 'include' })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (data) {
      var user   = data.user   || {};
      var wallet = data.wallet || {};

      /* Prénom */
      var firstName = '';
      if (user.full_name)   firstName = user.full_name.trim().split(/\s+/)[0];
      else if (user.name)   firstName = user.name.trim().split(/\s+/)[0];
      else if (user.prenom) firstName = user.prenom.trim();

      if (greet && firstName) greet.textContent = 'Bonjour ' + firstName + ' 👋';

      /* Plan */
      var planEl = el('planN');
      if (planEl) planEl.textContent = wallet.plan_label || wallet.plan || 'Free';

      /* Quota */
      var leftEl = el('expertLeftN');
      if (leftEl) {
        leftEl.textContent = (wallet.expert_left != null) ? String(wallet.expert_left) : '—';
      }

      /* Mettre en cache pour le fallback */
      try { localStorage.setItem('pope_session_user', JSON.stringify({ user: user, wallet: wallet })); } catch (e) {}

      /* Alertes trial */
      var trialAlert = el('trialAlert');
      if (trialAlert) {
        if (wallet.status === 'trial_active' && wallet.trial_days_left != null) {
          trialAlert.removeAttribute('hidden');
          var tTitle = el('trialAlertTitle'), tBody = el('trialAlertBody');
          if (tTitle) tTitle.textContent = 'Essai gratuit — ' + wallet.trial_days_left + ' jour(s) restant(s)';
          if (tBody)  tBody.textContent  = 'Souscrivez un plan pour continuer après votre essai.';
        } else if (wallet.status === 'trial_expired') {
          trialAlert.removeAttribute('hidden');
          trialAlert.style.background  = 'linear-gradient(to right,#fef2f2,#fff0f0)';
          trialAlert.style.borderColor = '#fecaca';
          var tTitle2 = el('trialAlertTitle'), tBody2 = el('trialAlertBody');
          if (tTitle2) tTitle2.textContent = 'Période d\'essai terminée';
          if (tBody2)  tBody2.textContent  = 'Votre accès est suspendu. Choisissez un plan pour reprendre.';
          var overlay = el('trialExpiredOverlay');
          if (overlay) overlay.removeAttribute('hidden');
        }
      }
    })
    .catch(function () {
      /* Fallback depuis le cache local */
      try {
        var cached = JSON.parse(localStorage.getItem('pope_session_user') || 'null');
        if (cached && cached.user) {
          var u = cached.user;
          var fn = u.full_name ? u.full_name.trim().split(/\s+/)[0] : '';
          if (greet && fn) greet.textContent = 'Bonjour ' + fn + ' 👋';
          var w = cached.wallet || {};
          var pEl = el('planN'); if (pEl) pEl.textContent = w.plan_label || 'Free';
          var lEl = el('expertLeftN'); if (lEl) lEl.textContent = w.expert_left != null ? String(w.expert_left) : '—';
        }
      } catch (e) {}
      /* Retry dans 2s */
      setTimeout(hydrateUser, 2000);
    });
  }

  /* ─── Wrapper goStep pour déclencher les rendus par étape ── */
  function wrapGoStep() {
    var orig = window.goStep;
    if (typeof orig !== 'function' || orig._v60fix) return;
    window.goStep = function (n, opts) {
      var res = orig.apply(this, arguments);
      var step = parseInt(n, 10);
      if (step === 3) setTimeout(initStep3, 100);
      if (step === 4) setTimeout(buildRecap,  100);
      return res;
    };
    window.goStep._v60fix = true;
    window.forceStep = window.goStep;
  }

  /* ─── MutationObserver sur les panels (filet de sécurité) ── */
  function observePanels() {
    if (!window.MutationObserver) return;
    var mo = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        if (m.type === 'attributes' && m.attributeName === 'class') {
          var t = m.target;
          if (t && t.classList && t.classList.contains('active')) {
            if (t.id === 'step-panel-3') initStep3();
            if (t.id === 'step-panel-4') buildRecap();
          }
        }
      });
    });
    [1, 2, 3, 4].forEach(function (i) {
      var p = el('step-panel-' + i);
      if (p) mo.observe(p, { attributes: true, attributeFilter: ['class'] });
    });
  }

  /* ─── Init ───────────────────────────────────────────── */
  function init() {
    /* Wrapper goStep (après que V58 a peut-être déjà patché le sien) */
    setTimeout(wrapGoStep, 100);
    setTimeout(wrapGoStep, 600);

    /* Bandeau utilisateur */
    setTimeout(hydrateUser, 200);

    /* Observer les transitions de panel */
    observePanels();

    /* Si on est déjà sur l'étape 3 ou 4 au chargement */
    setTimeout(function () {
      var active = document.querySelector('.v5-step-panel.active');
      if (!active) return;
      if (active.id === 'step-panel-3') initStep3();
      if (active.id === 'step-panel-4') buildRecap();
    }, 500);
  }

  /* Exposition publique */
  window.v60RenderDrafts  = initStep3;
  window.v60BuildRecap    = buildRecap;
  window.v60HydrateUser   = hydrateUser;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 80); });
  } else {
    setTimeout(init, 80);
  }

})();
