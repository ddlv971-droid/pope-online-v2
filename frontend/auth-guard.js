// Simple front gate for protected pages.
(function () {
  function getToken() {
    return localStorage.getItem('pope_token') || sessionStorage.getItem('pope_token');
  }

  const protectedFiles = ['app.html', 'dashboard.html', 'expert.html', 'mission.html', 'private-onboarding.html', 'account.html'];
  const path = (window.location.pathname || '').toLowerCase();

  const isProtected = protectedFiles.some(f => path.endsWith('/' + f) || path.endsWith(f));

  if (isProtected && !getToken()) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `login.html?next=${next}`;
  }
})();
