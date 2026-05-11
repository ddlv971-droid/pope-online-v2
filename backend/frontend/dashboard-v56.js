
(function(){
  'use strict';
  const isPrivate = /dashboard-private\.html/i.test(location.pathname);
  const space = isPrivate ? 'private' : 'public';
  const dash = isPrivate ? 'dashboard-private.html' : 'dashboard.html';
  const app = isPrivate ? 'app-private.html' : 'app.html';
  const stateKey = 'pope_v56_need_state_' + space;
  const draftKey = 'pope_v56_drafts_' + space;
  const $ = (s,root=document)=>root.querySelector(s);
  const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));
  function val(id){ const n=document.getElementById(id); return n?n.value:''; }
  function setVal(id,v){ const n=document.getElementById(id); if(n && v!=null) n.value=v; }
  function selectedDomain(){ return $('.v5-domain-pill.selected')?.dataset?.domain || JSON.parse(localStorage.getItem(stateKey)||'{}').domain || ''; }
  function removeObsoleteHeaderButtons(){
    $$('.v40-topbar-nav a,.v40-topbar-nav button,#v40MobileMenu a,#v40MobileMenu button').forEach(n=>{
      const t=(n.textContent||'').toLowerCase(); const href=(n.getAttribute('href')||'').toLowerCase();
      if(t.includes('générer') || t.includes('generer') || t.includes('conseil expert') || href.includes('expert')) n.remove();
    });
  }
  function addDomainBadge(){
    const head = $('#step-panel-2 .v5-panel-head'); if(!head) return;
    let b = $('#v56DomainBadge');
    if(!b){ b=document.createElement('div'); b.id='v56DomainBadge'; b.className='v56-domain-badge'; head.appendChild(b); }
    const d=selectedDomain(); b.innerHTML = d ? 'Domaine sélectionné : <strong>'+esc(d)+'</strong>' : 'Domaine sélectionné : <strong>à préciser</strong>';
  }
  function esc(s){ return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function saveState(){
    const domainsel=selectedDomain();
    const data={space,domain:domainsel,title:val('besoInTitle'),desc:val('besoInDesc'),
      contexte:val('v56Contexte'),objectifs:val('v56Objectifs'),contraintes:val('v56Contraintes'),points:val('v56Points'),decisions:val('v56Decisions'),detail:val('v56Detail'),urgence:val('v56Urgence'),acteurs:val('v56Acteurs'),pieces:val('v56Pieces'),attentes:val('v56Attentes'),
      echeance:val('besoEcheance'),livrable:val('besoLivrable'),publicConcerne:val('besoPublic'),urgenceSelect:val('besoUrgence'),sensibilite:val('besoSensibilite'),decisionAttendue:val('besoDecision'),type:document.querySelector('input[name="besoType"]:checked')?.value||'conseil'};
    localStorage.setItem(stateKey, JSON.stringify(data));
  }
  function restoreState(){
    let d={}; try{d=JSON.parse(localStorage.getItem(stateKey)||'{}')}catch(e){}
    if(d.domain){ $$('.v5-domain-pill').forEach(b=>b.classList.toggle('selected', b.dataset.domain===d.domain)); }
    setVal('besoInTitle',d.title); setVal('besoInDesc',d.desc);
    ['Contexte','Objectifs','Contraintes','Points','Decisions','Detail','Urgence','Acteurs','Pieces','Attentes'].forEach(k=>setVal('v56'+k,d[k.toLowerCase()]));
    setVal('besoEcheance',d.echeance); setVal('besoLivrable',d.livrable); setVal('besoPublic',d.publicConcerne); setVal('besoUrgence',d.urgenceSelect); setVal('besoSensibilite',d.sensibilite); setVal('besoDecision',d.decisionAttendue);
    if(d.type){ const r=document.querySelector('input[name="besoType"][value="'+d.type+'"]'); if(r) r.checked=true; }
    addDomainBadge();
  }
  function refactorDescription(){
    $$('#v54InlineHelp,.v5-helpchips,.v54-help-chip').forEach(n=>n.remove());
    const desc=document.getElementById('besoInDesc'); if(!desc || document.getElementById('v56QualificationGrid')) return;
    desc.placeholder='Synthèse libre du besoin, en complément des champs structurés ci-dessous.';
    const box=document.createElement('div'); box.id='v56QualificationGrid'; box.className='v56-qualification-grid';
    box.innerHTML=`
      <div class="v56-full"><strong>Assistant de qualification du besoin</strong><p>Renseignez les éléments clés : un besoin précis permet à l’expert de répondre vite, utilement et sans allers-retours inutiles.</p></div>
      <label>Contexte<input id="v56Contexte" placeholder="Situation, historique, cadre juridique ou opérationnel…"></label>
      <label>Objectifs<input id="v56Objectifs" placeholder="Ce que vous voulez obtenir ou sécuriser…"></label>
      <label>Contraintes<input id="v56Contraintes" placeholder="Délais, budget, instances, procédure, confidentialité…"></label>
      <label>Points sensibles<input id="v56Points" placeholder="Risques, blocages, tensions, alertes, contentieux…"></label>
      <label>Décisions attendues<input id="v56Decisions" placeholder="Valider, arbitrer, répondre, notifier, lancer…"></label>
      <label>Niveau de détail souhaité<select id="v56Detail"><option value="">À préciser</option><option>Synthèse courte</option><option>Analyse argumentée</option><option>Note complète</option><option>Plan d’action opérationnel</option></select></label>
      <label>Urgence<input id="v56Urgence" placeholder="Avant vendredi, sous 48h, pour une réunion…"></label>
      <label>Acteurs concernés<input id="v56Acteurs" placeholder="Élu, DG, client, prestataire, service, avocat…"></label>
      <label>Pièces disponibles<input id="v56Pieces" placeholder="Contrat, DCE, courrier, note, tableau, délibération…"></label>
      <label>Attentes finales<input id="v56Attentes" placeholder="Livrable, recommandation, trame, courrier, arbitrage…"></label>`;
    desc.insertAdjacentElement('afterend', box);
  }
  function refactorNature(){
    const label=$$('label.v5-label').find(l=>(l.textContent||'').toLowerCase().includes('nature du traitement')); if(!label) return;
    const group=label.closest('.v5-field-group'); if(!group) return;
    group.classList.add('v56-nature-block');
    group.innerHTML=`<label class="v5-label">Nature du traitement attendu</label>
      <div class="v56-choice-grid">
        <label class="v56-choice-card"><input type="radio" name="besoType" value="conseil" checked><div><strong>🎯 Avis expert ponctuel</strong><span>Réponse ciblée, sécurisation ou recommandation sous 48h ouvrées.</span></div></label>
        <label class="v56-choice-card"><input type="radio" name="besoType" value="surmesure"><div><strong>📋 Accompagnement approfondi</strong><span>Dossier sensible, multi-acteurs, stratégique ou nécessitant un cadrage complet.</span></div></label>
      </div>
      <div class="v56-note">À préciser dans les champs ci-dessus : enjeu principal, décision attendue, pièces disponibles, acteurs, délai, contraintes et points sensibles.</div>`;
  }
  function wireAppLinks(){
    $$('a[href="'+app+'"],a[href^="'+app+'?"]').forEach(a=>{
      a.href=app+'?from=dashboard&space='+space+'&returnStep=2';
      a.addEventListener('click', saveState);
    });
  }
  function fillDraftSelect(){
    const sel=document.getElementById('archiveAttachSelect'); if(!sel) return;
    let drafts=[]; try{drafts=JSON.parse(localStorage.getItem(draftKey)||'[]')}catch(e){}
    sel.innerHTML='<option value="">Aucun draft sélectionné</option>'+drafts.slice().reverse().map(d=>`<option value="${esc(d.id)}">${esc(d.title||d.usecaseLabel||'Draft')} — ${new Date(d.createdAt||Date.now()).toLocaleString('fr-FR')}</option>`).join('');
    const params=new URLSearchParams(location.search); if(params.get('attach')==='last' && drafts.length){ sel.value=drafts[drafts.length-1].id; }
  }
  function installCss(){ if($('#v56DashboardCss')) return; const st=document.createElement('style'); st.id='v56DashboardCss'; st.textContent=`
    .v56-domain-badge{display:inline-flex;margin-top:10px;padding:8px 12px;border:1px solid #bcd7ee;border-radius:999px;background:#f2f8ff;color:#0b4778;font-size:13px}.v56-qualification-grid{margin-top:14px;border:1px solid #dbe7f2;border-radius:16px;padding:16px;background:#fbfdff;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.v56-qualification-grid label{font-size:12px;font-weight:800;color:#10233d;display:flex;flex-direction:column;gap:6px}.v56-qualification-grid input,.v56-qualification-grid select{width:100%;border:1px solid #d1deeb;border-radius:10px;padding:10px 11px;background:#fff;color:#10233d}.v56-full{grid-column:1/-1}.v56-full strong{font-size:16px}.v56-full p,.v56-note{margin:4px 0 0;color:#5b6b7c;font-size:12px}.v56-choice-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:10px}.v56-choice-card{display:flex!important;align-items:flex-start;gap:12px;border:1.5px solid #d8e6f3;border-radius:16px;background:#fff;padding:16px;min-height:92px;cursor:pointer}.v56-choice-card input{width:18px;height:18px;margin-top:3px;flex:0 0 auto}.v56-choice-card div{display:flex;flex-direction:column;gap:6px;min-width:0}.v56-choice-card span{font-size:12px;color:#5b6b7c;line-height:1.35}.v56-choice-card:has(input:checked){border-color:#008bd2;box-shadow:0 0 0 3px rgba(0,139,210,.12)}@media(max-width:760px){.v56-qualification-grid,.v56-choice-grid{grid-template-columns:1fr}.v56-choice-card{min-height:auto}}`;
    document.head.appendChild(st);
  }
  function patchFunctions(){
    const oldSelect=window.selectDomain; window.selectDomain=function(btn){ if(typeof oldSelect==='function') oldSelect(btn); $$('.v5-domain-pill').forEach(b=>b.classList.remove('selected')); if(btn) btn.classList.add('selected'); saveState(); addDomainBadge(); };
    const oldGo=window.goStep; window.goStep=function(n){ saveState(); if(typeof oldGo==='function') oldGo(n); addDomainBadge(); if(Number(n)===3) fillDraftSelect(); };
    document.addEventListener('input', e=>{ if(e.target.closest('#step-panel-2')) saveState(); });
    document.addEventListener('change', e=>{ if(e.target.closest('#step-panel-2')||e.target.name==='besoType') saveState(); });
  }
  function init(){ removeObsoleteHeaderButtons(); installCss(); refactorDescription(); refactorNature(); wireAppLinks(); patchFunctions(); restoreState(); fillDraftSelect(); const params=new URLSearchParams(location.search); if(params.get('returnStep')==='2' || params.get('from')==='app'){ setTimeout(()=>window.goStep&&window.goStep(2),100); } }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
