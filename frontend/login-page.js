import { apiFetch, getApiMessage, setSession } from './api.js';
import { showToast, getFingerprint } from './app.js';
import { mountTurnstile, getTurnstileToken, resetTurnstile } from './turnstile.js';

function $(id) { return document.getElementById(id); }

var params = new URLSearchParams(window.location.search || '');
var requestedNext = (params.get('next') || '').trim();

// Turnstile
mountTurnstile('turnstileBox').catch(function() {});

// Navigation apres login
function getDefaultNext(user) {
  if (user && user.role === 'admin') return 'dashboard-admin.html';
  return (user && user.accountSpace === 'private') ? 'dashboard-private.html' : 'dashboard.html';
}

function normalizeNext(target, user) {
  if (!target) return getDefaultNext(user);
  var cleaned = target.replace(/^https?:\/\/[^/]+/i, '');
  if (!cleaned || cleaned.indexOf('//') === 0) return getDefaultNext(user);
  if (!/^[\w./?=&%-]+$/.test(cleaned)) return getDefaultNext(user);
  var route = cleaned.charAt(0) === '/' ? cleaned.slice(1) : cleaned;
  var isPrivate = user && user.accountSpace === 'private';
  var noPrivate = ['app-private.html','expert-private.html','mission-private.html','dashboard-private.html'];
  var noPublic  = ['app.html','expert.html','mission.html','dashboard.html'];
  for (var i = 0; i < noPrivate.length; i++) {
    if (!isPrivate && route.indexOf(noPrivate[i]) === 0) return getDefaultNext(user);
  }
  for (var j = 0; j < noPublic.length; j++) {
    if (isPrivate && route.indexOf(noPublic[j]) === 0) return getDefaultNext(user);
  }
  return route || getDefaultNext(user);
}

// Bouton oeil mot de passe
var toggleBtn = $('togglePassword');
if (toggleBtn) {
  toggleBtn.addEventListener('click', function() {
    var inp = $('password');
    var isHidden = inp.type === 'password';
    inp.type = isHidden ? 'text' : 'password';
    this.textContent = isHidden ? '\uD83D\uDE48' : '\uD83D\uDC41';
  });
}

// Bouton connexion
var loginBtn = $('btnLogin');
if (loginBtn) {
  loginBtn.addEventListener('click', async function() {
    var btn = $('btnLogin');
    var msgEl = $('loginMsg');
    btn.disabled = true;
    btn.textContent = 'Connexion\u2026';
    msgEl.textContent = '';
    msgEl.style.color = '#50627a';

    try {
      var identifier = ($('identifier').value || '').trim();
      var password   = ($('password').value || '');

      if (!identifier) {
        msgEl.textContent = 'Veuillez renseigner votre email.';
        msgEl.style.color = '#b91c1c';
        btn.disabled = false; btn.textContent = 'Se connecter'; return;
      }
      if (!password) {
        msgEl.textContent = 'Veuillez renseigner votre mot de passe.';
        msgEl.style.color = '#b91c1c';
        btn.disabled = false; btn.textContent = 'Se connecter'; return;
      }

      var fp = await getFingerprint();
      var turnstileToken = getTurnstileToken();

      var data = await apiFetch('/auth/login', {
        method: 'POST',
        body: {
          email: identifier,
          identifier: identifier,
          password: password,
          fp: fp,
          turnstileToken: turnstileToken
        }
      });

      setSession(data.user || {}, data.token || '');
      localStorage.setItem('pope_account_space', (data.user && data.user.accountSpace) || 'public');
      showToast('Connect\u00e9 \u2713', 'ok');
      var next = normalizeNext(requestedNext, data.user);
      setTimeout(function() { window.location.href = next; }, 250);

    } catch(err) {
      resetTurnstile();
      var code = getApiMessage(err);
      var MSGS = {
        bot_protection_failed:   'V\u00e9rification de s\u00e9curit\u00e9 \u00e9chou\u00e9e. Patientez et r\u00e9essayez.',
        missing_turnstile_token: 'V\u00e9rification en cours. Patientez puis r\u00e9essayez.',
        invalid_credentials:     'Email ou mot de passe incorrect.',
        missing_fp:              'Erreur navigateur. Essayez sans mode priv\u00e9.',
        invalid_email:           'Format email invalide.',
        too_many_requests:       'Trop de tentatives. Attendez quelques minutes.'
      };
      msgEl.textContent = MSGS[code] || ('Erreur : ' + code);
      msgEl.style.color = '#b91c1c';
      showToast('Connexion impossible', 'err');
      btn.disabled = false;
      btn.textContent = 'Se connecter';
    }
  });
}
