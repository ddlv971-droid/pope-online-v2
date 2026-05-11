/* POPE Online V62 — moteur dashboard public/privé robuste
   Objectif : réparer définitivement goStep/selectDomain undefined,
   stabiliser les étapes indexables et préserver le bandeau dynamique V61. */
(function () {
  'use strict';

  var path = (window.location.pathname || '').toLowerCase();
  var isPrivate = path.indexOf('private') !== -1;
  var space = isPrivate ? 'private' : 'public';
  var State = window.POPEV61State || window.POPEState || null;
  var fallbackKey = 'pope_need_state_' + space;

  function $(id) { return document.getElementById(id); }
  function $$(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }
  function safeParse(raw, fallback) { try { return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; } }
  function readStorage(key) { return sessionStorage.getItem(key) || localStorage.getItem(key); }

  function defaultState() {
    return {
      version: 'v62',
      space: space,
      step: 1,
      domain: '',
      domainIcon: '🎯',
      need: {},
      drafts: [],
      selectedDraft: '',
      documents: [],
      scrollY: 0,
      updatedAt: new Date().toISOString()
    };
  }

  function loadState() {
    if (State && typeof State.load === 'function') return State.load();
    return safeParse(readStorage(fallbackKey), defaultState()) || defaultState();
  }

  function saveState(patch) {
    var current = loadState();
    var next = Object.assign({}, current, patch || {});
    next.need = Object.assign({}, current.need || {}, (patch && patch.need) || {});
    next.updatedAt = new Date().toISOString();
    if (State && typeof State.save === 'function') return State.save(next);
    try {
      var json = JSON.stringify(next);
      sessionStorage.setItem(fallbackKey, json);
      localStorage.setItem(fallbackKey, json);
    } catch (e) {}
    return next;
  }

  function val(id) { var el = $(id); return el ? (el.value || '') : ''; }
  function setVal(id, value) {
    var el = $(id);
    if (!el || value === undefined || value === null) return;
    if (el.type === 'radio') return;
    el.value = value;
  }

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
      var radio = document.querySelector('input[name="besoType"][value="' + CSS.escape(need.treatment) + '"]');
      if (radio) radio.checked = true;
    }
  }

  function currentStep() {
    var active = $$('.v5-step-panel').filter(function (p) { return p.classList.contains('active'); })[0];
    if (active && active.id) return parseInt(active.id.replace('step-panel-', ''), 10) || 1;
    return loadState().step || 1;
  }

  function renderDomain(domain, icon) {
    domain = domain || window._domain || loadState().domain || '';
    icon = icon || loadState().domainIcon || '🎯';
    window._domain = domain;
    var badge = $('selectedDomainBadge');
    var label = $('selectedDomainLabel');
    var ico = $('selectedDomainIcon');
    if (badge && label) {
      badge.style.display = domain ? 'block' : 'none';
      label.textContent = domain || '';
      if (ico) ico.textContent = icon || '🎯';
    }
    $$('.v62-domain-reminder').forEach(function (el) {
      el.style.display = domain ? 'flex' : 'none';
      el.innerHTML = '<span class="v62-domain-ico">' + escapeHtml(icon || '🎯') + '</span><span>Domaine sélectionné : <strong>' + escapeHtml(domain) + '</strong></span>';
    });
    $$('.v5-domain-pill').forEach(function (pill) {
      pill.classList.toggle('selected', (pill.getAttribute('data-domain') || '') === domain);
    });
  }

  function ensureDomainReminders() {
    if ($('v62-style')) return;
    var style = document.createElement('style');
    style.id = 'v62-style';
    style.textContent = '.v62-domain-reminder{display:flex;align-items:center;gap:10px;margin:0 0 18px 0;padding:12px 14px;border:1px solid rgba(15,35,80,.14);border-radius:16px;background:linear-gradient(135deg,rgba(255,255,255,.98),rgba(246,248,252,.96));box-shadow:0 10px 30px rgba(15,35,80,.07);color:#102044;font-weight:650}.v62-domain-ico{width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;border-radius:12px;background:#eef3ff}.v60-draft-card.selected,.v60-draft-card.is-selected{outline:2px solid #0f2d5c}.v62-hidden-old{display:none!important}';
    document.head.appendChild(style);
  }

  function injectDomainReminder(panelId) {
    var panel = $(panelId);
    if (!panel || panel.querySelector('.v62-domain-reminder')) return;
    var title = panel.querySelector('.v5-step-title, h2, h3, .v58-title') || panel.firstElementChild;
    var el = document.createElement('div');
    el.className = 'v62-domain-reminder';
    el.style.display = 'none';
    if (title && title.parentNode) title.parentNode.insertBefore(el, title.nextSibling);
    else panel.insertBefore(el, panel.firstChild);
  }

  function goStepV62(step, opts) {
    step = parseInt(step, 10) || 1;
    opts = opts || {};
    var st = loadState();
    var domain = window._domain || st.domain || '';
    if (step > 1 && !domain) step = 1;

    $$('.v5-step-panel').forEach(function (panel) {
      panel.classList.toggle('active', panel.id === 'step-panel-' + step);
      if (panel.id === 'step-panel-' + step) panel.removeAttribute('hidden');
      else panel.setAttribute('hidden', '');
    });

    $$('.v5-step').forEach(function (s) {
      var n = parseInt(s.dataset.step, 10);
      s.classList.toggle('active', n === step);
      s.classList.toggle('done', n < step);
    });

    var next = saveState({ step: step, domain: domain, need: collectNeed(), scrollY: window.scrollY || 0 });
    renderDomain(next.domain, next.domainIcon);
    updateDraftLinks();
    if (step === 3) refreshDrafts();
    if (step === 4 && typeof window.updateRecap === 'function') {
      try { window.updateRecap(); } catch (e) {}
    }
    if (!opts.noScroll) setTimeout(function () { window.scrollTo({ top: 0, behavior: 'smooth' }); }, 20);
  }

  function selectDomainV62(target) {
    var btn = target && target.closest ? target.closest('.v5-domain-pill') : target;
    if (!btn) return;
    $$('.v5-domain-pill').forEach(function (p) { p.classList.remove('selected'); });
    btn.classList.add('selected');
    var domain = btn.getAttribute('data-domain') || btn.textContent.replace(/^\S+\s*/, '').trim();
    var icon = (btn.textContent.trim().split(/\s+/)[0] || '🎯');
    window._domain = domain;
    saveState({ domain: domain, domainIcon: icon, step: 1, need: collectNeed() });
    renderDomain(domain, icon);
  }

  function switchTabV62(name) {
    $$('.v5-tab').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === name); });
    $$('.v5-tab-content').forEach(function (c) {
      if (c.id === 'tab-' + name) c.removeAttribute('hidden');
      else c.setAttribute('hidden', '');
    });
    if (name === 'experts' && typeof window.loadRequests === 'function') {
      try { window.loadRequests(); } catch (e) {}
    }
  }

  function v58ToggleV62(id) {
    var acc = $(id);
    if (acc) acc.classList.toggle('is-open');
  }

  function buildFullDescriptionV62() {
    var need = collectNeed();
    var rows = [
      ['Contexte', need.context], ['Problème à résoudre', need.problem], ['Objectif', need.objective],
      ['Décision attendue', need.decision], ['Livrable attendu', need.deliverable],
      ['Contraintes', need.constraints], ['Risques / points sensibles', need.risks],
      ['Acteurs concernés', need.actors], ['Public destinataire', need.audience],
      ['Échéance', need.deadline], ['Pièces disponibles', need.pieces],
      ['Niveau de détail', need.detailLevel], ['Précisions complémentaires', need.description]
    ];
    return rows.filter(function (r) { return String(r[1] || '').trim(); }).map(function (r) { return r[0] + ' : ' + r[1]; }).join('\n\n');
  }

  function updateDraftLinks() {
    var appUrl = isPrivate ? 'app-private.html?from=dashboard&step=' + currentStep() : 'app.html?from=dashboard&step=' + currentStep();
    if (State && typeof State.appUrl === 'function') appUrl = State.appUrl();
    ['lnkDraftTool', 'lnkDraftStep3'].forEach(function (id) {
      var a = $(id);
      if (a) a.setAttribute('href', appUrl);
    });
    $$('a[href*="app.html"],a[href*="app-private.html"]').forEach(function (a) {
      if (/app(-private)?\.html/.test(a.getAttribute('href') || '')) a.setAttribute('href', appUrl);
    });
  }

  function refreshDrafts() {
    var gens = [];
    if (State && typeof State.loadGenerations === 'function') gens = State.loadGenerations();
    else gens = safeParse(localStorage.getItem('pope_v54_generations'), []);
    var sel = $('archiveAttachSelect');
    var st = loadState();
    var selected = st.selectedDraft || (gens[0] && gens[0].id) || '';
    if (sel) {
      sel.innerHTML = '<option value="">Ne pas joindre de draft préparé</option>' + gens.map(function (g) {
        var label = (g.title || g.usecaseLabel || 'Draft préparé') + (g.domain ? ' — ' + g.domain : '') + (g.createdAt ? ' — ' + new Date(g.createdAt).toLocaleString('fr-FR') : '');
        return '<option value="' + escapeHtml(g.id || '') + '">' + escapeHtml(label) + '</option>';
      }).join('');
      if (selected) sel.value = selected;
      sel.onchange = function () { saveState({ selectedDraft: sel.value }); renderDraftCards(); };
    }
    renderDraftCards();
  }

  function renderDraftCards() {
    var container = $('v60DraftCards');
    if (!container) return;
    var gens = State && typeof State.loadGenerations === 'function' ? State.loadGenerations() : safeParse(localStorage.getItem('pope_v54_generations'), []);
    var selected = (($('archiveAttachSelect') || {}).value) || loadState().selectedDraft || '';
    if (!gens.length) {
      container.innerHTML = '<div class="v61-empty">Aucun draft généré pour le moment. Cliquez sur “Créer un draft” pour préparer un document de travail, puis revenez ici pour le joindre à votre demande.</div>';
      return;
    }
    container.innerHTML = gens.slice(0, 5).map(function (g) {
      var id = g.id || '';
      var date = g.createdAt ? new Date(g.createdAt).toLocaleString('fr-FR') : '';
      var preview = String(g.result || g.output || '').slice(0, 170);
      return '<div class="v60-draft-card ' + (selected === id ? 'is-selected' : '') + '" data-gen-id="' + escapeHtml(id) + '">' +
        '<div class="v60-draft-card-head"><span class="v60-draft-card-title">' + escapeHtml(g.title || g.usecaseLabel || 'Draft préparé') + '</span><span class="v60-draft-card-meta">' + escapeHtml((g.domain || loadState().domain || '') + (date ? ' · ' + date : '')) + '</span></div>' +
        (preview ? '<div class="v60-draft-card-preview">' + escapeHtml(preview) + '…</div>' : '') +
        '<button type="button" class="v60-draft-card-btn">Sélectionner ce draft</button></div>';
    }).join('');
  }

  function selectDraft(id) {
    var sel = $('archiveAttachSelect');
    if (sel) sel.value = id;
    saveState({ selectedDraft: id });
    renderDraftCards();
  }

  function submitBesoinV62() {
    saveState({ step: 4, need: collectNeed() });
    var msg = $('msgBesoin');
    if (msg) { msg.textContent = 'Votre besoin est prêt à être transmis à un expert POPE Online.'; msg.className = 'v5-msg ok-show'; }
    // Conserver le comportement métier existant s'il existe ailleurs n'est pas possible ici sans endpoint fiable.
    return false;
  }

  function hydrateFromState() {
    var st = loadState();
    if (st.domain) window._domain = st.domain;
    hydrateNeed(st.need || {});
    renderDomain(st.domain, st.domainIcon);
    updateDraftLinks();
  }

  function installListeners() {
    // Neutralise les anciens onclick inline critiques pour empêcher les ReferenceError.
    $$('[onclick]').forEach(function (el) {
      var code = el.getAttribute('onclick') || '';
      if (/goStep\(|selectDomain\(|v58Toggle\(/.test(code)) {
        if (/goStep\((\d+)\)/.test(code)) el.setAttribute('data-v62-step', (code.match(/goStep\((\d+)\)/) || [])[1]);
        if (/v58Toggle\('([^']+)'\)/.test(code)) el.setAttribute('data-v62-toggle', (code.match(/v58Toggle\('([^']+)'\)/) || [])[1]);
        if (/selectDomain\(/.test(code)) el.setAttribute('data-v62-domain', '1');
        el.removeAttribute('onclick');
      }
    });

    document.addEventListener('click', function (e) {
      var domainBtn = e.target.closest('.v5-domain-pill,[data-v62-domain]');
      if (domainBtn && domainBtn.classList.contains('v5-domain-pill')) { e.preventDefault(); selectDomainV62(domainBtn); return; }
      var stepEl = e.target.closest('[data-v62-step],.v5-step');
      if (stepEl) { e.preventDefault(); goStepV62(stepEl.getAttribute('data-v62-step') || stepEl.dataset.step || 1); return; }
      var tog = e.target.closest('[data-v62-toggle]');
      if (tog) { e.preventDefault(); v58ToggleV62(tog.getAttribute('data-v62-toggle')); return; }
      var draftCard = e.target.closest('.v60-draft-card');
      if (draftCard) { e.preventDefault(); selectDraft(draftCard.getAttribute('data-gen-id')); return; }
    }, true);

    document.addEventListener('input', function () { saveState({ step: currentStep(), need: collectNeed() }); }, true);
    document.addEventListener('change', function () { saveState({ step: currentStep(), need: collectNeed() }); }, true);
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>'"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c];
    });
  }

  function init() {
    ensureDomainReminders();
    injectDomainReminder('step-panel-2');
    injectDomainReminder('step-panel-3');
    injectDomainReminder('step-panel-4');
    installListeners();
    hydrateFromState();
    var params = new URLSearchParams(window.location.search);
    var step = parseInt(params.get('step') || loadState().step || '1', 10) || 1;
    if (params.get('attach') === 'last' && State && typeof State.lastGenId === 'function') saveState({ selectedDraft: State.lastGenId() });
    goStepV62(step, { noScroll: true });
    refreshDrafts();
  }

  // Exposition globale immédiate : protège les onclick résiduels et les anciens composants.
  window.goStep = goStepV62;
  window.forceStep = goStepV62;
  window.restoreDashboardStep = function () { hydrateFromState(); goStepV62(loadState().step || 1, { noScroll: true }); return true; };
  window.selectDomain = selectDomainV62;
  window.switchTab = window.switchTab || switchTabV62;
  window.v58Toggle = v58ToggleV62;
  window.saveDashboardState = function () { return saveState({ step: currentStep(), need: collectNeed() }); };
  window.loadDashboardState = loadState;
  window.restoreDashboardState = window.restoreDashboardStep;
  window.refreshGenerationSelect = refreshDrafts;
  window.v60SelectDraft = selectDraft;
  window.buildFullDescription = window.buildFullDescription || buildFullDescriptionV62;
  window.updateBesoType = window.updateBesoType || function () { saveState({ need: collectNeed() }); };
  window.submitBesoin = window.submitBesoin || submitBesoinV62;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
