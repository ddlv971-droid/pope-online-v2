import { API_BASE } from './api.js';

export async function apiFetch(path, { method='GET', body, auth=true } = {}) {
  const token = localStorage.getItem('pope_token');
  const headers = { 'Content-Type':'application/json' };
  if (auth && token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export function setToken(token){
  localStorage.setItem('pope_token', token);
}
export function getToken(){
  return localStorage.getItem('pope_token');
}
export function clearToken(){
  localStorage.removeItem('pope_token');
}

export function clearGenerationDrafts(){
  const keys = [
    'pope_generation_form_public',
    'pope_generation_form_private',
    'pope_last_generation_public',
    'pope_last_generation_private',
    'pope_last_generation',
    'pope_generation_space',
    'pope_generation_selected_vault_ids_public',
    'pope_generation_selected_vault_ids_private'
  ];
  for (const key of keys) {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch {}
  }
}

export async function getFingerprint(){
  const raw = [navigator.userAgent, navigator.language, screen.width, screen.height, Intl.DateTimeFormat().resolvedOptions().timeZone].join('|');
  const enc = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2,'0')).join('');
}

export function requireLogin(next='dashboard.html'){
  const token = getToken();
  if (!token) {
    window.location.href = `login.html?next=${encodeURIComponent(next)}`;
    return false;
  }
  return true;
}

let logoutWired = false;
export function wireLogout(){
  if (logoutWired) return;
  logoutWired = true;
  document.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-logout]');
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();
    clearGenerationDrafts();
    clearToken();
    showToast('Déconnecté', 'ok');
    setTimeout(() => window.location.href = 'index.html', 150);
  }, true);
}

export function setTicketsBadge(wallet) {
  const t = document.querySelector('[data-tickets]');
  if (!t || !wallet) return;
  const expiry = wallet?.trial_expires_at ? new Date(wallet.trial_expires_at) : null;
  const expired = expiry && expiry.getTime() < Date.now();
  if (expired) {
    t.textContent = 'Offre expirée';
    return;
  }
  if ((wallet?.tickets_ai ?? 0) > 0) {
    t.textContent = `${wallet.tickets_ai} ticket${wallet.tickets_ai > 1 ? 's' : ''} IA restant${wallet.tickets_ai > 1 ? 's' : ''}`;
    return;
  }
  t.textContent = 'Accès sécurisé';
}

export function showToast(text, tone='ok'){
  let host = document.querySelector('.toast-host');
  if (!host) {
    host = document.createElement('div');
    host.className = 'toast-host';
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = `toast ${tone}`;
  el.textContent = text;
  host.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    setTimeout(() => el.remove(), 220);
  }, 2300);
}

(function ensureToastStyles(){
  if (document.getElementById('toast-style')) return;
  const style = document.createElement('style');
  style.id = 'toast-style';
  style.textContent = `
  .toast-host{position:fixed;right:16px;bottom:16px;display:flex;flex-direction:column;gap:10px;z-index:9999}
  .toast{padding:12px 14px;border-radius:14px;color:#fff;font-weight:800;box-shadow:0 10px 26px rgba(7,22,42,.16);transition:opacity .2s ease,transform .2s ease}
  .toast.ok{background:linear-gradient(135deg,#0c5ea8,#03A0D7)}
  .toast.warn{background:linear-gradient(135deg,#b7791f,#d69e2e)}
  .toast.err{background:linear-gradient(135deg,#a3214b,#d92d8f)}
  `;
  document.head.appendChild(style);
})();
