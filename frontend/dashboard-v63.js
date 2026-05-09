/* POPE Online V63 — moteur dashboard public/privé sans onclick inline
   Correctif critique : supprime la dépendance à goStep/selectDomain globaux au moment du clic,
   expose tout de même les fonctions sur window pour compatibilité, et restaure l'état du parcours. */
(function () {
  'use strict';

  var path = (window.location.pathname || '').toLowerCase();
  var isPrivate = path.indexOf('dashboard-private') !== -1 || path.indexOf('private') !== -1;
  var space = isPrivate ? 'private' : 'public';
  var State = window.POPEV61State || window.POPEState || null;
  var STATE_KEY = 'pope_need_state_' + space;
  var LEGACY_KEYS = ['pope_v58_state_' + space, 'pope_v57_state_' + space, 'pope_v60_state_' + space];

  function $(id) { return document.getElementById(id); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function parseJson(raw, fallback) { try { return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; } }
  function esc(s) { return String(s || '').replace(/[&<>"']/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]); }); }
  function firstStorage(keys) {
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var v = sessionStorage.getItem(k) || localStorage.getItem(k);
      if (v) return v;
    }
    return '';
  }

  function defaultState() {
    return { version:'v63', space:space, step:1, domain:'', domainIcon:'🎯', need:{}, drafts:[], selectedDraft:'', documents:[], scrollY:0, updatedAt:new Date().toISOString() };
  }

  function normalizeState(st) {
    st = Object.assign(defaultState(), st || {});
    st.need = Object.assign({}, st.need || {});
    st.drafts = Array.isArray(st.drafts) ? st.drafts : [];
    st.documents = Array.isArray(st.documents) ? st.documents : [];
    st.space = space;
    st.version = 'v63';
    return st;
  }

  function loadState() {
    var st = null;
    if (State && typeof State.load === 'function') {
      try { st = State.load(); } catch (e) { st = null; }
    }
    if (!st || !st.space) st = parseJson(firstStorage([STATE_KEY].concat(LEGACY_KEYS)), null);
    return normalizeState(st);
  }

  function saveState(patch) {
    var base = loadState();
    patch = patch || {};
    var next = normalizeState(Object.assign({}, base, patch));
    next.need = Object.assign({}, base.need || {}, patch.need || {});
    next.updatedAt = new Date().toISOString();
    if (State && typeof State.save === 'function') {
      try { State.save(next); } catch (e) {}
    }
    try {
      var json = JSON.stringify(next);
      sessionStorage.setItem(STATE_KEY, json);
      localStorage.setItem(STATE_KEY, json);
      LEGACY_KEYS.forEach(function (k) { sessionStorage.setItem(k, json); localStorage.setItem(k, json); });
    } catch (e) {}
    return next;
  }

  function val(id) { var el = $(id); return el ? (el.value || '') : ''; }
  function setVal(id, value) { var el = $(id); if (el && value !== undefined && value !== null) el.value = value; }

  function collectNeed() {
    var radio = document.querySelector('input[name="besoType"]:checked');
    return {
      title: val('besoInTitle'),
      context: val('descContexte'),
      problem: val('descProbleme'),
      objective: val('descObjectif'),
      decision: val('descDecision'),
      deliverable: val('descLivrable'),
      constraints: val('descContraintes'),
      risks: val('descRisques'),
      actors: val('descActeurs'),
      audience: val('descPublic'),
      deadline: val('needDeadline'),
      pieces: val('descPieces'),
      detailLevel: val('descNiveau'),
      description: val('besoInDesc'),
      urgency: val('needUrgency'),
      sensitivity: val('needSensitivity'),
      treatment: radio ? radio.value : 'conseil'
    };
  }

  function hydrateNeed(need) {
    need = need || {};
    setVal('besoInTitle', need.title);
    setVal('descContexte', need.context);
    setVal('descProbleme', need.problem);
    setVal('descObjectif', need.objective);
    setVal('descDecision', need.decision);
    setVal('descLivrable', need.deliverable);
    setVal('descContraintes', need.constraints);
    setVal('descRisques', need.risks);
    setVal('descActeurs', need.actors);
    setVal('descPublic', need.audience);
    setVal('needDeadline', need.deadline);
    setVal('descPieces', need.pieces);
    setVal('descNiveau', need.detailLevel);
    setVal('besoInDesc', need.description);
    setVal('needUrgency', need.urgency);
    setVal('needSensitivity', need.sensitivity);
    if (need.treatment) {
      $all('input[name="besoType"]').forEach(function (r) { r.checked = r.value === need.treatment; });
    }
  }

  function currentStep() {
    var active = $all('.v5-step-panel').filter(function (p) { return p.classList.contains('active') && !p.hasAttribute('hidden'); })[0];
    if (active && active.id) return parseInt(active.id.replace('step-panel-', ''), 10) || 1;
    return loadState().step || 1;
  }

  function renderDomain(domain, icon) {
    var st = loadState();
    domain = domain || window._domain || st.domain || '';
    icon = icon || st.domainIcon || '🎯';
    window._domain = domain;

    // Badges V56/V58 déjà présents
    [['selectedDomainBadge','selectedDomainLabel','selectedDomainIcon'], ['v58DomainBadge','v58DomainName','v58DomainIcon']].forEach(function (ids) {
      var box = $(ids[0]), label = $(ids[1]), ico = $(ids[2]);
      if (box) box.style.display = domain ? '' : 'none';
      if (label) label.textContent = domain || '—';
      if (ico) ico.textContent = icon || '🎯';
    });

    $all('.v63-domain-reminder').forEach(function (el) {
      el.style.display = domain ? 'flex' : 'none';
      el.innerHTML = '<span class="v63-domain-ico">' + esc(icon || '🎯') + '</span><span>Domaine sélectionné : <strong>' + esc(domain) + '</strong></span>';
    });

    $all('.v5-domain-pill').forEach(function (pill) {
      pill.classList.toggle('selected', (pill.getAttribute('data-domain') || '') === domain);
    });
  }

  function ensureStyleAndReminders() {
    if (!$('v63-dashboard-style')) {
      var style = document.createElement('style');
      style.id = 'v63-dashboard-style';
      style.textContent = '.v63-domain-reminder{display:none;align-items:center;gap:10px;margin:0 0 18px 0;padding:12px 14px;border:1px solid rgba(15,35,80,.14);border-radius:16px;background:linear-gradient(135deg,rgba(255,255,255,.98),rgba(246,248,252,.96));box-shadow:0 10px 30px rgba(15,35,80,.07);color:#102044;font-weight:650}.v63-domain-ico{width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;border-radius:12px;background:#eef3ff}.v60-draft-card.selected,.v60-draft-card.is-selected{outline:2px solid #0f2d5c}.v61-empty{padding:16px;border:1px dashed rgba(15,35,80,.18);border-radius:16px;background:#fff;color:#526070}';
      document.head.appendChild(style);
    }
    ['step-panel-2','step-panel-3','step-panel-4'].forEach(function (id) {
      var panel = $(id);
      if (!panel || panel.querySelector('.v63-domain-reminder')) return;
      var anchor = panel.querySelector('.v5-panel-head, .v58-title, h2, h3') || panel.firstElementChild;
      var el = document.createElement('div');
      el.className = 'v63-domain-reminder';
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(el, anchor.nextSibling);
      else panel.insertBefore(el, panel.firstChild);
    });
  }

  function goStep(step, opts) {
    step = parseInt(step, 10) || 1;
    opts = opts || {};
    var st = loadState();
    var domain = window._domain || st.domain || '';
    if (step > 1 && !domain) {
      var grid = $('domainGrid');
      if (grid) {
        grid.style.boxShadow = '0 0 0 3px #ef4444';
        grid.style.borderRadius = '16px';
        setTimeout(function () { grid.style.boxShadow = ''; grid.style.borderRadius = ''; }, 1200);
      }
      step = 1;
    }
    $all('.v5-step-panel').forEach(function (p) {
      var active = p.id === 'step-panel-' + step;
      p.classList.toggle('active', active);
      if (active) p.removeAttribute('hidden'); else p.setAttribute('hidden', '');
    });
    $all('.v5-step').forEach(function (s) {
      var n = parseInt(s.dataset.step || s.getAttribute('data-v63-step'), 10) || 1;
      s.classList.toggle('active', n === step);
      s.classList.toggle('done', n < step);
    });
    saveState({ step: step, domain: domain, need: collectNeed(), scrollY: window.scrollY || 0 });
    renderDomain(domain);
    updateAppLinks();
    if (step === 3) refreshDrafts();
    if (step === 4 && typeof window.updateRecap === 'function') { try { window.updateRecap(); } catch(e) {} }
    if (!opts.noScroll) setTimeout(function(){ window.scrollTo({ top: 0, behavior: 'smooth' }); }, 10);
  }

  function selectDomain(target) {
    var btn = target && target.closest ? target.closest('.v5-domain-pill') : target;
    if (!btn) return;
    var domain = btn.getAttribute('data-domain') || btn.textContent.replace(/^\S+\s*/, '').trim();
    var icon = (btn.textContent.trim().split(/\s+/)[0] || '🎯');
    window._domain = domain;
    saveState({ domain: domain, domainIcon: icon, step: 1, need: collectNeed() });
    renderDomain(domain, icon);
  }

  function switchTab(name) {
    $all('.v5-tab').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === name); });
    $all('.v5-tab-content').forEach(function (c) { if (c.id === 'tab-' + name) c.removeAttribute('hidden'); else c.setAttribute('hidden', ''); });
    if (name === 'experts' && typeof window.loadRequests === 'function') { try { window.loadRequests(); } catch(e) {} }
  }

  function toggleAccordion(id) { var el = $(id); if (el) el.classList.toggle('is-open'); }

  function updateAppLinks() {
    var app = isPrivate ? 'app-private.html' : 'app.html';
    var step = currentStep() || loadState().step || 2;
    var href = app + '?from=dashboard&step=' + encodeURIComponent(step);
    $all('a[href*="app.html"],a[href*="app-private.html"],#lnkDraftTool,#lnkDraftStep3').forEach(function (a) {
      if (a && a.setAttribute) a.setAttribute('href', href);
    });
  }

  function loadGenerations() {
    var gens = [];
    if (State && typeof State.loadGenerations === 'function') { try { gens = State.loadGenerations() || []; } catch(e) {} }
    if (!gens.length) gens = parseJson(localStorage.getItem('pope_v54_generations'), []) || [];
    return Array.isArray(gens) ? gens : [];
  }

  function refreshDrafts() {
    var gens = loadGenerations();
    var st = loadState();
    var selected = st.selectedDraft || (gens[0] && gens[0].id) || '';
    var sel = $('archiveAttachSelect');
    if (sel) {
      sel.innerHTML = '<option value="">Ne pas joindre de draft préparé</option>' + gens.map(function (g) {
        var label = (g.title || g.usecaseLabel || 'Draft préparé') + (g.domain ? ' — ' + g.domain : '') + (g.createdAt ? ' — ' + new Date(g.createdAt).toLocaleString('fr-FR') : '');
        return '<option value="' + esc(g.id || '') + '">' + esc(label) + '</option>';
      }).join('');
      if (selected) sel.value = selected;
      sel.onchange = function () { saveState({ selectedDraft: sel.value }); renderDraftCards(); };
    }
    renderDraftCards();
  }

  function renderDraftCards() {
    var container = $('v60DraftCards');
    if (!container) return;
    var gens = loadGenerations();
    var selected = (($('archiveAttachSelect') || {}).value) || loadState().selectedDraft || '';
    if (!gens.length) {
      container.innerHTML = '<div class="v61-empty">Aucun draft généré pour le moment. Cliquez sur “Créer un draft”, puis revenez ici pour le joindre à votre demande.</div>';
      return;
    }
    container.innerHTML = gens.slice(0, 5).map(function (g) {
      var id = g.id || '';
      var date = g.createdAt ? new Date(g.createdAt).toLocaleString('fr-FR') : '';
      var preview = String(g.result || g.output || g.text || '').slice(0, 170);
      return '<div class="v60-draft-card ' + (selected === id ? 'is-selected' : '') + '" data-gen-id="' + esc(id) + '">' +
        '<div class="v60-draft-card-head"><span class="v60-draft-card-title">' + esc(g.title || g.usecaseLabel || 'Draft préparé') + '</span><span class="v60-draft-card-meta">' + esc((g.domain || loadState().domain || '') + (date ? ' · ' + date : '')) + '</span></div>' +
        (preview ? '<div class="v60-draft-card-preview">' + esc(preview) + '…</div>' : '') +
        '<button type="button" class="v60-draft-card-btn">Sélectionner ce draft</button></div>';
    }).join('');
  }

  function selectDraft(id) {
    var sel = $('archiveAttachSelect');
    if (sel) sel.value = id;
    saveState({ selectedDraft: id });
    renderDraftCards();
  }

  function buildFullDescription() {
    var n = collectNeed();
    return [
      ['Contexte', n.context], ['Problème à résoudre', n.problem], ['Objectif', n.objective],
      ['Décision attendue', n.decision], ['Livrable attendu', n.deliverable], ['Contraintes', n.constraints],
      ['Risques / points sensibles', n.risks], ['Acteurs concernés', n.actors], ['Public destinataire', n.audience],
      ['Échéance', n.deadline], ['Pièces disponibles', n.pieces], ['Niveau de détail', n.detailLevel],
      ['Précisions complémentaires', n.description]
    ].filter(function (r) { return String(r[1] || '').trim(); }).map(function (r) { return r[0] + ' : ' + r[1]; }).join('\n\n');
  }

  function submitBesoin() {
    saveState({ step: 4, need: collectNeed() });
    goStep(4);
    var msg = $('msgBesoin');
    if (msg) { msg.textContent = 'Votre besoin est prêt à être transmis à un expert POPE Online.'; msg.className = 'v5-msg ok-show'; }
    return false;
  }

  function wireEvents() {
    document.addEventListener('click', function (e) {
      var d = e.target.closest('[data-v63-domain],.v5-domain-pill');
      if (d && d.classList.contains('v5-domain-pill')) { e.preventDefault(); selectDomain(d); return; }
      var stepEl = e.target.closest('[data-v63-step]');
      if (stepEl) { e.preventDefault(); goStep(stepEl.getAttribute('data-v63-step')); return; }
      var tabEl = e.target.closest('[data-v63-tab]');
      if (tabEl) { e.preventDefault(); switchTab(tabEl.getAttribute('data-v63-tab')); return; }
      var tog = e.target.closest('[data-v63-toggle]');
      if (tog) { e.preventDefault(); toggleAccordion(tog.getAttribute('data-v63-toggle')); return; }
      var sub = e.target.closest('[data-v63-submit]');
      if (sub) { e.preventDefault(); submitBesoin(); return; }
      var card = e.target.closest('.v60-draft-card');
      if (card) { e.preventDefault(); selectDraft(card.getAttribute('data-gen-id')); return; }
    }, true);

    document.addEventListener('input', function () { saveState({ step: currentStep(), need: collectNeed() }); updateAppLinks(); }, true);
    document.addEventListener('change', function () { saveState({ step: currentStep(), need: collectNeed() }); updateAppLinks(); }, true);
  }

  function restore() {
    ensureStyleAndReminders();
    var st = loadState();
    if (st.domain) window._domain = st.domain;
    hydrateNeed(st.need || {});
    renderDomain(st.domain, st.domainIcon);
    updateAppLinks();
    var params = new URLSearchParams(window.location.search || '');
    var targetStep = parseInt(params.get('step') || st.step || '1', 10) || 1;
    if (params.get('attach') === 'last' && State && typeof State.lastGenId === 'function') {
      try { saveState({ selectedDraft: State.lastGenId() }); } catch(e) {}
      targetStep = 3;
    }
    goStep(targetStep, { noScroll: true });
    refreshDrafts();
  }

  function init() {
    wireEvents();
    restore();
    // Signal utile en console pour vérifier que le bon fichier est chargé.
    try { console.info('[POPE V63] dashboard engine loaded', { space: space, domain: loadState().domain, step: loadState().step }); } catch(e) {}
  }

  // Exposition globale immédiate : même si un onclick résiduel subsiste, il ne cassera plus.
  window.goStep = goStep;
  window.forceStep = goStep;
  window.selectDomain = selectDomain;
  window.switchTab = switchTab;
  window.v58Toggle = toggleAccordion;
  window.submitBesoin = submitBesoin;
  window.saveDashboardState = function () { return saveState({ step: currentStep(), need: collectNeed() }); };
  window.loadDashboardState = loadState;
  window.restoreDashboardState = restore;
  window.restoreDashboardStep = function () { restore(); return true; };
  window.refreshGenerationSelect = refreshDrafts;
  window.v60SelectDraft = selectDraft;
  window.buildFullDescription = buildFullDescription;
  window.updateBesoType = function () { saveState({ need: collectNeed() }); };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
