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
import { createArchiveStore, isArchiveStorageAvailable } from './archive.js';
if (!requireLogin('expert.html')) {}
wireLogout();
const el=(id)=>document.getElementById(id);
const forcedSpace = (document.body?.dataset?.forcedSpace || '').trim();
let currentUser=null, archiveStore=null, selectedArchive=null, vaultFiles=[];
const DRAFT_KEYS = { public: 'pope_expert_form_public', private: 'pope_expert_form_private' };
function draftKey(){ return DRAFT_KEYS[isPrivate() ? 'private' : 'public']; }
function persistDraft(){ try { sessionStorage.setItem(draftKey(), JSON.stringify({ subject: el('subject')?.value || '', context: el('context')?.value || '', content: el('content')?.value || '', archiveId: el('archiveAttachmentSelect')?.value || '' })); } catch {} }
function restoreDraft(){ try { const raw = sessionStorage.getItem(draftKey()); if (!raw) return; const saved = JSON.parse(raw); if (typeof saved.subject === 'string') el('subject').value = saved.subject; if (typeof saved.context === 'string') el('context').value = saved.context; if (typeof saved.content === 'string') el('content').value = saved.content; if (el('archiveAttachmentSelect') && typeof saved.archiveId === 'string') el('archiveAttachmentSelect').dataset.restoreValue = saved.archiveId; } catch {} }
function clearDraft(){ try { sessionStorage.removeItem(draftKey()); } catch {} }

function getUserKey(){ return currentUser?.id || currentUser?.email || 'anonymous'; }
function archiveLabel(item){ const date=new Date(item.updatedAt || item.createdAt).toLocaleDateString('fr-FR'); return `${item.title || item.usecaseLabel || 'Génération IA'} — ${date}`; }
function isPrivate(){ return (forcedSpace || currentUser?.accountSpace || 'public') === 'private'; }
function applySpaceLabels(){
  if (!isPrivate()) return;
  el('expertSubTitle').textContent = 'Relecture experte privée';
  const gen = document.getElementById('spaceGenerateLink'); if (gen) gen.textContent = 'Génération IA privée';
  el('expertTitle').textContent = 'Demande de relecture experte — espace privé';
  el('expertLead').textContent = 'Décrivez votre besoin : trame de réponse à un marché public, rapport de synthèse argumenté, courrier administratif sensible, formalité ou document d’entreprise à relire avant envoi.';
  el('expertContentLabel').textContent = 'Document, projet de courrier ou éléments à relire';
  el('subject').placeholder = "Ex : Relecture d'une trame de réponse à un marché public";
  el('context').placeholder = 'Précisez l’organisme, l’échéance, le niveau d’enjeu et le contexte de votre entreprise.';
  el('content').placeholder = 'Collez votre projet de réponse, votre courrier ou décrivez les éléments à sécuriser.';
  el('attachmentLead').textContent = 'Choisissez la génération archivée à joindre. Le prompt et le résultat correspondants seront transmis à l’équipe.';
  el('expertVaultLead').textContent = 'Ajoutez si besoin des pièces du dépôt sécurisé 48h : DCE, RC, courrier reçu, pièces de formalité ou justificatifs.';
}
function renderAttachmentCard(){ var _appLnk=isPrivate()?'app-private.html':'app.html'; var card=el('generationAttachmentCard'), status=el('attachmentStatus'), preview=el('attachmentPreview'), select=el('archiveAttachmentSelect'); if(!card||!status||!preview||!select) return; if(!archiveStore){ 
    card.style.display='block'; 
    select.innerHTML='<option value="">Aucune génération archivée disponible</option>';
    if(status) status.textContent='Pas encore d\'archive locale';
    if(preview){ var _gh='<span style="color:#50627a">G\u00e9n\u00e9rez et archivez un document depuis l\'<a href="'; _gh+=_appLnk; _gh+='" style="color:#0079c1">espace g\u00e9n\u00e9ration</a> pour pouvoir le joindre ici.</span>'; preview.innerHTML=_gh; }
    return; 
  } const items=archiveStore.list(); if(!items.length){ 
    card.style.display='block';
    select.innerHTML='<option value="">Aucune génération archivée disponible</option>';
    if(status) status.textContent='Pas encore d\'archive locale';
    if(preview){ var _gh='<span style="color:#50627a">G\u00e9n\u00e9rez et archivez un document depuis l\'<a href="'; _gh+=_appLnk; _gh+='" style="color:#0079c1">espace g\u00e9n\u00e9ration</a> pour pouvoir le joindre ici.</span>'; preview.innerHTML=_gh; }
    return; 
  } card.style.display='block'; const currentValue=select.value || select.dataset.restoreValue || '';  select.innerHTML='<option value="">Ne pas joindre de génération archivée</option>'+items.map((item)=>`<option value="${encodeURIComponent(item.id)}">${escapeHtml(archiveLabel(item))}</option>`).join(''); if(currentValue && items.some((item)=>item.id===currentValue)) select.value=currentValue; select.dataset.restoreValue=''; selectedArchive=select.value ? archiveStore.get(select.value) : null; updateAttachmentPreview(); }
