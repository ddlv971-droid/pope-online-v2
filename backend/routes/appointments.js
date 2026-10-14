// ============================================================================
// POPE Online V89.5 — Tableau de bord des rendez-vous (administrateurs)
// Réunit les demandes de rendez-vous du diagnostic flash et de la fenêtre
// « Parler à un conseiller » (rappel téléphonique ou visio) :
//   GET   /staff/appointments              liste (passé récent et à venir)
//   PATCH /staff/appointments/:kind/:id    statut, conseiller désigné, créneau, notes
//   POST  /staff/appointments/auto-assign  répartition des rendez-vous sans conseiller (admin)
//   GET   /staff/team                      conseillers, experts, administrateurs, avec leur charge
// V89.6 : accessible aux administrateurs ET aux conseillers (préfixe /staff, hors du
// routeur /admin réservé aux administrateurs). Un conseiller ne modifie que ses
// rendez-vous ou ceux qui ne sont attribués à personne, et ne peut se les attribuer
// qu'à lui-même.
// À la confirmation, le demandeur peut être prévenu par e-mail ; le conseiller
// désigné reçoit le rendez-vous avec un fichier d'agenda (.ics).
// ============================================================================
import express from 'express';
import { withClient } from '../db/index.js';
import { sendMail } from '../services/mailer.js';
import { requireStaff } from '../middleware/auth.js';

const router = express.Router();
const KINDS = { diag: 'diag_flash_requests', contact: 'contact_requests' };
const STATUSES = new Set(['new', 'confirmed', 'done', 'cancelled', 'no_show']);
const UUID = /^[0-9a-f-]{36}$/i;
const clean = (v, max = 2000) => String(v ?? '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').trim().slice(0, max);
const PHONE = '09 70 70 30 55';
const TZ_LABEL = { 'Europe/Paris': 'Paris', 'America/Martinique': 'Antilles', 'America/Guadeloupe': 'Antilles', 'America/Cayenne': 'Guyane',
  'Indian/Reunion': 'La Réunion', 'Indian/Mayotte': 'Mayotte', 'America/Miquelon': 'Saint-Pierre-et-Miquelon', 'Pacific/Noumea': 'Nouvelle-Calédonie',
  'Pacific/Tahiti': 'Polynésie', 'Pacific/Wallis': 'Wallis-et-Futuna' };

function fmtWhen(iso, tz) {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('fr-FR', { timeZone: tz || 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })
      .format(new Date(iso)).replace(':', ' h ');
  } catch { return new Date(iso).toISOString(); }
}

function ics({ iso, minutes = 15, title, description, organizer }) {
  const start = new Date(iso), end = new Date(start.getTime() + minutes * 60000);
  const f = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const e = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => '\\' + c);
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//POPE Online//Rendez-vous//FR', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${f(start)}-${Math.random().toString(36).slice(2)}@pope-online.com`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(start)}`, `DTEND:${f(end)}`,
    `SUMMARY:${e(title)}`, `DESCRIPTION:${e(description)}`, organizer ? `ORGANIZER;CN=${e(organizer.name)}:mailto:${organizer.email}` : null,
    'STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
}

const LIST_SQL = `
  with r as (
    select 'diag'::text as kind, d.id, d.created_at, d.name, d.email, d.phone, d.role, d.organization, d.slot, d.slot_at, d.timezone,
           coalesce(d.contact_mode, 'phone') as contact_mode,
           case d.status when 'contacted' then 'confirmed' when 'converted' then 'done' when 'closed' then 'done' else d.status end as status,
           d.assigned_to, d.notes, d.title, d.summary, d.level, d.urgent, d.free_text as message, d.domain
      from diag_flash_requests d
    union all
    select 'contact', c.id, c.created_at, c.name, c.email, c.phone, c.role, c.organization, c.slot, c.slot_at, c.timezone,
           coalesce(c.contact_mode, case c.subject when 'visio' then 'visio' else 'phone' end),
           case c.status when 'contacted' then 'confirmed' when 'closed' then 'done' else c.status end,
           c.assigned_to, c.notes, null, null, null, false, c.message, null
      from contact_requests c where c.subject in ('rappel', 'visio')
  )
  select r.*, u.full_name as assignee_name, u.email as assignee_email
    from r left join users u on u.id = r.assigned_to
   where coalesce(r.slot_at, r.created_at) > now() - interval '120 days'
   order by coalesce(r.slot_at, r.created_at) asc
   limit 500`;

