/**
 * POPE Online — V64 targeted fix
 * Correctif chirurgical : retour APP étape 2, domaine non restauré au login,
 * suppression anti-flash bloquant, navigation native 1→4 et étape 3 enrichie.
 */
(function(){
  'use strict';
  var isPrivate = /dashboard-private\.html/i.test(location.pathname);
  var STATE_KEYS = [
    'pope_v61_state_' + (isPrivate ? 'private' : 'public'),
    'pope_v60_state_' + (isPrivate ? 'priv' : 'pub'),
    'pope_v58_state_' + (isPrivate ? 'private' : 'public')
  ];
  function $(id){ return document.getElementById(id); }
  function read(k){ try{ var r=sessionStorage.getItem(k)||localStorage.getItem(k); return r?JSON.parse(r):{}; }catch(e){ return {}; } }
  function write(k,obj){ try{ var s=JSON.stringify(obj||{}); sessionStorage.setItem(k,s); localStorage.setItem(k,s); }catch(e){} }
  function readState(){ for(var i=0;i<STATE_KEYS.length;i++){ var s=read(STATE_KEYS[i]); if(s && Object.keys(s).length) return s; } return {}; }
  function saveState(patch){
    var base=readState();
    var data=Object.assign({}, base, patch||{});
    STATE_KEYS.forEach(function(k){ write(k,data); });
    return data;
  }
  function removeAntiFlash(){ var st=$('v61-antiflash'); if(st && st.parentNode) st.parentNode.removeChild(st); }
  function clearDomainMemoryOnFreshLoad(){
    var sp=new URLSearchParams(location.search);
    var isReturn = sp.get('from')==='app' || sp.has('step') || sp.has('attach');
    if(isReturn) return;
    STATE_KEYS.forEach(function(k){
      var s=read(k); if(!s) return;
      delete s.domain; delete s.domainIcon; s.step=1;
      write(k,s);
    });
    try{ window._domain=''; if(typeof _domain!=='undefined') _domain=''; }catch(e){}
    document.querySelectorAll('.v5-domain-pill').forEach(function(b){ b.classList.remove('selected'); });
    ['v58DomainBadge','selectedDomainBadge'].forEach(function(id){ var e=$(id); if(e) e.style.display='none'; });
    ['v58DomainName','selectedDomainLabel'].forEach(function(id){ var e=$(id); if(e) e.textContent=''; });
  }
  function getSelectedDomain(){
    var s=readState();
    if(s.domain) return {domain:s.domain, icon:s.domainIcon || '🎯'};
    var btn=document.querySelector('.v5-domain-pill.selected');
    if(btn) return {domain:btn.getAttribute('data-domain')||'', icon:(btn.textContent||'').trim().split(/\s+/)[0]||'🎯'};
    return {domain:'', icon:'🎯'};
  }
  function applyDomain(domain, icon){
    if(!domain) return;
    try{ window._domain=domain; if(typeof _domain!=='undefined') _domain=domain; }catch(e){}
    document.querySelectorAll('.v5-domain-pill').forEach(function(b){ b.classList.toggle('selected', b.getAttribute('data-domain')===domain); });
    var badge=$('v58DomainBadge'), nm=$('v58DomainName'), ic=$('v58DomainIcon');
    if(badge){ badge.style.display='flex'; badge.classList.add('visible'); }
    if(nm) nm.textContent=domain;
    if(ic) ic.textContent=icon||'🎯';
    var badge2=$('selectedDomainBadge'), nm2=$('selectedDomainLabel'), ic2=$('selectedDomainIcon');
    if(badge2) badge2.style.display='block';
    if(nm2) nm2.textContent=domain;
    if(ic2) ic2.textContent=icon||'🎯';
    saveState({domain:domain, domainIcon:icon||'🎯'});
  }
  function forcePanel(n){
    removeAntiFlash();
    n=parseInt(n,10)||1;
    document.querySelectorAll('.v5-step-panel').forEach(function(p){
      var active=p.id==='step-panel-'+n;
      p.classList.toggle('active', active);
      p.style.display=active?'block':'none';
      p.style.visibility=active?'visible':'hidden';
      p.style.opacity=active?'1':'0';
    });
    document.querySelectorAll('.v5-step').forEach(function(s){
      var sn=parseInt(s.dataset.step,10);
      s.classList.toggle('active', sn===n);
      s.classList.toggle('done', sn<n);
    });
    try{ window._step=n; if(typeof _step!=='undefined') _step=n; }catch(e){}
    saveState({step:n});
  }
  function hydrateStep3Minimum(){
    var p=$('step-panel-3'); if(!p) return;
    var sel=$('archiveAttachSelect');
    if(sel && sel.options.length<=1){
      var gens=[];
      try{ gens=JSON.parse(localStorage.getItem('pope_v54_generations')||'[]'); }catch(e){}
      if(!gens.length){ try{ gens=JSON.parse(localStorage.getItem('pope_v53_generations')||'[]'); }catch(e){} }
      var html='<option value="">Ne pas joindre de draft préparé</option>';
      gens.forEach(function(g,i){
        var id=String(g.id!=null?g.id:i);
        var label=(g.title||g.usecaseLabel||g.name||('Draft IA '+(i+1)));
        html += '<option value="'+id.replace(/"/g,'&quot;')+'">'+label.replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];})+'</option>';
      });
      sel.innerHTML=html;
    }
    var vault=$('vaultExpertList');
    if(vault && (!vault.innerHTML || /Aucune pièce disponible/i.test(vault.textContent))){
      vault.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"><span style="color:#64748b;font-size:12px">Aucune pièce détectée dans le dépôt sécurisé — optionnel.</span><a href="vault.html?space='+(isPrivate?'private':'public')+'&return='+(isPrivate?'dashboard-private.html':'dashboard.html')+'%3Fstep%3D3" style="font-size:12px;font-weight:700;color:#0079c1;white-space:nowrap">📂 Déposer des pièces →</a></div>';
    }
    var lnk=$('lnkDraftStep3'); if(lnk) lnk.href=(isPrivate?'app-private.html':'app.html')+'?from=dashboard&step=2';
  }
  function robustGoStep(n){
    n=parseInt(n,10)||1;
    if(n>1){
      var d=getSelectedDomain();
      if(!d.domain){ forcePanel(1); return; }
      applyDomain(d.domain,d.icon);
    }
    if(window.__pope_v64_base_goStep && window.__pope_v64_base_goStep !== robustGoStep){
      try{ window.__pope_v64_base_goStep(n); }catch(e){ console.warn('[POPE V64] base goStep error', e); }
    }
    forcePanel(n);
    if(n===3){
      try{ if(typeof window.populateGenerationSelect==='function') window.populateGenerationSelect(); }catch(e){}
      hydrateStep3Minimum();
    }
    if(n===4 && typeof window.updateRecap==='function'){ try{ window.updateRecap(); }catch(e){} }
  }
  function patchSelectDomain(){
    if(window.__pope_v64_select_patched) return;
    window.__pope_v64_select_patched=true;
    var base=window.selectDomain;
    window.selectDomain=function(btn){
      if(base){ try{ base(btn); }catch(e){} }
      var domain=btn && btn.getAttribute('data-domain');
      var icon=btn && (btn.textContent||'').trim().split(/\s+/)[0];
      if(domain) applyDomain(domain, icon||'🎯');
    };
    document.addEventListener('click',function(e){
      var b=e.target && e.target.closest ? e.target.closest('.v5-domain-pill') : null;
      if(!b) return;
      setTimeout(function(){ applyDomain(b.getAttribute('data-domain'), (b.textContent||'').trim().split(/\s+/)[0]||'🎯'); },0);
    }, true);
  }
  function patchGoStep(){
    if(window.goStep !== robustGoStep) window.__pope_v64_base_goStep = window.goStep;
    window.goStep = robustGoStep;
  }
  function handleInitialRoute(){
    removeAntiFlash();
    var sp=new URLSearchParams(location.search);
    clearDomainMemoryOnFreshLoad();
    if(sp.get('from')==='app'){
      var s=readState();
      if(s.domain) applyDomain(s.domain, s.domainIcon||'🎯');
      forcePanel(2);
      return;
    }
    var step=parseInt(sp.get('step')||'0',10);
    if(step>=1 && step<=4){
      var d=getSelectedDomain(); if(d.domain) applyDomain(d.domain,d.icon);
      robustGoStep(step);
      return;
    }
    forcePanel(1);
  }
  function init(){
    patchSelectDomain(); patchGoStep(); handleInitialRoute();
    // Les anciens scripts repatchent parfois tardivement goStep : on reprend la main sans changer l'état.
    setTimeout(function(){ patchSelectDomain(); patchGoStep(); }, 800);
    setTimeout(function(){ patchSelectDomain(); patchGoStep(); }, 1600);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(init, 250); });
  else setTimeout(init, 250);
})();
