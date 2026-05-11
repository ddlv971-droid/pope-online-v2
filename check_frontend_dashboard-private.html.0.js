
/* Init : API base URL selon l'environnement + anti-flash retour APP */
(function(){
  /* Détection staging : forcer l'URL du backend staging */
  var h = location.hostname;
  if (h.indexOf('staging') !== -1 || h.indexOf('localhost') !== -1 || h === '127.0.0.1') {
    window.__POPE_API_BASE__ = h.indexOf('localhost') !== -1 || h === '127.0.0.1'
      ? 'http://localhost:3000'
      : 'https://popeonline-staging.onrender.com';
  }
  /* Anti-flash : si retour depuis app, masquer step-panel-1 immédiatement */
  try {
    if (new URLSearchParams(location.search).get('from') === 'app') {
      document.addEventListener('DOMContentLoaded', function() {
        var p1 = document.getElementById('step-panel-1');
        if (p1) { p1.classList.remove('active'); p1.style.display = 'none'; }
      }, { once: true });
      var st = document.createElement('style');
      st.id = 'v61-antiflash';
      st.textContent = '.v5-step-panel { display: none !important; }';
      document.head && document.head.appendChild(st);
    }
  } catch(e) {}
})();
