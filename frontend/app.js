import { API_BASE } from './api.js';

window.__POPE_API_BASE__ = API_BASE;

const SESSION_KEY = 'pope_session_active';
const USER_KEY = 'pope_session_user';
const TOKEN_KEY = 'pope_session_token';
const DRAFT_KEYS = ['pope_generation_form_public','pope_generation_form_private','pope_expert_form_public','pope_expert_form_private','pope_mission_form_public','pope_mission_form_private'];

export async function apiFetch(path, { method='GET', body, auth=true } = {}) {
  const headers = { 'Content-Type':'application/json' };
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include'
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    if (res.status === 401) clearToken();
    throw err;
  }
  return data;
}

export function setSession(user = null, token = '') {
  localStorage.setItem(SESSION_KEY, '1');
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  if (token) sessionStorage.setItem(TOKEN_KEY, String(token));
}

export function setToken(token, user = null){
  setSession(user || {}, token || sessionStorage.getItem(TOKEN_KEY) || '');
}
export function getToken(){
  return sessionStorage.getItem(TOKEN_KEY) || (localStorage.getItem(SESSION_KEY) === '1' ? 'cookie-session' : '');
}
export function clearToken(){
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem('pope_token');
  sessionStorage.removeItem(TOKEN_KEY);
  DRAFT_KEYS.forEach((key)=>sessionStorage.removeItem(key));
}

export async function getFingerprint(){
  const raw = [navigator.userAgent, navigator.language, screen.width, screen.height, Intl.DateTimeFormat().resolvedOptions().timeZone].join('|');
  const enc = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2,'0')).join('');
}

export function requireLogin(next='dashboard.html'){
  if (window.__popeAuthValidated) return true;
  if (window.__popeAuthPending) return true;
  const token = getToken();
  if (!token) {
    window.location.href = `login.html?next=${encodeURIComponent(next)}`;
    return false;
  }
  return true;
}

function inferLogoutTarget(){
  const forcedSpace = document.body?.dataset?.forcedSpace || localStorage.getItem('pope_account_space') || '';
  const path = (window.location.pathname || '').toLowerCase();
  if (forcedSpace === 'private' || path.includes('private')) return 'private.html';
  if (path.endsWith('dashboard-admin.html')) return 'index.html';
  if (path.endsWith('dashboard.html') || path.endsWith('app.html') || path.endsWith('expert.html') || path.endsWith('mission.html') || path.endsWith('vault.html')) return 'public.html';
  return 'index.html';
}

let logoutWired = false;
export function wireLogout(){
  if (logoutWired) return;
  logoutWired = true;
  document.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-logout]');
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();
    try {
      const headers = { 'Content-Type': 'application/json' };
      const token = sessionStorage.getItem(TOKEN_KEY);
      if (token) headers.Authorization = `Bearer ${token}`;
      await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include', headers });
    } catch {}
    clearToken();
    const logoutTarget = document.body?.dataset?.logoutTarget || inferLogoutTarget();
    showToast('Déconnecté', 'ok');
    setTimeout(() => window.location.href = logoutTarget, 150);
  }, true);
}

export function setTicketsBadge(wallet) {
  const t = document.querySelector('[data-tickets]');
  if (!t || !wallet) return;

  const expired = wallet.trial_expired ||
    (wallet.trial_expires_at && new Date(wallet.trial_expires_at).getTime() < Date.now());

  if (expired) {
    t.textContent = 'Période d\'essai terminée';
    t.style.background = '#fef2f2';
    t.style.color = '#b91c1c';
    // Afficher la modale de conversion si pas déjà affichée
    if (!sessionStorage.getItem('pope_trial_modal_shown')) {
      sessionStorage.setItem('pope_trial_modal_shown', '1');
      showTrialExpiredModal(wallet);
    }
    return;
  }

  const daysLeft = wallet.trial_days_left;
  if (daysLeft !== null && daysLeft !== undefined) {
    if (daysLeft <= 3) {
      t.textContent = `${daysLeft}j d'essai restant${daysLeft > 1 ? 's' : ''}`;
      t.style.background = '#fef3c7';
      t.style.color = '#92400e';
    } else {
      t.textContent = `Essai gratuit · ${daysLeft}j restants`;
    }
    return;
  }

  const planLabel = wallet.plan_label || 'Free';
  t.textContent = planLabel === 'Free' ? 'Accès sécurisé' : `Plan ${planLabel} actif`;
}

