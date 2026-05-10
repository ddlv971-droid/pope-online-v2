/**
 * POPE Online — App Bridge V60
 * Enrichit les liens retour dashboard dans app.html / app-private.html
 */
(function () {
  'use strict';

  var isPrivate = /app-private/i.test(location.pathname) ||
                  (document.body && document.body.getAttribute('data-forced-space') === 'private');
  var DASH_URL  = isPrivate ? 'dashboard-private.html' : 'dashboard.html';
  var STATE_KEY = 'pope_v60_state_' + (isPrivate ? 'priv' : 'pub');

  /* ─── Intercepter les écritures localStorage pour capter le dernier ID ── */
  function watchStorage() {
    var origSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      origSet.apply(this, arguments);
      if (key === 'pope_v54_generations') {
        try {
          var gens = JSON.parse(value);
          if (Array.isArray(gens) && gens.length && gens[0].id != null) {
            sessionStorage.setItem('pope_v54_last_generation_id', String(gens[0].id));
            sessionStorage.setItem('pope_v58_last_gen', String(gens[0].id));
          }
        } catch(e) {}
      }
    };
  }

  /* ─── Mettre à jour les liens dashboard ─────────────── */
  function wireLinks() {
    var returnUrl = DASH_URL + '?from=app&attach=last&step=2';

    // Topbar "Dashboard"
    var topbar = document.getElementById('topbarHomeLink') || document.getElementById('appHomeLink');
    if (topbar) {
      var href = topbar.getAttribute('href') || '';
      if (href === DASH_URL || href.startsWith(DASH_URL + '?')) {
        topbar.href = returnUrl;
      }
    }

    // Tous les liens vers dashboard dans la page
    document.querySelectorAll('a[href="' + DASH_URL + '"], a[href="' + DASH_URL + '"]').forEach(function(a) {
      a.href = returnUrl;
    });

    // Lien "🏠 Dashboard" dans le topbar nav
    document.querySelectorAll('.v40-topbar-btn, .v40-mobile-menu a').forEach(function(a) {
      if (a.getAttribute('href') === DASH_URL) {
        a.href = returnUrl;
      }
    });
  }

  function init() {
    watchStorage();
    wireLinks();
    // Re-passer après hydration du topbar
    setTimeout(wireLinks, 600);
    setTimeout(wireLinks, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(init, 100); });
  } else {
    setTimeout(init, 100);
  }

})();
