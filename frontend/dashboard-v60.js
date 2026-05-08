/**
 * POPE Online — Dashboard Engine V60
 * Dépend de pope-state.js (chargé avant ce script)
 * Gère : accordéons, badge domaine, persistance, navigation multi-étapes,
 * liaison app ↔ dashboard, drafts, génération select
 */
(function () {
  'use strict';

  /* ─── Utils ──────────────────────────────────────────── */
  var $ = function (id) { return document.getElementById(id); };
  var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  var S = window.POPEState; // State manager
  if (!S) { console.error('pope-state.js must load before dashboard-v60.js'); return; }

  /* ─── Accordion ──────────────────────────────────────── */
  window.v58Toggle = function (id) {
    var acc = $(id);
    if (!acc) return;
    acc.classList.toggle('is-open');
    // Save state after toggle (so open/closed state persists... optionally)
  };

  /* ─── Preview dots ───────────────────────────────────── */
  var PREVIEW_MAP = {
    v58AccCtx:  { field: 'descContexte',   prev: 'prevCtx' },
    v58AccObj:  { field: 'descObjectif',   prev: 'prevObj' },
    v58AccCon:  { field: 'descContraintes',prev: 'prevCon' },
    v58AccAct:  { field: 'descActeurs',    prev: 'prevAct' },
    v58AccPlus: { field: 'besoInDesc',     prev: 'prevPlus' }
  };

  function updatePreviews() {
    Object.keys(PREVIEW_MAP).forEach(function (accId) {
      var cfg = PREVIEW_MAP[accId];
      var acc  = $(accId);
      var fld  = $(cfg.field);
      var prev = $(cfg.prev);
      if (!acc || !fld) return;
      var val = (fld.value || '').trim();
      acc.classList.toggle('has-value', val.length > 0);
      if (prev) {
        prev.textContent = val
          ? val.substring(0, 55) + (val.length > 55 ? '…' : '')
          : '';
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
      if (name) name.textContent  = domain;
      if (ico)  ico.textContent   = icon || '🎯';
      badge.classList.add('visible');
    } else {
      badge.classList.remove('visible');
    }
    // Show badge at step 2, 3, 4
    badge.style.display = (window._step || 1) >= 2 ? '' : '';
  }

  /* ─── Collect fields → state object ──────────────────── */
  function collectFields() {
    var domainPill = $$('.v5-domain-pill.selected')[0];
    return {
      domain:      (domainPill && domainPill.dataset.domain) || window._domain || '',
      domainIcon:  domainPill ? domainPill.textContent.trim().split(' ')[0] : '🎯',
      title:       ($('besoInTitle')     || {}).value || '',
      contexte:    ($('descContexte')    || {}).value || '',
      probleme:    ($('descProbleme')    || {}).value || '',
      objectif:    ($('descObjectif')    || {}).value || '',
      decision:    ($('descDecision')    || {}).value || '',
      livrable:    ($('descLivrable')    || {}).value || '',
      contraintes: ($('descContraintes') || {}).value || '',
      risques:     ($('descRisques')     || {}).value || '',
      acteurs:     ($('descActeurs')     || {}).value || '',
      publicDest:  ($('descPublic')      || {}).value || '',
      deadline:    ($('needDeadline')    || {}).value || '',
      pieces:      ($('descPieces')      || {}).value || '',
      niveau:      ($('descNiveau')      || {}).value || '',
      desc:        ($('besoInDesc')      || {}).value || '',
      type:        (document.querySelector('input[name="besoType"]:checked') || {}).value || 'conseil',
      step:        window._step || 1,
      savedAt:     new Date().toISOString()
    };
  }

  /* ─── Save state ─────────────────────────────────────── */
  function saveDashboardState() {
    S.save(collectFields());
  }
  window.saveDashboardState = saveDashboardState;

  /* ─── Restore state ──────────────────────────────────── */
  function restoreDashboardState() {
    var d = S.load();
    if (!d) return false;

    // 1. Restore domain
    if (d.domain) {
      window._domain = d.domain;
      window._domain && (window._domain = d.domain); // belt & suspenders
      $$('.v5-domain-pill').forEach(function (b) {
        b.classList.toggle('selected', b.dataset.domain === d.domain);
      });
      showDomainBadge(d.domain, d.domainIcon);
    }

    // 2. Restore text fields
    [
      ['besoInTitle',     'title'],
      ['descContexte',    'contexte'],
      ['descProbleme',    'probleme'],
      ['descObjectif',    'objectif'],
      ['descDecision',    'decision'],
      ['descLivrable',    'livrable'],
      ['descContraintes', 'contraintes'],
      ['descRisques',     'risques'],
      ['descActeurs',     'acteurs'],
      ['descPublic',      'publicDest'],
      ['needDeadline',    'deadline'],
      ['descPieces',      'pieces'],
      ['descNiveau',      'niveau'],
      ['besoInDesc',      'desc']
    ].forEach(function (pair) {
      var el = $(pair[0]);
      if (el && d[pair[1]]) el.value = d[pair[1]];
    });

    // 3. Restore radio
    var radio = document.querySelector('input[name="besoType"][value="' + (d.type || 'conseil') + '"]');
    if (radio) radio.checked = true;

    // 4. Open accordions that have content
    $$('.v58-acc').forEach(function(acc){
      var fldId = acc.dataset.field;
      var fld = fldId ? $(fldId) : null;
      if (fld && fld.value.trim()) acc.classList.add('has-value');
    });

    updatePreviews();
    return !!(d.domain);
  }
  window.restoreDashboardState = restoreDashboardState;

  /* ─── Build full description for submitBesoin ────────── */
  function buildFullDescription() {
    var parts = [];
    var add = function (id, label) {
      var el = $(id); if (el && el.value.trim()) parts.push(label + ' : ' + el.value.trim());
    };
    add('descContexte',    'Contexte');
    add('descProbleme',    'Problème');
    add('descObjectif',    'Objectif');
    add('descDecision',    'Décision attendue');
    add('descLivrable',    'Livrable attendu');
    add('descContraintes', 'Contraintes');
    add('descRisques',     'Points sensibles');
    add('descActeurs',     'Acteurs concernés');
    add('descPublic',      'Destinataire');
    add('needDeadline',    'Échéance');
    add('descPieces',      'Pièces disponibles');
    add('descNiveau',      'Niveau de détail');
    var free = ($('besoInDesc') || {}).value || '';
    if (free.trim()) parts.push(free.trim());
    return parts.join('\n');
  }
  window.buildFullDescription = buildFullDescription;

  /* ─── Update all draft-related links ─────────────────── */
  function updateDraftLinks() {
    var appUrl = S.appUrl();
    // lnkDraftTool (step 2)
    var lnk = $('lnkDraftTool');
    if (lnk) {
      lnk.href = appUrl;
      lnk.addEventListener('click', saveDashboardState);
    }
    // lnkDraftStep3 (step 3)
    var lnk3 = $('lnkDraftStep3');
    if (lnk3) {
      lnk3.href = appUrl;
      lnk3.addEventListener('click', saveDashboardState);
    }
    // Any other app links
    $$('a[href="app.html"],a[href="app-private.html"]').forEach(function (a) {
      var base = a.getAttribute('href').split('?')[0];
      a.href = base + '?from=dashboard&step=2';
      a.addEventListener('click', saveDashboardState);
    });
  }

  /* ─── Generation select (step 3) ────────────────────── */
  function refreshGenerationSelect() {
    var sel = $('archiveAttachSelect');
    if (!sel) return;
    var gens = S.loadGenerations();
    var lastId = S.getLastGenId();

    sel.innerHTML = '<option value="">Ne pas joindre de draft préparé</option>' +
      gens.map(function (g) {
        var lbl = (g.title || g.usecaseLabel || 'Draft IA');
        if (g.domain) lbl += ' — ' + g.domain;
        if (g.createdAt) lbl += ' — ' + new Date(g.createdAt).toLocaleString('fr-FR');
        return '<option value="' + (g.id || '') + '">' + lbl + '</option>';
      }).join('');

    if (lastId) sel.value = lastId;

    // Draft status badge
    var status = $('v59DraftStatus');
    if (status) status.style.display = (gens.length && sel.value) ? 'block' : 'none';

    // Update step 3 link text
    var lnk3 = $('lnkDraftStep3');
    if (lnk3) lnk3.textContent = gens.length ? 'Générer un nouveau draft →' : 'Créer un draft →';

    // Render draft cards
    renderDraftCards(gens);
  }
  window.refreshGenerationSelect = refreshGenerationSelect;

  /* ─── Draft cards (step 3 visual list) ──────────────── */
  function renderDraftCards(gens) {
    var container = $('v60DraftCards');
    if (!container) return;
    if (!gens || !gens.length) {
      container.innerHTML = '<div style="color:#94a3b8;font-size:13px;padding:12px 0">Aucun draft généré. Utilisez l\'outil IA pour préparer votre demande.</div>';
      return;
    }
    container.innerHTML = gens.slice(0, 5).map(function (g) {
      var date = g.createdAt ? new Date(g.createdAt).toLocaleDateString('fr-FR', {day:'2-digit',month:'short',year:'numeric'}) : '';
      var preview = (g.result || '').substring(0, 120).replace(/</g,'&lt;');
      return [
        '<div class="v60-draft-card" onclick="v60SelectDraft(\'' + (g.id||'') + '\')">',
        '  <div class="v60-draft-card-head">',
        '    <span class="v60-draft-card-title">' + (g.title||g.usecaseLabel||'Draft') + '</span>',
        '    <span class="v60-draft-card-meta">' + (g.domain?'📁 '+g.domain+' — ':'') + date + '</span>',
        '  </div>',
        preview ? '  <div class="v60-draft-card-preview">' + preview + '…</div>' : '',
        '  <button class="v60-draft-card-btn" type="button">Sélectionner ce draft</button>',
        '</div>'
      ].join('\n');
    }).join('\n');
  }

  window.v60SelectDraft = function (id) {
    var sel = $('archiveAttachSelect');
    if (sel) {
      sel.value = id;
      // Trigger change
      sel.dispatchEvent(new Event('change'));
    }
    sessionStorage.setItem('pope_v58_last_gen', id);
    var status = $('v59DraftStatus');
    if (status) status.style.display = 'block';
    // Highlight selected card
    $$('.v60-draft-card').forEach(function(c){ c.classList.remove('selected'); });
    // Find the card and highlight
    $$('.v60-draft-card').forEach(function(c){
      var btn = c.querySelector('.v60-draft-card-btn');
      // Re-render to apply selection
    });
    refreshGenerationSelect();
  };

  /* ─── selectDomain wrapper ───────────────────────────── */
  var _origSelectDomain = null;
  function patchSelectDomain() {
    if (!window.selectDomain || _origSelectDomain) return;
    _origSelectDomain = window.selectDomain;
    window.selectDomain = function (btn) {
      _origSelectDomain(btn);
      var domain = btn.getAttribute('data-domain') || btn.dataset.domain;
      var icon   = btn.textContent.trim().split(' ')[0] || '🎯';
      window._domain = domain;
      showDomainBadge(domain, icon);
      saveDashboardState();
    };
  }

  /* ─── goStep wrapper ─────────────────────────────────── */
  var _origGoStep = null;
  function patchGoStep() {
    if (!window.goStep || _origGoStep) return;
    _origGoStep = window.goStep;
    window.goStep = function (n, _force) {
      // Ensure _domain is set before navigation guard
      if (n > 1 && !window._domain) {
        var state = S.load();
        if (state && state.domain) {
          window._domain = state.domain;
          restoreDashboardState();
        }
      }
      _origGoStep(n);
      // Post-step actions
      if (n >= 2) showDomainBadge(window._domain, null);
      if (n === 3) setTimeout(refreshGenerationSelect, 100);
      saveDashboardState();
    };
  }

  /* ─── forceStep: robust step navigation ─────────────── */
  function forceStep(n) {
    // 1. Ensure state restored first
    restoreDashboardState();

    // 2. Use patched goStep if available
    setTimeout(function () {
      if (window.switchTab) window.switchTab('besoin');

      // Navigate
      if (window.goStep) {
        window.goStep(n);
      } else {
        // Direct DOM manipulation fallback
        for (var i = 1; i <= 4; i++) {
          var p = $('step-panel-' + i);
          if (p) { p.classList.toggle('active', i === n); }
        }
        $$('.v5-step').forEach(function (s) {
          var sn = parseInt(s.dataset.step, 10);
          s.classList.toggle('active', sn === n);
          s.classList.toggle('done', sn < n);
        });
      }

      // Step-specific actions
      if (n === 2) showDomainBadge(window._domain, null);
      if (n === 3) refreshGenerationSelect();
    }, 150);
  }

  /* ─── Handle URL params on load ─────────────────────── */
  function handleUrlParams() {
    var sp     = new URLSearchParams(location.search);
    var from   = sp.get('from');
    var step   = parseInt(sp.get('step') || '0', 10);
    var attach = sp.get('attach') === 'last';

    if (!from && !step && !attach) return;

    setTimeout(function () {
      if (attach) {
        // Last gen becomes selected
        sessionStorage.setItem('pope_v58_last_gen', S.getLastGenId());
      }
      var target = step || (attach ? 3 : 2);
      forceStep(target);
      if (attach || target === 3) setTimeout(refreshGenerationSelect, 300);
    }, 200);
  }

  /* ─── Auto-save on every input ───────────────────────── */
  document.addEventListener('input', function () {
    updatePreviews();
    saveDashboardState();
  }, true);
  document.addEventListener('change', function (e) {
    saveDashboardState();
    if (e.target && e.target.id === 'archiveAttachSelect') {
      sessionStorage.setItem('pope_v58_last_gen', e.target.value || '');
    }
  }, true);

  /* ─── Init ───────────────────────────────────────────── */
  function init() {
    patchSelectDomain();
    patchGoStep();
    restoreDashboardState();
    updatePreviews();
    updateDraftLinks();
    refreshGenerationSelect();
    handleUrlParams();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 50); });
  } else {
    setTimeout(init, 50);
  }

  // Late patch (for scripts that load after us)
  setTimeout(function () {
    patchSelectDomain();
    patchGoStep();
    updateDraftLinks();
  }, 800);

})();
