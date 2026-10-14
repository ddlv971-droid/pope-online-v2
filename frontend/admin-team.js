// ============================================================================
// POPE Online V89.6 — Administration : gestion des profils et des assignations
// Toute inscription est un client. Un administrateur peut faire passer un compte
// en expert, conseiller ou administrateur : il apparaît alors sur la page de son
// profil. Experts : portefeuille de clients (ajout, retrait, clients sans expert).
// Conseillers : charge de rendez-vous. Administrateurs : accès complet.
// ============================================================================
import { apiFetch, getApiMessage } from './api.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ROLE_LABEL = { client: 'Client', expert: 'Expert', conseiller: 'Conseiller', admin: 'Administrateur' };
const initials = (m) => (m.full_name || m.email || '?').split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
const fmt = (d, o = { day: 'numeric', month: 'short', year: 'numeric' }) => (d ? new Date(d).toLocaleDateString('fr-FR', o) : '—');
const fmtSlot = (d) => (d ? new Date(d).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).replace(':', ' h ') : '—');

let data = null, users = [], view = 'expert', q = '';
let hooks = { reloadUsers: async () => {}, showToast: () => {}, openRdvFor: () => {} };

// ── Carte des assignations, partagée avec la liste des clients et la fiche client ──
export function expertsOfClient(clientId) {
  if (!data) return [];
  return data.experts.filter((e) => e.clients.some((c) => c.client_id === clientId));
}
export function allExperts() { return data ? data.experts : []; }

export async function loadTeamData() {
  data = await apiFetch('/admin/team-overview');
  return data;
}

async function changeRole(user, role) {
  const labels = { expert: 'expert', conseiller: 'conseiller', admin: 'administrateur', client: 'client' };
  const warn = role === 'admin' ? '\n\nUn administrateur a accès à tout le tableau de bord.' : role === 'client' ? '\n\nSes rendez-vous à venir repasseront « sans conseiller » et son portefeuille de clients (s\'il est expert) sera libéré.' : '';
  if (!confirm(`Passer ${user.full_name || user.email} en ${labels[role]} ?${warn}`)) return false;
  try {
    const r = await apiFetch(`/admin/users/${user.id}/role`, { method: 'PATCH', body: { role } });
    const extra = [r.removedAssignments && `${r.removedAssignments} client(s) libéré(s)`, r.releasedAppointments && `${r.releasedAppointments} rendez-vous à réattribuer`].filter(Boolean).join(', ');
    hooks.showToast(`Profil mis à jour : ${ROLE_LABEL[role]}${extra ? ' — ' + extra : ''}`, 'ok');
    await Promise.all([hooks.reloadUsers(), loadTeamData()]);
    render();
    return true;
  } catch (e) {
    const m = { last_admin: 'Impossible : c\'est le dernier administrateur.', cannot_demote_self: 'Vous ne pouvez pas retirer vos propres droits d\'administrateur.' }[getApiMessage(e)] || getApiMessage(e);
    hooks.showToast(m, 'err'); return false;
  }
}

async function assign(expertId, clientId) {
  await apiFetch('/admin/expert-assignments', { method: 'POST', body: { expertId, clientId } });
  await loadTeamData(); render(); hooks.afterAssign && hooks.afterAssign();
}
async function unassign(expertId, clientId) {
  await apiFetch('/admin/expert-assignments', { method: 'DELETE', body: { expertId, clientId } });
  await loadTeamData(); render(); hooks.afterAssign && hooks.afterAssign();
}

