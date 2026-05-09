/**
 * POPE Online — App Bridge V60 (correctif définitif)
 *
 * BUG CORRIGÉ :
 *   L'ancienne version hardcodait ?from=app&attach=last&step=3 sur TOUS les liens,
 *   même sans draft généré. Résultat : le dashboard sautait toujours à l'étape 3.
 *
 * Nouvelle logique :
 *   - Aucun draft → ?from=app&step=2 (retour sur le besoin)
 *   - Draft généré → ?from=app&attach=last&step=3 (proposer de joindre)
 *
 * Compatible avec app-v53-bridge.js (qui ajoute ses propres boutons retour).
 * app-v60-bridge écrase les href après v53 via les setInterval.
 */
(function () {
  'use strict';

  var isPrivate = /app-private/i.test(location.pathname) ||
                  (document.body && document.body.getAttribute('data-forced-space') === 'private');
  var DASH_URL  = isPrivate ? 'dashboard-private.html' : 'dashboard.html';
  var space     = isPrivate ? 'private' : 'public';

  // Clés de génération connues
  var GEN_KEYS = ['pope_v54_generations', 'pope_v53_generations', 'pope_generations_v61_' + space];

  /* ─── Détecter un draft généré dans le DOM ───────────── */
  function hasOutput() {
    var ids = ['output', 'resultBody', 'resultText', 'resultCard'];
    for (var i = 0; i < ids.length; i++) {
      var node = document.getElementById(ids[i]);
      if (node) {
        var t = (node.dataset && node.dataset.raw) || node.innerText || node.textContent || '';
        if (t.trim().length > 20) return true;
      }
    }
    return false;
  }

  /* ─── Construire l'URL de retour correcte ────────────── */
  function buildReturnUrl() {
    if (hasOutput()) {
      // Draft disponible → proposer de le joindre
      return DASH_URL + '?from=app&attach=last&step=3';
    }
    // Pas de draft → retour sur le besoin (étape 2)
    return DASH_URL + '?from=app&step=2';
  }

  /* ─── Câbler tous les liens retour ───────────────────── */
  function wireLinks() {
    var url = buildReturnUrl();

    // Liens nommés (ajoutés par app-v53-bridge.js et autres)
    var ids = [
      'v53ReturnDashboard', 'v53ReturnDashboardMob', 'v53BackToJourney',
      'resultExpertLink', 'resultMissionLink', 'btnRetourDashboard',
      'v56ReturnJourney', 'topbarHomeLink', 'appHomeLink'
    ];
    ids.forEach(function(id) {
      var a = document.getElementById(id);
      if (a && a.tagName === 'A') a.href = url;
    });

    // Topbar : le lien Dashboard dans la nav
    document.querySelectorAll('.v40-topbar-btn, .v40-mobile-menu a, #v40MobileMenu a').forEach(function(a) {
      var href = a.getAttribute('href') || '';
      if (href === DASH_URL || href.startsWith(DASH_URL + '?')) {
        a.href = url;
      }
    });

    // Ancres directes vers dashboard
    document.querySelectorAll('a[href="' + DASH_URL + '"]').forEach(function(a) {
      a.href = url;
    });
  }

  /* ─── Intercepter les sauvegardes de génération ─────────
     app-v54.js écrit dans pope_v54_generations via setItem
     On intercepte pour mémoriser le dernier ID de génération
  ─────────────────────────────────────────────────────── */
  function watchStorage() {
    var origSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      origSet.apply(this, arguments);
      if (GEN_KEYS.indexOf(key) !== -1) {
        try {
          var gens = JSON.parse(value);
          if (Array.isArray(gens) && gens.length && gens[0].id != null) {
            var id = String(gens[0].id);
            sessionStorage.setItem('pope_v54_last_generation_id', id);
            sessionStorage.setItem('pope_v58_last_gen', id);
            sessionStorage.setItem('pope_v53_last_generation_id', id);
            // Recâbler les liens maintenant qu'un draft existe
            setTimeout(wireLinks, 100);
          }
        } catch(e) {}
      }
    };
  }

  /* ─── Observer le DOM pour recâbler après génération ─── */
  function watchOutput() {
    var out = document.getElementById('output');
    if (!out) return;
    var timer = null;
    var mo = new MutationObserver(function() {
      clearTimeout(timer);
      timer = setTimeout(wireLinks, 300);
    });
    mo.observe(out, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ['data-raw', 'class']
    });
  }

  /* ─── Init ───────────────────────────────────────────── */
  function init() {
    watchStorage();
    wireLinks();
    watchOutput();
    // Recâbler périodiquement pour attraper les boutons injectés tardivement
    // par app-v53-bridge.js et protected-topbar.js
    setTimeout(wireLinks, 600);
    setTimeout(wireLinks, 1500);
    setTimeout(wireLinks, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(init, 100); });
  } else {
    setTimeout(init, 100);
  }

})();
