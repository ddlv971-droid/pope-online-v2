/* POPE Online V90.1 — cloisonnement des données locales par compte.
   Script classique (pas de module) : chargé en tête de chaque page, avant les autres scripts.
   - Les générations/brouillons stockés dans le navigateur appartiennent à UN compte.
   - Changement de compte, déconnexion ou données d'origine inconnue => purge.
   - Durée de vie maximale des générations locales : 30 jours. */
(function () {
  if (window.PopeDataGuard) return;
  var OWNER_KEY = 'pope_data_owner';
  var TTL_MS = 30 * 24 * 3600 * 1000;
  var EXACT = [
    'pope_v54_generations', 'pope_v53_generations', 'pope_v54_last_generation_id', 'pope_v53_last_generation_id',
    'pope_v54_attached_generation_id', 'pope_v56_last_draft_id', 'pope_v58_last_gen', 'pope_v58_attached_gen',
    'pope_v61_last_gen', 'pope_v61_attached_gen', 'pope_v61_vault_files', 'pope2_last_gen', 'pope2_pending_gen',
    'pope_last_generation_public', 'pope_last_generation_private', 'pope_v58_state_public', 'pope_v58_state_private',
    'pope_v57_state_public', 'pope_v57_state_private', 'v5_prefill', 'pope_diag_flash_v1'
  ];
  var PREFIXES = ['pope_archive_v10:', 'pope_archive_auto_v10:', 'pope_fiche_', 'pope_expert_form_', 'pope_app_form_'];

  function safe(fn) { try { return fn(); } catch (e) { return null; } }
  function userId(u) { return u ? String(u.id || u.email || '') : ''; }
  function currentUser() {
    return safe(function () { return JSON.parse(localStorage.getItem('pope_session_user') || 'null'); });
  }
  function purgeStore(store) {
    safe(function () {
      var keys = [], i;
      for (i = 0; i < store.length; i++) keys.push(store.key(i));
      keys.forEach(function (k) {
        if (EXACT.indexOf(k) !== -1 || PREFIXES.some(function (p) { return k.indexOf(p) === 0; })) store.removeItem(k);
      });
    });
  }
  function purge() { purgeStore(localStorage); purgeStore(sessionStorage); }
  function expire() {
    ['pope_v54_generations', 'pope_v53_generations'].forEach(function (k) {
      safe(function () {
        var arr = JSON.parse(localStorage.getItem(k) || '[]');
        if (!Array.isArray(arr)) return;
        var keep = arr.filter(function (g) { var t = Date.parse(g && (g.createdAt || g.updatedAt)); return !t || Date.now() - t < TTL_MS; });
        if (keep.length !== arr.length) localStorage.setItem(k, JSON.stringify(keep));
      });
    });
  }
  // À appeler à chaque chargement et juste après une connexion.
  function check(user) {
    var u = (user && userId(user)) ? user : currentUser();
    var id = userId(u);
    var owner = safe(function () { return localStorage.getItem(OWNER_KEY); });
    if (!id) { purge(); safe(function () { localStorage.removeItem(OWNER_KEY); }); return; }
    if (owner !== id) { purge(); safe(function () { localStorage.setItem(OWNER_KEY, id); }); return; }
    expire();
  }
  window.PopeDataGuard = { check: check, purge: purge, onLogout: function () { purge(); safe(function () { localStorage.removeItem(OWNER_KEY); }); } };
  check();
})();