function roleSelect(m) {
  return `<select class="adm-input adm-select tm-role" data-role-of="${esc(m.id)}" aria-label="Profil">${Object.entries(ROLE_LABEL).map(([k, l]) => `<option value="${k}"${k === m.role ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
}

function clientOptions(exclude = new Set()) {
  return users.filter((u) => (u.role || 'client') === 'client' && !exclude.has(u.id))
    .map((u) => `<option value="${esc(u.id)}">${esc(u.full_name || u.email)}${u.organization ? ' — ' + esc(u.organization) : ''}</option>`).join('');
}

function head(title, sub, kpis) {
  return `<div class="adm-hero"><div class="adm-hero-header"><div><div class="adm-hero-title">${title}</div><div class="adm-hero-sub">${sub}</div></div>
    <button class="adm-btn adm-btn-ghost adm-btn-sm" data-tm="refresh">🔄 Actualiser</button></div>
    <div class="adm-kpis">${kpis.map(([l, v, c]) => `<div class="adm-kpi"><div class="adm-kpi-label">${l}</div><div class="adm-kpi-value"${c ? ` style="color:${c}"` : ''}>${v}</div></div>`).join('')}</div></div>`;
}

function promoteBox(role) {
  const candidates = users.filter((u) => (u.role || 'client') !== role);
  return `<div class="adm-card"><div class="adm-card-head"><div class="adm-card-title">Ajouter un ${ROLE_LABEL[role].toLowerCase()}</div></div>
    <div class="adm-card-body tm-promote">
      <input class="adm-input" list="tmCand-${role}" data-promote-input="${role}" placeholder="Rechercher un compte existant (nom ou e-mail)…"/>
      <datalist id="tmCand-${role}">${candidates.map((u) => `<option value="${esc(u.email)}">${esc(u.full_name || '')}${u.role && u.role !== 'client' ? ' · ' + ROLE_LABEL[u.role] : ''}</option>`).join('')}</datalist>
      <button class="adm-btn adm-btn-primary adm-btn-sm" data-promote="${role}">Passer en ${ROLE_LABEL[role].toLowerCase()}</button>
      <span class="tm-hint">Pas encore de compte ? Créez-le dans « Créer un compte », puis ajoutez-le ici.</span>
    </div></div>`;
}

function memberHead(m, extra = '') {
  return `<div class="tm-head"><div class="tm-av">${esc(initials(m))}</div>
    <div class="tm-id"><strong>${esc(m.full_name || '—')}</strong><span>${esc(m.email)}</span>${m.organization ? `<span>${esc(m.organization)}</span>` : ''}</div>
    <div class="tm-role-box"><label>Profil</label>${roleSelect(m)}</div></div>${extra}`;
}

function renderExperts() {
  const ex = data.experts.filter((m) => !q || [m.full_name, m.email].join(' ').toLowerCase().includes(q));
  const orphans = data.clients_without_expert;
  const cards = ex.map((m) => {
    const ids = new Set(m.clients.map((c) => c.client_id));
    const pending = m.clients.reduce((n, c) => n + c.pending, 0);
    return `<article class="tm-card">${memberHead(m, `<div class="tm-stats"><span><b>${m.clients.length}</b> client${m.clients.length > 1 ? 's' : ''}</span><span><b>${pending}</b> demande${pending > 1 ? 's' : ''} en cours</span><span>Dernière connexion : ${fmt(m.last_login_at)}</span></div>`)}
      <div class="tm-list">${m.clients.length ? m.clients.map((c) => `<div class="tm-client"><div><strong>${esc(c.full_name || c.email)}</strong><span>${esc(c.organization || c.email)}</span></div>
        ${c.pending ? `<span class="adm-badge adm-badge-yellow">${c.pending} en cours</span>` : `<span class="adm-badge adm-badge-grey">${c.done} traitée${c.done > 1 ? 's' : ''}</span>`}
        <button class="tm-x" title="Retirer ce client" data-unassign="${esc(m.id)}|${esc(c.client_id)}">✕</button></div>`).join('') : '<div class="tm-empty">Aucun client pour l\'instant.</div>'}</div>
      <div class="tm-add"><select class="adm-input adm-select" data-add-for="${esc(m.id)}"><option value="">Ajouter un client au portefeuille…</option>${clientOptions(ids)}</select></div>
    </article>`;
  }).join('');
  const expertOpts = data.experts.map((e) => `<option value="${esc(e.id)}">${esc(e.full_name || e.email)} (${e.clients.length})</option>`).join('');
  return head('Experts', 'Comptes au profil « expert » et leurs portefeuilles de clients', [
    ['Experts', data.experts.length], ['Clients suivis', data.counts.assignments], ['Clients sans expert', orphans.length, orphans.length ? 'var(--yellow)' : ''], ['Clients au total', data.counts.clients]])
    + `<div class="adm-card"><div class="adm-card-head"><div class="adm-card-title">Clients sans expert</div><span class="tm-hint">${orphans.length ? 'Ceux qui ont une demande en cours apparaissent en premier.' : ''}</span></div>
      <div class="adm-card-body">${orphans.length ? `<div class="tm-orphans">${orphans.slice(0, 60).map((c) => `<div class="tm-orphan"><div><strong>${esc(c.full_name || c.email)}</strong><span>${esc(c.organization || c.email)} · inscrit le ${fmt(c.created_at)}</span></div>
        ${c.pending ? `<span class="adm-badge adm-badge-yellow">${c.pending} demande${c.pending > 1 ? 's' : ''}</span>` : ''}
        <select class="adm-input adm-select" data-orphan="${esc(c.id)}"${data.experts.length ? '' : ' disabled'}><option value="">${data.experts.length ? 'Confier à…' : 'Aucun expert'}</option>${expertOpts}</select></div>`).join('')}</div>` : '<div class="tm-empty">Tous les clients ont un expert référent.</div>'}</div></div>`
    + `<div class="tm-toolbar"><input class="adm-search" data-tm="search" placeholder="Rechercher un expert…" value="${esc(q)}"/></div>`
    + `<div class="tm-grid">${cards || '<div class="tm-empty">Aucun expert. Ajoutez-en un ci-dessous.</div>'}</div>` + promoteBox('expert');
}

function renderConseillers() {
  const list = data.conseillers.filter((m) => !q || [m.full_name, m.email].join(' ').toLowerCase().includes(q));
  const total = data.conseillers.reduce((n, m) => n + m.upcoming, 0);
  const max = Math.max(1, ...data.conseillers.map((m) => m.upcoming));
  const cards = list.map((m) => `<article class="tm-card">${memberHead(m)}
      <div class="tm-load"><div class="tm-load-top"><span><b>${m.upcoming}</b> rendez-vous à venir</span><span>Prochain : ${fmtSlot(m.next_slot)}</span></div>
        <div class="tm-bar"><i style="width:${Math.round((m.upcoming / max) * 100)}%"></i></div>
        <div class="tm-load-sub">${m.done_30d} terminé${m.done_30d > 1 ? 's' : ''} sur 30 jours · dernière connexion : ${fmt(m.last_login_at)}</div></div>
      <div class="tm-actions"><button class="adm-btn adm-btn-ghost adm-btn-sm" data-rdv-for="${esc(m.id)}">Voir ses rendez-vous</button></div>
    </article>`).join('');
  return head('Conseillers', 'Comptes au profil « conseiller » : ils reçoivent les rendez-vous et se connectent sur l\'onglet Rendez-vous', [
    ['Conseillers', data.conseillers.length], ['Rendez-vous attribués à venir', total], ['Rendez-vous sans conseiller', data.counts.unassigned_rdv, data.counts.unassigned_rdv ? 'var(--yellow)' : '']])
    + `<div class="tm-toolbar"><input class="adm-search" data-tm="search" placeholder="Rechercher un conseiller…" value="${esc(q)}"/>
       ${data.counts.unassigned_rdv && data.conseillers.length ? `<button class="adm-btn adm-btn-primary adm-btn-sm" data-tm="autoassign">Répartir les ${data.counts.unassigned_rdv} rendez-vous sans conseiller</button>` : ''}</div>`
    + `<div class="tm-grid">${cards || '<div class="tm-empty">Aucun conseiller. Ajoutez-en un ci-dessous : il pourra se connecter et gérer ses rendez-vous.</div>'}</div>` + promoteBox('conseiller');
}

function renderAdmins() {
  const cards = data.admins.map((m) => `<article class="tm-card">${memberHead(m, `<div class="tm-stats"><span>Créé le ${fmt(m.created_at)}</span><span>Dernière connexion : ${fmt(m.last_login_at)}</span>${m.upcoming ? `<span><b>${m.upcoming}</b> rendez-vous à venir</span>` : ''}</div>`)}</article>`).join('');
  return head('Administrateurs', 'Accès complet au tableau de bord. Il doit toujours en rester au moins un.', [['Administrateurs', data.admins.length]])
    + `<div class="tm-grid">${cards}</div>` + promoteBox('admin');
}

function render() {
  const host = $('#tabTeam'); if (!host || !data) return;
  host.innerHTML = view === 'expert' ? renderExperts() : view === 'conseiller' ? renderConseillers() : renderAdmins();
  const s = host.querySelector('[data-tm="search"]'); if (s && q) { s.focus(); s.setSelectionRange(q.length, q.length); }
}

export async function loadTeam(v, usersCache) {
  view = v; q = ''; users = usersCache || users;
  const host = $('#tabTeam'); host.innerHTML = '<div class="tm-empty">Chargement…</div>';
  try { await loadTeamData(); render(); } catch (e) { host.innerHTML = `<div class="tm-empty">Chargement impossible : ${esc(getApiMessage(e))}</div>`; }
}

export function setUsers(u) { users = u || []; }

export function initTeam(h) {
  hooks = { ...hooks, ...h };
  const host = $('#tabTeam');
  host.addEventListener('input', (e) => { if (e.target.matches('[data-tm="search"]')) { q = e.target.value.trim().toLowerCase(); render(); } });
  host.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.matches('[data-role-of]')) {
      const m = [...data.experts, ...data.conseillers, ...data.admins].find((x) => x.id === t.dataset.roleOf);
      if (!(await changeRole(m, t.value))) t.value = m.role;
    }
    if (t.matches('[data-add-for]') && t.value) { try { await assign(t.dataset.addFor, t.value); hooks.showToast('Client ajouté au portefeuille.', 'ok'); } catch (e2) { hooks.showToast(getApiMessage(e2), 'err'); } }
    if (t.matches('[data-orphan]') && t.value) { try { await assign(t.value, t.dataset.orphan); hooks.showToast('Client confié à l\'expert.', 'ok'); } catch (e2) { hooks.showToast(getApiMessage(e2), 'err'); } }
  });
  host.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.tm === 'refresh') loadTeam(view);
    if (b.dataset.unassign) {
      const [ex, cl] = b.dataset.unassign.split('|');
      if (!confirm('Retirer ce client du portefeuille de l\'expert ?')) return;
      try { await unassign(ex, cl); hooks.showToast('Client retiré du portefeuille.', 'ok'); } catch (e2) { hooks.showToast(getApiMessage(e2), 'err'); }
    }
    if (b.dataset.promote) {
      const role = b.dataset.promote, v = (host.querySelector(`[data-promote-input="${role}"]`).value || '').trim().toLowerCase();
      const u = users.find((x) => x.email.toLowerCase() === v) || users.find((x) => (x.full_name || '').toLowerCase() === v);
      if (!u) { hooks.showToast('Compte introuvable : choisissez-le dans la liste proposée.', 'err'); return; }
      await changeRole({ ...u, role: u.role || 'client' }, role);
    }
    if (b.dataset.rdvFor) hooks.openRdvFor(b.dataset.rdvFor);
    if (b.dataset.tm === 'autoassign') {
      if (!confirm('Attribuer chaque rendez-vous à venir sans conseiller au conseiller le moins chargé ?')) return;
      try { const r = await apiFetch('/staff/appointments/auto-assign', { method: 'POST' }); hooks.showToast(`${r.assigned} rendez-vous répartis.`, 'ok'); loadTeam('conseiller'); hooks.afterAssign && hooks.afterAssign(); } catch (e2) { hooks.showToast(getApiMessage(e2), 'err'); }
    }
  });
}