router.get('/staff/appointments', requireStaff, async (req, res) => {
  try {
    const r = await withClient((c) => c.query(LIST_SQL));
    res.json({ items: r.rows, now: new Date().toISOString(), me: { id: req.user.sub, role: req.user.role } });
  } catch (e) { console.error('[rendez-vous] liste :', e.message); res.status(500).json({ error: 'server_error' }); }
});

const TEAM_SQL = `
  select u.id, u.full_name, u.email, u.role,
         (select count(*) from diag_flash_requests d where d.assigned_to = u.id and d.status in ('new', 'confirmed', 'contacted') and coalesce(d.slot_at, d.created_at) >= now() - interval '1 hour')::int
       + (select count(*) from contact_requests c where c.assigned_to = u.id and c.subject in ('rappel', 'visio') and c.status in ('new', 'confirmed', 'contacted') and coalesce(c.slot_at, c.created_at) >= now() - interval '1 hour')::int as upcoming
    from users u
   where u.role in ('conseiller', 'expert', 'admin')
   order by case u.role when 'conseiller' then 0 when 'expert' then 1 else 2 end, u.full_name asc nulls last`;

router.get('/staff/team', requireStaff, async (_req, res) => {
  try {
    const r = await withClient((c) => c.query(TEAM_SQL));
    res.json({ team: r.rows });
  } catch (e) { console.error('[rendez-vous] équipe :', e.message); res.status(500).json({ error: 'server_error' }); }
});

router.patch('/staff/appointments/:kind/:id', requireStaff, async (req, res) => {
  const table = KINDS[req.params.kind];
  if (!table) return res.status(400).json({ error: 'invalid_kind' });
  if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'invalid_id' });
  const b = req.body || {};
  const isConseiller = req.user.role === 'conseiller';
  if (isConseiller && b.assigned_to !== undefined && b.assigned_to !== null && b.assigned_to !== req.user.sub) return res.status(403).json({ error: 'assign_self_only' });
  const sets = []; const vals = [];
  const set = (col, v) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
  if (b.status !== undefined) { if (!STATUSES.has(String(b.status))) return res.status(400).json({ error: 'invalid_status' }); set('status', String(b.status)); }
  if (b.assigned_to !== undefined) {
    if (b.assigned_to !== null && !UUID.test(String(b.assigned_to))) return res.status(400).json({ error: 'invalid_assignee' });
    set('assigned_to', b.assigned_to);
  }
  if (b.notes !== undefined) set('notes', clean(b.notes, 4000) || null);
  if (b.slot_at !== undefined) {
    const d = new Date(String(b.slot_at));
    if (isNaN(d)) return res.status(400).json({ error: 'invalid_slot' });
    set('slot_at', d.toISOString());
  }
  if (b.contact_mode !== undefined) { if (!['phone', 'visio'].includes(b.contact_mode)) return res.status(400).json({ error: 'invalid_mode' }); set('contact_mode', b.contact_mode); }
  if (!sets.length) return res.status(400).json({ error: 'nothing_to_update' });
  set('updated_at', new Date().toISOString());

  let row;
  try {
    row = await withClient(async (c) => {
      if (isConseiller) {
        const cur = await c.query(`select assigned_to from ${table} where id = $1`, [req.params.id]);
        const owner = cur.rows[0]?.assigned_to;
        if (cur.rowCount && owner && owner !== req.user.sub) { const e = new Error('not_your_appointment'); e.code403 = true; throw e; }
      }
      if (b.assigned_to) {
        const u = await c.query(`select 1 from users where id = $1 and role in ('conseiller', 'admin', 'expert')`, [b.assigned_to]);
        if (!u.rowCount) { const e = new Error('invalid_assignee'); e.code400 = true; throw e; }
      }
      vals.push(req.params.id);
      const up = await c.query(`update ${table} set ${sets.join(', ')} where id = $${vals.length} returning id`, vals);
      if (!up.rowCount) return null;
      const r = await c.query(`select * from (${LIST_SQL.replace('limit 500', '')}) x where x.id = $1`, [req.params.id]);
      return r.rows[0] || null;
    });
  } catch (e) {
    if (e.code400) return res.status(400).json({ error: e.message });
    if (e.code403) return res.status(403).json({ error: e.message });
    console.error('[rendez-vous] mise à jour :', e.message); return res.status(500).json({ error: 'server_error' });
  }
  if (!row) return res.status(404).json({ error: 'not_found' });

  // Envois d'e-mails facultatifs
  const mails = { client: false, advisor: false };
  const how = row.contact_mode === 'visio' ? 'visioconférence' : 'appel téléphonique';
  const advisor = row.assignee_name || 'un conseiller Pope Online';
  if (row.slot_at && b.notifyClient && row.email && row.status === 'confirmed') {
    try {
      const whenClient = fmtWhen(row.slot_at, row.timezone);
      await sendMail({
        to: row.email, subject: 'POPE Online — Votre rendez-vous est confirmé',
        text: `Bonjour ${row.name},\n\nVotre rendez-vous est confirmé : ${how}, ${whenClient}${row.timezone && row.timezone !== 'Europe/Paris' ? ' (votre heure locale)' : ''}, avec ${advisor}.\n` +
          (row.contact_mode === 'visio' ? 'Le lien de connexion vous sera envoyé avant le rendez-vous.\n' : `Nous vous appellerons au ${row.phone || 'numéro indiqué'}.\n`) +
          `\nEn cas d'empêchement, appelez-nous au ${PHONE} ou répondez à ce message.\n\nL'équipe POPE Online\ncontact@pope-online.com`,
        attachments: [{ filename: 'rendez-vous-pope-online.ics', type: 'text/calendar', content: Buffer.from(ics({ iso: row.slot_at, title: `Pope Online — ${how} avec ${advisor}`, description: `Rendez-vous confirmé. En cas d'empêchement : ${PHONE}.` })).toString('base64') }],
      });
      mails.client = true;
    } catch (e) { console.error('[rendez-vous] e-mail demandeur :', e.message); }
  }
  if (row.slot_at && b.notifyAdvisor && row.assignee_email) {
    try {
      const lines = [
        `Rendez-vous ${row.status === 'confirmed' ? 'confirmé' : 'à confirmer'} : ${how}, ${fmtWhen(row.slot_at, 'Europe/Paris')} (heure de Paris)` +
          (row.timezone && row.timezone !== 'Europe/Paris' ? `, soit ${fmtWhen(row.slot_at, row.timezone)} chez le demandeur (${TZ_LABEL[row.timezone] || row.timezone})` : ''),
        '', `Demandeur : ${row.name}${row.role ? ', ' + row.role : ''}`, `Collectivité : ${row.organization || '—'}`,
        `Téléphone : ${row.phone || '—'}`, `E-mail : ${row.email || '—'}`,
        row.title ? `Diagnostic flash : ${row.title}${row.summary ? ' — ' + row.summary : ''}` : 'Origine : fenêtre « Parler à un conseiller »',
        '', row.message ? `Message : ${row.message}` : '', row.notes ? `Notes internes : ${row.notes}` : '',
      ].filter((x, i, a) => x !== '' || a[i - 1] !== '');
      await sendMail({
        to: row.assignee_email, replyTo: row.email || undefined,
        subject: `[POPE Online] Rendez-vous — ${row.name} — ${fmtWhen(row.slot_at, 'Europe/Paris')}`,
        text: lines.join('\n'),
        attachments: [{ filename: 'rendez-vous.ics', type: 'text/calendar', content: Buffer.from(ics({ iso: row.slot_at, title: `RDV ${row.name} — ${how}`, description: lines.join('\n') })).toString('base64') }],
      });
      mails.advisor = true;
    } catch (e) { console.error('[rendez-vous] e-mail conseiller :', e.message); }
  }
  res.json({ ok: true, item: row, mails });
});

