
/**
 * POPE Online — V65 correctif final Step 3 / panels
 * Base : V64 stable. Objectif : enrichir le VRAI panneau #step-panel-3
 * sans injecter dans l'indicateur d'étape [data-step="3"] et sans modifier le backend.
 */
(function(){
  'use strict';
  var isPrivate = /dashboard-private\.html/i.test(location.pathname);
  var DASH_URL = isPrivate ? 'dashboard-private.html' : 'dashboard.html';
  var APP_URL = isPrivate ? 'app-private.html' : 'app.html';
  var VAULT_SPACE = isPrivate ? 'private' : 'public';
  var baseGoStep = window.goStep;

  function $(id){ return document.getElementById(id); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function readJson(key){ try{ var r = localStorage.getItem(key) || sessionStorage.getItem(key); return r ? JSON.parse(r) : null; }catch(e){ return null; } }
  function writeJson(key, val){ try{ var s = JSON.stringify(val || []); localStorage.setItem(key, s); sessionStorage.setItem(key, s); }catch(e){} }

  function loadGenerations(){
    var keys = [
      'pope_v54_generations', 'pope_v53_generations', 'pope_generations',
      'pope_v61_generations', 'pope_ai_generations', 'pope_drafts'
    ];
    for(var i=0;i<keys.length;i++){
      var v = readJson(keys[i]);
      if(Array.isArray(v) && v.length) return v;
    }
    return [];
  }

  function exclusivePanel(n){
    n = parseInt(n,10) || 1;
    var anti = $('v61-antiflash');
    if(anti && anti.parentNode) anti.parentNode.removeChild(anti);
    document.querySelectorAll('.v5-step-panel').forEach(function(panel){
      var active = panel.id === 'step-panel-' + n;
      panel.classList.toggle('active', active);
      panel.style.display = active ? 'block' : 'none';
      panel.style.visibility = active ? 'visible' : 'hidden';
      panel.style.opacity = active ? '1' : '0';
      panel.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
    document.querySelectorAll('.v5-step').forEach(function(step){
      var sn = parseInt(step.getAttribute('data-step') || '0', 10);
      step.classList.toggle('active', sn === n);
      step.classList.toggle('done', sn > 0 && sn < n);
    });
    try{ window._step = n; if(typeof _step !== 'undefined') _step = n; }catch(e){}
  }

  function getDraftLabel(g, i){
    return g.title || g.usecaseLabel || g.name || g.subject || ('Draft IA ' + (i+1));
  }

  function populateDrafts(){
    var sel = $('archiveAttachSelect');
    if(!sel) return;
    var gens = loadGenerations();
    var selected = sessionStorage.getItem('pope_v61_attached_gen') || sessionStorage.getItem('pope_v58_attached_gen') || sessionStorage.getItem('pope_v54_last_generation_id') || '';
    sel.innerHTML = '<option value="">Ne pas joindre de draft préparé</option>' + gens.map(function(g,i){
      var id = String(g.id != null ? g.id : i);
      var suffix = g.createdAt ? ' — ' + new Date(g.createdAt).toLocaleString('fr-FR') : '';
      return '<option value="' + esc(id) + '">' + esc(getDraftLabel(g,i) + suffix) + '</option>';
    }).join('');
    if(selected) sel.value = selected;
    sel.onchange = function(){
      sessionStorage.setItem('pope_v61_attached_gen', sel.value || '');
      sessionStorage.setItem('pope_v58_attached_gen', sel.value || '');
    };
    var status = $('v59DraftStatus');
    if(status){
      status.style.display = (gens.length && sel.value) ? 'block' : 'none';
      status.textContent = (gens.length && sel.value) ? '✅ Draft disponible et sélectionné' : '';
    }
    var msg = $('v65NoDraftMsg');
    if(!msg && !gens.length){
      msg = document.createElement('p');
      msg.id = 'v65NoDraftMsg';
      msg.style.cssText = 'font-size:12px;color:#64748b;margin-top:8px;line-height:1.6';
      msg.innerHTML = "💡 Aucun draft IA n’est obligatoire. Vous pouvez transmettre directement votre besoin à l’expert.";
      sel.insertAdjacentElement('afterend', msg);
    } else if(msg && gens.length){
      msg.remove();
    }
    var lnk = $('lnkDraftStep3');
    if(lnk){ lnk.href = APP_URL + '?from=dashboard&step=2'; lnk.textContent = gens.length ? 'Voir / modifier le draft →' : 'Créer un draft optionnel →'; }
    var top = $('lnkDraftTool');
    if(top) top.href = APP_URL + '?from=dashboard&step=2';
  }

  function renderLocalFiles(){
    var list = $('v65LocalFilesList');
    if(!list) return;
    var files = readJson('pope_v65_local_files_' + (isPrivate ? 'private' : 'public')) || [];
    if(!files.length){
      list.innerHTML = '<div style="font-size:12px;color:#64748b">Aucun fichier sélectionné pour le moment.</div>';
      return;
    }
    list.innerHTML = files.map(function(f,i){
      return '<div class="v65-file-row" style="display:flex;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid #eef2f7">' +
        '<span>📄</span><span style="flex:1;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(f.name) + '</span>' +
        '<span style="font-size:11px;color:#64748b">' + esc(f.size || '') + '</span>' +
        '<button type="button" data-v65-remove="' + i + '" style="border:none;background:#f1f5f9;border-radius:8px;padding:5px 8px;cursor:pointer">Retirer</button>' +
      '</div>';
    }).join('');
    list.querySelectorAll('[data-v65-remove]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var idx = parseInt(btn.getAttribute('data-v65-remove'),10);
        var cur = readJson('pope_v65_local_files_' + (isPrivate ? 'private' : 'public')) || [];
        cur.splice(idx,1); writeJson('pope_v65_local_files_' + (isPrivate ? 'private' : 'public'), cur); renderLocalFiles();
      });
    });
  }

  function ensureUploadBox(){
    var panel = $('step-panel-3');
    if(!panel || $('v65UploadBox')) return;
    var box = document.createElement('div');
    box.id = 'v65UploadBox';
    box.className = 'v5-attach-box';
    box.style.cssText = 'border:1px dashed #cbd5e1;background:#f8fafc;margin-top:14px';
    box.innerHTML =
      '<div class="v5-attach-head">' +
        '<div class="v5-attach-ico">📎</div>' +
        '<div style="flex:1"><strong>Ajouter des pièces depuis votre ordinateur</strong>' +
        '<p>Ajoutez des fichiers utiles au cadrage de votre demande. La liste est conservée dans le parcours courant.</p></div>' +
      '</div>' +
      '<label id="v65DropZone" for="v65FileInput" style="display:block;border:2px dashed #cbd5e1;border-radius:14px;padding:18px;text-align:center;cursor:pointer;background:#fff;margin-top:12px">' +
        '<strong>Glissez-déposez vos fichiers ici</strong><br><span style="font-size:12px;color:#64748b">ou cliquez pour sélectionner des fichiers</span>' +
        '<input id="v65FileInput" type="file" multiple style="display:none" />' +
      '</label>' +
      '<div id="v65LocalFilesList" style="margin-top:12px"></div>';
    var footer = panel.querySelector('.v5-step-footer');
    if(footer) panel.insertBefore(box, footer); else panel.appendChild(box);

    var input = $('v65FileInput');
    var drop = $('v65DropZone');
    function addFiles(fileList){
      var cur = readJson('pope_v65_local_files_' + (isPrivate ? 'private' : 'public')) || [];
      Array.prototype.slice.call(fileList || []).forEach(function(file){
        cur.push({ name:file.name, size: file.size ? Math.ceil(file.size/1024) + ' Ko' : '' });
      });
      writeJson('pope_v65_local_files_' + (isPrivate ? 'private' : 'public'), cur);
      renderLocalFiles();
    }
    if(input) input.addEventListener('change', function(){ addFiles(input.files); input.value=''; });
    if(drop){
      ['dragenter','dragover'].forEach(function(ev){ drop.addEventListener(ev, function(e){ e.preventDefault(); drop.style.background='#eef6ff'; }); });
      ['dragleave','drop'].forEach(function(ev){ drop.addEventListener(ev, function(e){ e.preventDefault(); drop.style.background='#fff'; }); });
      drop.addEventListener('drop', function(e){ addFiles(e.dataTransfer && e.dataTransfer.files); });
    }
    renderLocalFiles();
  }

  function enrichStep3(){
    var panel = $('step-panel-3');
    if(!panel) return;
    populateDrafts();
    ensureUploadBox();
    var vault = $('vaultExpertList');
    if(vault && (!vault.textContent || /Aucune pièce disponible|Aucune pièce dans le dépôt/i.test(vault.textContent))){
      var returnUrl = encodeURIComponent(DASH_URL + '?step=3');
      vault.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">' +
        '<span style="color:#64748b;font-size:12px">Aucune pièce détectée dans le dépôt sécurisé — optionnel.</span>' +
        '<a href="vault.html?space=' + VAULT_SPACE + '&return=' + returnUrl + '" style="font-size:12px;font-weight:700;color:#0079c1;white-space:nowrap">📂 Déposer des pièces →</a>' +
      '</div>';
    }
  }

  function updateStep4LocalFiles(){
    var panel = $('step-panel-4'); if(!panel) return;
    var card = panel.querySelector('.v5-recap-card'); if(!card) return;
    var files = readJson('pope_v65_local_files_' + (isPrivate ? 'private' : 'public')) || [];
    var row = $('v65RecapLocalFiles');
    if(!row){
      row = document.createElement('div'); row.id = 'v65RecapLocalFiles'; row.className = 'v5-recap-row';
      card.appendChild(row);
    }
    row.innerHTML = '<span class="v5-recap-key">Fichiers ajoutés</span><span class="v5-recap-val">' + esc(files.length ? files.length + ' fichier(s) sélectionné(s)' : 'Aucun fichier ajouté') + '</span>';
  }

  function patchedGoStep(n){
    n = parseInt(n,10) || 1;
    if(baseGoStep && baseGoStep !== patchedGoStep){
      try{ baseGoStep(n); }catch(e){ console.warn('[POPE V65] goStep natif en erreur', e); }
    }
    exclusivePanel(n);
    if(n === 3) enrichStep3();
    if(n === 4) updateStep4LocalFiles();
  }

  function patch(){
    if(window.goStep !== patchedGoStep){ baseGoStep = window.goStep; window.goStep = patchedGoStep; }
    var step3 = $('step-panel-3'); if(step3 && step3.classList.contains('active')) enrichStep3();
    var step4 = $('step-panel-4'); if(step4 && step4.classList.contains('active')) updateStep4LocalFiles();
  }

  function init(){
    patch();
    setTimeout(patch, 500);
    setTimeout(patch, 1500);
    // Protection : ne jamais afficher un enrichissement en dehors du vrai panneau 3.
    document.querySelectorAll('.v5-step[data-step="3"] .pope-step3-native-enrichment, .v5-step[data-step="3"] #v65UploadBox').forEach(function(n){ n.remove(); });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
