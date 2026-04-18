import { apiFetch, API_BASE } from './api.js';
import { requireLogin, wireLogout, setTicketsBadge, showToast } from './app.js';
if (!requireLogin('vault.html')) {}
wireLogout();
const el = (id) => document.getElementById(id);
let currentUser = null;
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
async function load(){
  try {
    const me = await apiFetch('/auth/me');
    currentUser = me.user || null;
    setTicketsBadge(me.wallet || {});
    document.getElementById('vaultHomeLink').href = currentUser?.accountSpace === 'private' ? 'dashboard-private.html' : 'dashboard.html';
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
    load();
  } catch (e) {
    console.error(e); el('vaultMsg').textContent = 'Dépôt impossible.'; showToast('Dépôt impossible', 'err');
  }
});
load();
