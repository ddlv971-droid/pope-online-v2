
// Topbar mobile universelle V40 — burger + menu + croix
(function() {
  var burger  = document.getElementById('v40Burger');
  var menu    = document.getElementById('v40MobileMenu');
  if (!burger || !menu) return;

  var spans = burger.querySelectorAll('span');

  function setOpen(open) {
    if (open) {
      menu.classList.add('open');
      spans[0].style.cssText = 'transform:rotate(45deg) translate(5px,5px)';
      spans[1].style.cssText = 'opacity:0;transform:scaleX(0)';
      spans[2].style.cssText = 'transform:rotate(-45deg) translate(5px,-5px)';
    } else {
      menu.classList.remove('open');
      spans[0].style.cssText = '';
      spans[1].style.cssText = '';
      spans[2].style.cssText = '';
    }
  }

  burger.addEventListener('click', function() {
    setOpen(!menu.classList.contains('open'));
  });

  // Fermer en cliquant un lien
  menu.querySelectorAll('a, button').forEach(function(el) {
    el.addEventListener('click', function() { setOpen(false); });
  });

  // Fermer en cliquant hors du menu
  document.addEventListener('click', function(e) {
    if (!burger.contains(e.target) && !menu.contains(e.target)) {
      setOpen(false);
    }
  });
})();

</script>

<script id="v5-js">
// Variables
var _domain = ''; window._domain = ''; // v57: shared state
var _besoType = 'conseil';
var _step = 1;

// Changer d'onglet
function switchTab(name) {
  document.querySelectorAll('.v5-tab').forEach(function(b){
    b.classList.toggle('active', b.dataset.tab === name);
  });
  document.querySelectorAll('.v5-tab-content').forEach(function(c){
    if (c.id === 'tab-' + name) {
      c.removeAttribute('hidden');
    } else {
      c.setAttribute('hidden', '');
    }
  });
  if (name === 'experts') loadRequests();
}

// Aller à une étape
function goStep(n) {
  // v57: also check window._domain (set by state restore) and skip guard if force=true
  if (n > 1 && !_domain) _domain = window._domain || '';
  if (n > 1 && !_domain) {
    var g = document.getElementById('domainGrid');
    if (g) {
      g.style.boxShadow = '0 0 0 3px #ef4444';
      g.style.borderRadius = '14px';
      setTimeout(function(){ g.style.boxShadow=''; g.style.borderRadius=''; }, 1500);
    }
    return;
  }
  _step = n;
  // Panels
  for (var i = 1; i <= 4; i++) {
    var p = document.getElementById('step-panel-' + i);
    if (p) p.classList.toggle('active', i === n);
  }
  // Steps visuels
  document.querySelectorAll('.v5-step').forEach(function(s){
    var sn = parseInt(s.dataset.step);
    s.classList.toggle('active', sn === n);
    s.classList.toggle('done', sn < n);
  });
  if (n === 4) updateRecap();
}

// Sélectionner un domaine
function selectDomain(btn) {
  document.querySelectorAll('.v5-domain-pill').forEach(function(b){
    b.classList.remove('selected');
  });
  btn.classList.add('selected');
  _domain = btn.getAttribute('data-domain');
  window._domain = _domain; // v57: sync
  // v56: mise à jour badge domaine
  var badge = document.getElementById('selectedDomainBadge');
  var label = document.getElementById('selectedDomainLabel');
  var icon = document.getElementById('selectedDomainIcon');
  if (badge && label) {
    badge.style.display = 'block';
    label.textContent = _domain || '';
    if (icon) icon.textContent = btn.textContent.trim().split(' ')[0] || '🎯';
  }
}

// Maj type de besoin
function updateBesoType() {
  var r = document.querySelector('input[name="besoType"]:checked');
  if (r) _besoType = r.value;
}

