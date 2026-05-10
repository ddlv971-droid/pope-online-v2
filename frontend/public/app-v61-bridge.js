/** POPE Online — App Bridge V61 : retour parcours toujours étape 2, conservation du dernier draft. */
(function () {
  'use strict';
  var isPrivate = /app-private\.html/i.test(location.pathname) || (document.body && document.body.getAttribute('data-forced-space') === 'private');
  var DASH = isPrivate ? 'dashboard-private.html' : 'dashboard.html';
  var RETURN_URL = DASH + '?from=app&attach=last&step=2';
  function rememberLastGeneration() {
    try {
      var gens = JSON.parse(localStorage.getItem('pope_v54_generations') || '[]');
      if (Array.isArray(gens) && gens.length && gens[0].id != null) {
        sessionStorage.setItem('pope_v54_last_generation_id', String(gens[0].id));
        sessionStorage.setItem('pope_v58_last_gen', String(gens[0].id));
        sessionStorage.setItem('pope_v61_attached_gen', String(gens[0].id));
      }
    } catch(e) {}
  }
  function wire() {
    rememberLastGeneration();
    var selectors = [
      '#btnRetourDashboard', '#resultExpertLink', '#resultMissionLink', '#topbarHomeLink', '#appHomeLink',
      'a[href="dashboard.html"]', 'a[href="dashboard-private.html"]',
      'a[href^="dashboard.html?from=app"]', 'a[href^="dashboard-private.html?from=app"]'
    ];
    document.querySelectorAll(selectors.join(',')).forEach(function (a) {
      a.href = RETURN_URL;
      if (a.id === 'btnRetourDashboard' || /Retour/i.test(a.textContent || '')) a.textContent = '← Retour à mon parcours';
      a.addEventListener('click', rememberLastGeneration, true);
    });
  }
  var origSet = Storage.prototype.setItem;
  if (!Storage.prototype.setItem._popeV61) {
    Storage.prototype.setItem = function (k, v) { var r = origSet.apply(this, arguments); if (k === 'pope_v54_generations' || k === 'pope_v53_generations') setTimeout(rememberLastGeneration, 0); return r; };
    Storage.prototype.setItem._popeV61 = true;
  }
  document.addEventListener('click', function (e) { if (e.target.closest('#btnGenerate,#btnArchiveCurrent,.v36-next-btn')) setTimeout(rememberLastGeneration, 500); }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(wire, 100); }); else setTimeout(wire, 100);
  setTimeout(wire, 800); setTimeout(wire, 1800);
})();
