(function () {
  function hasSession() {
    return localStorage.getItem('pope_session_active') === '1' || !!sessionStorage.getItem('pope_session_token');
  }

  const protectedFiles = ['app.html', 'dashboard.html', 'dashboard-private.html', 'expert.html', 'mission.html', 'private-onboarding.html', 'account.html', 'profile.html', 'dashboard-admin.html', 'vault.html', 'app-private.html', 'expert-private.html', 'mission-private.html'];
  const path = (window.location.pathname || '').toLowerCase();
  const isProtected = protectedFiles.some(f => path.endsWith('/' + f) || path.endsWith(f));

  if (isProtected && !hasSession()) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(`login.html?next=${next}`);
  }
})();