function updateAttachmentPreview(){ const status=el('attachmentStatus'), preview=el('attachmentPreview'), select=el('archiveAttachmentSelect'); selectedArchive=select.value && archiveStore ? archiveStore.get(select.value) : null; if(!selectedArchive?.result){ status.textContent='Aucune archive sélectionnée'; preview.innerHTML='Vous pouvez envoyer votre demande sans pièce jointe, ou sélectionner une génération archivée pour transmettre le prompt et le résultat associés.'; return; } status.textContent='Archive jointe'; const objective=selectedArchive?.prompt?.objective || selectedArchive.title || '—'; const result=String(selectedArchive.result || '').replace(/\s+/g,' ').slice(0,260); preview.innerHTML=`<strong>Archive sélectionnée :</strong> ${archiveLabel(selectedArchive)}<br><strong>Objet suggéré :</strong> ${escapeHtml(objective)}<br><strong>Aperçu du résultat joint :</strong> ${escapeHtml(result)}${String(selectedArchive.result || '').length>260?'…':''}`; if(!el('subject').value.trim()) el('subject').value = `Relecture experte — ${String(objective).slice(0,90) || 'livrable généré'}`; }
function initArchiveChoices(){ if(!isArchiveStorageAvailable()){ archiveStore=null; renderAttachmentCard(); return; } try{ archiveStore=createArchiveStore({ userId:getUserKey() }); }catch{ archiveStore=null; } renderAttachmentCard(); }
function renderVault(){ const host=el('vaultExpertList'); if(!vaultFiles.length){ host.innerHTML='<div class="muted">Aucune pièce temporaire disponible pour le moment.</div>'; return; } host.innerHTML=vaultFiles.map((item)=>`<label class="vault-inline-item"><input type="checkbox" data-vault-file value="${encodeURIComponent(item.id)}"><div><strong>${escapeHtml(item.name)}</strong><span>${item.canFeedAI ? 'peut aussi être analysée dans la génération' : 'pièce transmise en attachement'} · expire le ${new Date(item.expiresAt).toLocaleString('fr-FR')}</span></div></label>`).join(''); }
function selectedVaultIds(){ return Array.from(document.querySelectorAll('[data-vault-file]:checked')).map((n)=>n.value); }
async function refreshWallet(){
  try{
    const me=await apiFetch('/auth/me');
    currentUser=me.user||null;
    setTicketsBadge(me.wallet);
  }catch{}
  var _ehl=document.getElementById('expertHomeLink')||document.getElementById('topbarHomeLink'); if(_ehl) _ehl.href = isPrivate() ? 'dashboard-private.html' : 'dashboard.html';
  const gen = document.getElementById('spaceGenerateLink'); if (gen) gen.href = isPrivate() ? 'app-private.html' : 'app.html';
  const crossMission = document.getElementById('crossMissionLink'); if (crossMission) crossMission.href = isPrivate() ? 'mission-private.html' : 'mission.html';
  applySpaceLabels();
  initArchiveChoices();
  try{ const data=await apiFetch('/vault'); vaultFiles=data.items||[]; }catch{ vaultFiles=[]; }
  renderVault();
}
el('btnSend').addEventListener('click', async ()=>{ try { persistDraft(); const attachment=selectedArchive; const data=await apiFetch('/expert/request',{ method:'POST', body:{ subject:el('subject').value.trim(), context:el('context').value.trim(), content:el('content').value.trim(), vault_file_ids:selectedVaultIds(), generation_attachment: attachment ? { createdAt: attachment.createdAt || new Date().toISOString(), usecaseLabel: attachment.usecaseLabel || 'Génération IA', prompt: attachment.prompt || {}, result: attachment.result || '' } : null } }); setTicketsBadge(data.wallet); clearDraft(); el('msg').textContent = '✅ Votre demande a été transmise.'; showToast('Demande transmise', 'ok'); } catch(e){ console.error(e); if(e.status===402 && e.data?.error==='expert_limit_reached'){ el('msg').innerHTML='⚠️ Vous avez utilisé toutes vos relectures expertes gratuites. <a href="pricing.html" style="color:#0079c1;font-weight:700">Passez à un abonnement</a> pour continuer à bénéficier de l’expertise de nos conseillers.'; showToast('Quota de relectures atteint', 'warn'); return; } if(e.status===402 && ['no_tickets','trial_expired','public_dossier_limit_reached','private_dossier_limit_reached'].includes(e.data?.error)){ el('msg').textContent='⚠️ Votre période gratuite est terminée ou votre quota gratuit est atteint. Contactez-nous pour définir l’offre adaptée à votre besoin.'; showToast('Accès temporairement limité', 'warn'); return; } el('msg').textContent='Erreur : '+getApiMessage(e); showToast('Envoi impossible', 'err'); } });
['subject','context','content'].forEach((id)=>{ const node=el(id); if(node){ node.addEventListener('input', persistDraft); node.addEventListener('change', persistDraft); }}); document.querySelectorAll('a[href*="vault.html"]').forEach((link)=>link.addEventListener('click', persistDraft)); el('archiveAttachmentSelect').addEventListener('change', ()=>{ updateAttachmentPreview(); persistDraft(); }); restoreDraft(); window.addEventListener('beforeunload', persistDraft); refreshWallet();
