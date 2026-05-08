// Admin V5.4 — override final : sauvegarde BDD robuste + assignation expert dans la fiche
(function(){
  function el(id){return document.getElementById(id);} 
  function esc(s){return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  async function api(path, opts){ return window.apiFetch ? window.apiFetch(path, opts||{}) : Promise.reject(new Error('apiFetch indisponible')); }
  function selected(){ return window.selectedUser || (typeof selectedUser!=='undefined' ? selectedUser : null); }
  async function experts(){ try{ var d=await api('/admin/experts'); return Array.isArray(d)?d:(d.experts||d.users||[]); }catch(e){ return []; } }
  function ensureExpertSelect(){
    var resp=el('ficheResponsable'); if(!resp) return;
    var box=el('ficheExpertAssignBox');
    if(!box){
      box=document.createElement('div'); box.id='ficheExpertAssignBox'; box.style.margin='8px 0 0';
      box.innerHTML='<label class="fiche-label">Responsable POPE assigné</label><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><select class="fiche-input" id="ficheResponsableExpertId" style="flex:1;min-width:240px"><option value="">— Aucun expert assigné —</option></select><button type="button" class="adm-btn primary" id="btnFicheAssignExpert">Valider l\'assignation</button></div><div class="adm-msg" id="ficheAssignMsg" style="display:none"></div>';
      resp.closest('.fiche-field,.adm-field,div')?.after(box);
      var b=el('btnFicheAssignExpert'); if(b) b.addEventListener('click', assignExpertFromFiche);
    }
  }
  async function loadExpertsIntoFiche(selectedId){
    ensureExpertSelect(); var sel=el('ficheResponsableExpertId'); if(!sel) return;
    var list=await experts();
    sel.innerHTML='<option value="">— Aucun expert assigné —</option>'+list.map(function(e){var label=e.full_name||e.name||e.email||e.id; return '<option value="'+esc(e.id)+'">'+esc(label)+'</option>';}).join('');
    if(selectedId) sel.value=selectedId;
  }
  function payload(){
    var domaines=Array.from(document.querySelectorAll('.fiche-domaine:checked')).map(function(c){return c.value;});
    return { nom:(el('ficheNom')||{}).value||'', categorie:(el('ficheCategorie')||{}).value||'', territoire:(el('ficheTerritoire')||{}).value||'', size:(el('ficheSize')||{}).value||'', contact:(el('ficheContact')||{}).value||'', contact_direct:(el('ficheContactDirect')||{}).value||'', contact_email:(el('ficheContactEmail')||{}).value||'', contact_phone:(el('ficheContactPhone')||{}).value||'', niveau:(el('ficheNiveau')||{}).value||'', source:(el('ficheSource')||{}).value||'', domaines:domaines, besoins:(el('ficheBesoins')||{}).value||'', mode:(el('ficheMode')||{}).value||'', urgence:(el('ficheUrgence')||{}).value||'', stade:(el('ficheStade')||{}).value||'', maturite:(el('val-maturite')||{}).value||'', complexite:(el('val-complexite')||{}).value||'', potentiel:(el('val-potentiel')||{}).value||'', fidelite:(el('val-fidelite')||{}).value||'', decision:(el('ficheDecision')||{}).value||'', responsable:(el('ficheResponsable')||{}).value||'', responsable_expert_id:(el('ficheResponsableExpertId')||{}).value||'', notes:(el('ficheNotes')||{}).value||'', budget:(el('ficheBudget')||{}).value||'', financement:(el('ficheFinancement')||{}).value||'', duree:(el('ficheDuree')||{}).value||'', crm_statut:(el('ficheCrmStatut')||{}).value||'', prochain_contact:(el('ficheProchainContact')||{}).value||'', canal_pref:(el('ficheCanalPref')||{}).value||'', actions:(el('ficheActions')||{}).value||'' };
  }
  function apply(d){ if(!d)return; var map={ficheNom:'nom',ficheCategorie:'categorie',ficheTerritoire:'territoire',ficheSize:'size',ficheContact:'contact',ficheContactDirect:'contact_direct',ficheContactEmail:'contact_email',ficheContactPhone:'contact_phone',ficheNiveau:'niveau',ficheSource:'source',ficheBesoins:'besoins',ficheMode:'mode',ficheUrgence:'urgence',ficheStade:'stade',ficheDecision:'decision',ficheResponsable:'responsable',ficheNotes:'notes',ficheBudget:'budget',ficheFinancement:'financement',ficheDuree:'duree',ficheCrmStatut:'crm_statut',ficheProchainContact:'prochain_contact',ficheCanalPref:'canal_pref',ficheActions:'actions'}; Object.keys(map).forEach(function(id){var f=el(id); if(f) f.value=d[map[id]]||'';}); document.querySelectorAll('.fiche-domaine').forEach(function(cb){cb.checked=(d.domaines||[]).indexOf(cb.value)!==-1;}); ['maturite','complexite','potentiel','fidelite'].forEach(function(k){ if(window.setStar) window.setStar(k,parseInt(d[k]||0,10)||0);}); }
  window.saveFicheClient = async function(){ var su=selected(); if(!su) return; var msg=el('ficheMsg'); try{ var d=payload(); var res=await api('/admin/client-fiche/'+encodeURIComponent(su.id),{method:'POST',body:d}); localStorage.setItem('pope_fiche_'+su.id,JSON.stringify(Object.assign({},d,res||{}))); if(msg){msg.textContent='✅ Fiche enregistrée en BDD — '+new Date().toLocaleString('fr-FR');msg.className='adm-msg adm-msg-ok';msg.style.display='block';} if(window.showToast) window.showToast('Fiche enregistrée en BDD','ok'); }catch(e){ if(msg){msg.textContent='❌ Échec sauvegarde BDD : '+(e.data?.detail||e.message||e);msg.className='adm-msg adm-msg-err';msg.style.display='block';} if(window.showToast) window.showToast('Échec sauvegarde fiche','err'); } };
  window.loadFicheClient = async function(userId){ ensureExpertSelect(); var title=el('ficheTitleBar'), su=selected(); if(title) title.textContent='Fiche — '+((su&&(su.full_name||su.email))||userId); var d=null; try{ d=await api('/admin/client-fiche/'+encodeURIComponent(userId)); }catch(e){ try{d=JSON.parse(localStorage.getItem('pope_fiche_'+userId)||'null');}catch(_){} } await loadExpertsIntoFiche(d&&d.responsable_expert_id); apply(d); var msg=el('ficheMsg'); if(msg&&d){msg.textContent=d.saved_at?'📅 Dernière sauvegarde : '+new Date(d.saved_at).toLocaleString('fr-FR'):'Préremplissage depuis le compte client.';msg.className='adm-msg';msg.style.display='block';} };
  async function assignExpertFromFiche(){ var su=selected(); var expertId=(el('ficheResponsableExpertId')||{}).value||''; var msg=el('ficheAssignMsg'); if(!su||!expertId){ if(msg){msg.textContent='Sélectionnez un expert.';msg.style.display='block';} return;} await window.saveFicheClient(); if(msg){msg.textContent='✅ Expert assigné : fiche et rubrique Experts & portefeuilles synchronisées.';msg.className='adm-msg adm-msg-ok';msg.style.display='block';} try{ if(window.loadExperts) await window.loadExperts(); }catch(e){} }
  document.addEventListener('DOMContentLoaded',ensureExpertSelect);
})();
