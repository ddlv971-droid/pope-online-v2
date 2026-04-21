(function(){
  const protectedTargets = new Set([
    'app.html','expert.html','mission.html','dashboard.html',
    'app-private.html','expert-private.html','mission-private.html','dashboard-private.html',
    'vault.html'
  ]);
  function hasSession(){
    return localStorage.getItem('pope_session_active') === '1' || !!sessionStorage.getItem('pope_session_token');
  }
  document.addEventListener('click', function(event){
    const link = event.target.closest('a[href]');
    if (!link) return;
    const rawHref = link.getAttribute('href') || '';
    if (!rawHref || rawHref.startsWith('http') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:') || rawHref.startsWith('#')) return;
    const cleanHref = rawHref.replace(/^\.\//, '');
    const pathname = cleanHref.split('?')[0];
    if (!protectedTargets.has(pathname)) return;
    if (hasSession()) return;
    event.preventDefault();
    window.location.href = `login.html?next=${encodeURIComponent(cleanHref)}`;
  }, true);
})();