// Répartition automatique : chaque rendez-vous à venir sans conseiller va au
// conseiller le moins chargé (à égalité, ordre alphabétique). Administrateurs seulement.
router.post('/staff/appointments/auto-assign', requireStaff, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  try {
    const out = await withClient(async (c) => {
      const team = (await c.query(TEAM_SQL)).rows.filter((m) => m.role === 'conseiller');
      if (!team.length) return { assigned: 0, reason: 'no_conseiller' };
      const open = (await c.query(`select * from (${LIST_SQL.replace('limit 500', '')}) x
         where x.assigned_to is null and x.status in ('new', 'confirmed') and coalesce(x.slot_at, x.created_at) >= now() - interval '1 hour'
         order by coalesce(x.slot_at, x.created_at) asc`)).rows;
      const load = new Map(team.map((m) => [m.id, m.upcoming]));
      const done = [];
      for (const it of open) {
        const pick = team.slice().sort((a, b) => (load.get(a.id) - load.get(b.id)) || String(a.full_name || '').localeCompare(String(b.full_name || '')))[0];
        await c.query(`update ${KINDS[it.kind]} set assigned_to = $1, updated_at = now() where id = $2 and assigned_to is null`, [pick.id, it.id]);
        load.set(pick.id, load.get(pick.id) + 1);
        done.push({ id: it.id, to: pick.full_name || pick.email });
      }
      return { assigned: done.length, details: done };
    });
    res.json(out);
  } catch (e) { console.error('[rendez-vous] répartition :', e.message); res.status(500).json({ error: 'server_error' }); }
});

export default router;
