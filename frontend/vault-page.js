import { apiFetch, API_BASE } from './api.js';
import { requireLogin, wireLogout, setTicketsBadge, showToast } from './app.js';
if (!requireLogin('vault.html')) {}
wireLogout();
const el = (id) => document.getElementById(id);
let currentUser = null;
const params = new URLSearchParams(window.location.search);
const requestedSpace = params.get('space') === 'private' ? 'private' : (params.get('space') === 'public' ? 'public' : null);
const requestedReturn = params.get('return') || '';

const RETURN_MAP = {
  public: {
    'dashboard.html': { href: 'dashboard.html', label: 'Tableau de bord public' },
    'app.html': { href: 'app.html', label: 'Revenir à la génération' },
    'expert.html': { href: 'expert.html', label: 'Revenir à la relecture experte' },
    'mission.html': { href: 'mission.html', label: 'Revenir à l’accompagnement' }
  },
  private: {
    'dashboard-private.html': { href: 'dashboard-private.html', label: 'Tableau de bord privé' },
    'app-private.html': { href: 'app-private.html', label: 'Revenir à la génération privée' },
    'expert-private.html': { href: 'expert-private.html', label: 'Revenir à la relecture experte' },
    'mission-private.html': { href: 'mission-private.html', label: 'Revenir à l’accompagnement' }
  }
};

function resolveSpace() {
  if (requestedSpace === 'private' || requestedSpace === 'public') return requestedSpace;
  return currentUser?.accountSpace === 'private' ? 'private' : 'public';
}

function safeReturnTarget(space) {
  const bucket = RETURN_MAP[space] || RETURN_MAP.public;
  return bucket[requestedReturn] || (space === 'private' ? bucket['app-private.html'] : bucket['app.html']);
}

async function toBase64(file){
  const buf = await file.arrayBuffer();
  let binary='';
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i=0;i<bytes.length;i+=chunk) binary += String.fromCharCode(...bytes.subarray(i, i+chunk));
  return btoa(binary);
}
function formatSize(size=0){ if(size<1024) return size+' o'; if(size<1024*1024) return (size/1024).toFixed(1)+' Ko'; return (size/1024/1024).toFixed(1)+' Mo'; }
function hoursLeft(date){ return Math.max(0, Math.ceil((new Date(date).getTime()-Date.now())/3600000)); }
function isPrivate(){ return resolveSpace() === 'private'; }
function applySpaceLabels(){
  const privateMode = isPrivate();
  const homeLink = el('vaultHomeLink');
  const generateLink = el('vaultGenerateLink');
  const expertLink = el('vaultExpertLink');
  const returnLink = el('vaultReturnLink');
  const space = privateMode ? 'private' : 'public';
  const target = safeReturnTarget(space);
  if (homeLink) homeLink.href = privateMode ? 'dashboard-private.html' : 'dashboard.html';
  if (generateLink) {
    generateLink.href = privateMode ? 'app-private.html' : 'app.html';
    generateLink.textContent = privateMode ? 'Génération IA privée' : 'Génération guidée';
  }
  if (expertLink) expertLink.href = privateMode ? 'expert-private.html' : 'expert.html';
  if (returnLink) {
    returnLink.href = target.href;
    returnLink.textContent = target.label;
  }
  if (!privateMode) return;
  document.querySelector('.brand-sub').textContent = 'Dépôt sécurisé 48h — espace privé';
  const hero = document.querySelector('.vault-hero .muted');
  if (hero) hero.textContent = 'Déposez vos pièces utiles à la génération privée, à la relecture experte ou à l’accompagnement. Les fichiers restent accessibles pendant 48 heures puis sont automatiquement supprimés.';
  const note = document.querySelector('.vault-hero-note span');
  if (note) note.textContent = 'DCE, règlement de consultation, mémoire technique, courrier reçu, justificatifs, statuts, pièces de formalité ou documents transmis par POPE Online.';
  const intro = document.querySelector('.vault-upload-card .muted');
  if (intro) intro.textContent = 'Formats conseillés pour alimentation IA : TXT, MD, CSV, JSON, HTML. Déposez aussi vos DCE, RC, projets de courrier et pièces de formalité pour exploitation 48h.';
  el('vaultPurpose').innerHTML = '<option value="generation">Génération IA privée</option><option value="expert">Relecture experte</option><option value="mission">Accompagnement sur mesure</option><option value="general">Usage général</option>';
}
async function load(){
  try {
    const me = await apiFetch('/auth/me');
    currentUser = me.user || null;
    setTicketsBadge(me.wallet || {});
    applySpaceLabels();
  } catch {}
  try {
    const data = await apiFetch('/vault');
    const items = data.items || [];
    el('vaultList').innerHTML = items.length ? items.map((item)=>`<article class="vault-item ${item.direction === 'pope_to_client' ? 'is-inbound' : ''}"><div><div class="vault-item-title">${item.name}</div><div class="vault-item-meta">${formatSize(item.size)} · expire dans ${hoursLeft(item.expiresAt)} h · ${item.canFeedAI ? 'utilisable dans la génération' : 'transmission sécurisée'}</div></div><div class="row gap wrap"><a class="btn ghost" href="${API_BASE}/vault/${item.id}/download" target="_blank" rel="noopener">Télécharger</a><button class="btn ghost" type="button" data-delete="${item.id}">Supprimer</button></div></article>`).join('') : '<div class="muted">Aucune pièce disponible pour le moment.</div>';
    document.querySelectorAll('[data-delete]').forEach((btn)=>btn.addEventListener('click', async ()=>{ await apiFetch(`/vault/${btn.dataset.delete}`, { method:'DELETE' }); showToast('Pièce supprimée', 'ok'); load(); }));
  } catch (e) {
    console.error(e);
    el('vaultList').innerHTML = '<div class="muted">Impossible de charger le dépôt sécurisé.</div>';
  }
}
el('vaultRefreshBtn').addEventListener('click', load);
el('vaultUploadBtn').addEventListener('click', async ()=>{
  const file = el('vaultInput').files?.[0];
  if (!file) { el('vaultMsg').textContent = 'Choisissez un fichier à déposer.'; return; }
  try {
    const contentBase64 = await toBase64(file);
    await apiFetch('/vault/upload', { method:'POST', body:{ name:file.name, type:file.type || 'application/octet-stream', purpose:el('vaultPurpose').value, contentBase64 } });
    el('vaultMsg').textContent = 'Pièce déposée. Elle restera disponible 48 heures.';
    el('vaultInput').value = '';
    showToast('Pièce déposée', 'ok');
    applySpaceLabels();
load();
  } catch (e) {
    console.error(e); el('vaultMsg').textContent = 'Dépôt impossible.'; showToast('Dépôt impossible', 'err');
  }
});
applySpaceLabels();
load();
