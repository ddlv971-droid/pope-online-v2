import { apiFetch, setToken, getToken } from './api.js';

const el = (id) => document.getElementById(id);

export function showToast(message, type='info') {
  let host = document.querySelector('.toast-host');
  if (!host) {
    host = document.createElement('div');
    host.className = 'toast-host';
    document.body.appendChild(host);
  }
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = message;
  host.appendChild(t);
  setTimeout(() => { t.classList.add('out'); }, 2400);
  setTimeout(() => { t.remove(); }, 3000);
}

export async function getFingerprint() {
  const s = [
    navigator.userAgent,
    screen.width,
    screen.height,
    navigator.language,
    new Date().getTimezoneOffset()
  ].join('|');

  // simple sha-256 via WebCrypto
  const enc = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest('SHA-256', enc);
  const hash = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2,'0')).join('');
  return hash;
}

export function requireLogin(redirectTo) {
  const t = getToken();
  if (!t) {
    const to = redirectTo ? `?next=${encodeURIComponent(redirectTo)}` : '';
    window.location.href = `login.html${to}`;
    return false;
  }
  return true;
}

export async function loadMe() {
  return apiFetch('/auth/me', { auth: true });
}

// Attach common UI behaviors if elements exist
export function wireLogout() {
  const btn = document.querySelector('[data-logout]');
  if (!btn) return;
  btn.addEventListener('click', () => {
    setToken('');
    showToast('Déconnecté', 'ok');
    setTimeout(() => window.location.href = 'index.html', 400);
  });
}

export function setTicketsBadge(wallet) {
  const t = document.querySelector('[data-tickets]');
  if (!t) return;
  t.textContent = `AI: ${wallet?.tickets_ai ?? 0} • Expert: ${wallet?.tickets_expert ?? 0}`;
}

// Minimal styling for toasts (injected once)
(function ensureToastStyles(){
  if (document.getElementById('toast-style')) return;
  const style = document.createElement('style');
  style.id = 'toast-style';
  style.textContent = `
.toast-host{position:fixed;right:16px;bottom:16px;display:flex;flex-direction:column;gap:10px;z-index:9999}
.toast{padding:12px 14px;border-radius:12px;backdrop-filter: blur(10px);box-shadow:0 12px 32px rgba(0,0,0,.25);font-weight:600;max-width:320px}
.toast-info{background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.16);color:rgba(255,255,255,.92)}
.toast-ok{background:rgba(3,160,215,.18);border:1px solid rgba(3,160,215,.35);color:#e9fbff}
.toast-warn{background:rgba(255,210,92,.15);border:1px solid rgba(255,210,92,.35);color:#fff7db}
.toast-err{background:rgba(255,90,90,.15);border:1px solid rgba(255,90,90,.35);color:#ffecec}
.toast.out{opacity:0;transform:translateY(6px);transition:all .6s ease}
`;
  document.head.appendChild(style);
})();
