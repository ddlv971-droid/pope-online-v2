/**
 * POPE Online — V61 FIX FINAL
 * Stabilisation dashboard : étapes, persistance, retour APP, étapes 3/4, bandeau utilisateur.
 * Chargé en dernier pour neutraliser les régressions V58/V60 sans casser l'existant.
 */
(function () {
  'use strict';

  var isPrivate = /dashboard-private\.html/i.test(location.pathname);
  var DASH_URL = isPrivate ? 'dashboard-private.html' : 'dashboard.html';
  var APP_URL = isPrivate ? 'app-private.html' : 'app.html';
  var VAULT_SPACE = isPrivate ? 'private' : 'public';
  var STATE_KEYS = [
    'pope_v61_state_' + (isPrivate ? 'private' : 'public'),
    'pope_v60_state_' + (isPrivate ? 'priv' : 'pub'),
    'pope_v58_state_' + (isPrivate ? 'private' : 'public')
  ];
  var API_BASE = (window.__POPE_API_BASE__ || 'https://pope-online-v2.onrender.com').replace(/\/$/, '');
  var bootDone = false;

  function $(id) { return document.getElementById(id); }
  function $all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function token() { return sessionStorage.getItem('pope_session_token') || localStorage.getItem('pope_session_token') || ''; }

  function readKey(key) { try { var raw = sessionStorage.getItem(key) || localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
  function readState() { for (var i = 0; i < STATE_KEYS.length; i++) { var s = readKey(STATE_KEYS[i]); if (s) return normalizeState(s); } return normalizeState({}); }
  function writeState(s) {
    var data = normalizeState(Object.assign({}, readState(), s || {}, collectFields()));
    var json = JSON.stringify(data);
    STATE_KEYS.forEach(function (k) { try { sessionStorage.setItem(k, json); localStorage.setItem(k, json); } catch (e) {} });
    return data;
  }

  function normalizeState(s) {
    s = s || {};
    return {
      step: Number(s.step || 1),
      domain: s.domain || window._domain || '',
      domainIcon: s.domainIcon || '🎯',
      title: s.title || s.besoInTitle || '',
      contexte: s.contexte || s.descContexte || '',
      probleme: s.probleme || s.descProbleme || '',
      objectif: s.objectif || s.descObjectif || '',
      decision: s.decision || s.descDecision || '',
      livrable: s.livrable || s.descLivrable || '',
      contraintes: s.contraintes || s.descContraintes || '',
      risques: s.risques || s.descRisques || '',
      acteurs: s.acteurs || s.descActeurs || '',
      public_c: s.public_c || s.descPublic || '',
      deadline: s.deadline || s.needDeadline || '',
      pieces: s.pieces || s.descPieces || '',
      niveau: s.niveau || s.descNiveau || '',
      desc: s.desc || s.besoInDesc || '',
      type: s.type || s.besoType || 'conseil',
      attachedGenId: s.attachedGenId || ''
    };
  }

  function collectFields() {
    var map = {
      title: 'besoInTitle', contexte: 'descContexte', probleme: 'descProbleme', objectif: 'descObjectif',
      decision: 'descDecision', livrable: 'descLivrable', contraintes: 'descContraintes', risques: 'descRisques',
      acteurs: 'descActeurs', public_c: 'descPublic', deadline: 'needDeadline', pieces: 'descPieces',
      niveau: 'descNiveau', desc: 'besoInDesc'
    };
    var out = { domain: window._domain || '', step: window._step || 1 };
    Object.keys(map).forEach(function (k) { var e = $(map[k]); if (e) out[k] = e.value || ''; });
    var r = document.querySelector('input[name="besoType"]:checked'); if (r) out.type = r.value;
    var sel = $('archiveAttachSelect'); if (sel) out.attachedGenId = sel.value || '';
    return out;
  }

  function restoreFields() {
    var s = readState();
    var map = {
      besoInTitle: s.title, descContexte: s.contexte, descProbleme: s.probleme, descObjectif: s.objectif,
      descDecision: s.decision, descLivrable: s.livrable, descContraintes: s.contraintes, descRisques: s.risques,
      descActeurs: s.acteurs, descPublic: s.public_c, needDeadline: s.deadline, descPieces: s.pieces,
      descNiveau: s.niveau, besoInDesc: s.desc
    };
    Object.keys(map).forEach(function (id) { var e = $(id); if (e && map[id] && !e.value) e.value = map[id]; });
    if (s.type) { var radio = document.querySelector('input[name="besoType"][value="' + s.type + '"]'); if (radio) radio.checked = true; }
    if (s.domain) setDomain(s.domain, s.domainIcon, true);
    updateAccordions();
    return s;
  }

  function setDomain(domain, icon, silent) {
    if (!domain) return;
    window._domain = domain;
    if (typeof _domain !== 'undefined') _domain = domain;
    $all('.v5-domain-pill').forEach(function (b) {
      var selected = b.getAttribute('data-domain') === domain;
      b.classList.toggle('selected', selected);
      if (selected && !icon) icon = (b.textContent || '').trim().split(' ')[0] || '🎯';
    });
    [['v58DomainBadge','v58DomainName','v58DomainIcon'], ['selectedDomainBadge','selectedDomainLabel','selectedDomainIcon']].forEach(function (ids) {
      var badge = $(ids[0]), name = $(ids[1]), ico = $(ids[2]);
      if (badge) { badge.style.display = 'flex'; badge.classList.add('visible'); }
      if (name) name.textContent = domain;
      if (ico) ico.textContent = icon || '🎯';
    });
    if (!silent) writeState({ domain: domain, domainIcon: icon || '🎯' });
  }

  function updateAccordions() {
    var pairs = [['v58AccCtx','descContexte','prevCtx'],['v58AccObj','descObjectif','prevObj'],['v58AccCon','descContraintes','prevCon'],['v58AccAct','descActeurs','prevAct'],['v58AccPlus','besoInDesc','prevPlus']];
    pairs.forEach(function (p) { var acc=$(p[0]), field=$(p[1]), prev=$(p[2]); if (!acc || !field) return; var val=(field.value||'').trim(); acc.classList.toggle('has-value', !!val); if (prev && val) prev.textContent = val.slice(0, 70) + (val.length > 70 ? '…' : ''); });
  }

  function showStep(n, opts) {
    opts = opts || {};
    restoreFields();
    if (n > 1 && !window._domain) n = 1;
    window._step = n; if (typeof _step !== 'undefined') _step = n;
    $all('.v5-step-panel').forEach(function (p) { p.classList.toggle('active', p.id === 'step-panel-' + n); p.style.display = (p.id === 'step-panel-' + n) ? 'block' : 'none'; });
    $all('.v5-step').forEach(function (s) { var sn = parseInt(s.dataset.step, 10); s.classList.toggle('active', sn === n); s.classList.toggle('done', sn < n); });
    writeState({ step: n });
    if (n === 3) renderStep3();
    if (n === 4) renderStep4();
    if (!opts.noScroll) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function loadGenerations() { try { return JSON.parse(localStorage.getItem('pope_v54_generations') || localStorage.getItem('pope_v53_generations') || '[]'); } catch (e) { return []; } }
  function selectedDraftId() { return sessionStorage.getItem('pope_v61_attached_gen') || sessionStorage.getItem('pope_v58_attached_gen') || sessionStorage.getItem('pope_v54_last_generation_id') || readState().attachedGenId || ''; }

  function renderStep3() {
    var sel = $('archiveAttachSelect');
    var gens = loadGenerations();
    var cur = selectedDraftId();
    if (sel) {
      sel.innerHTML = '<option value="">Ne pas joindre de draft préparé</option>' + gens.map(function (g, i) {
        var id = String(g.id || i);
        var lbl = (g.title || g.usecaseLabel || 'Draft IA') + (g.createdAt ? ' — ' + new Date(g.createdAt).toLocaleString('fr-FR') : '');
        return '<option value="' + esc(id) + '">' + esc(lbl) + '</option>';
      }).join('');
      if (cur) sel.value = cur;
      sel.onchange = function () { sessionStorage.setItem('pope_v61_attached_gen', sel.value || ''); sessionStorage.setItem('pope_v58_attached_gen', sel.value || ''); writeState({ attachedGenId: sel.value || '' }); renderStep4(); };
    }
    var status = $('v59DraftStatus');
    if (status) { status.style.display = (gens.length && sel && sel.value) ? 'block' : 'none'; status.textContent = (gens.length && sel && sel.value) ? '✅ Draft disponible et sélectionné' : ''; }
    var lnk = $('lnkDraftStep3'); if (lnk) { lnk.href = APP_URL + '?from=dashboard&step=2'; lnk.textContent = gens.length ? 'Créer / modifier un draft →' : 'Créer un draft →'; }
    var topDraft = $('lnkDraftTool'); if (topDraft) topDraft.href = APP_URL + '?from=dashboard&step=2';
    renderVaultList();
  }

  function renderVaultList() {
    var c = $('vaultExpertList'); if (!c) return;
    var t = token();
    var manage = 'vault.html?space=' + VAULT_SPACE + '&return=' + encodeURIComponent(DASH_URL + '?step=3');
    var fallback = '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">' +
      '<span style="color:#64748b">Aucune pièce chargée pour le moment.</span>' +
      '<a href="' + manage + '" class="v5-btn-ghost-sm">📂 Déposer / gérer les pièces →</a></div>';
    if (!t) { c.innerHTML = fallback; return; }
    c.innerHTML = '<span style="color:#64748b;font-style:italic">⏳ Chargement du dépôt sécurisé…</span>';
    fetch(API_BASE + '/vault/list?space=' + VAULT_SPACE, { headers: { Authorization: 'Bearer ' + t }, credentials: 'include' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (data) {
        var files = data.files || data.items || [];
        if (!files.length) { c.innerHTML = fallback; return; }
        sessionStorage.setItem('pope_v61_vault_files', JSON.stringify(files));
        c.innerHTML = files.slice(0, 8).map(function (f) {
          return '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #eef2f7">📄<span style="flex:1;font-weight:700;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(f.original_name || f.filename || f.name || 'Document') + '</span><span style="font-size:11px;color:#64748b">' + esc(f.size_kb ? f.size_kb + ' Ko' : '') + '</span></div>';
        }).join('') + '<a href="' + manage + '" class="v5-btn-ghost-sm" style="display:inline-block;margin-top:10px">📂 Gérer le dépôt →</a>';
      })
      .catch(function () { c.innerHTML = fallback; });
  }

  function renderStep4() {
    var s = writeState({ step: 4 });
    var typeLabel = (s.type === 'surmesure') ? '📋 Accompagnement approfondi / Sur Mesure' : '🎯 Conseil Expert';
    var put = function (id, value) { var e = $(id); if (e) e.textContent = value || '—'; };
    put('recapDomain', s.domain); put('recapTitle', s.title); put('recapType', typeLabel);
    var left = $('expertLeftN'); put('recapQuota', (left ? left.textContent : '—') + ' demande(s) experte(s) disponible(s)');
    var card = document.querySelector('#step-panel-4 .v5-recap-card');
    if (card && !$('v61FinalRecap')) {
      card.insertAdjacentHTML('beforeend', '<div id="v61FinalRecap"></div>');
    }
    var recap = $('v61FinalRecap');
    if (recap) {
      var gens = loadGenerations(); var sid = selectedDraftId(); var g = gens.filter(function (x, i) { return String(x.id || i) === String(sid); })[0];
      var docs = []; try { docs = JSON.parse(sessionStorage.getItem('pope_v61_vault_files') || '[]'); } catch(e) {}
      recap.innerHTML =
        '<div class="v5-recap-row"><span class="v5-recap-key">Draft IA joint</span><span class="v5-recap-val">' + esc(g ? (g.title || g.usecaseLabel || 'Draft IA sélectionné') : 'Aucun draft sélectionné') + '</span></div>' +
        '<div class="v5-recap-row"><span class="v5-recap-key">Pièces déposées</span><span class="v5-recap-val">' + esc(docs.length ? docs.length + ' pièce(s) dans le dépôt sécurisé' : 'Aucune pièce détectée') + '</span></div>' +
        '<div style="margin-top:12px;padding:12px 14px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;color:#475569;font-size:13px"><strong>Résumé du besoin :</strong><br>' + esc(buildDescription(s).slice(0, 900) || 'Aucun contexte détaillé saisi.') + '</div>';
    }
  }

  function buildDescription(s) {
    s = s || readState();
    var rows = [['Contexte',s.contexte],['Problème',s.probleme],['Objectif',s.objectif],['Décision attendue',s.decision],['Livrable attendu',s.livrable],['Contraintes',s.contraintes],['Risques',s.risques],['Acteurs / échéances',s.acteurs],['Pièces',s.pieces],['Précisions',s.desc]];
    return rows.filter(function (r) { return (r[1] || '').trim(); }).map(function (r) { return r[0] + ' : ' + r[1]; }).join('\n');
  }
  window.buildFullDescription = function () { return buildDescription(writeState()); };

  function hydrateUser() {
    var cached = null; try { cached = JSON.parse(localStorage.getItem('pope_session_user') || 'null'); } catch(e) {}
    paintUser(cached || {}, {});
    var headers = { 'Content-Type': 'application/json' }; var t = token(); if (t) headers.Authorization = 'Bearer ' + t;
    fetch(API_BASE + '/auth/me', { headers: headers, credentials: 'include' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (data) { if (data.user) localStorage.setItem('pope_session_user', JSON.stringify(data.user)); paintUser(data.user || {}, data.wallet || {}); })
      .catch(function () {});
  }

  function paintUser(u, w) {
    u = u || {}; w = w || {};
    var full = u.first_name || u.firstname || u.given_name || (u.full_name || u.name || '').split(' ')[0] || '';
    if (!full && u.email) full = String(u.email).split('@')[0];
    var greet = $('dashWelcome'); if (greet) greet.textContent = 'Bonjour ' + (full ? full : '') + ' 👋';
    var plan = w.plan_label || w.plan || u.plan_label || u.plan || localStorage.getItem('pope_plan_label') || 'Free';
    var left = w.expert_left != null ? w.expert_left : (w.expert_remaining != null ? w.expert_remaining : (w.consultations_left != null ? w.consultations_left : '—'));
    var planEl = $('planN'); if (planEl) planEl.textContent = plan;
    var leftEl = $('expertLeftN'); if (leftEl) leftEl.textContent = left;
  }

  function patchPublicFns() {
    window.goStep = function (n) { showStep(Number(n) || 1); };
    window.goStep._v61patched = true;
    window.selectDomain = function (btn) { var domain = btn && btn.getAttribute('data-domain'); var icon = btn && (btn.textContent || '').trim().split(' ')[0]; setDomain(domain, icon); showStep(2); };
    window.saveDashboardState = function () { writeState(); };
    window.loadDashboardState = readState;
    window.restoreDashboardState = restoreFields;
    var oldSubmit = window.submitBesoin;
    window.submitBesoin = function () { writeState(); renderStep4(); if (typeof oldSubmit === 'function') return oldSubmit(); };
  }

  function patchLinks() {
    $all('a[href="app.html"],a[href="app-private.html"],#lnkDraftTool,#lnkDraftStep3').forEach(function (a) {
      a.href = APP_URL + '?from=dashboard&step=2';
      a.addEventListener('click', function () { writeState({ step: 2 }); }, true);
    });
    $all('a[href^="vault.html"]').forEach(function (a) { if (a.href.indexOf('return=') === -1) a.href = 'vault.html?space=' + VAULT_SPACE + '&return=' + encodeURIComponent(DASH_URL + '?step=3'); });
  }

  function handleUrl() {
    var sp = new URLSearchParams(location.search);
    var fromApp = sp.get('from') === 'app';
    var step = parseInt(sp.get('step') || '0', 10);
    var attach = sp.get('attach') === 'last';
    if (attach) {
      var last = sessionStorage.getItem('pope_v54_last_generation_id') || sessionStorage.getItem('pope_v58_last_gen') || '';
      if (last) { sessionStorage.setItem('pope_v61_attached_gen', last); sessionStorage.setItem('pope_v58_attached_gen', last); writeState({ attachedGenId: last }); }
    }
    if (fromApp) return 2; // règle métier V61 : retour APP toujours stable sur l'étape 2
    if (step >= 1 && step <= 4) return step;
    var s = readState(); return (s.step >= 1 && s.step <= 4) ? s.step : 1;
  }

  function init() {
    if (bootDone) return; bootDone = true;
    patchPublicFns(); restoreFields(); patchLinks(); hydrateUser();
    var target = handleUrl();
    showStep(target, { noScroll: true });
    renderStep3();
    setTimeout(function () { patchPublicFns(); patchLinks(); showStep(target, { noScroll: true }); }, 700);
  }

  document.addEventListener('input', function () { updateAccordions(); writeState(); }, true);
  document.addEventListener('change', function () { updateAccordions(); writeState(); }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 150); });
  else setTimeout(init, 150);
})();
