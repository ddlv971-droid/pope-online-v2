/**
 * POPE Online — State Manager V60
 * Single source of truth for dashboard ↔ app navigation
 * Reads/writes canonical key 'pope_need_state_{space}'
 * Also writes legacy keys for backward compat
 */
(function (global) {
  'use strict';

  var isPrivate = /private/i.test(
    (global.location && global.location.pathname) || ''
  );
  var SPACE = isPrivate ? 'private' : 'public';
  var KEY   = 'pope_need_state_' + SPACE;

  // Legacy keys written for backward compat (older scripts may read these)
  var LEGACY_KEYS = ['pope_v58_state_' + SPACE, 'pope_v57_state_' + SPACE];

  /* ── Read ─────────────────────────────────────────────── */
  function load() {
    try {
      var raw = sessionStorage.getItem(KEY) ||
                localStorage.getItem(KEY) ||
                // Fallback: read any legacy key
                (function () {
                  for (var i = 0; i < LEGACY_KEYS.length; i++) {
                    var v = sessionStorage.getItem(LEGACY_KEYS[i]) ||
                            localStorage.getItem(LEGACY_KEYS[i]);
                    if (v) return v;
                  }
                  return null;
                })();
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  /* ── Write ────────────────────────────────────────────── */
  function save(data) {
    try {
      var json = JSON.stringify(data);
      sessionStorage.setItem(KEY, json);
      localStorage.setItem(KEY, json);
      // Also write legacy keys
      for (var i = 0; i < LEGACY_KEYS.length; i++) {
        try { localStorage.setItem(LEGACY_KEYS[i], json); } catch (e) {}
      }
    } catch (e) {}
    return data;
  }

  /* ── Clear ────────────────────────────────────────────── */
  function clear() {
    try {
      sessionStorage.removeItem(KEY);
      localStorage.removeItem(KEY);
      for (var i = 0; i < LEGACY_KEYS.length; i++) {
        try {
          sessionStorage.removeItem(LEGACY_KEYS[i]);
          localStorage.removeItem(LEGACY_KEYS[i]);
        } catch (e) {}
      }
    } catch (e) {}
  }

  /* ── Generations ──────────────────────────────────────── */
  var GEN_KEY = 'pope_v54_generations';

  function loadGenerations() {
    try {
      return JSON.parse(localStorage.getItem(GEN_KEY) || '[]');
    } catch (e) { return []; }
  }

  function saveGeneration(entry) {
    try {
      var gens = loadGenerations();
      var gen = {
        id:           entry.id || ('gen_' + Date.now()),
        title:        entry.title || entry.usecaseLabel || 'Draft IA',
        usecaseLabel: entry.usecaseLabel || entry.title || 'Draft IA',
        createdAt:    entry.createdAt || new Date().toISOString(),
        result:       entry.result || '',
        prompt:       entry.prompt || {},
        domain:       (load() || {}).domain || ''
      };
      // Prevent duplicates
      gens = gens.filter(function(g){ return g.id !== gen.id; });
      gens.unshift(gen);
      if (gens.length > 30) gens = gens.slice(0, 30);
      localStorage.setItem(GEN_KEY, JSON.stringify(gens));
      sessionStorage.setItem('pope_v58_last_gen', gen.id);
      sessionStorage.setItem('pope_v54_last_generation_id', gen.id);
      return gen;
    } catch (e) { return entry; }
  }

  function getLastGenId() {
    return sessionStorage.getItem('pope_v58_last_gen') ||
           sessionStorage.getItem('pope_v54_last_generation_id') ||
           (function(){ var g=loadGenerations(); return g.length?g[0].id:''; })();
  }

  /* ── Build URL to dashboard with step ────────────────── */
  function dashUrl(step, attachLast) {
    var base = isPrivate ? 'dashboard-private.html' : 'dashboard.html';
    var params = [];
    params.push('from=app');
    if (step) params.push('step=' + step);
    if (attachLast) params.push('attach=last');
    return base + (params.length ? '?' + params.join('&') : '');
  }

  /* ── Build URL to app with context ───────────────────── */
  function appUrl() {
    var base = isPrivate ? 'app-private.html' : 'app.html';
    return base + '?from=dashboard&step=2';
  }

  /* ── Public API ───────────────────────────────────────── */
  global.POPEState = {
    KEY:   KEY,
    SPACE: SPACE,
    load:       load,
    save:       save,
    clear:      clear,
    loadGenerations:  loadGenerations,
    saveGeneration:   saveGeneration,
    getLastGenId:     getLastGenId,
    dashUrl:    dashUrl,
    appUrl:     appUrl,
    isPrivate:  isPrivate
  };

  // Also write to window for easy access
  global.loadDashboardState   = load;
  global.saveDashboardState   = save;
  global.restoreDashboardState = function() {
    var d = load(); if(!d) return false;
    return d;
  };

})(window);
