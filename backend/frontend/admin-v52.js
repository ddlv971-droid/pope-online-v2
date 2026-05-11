// Admin V5.2 — préremplissage fiche, champs contact séparés, assignation expert depuis la fiche
(function(){
  'use strict';
  function el(id){ return document.getElementById(id); }
  function qsa(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function apiBase(){ return String(window.__POPE_API_BASE__ || 'https://pope-online-v2.onrender.com').replace(/\/$/,''); }
  function token(){ return sessionStorage.getItem('pope_session_token') || localStorage.getItem('pope_session_token') || ''; }
  async function api(path, opts){ opts=opts||{}; var h=Object.assign({'Content-Type':'application/json'}, opts.headers||{}); var t=token(); if(t) h.Authorization='Bearer '+t; var r=await fetch(apiBase()+path,{method:opts.method||'GET',headers:h,credentials:'include',body:opts.body?JSON.stringify(opts.body):undefined}); var d=null; try{d=await r.json();}catch(e){} if(!r.ok){throw new Error((d&&(d.detail||d.message||d.error))||('HTTP '+r.status));} return d; }
  var currentFicheUserId=''; var currentFicheUserLabel='';
  function selected(){ return { id: currentFicheUserId, full_name: currentFicheUserLabel, email: currentFicheUserLabel }; }
  function setVal(id,v){ var f=el(id); if(f) f.value=v||''; }
  function getVal(id){ return (el(id)||{}).value||''; }
  function injectFields(){
    if(!el('ficheContactDirect') || el('ficheContactEmail')) return;
    var direct=el('ficheContactDirect');
    var field=direct.closest('.fiche-field');
    if(field){
      var email=document.createElement('div'); email.className='fiche-field'; email.innerHTML='<label class="fiche-label">Email du contact</label><input class="fiche-input" id="ficheContactEmail" placeholder="email@org.fr" />';
      var phone=document.createElement('div'); phone.className='fiche-field'; phone.innerHTML='<label class="fiche-label">Téléphone du contact</label><input class="fiche-input" id="ficheContactPhone" placeholder="06 XX XX XX XX" />';
      field.after(phone); field.after(email);
    }
    var resp=el('ficheResponsable');
    if(resp && !el('ficheResponsableExpertId')){
      var rf=resp.closest('.fiche-field');
      var box=document.createElement('div'); box.className='fiche-field'; box.innerHTML='<label class="fiche-label">Assigner à un expert</label><div style="display:flex;gap:8px"><select class="fiche-input" id="ficheResponsableExpertId"><option value="">— Sélectionner un expert —</option></select><button type="button" class="adm-btn primary" id="btnFicheAssignExpert">Valider</button></div><div class="adm-msg" id="ficheAssignMsg" style="display:none"></div>';
      rf.after(box);
      el('btnFicheAssignExpert').addEventListener('click', assignExpertFromFiche);
      loadExpertsIntoFiche();
    }
  }
  async function loadExpertsIntoFiche(){
    var sel=el('ficheResponsableExpertId'); if(!sel) return;
    try{
      var data=await api('/admin/users/'); var arr=Array.isArray(data)?data:(data.users||[]);
      var experts=arr.filter(function(u){return String(u.role||'client')==='expert' || String(u.role||'').includes('expert');});
      sel.innerHTML='<option value="">— Sélectionner un expert —</option>'+experts.map(function(u){return '<option value="'+u.id+'">'+(u.full_name||u.email||u.id)+'</option>';}).join('');
    }catch(e){ sel.innerHTML='<option value="">Aucun expert chargé</option>'; }
  }
  function payload(){
    return {
      nom:getVal('ficheNom'), categorie:getVal('ficheCategorie'), territoire:getVal('ficheTerritoire'), size:getVal('ficheSize'),
      contact:getVal('ficheContact'), contact_email:getVal('ficheContactEmail'), contact_phone:getVal('ficheContactPhone'), contact_direct:getVal('ficheContactDirect'),
      niveau:getVal('ficheNiveau'), source:getVal('ficheSource'), domaines:qsa('.fiche-domaine:checked').map(function(c){return c.value;}),
      besoins:getVal('ficheBesoins'), mode:getVal('ficheMode'), urgence:getVal('ficheUrgence'), stade:getVal('ficheStade'),
      maturite:getVal('val-maturite'), complexite:getVal('val-complexite'), potentiel:getVal('val-potentiel'), fidelite:getVal('val-fidelite'),
      decision:getVal('ficheDecision'), responsable:getVal('ficheResponsable'), responsable_expert_id:getVal('ficheResponsableExpertId'), notes:getVal('ficheNotes'),
      budget:getVal('ficheBudget'), financement:getVal('ficheFinancement'), duree:getVal('ficheDuree'), crm_statut:getVal('ficheCrmStatut'), prochain_contact:getVal('ficheProchainContact'), canal_pref:getVal('ficheCanalPref'), actions:getVal('ficheActions')
    };
  }
  function apply(d){ if(!d) return; var map={ficheNom:'nom',ficheCategorie:'categorie',ficheTerritoire:'territoire',ficheSize:'size',ficheContact:'contact',ficheContactEmail:'contact_email',ficheContactPhone:'contact_phone',ficheContactDirect:'contact_direct',ficheNiveau:'niveau',ficheSource:'source',ficheBesoins:'besoins',ficheMode:'mode',ficheUrgence:'urgence',ficheStade:'stade',ficheDecision:'decision',ficheResponsable:'responsable',ficheResponsableExpertId:'responsable_expert_id',ficheNotes:'notes',ficheBudget:'budget',ficheFinancement:'financement',ficheDuree:'duree',ficheCrmStatut:'crm_statut',ficheProchainContact:'prochain_contact',ficheCanalPref:'canal_pref',ficheActions:'actions'}; Object.keys(map).forEach(function(id){setVal(id,d[map[id]]);}); qsa('.fiche-domaine').forEach(function(cb){cb.checked=(d.domaines||[]).indexOf(cb.value)!==-1;}); }
  async function loadFicheClient(userId){ currentFicheUserId=userId; injectFields(); await loadExpertsIntoFiche(); var title=el('ficheTitleBar'); var data=await api('/admin/client-fiche/'+encodeURIComponent(userId)); currentFicheUserLabel=(data&&data.contact)||userId; if(title) title.textContent='Fiche — '+(currentFicheUserLabel||userId); apply(data); var msg=el('ficheMsg'); if(msg){ msg.textContent=data&&data.saved_at?'📅 Dernière sauvegarde : '+new Date(data.saved_at).toLocaleString('fr-FR'):'Préremplissage issu du compte client. À compléter puis enregistrer.'; msg.className='adm-msg'; msg.style.display='block'; } }
  async function saveFicheClient(){ var su=selected(); if(!su) return; injectFields(); var data=payload(); var msg=el('ficheMsg'); try{ var res=await api('/admin/client-fiche/'+encodeURIComponent(su.id),{method:'POST',body:data}); if(data.responsable_expert_id){ try{await api('/admin/expert-assignments',{method:'POST',body:{expertId:data.responsable_expert_id,clientId:su.id}});}catch(e){} } if(msg){msg.textContent='✅ Fiche enregistrée en base — '+new Date((res&&res.saved_at)||Date.now()).toLocaleString('fr-FR'); msg.className='adm-msg adm-msg-ok'; msg.style.display='block';} if(window.showToast) window.showToast('Fiche enregistrée en base','ok'); }catch(e){ if(msg){msg.textContent='❌ Échec sauvegarde BDD : '+e.message; msg.className='adm-msg adm-msg-err'; msg.style.display='block';} if(window.showToast) window.showToast('Échec sauvegarde fiche','err'); } }
  async function assignExpertFromFiche(){ var su=selected(); var expertId=getVal('ficheResponsableExpertId'); var msg=el('ficheAssignMsg'); if(!su||!expertId){ if(msg){msg.textContent='Sélectionnez un expert.'; msg.style.display='block';} return; } try{ await api('/admin/expert-assignments',{method:'POST',body:{expertId:expertId,clientId:su.id}}); await saveFicheClient(); if(msg){msg.textContent='✅ Expert assigné. Il verra les requêtes du client dans son tableau expert.'; msg.className='adm-msg adm-msg-ok'; msg.style.display='block';} }catch(e){ if(msg){msg.textContent='❌ '+e.message; msg.className='adm-msg adm-msg-err'; msg.style.display='block';} } }
  window.loadFicheClient=loadFicheClient; window.saveFicheClient=saveFicheClient;
  document.addEventListener('DOMContentLoaded', injectFields);
  setTimeout(injectFields,400);
})();
