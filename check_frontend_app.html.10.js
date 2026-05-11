
// v57: restore dashboard context into app generation form
(function(){
  var STATE_KEY = 'pope_v57_state_' + (location.pathname.indexOf('private')>-1?'private':'public');
  function _restoreCtxInApp(){
    try{
      var raw = sessionStorage.getItem(STATE_KEY) || localStorage.getItem(STATE_KEY);
      if(!raw) return;
      var d = JSON.parse(raw);
      // Pre-fill context field if empty
      var ctx = document.getElementById('context');
      if(ctx && !ctx.value && (d.contexte||d.objectif)){
        var parts=[];
        if(d.contexte) parts.push('Contexte : '+d.contexte);
        if(d.objectif) parts.push('Objectif : '+d.objectif);
        if(d.contraintes) parts.push('Contraintes : '+d.contraintes);
        if(d.acteurs) parts.push('Acteurs : '+d.acteurs);
        if(d.pieces) parts.push('Pièces : '+d.pieces);
        if(d.desc) parts.push(d.desc);
        ctx.value = parts.join('\n');
      }
      // Pre-fill objective if empty
      var obj = document.getElementById('objective');
      if(obj && !obj.value && d.objectif) obj.value = d.objectif;
      // Show domain badge in app
      if(d.domain){
        var info=document.getElementById('v56RetourInfo');
        if(info) info.textContent = 'Domaine : '+d.domain+' — Votre saisie est pré-remplie depuis le parcours.';
      }
    }catch(e){}
  }
  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(_restoreCtxInApp, 600);
  });
})();
