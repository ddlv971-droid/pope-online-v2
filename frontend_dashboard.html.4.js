
import { apiFetch } from './api.js';
import { requireLogin, wireLogout, setTicketsBadge } from './app.js';
if (!requireLogin('dashboard.html')) {}
wireLogout();
(async () => {
  try {
    const me = await apiFetch('/auth/me');
    setTicketsBadge(me.wallet);
    const u = me.user || {};
    const w = me.wallet || {};
    // Welcome
    const name = u.full_name ? u.full_name.split(' ')[0] : '';
    if (name) document.getElementById('dashWelcome').textContent = 'Bonjour ' + name + ' 👋';
    // Stats
    document.getElementById('expertLeftN').textContent = w.expert_left ?? '—';
    document.getElementById('planN').textContent = w.plan_label || 'Free';
    // Trial alert
    if (w.status === 'trial_active' && w.trial_days_left !== null) {
      const alert = document.getElementById('trialAlert');
      alert.removeAttribute('hidden');
      var _trialEnd = w.trial_expires_at ? new Date(w.trial_expires_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'}) : '';
      document.getElementById('trialAlertTitle').textContent = 'Essai gratuit — ' + w.trial_days_left + ' jour' + (w.trial_days_left > 1 ? 's' : '') + ' restant' + (w.trial_days_left > 1 ? 's' : '');
      document.getElementById('trialAlertBody').textContent = (_trialEnd ? 'Expire le ' + _trialEnd + '. ' : '') + 'Souscrivez un plan pour continuer après votre essai.';
    }
    if (w.status === 'trial_expired') {
      const alert = document.getElementById('trialAlert');
      alert.removeAttribute('hidden');
      alert.style.background = 'linear-gradient(to right,#fef2f2,#fff0f0)';
      alert.style.borderColor = '#fecaca';
      // Afficher l'overlay de blocage UI
      var _overlay = document.getElementById('trialExpiredOverlay');
      if (_overlay) _overlay.removeAttribute('hidden');
      var _expEnd = w.trial_expires_at ? new Date(w.trial_expires_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'}) : '';
      document.getElementById('trialAlertTitle').textContent = 'Période d\'essai terminée' + (_expEnd ? ' le ' + _expEnd : '');
      document.getElementById('trialAlertBody').textContent = 'Génération et Conseils Expert suspendues. Choisissez un plan pour reprendre immédiatement.';
    } else if (w.status === 'verified_no_trial') {
      // Offre gratuite permanente — afficher un bandeau informatif discret
      const alertVnt = document.getElementById('trialAlert');
      alertVnt.removeAttribute('hidden');
      alertVnt.style.background = 'linear-gradient(to right,#f0f9ff,#e0f2fe)';
      alertVnt.style.borderColor = '#bae6fd';
      document.getElementById('trialAlertTitle').textContent = '💡 Offre gratuite — 2 Conseils Expert offerts (une seule fois)';
      document.getElementById('trialAlertBody').textContent = 'Vous bénéficiez de l\'offre gratuite permanente. La génération IA est illimitée. Passez à Starter ou Pro pour plus de Conseils Expert.';
    }
  } catch {}
})();
