function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

import { apiFetch, getApiMessage } from './api.js';
import { requireLogin, wireLogout, setTicketsBadge, showToast } from './app.js';
if (!requireLogin('mission.html')) {}
wireLogout();
const el=(id)=>document.getElementById(id); const forcedSpace = (document.body?.dataset?.forcedSpace || '').trim();
let currentUser=null, vaultFiles=[];
const DRAFT_KEYS = { public: 'pope_mission_form_public', private: 'pope_mission_form_private' };
function draftKey(){ return DRAFT_KEYS[isPrivate() ? 'private' : 'public']; }
function persistDraft(){ try { sessionStorage.setItem(draftKey(), JSON.stringify({ subject: el('subject')?.value || '', context: el('context')?.value || '', content: el('content')?.value || '' })); } catch {} }
function restoreDraft(){ try { const raw = sessionStorage.getItem(draftKey()); if (!raw) return; const saved = JSON.parse(raw); if (typeof saved.subject === 'string') el('subject').value = saved.subject; if (typeof saved.context === 'string') el('context').value = saved.context; if (typeof saved.content === 'string') el('content').value = saved.content; } catch {} }
function clearDraft(){ try { sessionStorage.removeItem(draftKey()); } catch {} }
function isPrivate(){ return (forcedSpace || currentUser?.accountSpace || 'public') === 'private'; }
function selectedVaultIds(){ return Array.from(document.querySelectorAll('[data-vault-file]:checked')).map((n)=>n.value); }
function applySpaceLabels(){
  if (!isPrivate()) return;
  el('missionSubTitle').textContent = 'Accompagnement privé sur mesure';
  const gen = document.getElementById('spaceGenerateLink'); if (gen) gen.textContent = 'Génération IA privée';
  el('missionTitle').textContent = 'Demande d’accompagnement sur mesure — espace privé';
  el('missionLead').textContent = 'Exposez un besoin plus structurant : création d’entreprise, formalité complexe, organisation d’un dossier ou accompagnement administratif à séquencer.';
  el('subject').placeholder = "Ex : Appui sur un dossier de création d'entreprise";
  el('context').placeholder = 'Présentez votre activité, le contexte, les organismes concernés, l’échéance et les contraintes.';
  el('missionContentLabel').textContent = 'Attendu / accompagnement recherché';
  el('content').placeholder = 'Décrivez l’objectif, les étapes à clarifier, les points de vigilance et le niveau d’appui attendu.';
  el('missionVaultLead').textContent = 'Joignez les pièces utiles à l’analyse : documents de formalité, statuts, DCE, courriers reçus ou justificatifs.';
}
function renderVault(){ const host=el('vaultMissionList'); host.innerHTML = vaultFiles.length ? vaultFiles.map((item)=>`<label class="vault-inline-item"><input type="checkbox" data-vault-file value="${encodeURIComponent(item.id)}"><div><strong>${escapeHtml(item.name)}</strong><span>expire le ${new Date(item.expiresAt).toLocaleString('fr-FR')}</span></div></label>`).join('') : '<div class="muted">Aucune pièce temporaire disponible pour le moment.</div>'; }
async function refreshWallet(){
  try{
    const me=await apiFetch('/auth/me');
    currentUser=me.user||null;
    setTicketsBadge(me.wallet);
  }catch{}
  var _mhl=document.getElementById('missionHomeLink')||document.getElementById('topbarHomeLink'); if(_mhl) _mhl.href = isPrivate() ? 'dashboard-private.html' : 'dashboard.html';
  const gen = document.getElementById('spaceGenerateLink'); if (gen) gen.href = isPrivate() ? 'app-private.html' : 'app.html';
  const crossExpert = document.getElementById('crossExpertLink'); if (crossExpert) crossExpert.href = isPrivate() ? 'expert-private.html' : 'expert.html';
  applySpaceLabels();
  try{ const data=await apiFetch('/vault'); vaultFiles=data.items||[]; }catch{ vaultFiles=[]; }
  renderVault();
}
['subject','context','content'].forEach((id)=>{ const node=el(id); if(node){ node.addEventListener('input', persistDraft); node.addEventListener('change', persistDraft); }}); document.querySelectorAll('a[href*="vault.html"]').forEach((link)=>link.addEventListener('click', persistDraft)); window.addEventListener('beforeunload', persistDraft); restoreDraft();
el('btnSend').addEventListener('click', async ()=>{ try { persistDraft(); const data=await apiFetch('/mission/request',{ method:'POST', body:{ subject:el('subject').value.trim(), context:el('context').value.trim(), content:el('content').value.trim(), vault_file_ids:selectedVaultIds() } }); setTicketsBadge(data.wallet); clearDraft(); el('msg').textContent='✅ Votre demande a été transmise. Nous revenons vers vous après analyse et cadrage.'; showToast('Demande transmise', 'ok'); } catch(e){ console.error(e); el('msg').textContent='Erreur : '+getApiMessage(e); showToast('Envoi impossible', 'err'); } }); refreshWallet();
