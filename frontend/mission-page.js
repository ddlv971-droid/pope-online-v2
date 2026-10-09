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
const FORM_IDS = ['fullName','organization','phone','domain','deadline','subject','context','content'];
const DRAFT_KEYS = { public: 'pope_mission_form_public', private: 'pope_mission_form_private' };
function draftKey(){ return DRAFT_KEYS[isPrivate() ? 'private' : 'public']; }
function persistDraft(){ try { sessionStorage.setItem(draftKey(), JSON.stringify(Object.fromEntries(FORM_IDS.map((id)=>[id, el(id)?.value || ''])))); } catch {} }
function restoreDraft(){ try { const raw = sessionStorage.getItem(draftKey()); if (!raw) return; const saved = JSON.parse(raw); FORM_IDS.forEach((id)=>{ if (typeof saved[id] === 'string' && el(id)) el(id).value = saved[id]; }); } catch {} }
function clearDraft(){ try { sessionStorage.removeItem(draftKey()); } catch {} }
function isPrivate(){ return (forcedSpace || currentUser?.accountSpace || 'public') === 'private'; }
function selectedVaultIds(){ return Array.from(document.querySelectorAll('[data-vault-file]:checked')).map((n)=>n.value); }
function applySpaceLabels(){
  if (!isPrivate()) return;
  el('missionSubTitle').textContent = 'Accompagnement privé sur mesure';
  const gen = document.getElementById('spaceGenerateLink'); if (gen) gen.textContent = 'Outil de rédaction privé';
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
  if (currentUser) { if (!el('fullName').value) el('fullName').value = currentUser.fullName || currentUser.full_name || ''; if (!el('organization').value) el('organization').value = currentUser.organization || ''; if (!el('phone').value) el('phone').value = currentUser.phoneFull || currentUser.phone_full || currentUser.phone || ''; }
  try{ const data=await apiFetch('/vault'); vaultFiles=data.items||[]; }catch{ vaultFiles=[]; }
  renderVault();
}
FORM_IDS.forEach((id)=>{ const node=el(id); if(node){ node.addEventListener('input', persistDraft); node.addEventListener('change', persistDraft); }}); document.querySelectorAll('a[href*="vault.html"]').forEach((link)=>link.addEventListener('click', persistDraft)); window.addEventListener('beforeunload', persistDraft); restoreDraft();
el('btnSend').addEventListener('click', async ()=>{
  const btn = el('btnSend');
  const body = {
    full_name: el('fullName').value.trim(), organization: el('organization').value.trim(), phone: el('phone').value.trim(),
    domain: el('domain').value, deadline: el('deadline').value.trim(),
    email: currentUser?.email || '',
    subject: el('subject').value.trim(), context: el('context').value.trim(), content: el('content').value.trim(),
    vault_file_ids: selectedVaultIds()
  };
  if (!body.full_name || !body.domain || !body.subject || !body.content) { el('msg').textContent = 'Merci de renseigner votre nom, le domaine, le sujet et ce que vous attendez.'; return; }
  // Le contexte est ajouté à la description pour que l'équipe reçoive tout le texte
  body.content = body.context ? `${body.content}\n\nContexte et enjeux :\n${body.context}` : body.content;
  btn.disabled = true;
  try {
    persistDraft();
    await apiFetch('/mission/request', { method:'POST', body });
    clearDraft();
    el('msg').textContent = '✅ Votre besoin a bien été transmis à l\u2019équipe POPE Online. Un conseiller vous recontacte sous 24 h ouvrées.';
    showToast('Demande transmise', 'ok');
  } catch(e){
    console.error(e);
    el('msg').textContent = 'Erreur : ' + getApiMessage(e);
    showToast('Envoi impossible', 'err');
    btn.disabled = false;
  }
});
refreshWallet();
