/**
 * POPE Online — App Bridge V60 (correctif V60.1)
 * Pont APP → Dashboard
 *
 * FIX CRITIQUE :
 *   L'ancienne version hardcodait ?from=app&attach=last&step=3 sur TOUS
 *   les liens retour, même sans draft généré. Résultat : le dashboard
 *   sautait toujours à l'étape 3 en ignorant l'étape 2.
 *
 * Nouvelle logique :
 *   - Pas de draft → retour étape 2 (?from=app&step=2)
 *   - Draft disponible → retour étape 3 (?from=app&step=3&attach=last)
 */
(function () {
  'use strict';

  var isPrivate = /app-private/i.test(location.pathname) ||
                  (document.body && document.body.getAttribute('data-forced-space') === 'private');
  var DASH_URL  = isPrivate ? 'dashboard-private.html' : 'dashboard.html';
  var space     = isPrivate ? 'private' : 'public';

  /* ── Détection d'un draft généré ──────────────────────── */
  function hasOutput() {
    var ids = ['output', 'resultBody', 'resultText'];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el) {
        var t = (el.dataset && el.dataset.raw) || el.innerText || el.textContent || '';
        if (t.trim().length > 20) return true;
      }
    }
    return false;
  }

  /* ── Construction de l'URL de retour ──────────────────── */
  function buildReturnUrl() {
    /* Si un draft a été généré → proposer de le joindre (étape 3).
       Sinon → retour sur le besoin (étape 2) pour relecture/modification. */
    if (hasOutput()) {
      return DASH_URL + '?from=app&step=3&attach=last';
    }
    return DASH_URL + '?from=app&step=2';
  }

  /* ── Mise à jour de tous les liens retour ─────────────── */
  function wireLinks() {
    var url = buildReturnUrl();

    /* Topbar home */
    ['topbarHomeLink', 'appHomeLink', 'btnRetourDashboard',
     'v53RetourDashboard', 'v53ReturnDashboard', 'v53ReturnDashboardMob',
     'v53BackToJourney', 'v56ReturnJourney'].forEach(function (id) {
      var a = document.getElementById(id);
      if (a) a.href = url;
    });

    /* Tous les ancres pointant vers le dashboard */
    document.querySelectorAll('a[href="' + DASH_URL + '"]').forEach(function (a) {
      a.href = url;
    });

    /* Liens nav topbar */
    document.querySelectorAll('.v40-topbar-btn, .v40-mobile-menu a').forEach(function (a) {
      if ((a.getAttribute('href') || '').indexOf(DASH_URL) === 0) {
        a.href = url;
      }
    });
  }

  /* ── Sauvegarder le dernier ID de génération ──────────── */
  function watchStorage() {
    var origSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      origSet.apply(this, arguments);
      if (key === 'pope_v54_generations' || key === ('pope_generations_v61_' + space)) {
        try {
          var gens = JSON.parse(value);
          if (Array.isArray(gens) && gens.length && gens[0].id != null) {
            ['pope_v61_last_gen', 'pope_v58_last_gen',
             'pope_v54_last_generation_id'].forEach(function (k) {
              sessionStorage.setItem(k, String(gens[0].id));
            });
          }
        } catch (e) {}
      }
    };
  }

  /* ── Recâbler les liens dès qu'une génération apparaît ── */
  function watchOutput() {
    var out = document.getElementById('output');
    if (!out) return;
    var timer = null;
    var mo = new MutationObserver(function () {
      clearTimeout(timer);
      timer = setTimeout(wireLinks, 400);
    });
    mo.observe(out, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ['data-raw']
    });
  }

  function init() {
    watchStorage();
    wireLinks();
    watchOutput();
    /* Rattraper les rendus tardifs du topbar */
    setTimeout(wireLinks, 600);
    setTimeout(wireLinks, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 100); });
  } else {
    setTimeout(init, 100);
  }

})();
