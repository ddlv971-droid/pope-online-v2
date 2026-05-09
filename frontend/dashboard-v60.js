/**
 * POPE Online — Dashboard V60
 * ════════════════════════════
 * Moteur d'état multi-étapes persistant (public + privé)
 * Corrections V59 :
 *  - Étapes 1-4 indexables, persistantes, avec step-panel complets dans le HTML
 *  - Liaison bidirectionnelle app.html / app-private.html ↔ dashboard
 *  - Étape 3 Documents entièrement restaurée
 *  - Badge domaine permanent dès étape 2
 *  - Bandeau utilisateur dynamique (prénom, plan, consultations restantes)
 *  - Retour exact à l'étape précédente sans perte de données
 */
(function () {
  'use strict';

  /* ─── Configuration ──────────────────────────────────── */
  var isPrivate   = /dashboard-private/i.test(location.pathname);
  var DASH_URL    = isPrivate ? 'dashboard-private.html' : 'dashboard.html';
  var APP_URL     = isPrivate ? 'app-private.html'       : 'app.html';
  var VAULT_SPACE = isPrivate ? 'private'                 : 'public';
  var EXPERT_URL  = isPrivate ? 'expert-private.html'    : 'expert.html';
  var STATE_KEY   = 'pope_v60_state_' + (isPrivate ? 'private' : 'public');
  var API_BASE    = window.__POPE_API_BASE__ || 'https://pope-online-v2.onrender.com';

  /* ─── Utils ──────────────────────────────────────────── */
  function el(id)  { return document.getElementById(id); }
  function qsa(s)  { return Array.from(document.querySelectorAll(s)); }
  function show(id){ var e=el(id); if(e) e.hidden=false; }
  function hide(id){ var e=el(id); if(e) e.hidden=true;  }

  /* ─── Session helpers ────────────────────────────────── */
  function getToken() {
    return sessionStorage.getItem('pope_session_token') ||
           localStorage.getItem('pope_session_token')  || '';
  }
  function getUser() {
    try { return JSON.parse(localStorage.getItem('pope_session_user') || 'null'); } catch(e){ return null; }
  }

  /* ─── State management ───────────────────────────────── */
  function emptyState() {
    return { step:1, domain:'', domainLabel:'', domainIcon:'🎯',
             title:'', desc:'', contexte:'', probleme:'', objectif:'',
             decision:'', livrable:'', contraintes:'', risques:'',
             acteurs:'', public_c:'', deadline:'', pieces:'', niveau:'',
             besoType:'conseil', attachedGenId:'' };
  }

  function saveState(patch) {
    var s = loadState();
    Object.assign(s, patch || {});
    // Snapshot current fields
    var fieldMap = {
      title:'v60Title', desc:'v60Desc', contexte:'v60Contexte',
      probleme:'v60Probleme', objectif:'v60Objectif', decision:'v60Decision',
      livrable:'v60Livrable', contraintes:'v60Contraintes', risques:'v60Risques',
      acteurs:'v60Acteurs', public_c:'v60Public', deadline:'v60Deadline',
      pieces:'v60Pieces', niveau:'v60Niveau'
    };
    Object.keys(fieldMap).forEach(function(k){
      var e = el(fieldMap[k]); if(e) s[k] = e.value;
    });
    var radio = document.querySelector('input[name="v60BesoType"]:checked');
    if(radio) s.besoType = radio.value;
    s.step = window.__v60Step || s.step;
    try {
      var json = JSON.stringify(s);
      sessionStorage.setItem(STATE_KEY, json);
      localStorage.setItem(STATE_KEY, json);
    } catch(e){}
  }

  function loadState() {
    try {
      var raw = sessionStorage.getItem(STATE_KEY) || localStorage.getItem(STATE_KEY);
      if(raw) return Object.assign(emptyState(), JSON.parse(raw));
    } catch(e){}
    return emptyState();
  }

  function clearState() {
    sessionStorage.removeItem(STATE_KEY);
    localStorage.removeItem(STATE_KEY);
  }

  /* ─── Domain configuration ───────────────────────────── */
  var PUBLIC_DOMAINS = [
    { id:'collectivite',    label:'Collectivité',          icon:'🏛️' },
    { id:'etablissement',   label:'Établissement public',  icon:'🏫' },
    { id:'etat',            label:'Services de l\'État',   icon:'⚖️' },
    { id:'association',     label:'Association',           icon:'🤝' },
    { id:'autre_public',    label:'Autre organisation',    icon:'🏢' }
  ];
  var PRIVATE_DOMAINS = [
    { id:'artisan',         label:'Artisan / TPE',         icon:'🔧' },
    { id:'commerce',        label:'Commerce / Boutique',   icon:'🛍️' },
    { id:'profession',      label:'Profession libérale',   icon:'💼' },
    { id:'construction',    label:'BTP / Construction',    icon:'🏗️' },
    { id:'numerique',       label:'Numérique / Tech',      icon:'💻' },
    { id:'agri',            label:'Agriculture / Agro',    icon:'🌾' },
    { id:'autre_prive',     label:'Autre secteur',         icon:'🏢' }
  ];
  var DOMAINS = isPrivate ? PRIVATE_DOMAINS : PUBLIC_DOMAINS;

  /* ─── Step management ────────────────────────────────── */
  var STEPS = [1,2,3,4];

  function goStep(n) {
    var s = loadState();
    // Guard : domain required for steps > 1
    if(n > 1 && !s.domain) {
      showToast('Veuillez d\'abord sélectionner votre domaine.', 'warn');
      n = 1;
    }
    window.__v60Step = n;
    saveState({ step: n });

    // Update panels
    STEPS.forEach(function(i){
      var panel = el('v60Panel' + i);
      if(panel) {
        panel.style.display = (i === n) ? 'block' : 'none';
        panel.classList.toggle('v60-panel-active', i === n);
      }
    });

    // Update stepper
    qsa('.v60-step').forEach(function(btn){
      var sn = parseInt(btn.dataset.step, 10);
      btn.classList.toggle('active', sn === n);
      btn.classList.toggle('done', sn < n);
      btn.setAttribute('aria-current', sn === n ? 'step' : 'false');
    });

    // Panel-specific init
    if(n === 3) setTimeout(initStep3, 100);
    if(n === 4) setTimeout(initStep4, 100);

    // Scroll top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  window.v60GoStep = goStep;

  /* ─── Domain selection ───────────────────────────────── */
  function selectDomain(id) {
    var dom = DOMAINS.find(function(d){ return d.id === id; });
    if(!dom) return;
    qsa('.v60-domain-pill').forEach(function(p){
      p.classList.toggle('selected', p.dataset.domain === id);
    });
    saveState({ domain: id, domainLabel: dom.label, domainIcon: dom.icon });
    updateDomainBadge();
    goStep(2);
  }

  window.v60SelectDomain = selectDomain;

  function updateDomainBadge() {
    var s = loadState();
    qsa('.v60-domain-badge').forEach(function(badge){
      badge.style.display = s.domain ? 'inline-flex' : 'none';
      var ico  = badge.querySelector('.v60-badge-icon');
      var lbl  = badge.querySelector('.v60-badge-label');
      if(ico)  ico.textContent  = s.domainIcon;
      if(lbl)  lbl.textContent  = s.domainLabel;
    });
  }

  function changeDomain() {
    // Allow domain change from step 2+ without full reset
    goStep(1);
  }

  window.v60ChangeDomain = changeDomain;

  /* ─── Field restoration ──────────────────────────────── */
  function restoreFields() {
    var s = loadState();
    var fieldMap = {
      v60Title:'title', v60Desc:'desc', v60Contexte:'contexte',
      v60Probleme:'probleme', v60Objectif:'objectif', v60Decision:'decision',
      v60Livrable:'livrable', v60Contraintes:'contraintes', v60Risques:'risques',
      v60Acteurs:'acteurs', v60Public:'public_c', v60Deadline:'deadline',
      v60Pieces:'pieces', v60Niveau:'niveau'
    };
    Object.keys(fieldMap).forEach(function(id){
      var e = el(id); if(e && s[fieldMap[id]]) e.value = s[fieldMap[id]];
    });
    var radio = document.querySelector('input[name="v60BesoType"][value="' + (s.besoType||'conseil') + '"]');
    if(radio) radio.checked = true;

    // Restore domain pills
    if(s.domain) {
      qsa('.v60-domain-pill').forEach(function(p){
        p.classList.toggle('selected', p.dataset.domain === s.domain);
      });
    }
    updateDomainBadge();
  }

  /* ─── Build full description for expert submission ────── */
  function buildFullDescription() {
    var parts = [];
    var add = function(id, label){
      var e = el(id); if(e && (e.value||'').trim()) parts.push(label + ' : ' + e.value.trim());
    };
    add('v60Title',       'Titre / Objet');
    add('v60Contexte',    'Contexte');
    add('v60Probleme',    'Problème / Enjeu');
    add('v60Objectif',    'Objectif');
    add('v60Decision',    'Décision attendue');
    add('v60Livrable',    'Livrable attendu');
    add('v60Contraintes', 'Contraintes');
    add('v60Risques',     'Points sensibles');
    add('v60Acteurs',     'Acteurs');
    add('v60Public',      'Destinataire');
    add('v60Deadline',    'Échéance');
    add('v60Pieces',      'Pièces disponibles');
    add('v60Niveau',      'Niveau de détail');
    var desc = (el('v60Desc')||{}).value || '';
    if(desc.trim()) parts.push(desc.trim());
    return parts.join('\n');
  }
  window.v60BuildFullDescription = buildFullDescription;

  /* ─── Step 3 – Documents & IA drafts ────────────────── */
  function loadGenerations() {
    try { return JSON.parse(localStorage.getItem('pope_v54_generations') || '[]'); } catch(e){ return []; }
  }

  function initStep3() {
    renderDrafts();
    renderVaultFiles();
  }

  function renderDrafts() {
    var container = el('v60DraftList');
    if(!container) return;
    var gens = loadGenerations();
    if(!gens.length) {
      container.innerHTML = '<div class="v60-empty-state"><span>📄</span><p>Aucun draft IA disponible pour l\'instant. <a href="' + APP_URL + '" class="v60-link">Générer un livrable →</a></p></div>';
      return;
    }
    container.innerHTML = gens.slice(0,10).map(function(g, i){
      var date = g.createdAt ? new Date(g.createdAt).toLocaleString('fr-FR') : '';
      var title = g.title || g.usecaseLabel || 'Draft IA';
      var preview = (g.result||g.text||'').substring(0,120);
      var id = g.id || i;
      return '<div class="v60-draft-card" data-id="' + id + '">' +
        '<div class="v60-draft-head">' +
          '<div class="v60-draft-meta">' +
            '<strong class="v60-draft-title">' + escHtml(title) + '</strong>' +
            '<span class="v60-draft-date">' + escHtml(date) + '</span>' +
          '</div>' +
          '<button class="v60-btn v60-btn-sm v60-btn-secondary" onclick="v60AttachDraft(\'' + id + '\')" title="Joindre à la demande experte">Joindre</button>' +
        '</div>' +
        (preview ? '<p class="v60-draft-preview">' + escHtml(preview) + '…</p>' : '') +
      '</div>';
    }).join('');

    // Restore attached
    var s = loadState();
    if(s.attachedGenId) highlightAttachedDraft(s.attachedGenId);
  }

  function highlightAttachedDraft(id) {
    qsa('.v60-draft-card').forEach(function(c){
      var attached = String(c.dataset.id) === String(id);
      c.classList.toggle('v60-draft-attached', attached);
      var btn = c.querySelector('button');
      if(btn) btn.textContent = attached ? '✓ Joint' : 'Joindre';
    });
    var badge = el('v60AttachedBadge');
    if(badge) {
      var gens = loadGenerations();
      var gen = gens.find(function(g){ return String(g.id) === String(id); });
      badge.hidden = !gen;
      if(gen) badge.textContent = 'Draft joint : ' + (gen.title || gen.usecaseLabel || 'Draft IA');
    }
  }

  window.v60AttachDraft = function(id) {
    saveState({ attachedGenId: id });
    sessionStorage.setItem('pope_v58_attached_gen', id);
    highlightAttachedDraft(id);
    showToast('Draft joint à la demande experte ✓', 'ok');
  };

  window.v60DetachDraft = function() {
    saveState({ attachedGenId: '' });
    sessionStorage.removeItem('pope_v58_attached_gen');
    qsa('.v60-draft-card').forEach(function(c){ c.classList.remove('v60-draft-attached'); });
    var badge = el('v60AttachedBadge');
    if(badge) badge.hidden = true;
    renderDrafts();
    showToast('Draft détaché.', 'ok');
  };

  function renderVaultFiles() {
    var container = el('v60VaultList');
    if(!container) return;
    var token = getToken();
    if(!token) { container.innerHTML = '<p class="v60-muted">Connexion requise pour accéder au dépôt.</p>'; return; }
    container.innerHTML = '<p class="v60-muted v60-loading-text">⏳ Chargement des pièces déposées…</p>';
    fetch(API_BASE + '/vault/list?space=' + VAULT_SPACE, {
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      credentials: 'include'
    }).then(function(r){ return r.json(); })
    .then(function(data){
      var files = data.files || data.items || [];
      if(!files.length) {
        container.innerHTML = '<div class="v60-empty-state"><span>📂</span>' +
          '<p>Aucune pièce déposée. <a href="vault.html?space=' + VAULT_SPACE + '&return=' + DASH_URL + '" class="v60-link">Accéder au dépôt →</a></p></div>';
        return;
      }
      container.innerHTML = files.slice(0,8).map(function(f){
        return '<div class="v60-vault-item">' +
          '<span class="v60-vault-icon">📄</span>' +
          '<div class="v60-vault-info">' +
            '<strong>' + escHtml(f.original_name || f.filename || 'Fichier') + '</strong>' +
            '<span>' + (f.size_kb ? f.size_kb + ' Ko' : '') + (f.created_at ? ' · ' + new Date(f.created_at).toLocaleDateString('fr-FR') : '') + '</span>' +
          '</div>' +
        '</div>';
      }).join('') +
      '<a href="vault.html?space=' + VAULT_SPACE + '&return=' + DASH_URL + '?step=3" class="v60-btn v60-btn-secondary v60-mt8">📂 Gérer le dépôt</a>';
    })
    .catch(function(){
      container.innerHTML = '<div class="v60-empty-state"><span>📂</span>' +
        '<p>Impossible de charger les pièces. <a href="vault.html?space=' + VAULT_SPACE + '&return=' + DASH_URL + '" class="v60-link">Accéder au dépôt →</a></p></div>';
    });
  }

  /* ─── Step 4 – Transmission experte ─────────────────── */
  function initStep4() {
    var s = loadState();
    // Populate summary
    var summary = el('v60ExpertSummary');
    if(summary) {
      var lines = [];
      if(s.title) lines.push('<strong>Objet :</strong> ' + escHtml(s.title));
      if(s.domain) lines.push('<strong>Domaine :</strong> ' + escHtml(s.domainIcon + ' ' + s.domainLabel));
      if(s.objectif) lines.push('<strong>Objectif :</strong> ' + escHtml(s.objectif.substring(0,80) + (s.objectif.length > 80 ? '…' : '')));
      if(s.deadline) lines.push('<strong>Échéance :</strong> ' + escHtml(s.deadline));
      if(s.attachedGenId) {
        var gens = loadGenerations();
        var g = gens.find(function(x){ return String(x.id) === String(s.attachedGenId); });
        if(g) lines.push('<strong>Draft joint :</strong> ' + escHtml(g.title || 'Draft IA'));
      }
      summary.innerHTML = lines.length ? lines.join('<br>') : '<span class="v60-muted">Récapitulatif de votre demande.</span>';
    }
    // Pre-fill expert description field
    var descField = el('v60ExpertDesc');
    if(descField && !descField.value) descField.value = buildFullDescription();
  }

  /* ─── Expert submission ──────────────────────────────── */
  window.v60SubmitExpert = function() {
    var btn = el('v60BtnSubmitExpert');
    var msg = el('v60SubmitMsg');
    var s   = loadState();

    var desc = (el('v60ExpertDesc')||{}).value || buildFullDescription();
    if(!desc.trim()) { showToast('Veuillez décrire votre besoin avant d\'envoyer.', 'warn'); return; }

    if(btn) { btn.disabled = true; btn.textContent = '⏳ Envoi en cours…'; }
    if(msg) { msg.hidden = true; }

    var token = getToken();
    var body = {
      domain:      s.domain,
      domain_label:s.domainLabel,
      title:       s.title || 'Demande de relecture',
      description: desc,
      deadline:    s.deadline,
      attached_gen_id: s.attachedGenId || null,
      space:       VAULT_SPACE
    };

    fetch(API_BASE + '/expert/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? 'Bearer ' + token : ''
      },
      credentials: 'include',
      body: JSON.stringify(body)
    })
    .then(function(r){ return r.json().then(function(d){ return { ok: r.ok, data: d }; }); })
    .then(function(res){
      if(res.ok) {
        showToast('✅ Demande envoyée ! Un expert vous répondra sous 48h.', 'ok');
        if(msg) { msg.textContent = '✅ Demande transmise avec succès.'; msg.className = 'v60-msg-ok'; msg.hidden = false; }
        setTimeout(function(){ clearState(); location.href = EXPERT_URL; }, 2200);
      } else {
        var errMsg = (res.data && res.data.message) || 'Erreur lors de l\'envoi.';
        showToast('❌ ' + errMsg, 'err');
        if(msg) { msg.textContent = '❌ ' + errMsg; msg.className = 'v60-msg-err'; msg.hidden = false; }
        if(btn) { btn.disabled = false; btn.textContent = '📤 Soumettre à un expert'; }
      }
    })
    .catch(function(){
      showToast('❌ Erreur réseau. Vérifiez votre connexion.', 'err');
      if(btn) { btn.disabled = false; btn.textContent = '📤 Soumettre à un expert'; }
    });
  };

  /* ─── User hydration (bandeau dynamique) ─────────────── */
  function hydrateUser() {
    var token = getToken();
    var headers = { 'Content-Type': 'application/json' };
    if(token) headers['Authorization'] = 'Bearer ' + token;

    fetch(API_BASE + '/auth/me', {
      method: 'GET', headers: headers, credentials: 'include'
    })
    .then(function(r){ if(!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function(data){
      var user   = data.user   || {};
      var wallet = data.wallet || {};

      // Cache user
      if(user) localStorage.setItem('pope_session_user', JSON.stringify(user));

      // Prénom
      var prenom = user.full_name ? user.full_name.split(' ')[0] : (user.first_name || '');
      qsa('[data-user-greet]').forEach(function(el){
        el.textContent = prenom ? 'Bonjour ' + prenom + ' 👋' : 'Bonjour 👋';
      });
      qsa('[data-user-name]').forEach(function(el){ el.textContent = prenom || '—'; });

      // Plan
      var planLabel = wallet.plan_label || user.plan_label || 'Free';
      qsa('[data-user-plan]').forEach(function(el){ el.textContent = planLabel; });

      // Consultations restantes
      var expertLeft = wallet.expert_left != null ? wallet.expert_left : '—';
      qsa('[data-user-expert-left]').forEach(function(el){ el.textContent = expertLeft; });

      // Trial alert
      if(wallet.status === 'trial_active' && wallet.trial_days_left != null) {
        var alert = el('v60TrialAlert');
        if(alert) {
          alert.hidden = false;
          var alertBody = el('v60TrialBody');
          if(alertBody) alertBody.textContent = wallet.trial_days_left + ' jour(s) d\'essai restant(s).';
        }
      } else if(wallet.status === 'trial_expired') {
        var alert2 = el('v60TrialAlert');
        if(alert2) {
          alert2.hidden = false;
          alert2.classList.add('v60-trial-expired');
          var alertBody2 = el('v60TrialBody');
          if(alertBody2) alertBody2.textContent = 'Votre période d\'essai est terminée. Choisissez un plan pour continuer.';
        }
      }
    })
    .catch(function(){
      // Fallback on cached user
      var cached = getUser();
      if(cached) {
        var prenom = cached.full_name ? cached.full_name.split(' ')[0] : '';
        qsa('[data-user-greet]').forEach(function(e){ if(prenom) e.textContent = 'Bonjour ' + prenom + ' 👋'; });
      }
    });
  }

  /* ─── Handle return from app.html ────────────────────── */
  function handleUrlParams() {
    var sp     = new URLSearchParams(location.search);
    var from   = sp.get('from');
    var step   = parseInt(sp.get('step') || '0', 10);
    var attach = sp.get('attach') === 'last';

    if(!from && !step && !attach) return;

    // Attach last generation if requested
    if(attach) {
      var lastId = sessionStorage.getItem('pope_v54_last_generation_id') ||
                   sessionStorage.getItem('pope_v58_last_gen') || '';
      if(lastId) {
        saveState({ attachedGenId: lastId });
        sessionStorage.setItem('pope_v58_attached_gen', lastId);
      }
    }

    var target = step || (attach ? 3 : 2);
    setTimeout(function(){ goStep(target); }, 350);
  }

  /* ─── Auto-link app buttons to save state first ─────── */
  function wireAppLinks() {
    qsa('a[href="' + APP_URL + '"], a[href^="' + APP_URL + '?"]').forEach(function(a){
      a.addEventListener('click', function(){ saveState({}); });
    });
    // Update "Générer" links to include from= param so app can return correctly
    qsa('.v60-goto-app').forEach(function(a){
      a.href = APP_URL + '?from=dashboard&step=2';
      a.addEventListener('click', function(){ saveState({}); });
    });
  }

  /* ─── Toast ──────────────────────────────────────────── */
  function showToast(msg, type) {
    type = type || 'ok';
    var t = document.createElement('div');
    t.className = 'v60-toast v60-toast-' + type;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function(){ t.classList.add('v60-toast-show'); }, 10);
    setTimeout(function(){ t.classList.remove('v60-toast-show'); setTimeout(function(){ t.remove(); }, 300); }, 3000);
  }

  /* ─── HTML escape ────────────────────────────────────── */
  function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ─── Auto-save on input ─────────────────────────────── */
  document.addEventListener('input', function(){ saveState({}); }, true);
  document.addEventListener('change', function(){ saveState({}); }, true);

  /* ─── Init ───────────────────────────────────────────── */
  function init() {
    // Render domain pills
    var pillContainer = el('v60DomainPills');
    if(pillContainer && !pillContainer.dataset.rendered) {
      pillContainer.dataset.rendered = '1';
      pillContainer.innerHTML = DOMAINS.map(function(d){
        return '<button class="v60-domain-pill" data-domain="' + d.id + '" onclick="v60SelectDomain(\'' + d.id + '\')">' +
          '<span class="v60-pill-icon">' + d.icon + '</span>' +
          '<span class="v60-pill-label">' + escHtml(d.label) + '</span>' +
        '</button>';
      }).join('');
    }

    // Restore state
    var s = loadState();
    window.__v60Step = s.step || 1;
    restoreFields();

    // Go to persisted step (silently)
    STEPS.forEach(function(i){
      var panel = el('v60Panel' + i);
      if(panel) panel.style.display = (i === s.step) ? 'block' : 'none';
    });
    qsa('.v60-step').forEach(function(btn){
      var sn = parseInt(btn.dataset.step, 10);
      btn.classList.toggle('active', sn === s.step);
      btn.classList.toggle('done', sn < s.step);
    });

    // Panel specific
    if(s.step === 3) setTimeout(initStep3, 100);
    if(s.step === 4) setTimeout(initStep4, 100);

    // User hydration
    hydrateUser();

    // Wire links
    wireAppLinks();

    // URL param handling (return from app)
    handleUrlParams();
  }

  if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(init, 60); });
  } else {
    setTimeout(init, 60);
  }

})();