export function showTrialExpiredModal(wallet) {
  if (document.getElementById('pope-trial-modal')) return;
  const overlay = document.createElement('div');
  overlay.id = 'pope-trial-modal';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(11,36,64,.7);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;';

  const base = (typeof window !== 'undefined') ? window.location.origin : '';

  // Construction sans template literals imbriqués pour compatibilité Vite
  const card = document.createElement('div');
  card.style.cssText = 'background:#fff;border-radius:24px;padding:48px 40px;max-width:880px;width:100%;box-shadow:0 32px 80px rgba(0,0,0,.2);position:relative;animation:pope-modal-in .35s ease';

  const style = document.createElement('style');
  style.textContent = '@keyframes pope-modal-in{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}';
  card.appendChild(style);

  // Header
  const header = document.createElement('div');
  header.style.cssText = 'text-align:center;margin-bottom:32px';
  header.innerHTML = '<div style="font-size:48px;margin-bottom:16px">🎯</div>' +
    '<h2 style="font-size:26px;font-weight:800;color:#0b2440;letter-spacing:-.02em;margin-bottom:12px">Votre période d\'essai est terminée</h2>' +
    '<p style="color:#50627a;font-size:16px;line-height:1.6;max-width:560px;margin:0 auto">Merci d\'avoir utilisé POPE Online. Vous avez découvert la puissance de notre plateforme d\'expertise sécurisée. <strong style="color:#0b2440">Continuez avec un plan adapté.</strong></p>';
  card.appendChild(header);

  // Plans
  const plansGrid = document.createElement('div');
  plansGrid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:28px';

  const plans = [
    { name:'Starter', price:'49€', period:'/mois', annual:'ou 499€/an (−15%)', features:['Production illimitée','5 relectures expertes/mois','Closier documentaire','Support prioritaire'], url:'pricing.html?plan=starter', featured:false },
    { name:'Pro', price:'89€', period:'/mois', annual:'ou 890€/an (−15%)', features:['Production illimitée','15 relectures expertes/mois','Closier documentaire premium','Accompagnement inclus'], url:'pricing.html?plan=pro', featured:true },
    { name:'Premium', price:'Sur devis', period:'', annual:'Collectivités & Entreprises', features:['Production illimitée','Relectures illimitées','Conseiller dédié','Intégration sur mesure'], url:'mailto:contact@pope-online.com?subject=Offre%20Premium', featured:false },
  ];

  plans.forEach(function(plan) {
    const col = document.createElement('div');
    col.style.cssText = plan.featured
      ? 'border:2px solid #0079c1;border-radius:16px;padding:24px 20px;text-align:center;background:linear-gradient(135deg,#f0f7fc,#e0f0fb);position:relative'
      : 'border:1.5px solid #dce9f4;border-radius:16px;padding:24px 20px;text-align:center';

    if (plan.featured) {
      const badge = document.createElement('div');
      badge.style.cssText = 'position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#0079c1,#03a0d7);color:#fff;border-radius:999px;padding:4px 14px;font-size:11px;font-weight:700;white-space:nowrap';
      badge.textContent = 'RECOMMANDÉ';
      col.appendChild(badge);
    }

    const nameEl = document.createElement('div');
    nameEl.style.cssText = 'font-size:12px;font-weight:700;color:' + (plan.featured ? '#0079c1' : '#50627a') + ';text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px';
    nameEl.textContent = plan.name;
    col.appendChild(nameEl);

    const priceEl = document.createElement('div');
    priceEl.innerHTML = '<span style="font-size:28px;font-weight:800;color:#0b2440">' + plan.price + '</span><span style="font-size:14px;font-weight:400;color:#50627a">' + plan.period + '</span>';
    col.appendChild(priceEl);

    const annualEl = document.createElement('div');
    annualEl.style.cssText = 'font-size:12px;color:#50627a;margin-bottom:16px;margin-top:4px';
    annualEl.textContent = plan.annual;
    col.appendChild(annualEl);

    const ul = document.createElement('ul');
    ul.style.cssText = 'list-style:none;text-align:left;font-size:13px;color:#0b2440;line-height:2;padding:0;margin:0 0 16px';
    plan.features.forEach(function(f) {
      const li = document.createElement('li');
      li.textContent = '✓ ' + f;
      ul.appendChild(li);
    });
    col.appendChild(ul);

    const cta = document.createElement('a');
    cta.href = plan.url.startsWith('mailto') ? plan.url : base + '/' + plan.url;
    cta.style.cssText = 'display:block;background:linear-gradient(135deg,#0079c1,#03a0d7);color:#fff;border-radius:12px;padding:11px;font-weight:700;font-size:14px;text-decoration:none';
    cta.textContent = plan.url.startsWith('mailto') ? 'Nous contacter' : 'Choisir ' + plan.name;
    col.appendChild(cta);

    plansGrid.appendChild(col);
  });
  card.appendChild(plansGrid);

  // Lien fermeture
  const closeWrap = document.createElement('div');
  closeWrap.style.cssText = 'text-align:center';
  const closeBtn = document.createElement('button');
  closeBtn.style.cssText = 'background:none;border:none;color:#50627a;font-size:14px;cursor:pointer;text-decoration:underline';
  closeBtn.textContent = 'Continuer en consultation uniquement';
  closeBtn.onclick = function() { overlay.remove(); };
  closeWrap.appendChild(closeBtn);
  card.appendChild(closeWrap);

  overlay.appendChild(card);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
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