// Bloc « Experts référents » de la fiche client
export function renderClientExperts(host, clientId) {
  if (!host) return;
  const mine = expertsOfClient(clientId);
  const others = allExperts().filter((e) => !mine.includes(e));
  host.innerHTML = `<div class="adm-detail-section-title">Experts référents</div>
    <div class="tm-chips">${mine.length ? mine.map((e) => `<span class="tm-chip">${esc(e.full_name || e.email)}<button title="Retirer" data-cx-del="${esc(e.id)}">✕</button></span>`).join('') : '<span class="tm-hint">Aucun expert référent.</span>'}</div>
    ${allExperts().length ? `<select class="adm-input adm-select" data-cx-add style="margin-top:10px"><option value="">Confier à un expert…</option>${others.map((e) => `<option value="${esc(e.id)}">${esc(e.full_name || e.email)} (${e.clients.length} client${e.clients.length > 1 ? 's' : ''})</option>`).join('')}</select>` : '<span class="tm-hint">Aucun compte expert : créez-en un depuis la page Experts.</span>'}`;
  host.onchange = async (e) => { if (e.target.matches('[data-cx-add]') && e.target.value) { try { await assign(e.target.value, clientId); renderClientExperts(host, clientId); hooks.showToast('Expert référent ajouté.', 'ok'); } catch (e2) { hooks.showToast(getApiMessage(e2), 'err'); } } };
  host.onclick = async (e) => { const b = e.target.closest('[data-cx-del]'); if (!b) return; try { await unassign(b.dataset.cxDel, clientId); renderClientExperts(host, clientId); hooks.showToast('Expert retiré.', 'ok'); } catch (e2) { hooks.showToast(getApiMessage(e2), 'err'); } };
}
