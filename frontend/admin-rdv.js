// ============================================================================
// POPE Online V89.5 — Administration : tableau de bord des rendez-vous
// Agenda des demandes de rendez-vous (diagnostic flash et « Parler à un
// conseiller ») : à confirmer, conseiller désigné, report, notes, confirmation
// envoyée au demandeur, envoi du rendez-vous (.ics) au conseiller.
// ============================================================================
import { apiFetch } from './api.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TZ_LABEL = { 'Europe/Paris': 'Paris', 'America/Martinique': 'Antilles', 'America/Guadeloupe': 'Antilles', 'America/Cayenne': 'Guyane',
  'Indian/Reunion': 'La Réunion', 'Indian/Mayotte': 'Mayotte', 'America/Miquelon': 'St-Pierre-et-Miquelon', 'Pacific/Noumea': 'Nouvelle-Calédonie',
  'Pacific/Tahiti': 'Polynésie', 'Pacific/Wallis': 'Wallis-et-Futuna' };
const STATUS = { new: ['À confirmer', 'yellow'], confirmed: ['Confirmé', 'green'], done: ['Terminé', 'grey'], cancelled: ['Annulé', 'red'], no_show: ['Absent', 'red'] };
const LEVEL = { moderee: 'Vigilance modérée', elevee: 'Vigilance élevée', critique: 'Vigilance critique' };
const MY_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris';

let items = [], team = [], filter = 'upcoming', who = '', q = '', current = null, me = { id: null, role: 'admin' };
const isConseiller = () => me.role === 'conseiller';
const canEdit = (it) => !isConseiller() || !it.assigned_to || it.assigned_to === me.id;

