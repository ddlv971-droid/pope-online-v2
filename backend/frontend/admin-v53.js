// Admin V5.3 — sauvegarde BDD fiable + assignation expert depuis la fiche
(function(){
  'use strict';
  function el(id){ return document.getElementById(id); }
  function qsa(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function apiBase(){ return String(window.__POPE_API_BASE__ || 'https://pope-online-v2.onrender.com').replace(/\/$/,''); }
  function token(){ return sessionStorage.getItem('pope_session_token') || localStorage.getItem('pope_session_token') || ''; }
  async function api(path, opts){
    opts=opts||{};
    var h=Object.assign({'Content-Type':'application/json'}, opts.headers||{});
    var t=token(); if(t) h.Authorization='Bearer '+t;
    var r=await fetch(apiBase()+path,{method:opts.method||'GET',headers:h,credentials:'include',body:opts.body?JSON.stringify(opts.body):undefined});
    var d=null; try{d=await r.json();}catch(e){}
    if(!r.ok){ throw new Error((d&&(d.detail||d.message||d.error))||('HTTP '+r.status)); }
    return d;
  }
  var currentUserId='';
  var expertMap={};
  function selectedId(){ try{ if(selectedUser && selectedUser.id) return selectedUser.id; }catch(e){} return currentUserId; }
  function setVal(id,v){ var f=el(id); if(f) f.value = v || ''; }
  function getVal(id){ return (el(id)||{}).value || ''; }
  function setMsg(txt, ok){ var msg=el('ficheMsg'); if(msg){ msg.textContent=txt; msg.className='adm-msg '+(ok?'adm-msg-ok':'adm-msg-err'); msg.style.display='block'; } }
  function ensureFields(){
    var direct=el('ficheContactDirect');
    if(direct && !el('ficheContactEmail')){
      var field=direct.closest('.fiche-field') || direct.parentElement;
      var email=document.createElement('div'); email.className='fiche-field'; email.innerHTML='<label class="fiche-label">Email du contact</label><input class="fiche-input" id="ficheContactEmail" placeholder="email@org.fr" />';
      var phone=document.createElement('div'); phone.className='fiche-field'; phone.innerHTML='<label class="fiche-label">Téléphone du contact</label><input class="fiche-input" id="ficheContactPhone" placeholder="+590 690 XX XX XX" />';
      field.after(phone); field.after(email);
    }
    var resp=el('ficheResponsable');
    if(resp && !el('ficheResponsableExpertId')){
      var rf=resp.closest('.fiche-field') || resp.parentElement;
      var box=document.createElement('div'); box.className='fiche-field';
      box.innerHTML='<label class="fiche-label">Responsable POPE assigné</label><div style="display:flex;gap:8px;align-items:center"><select class="fiche-input" id="ficheResponsableExpertId"><option value="">— Aucun expert assigné —</option></select><button type="button" class="adm-btn primary" id="btnFicheAssignExpert">Valider</button></div><div class="adm-msg" id="ficheAssignMsg" style="display:none"></div>';
      rf.after(box);
      resp.readOnly=true;
      resp.placeholder='Nom de l’expert assigné';
      el('btnFicheAssignExpert').addEventListener('click', assignExpertFromFiche);
    }
  }
  async function loadExpertsIntoFiche(){
    ensureFields();
    var sel=el('ficheResponsableExpertId'); if(!sel) return;
    try{
      var data=await api('/admin/experts');
      var experts=(data&&data.experts)||[];
      expertMap={}; experts.forEach(function(e){ expertMap[e.id]=e; });
      var cur=sel.value;
      sel.innerHTML='<option value="">— Aucun expert assigné —</option>'+experts.map(function(e){return '<option value="'+e.id+'">'+((e.full_name||e.email||e.id).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}))+'</option>';}).join('');
      if(cur) sel.value=cur;
    }catch(e){
      sel.innerHTML='<option value="">Erreur chargement experts</option>';
    }
  }
  function payload(){
    var expertId=getVal('ficheResponsableExpertId');
    var expert=expertMap[expertId];
    if(expertId && expert) setVal('ficheResponsable', expert.full_name||expert.email||'');
    return {
      nom:getVal('ficheNom'), categorie:getVal('ficheCategorie'), territoire:getVal('ficheTerritoire'), size:getVal('ficheSize'),
      contact:getVal('ficheContact'), contact_email:getVal('ficheContactEmail'), contact_phone:getVal('ficheContactPhone'), contact_direct:getVal('ficheContactDirect'),
      niveau:getVal('ficheNiveau'), source:getVal('ficheSource'), domaines:qsa('.fiche-domaine:checked').map(function(c){return c.value;}),
      besoins:getVal('ficheBesoins'), mode:getVal('ficheMode'), urgence:getVal('ficheUrgence'), stade:getVal('ficheStade'),
      maturite:getVal('val-maturite'), complexite:getVal('val-complexite'), potentiel:getVal('val-potentiel'), fidelite:getVal('val-fidelite'),
      decision:getVal('ficheDecision'), responsable:getVal('ficheResponsable'), responsable_expert_id:expertId, notes:getVal('ficheNotes'),
      budget:getVal('ficheBudget'), financement:getVal('ficheFinancement'), duree:getVal('ficheDuree'), crm_statut:getVal('ficheCrmStatut'), prochain_contact:getVal('ficheProchainContact'), canal_pref:getVal('ficheCanalPref'), actions:getVal('ficheActions')
    };
  }
  function apply(d){
    if(!d) return;
    var map={ficheNom:'nom',ficheCategorie:'categorie',ficheTerritoire:'territoire',ficheSize:'size',ficheContact:'contact',ficheContactEmail:'contact_email',ficheContactPhone:'contact_phone',ficheContactDirect:'contact_direct',ficheNiveau:'niveau',ficheSource:'source',ficheBesoins:'besoins',ficheMode:'mode',ficheUrgence:'urgence',ficheStade:'stade',ficheDecision:'decision',ficheResponsable:'responsable',ficheResponsableExpertId:'responsable_expert_id',ficheNotes:'notes',ficheBudget:'budget',ficheFinancement:'financement',ficheDuree:'duree',ficheCrmStatut:'crm_statut',ficheProchainContact:'prochain_contact',ficheCanalPref:'canal_pref',ficheActions:'actions'};
    Object.keys(map).forEach(function(id){ setVal(id, d[map[id]]); });
    qsa('.fiche-domaine').forEach(function(cb){ cb.checked=(d.domaines||[]).indexOf(cb.value)!==-1; });
    ['maturite','complexite','potentiel','fidelite'].forEach(function(k){ var v=parseInt(d[k]||0,10)||0; var hidden=el('val-'+k); if(hidden) hidden.value=v||''; qsa('#stars-'+k+' .fiche-star').forEach(function(s,i){s.classList.toggle('on', i<v);}); });
  }
  async function loadFicheClientV53(userId){
    currentUserId=userId; ensureFields(); await loadExpertsIntoFiche();
    try{
      var data=await api('/admin/client-fiche/'+encodeURIComponent(userId));
      var title=el('ficheTitleBar'); if(title) title.textContent='Fiche — '+(data.contact||data.contact_email||userId);
      apply(data);
      var msg=el('ficheMsg'); if(msg){ msg.textContent=data.saved_at?'📅 Dernière sauvegarde BDD : '+new Date(data.saved_at).toLocaleString('fr-FR'):'Préremplissage issu du compte client. À compléter puis enregistrer en BDD.'; msg.className='adm-msg'; msg.style.display='block'; }
    }catch(e){ setMsg('❌ Chargement fiche impossible : '+e.message, false); }
  }
  async function saveFicheClientV53(){
    var uid=selectedId(); if(!uid){ setMsg('❌ Aucun client sélectionné.', false); return; }
    ensureFields(); var data=payload();
    try{
      var res=await api('/admin/client-fiche/'+encodeURIComponent(uid),{method:'POST',body:data});
      if(res.responsable) setVal('ficheResponsable', res.responsable);
      if(res.responsable_expert_id) setVal('ficheResponsableExpertId', res.responsable_expert_id);
      setMsg('✅ Fiche enregistrée en BDD — '+new Date((res&&res.saved_at)||Date.now()).toLocaleString('fr-FR'), true);
      if(window.showToast) window.showToast('Fiche enregistrée en BDD','ok');
      try{ if(typeof loadExperts==='function') loadExperts(); }catch(e){}
    }catch(e){ setMsg('❌ Échec sauvegarde BDD : '+e.message, false); if(window.showToast) window.showToast('Échec sauvegarde fiche','err'); }
  }
  async function assignExpertFromFiche(){
    var uid=selectedId(); var expertId=getVal('ficheResponsableExpertId'); var msg=el('ficheAssignMsg');
    if(!uid || !expertId){ if(msg){msg.textContent='Sélectionnez un expert.'; msg.className='adm-msg adm-msg-err'; msg.style.display='block';} return; }
    await saveFicheClientV53();
    if(msg){ msg.textContent='✅ Expert assigné. La rubrique Experts & portefeuilles est synchronisée avec cette fiche.'; msg.className='adm-msg adm-msg-ok'; msg.style.display='block'; }
  }
  window.loadFicheClient=loadFicheClientV53;
  window.saveFicheClient=saveFicheClientV53;
  document.addEventListener('DOMContentLoaded', function(){ ensureFields(); loadExpertsIntoFiche(); });
  setTimeout(function(){ ensureFields(); loadExpertsIntoFiche(); }, 800);
})();
