(function () {
  const protectedFiles = ['app.html', 'dashboard.html', 'dashboard-private.html', 'expert.html', 'mission.html', 'private-onboarding.html', 'account.html', 'profile.html', 'dashboard-admin.html'];
  const path = (window.location.pathname || '').toLowerCase();
  const isProtected = protectedFiles.some(f => path.endsWith('/' + f) || path.endsWith(f));
  if (!isProtected) return;
  if (!document.cookie.includes('pope_logged_in=1')) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `login.html?next=${next}`;
  }
})();
