/**
 * POPE Online — App ↔ Dashboard Bridge V60
 * ==========================================
 * Injecté dans app.html et app-private.html pour :
 * 1. Sauvegarder le contexte dashboard avant la génération IA
 * 2. Enrichir les liens retour vers le dashboard avec from=app&attach=last
 * 3. Stocker l'ID de la dernière génération pour que le dashboard
 *    la récupère automatiquement à l'étape 3
 */
(function () {
  'use strict';

  var isPrivate   = /app-private/i.test(location.pathname) || document.body.getAttribute('data-forced-space') === 'private';
  var DASH_URL    = isPrivate ? 'dashboard-private.html' : 'dashboard.html';
  var STATE_KEY   = 'pope_v60_state_' + (isPrivate ? 'private' : 'public');

  /* ─── Restore dashboard context into the app form ───── */
  function restoreContext() {
    try {
      var raw = sessionStorage.getItem(STATE_KEY) || localStorage.getItem(STATE_KEY);
      if (!raw) return;
      var s = JSON.parse(raw);
      // Pre-fill app context textarea if empty
      var ctxField = document.getElementById('context') || document.getElementById('contextField') || document.getElementById('v60AppContext');
      if (ctxField && !ctxField.value && s.contexte) {
        ctxField.value = s.contexte;
      }
      var objField = document.getElementById('objective') || document.getElementById('objectiveField');
      if (objField && !objField.value && s.objectif) {
        objField.value = s.objectif;
      }
    } catch(e) {}
  }

  /* ─── Save generation ID when app produces one ───────── */
  function watchGenerations() {
    // Hook onto pope_v54_generations updates
    var origSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      origSetItem.apply(this, arguments);
      if (key === 'pope_v54_generations' || key === 'pope_last_generation_public' || key === 'pope_last_generation_private') {
        try {
          var gens = JSON.parse(value);
          if (Array.isArray(gens) && gens.length) {
            var last = gens[0];
            sessionStorage.setItem('pope_v54_last_generation_id', last.id || '');
            sessionStorage.setItem('pope_v58_last_gen', last.id || '');
          }
        } catch(e) {}
      }
    };
  }

  /* ─── Enrich all dashboard return links ──────────────── */
  function wireReturnLinks() {
    // Update all dashboard home links to include return params
    function update() {
      document.querySelectorAll('a[href="' + DASH_URL + '"], a[href^="' + DASH_URL + '?"]').forEach(function(a) {
        var base = a.getAttribute('href').split('?')[0];
        a.href = base + '?from=app&attach=last&step=3';
      });
      // Also the topbar "Dashboard" button
      var topbarHome = document.getElementById('topbarHomeLink') || document.getElementById('appHomeLink');
      if (topbarHome && topbarHome.getAttribute('href') === DASH_URL) {
        topbarHome.href = DASH_URL + '?from=app&attach=last&step=3';
      }
    }
    update();
    setTimeout(update, 600);
    setTimeout(update, 1500);
  }

  /* ─── Init ───────────────────────────────────────────── */
  function init() {
    // Only run if we came from dashboard
    var sp = new URLSearchParams(location.search);
    if (sp.get('from') === 'dashboard' || sp.get('from') === 'app') {
      restoreContext();
    }
    watchGenerations();
    wireReturnLinks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(init, 200); });
  } else {
    setTimeout(init, 200);
  }

})();