const dayKey = (d, tz = MY_TZ) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const hm = (d, tz = MY_TZ) => new Intl.DateTimeFormat('fr-FR', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(d).replace(':', ' h ');
const dayLabel = (d) => {
  const k = dayKey(d), today = dayKey(new Date()), tomorrow = dayKey(new Date(Date.now() + 864e5));
  const long = new Intl.DateTimeFormat('fr-FR', { timeZone: MY_TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(d);
  return k === today ? `Aujourd'hui · ${long}` : k === tomorrow ? `Demain · ${long}` : long.charAt(0).toUpperCase() + long.slice(1);
};
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const whenOf = (it) => new Date(it.slot_at || it.created_at);
const isOpen = (it) => it.status === 'new' || it.status === 'confirmed';

const ICON = {
  phone: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" fill="currentColor"/></svg>',
  visio: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><rect x="3" y="6" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15 10l6-3v10l-6-3z" fill="currentColor"/></svg>',
};

function visible() {
  const now = Date.now(), qq = q.trim().toLowerCase();
  return items.filter((it) => {
    const t = whenOf(it).getTime();
    if (filter === 'upcoming' && !(isOpen(it) && t >= now - 3 * 3600e3)) return false;
    if (filter === 'todo' && it.status !== 'new') return false;
    if (filter === 'past' && !(t < now - 3600e3 || !isOpen(it))) return false;
    if (who === '__none' && it.assigned_to) return false;
    if (who && who !== '__none' && it.assigned_to !== who) return false;
    if (qq && ![it.name, it.organization, it.email, it.phone, it.title].join(' ').toLowerCase().includes(qq)) return false;
    return true;
  }).sort((a, b) => (filter === 'past' ? -1 : 1) * (whenOf(a) - whenOf(b)));
}

function kpis() {
  const now = Date.now(), today = dayKey(new Date());
  const open = items.filter(isOpen);
  $('#rdvKpiNew').textContent = items.filter((i) => i.status === 'new').length;
  $('#rdvKpiToday').textContent = open.filter((i) => i.slot_at && dayKey(new Date(i.slot_at)) === today).length;
  $('#rdvKpiWeek').textContent = open.filter((i) => i.slot_at && new Date(i.slot_at) >= now && new Date(i.slot_at) - now < 7 * 864e5).length;
  $('#rdvKpiFree').textContent = open.filter((i) => !i.assigned_to).length;
  const badge = $('#sideRdvCount'); if (badge) { const n = items.filter((i) => i.status === 'new').length; badge.textContent = n; badge.hidden = !n; }
}

// Liste « Avec » groupée par profil, avec la charge de chacun (rendez-vous à venir)
function teamOptions(sel) {
  const groups = [['conseiller', 'Conseillers'], ['expert', 'Experts'], ['admin', 'Administrateurs']];
  const list = isConseiller() ? team.filter((m) => m.id === me.id || m.id === sel) : team;
  return `<option value="">Non attribué</option>` + groups.map(([r, l]) => {
    const g = list.filter((m) => m.role === r); if (!g.length) return '';
    return `<optgroup label="${l}">${g.map((m) => `<option value="${esc(m.id)}"${m.id === sel ? ' selected' : ''}>${esc(m.full_name || m.email)}${m.id === me.id ? ' (moi)' : ` (${m.upcoming || 0})`}</option>`).join('')}</optgroup>`;
  }).join('');
}

function row(it) {
  const d = whenOf(it), [sl, sc] = STATUS[it.status] || STATUS.new;
  const local = it.slot_at && it.timezone && it.timezone !== MY_TZ && hm(d, it.timezone) !== hm(d) ? `${hm(d, it.timezone)} chez l'élu · ${TZ_LABEL[it.timezone] || it.timezone}` : (it.slot_at ? (TZ_LABEL[it.timezone] || '') : 'Sans créneau précis');
  const src = it.kind === 'diag'
    ? `<span class="rdv-src">Diagnostic flash${it.level ? ' · ' + esc(LEVEL[it.level] || it.level) : ''}</span>${it.urgent ? '<span class="adm-badge adm-badge-red">Urgent</span>' : ''}`
    : '<span class="rdv-src">Parler à un conseiller</span>';
  return `<article class="rdv-row rdv-${esc(it.status)}" data-key="${it.kind}:${it.id}">
    <div class="rdv-time"><strong>${it.slot_at ? hm(d) : '—'}</strong><small>${esc(local)}</small></div>
    <div class="rdv-who">
      <div class="rdv-name"><span class="rdv-mode rdv-mode-${it.contact_mode === 'visio' ? 'visio' : 'phone'}" title="${it.contact_mode === 'visio' ? 'Visioconférence' : 'Appel téléphonique'}">${ICON[it.contact_mode === 'visio' ? 'visio' : 'phone']}</span>${esc(it.name)}</div>
      <div class="rdv-meta">${esc([it.role, it.organization].filter(Boolean).join(' · ') || '—')}</div>
      <div class="rdv-meta">${src}</div>
      ${it.title ? `<div class="rdv-title">${esc(it.title)}</div>` : ''}
    </div>
    <div class="rdv-assign">${!canEdit(it) ? `<label>Avec<span class="rdv-owner">${esc(it.assignee_name || '—')}</span></label>`
      : isConseiller() && !it.assigned_to ? '<label>Avec<button class="adm-btn adm-btn-primary adm-btn-sm" data-act="take">Je le prends</button></label>'
      : `<label>Avec<select class="adm-input adm-select" data-assign>${teamOptions(it.assigned_to)}</select></label>`}</div>
    <div class="rdv-state"><span class="adm-badge adm-badge-${sc}">${sl}</span>
      <div class="rdv-actions">
        ${canEdit(it) && it.status === 'new' ? '<button class="adm-btn adm-btn-primary adm-btn-sm" data-act="confirm">Confirmer</button>' : ''}
        ${canEdit(it) && it.status === 'confirmed' ? '<button class="adm-btn adm-btn-ghost adm-btn-sm" data-act="done">Terminé</button>' : ''}
        <button class="adm-btn adm-btn-ghost adm-btn-sm" data-act="open">Détails</button>
      </div></div>
  </article>`;
}

function render() {
  kpis();
  const list = visible(), host = $('#rdvList');
  if (!list.length) { host.innerHTML = `<div class="rdv-empty">${filter === 'todo' ? 'Aucun rendez-vous à confirmer.' : 'Aucun rendez-vous pour ce filtre.'}</div>`; return; }
  let html = '', last = '';
  for (const it of list) {
    const k = dayKey(whenOf(it));
    if (k !== last) { html += `<h3 class="rdv-day">${esc(dayLabel(whenOf(it)))}</h3>`; last = k; }
    html += row(it);
  }
  host.innerHTML = html;
}

async function patch(it, body) {
  const r = await apiFetch(`/staff/appointments/${it.kind}/${it.id}`, { method: 'PATCH', body });
  if (body.assigned_to !== undefined) refreshTeam();
  const i = items.findIndex((x) => x.id === it.id); if (i >= 0 && r.item) items[i] = r.item;
  render();
  return r;
}

function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso), p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function openDrawer(it, preset = {}) {
  current = it;
  const d = whenOf(it), dr = $('#rdvDrawer');
  const status = preset.status || it.status;
  dr.innerHTML = `
    <div class="rdv-dr-head"><div><div class="rdv-dr-k">${it.kind === 'diag' ? 'Diagnostic flash' : 'Parler à un conseiller'} · reçu le ${esc(new Date(it.created_at).toLocaleDateString('fr-FR'))}</div>
      <h2>${esc(it.name)}</h2><div class="rdv-meta">${esc([it.role, it.organization].filter(Boolean).join(' · ') || '—')}</div></div>
      <button class="adm-close-btn" data-act="close" aria-label="Fermer">✕</button></div>
    <div class="rdv-dr-body">
      <div class="rdv-contact">
        ${it.phone ? `<a href="tel:${esc(it.phone.replace(/\s/g, ''))}">${ICON.phone} ${esc(it.phone)}</a>` : ''}
        ${it.email ? `<a href="mailto:${esc(it.email)}">✉ ${esc(it.email)}</a>` : ''}
      </div>
      <div class="rdv-when-box"><strong>${it.slot_at ? esc(cap(new Intl.DateTimeFormat('fr-FR', { timeZone: MY_TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(d))) + ' à ' + hm(d) : 'Sans créneau précis'}</strong>
        ${it.slot_at && it.timezone ? `<small>${hm(d, 'Europe/Paris')} à Paris · ${hm(d, it.timezone)} chez l'élu (${esc(TZ_LABEL[it.timezone] || it.timezone)})</small>` : ''}
        ${it.slot ? `<small>Demandé : ${esc(it.slot)}</small>` : ''}</div>
      ${it.title ? `<div class="rdv-block"><div class="rdv-lab">Diagnostic</div><p><strong>${esc(it.title)}</strong></p>${it.summary ? `<p>${esc(it.summary)}</p>` : ''}</div>` : ''}
      ${it.message ? `<div class="rdv-block"><div class="rdv-lab">${it.kind === 'diag' ? 'Description' : 'Message'}</div><p>${esc(it.message)}</p></div>` : ''}
      <div class="adm-form-grid">
        <div class="adm-form-group"><label class="rdv-lab">Statut</label><select class="adm-input adm-select" id="rdvStatus">${Object.entries(STATUS).map(([k, [l]]) => `<option value="${k}"${k === status ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="adm-form-group"><label class="rdv-lab">Conseiller</label><select class="adm-input adm-select" id="rdvAssignee">${teamOptions(it.assigned_to)}</select></div>
        <div class="adm-form-group"><label class="rdv-lab">Créneau (votre heure)</label><input class="adm-input" type="datetime-local" id="rdvSlot" value="${toLocalInput(it.slot_at)}"/></div>
        <div class="adm-form-group"><label class="rdv-lab">Mode</label><select class="adm-input adm-select" id="rdvMode"><option value="phone"${it.contact_mode !== 'visio' ? ' selected' : ''}>Appel téléphonique</option><option value="visio"${it.contact_mode === 'visio' ? ' selected' : ''}>Visioconférence</option></select></div>
      </div>
      <div class="adm-form-group" style="margin-top:14px"><label class="rdv-lab">Notes internes</label><textarea class="adm-input" id="rdvNotes" rows="3" placeholder="Préparation, suite à donner…">${esc(it.notes || '')}</textarea></div>
      <label class="rdv-check"><input type="checkbox" id="rdvNotifyClient" ${preset.status === 'confirmed' && it.email ? 'checked' : ''} ${it.email ? '' : 'disabled'}/> Envoyer la confirmation au demandeur (e-mail avec fichier d'agenda)${it.email ? '' : ' — pas d\'e-mail'}</label>
      <label class="rdv-check"><input type="checkbox" id="rdvNotifyAdvisor" ${preset.status === 'confirmed' ? 'checked' : ''}/> Envoyer le rendez-vous au conseiller désigné (avec fichier d'agenda)</label>
      <p class="adm-msg" id="rdvMsg"></p>
    </div>
    <div class="rdv-dr-foot"><button class="adm-btn adm-btn-ghost" data-act="close">Fermer</button><button class="adm-btn adm-btn-primary" data-act="save">Enregistrer</button></div>`;
  if (!canEdit(it)) { dr.querySelectorAll('select, input, textarea').forEach((x) => { x.disabled = true; }); const sv = dr.querySelector('[data-act="save"]'); if (sv) sv.hidden = true; const m = dr.querySelector('#rdvMsg'); if (m) m.textContent = `Rendez-vous suivi par ${it.assignee_name || 'un autre conseiller'} : lecture seule.`; }
  $('#rdvOverlay').classList.add('open'); dr.classList.add('open');
}
function closeDrawer() { $('#rdvOverlay').classList.remove('open'); $('#rdvDrawer').classList.remove('open'); current = null; }

async function save() {
  const it = current; if (!it) return;
  const body = { status: $('#rdvStatus').value, assigned_to: $('#rdvAssignee').value || null, notes: $('#rdvNotes').value, contact_mode: $('#rdvMode').value };
  const slot = $('#rdvSlot').value; if (slot) { const iso = new Date(slot).toISOString(); if (iso !== (it.slot_at && new Date(it.slot_at).toISOString())) body.slot_at = iso; }
  body.notifyClient = $('#rdvNotifyClient').checked; body.notifyAdvisor = $('#rdvNotifyAdvisor').checked;
  const msg = $('#rdvMsg');
  if (body.notifyAdvisor && !body.assigned_to) { msg.textContent = 'Choisissez le conseiller à qui envoyer le rendez-vous.'; msg.className = 'adm-msg err'; return; }
  if (body.notifyClient && body.status !== 'confirmed') { msg.textContent = 'La confirmation ne peut être envoyée que pour un rendez-vous « Confirmé ».'; msg.className = 'adm-msg err'; return; }
  try {
    const r = await patch(it, body);
    const sent = [r.mails?.client && 'demandeur prévenu', r.mails?.advisor && 'conseiller prévenu'].filter(Boolean).join(', ');
    const failed = (body.notifyClient && !r.mails?.client) || (body.notifyAdvisor && !r.mails?.advisor);
    closeDrawer();
    toast(failed ? 'Enregistré, mais un e-mail n\'a pas pu partir. Vérifiez la configuration de la messagerie.' : 'Rendez-vous enregistré' + (sent ? ' — ' + sent : '') + '.');
  } catch (e) { msg.textContent = 'Enregistrement impossible : ' + (e.message || 'erreur'); msg.className = 'adm-msg err'; }
}

function toast(t) { const el = $('#rdvToast'); el.textContent = t; el.classList.add('show'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 3800); }

export async function loadRdv() {
  $('#rdvList').innerHTML = '<div class="rdv-empty">Chargement…</div>';
  try {
    const [a, t] = await Promise.all([apiFetch('/staff/appointments'), apiFetch('/staff/team')]);
    items = a.items || []; team = t.team || []; me = a.me || me;
    if (isConseiller() && !loadRdv.done) { who = me.id; loadRdv.done = true; }
    fillWho();
    const auto = $('#rdvAuto'); if (auto) auto.style.display = (isConseiller() || !items.some((i) => isOpen(i) && !i.assigned_to && whenOf(i) >= Date.now() - 3600e3) || !team.some((m) => m.role === 'conseiller')) ? 'none' : '';
    const title = document.querySelector('#tabRdv .adm-hero-title'); if (title) title.textContent = isConseiller() ? 'Mes rendez-vous' : 'Rendez-vous';
    render();
  } catch (e) { $('#rdvList').innerHTML = `<div class="rdv-empty">Chargement impossible : ${esc(e.message || 'erreur')}</div>`; }
}

function fillWho() {
  const sel = $('#rdvWho');
  sel.innerHTML = (isConseiller() ? `<option value="${esc(me.id)}">Mes rendez-vous</option><option value="__none">Non attribués</option><option value="">Toute l'équipe</option>`
    : '<option value="">Tous les conseillers</option><option value="__none">Non attribués</option>' + team.map((m) => `<option value="${esc(m.id)}">${esc(m.full_name || m.email)} (${m.upcoming || 0})</option>`).join(''));
  sel.value = who;
}
async function refreshTeam() { try { team = (await apiFetch('/staff/team')).team || team; fillWho(); } catch (_) {} }

// Ouvre l'onglet sur les rendez-vous d'un membre de l'équipe (page Conseillers)
export function setRdvWho(id) { who = id; filter = 'upcoming'; document.querySelectorAll('#rdvFilters [data-f]').forEach((x) => x.classList.toggle('active', x.dataset.f === 'upcoming')); const s = $('#rdvWho'); if (s) s.value = id; render(); }

export function initRdv() {
  $('#rdvAuto')?.addEventListener('click', async () => {
    if (!confirm('Attribuer chaque rendez-vous à venir sans conseiller au conseiller le moins chargé ?')) return;
    try { const r = await apiFetch('/staff/appointments/auto-assign', { method: 'POST' }); toast(`${r.assigned} rendez-vous répartis entre les conseillers.`); loadRdv(); } catch (e) { toast('Répartition impossible : ' + (e.message || 'erreur')); }
  });
  $('#rdvFilters').addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (!b) return; filter = b.dataset.f; document.querySelectorAll('#rdvFilters [data-f]').forEach((x) => x.classList.toggle('active', x === b)); render(); });
  $('#rdvWho').addEventListener('change', (e) => { who = e.target.value; render(); });
  $('#rdvSearch').addEventListener('input', (e) => { q = e.target.value; render(); });
  $('#rdvRefresh').addEventListener('click', loadRdv);
  $('#rdvKpiNewCard').addEventListener('click', () => $('#rdvFilters [data-f="todo"]').click());
  $('#rdvList').addEventListener('change', async (e) => {
    const s = e.target.closest('[data-assign]'); if (!s) return;
    const it = items.find((x) => `${x.kind}:${x.id}` === s.closest('[data-key]').dataset.key);
    try { await patch(it, { assigned_to: s.value || null }); toast(s.value ? 'Conseiller désigné.' : 'Rendez-vous non attribué.'); } catch { toast('Mise à jour impossible.'); }
  });
  $('#rdvList').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const it = items.find((x) => `${x.kind}:${x.id}` === b.closest('[data-key]').dataset.key); if (!it) return;
    if (b.dataset.act === 'take') { try { await patch(it, { assigned_to: me.id }); toast('Rendez-vous ajouté à vos rendez-vous.'); } catch { toast('Ce rendez-vous vient d\'être pris par un autre conseiller.'); loadRdv(); } return; }
    if (b.dataset.act === 'open') openDrawer(it);
    if (b.dataset.act === 'confirm') openDrawer(it, { status: 'confirmed' });
    if (b.dataset.act === 'done') { try { await patch(it, { status: 'done' }); toast('Rendez-vous marqué comme terminé.'); } catch { toast('Mise à jour impossible.'); } }
  });
  $('#rdvDrawer').addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (!b) return; if (b.dataset.act === 'close') closeDrawer(); if (b.dataset.act === 'save') save(); });
  $('#rdvOverlay').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && current) closeDrawer(); });
}
