(function () {
  function hasSessionMarker() {
    return localStorage.getItem('pope_session_active') === '1' || !!sessionStorage.getItem('pope_session_token');
  }

  function currentNextTarget() {
    const path = `${window.location.pathname || ''}${window.location.search || ''}`;
    return encodeURIComponent(path || 'dashboard.html');
  }

  function getApiBase() {
    const explicit = window.__POPE_API_BASE__ || '';
    if (explicit) return String(explicit).replace(/\/$/, '');
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:3000';
    }
    return 'https://pope-online-v2.onrender.com';
  }

  function redirectToLogin() {
    window.location.replace(`login.html?next=${currentNextTarget()}`);
  }

  const protectedFiles = ['app.html', 'dashboard.html', 'dashboard-private.html', 'expert.html', 'mission.html', 'private-onboarding.html', 'account.html', 'profile.html', 'dashboard-admin.html', 'vault.html', 'app-private.html', 'expert-private.html', 'mission-private.html'];
  const path = (window.location.pathname || '').toLowerCase();
  const isProtected = protectedFiles.some(f => path.endsWith('/' + f) || path.endsWith(f));

  if (!isProtected) return;

  if (hasSessionMarker()) {
    window.__popeAuthValidated = true;
    return;
  }

  window.__popeAuthPending = true;
  const headers = { 'Content-Type': 'application/json' };
  const token = sessionStorage.getItem('pope_session_token');
  if (token) headers.Authorization = `Bearer ${token}`;

  fetch(`${getApiBase()}/auth/me`, {
    method: 'GET',
    credentials: 'include',
    headers
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json().catch(() => ({}));
      if (data?.user) {
        localStorage.setItem('pope_session_active', '1');
        localStorage.setItem('pope_session_user', JSON.stringify(data.user));
        if (data.user.accountSpace) localStorage.setItem('pope_account_space', data.user.accountSpace);
        window.__popeAuthValidated = true;
        return;
      }
      throw new Error('missing_user');
    })
    .catch(() => {
      window.__popeAuthValidated = false;
      redirectToLogin();
    })
    .finally(() => {
      window.__popeAuthPending = false;
    });
})();
