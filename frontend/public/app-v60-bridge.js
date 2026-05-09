/**
 * POPE Online — App Bridge V60
 * Retour vers dashboard avec step=2 (pas step=3)
 * Le draft est récupéré via attach=last que dashboard-v58 gère déjà
 */
(function () {
  'use strict';

  var isPrivate = /app-private/i.test(location.pathname) ||
                  !!(document.body && document.body.getAttribute('data-forced-space') === 'private');
  var DASH_URL  = isPrivate ? 'dashboard-private.html' : 'dashboard.html';

  // URL de retour : step=2 pour rester sur le besoin, attach=last pour que v58 charge le draft
  var RETURN_URL = DASH_URL + '?from=app&attach=last&step=2';

  function wireLinks() {
    // Topbar home link
    var topbar = document.getElementById('topbarHomeLink') || document.getElementById('appHomeLink');
    if (topbar) {
      var h = topbar.getAttribute('href') || '';
      if (h === DASH_URL || h.startsWith(DASH_URL + '?') || h === 'dashboard.html' || h === 'dashboard-private.html') {
        topbar.href = RETURN_URL;
      }
    }
    // Tous les liens .v40-topbar-btn vers dashboard
    document.querySelectorAll('.v40-topbar-btn, .v40-mobile-menu a, a').forEach(function(a) {
      var h = a.getAttribute('href') || '';
      if (h === DASH_URL || h === 'dashboard.html' || h === 'dashboard-private.html') {
        a.href = RETURN_URL;
      }
    });
  }

  // Intercepter les écritures localStorage pour capter le dernier ID de génération
  var _origSet = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key, value) {
    _origSet.apply(this, arguments);
    if (key === 'pope_v54_generations') {
      try {
        var gens = JSON.parse(value);
        if (Array.isArray(gens) && gens.length && gens[0].id != null) {
          var id = String(gens[0].id);
          sessionStorage.setItem('pope_v54_last_generation_id', id);
          sessionStorage.setItem('pope_v58_last_gen', id);
          sessionStorage.setItem('pope_v53_last_generation_id', id);
          // Aussi synchroniser vers pope_v53_generations pour dashboard-v5.js
          _origSet.call(localStorage, 'pope_v53_generations', value);
        }
      } catch(e) {}
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(wireLinks, 100);
      setTimeout(wireLinks, 700);
    });
  } else {
    setTimeout(wireLinks, 100);
    setTimeout(wireLinks, 700);
  }

})();
