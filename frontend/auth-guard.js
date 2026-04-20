<<<<<<< HEAD
// Simple front gate for protected pages.
(function () {
  function getToken() {
    return localStorage.getItem('pope_token') || sessionStorage.getItem('pope_token');
  }

  const protectedFiles = ['app.html', 'dashboard.html', 'dashboard-private.html', 'expert.html', 'mission.html', 'private-onboarding.html', 'account.html', 'profile.html', 'dashboard-admin.html'];
=======
(function () {
  function hasSession() {
    return localStorage.getItem('pope_session_active') === '1';
  }

  const protectedFiles = ['app.html', 'dashboard.html', 'dashboard-private.html', 'expert.html', 'mission.html', 'private-onboarding.html', 'account.html', 'profile.html', 'dashboard-admin.html', 'vault.html', 'app-private.html', 'expert-private.html', 'mission-private.html'];
>>>>>>> staging
  const path = (window.location.pathname || '').toLowerCase();

  const isProtected = protectedFiles.some(f => path.endsWith('/' + f) || path.endsWith(f));

<<<<<<< HEAD
  if (isProtected && !getToken()) {
=======
  if (isProtected && !hasSession()) {
>>>>>>> staging
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `login.html?next=${next}`;
  }
})();
