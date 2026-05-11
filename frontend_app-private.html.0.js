
/* Détection staging */
(function(){
  var h = location.hostname;
  if (h.indexOf('staging') !== -1 || h.indexOf('localhost') !== -1 || h === '127.0.0.1') {
    window.__POPE_API_BASE__ = (h.indexOf('localhost') !== -1 || h === '127.0.0.1')
      ? 'http://localhost:3000'
      : 'https://popeonline-staging.onrender.com';
  }
})();
