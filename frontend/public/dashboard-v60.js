/**
 * POPE Online — Dashboard V60
 * Correctifs ciblés — ne remplace pas dashboard-v58.js, le complète
 * ──────────────────────────────────────────────────────────────────
 * FIX 1 : populateGenerationSelect lisait 'pope_v53_generations' (toujours vide)
 *          → corrigé vers 'pope_v54_generations' (clé écrite par app-page.js)
 * FIX 2 : vaultExpertList jamais rempli → appel API /vault/list
 * FIX 3 : bandeau utilisateur — délégué au module compilé, pas de doublon
 *          (dashboard-private-MysN4WEL.js / dashboard-B5J1o9Gp.js le gèrent)
 * FIX 4 : domaine persisté via STATE_KEY + restauration au retour
 */
(function () {
  'use strict';

  var isPrivate = /dashboard-private/i.test(location.pathname);
  var APP_URL   = isPrivate ? 'app-private.html' : 'app.html';
  var DASH_URL  = isPrivate ? 'dashboard-private.html' : 'dashboard.html';
  var VAULT_SP  = isPrivate ? 'private' : 'public';
  var API_BASE  = (window.__POPE_API_BASE__ || 'https://pope-online-v2.onrender.com').replace(/\/$/, '');
  var STATE_KEY = 'pope_v60_' + (isPrivate ? 'priv' : 'pub');

  function el(id) { return document.getElementById(id); }
  function getToken() {
    return sessionStorage.getItem('pope_session_token') ||
           localStorage.getItem('pope_session_token') || '';
  }
  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  /* ═══════════════════════════════════════════════════════
   * FIX 1 — Corriger la clé pope_v53 → pope_v54
   * dashboard-v5.js lit 'pope_v53_generations' mais app-page.js
   * écrit dans 'pope_v54_generations' — le select est toujours vide.
   * On patche populateGenerationSelect pour utiliser la bonne clé.
   * ═══════════════════════════════════════════════════════ */
  function loadGens() {
    try {
      // Lire les deux clés — v54 est écrite par app-page.js
      var v54 = JSON.parse(localStorage.getItem('pope_v54_generations') || '[]');
      var v53 = JSON.parse(localStorage.getItem('pope_v53_generations') || '[]');
      // Fusionner, dédupliquer par id
      var all = v54.concat(v53.filter(function(g) {
        return !v54.some(function(x) { return x.id === g.id; });
      }));
      // Synchroniser v53 depuis v54 pour que dashboard-v5.js trouve aussi les entrées
      if (v54.length && !v53.length) {
        localStorage.setItem('pope_v53_generations', JSON.stringify(v54));
      }
      return all;
    } catch(e) { return []; }
  }

  function patchPopulateGenerationSelect() {
    var sel = el('archiveAttachSelect');
    if (!sel) return;
    var gens = loadGens();
    if (!gens.length) {
      // Mettre à jour le lien "Créer un draft"
      var lnk = el('lnkDraftStep3');
      if (lnk) lnk.href = APP_URL + '?from=dashboard&step=2';
      return;
    }
    var cur = sel.value ||
              sessionStorage.getItem('pope_v58_last_gen') ||
              sessionStorage.getItem('pope_v54_last_generation_id') ||
              sessionStorage.getItem('pope_v53_last_generation_id') || '';

    sel.innerHTML = '<option value="">Ne pas joindre de draft préparé</option>' +
      gens.map(function(g, i) {
        var lbl = (g.title || g.usecaseLabel || 'Draft préparé') + ' — ' +
                  (g.createdAt ? new Date(g.createdAt).toLocaleString('fr-FR') : '');
        return '<option value="' + esc(String(g.id != null ? g.id : i)) + '">' + esc(lbl) + '</option>';
      }).join('');

    if (cur) sel.value = cur;

    // Statut et lien
    var status = el('v59DraftStatus');
    if (status) status.style.display = (sel.value) ? 'block' : 'none';
    var lnk2 = el('lnkDraftStep3');
    if (lnk2) lnk2.textContent = gens.length ? 'Voir l\'outil →' : 'Créer un draft →';
    if (lnk2) lnk2.href = APP_URL + '?from=dashboard&step=2';
  }

  /* ═══════════════════════════════════════════════════════
   * FIX 2 — Remplir vaultExpertList via /vault/list
   * ═══════════════════════════════════════════════════════ */
  function fillVault() {
    var container = el('vaultExpertList');
    if (!container) return;
    var token = getToken();
    if (!token) {
      container.innerHTML = 'Connexion requise pour accéder au dépôt.';
      return;
    }
    container.textContent = '⏳ Chargement…';
    fetch(API_BASE + '/vault/list?space=' + VAULT_SP, {
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      credentials: 'include'
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var files = data.files || data.items || data || [];
      if (!Array.isArray(files) || !files.length) {
        container.innerHTML = 'Aucune pièce déposée. ' +
          '<a href="vault.html?space=' + VAULT_SP + '&return=' + DASH_URL +
          '" style="color:#0079c1;font-weight:700">Déposer des pièces →</a>';
        return;
      }
      container.innerHTML = files.slice(0, 6).map(function(f) {
        var name = f.original_name || f.filename || f.name || 'Fichier';
        var meta = f.size_kb ? f.size_kb + ' Ko' : '';
        return '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;' +
               'border-bottom:1px solid #f0f4f8;font-size:12px;">' +
               '<span>📄</span>' +
               '<span style="flex:1;font-weight:600;color:#0f172a;overflow:hidden;' +
               'text-overflow:ellipsis;white-space:nowrap">' + esc(name) + '</span>' +
               (meta ? '<span style="color:#94a3b8;flex-shrink:0">' + meta + '</span>' : '') +
               '</div>';
      }).join('') +
      '<a href="vault.html?space=' + VAULT_SP + '&return=' + DASH_URL +
      '" style="display:inline-block;margin-top:8px;font-size:12px;' +
      'font-weight:700;color:#0079c1">📂 Gérer le dépôt →</a>';
    })
    .catch(function() {
      container.innerHTML =
        '<a href="vault.html?space=' + VAULT_SP + '&return=' + DASH_URL +
        '" style="font-size:12px;font-weight:700;color:#0079c1">📂 Accéder au dépôt sécurisé →</a>';
    });
  }

  /* ═══════════════════════════════════════════════════════
   * FIX 3 — Persistance domaine entre étapes
   * ═══════════════════════════════════════════════════════ */
  function saveState() {
    try {
      var data = { domain: window._domain || '' };
      var fields = ['besoInTitle','descContexte','descProbleme','descObjectif',
                    'descDecision','descLivrable','descContraintes','descRisques',
                    'descActeurs','descPublic','needDeadline','descPieces',
                    'descNiveau','besoInDesc'];
      fields.forEach(function(id) { var e = el(id); if (e) data[id] = e.value; });
      var r = document.querySelector('input[name="besoType"]:checked');
      if (r) data.besoType = r.value;
      var s = JSON.stringify(data);
      localStorage.setItem(STATE_KEY, s);
      sessionStorage.setItem(STATE_KEY, s);
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
    if (!s) return;
    if (s.domain && !window._domain) {
      window._domain = s.domain;
      document.querySelectorAll('.v5-domain-pill').forEach(function(b) {
        b.classList.toggle('selected', b.getAttribute('data-domain') === s.domain);
      });
      // Badge domaine (v58)
      var badge = el('v58DomainBadge');
      var name  = el('v58DomainName');
      var icon  = el('v58DomainIcon');
      if (badge) badge.style.display = 'flex';
      if (name) name.textContent = s.domain;
      var pill = document.querySelector('.v5-domain-pill.selected');
      if (icon && pill) icon.textContent = pill.textContent.trim().split(' ')[0] || '🎯';
    }
    var fields = ['besoInTitle','descContexte','descProbleme','descObjectif',
                  'descDecision','descLivrable','descContraintes','descRisques',
                  'descActeurs','descPublic','needDeadline','descPieces',
                  'descNiveau','besoInDesc'];
    fields.forEach(function(id) { var e = el(id); if (e && s[id]) e.value = s[id]; });
    if (s.besoType) {
      var r = document.querySelector('input[name="besoType"][value="' + s.besoType + '"]');
      if (r) r.checked = true;
    }
  }

  /* ═══════════════════════════════════════════════════════
   * Retour depuis app.html — aller à étape 2 (pas 3)
   * V58 gère déjà attach=last → step 3, mais part sans domaine
   * On restaure d'abord le domaine puis laisse v58 naviguer
   * ═══════════════════════════════════════════════════════ */
  function handleReturn() {
    var sp     = new URLSearchParams(location.search);
    var from   = sp.get('from');
    var attach = sp.get('attach') === 'last';
    var stepP  = parseInt(sp.get('step') || '0', 10);

    if (from !== 'app' && !attach && !stepP) return;

    // Restaurer domaine avant que v58 tente de naviguer
    restoreState();

    // Synchroniser les générations v54→v53 pour que v58 les trouve
    loadGens();

    // Si attach=last, laisser dashboard-v58.js gérer (il fait goStep(3))
    // Si step=2, naviguer vers étape 2
    if (stepP === 2 || (from === 'app' && !attach)) {
      setTimeout(function() {
        if (window._domain && window.goStep) window.goStep(2);
      }, 500);
    }
    // Si attach=last → v58 gère, mais on remplit aussi le vault
    if (attach || stepP === 3) {
      setTimeout(fillVault, 600);
    }
  }

  /* ═══════════════════════════════════════════════════════
   * Patcher selectDomain pour sauvegarder
   * ═══════════════════════════════════════════════════════ */
  function patchSelectDomain() {
    var orig = window.selectDomain;
    if (!orig || orig._v60) return;
    window.selectDomain = function(btn) {
      orig(btn);
      saveState();
    };
    window.selectDomain._v60 = true;
  }

  /* ═══════════════════════════════════════════════════════
   * Patcher goStep pour sauvegarder + remplir step 3
   * ═══════════════════════════════════════════════════════ */
  function patchGoStep() {
    var orig = window.goStep;
    if (!orig || orig._v60) return;
    window.goStep = function(n) {
      // Assurer que _domain est synchro avant la garde
      if (n > 1 && !window._domain) {
        var s = loadState();
        if (s && s.domain) window._domain = s.domain;
      }
      orig(n);
      saveState();
      if (n === 3) {
        setTimeout(patchPopulateGenerationSelect, 80);
        setTimeout(fillVault, 120);
      }
    };
    window.goStep._v60 = true;
  }

  /* ═══════════════════════════════════════════════════════
   * Auto-save
   * ═══════════════════════════════════════════════════════ */
  document.addEventListener('input', saveState, true);
  document.addEventListener('change', saveState, true);

  /* ═══════════════════════════════════════════════════════
   * Init
   * ═══════════════════════════════════════════════════════ */
  function init() {
    restoreState();
    patchSelectDomain();
    patchGoStep();
    // Si on arrive directement à step 3 (depuis v58 handleUrlParams)
    var active = document.querySelector('.v5-step-panel.active');
    var activeStep = active ? active.id : '';
    if (activeStep === 'step-panel-3') {
      setTimeout(patchPopulateGenerationSelect, 100);
      setTimeout(fillVault, 150);
    }
    handleReturn();
  }

  // Patcher après que les scripts précédents (v5, v58) ont fini leur init
  function lateInit() {
    patchSelectDomain();
    patchGoStep();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(init, 100);
      setTimeout(lateInit, 400);
      setTimeout(lateInit, 900);
    });
  } else {
    setTimeout(init, 100);
    setTimeout(lateInit, 400);
    setTimeout(lateInit, 900);
  }

})();