// Récapitulatif
function updateRecap() {
  var title  = (document.getElementById('besoInTitle') || {}).value || '—';
  var leftEl = document.getElementById('expertLeftN');
  var quota  = leftEl ? leftEl.textContent : '—';
  var tLabel = _besoType === 'surmesure' ? '📋 Sur Mesure' : '🎯 Conseil Expert (48h)';
  var r = function(id, v){ var el=document.getElementById(id); if(el) el.textContent=v; };
  r('recapDomain', _domain || '—');
  r('recapTitle',  title);
  r('recapType',   tLabel);
  r('recapQuota',  quota + ' Conseil(s) Expert disponible(s)');
}

// Soumettre le besoin
function submitBesoin() {
  var title = ($('besoInTitle') || {}).value || '';
  function $(id){ return document.getElementById(id); }
  var desc = window.buildFullDescription ? window.buildFullDescription() : (($('besoInDesc')||{}).value||'');
  var msgEl = $('msgBesoin');
  var ctx = ($('descContexte')||{}).value||'';
  var obj = ($('descObjectif')||{}).value||'';
  if (!title.trim() || (!ctx.trim() && !obj.trim() && !desc.trim())) {
    if (msgEl) { msgEl.textContent = "Remplissez l'objet et au moins le contexte ou l'objectif."; msgEl.className = 'v5-msg err-show'; }
    var first = document.querySelector('.v58-acc:not(.is-open)');
    if (first) first.classList.add('is-open');
    return;
  }
  if (window.saveDashboardState) window.saveDashboardState();
  if (_besoType === 'surmesure') { window.location.href = EXPERT_PAGE_MISSION; return; }
  try { sessionStorage.setItem('v5_prefill', JSON.stringify({ domain: _domain, subject: title, context: desc })); } catch(e) {}
  window.location.href = EXPERT_PAGE;
}

// Charger historique experts
function loadRequests() {
  var container = document.getElementById('expertRequestsList');
  if (!container) return;
  var token = sessionStorage.getItem('pope_session_token') || localStorage.getItem('pope_session_token') || '';
  var base = (window.__POPE_API_BASE__ || 'https://pope-online-v2.onrender.com').replace(/\/$/, '');
  var headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  fetch(base + '/expert/my-requests', { headers: headers, credentials: 'include' })
    .then(function(r){ return r.ok ? r.json() : []; })
    .then(function(data){ renderRequests(container, Array.isArray(data) ? data : (data.requests || [])); })
    .catch(function(){ renderRequests(container, []); });
}

function renderRequests(container, reqs) {
  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  if (!reqs.length) {
    container.innerHTML = '<div class="v5-empty-state"><div class="v5-empty-ico">👤</div><strong>Aucun échange expert pour le moment.</strong><p>Soumettez votre premier besoin depuis l\'onglet Mon Besoin.</p><button class="v5-btn-primary" onclick="switchTab('besoin')">🎯 Soumettre un besoin</button></div>';
    return;
  }
  container.innerHTML = reqs.map(function(r){
    var ok = r.reply_text && r.reply_text.trim();
    var date = r.created_at ? new Date(r.created_at).toLocaleDateString('fr-FR') : '—';
    return '<div class="v5-request-card ' + (ok ? 'replied' : 'pending') + '">'
      + '<div class="v5-req-domain">' + esc(r.domain || 'Expert') + '</div>'
      + '<div class="v5-req-title">' + esc(r.subject || r.content || '—') + '</div>'
      + '<div class="v5-req-date">' + (ok ? '✅ Répondu' : '⏳ En attente') + ' · ' + date + '</div>'
      + (ok ? '<div class="v5-req-reply">' + esc(r.reply_text).substring(0,300) + (r.reply_text.length>300?'…':'') + '</div>' : '')
      + '</div>';
  }).join('');
}

// Exposer sur window — nécessaire quand la page contient un <script type="module">
window.switchTab      = switchTab;
window.goStep         = goStep;
window.selectDomain   = selectDomain;
window.updateBesoType = updateBesoType;
window.submitBesoin   = submitBesoin;
window.loadRequests   = loadRequests;

window.switchTab=switchTab;window.goStep=goStep;window.selectDomain=selectDomain;window.updateBesoType=updateBesoType;window.submitBesoin=submitBesoin;window.loadRequests=loadRequests;
