
// v58: gestion dynamique barre retour
(function(){
  var DASH = 'dashboard.html';
  var STATE_KEY = 'pope_v58_state_public';
  function _init(){
    var gens=[]; try{gens=JSON.parse(localStorage.getItem('pope_v54_generations')||'[]');}catch(e){}
    var lastId = sessionStorage.getItem('pope_v54_last_generation_id') || (gens.length?gens[0].id:'');
    var btn    = document.getElementById('btnRetourDashboard');
    var badge  = document.getElementById('v58DraftReady');
    var info   = document.getElementById('v58RetourInfo');
    if(lastId && btn){
      btn.href = DASH + '?from=app&attach=last&step=2';
      if(badge) badge.classList.add('visible');
      if(info)  info.textContent = 'Draft généré ! Revenez pour le joindre à l\'étape Documents (étape 3).';
    }
    // Restore context into app form from dashboard state
    try{
      var raw = sessionStorage.getItem(STATE_KEY) || localStorage.getItem(STATE_KEY);
      if(!raw) return;
      var d = JSON.parse(raw);
      var ctx = document.getElementById('context');
      var obj = document.getElementById('objective');
      if(ctx && !ctx.value){
        var parts=[];
        if(d.contexte)    parts.push('Contexte : '+d.contexte);
        if(d.probleme)    parts.push('Problème : '+d.probleme);
        if(d.objectif)    parts.push('Objectif : '+d.objectif);
        if(d.contraintes) parts.push('Contraintes : '+d.contraintes);
        if(d.risques)     parts.push('Points sensibles : '+d.risques);
        if(d.acteurs)     parts.push('Acteurs : '+d.acteurs);
        if(d.deadline)    parts.push('Échéance : '+d.deadline);
        if(d.pieces)      parts.push('Pièces : '+d.pieces);
        if(d.desc)        parts.push(d.desc);
        if(parts.length) ctx.value = parts.join('\n');
      }
      if(obj && !obj.value && d.objectif) obj.value = d.objectif;
      if(d.domain){
        var info2 = document.getElementById('v58RetourInfo');
        if(info2 && !badge.classList.contains('visible'))
          info2.textContent = 'Domaine : ' + d.domain + ' — Contexte pré-rempli depuis votre parcours.';
      }
    }catch(e){}
  }
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(_init, 500); });
  window.addEventListener('pope_generation_done', function(){
    setTimeout(_init, 300);
  });
  window.addEventListener('storage', function(e){
    if(e.key==='pope_v54_generations') _init();
  });
  setTimeout(_init, 800);
})();
