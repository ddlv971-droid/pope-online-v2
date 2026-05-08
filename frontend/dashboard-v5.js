// Dashboard V5 — interactions externes compatibles CSP stricte
(function(){
  var isPrivate = /dashboard-private\.html$/i.test(location.pathname);
  var EXPERT_PAGE = isPrivate ? 'expert-private.html' : 'expert.html';
  var EXPERT_PAGE_MISSION = isPrivate ? 'mission-private.html' : 'mission.html';
  var _domain = '';
  var _besoType = 'conseil';
  function qs(s){ return document.querySelector(s); }
  function qsa(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function byId(id){ return document.getElementById(id); }
  function switchTab(name){
    qsa('.v5-tab').forEach(function(b){ b.classList.toggle('active', b.dataset.tab === name); });
    qsa('.v5-tab-content').forEach(function(c){ c.id === 'tab-' + name ? c.removeAttribute('hidden') : c.setAttribute('hidden',''); });
    if(name === 'experts') loadRequests();
  }
  function goStep(n){
    if(n > 1 && !_domain){
      var g = byId('domainGrid');
      if(g){ g.style.boxShadow='0 0 0 3px #ef4444'; g.style.borderRadius='14px'; setTimeout(function(){g.style.boxShadow='';g.style.borderRadius='';},1500); }
      return;
    }
    for(var i=1;i<=4;i++){ var p=byId('step-panel-'+i); if(p) p.classList.toggle('active', i===n); }
    qsa('.v5-step').forEach(function(s){ var sn=parseInt(s.dataset.step,10); s.classList.toggle('active',sn===n); s.classList.toggle('done',sn<n); });
    if(n===4) updateRecap();
  }
  function selectDomain(btn){
    qsa('.v5-domain-pill').forEach(function(b){ b.classList.remove('selected'); });
    btn.classList.add('selected');
    _domain = btn.getAttribute('data-domain') || btn.textContent.trim();
  }
  function updateBesoType(){ var r=qs('input[name="besoType"]:checked'); if(r) _besoType = r.value; }
  function updateRecap(){
    updateBesoType();
    var title=(byId('besoInTitle')||{}).value || '—';
    var quota=(byId('expertLeftN')||{}).textContent || '—';
    var tLabel=_besoType === 'surmesure' ? '📋 Sur mesure' : '🎯 Conseil Expert (48h)';
    [['recapDomain',_domain||'—'],['recapTitle',title],['recapType',tLabel],['recapQuota',quota+' Conseil(s) Expert disponible(s)']].forEach(function(x){ var e=byId(x[0]); if(e) e.textContent=x[1]; });
  }
  function submitBesoin(){
    updateBesoType();
    var title=(byId('besoInTitle')||{}).value || '';
    var desc=(byId('besoInDesc')||{}).value || '';
    var msgEl=byId('msgBesoin');
    if(!title.trim() || !desc.trim()){
      if(msgEl){ msgEl.textContent="Remplissez l’objet et la description (étape 2)."; msgEl.className='v5-msg err-show'; }
      return;
    }
    if(_besoType === 'surmesure'){ location.href = EXPERT_PAGE_MISSION; return; }
    try{ sessionStorage.setItem('v5_prefill', JSON.stringify({domain:_domain, subject:title, context:desc})); }catch(e){}
    location.href = EXPERT_PAGE;
  }
  function getApiBase(){ return String(window.__POPE_API_BASE__ || 'https://pope-online-v2.onrender.com').replace(/\/$/,''); }
  function getToken(){ return sessionStorage.getItem('pope_session_token') || localStorage.getItem('pope_session_token') || ''; }
  function loadRequests(){
    var container=byId('expertRequestsList'); if(!container) return;
    var headers={'Content-Type':'application/json'}; var token=getToken(); if(token) headers.Authorization='Bearer '+token;
    fetch(getApiBase() + '/expert/my-requests', {headers:headers, credentials:'include'})
      .then(function(r){ return r.ok ? r.json() : []; })
      .then(function(data){ renderRequests(container, Array.isArray(data) ? data : (data.requests || [])); })
      .catch(function(){ renderRequests(container, []); });
  }
  function renderRequests(container, reqs){
    function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    if(!reqs.length){ container.innerHTML='<div class="v5-empty-state"><div class="v5-empty-ico">👤</div><strong>Aucun échange expert pour le moment.</strong><p>Soumettez votre premier besoin depuis l’onglet Mon Besoin.</p><button class="v5-btn-primary" data-tab-target="besoin">🎯 Soumettre un besoin</button></div>'; return; }
    container.innerHTML=reqs.map(function(r){ var ok=r.reply_text&&r.reply_text.trim(); var date=r.created_at?new Date(r.created_at).toLocaleDateString('fr-FR'):'—'; return '<div class="v5-request-card '+(ok?'replied':'pending')+'"><div class="v5-req-domain">'+esc(r.domain||'Expert')+'</div><div class="v5-req-title">'+esc(r.subject||r.content||'—')+'</div><div class="v5-req-date">'+(ok?'✅ Répondu':'⏳ En attente')+' · '+date+'</div>'+(ok?'<div class="v5-req-reply">'+esc(r.reply_text).substring(0,300)+(r.reply_text.length>300?'…':'')+'</div>':'')+'</div>'; }).join('');
  }
  document.addEventListener('click', function(e){
    var t=e.target.closest('[data-tab-target], .v5-tab, .v5-step, .v5-domain-pill, #btnStep1Next, #btnSend');
    if(!t) return;
    if(t.matches('[data-tab-target]')){ e.preventDefault(); switchTab(t.getAttribute('data-tab-target')); return; }
    if(t.classList.contains('v5-tab')){ e.preventDefault(); switchTab(t.dataset.tab); return; }
    if(t.classList.contains('v5-step')){ e.preventDefault(); goStep(parseInt(t.dataset.step,10)); return; }
    if(t.classList.contains('v5-domain-pill')){ e.preventDefault(); selectDomain(t); return; }
    if(t.id === 'btnStep1Next'){ e.preventDefault(); goStep(2); return; }
    if(t.id === 'btnSend'){ e.preventDefault(); submitBesoin(); return; }
  });
  document.addEventListener('change', function(e){ if(e.target && e.target.name === 'besoType') updateBesoType(); });
  window.switchTab=switchTab; window.goStep=goStep; window.selectDomain=selectDomain; window.updateBesoType=updateBesoType; window.submitBesoin=submitBesoin; window.loadRequests=loadRequests;
})();
