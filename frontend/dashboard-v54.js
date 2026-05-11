// Dashboard V5.7 — state persistence + retour étape précise + UX description améliorée
(function(){
  function byId(id){return document.getElementById(id);}
  function qsa(s){return Array.prototype.slice.call(document.querySelectorAll(s));}
  function esc(s){return String(s||'').replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function dashUrl(){return /dashboard-private\.html/i.test(location.pathname)?'dashboard-private.html':'dashboard.html';}
  var STATE_KEY = 'pope_v57_state_' + (location.pathname.indexOf('private')>-1?'private':'public');

  // ── CSS injection ───────────────────────────────────────────
  function injectStyle(){
    if(byId('v57style'))return;
    var st=document.createElement('style'); st.id='v57style';
    st.textContent=[
      /* Hide old app/expert nav links */
      '.v5-top-nav a[href*="app"],.v5-top-nav a[href*="expert"],.v40-topbar-nav a[href*="app"],.v40-topbar-nav a[href*="expert"]{display:none!important}',
      /* Accordion description */
      '.v57-acc{border:1.5px solid #dce8f5;border-radius:14px;overflow:hidden;margin:0 0 14px;}',
      '.v57-acc-hd{display:flex;align-items:center;gap:10px;padding:13px 16px;background:#f8fbff;cursor:pointer;border:none;width:100%;text-align:left;font-family:inherit;}',
      '.v57-acc-hd:hover{background:#eef5fd;}',
      '.v57-acc-icon{font-size:16px;flex-shrink:0;}',
      '.v57-acc-label{flex:1;font-size:13px;font-weight:700;color:#0b2440;}',
      '.v57-acc-preview{font-size:11px;color:#516474;max-width:260px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;}',
      '.v57-acc-arrow{font-size:11px;color:#8aa0b5;transition:transform .2s;}',
      '.v57-acc.open .v57-acc-arrow{transform:rotate(90deg);}',
      '.v57-acc-body{display:none;padding:14px 16px;border-top:1px solid #e8eff7;background:#fff;}',
      '.v57-acc.open .v57-acc-body{display:block;}',
      '.v57-field{margin-bottom:12px;}',
      '.v57-field:last-child{margin-bottom:0;}',
      '.v57-field label{display:block;font-size:12px;font-weight:700;color:#1a3a5c;margin-bottom:5px;}',
      '.v57-field textarea,.v57-field input{width:100%;box-sizing:border-box;border:1.5px solid #dce8f5;border-radius:9px;padding:9px 12px;font-size:13px;color:#0b2440;background:#fff;font-family:inherit;resize:vertical;}',
      '.v57-field textarea:focus,.v57-field input:focus{outline:none;border-color:#2563eb;box-shadow:0 0 0 3px #dbeafe;}',
      '.v57-fill-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#22c55e;margin-left:6px;vertical-align:middle;}',
      /* Traitement cards */
      '.v57-trt-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0;}',
      '.v57-trt-card{display:flex;align-items:flex-start;gap:10px;border:1.5px solid #dce8f5;border-radius:12px;padding:13px;cursor:pointer;background:#fff;transition:border-color .15s,background .15s;}',
      '.v57-trt-card:has(input:checked){border-color:#2563eb;background:#eff6ff;}',
      '.v57-trt-card input{margin-top:2px;accent-color:#2563eb;flex-shrink:0;}',
      '.v57-trt-card strong{display:block;font-size:13px;font-weight:700;color:#0b2440;margin-bottom:3px;}',
      '.v57-trt-card span{display:block;font-size:11px;color:#516474;line-height:1.4;}',
      /* Draft block */
      '.v57-draft{display:flex;align-items:center;gap:12px;background:#f0f8ff;border:1.5px solid #c0d8f0;border-radius:12px;padding:13px 16px;margin:14px 0;}',
      '.v57-draft-body{flex:1;}',
      '.v57-draft-body strong{font-size:13px;font-weight:800;color:#0b2440;}',
      '.v57-draft-body p{font-size:12px;color:#516474;margin:3px 0 0;line-height:1.4;}',
      '.v57-draft-cta{background:#2563eb;color:#fff;border-radius:8px;padding:9px 16px;font-size:13px;font-weight:700;text-decoration:none;white-space:nowrap;flex-shrink:0;}',
      '.v57-draft-cta:hover{background:#1d4ed8;}',
      /* attach-head */
      '.v5-attach-head strong{font-size:14px;}',
      '@media(max-width:720px){.v57-trt-grid{grid-template-columns:1fr!important;}.v57-draft{flex-wrap:wrap;}}'
    ].join('');
    document.head.appendChild(st);
  }

  // ── Accordion UX ────────────────────────────────────────────
  function buildAccordionDesc(){
    var container = byId('v57DescContainer');
    if(!container || byId('v57AccBuilt')) return;
    container.setAttribute('id','v57DescContainer');
    container.innerHTML = [
      acc('v57AccCtx','🏢','Contexte & organisation','Qui vous êtes, votre structure…',
        field('descContexte','textarea','Qui vous êtes, votre structure, le cadre de la demande, l\'organisme concerné…',3)),
      acc('v57AccObj','🎯','Objectif & résultat attendu','Ce que vous attendez de l\'expert…',
        field('descObjectif','textarea','Ce que vous attendez de l\'expert : décision à prendre, sécurisation, réponse à formuler…',3)),
      acc('v57AccCon','⚠️','Contraintes & points sensibles','Risques, délais, confidentialité…',
        field('descContraintes','textarea','Contraintes légales, politiques, budgétaires, risques identifiés, niveau de sensibilité…',3)),
      acc('v57AccAct','👥','Acteurs & échéance','Parties prenantes, délais',
        field('descActeurs','input','Élu, DG, prestataire, usager, partenaire…') +
        field('needDeadline','input','Échéance : avant vendredi / sous 10 jours / avant le CA du 15…')),
      acc('v57AccPlus','💬','Précisions complémentaires','Éléments de contexte additionnels…',
        field('descPieces','input','Pièces disponibles : contrat, rapport, délibération, devis…') +
        field('besoInDesc','textarea','Historique, tentatives précédentes, niveau de détail souhaité…',3))
    ].join('');
    // Mark as built
    var m=document.createElement('span'); m.id='v57AccBuilt'; m.hidden=true; container.appendChild(m);
    // Restore values from state before binding
    restoreStep2State();
    // Bind accordion toggles
    container.querySelectorAll('.v57-acc-hd').forEach(function(hd){
      hd.addEventListener('click',function(){
        var acc=hd.closest('.v57-acc');
        acc.classList.toggle('open');
        updatePreviews();
      });
    });
    // Open first accordion by default if empty
    var first=container.querySelector('.v57-acc');
    if(first && !first.classList.contains('open')) first.classList.add('open');
    // Live preview updates + state save
    container.addEventListener('input',function(){updatePreviews();saveStep2State();});
  }

  function acc(id,icon,label,hint,body){
    return '<div class="v57-acc" id="'+id+'">'+
      '<button type="button" class="v57-acc-hd">'+
        '<span class="v57-acc-icon">'+icon+'</span>'+
        '<span class="v57-acc-label">'+label+'</span>'+
        '<span class="v57-acc-preview">'+hint+'</span>'+
        '<span class="v57-acc-arrow">▶</span>'+
      '</button>'+
      '<div class="v57-acc-body">'+body+'</div>'+
    '</div>';
  }

  function field(id, type, placeholder, rows){
    var el = type==='textarea'
      ? '<textarea class="" id="'+id+'" rows="'+(rows||3)+'" placeholder="'+placeholder+'"></textarea>'
      : '<input class="" id="'+id+'" placeholder="'+placeholder+'"/>';
    return '<div class="v57-field">'+el+'</div>';
  }

  function updatePreviews(){
    var map = {
      v57AccCtx:'descContexte', v57AccObj:'descObjectif',
      v57AccCon:'descContraintes', v57AccAct:'descActeurs',
      v57AccPlus:'descPieces'
    };
    Object.keys(map).forEach(function(accId){
      var acc=byId(accId); if(!acc)return;
      var inp=byId(map[accId]); if(!inp)return;
      var val=inp.value.trim();
      var prev=acc.querySelector('.v57-acc-preview');
      if(prev) prev.textContent = val || acc.querySelector('.v57-acc-label').textContent.split('&')[0].trim()+'…';
      // Add green dot when filled
      var lbl=acc.querySelector('.v57-acc-label');
      var dot=lbl.querySelector('.v57-fill-dot');
      if(val){
        if(!dot){dot=document.createElement('span');dot.className='v57-fill-dot';lbl.appendChild(dot);}
      } else {
        if(dot) dot.remove();
      }
    });
  }

  // ── Persist state ─────────────────────────────────────────
  function saveStep2State(){
    try{
      var data = {
        domain: (qsa('.v5-domain-pill.selected')[0]||{}).dataset&&qsa('.v5-domain-pill.selected')[0].dataset.domain || '',
        title: (byId('besoInTitle')||{}).value||'',
        contexte:(byId('descContexte')||{}).value||'',
        objectif:(byId('descObjectif')||{}).value||'',
        contraintes:(byId('descContraintes')||{}).value||'',
        acteurs:(byId('descActeurs')||{}).value||'',
        deadline:(byId('needDeadline')||{}).value||'',
        pieces:(byId('descPieces')||{}).value||'',
        desc:(byId('besoInDesc')||{}).value||'',
        type:(document.querySelector('input[name="besoType"]:checked')||{}).value||'conseil',
        step: window._step||1
      };
      sessionStorage.setItem(STATE_KEY, JSON.stringify(data));
      // Also to localStorage for cross-tab persistence
      localStorage.setItem(STATE_KEY, JSON.stringify(data));
    }catch(e){}
  }

  function restoreStep2State(){
    try{
      var raw = sessionStorage.getItem(STATE_KEY) || localStorage.getItem(STATE_KEY);
      if(!raw) return false;
      var d = JSON.parse(raw);
      // Restore domain first (critical for goStep guard)
      if(d.domain){
        qsa('.v5-domain-pill').forEach(function(b){
          if(b.dataset.domain===d.domain){
            b.classList.add('selected');
            if(window._domain !== d.domain) window._domain = d.domain;
            // Update badge
            var badge=byId('selectedDomainBadge');
            var label=byId('selectedDomainLabel');
            var icon=byId('selectedDomainIcon');
            if(badge){badge.style.display='block';}
            if(label){label.textContent=d.domain;}
            if(icon){icon.textContent=b.textContent.trim().split(' ')[0]||'🎯';}
          }
        });
      }
      // Restore field values
      [['besoInTitle','title'],['besoInDesc','desc'],['descContexte','contexte'],
       ['descObjectif','objectif'],['descContraintes','contraintes'],
       ['descActeurs','acteurs'],['needDeadline','deadline'],['descPieces','pieces']
      ].forEach(function(x){
        var e=byId(x[0]);
        if(e && d[x[1]]) e.value=d[x[1]];
      });
      var r=document.querySelector('input[name="besoType"][value="'+(d.type||'conseil')+'"]');
      if(r) r.checked=true;
      updatePreviews();
      return !!(d.domain);
    }catch(e){ return false; }
  }

  // ── Draft links ───────────────────────────────────────────
  function improveDraftLinks(){
    qsa('a[href="app.html"],a[href="app-private.html"],a[id="lnkDraftTool"],#v57DraftCTA').forEach(function(a){
      var base=a.getAttribute('href').split('?')[0];
      a.href=base+'?from=dashboard-step2';
      a.addEventListener('click',function(){ saveStep2State(); });
    });
  }

  // ── Generations for step 3 ────────────────────────────────
  function loadLocalGenerations(){
    try{return JSON.parse(localStorage.getItem('pope_v54_generations')||localStorage.getItem('pope_v53_generations')||'[]');}
    catch(e){return[];}
  }

  function populateGenerationSelect(){
    var sel=byId('archiveAttachSelect'); if(!sel)return;
    var gens=loadLocalGenerations();
    var cur=sel.value||sessionStorage.getItem('pope_v54_last_generation_id')||'';
    sel.innerHTML='<option value="">Ne pas joindre de draft préparé</option>'+
      gens.map(function(g,i){
        return '<option value="'+esc(g.id||i)+'">'+esc((g.title||g.usecaseLabel||'Draft préparé')+' — '+(g.createdAt?new Date(g.createdAt).toLocaleString('fr-FR'):''))+'</option>';
      }).join('');
    if(cur) sel.value=cur;
  }

  // ── Event bindings ────────────────────────────────────────
  document.addEventListener('input', saveStep2State, true);
  document.addEventListener('change', function(e){
    saveStep2State();
    if(e.target&&e.target.id==='archiveAttachSelect')
      sessionStorage.setItem('pope_v54_attached_generation_id', e.target.value||'');
  }, true);

  // ── Wrap goStep for state-aware navigation ─────────────────
  var _origGoStep = null;
  function patchGoStep(){
    if(_origGoStep) return;
    _origGoStep = window.goStep;
    window.goStep = function(n, force){
      // If going to step 2+, ensure domain is set
      if(n > 1 && !window._domain && !force){
        // Try restoring state first
        var restored = restoreStep2State();
        if(!restored){
          // flash the domain grid
          var g=byId('domainGrid');
          if(g){g.style.boxShadow='0 0 0 3px #ef4444';g.style.borderRadius='14px';setTimeout(function(){g.style.boxShadow='';g.style.borderRadius='';},1500);}
          return;
        }
      }
      if(_origGoStep) _origGoStep(n);
      // After step change
      setTimeout(function(){
        injectStyle();
        improveDraftLinks();
        buildAccordionDesc();
        if(n===3) populateGenerationSelect();
        saveStep2State();
      }, 50);
    };
  }

  // ── Init ──────────────────────────────────────────────────
  function init(){
    injectStyle();
    improveDraftLinks();
    buildAccordionDesc();
    restoreStep2State();
    populateGenerationSelect();

    var sp = new URLSearchParams(location.search);
    var fromApp = sp.get('from') === 'app';
    var attachLast = sp.get('attach') === 'last';
    var stepParam = parseInt(sp.get('step')||'0',10);

    if(attachLast || stepParam){
      // Small delay to let the page fully initialise
      setTimeout(function(){
        if(window.switchTab) window.switchTab('besoin');
        var restored = restoreStep2State();
        var targetStep = stepParam || (fromApp ? 2 : 3);
        if(restored || targetStep===3){
          if(window.goStep) window.goStep(targetStep, true);
        }
        populateGenerationSelect();
        var lastGen = sessionStorage.getItem('pope_v54_last_generation_id')||'';
        if(lastGen) sessionStorage.setItem('pope_v54_attached_generation_id', lastGen);
      }, 300);
    } else if(fromApp){
      setTimeout(function(){
        if(window.switchTab) window.switchTab('besoin');
        restoreStep2State();
        if(window.goStep) window.goStep(2, true);
      }, 300);
    }
  }

  document.addEventListener('DOMContentLoaded', function(){ patchGoStep(); init(); });
  // Also patch immediately if DOMContentLoaded already fired
  if(document.readyState !== 'loading'){ patchGoStep(); setTimeout(init, 100); }
  injectStyle();
  setTimeout(function(){ improveDraftLinks(); buildAccordionDesc(); populateGenerationSelect(); }, 400);
})();
