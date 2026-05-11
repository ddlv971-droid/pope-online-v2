// Dashboard V5.2 — parcours besoin expert, sans redirection doublon
(function(){
  'use strict';
  var isPrivate = /dashboard-private\.html$/i.test(location.pathname);
  var _domain = '';
  var _besoType = 'conseil';
  var _selectedGeneration = null;
  function qs(s){ return document.querySelector(s); }
  function qsa(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function byId(id){ return document.getElementById(id); }
  function esc(s){ return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function getApiBase(){ return String(window.__POPE_API_BASE__ || 'https://pope-online-v2.onrender.com').replace(/\/$/,''); }
  function getToken(){ return sessionStorage.getItem('pope_session_token') || localStorage.getItem('pope_session_token') || ''; }
  async function api(path, opts){
    opts=opts||{}; var headers=Object.assign({'Content-Type':'application/json'}, opts.headers||{}); var token=getToken(); if(token) headers.Authorization='Bearer '+token;
    var r=await fetch(getApiBase()+path,{method:opts.method||'GET',headers:headers,credentials:'include',body:opts.body?JSON.stringify(opts.body):undefined});
    var data=null; try{data=await r.json();}catch(e){}
    if(!r.ok){ var err=new Error((data&&(data.message||data.detail||data.error))||('HTTP '+r.status)); err.status=r.status; err.data=data; throw err; }
    return data;
  }
  function injectNeedAssistant(){
    var desc=byId('besoInDesc'); if(!desc || byId('needAssistantV52')) return;
    desc.rows=8;
    desc.placeholder="Décrivez le contexte, l'objectif, les contraintes, les personnes concernées, l'échéance, les documents disponibles et le résultat attendu…";
    var wrap=document.createElement('div'); wrap.id='needAssistantV52'; wrap.className='v5-need-assistant';
    wrap.innerHTML='<style>.v5-need-assistant{margin:14px 0 18px;border:1px solid rgba(0,121,193,.20);border-radius:18px;padding:14px;background:linear-gradient(180deg,#f8fcff,#fff)}.v5-need-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.v5-need-grid label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:800;color:#16324f}.v5-need-grid input,.v5-need-grid select{border:1px solid #d8e5ef;border-radius:12px;padding:10px;background:#fff}.v5-helpchips{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.v5-helpchips button{border:1px solid #d6e7f5;background:#fff;border-radius:999px;padding:8px 10px;font-size:12px;font-weight:800;cursor:pointer}.v5-quality-note{font-size:12px;color:#516474;margin:10px 0 0;line-height:1.45}@media(max-width:720px){.v5-need-grid{grid-template-columns:1fr}}</style>'+
      '<div style="font-weight:900;color:#0b2440;margin-bottom:8px">Assistant de qualification du besoin</div>'+
      '<div class="v5-need-grid">'+
      '<label>Échéance souhaitée<input id="needDeadline" placeholder="Ex : avant vendredi / sous 10 jours"></label>'+
      '<label>Niveau d’urgence<select id="needUrgency"><option value="">À préciser</option><option>Faible</option><option>Normale</option><option>Urgente</option><option>Critique</option></select></label>'+
      '<label>Livrable attendu<input id="needDeliverable" placeholder="Note, courrier, analyse, plan d’action..."></label>'+
      '<label>Sensibilité du dossier<select id="needSensitivity"><option value="">À préciser</option><option>Courante</option><option>Sensible</option><option>Très sensible / décision stratégique</option></select></label>'+
      '<label>Public concerné<input id="needAudience" placeholder="Élu, DG, client, prestataire, service..."></label>'+
      '<label>Décision attendue<input id="needDecision" placeholder="Valider, arbitrer, sécuriser, répondre..."></label>'+
      '</div>'+
      '<div class="v5-helpchips"><button data-add-need="Contexte :\nObjectif recherché :\nContraintes connues :\nÉchéance :\nDocuments disponibles :\nLivrable attendu :">➕ Trame complète</button><button data-add-need="Points de vigilance juridique / financier / organisationnel :">⚠️ Points de vigilance</button><button data-add-need="Résultat idéal attendu de l’expert :">🎯 Résultat attendu</button><button data-add-need="Questions précises à trancher :">❓ Questions à trancher</button></div>'+
      '<p class="v5-quality-note">Un besoin bien défini permet à l’expert de répondre plus vite, avec moins d’allers-retours et une recommandation plus adaptée.</p>';
    var fg = desc.closest('.v5-field-group') || desc.closest('.v5-field') || desc.parentElement;
    if (fg) fg.after(wrap); else desc.insertAdjacentElement('afterend', wrap);
  }
  function buildFullNeed(){
    var desc=(byId('besoInDesc')||{}).value||'';
    var extra=[];
    [['Échéance', 'needDeadline'],['Urgence','needUrgency'],['Livrable attendu','needDeliverable'],['Sensibilité','needSensitivity'],['Public concerné','needAudience'],['Décision attendue','needDecision']].forEach(function(x){var v=(byId(x[1])||{}).value||''; if(v.trim()) extra.push(x[0]+' : '+v.trim());});
    return [desc.trim(), extra.length?'\nCompléments de qualification :\n- '+extra.join('\n- '):''].join('\n').trim();
  }
  function loadLocalGenerations(){
    try { return JSON.parse(localStorage.getItem('pope_v53_generations') || '[]'); } catch(e) { return []; }
  }
  function populateGenerationSelect(){
    var sel=byId('archiveAttachSelect'); if(!sel) return;
    var gens=loadLocalGenerations();
    var cur=sel.value;
    sel.innerHTML='<option value="">Ne pas joindre de draft préparé</option>' + gens.map(function(g,i){
      var label=(g.title||g.usecaseLabel||'Draft préparé')+' — '+(g.createdAt?new Date(g.createdAt).toLocaleString('fr-FR'):'');
      return '<option value="'+esc(g.id||String(i))+'">'+esc(label)+'</option>';
    }).join('');
    if(cur) sel.value=cur;
    sel.onchange=function(){ var v=sel.value; _selectedGeneration = gens.find(function(g,i){return String(g.id||i)===String(v);}) || null; };
    if(sel.value) sel.onchange();
  }
  function switchTab(name){ qsa('.v5-tab').forEach(function(b){b.classList.toggle('active',b.dataset.tab===name);}); qsa('.v5-tab-content').forEach(function(c){c.id==='tab-'+name?c.removeAttribute('hidden'):c.setAttribute('hidden','');}); if(name==='experts') loadRequests(); }
  function goStep(n){ if(n>1&&!_domain){ var g=byId('domainGrid'); if(g){g.style.boxShadow='0 0 0 3px #ef4444';setTimeout(function(){g.style.boxShadow='';},1200);} return; } for(var i=1;i<=4;i++){var p=byId('step-panel-'+i); if(p)p.classList.toggle('active',i===n);} qsa('.v5-step').forEach(function(s){var sn=parseInt(s.dataset.step,10); s.classList.toggle('active',sn===n); s.classList.toggle('done',sn<n);}); if(n===2) injectNeedAssistant(); if(n===3) populateGenerationSelect(); if(n===4) updateRecap(); }
  function selectDomain(btn){ qsa('.v5-domain-pill').forEach(function(b){b.classList.remove('selected');}); btn.classList.add('selected'); _domain=btn.getAttribute('data-domain')||btn.textContent.trim(); }
  function updateBesoType(){ var r=qs('input[name="besoType"]:checked'); if(r)_besoType=r.value; }
  function updateRecap(){ updateBesoType(); var title=(byId('besoInTitle')||{}).value||'—'; var quota=(byId('expertLeftN')||{}).textContent||'—'; var type=_besoType==='surmesure'?'📋 Accompagnement approfondi':'🎯 Conseil expert ponctuel'; [['recapDomain',_domain||'—'],['recapTitle',title],['recapType',type],['recapQuota',quota+' demande(s) disponible(s)']].forEach(function(x){var e=byId(x[0]); if(e)e.textContent=x[1];}); var panel=byId('step-panel-4'); if(panel && !byId('recapProfessionalV52')){ var card=panel.querySelector('.v5-recap-card'); var pro=document.createElement('div'); pro.id='recapProfessionalV52'; pro.className='v5-recap-card'; pro.style.marginTop='12px'; pro.innerHTML='<div class="v5-recap-row"><span class="v5-recap-key">Statut</span><span class="v5-recap-val">🟡 Brouillon prêt à soumettre</span></div><div class="v5-recap-row"><span class="v5-recap-key">Traitement</span><span class="v5-recap-val">Votre demande créera un dossier de suivi dans “Mes échanges experts”.</span></div><div class="v5-recap-row"><span class="v5-recap-key">Suite</span><span class="v5-recap-val">Un expert POPE Online pourra analyser, répondre et faire évoluer le statut du dossier.</span></div>'; if(card) card.after(pro);} }
  async function submitBesoin(){
    updateBesoType(); var title=(byId('besoInTitle')||{}).value||''; var fullNeed=buildFullNeed(); var msg=byId('msgBesoin');
    if(!title.trim()||!fullNeed.trim()){ if(msg){msg.textContent="Complétez l’objet et la description du besoin."; msg.className='v5-msg err-show';} return; }
    var btn=byId('btnSend'); if(btn){btn.disabled=true; btn.textContent='Envoi en cours…';}
    try{
      var meEmail=''; try{ var me=await api('/auth/me'); meEmail=me.email||me.user?.email||''; }catch(e){}
      var res=await api('/expert/request',{method:'POST',body:{email:meEmail,domain:_domain,subject:title,objective:title,expectations:fullNeed,context:'Parcours '+(isPrivate?'privé':'public')+' — '+(_besoType==='surmesure'?'accompagnement approfondi':'demande expert ponctuelle'), type:_besoType, generation_attachment:_selectedGeneration}});
      if(res.wallet) updateWalletIndicators(res.wallet);
      showSubmitted(res.requestId,res.wallet);
      await loadRequests();
    }catch(e){ if(msg){msg.textContent='Erreur d’enregistrement : '+(e.message||e)+'. Vérifiez le quota et la connexion API.'; msg.className='v5-msg err-show';} }
    finally{ if(btn){btn.disabled=false; btn.textContent='🎯 Soumettre à un expert';} }
  }
  function updateWalletIndicators(w){ if(!w)return; var left=byId('expertLeftN'); if(left && w.expert_left!==undefined) left.textContent=String(w.expert_left); }
  function showSubmitted(id,wallet){ var panel=byId('step-panel-4'); if(!panel)return; panel.innerHTML='<div class="v5-panel-head"><h2>Demande transmise à un expert</h2><p>Votre dossier est maintenant enregistré et suivi dans votre espace.</p></div><div class="v5-recap-card"><div class="v5-recap-row"><span class="v5-recap-key">Statut</span><span class="v5-recap-val">🟢 Reçue par POPE Online</span></div><div class="v5-recap-row"><span class="v5-recap-key">Référence</span><span class="v5-recap-val">'+esc(id||'—')+'</span></div><div class="v5-recap-row"><span class="v5-recap-key">Domaine</span><span class="v5-recap-val">'+esc(_domain||'—')+'</span></div><div class="v5-recap-row"><span class="v5-recap-key">Étape suivante</span><span class="v5-recap-val">Qualification, affectation expert, réponse ou demande de précision.</span></div><div class="v5-recap-row"><span class="v5-recap-key">Demandes restantes</span><span class="v5-recap-val">'+esc(wallet&&wallet.expert_left!==undefined?wallet.expert_left:'—')+'</span></div></div><div class="v5-step-footer"><button class="v5-btn-primary" data-tab-target="experts">Voir mon tableau de suivi →</button></div>'; }
  function loadRequests(){ var c=byId('expertRequestsList'); if(!c)return; api('/expert/my-requests').then(function(data){ renderRequests(c, Array.isArray(data)?data:(data.requests||[])); }).catch(function(){ renderRequests(c, []); }); }
  function renderRequests(c,reqs){ if(!reqs.length){c.innerHTML='<div class="v5-empty-state"><div class="v5-empty-ico">👤</div><strong>Aucun dossier expert pour le moment.</strong><p>Soumettez un besoin depuis l’onglet Mon Besoin.</p><button class="v5-btn-primary" data-tab-target="besoin">🎯 Soumettre un besoin</button></div>';return;} c.innerHTML=reqs.map(function(r){var ok=r.reply_text&&r.reply_text.trim(); var date=r.created_at?new Date(r.created_at).toLocaleDateString('fr-FR'):'—'; var title=r.objective||r.subject||'Demande expert'; return '<div class="v5-request-card '+(ok?'replied':'pending')+'"><div class="v5-req-domain">'+esc(r.domain||_domain||'Expertise')+'</div><div class="v5-req-title">'+esc(title)+'</div><div class="v5-req-date">'+(ok?'✅ Réponse disponible':'⏳ En cours de traitement')+' · '+date+'</div>'+(ok?'<div class="v5-req-reply">'+esc(r.reply_text).slice(0,300)+(r.reply_text.length>300?'…':'')+'</div>':'<div class="v5-req-reply">Statut : demande reçue. Un expert pourra être assigné depuis le tableau de bord administrateur.</div>')+'</div>';}).join(''); }
  document.addEventListener('click',function(e){ var add=e.target.closest('[data-add-need]'); if(add){e.preventDefault(); var d=byId('besoInDesc'); if(d){d.value=(d.value?d.value+'\n\n':'')+add.getAttribute('data-add-need'); d.focus();} return;} var t=e.target.closest('[data-tab-target], .v5-tab, .v5-step, .v5-domain-pill, #btnStep1Next, #btnSend'); if(!t)return; if(t.matches('[data-tab-target]')){e.preventDefault();switchTab(t.getAttribute('data-tab-target'));return;} if(t.classList.contains('v5-tab')){e.preventDefault();switchTab(t.dataset.tab);return;} if(t.classList.contains('v5-step')){e.preventDefault();goStep(parseInt(t.dataset.step,10));return;} if(t.classList.contains('v5-domain-pill')){e.preventDefault();selectDomain(t);return;} if(t.id==='btnStep1Next'){e.preventDefault();goStep(2);return;} if(t.id==='btnSend'){e.preventDefault();submitBesoin();return;} });
  document.addEventListener('change',function(e){ if(e.target&&e.target.name==='besoType') updateBesoType(); });
  window.switchTab=switchTab; window.goStep=goStep; window.selectDomain=selectDomain; window.updateBesoType=updateBesoType; window.submitBesoin=submitBesoin; window.loadRequests=loadRequests;
  injectNeedAssistant(); populateGenerationSelect();
  try{ var params=new URLSearchParams(location.search); if(params.get('attach')==='last'){ setTimeout(function(){ switchTab('besoin'); goStep(2); var last=sessionStorage.getItem('pope_v53_last_generation_id'); var sel=byId('archiveAttachSelect'); if(sel && last){ sel.value=last; sel.dispatchEvent(new Event('change')); } },350); } }catch(e){}
})();
