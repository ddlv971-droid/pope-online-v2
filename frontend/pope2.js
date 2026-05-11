/**
 * POPE Online V2 — Script unique partagé
 * Gère : auth, session, navigation dashboard, génération IA, vault
 * Aucune dépendance aux anciens scripts (v58, v60, v5...)
 */

const P2 = (function() {
  'use strict';

  /* ─── Config ─────────────────────────────────────────── */
  const API = (function(){
    const h = location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return 'http://localhost:3000';
    return (window.__POPE_API_BASE__ || 'https://pope-online-v2.onrender.com').replace(/\/$/, '');
  })();

  /* ─── Helpers ────────────────────────────────────────── */
  const el   = id => document.getElementById(id);
  const esc  = s  => String(s||'').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const tok  = ()  => sessionStorage.getItem('pope_session_token') ||
                      localStorage.getItem('pope_session_token') || '';
  const head = ()  => {
    const h = {'Content-Type':'application/json'};
    const t = tok(); if (t) h['Authorization'] = 'Bearer ' + t;
    return h;
  };

  /* ─── Session ────────────────────────────────────────── */
  function redirectLogin() {
    const next = encodeURIComponent(location.pathname.split('/').pop() || 'dashboard2.html');
    location.replace('login.html?next=' + next);
  }

  async function checkAuth() {
    if (tok()) return true;
    if (localStorage.getItem('pope_session_active') === '1') return true;
    try {
      const r = await fetch(API + '/auth/me', { headers: head(), credentials: 'include' });
      if (r.ok) { localStorage.setItem('pope_session_active', '1'); return true; }
    } catch {}
    return false;
  }

  async function requireAuth() {
    const ok = await checkAuth();
    if (!ok) redirectLogin();
    return ok;
  }

  function wireLogout() {
    document.addEventListener('click', async e => {
      const btn = e.target.closest('[data-logout]');
      if (!btn) return;
      try { await fetch(API + '/auth/logout', { method:'POST', headers: head(), credentials:'include' }); } catch {}
      localStorage.removeItem('pope_session_active');
      localStorage.removeItem('pope_session_token');
      localStorage.removeItem('pope_session_user');
      sessionStorage.removeItem('pope_session_token');
      location.replace('login.html');
    });
  }

  function wireBurger() {
    const burger = el('p2Burger'), menu = el('p2MobileMenu');
    if (!burger || !menu) return;
    burger.addEventListener('click', () => menu.classList.toggle('open'));
    menu.querySelectorAll('a,button').forEach(a => a.addEventListener('click', () => menu.classList.remove('open')));
    document.addEventListener('click', e => {
      if (!burger.contains(e.target) && !menu.contains(e.target)) menu.classList.remove('open');
    });
  }

  /* ─── Fetch API helper ───────────────────────────────── */
  async function api(path, opts = {}) {
    const r = await fetch(API + path, {
      method: opts.method || 'GET',
      headers: head(),
      credentials: 'include',
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(data.message || data.error || 'Erreur'), { status: r.status, data });
    return data;
  }

  /* ─── Hydratation utilisateur ────────────────────────── */
  async function hydrateUser({ onData } = {}) {
    try {
      const data = await api('/auth/me');
      const u = data.user || {}, w = data.wallet || {};

      // Cache
      try { localStorage.setItem('pope_session_user', JSON.stringify({ user:u, wallet:w })); } catch {}

      // Prénom
      const fn = (u.full_name || u.name || '').trim().split(/\s+/)[0] || '';
      const greet = el('p2Welcome'); if (greet && fn) greet.textContent = 'Bonjour ' + fn + ' 👋';

      // KPIs
      const leftEl = el('p2ExpertLeft'); if (leftEl) leftEl.textContent = w.expert_left ?? '—';
      const planEl = el('p2Plan');       if (planEl) planEl.textContent = w.plan_label || 'Free';

      // Trial alert
      showTrialAlert(w);

      if (onData) onData(u, w);
      return { user: u, wallet: w };
    } catch {
      // Fallback cache
      try {
        const c = JSON.parse(localStorage.getItem('pope_session_user') || 'null');
        if (c?.user) {
          const fn = (c.user.full_name || '').trim().split(/\s+/)[0];
          const greet = el('p2Welcome'); if (greet && fn) greet.textContent = 'Bonjour ' + fn + ' 👋';
          const w = c.wallet || {};
          const l = el('p2ExpertLeft'); if (l) l.textContent = w.expert_left ?? '—';
          const p = el('p2Plan'); if (p) p.textContent = w.plan_label || 'Free';
          showTrialAlert(w);
          if (onData) onData(c.user, w);
          return c;
        }
      } catch {}
      return null;
    }
  }

  function showTrialAlert(w) {
    const alert = el('p2TrialAlert'); if (!alert) return;
    const title = el('p2TrialTitle'), body = el('p2TrialBody');
    if (w.status === 'trial_active' && w.trial_days_left != null) {
      alert.className = 'p2-alert'; alert.style.display = 'flex';
      if (title) title.textContent = `Essai gratuit — ${w.trial_days_left} jour${w.trial_days_left > 1 ? 's' : ''} restant${w.trial_days_left > 1 ? 's' : ''}`;
      if (body)  body.textContent  = 'Souscrivez un plan pour continuer après votre essai.';
    } else if (w.status === 'trial_expired') {
      alert.className = 'p2-alert danger'; alert.style.display = 'flex';
      if (title) title.textContent = "Période d'essai terminée";
      if (body)  body.textContent  = 'Accès suspendu. Choisissez un plan pour reprendre.';
      const overlay = el('p2ExpiredOverlay'); if (overlay) overlay.classList.add('show');
    } else if (w.status === 'verified_no_trial') {
      alert.className = 'p2-alert info'; alert.style.display = 'flex';
      if (title) title.textContent = '💡 Offre gratuite — 2 Conseils Expert offerts';
      if (body)  body.textContent  = 'Génération IA illimitée. Passez à Starter ou Pro pour plus de Conseils Expert.';
    }
  }

  /* ─── Dashboard : état parcours ─────────────────────── */
  const DASH_KEY = s => 'pope2_dash_' + (s || 'public');
  let _domain = '', _step = 1, _besoType = 'conseil', _space = 'public';

  function saveState(space) {
    const fields = ['p2Title','p2Contexte','p2Probleme','p2Objectif','p2Decision',
      'p2Livrable','p2Contraintes','p2Risques','p2Acteurs','p2Public','p2Deadline',
      'p2Pieces','p2Niveau','p2DescPlus'];
    const data = { step: _step, domain: _domain, besoType: _besoType };
    fields.forEach(id => { const e = el(id); if (e) data[id] = e.value; });
    const at = el('p2ArchiveSelect'); if (at) data.attachedGen = at.value;
    const raw = JSON.stringify(data);
    try { sessionStorage.setItem(DASH_KEY(space), raw); localStorage.setItem(DASH_KEY(space), raw); } catch {}
  }

  function loadState(space) {
    const raw = sessionStorage.getItem(DASH_KEY(space)) || localStorage.getItem(DASH_KEY(space));
    return raw ? JSON.parse(raw) : null;
  }

  function restoreState(space) {
    const s = loadState(space); if (!s) return;
    const fields = ['p2Title','p2Contexte','p2Probleme','p2Objectif','p2Decision',
      'p2Livrable','p2Contraintes','p2Risques','p2Acteurs','p2Public','p2Deadline',
      'p2Pieces','p2Niveau','p2DescPlus'];
    fields.forEach(id => { const e = el(id); if (e && s[id]) e.value = s[id]; });
    if (s.besoType) {
      const r = document.querySelector(`input[name="p2BesoType"][value="${s.besoType}"]`);
      if (r) { r.checked = true; _besoType = s.besoType; }
    }
    // NE PAS restaurer domain automatiquement → toujours forcer le choix à l'étape 1
    // Restaurer les champs texte uniquement
  }

  /* ─── Dashboard : navigation ─────────────────────────── */
  function goStep(n, opts = {}) {
    n = parseInt(n, 10) || 1;
    if (n > 1 && !_domain) {
      const g = el('p2DomainGrid');
      if (g) { g.style.boxShadow = '0 0 0 3px #ef4444'; g.style.borderRadius = '12px'; setTimeout(() => { g.style.boxShadow = ''; g.style.borderRadius = ''; }, 1500); }
      return;
    }
    _step = n;
    document.querySelectorAll('.p2-panel').forEach(p => p.classList.toggle('active', p.dataset.step === String(n)));
    document.querySelectorAll('.p2-step').forEach(s => {
      const sn = parseInt(s.dataset.step, 10);
      s.classList.toggle('active', sn === n);
      s.classList.toggle('done', sn < n);
    });
    // Badge domaine à l'étape 2
    if (n === 2) showDomainBadge();
    if (n === 3) initStep3();
    if (n === 4) updateRecap();
    saveState(_space);
    if (!opts.noScroll) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showDomainBadge() {
    const badge = el('p2DomainBadge');
    if (!badge) return;
    if (_domain) {
      const nm = el('p2DomainName'); if (nm) nm.textContent = _domain;
      const ic = el('p2DomainIcon');
      if (ic) { const pill = document.querySelector('.p2-domain-pill.selected'); if (pill) ic.textContent = pill.textContent.trim().split(/\s+/)[0] || '🎯'; }
      badge.classList.add('show');
    } else {
      badge.classList.remove('show');
    }
  }

  function selectDomain(btn) {
    document.querySelectorAll('.p2-domain-pill').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    _domain = btn.getAttribute('data-domain') || '';
    window._domain = _domain; // compat
    saveState(_space);
    goStep(2);
  }

  function switchTab(name) {
    document.querySelectorAll('.p2-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    document.querySelectorAll('.p2-tab-content').forEach(c => c.classList.toggle('active', c.id === 'p2Tab' + name.charAt(0).toUpperCase() + name.slice(1)));
    if (name === 'experts') loadRequests();
  }

  /* ─── Étape 3 : drafts + vault ───────────────────────── */
  function loadGenerations() {
    const keys = ['pope_v54_generations', 'pope_v53_generations', 'pope2_generations_' + _space];
    const all = [], seen = {};
    keys.forEach(k => {
      try { (JSON.parse(localStorage.getItem(k) || '[]') || []).forEach(g => {
        if (g?.id && !seen[g.id]) { seen[g.id] = true; all.push(g); }
      }); } catch {}
    });
    return all.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }

  function initStep3() {
    fillArchiveSelect();
    loadVaultPreview();
  }

  function fillArchiveSelect() {
    const sel = el('p2ArchiveSelect'); if (!sel) return;
    const gens = loadGenerations();
    const s = loadState(_space);
    const cur = (s && s.attachedGen) || sessionStorage.getItem('pope2_last_gen') || sessionStorage.getItem('pope_v54_last_generation_id') || '';
    sel.innerHTML = '<option value="">Ne pas joindre de draft préparé</option>' +
      gens.map(g => `<option value="${esc(String(g.id))}">${esc((g.title||g.usecaseLabel||'Draft IA') + (g.domain ? ' — '+g.domain : '') + (g.createdAt ? ' — '+new Date(g.createdAt).toLocaleString('fr-FR') : ''))}</option>`).join('');
    if (cur) sel.value = cur;
    sel.onchange = () => saveState(_space);
    const status = el('p2DraftStatus');
    if (status) status.style.display = (gens.length && sel.value) ? 'flex' : 'none';
    const lnk = el('p2DraftLnk3');
    if (lnk) { lnk.href = (_space === 'private' ? 'app2-private.html' : 'app2.html'); if (gens.length) lnk.textContent = 'Voir l\'outil →'; }
  }

  function loadVaultPreview() {
    const box = el('p2VaultPreview'); if (!box) return;
    box.innerHTML = '<span style="color:#94a3b8;font-size:12px">⏳ Chargement…</span>';
    api('/vault/?space=' + _space)
      .then(data => {
        const files = data.files || data.items || data || [];
        if (!files.length) { box.innerHTML = '<span style="font-size:12px;color:#94a3b8">Aucune pièce disponible. <a href="vault2.html?space='+_space+'&return=dashboard2'+(_space==='private'?'-private':'') +'.html" style="color:var(--blue);font-weight:600">Déposer →</a></span>'; return; }
        box.innerHTML = files.slice(0,5).map(f =>
          `<div class="p2-file" style="margin-bottom:0"><div class="p2-file-ico">📄</div><div class="p2-file-name">${esc(f.original_name||f.filename||'Fichier')}</div><div class="p2-file-meta">${f.size_kb ? f.size_kb+' Ko' : ''}</div></div>`
        ).join('') + `<a href="vault2.html?space=${_space}&return=dashboard2${_space==='private'?'-private':''}.html" style="display:inline-block;margin-top:8px;font-size:12px;font-weight:700;color:var(--blue)">📂 Gérer le dépôt →</a>`;
      })
      .catch(() => { box.innerHTML = `<a href="vault2.html?space=${_space}" style="font-size:12px;font-weight:700;color:var(--blue)">📂 Accéder au dépôt →</a>`; });
  }

  /* ─── Étape 4 : récapitulatif ───────────────────────── */
  function updateRecap() {
    const set = (id, v) => { const e = el(id); if (e) e.textContent = v; };
    const title = el('p2Title')?.value || '—';
    const quota = el('p2ExpertLeft')?.textContent || '—';
    const type  = _besoType === 'surmesure' ? '📋 Accompagnement Sur Mesure' : '🎯 Conseil Expert (48h)';
    set('p2RecapDomain', _domain || '—');
    set('p2RecapTitle',  title);
    set('p2RecapType',   type);
    set('p2RecapQuota',  quota + ' Conseil(s) disponible(s)');
    const at = el('p2ArchiveSelect');
    set('p2RecapDraft', (at && at.value && at.options[at.selectedIndex]?.text) || 'Aucun');
  }

  /* ─── Soumission besoin ──────────────────────────────── */
  async function submitBesoin() {
    const title = el('p2Title')?.value?.trim() || '';
    const ctx   = el('p2Contexte')?.value?.trim() || '';
    const obj   = el('p2Objectif')?.value?.trim() || '';
    const desc  = el('p2DescPlus')?.value?.trim()  || '';
    const msgEl = el('p2MsgSend');
    if (!title || (!ctx && !obj && !desc)) {
      if (msgEl) { msgEl.textContent = "Remplissez l'objet et au moins le contexte ou l'objectif."; msgEl.className = 'p2-msg err'; }
      return;
    }
    if (_besoType === 'surmesure') { location.href = _space === 'private' ? 'mission-private.html' : 'mission.html'; return; }
    const fullDesc = [
      ctx && '📍 Contexte : ' + ctx,
      el('p2Probleme')?.value?.trim() && '🔍 Problème : ' + el('p2Probleme').value.trim(),
      obj && '🎯 Objectif : ' + obj,
      el('p2Decision')?.value?.trim() && '✅ Décision attendue : ' + el('p2Decision').value.trim(),
      el('p2Livrable')?.value?.trim() && '📄 Livrable : ' + el('p2Livrable').value.trim(),
      el('p2Contraintes')?.value?.trim() && '⚠️ Contraintes : ' + el('p2Contraintes').value.trim(),
      el('p2Risques')?.value?.trim() && '🚨 Risques : ' + el('p2Risques').value.trim(),
      el('p2Acteurs')?.value?.trim() && '👥 Acteurs : ' + el('p2Acteurs').value.trim(),
      el('p2Deadline')?.value?.trim() && '⏰ Échéance : ' + el('p2Deadline').value.trim(),
      desc && '💬 ' + desc
    ].filter(Boolean).join('\n\n');

    const at = el('p2ArchiveSelect');
    const genId = at?.value || '';
    const btn = el('p2BtnSend');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Envoi…'; }
    try {
      await api('/expert/request', { method: 'POST', body: {
        domain: _domain, subject: title, context: fullDesc,
        objective: obj || title, expectations: fullDesc,
        type: _besoType, generation_attachment: genId
      }});
      if (msgEl) { msgEl.textContent = '✅ Demande transmise ! Retrouvez-la dans "Mes Experts".'; msgEl.className = 'p2-msg ok'; }
      if (btn) { btn.disabled = false; btn.textContent = '🎯 Soumettre à un expert'; }
      setTimeout(() => switchTab('experts'), 1500);
    } catch (err) {
      if (msgEl) { msgEl.textContent = err.data?.message || 'Erreur lors de l\'envoi.'; msgEl.className = 'p2-msg err'; }
      if (btn) { btn.disabled = false; btn.textContent = '🎯 Soumettre à un expert'; }
    }
  }

  /* ─── Historique experts ─────────────────────────────── */
  async function loadRequests() {
    const box = el('p2RequestsList'); if (!box) return;
    box.innerHTML = '<div class="p2-empty"><div class="p2-empty-ico">⏳</div><strong>Chargement…</strong></div>';
    try {
      const data = await api('/expert/my-requests');
      const reqs = Array.isArray(data) ? data : (data.requests || []);
      if (!reqs.length) {
        box.innerHTML = '<div class="p2-empty"><div class="p2-empty-ico">👤</div><strong>Aucun échange expert.</strong><p>Soumettez votre premier besoin depuis l\'onglet Mon Besoin.</p><button class="p2-btn p2-btn-primary" onclick="P2.switchTab(\'besoin\')">🎯 Soumettre un besoin</button></div>';
        return;
      }
      box.innerHTML = reqs.map(r => {
        const ok   = r.reply_text?.trim();
        const date = r.created_at ? new Date(r.created_at).toLocaleDateString('fr-FR') : '—';
        return `<div class="p2-req ${ok ? 'replied' : 'pending'}">
          <span class="p2-req-tag">${esc(r.domain || 'Expert')}</span>
          <div class="p2-req-title">${esc(r.subject || r.content || '—')}</div>
          <div class="p2-req-meta">${ok ? '✅ Répondu' : '⏳ En attente'} · ${date}</div>
          ${ok ? `<div class="p2-req-reply">${esc(ok.slice(0,300))}${ok.length>300?'…':''}</div>` : ''}
        </div>`;
      }).join('');
    } catch {
      box.innerHTML = '<div class="p2-empty"><div class="p2-empty-ico">⚠️</div><strong>Impossible de charger les échanges.</strong></div>';
    }
  }

  /* ─── Retour depuis APP ──────────────────────────────── */
  function handleReturnFromApp(space) {
    const sp = new URLSearchParams(location.search);
    const from = sp.get('from'), attach = sp.get('attach') === 'last';
    const step = parseInt(sp.get('step') || '0', 10);
    if (!from && !step && !attach) return;

    // Nettoyer l'URL immédiatement
    try { history.replaceState({}, '', location.pathname); } catch {}

    let target = 1;
    if (from === 'app') {
      const lastId = sessionStorage.getItem('pope2_last_gen') || sessionStorage.getItem('pope_v54_last_generation_id') || '';
      if (attach && lastId) { sessionStorage.setItem('pope2_pending_gen', lastId); target = 3; }
      else target = 2;
    } else { target = step || (attach ? 3 : 2); }

    // Restaurer le state (champs texte) avant de naviguer
    restoreState(space);
    // Naviguer après que le DOM est prêt
    setTimeout(() => goStep(target, { noScroll: true }), 0);
  }

  /* ─── Init Dashboard ─────────────────────────────────── */
  async function initDashboard(space) {
    _space = space || 'public';
    wireLogout(); wireBurger();

    // Auth
    const ok = await requireAuth(); if (!ok) return;

    // Hydratation user
    hydrateUser();

    // Retour depuis APP (avant restauration d'état)
    handleReturnFromApp(_space);

    // Restauration champs texte (sans domaine)
    restoreState(_space);

    // Auto-save sur saisie
    document.addEventListener('input', () => saveState(_space), true);
    document.addEventListener('change', e => {
      saveState(_space);
      if (e.target?.id === 'p2BesoType') _besoType = e.target.value;
    }, true);

    // Lien outil IA
    const lnkTool = el('p2DraftTool');
    if (lnkTool) lnkTool.href = _space === 'private' ? 'app2-private.html' : 'app2.html';

    // Accordéons : update hint
    document.querySelectorAll('.p2-acc').forEach(acc => {
      const body = acc.querySelector('.p2-acc-body');
      const inputs = acc.querySelectorAll('input,textarea');
      inputs.forEach(inp => inp.addEventListener('input', () => {
        const filled = Array.from(inputs).some(i => i.value.trim());
        acc.classList.toggle('filled', filled);
        const hint = acc.querySelector('.p2-acc-hint');
        if (hint) {
          const first = Array.from(inputs).find(i => i.value.trim());
          hint.textContent = first ? first.value.trim().slice(0, 40) + (first.value.length > 40 ? '…' : '') : hint.dataset.default || '';
        }
      }));
    });
  }

  /* ─── Génération IA ──────────────────────────────────── */
  let _generating = false;
  let _lastGenId = null;

  async function generateIA(space) {
    if (_generating) return;
    const usecase  = el('p2Usecase')?.value || '';
    const context  = el('p2GenContext')?.value?.trim()  || '';
    const objective= el('p2GenObj')?.value?.trim()    || '';
    const spinner  = el('p2Spinner');
    const resultBox= el('p2Result');
    const msgEl    = el('p2GenMsg');
    const btn      = el('p2BtnGen');
    const actions  = el('p2ResultActions');
    const retBar   = el('p2ReturnBar');

    if (!usecase || !context) {
      if (msgEl) { msgEl.textContent = 'Sélectionnez un type de document et renseignez le contexte.'; msgEl.className = 'p2-msg err'; }
      return;
    }
    if (msgEl) msgEl.className = 'p2-msg';
    _generating = true;
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Génération…'; }
    if (spinner) spinner.classList.add('show');
    if (resultBox) { resultBox.classList.remove('show'); resultBox.textContent = ''; }
    if (actions) actions.style.display = 'none';

    try {
      // Fichiers vault pour contexte
      let vaultIds = [];
      try { const vd = await api('/vault/?space=' + space); vaultIds = (vd.files || []).map(f => f.id).slice(0, 3); } catch {}

      const data = await api('/ai/generate', { method: 'POST', body: {
        usecase, context, objective, space, vault_file_ids: vaultIds
      }});

      const text = data.result || data.text || data.content || '';
      if (resultBox) { resultBox.textContent = text; resultBox.classList.add('show'); }

      // Sauvegarder la génération
      const gen = {
        id: 'gen2_' + Date.now(),
        title: usecase + (objective ? ' — ' + objective.slice(0,40) : ''),
        usecaseLabel: usecase, context, objective,
        result: text, createdAt: new Date().toISOString(), space, domain: ''
      };
      _lastGenId = gen.id;
      sessionStorage.setItem('pope2_last_gen', gen.id);

      const keys = ['pope2_generations_' + space, 'pope_v54_generations'];
      keys.forEach(k => {
        try { const a = JSON.parse(localStorage.getItem(k) || '[]'); a.unshift(gen); localStorage.setItem(k, JSON.stringify(a.slice(0, 30))); } catch {}
      });

      if (actions) actions.style.display = 'flex';
      if (retBar)  { retBar.style.display = 'flex'; const dr = el('p2DraftReady'); if (dr) dr.classList.add('show'); }

      // Mettre à jour le lien retour
      updateReturnUrl(space);

    } catch (err) {
      if (msgEl) { msgEl.textContent = err.data?.message || 'Erreur lors de la génération. Réessayez.'; msgEl.className = 'p2-msg err'; }
    }

    _generating = false;
    if (btn) { btn.disabled = false; btn.textContent = '✨ Générer'; }
    if (spinner) spinner.classList.remove('show');
  }

  function updateReturnUrl(space) {
    const dash = space === 'private' ? 'dashboard2-private.html' : 'dashboard2.html';
    const url  = _lastGenId ? `${dash}?from=app&attach=last&step=2` : `${dash}?from=app&step=2`;
    document.querySelectorAll('a[id^="p2Return"]').forEach(a => { a.href = url; });
  }

  async function initApp(space) {
    wireLogout(); wireBurger();
    const ok = await requireAuth(); if (!ok) return;

    const dash = space === 'private' ? 'dashboard2-private.html' : 'dashboard2.html';

    // Lien retour par défaut
    document.querySelectorAll('a[id^="p2Return"]').forEach(a => { a.href = dash + '?from=app&step=2'; });

    // Remplissage prefill depuis dashboard
    try {
      const pf = JSON.parse(sessionStorage.getItem('v5_prefill') || 'null');
      if (pf) { const c = el('p2GenContext'); if (c && pf.context) c.value = pf.context; sessionStorage.removeItem('v5_prefill'); }
    } catch {}

    // Bouton copier
    const copyBtn = el('p2BtnCopy');
    if (copyBtn) copyBtn.addEventListener('click', () => {
      const txt = el('p2Result')?.textContent || '';
      navigator.clipboard.writeText(txt).then(() => { copyBtn.textContent = '✅ Copié !'; setTimeout(() => { copyBtn.textContent = '📋 Copier'; }, 2000); });
    });
  }

  /* ─── Vault ──────────────────────────────────────────── */
  async function initVault(space) {
    wireLogout(); wireBurger();
    const ok = await requireAuth(); if (!ok) return;
    hydrateUser();

    // Lien retour
    const sp = new URLSearchParams(location.search);
    const ret = sp.get('return') || (space === 'private' ? 'dashboard2-private.html' : 'dashboard2.html');
    const homeLink = el('p2VaultHome'); if (homeLink) homeLink.href = ret;

    await refreshVaultList(space);
    wireDropzone(space);
  }

  async function refreshVaultList(space) {
    const list = el('p2VaultList'); if (!list) return;
    list.innerHTML = '<div class="p2-empty"><div class="p2-empty-ico">⏳</div><strong>Chargement…</strong></div>';
    try {
      const data = await api('/vault/?space=' + space);
      const files = data.files || data.items || data || [];
      if (!files.length) {
        list.innerHTML = '<div class="p2-empty"><div class="p2-empty-ico">📂</div><strong>Aucune pièce déposée.</strong><p>Glissez-déposez vos documents pour commencer.</p></div>';
        return;
      }
      list.innerHTML = '<div class="p2-file-list">' + files.map(f => {
        const exp = f.expires_at ? new Date(f.expires_at) : null;
        const hrs = exp ? Math.max(0, Math.ceil((exp.getTime() - Date.now()) / 3600000)) : null;
        const badge = hrs != null ? `<span class="p2-expiry-badge ${hrs < 6 ? 'urgent' : ''}">${hrs}h</span>` : '';
        return `<div class="p2-file" data-file-id="${esc(String(f.id))}">
          <div class="p2-file-ico">📄</div>
          <div style="flex:1;min-width:0">
            <div class="p2-file-name">${esc(f.original_name || f.filename || 'Fichier')}</div>
            <div class="p2-file-meta">${f.size_kb ? f.size_kb + ' Ko' : ''} ${badge}</div>
          </div>
          <a href="${API}/vault/${f.id}/download?token=${tok()}" target="_blank" class="p2-btn p2-btn-ghost p2-btn-sm">⬇️</a>
          <button class="p2-file-del" data-del="${esc(String(f.id))}" title="Supprimer">🗑</button>
        </div>`;
      }).join('') + '</div>';

      // Clic supprimer
      list.querySelectorAll('[data-del]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Supprimer ce fichier ?')) return;
          try { await api('/vault/' + btn.dataset.del, { method: 'DELETE' }); await refreshVaultList(space); } catch { alert('Erreur lors de la suppression.'); }
        });
      });
    } catch {
      list.innerHTML = '<div class="p2-empty"><div class="p2-empty-ico">⚠️</div><strong>Impossible de charger les fichiers.</strong></div>';
    }
  }

  function wireDropzone(space) {
    const zone   = el('p2DropZone');
    const input  = el('p2FileInput');
    const prog   = el('p2UploadProgress');
    const progBar= el('p2UploadBar');
    if (!zone || !input) return;

    const upload = async file => {
      const maxMb = 25;
      if (file.size > maxMb * 1024 * 1024) { alert(`Fichier trop volumineux (max ${maxMb} Mo).`); return; }
      zone.style.opacity = '.5';
      if (prog) prog.style.display = 'block';

      const formData = new FormData();
      formData.append('file', file);
      formData.append('space', space);

      try {
        const r = await fetch(API + '/vault/upload', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + tok() },
          credentials: 'include',
          body: formData
        });
        if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.message || 'Erreur upload'); }
        await refreshVaultList(space);
      } catch (err) { alert('Erreur : ' + err.message); }
      zone.style.opacity = '';
      if (prog) prog.style.display = 'none';
    };

    input.addEventListener('change', () => { if (input.files[0]) upload(input.files[0]); });
    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
    zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('drag'); const f = e.dataTransfer.files[0]; if (f) upload(f); });
  }

  /* ─── API publique ───────────────────────────────────── */
  return {
    initDashboard, initApp, initVault,
    goStep, switchTab, selectDomain,
    generateIA, submitBesoin, loadRequests,
    api, hydrateUser
  };
})();
