// POPE Online — Dashboard V58
// State engine: persistance, accordéons, retour parcours, liaison app/draft
// Remplace dashboard-v54.js
(function () {
  'use strict';

  /* ─── Utils ─────────────────────────────────────────── */
  var $ = function (id) { return document.getElementById(id); };
  var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };
  var isPrivate = /dashboard-private\.html/i.test(location.pathname);
  var DASH_URL  = isPrivate ? 'dashboard-private.html' : 'dashboard.html';
  var APP_URL   = isPrivate ? 'app-private.html' : 'app.html';
  var STATE_KEY = 'pope_v58_state_' + (isPrivate ? 'private' : 'public');

  /* ─── Accordion toggle ───────────────────────────────── */
  window.v58Toggle = function (id) {
    var acc = $(id);
    if (!acc) return;
    var wasOpen = acc.classList.contains('is-open');
    // Allow multiple open; simple toggle
    acc.classList.toggle('is-open', !wasOpen);
  };

  /* ─── Update accordion preview & dot ─────────────────── */
  function updateAccPreviews() {
    var map = {
      v58AccCtx: 'descContexte',
      v58AccObj: 'descObjectif',
      v58AccCon: 'descContraintes',
      v58AccAct: 'descActeurs',
      v58AccPlus: 'besoInDesc'
    };
    var prevMap = {
      v58AccCtx: 'prevCtx',
      v58AccObj: 'prevObj',
      v58AccCon: 'prevCon',
      v58AccAct: 'prevAct',
      v58AccPlus: 'prevPlus'
    };
    Object.keys(map).forEach(function (accId) {
      var acc = $(accId);
      var field = $(map[accId]);
      var prev = $(prevMap[accId]);
      if (!acc || !field) return;
      var val = (field.value || '').trim();
      acc.classList.toggle('has-value', val.length > 0);
      if (prev) {
        prev.textContent = val ? val.substring(0, 50) + (val.length > 50 ? '…' : '') : prev.getAttribute('data-default') || '';
      }
    });
  }

  /* ─── Domain badge ───────────────────────────────────── */
  function showDomainBadge(domain, icon) {
    var badge = $('v58DomainBadge');
    var name  = $('v58DomainName');
    var ico   = $('v58DomainIcon');
    if (!badge) return;
    if (domain) {
      if (name)  name.textContent  = domain;
      if (ico)   ico.textContent   = icon || '🎯';
      badge.classList.add('visible');
    } else {
      badge.classList.remove('visible');
    }
  }

  /* ─── Persist state ──────────────────────────────────── */
  function getStateFields() {
    return {
      domain:      ($$('.v5-domain-pill.selected')[0] || {}).dataset && $$('.v5-domain-pill.selected')[0].dataset.domain || window._domain || '',
      domainIcon:  ($$('.v5-domain-pill.selected')[0] || {}).textContent && ($$('.v5-domain-pill.selected')[0].textContent.trim().split(' ')[0]) || '🎯',
      title:       ($('besoInTitle')    || {}).value || '',
      contexte:    ($('descContexte')   || {}).value || '',
      probleme:    ($('descProbleme')   || {}).value || '',
      objectif:    ($('descObjectif')   || {}).value || '',
      decision:    ($('descDecision')   || {}).value || '',
      livrable:    ($('descLivrable')   || {}).value || '',
      contraintes: ($('descContraintes')|| {}).value || '',
      risques:     ($('descRisques')    || {}).value || '',
      acteurs:     ($('descActeurs')    || {}).value || '',
      public_c:    ($('descPublic')     || {}).value || '',
      deadline:    ($('needDeadline')   || {}).value || '',
      pieces:      ($('descPieces')     || {}).value || '',
      niveau:      ($('descNiveau')     || {}).value || '',
      desc:        ($('besoInDesc')     || {}).value || '',
      type:        (document.querySelector('input[name="besoType"]:checked') || {}).value || 'conseil',
      step:        window._step || 1
    };
  }

  function saveDashboardState() {
    try {
      var data = getStateFields();
      var json = JSON.stringify(data);
      sessionStorage.setItem(STATE_KEY, json);
      localStorage.setItem(STATE_KEY, json);
    } catch (e) {}
  }

  function loadDashboardState() {
    try {
      var raw = sessionStorage.getItem(STATE_KEY) || localStorage.getItem(STATE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function restoreDashboardState() {
    var d = loadDashboardState();
    if (!d) return false;

    // Restore domain
    if (d.domain) {
      window._domain = d.domain;
      $$('.v5-domain-pill').forEach(function (b) {
        if (b.dataset.domain === d.domain) {
          b.classList.add('selected');
        }
      });
      showDomainBadge(d.domain, d.domainIcon);
    }

    // Restore fields
    var fieldMap = [
      ['besoInTitle',    'title'],
      ['descContexte',   'contexte'],
      ['descProbleme',   'probleme'],
      ['descObjectif',   'objectif'],
      ['descDecision',   'decision'],
      ['descLivrable',   'livrable'],
      ['descContraintes','contraintes'],
      ['descRisques',    'risques'],
      ['descActeurs',    'acteurs'],
      ['descPublic',     'public_c'],
      ['needDeadline',   'deadline'],
      ['descPieces',     'pieces'],
      ['descNiveau',     'niveau'],
      ['besoInDesc',     'desc']
    ];
    fieldMap.forEach(function (pair) {
      var el = $(pair[0]);
      if (el && d[pair[1]]) el.value = d[pair[1]];
    });

    // Restore radio
    var radio = document.querySelector('input[name="besoType"][value="' + (d.type || 'conseil') + '"]');
    if (radio) radio.checked = true;

    updateAccPreviews();
    return !!(d.domain);
  }

  window.saveDashboardState   = saveDashboardState;
  window.loadDashboardState   = loadDashboardState;
  window.restoreDashboardState = restoreDashboardState;

  /* ─── selectDomain override ──────────────────────────── */
  var _origSelectDomain = null;
  function patchSelectDomain() {
    if (_origSelectDomain || !window.selectDomain) return;
    _origSelectDomain = window.selectDomain;
    window.selectDomain = function (btn) {
      _origSelectDomain(btn);
      var domain = btn.getAttribute('data-domain');
      var icon   = btn.textContent.trim().split(' ')[0] || '🎯';
      window._domain = domain;
      showDomainBadge(domain, icon);
      saveDashboardState();
    };
  }

  /* ─── goStep override ────────────────────────────────── */
  var _origGoStep = null;
  function patchGoStep() {
    if (_origGoStep || !window.goStep) return;
    _origGoStep = window.goStep;
    window.goStep = function (n, _force) {
      // Ensure _domain is set before step guard
      if (n > 1 && !window._domain) {
        var restored = restoreDashboardState();
        if (!restored) {
          if (_origGoStep) _origGoStep(n);
          return;
        }
      }
      if (_origGoStep) _origGoStep(n);
      if (n === 3) populateGenerationSelect();
      saveDashboardState();
    };
  }

  /* ─── Draft link update ──────────────────────────────── */
  function updateDraftLinks() {
    $$('a[href="' + APP_URL + '"],a[href="app.html"],a[href="app-private.html"],#lnkDraftTool').forEach(function (a) {
      var base = a.getAttribute('href').split('?')[0];
      if (base === 'app.html' || base === 'app-private.html' || base === APP_URL) {
        a.href = base + '?from=dashboard&step=2';
        a.addEventListener('click', saveDashboardState);
      }
    });
  }

  /* ─── Generation select (step 3) ────────────────────── */
  function loadLocalGenerations() {
    try { return JSON.parse(localStorage.getItem('pope_v54_generations') || '[]'); } catch (e) { return []; }
  }

  function populateGenerationSelect() {
    var sel = $('archiveAttachSelect');
    if (!sel) return;
    var gens = loadLocalGenerations();
    var cur  = sel.value || sessionStorage.getItem('pope_v58_last_gen') || '';
    sel.innerHTML = '<option value="">Ne pas joindre de draft préparé</option>' +
      gens.map(function (g, i) {
        var lbl = (g.title || g.usecaseLabel || 'Draft préparé') + ' — ' +
                  (g.createdAt ? new Date(g.createdAt).toLocaleString('fr-FR') : '');
        return '<option value="' + (g.id || i) + '">' + lbl + '</option>';
      }).join('');
    if (cur) sel.value = cur;
  }

  window.attachLastDraftToNeed = function () {
    var gens = loadLocalGenerations();
    if (!gens.length) return;
    var lastId = gens[0].id;
    sessionStorage.setItem('pope_v58_last_gen', lastId);
    populateGenerationSelect();
  };

  /* ─── Handle return from app ─────────────────────────── */
  function handleUrlParams() {
    var sp   = new URLSearchParams(location.search);
    var from = sp.get('from');
    var step = parseInt(sp.get('step') || '0', 10);
    var attach = sp.get('attach') === 'last';

    if (from === 'app' || from === 'dashboard' || step || attach) {
      setTimeout(function () {
        if (window.switchTab) window.switchTab('besoin');
        var restored = restoreDashboardState();
        var target   = step || (attach ? 3 : 2);

        if (attach) {
          window.attachLastDraftToNeed();
          sessionStorage.setItem('pope_v58_last_gen',
            sessionStorage.getItem('pope_v54_last_generation_id') || '');
        }

        if (restored || target === 3) {
          if (window.goStep) window.goStep(target, true);
        }
        if (target === 3) populateGenerationSelect();
      }, 300);
    }
  }

  /* ─── submitBesoin override ──────────────────────────── */
  function buildFullDescription() {
    var parts = [];
    var add = function(k, label) {
      var el = $(k); if (el && el.value.trim()) parts.push(label + ' : ' + el.value.trim());
    };
    add('descContexte',    'Contexte');
    add('descProbleme',    'Problème');
    add('descObjectif',    'Objectif');
    add('descDecision',    'Décision attendue');
    add('descLivrable',    'Livrable attendu');
    add('descContraintes', 'Contraintes');
    add('descRisques',     'Points sensibles');
    add('descActeurs',     'Acteurs');
    add('descPublic',      'Destinataire');
    add('needDeadline',    'Échéance');
    add('descPieces',      'Pièces disponibles');
    add('descNiveau',      'Niveau de détail souhaité');
    var free = ($('besoInDesc') || {}).value || '';
    if (free.trim()) parts.push(free.trim());
    return parts.join('\n');
  }
  window.buildFullDescription = buildFullDescription;

  /* ─── Auto-save on input ─────────────────────────────── */
  document.addEventListener('input', function () {
    updateAccPreviews();
    saveDashboardState();
  }, true);
  document.addEventListener('change', function (e) {
    saveDashboardState();
    if (e.target && e.target.id === 'archiveAttachSelect') {
      sessionStorage.setItem('pope_v58_attached_gen', e.target.value || '');
    }
  }, true);

  /* ─── Init ───────────────────────────────────────────── */
  function init() {
    patchSelectDomain();
    patchGoStep();
    updateDraftLinks();
    restoreDashboardState();
    populateGenerationSelect();
    updateAccPreviews();
    handleUrlParams();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(init, 50);
    });
  } else {
    setTimeout(init, 50);
  }

  // Also patch after a short delay to catch late page init
  setTimeout(function () {
    patchSelectDomain();
    patchGoStep();
    updateDraftLinks();
    populateGenerationSelect();
  }, 600);

})();
