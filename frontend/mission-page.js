import { apiFetch, getApiMessage } from './api.js';
import { requireLogin, wireLogout, setTicketsBadge, showToast } from './app.js';
if (!requireLogin('mission.html')) {}
wireLogout();
const el=(id)=>document.getElementById(id); let currentUser=null, vaultFiles=[];
function selectedVaultIds(){ return Array.from(document.querySelectorAll('[data-vault-file]:checked')).map((n)=>n.value); }
function renderVault(){ const host=el('vaultMissionList'); host.innerHTML = vaultFiles.length ? vaultFiles.map((item)=>`<label class="vault-inline-item"><input type="checkbox" data-vault-file value="${item.id}"><div><strong>${item.name}</strong><span>expire le ${new Date(item.expiresAt).toLocaleString('fr-FR')}</span></div></label>`).join('') : '<div class="muted">Aucune pièce temporaire disponible pour le moment.</div>'; }
async function refreshWallet(){ try{ const me=await apiFetch('/auth/me'); currentUser=me.user||null; setTicketsBadge(me.wallet); document.getElementById('missionHomeLink').href = currentUser?.accountSpace === 'private' ? 'dashboard-private.html' : 'dashboard.html'; }catch{} try{ const data=await apiFetch('/vault'); vaultFiles=data.items||[]; }catch{ vaultFiles=[]; } renderVault(); }
el('btnSend').addEventListener('click', async ()=>{ try { const data=await apiFetch('/mission/request',{ method:'POST', body:{ subject:el('subject').value.trim(), context:el('context').value.trim(), content:el('content').value.trim(), vault_file_ids:selectedVaultIds() } }); setTicketsBadge(data.wallet); el('msg').textContent='✅ Votre demande a été transmise. Nous revenons vers vous après analyse et cadrage.'; showToast('Demande transmise', 'ok'); } catch(e){ console.error(e); el('msg').textContent='Erreur : '+getApiMessage(e); showToast('Envoi impossible', 'err'); } }); refreshWallet();
