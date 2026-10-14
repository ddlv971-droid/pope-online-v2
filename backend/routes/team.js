// ============================================================================
// POPE Online V89.6 — Gestion des profils (administrateurs)
//   GET   /admin/team-overview      experts (et leurs clients), conseillers (et leurs
//                                   rendez-vous), administrateurs, clients sans expert
//   PATCH /admin/users/:id/role     changer le profil : client, expert, conseiller, admin
// Toute inscription est un client (valeur par défaut de users.role, patch V95).
// ============================================================================
import express from 'express';
import { withClient } from '../db/index.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();
const ROLES = ['client', 'expert', 'conseiller', 'admin'];
const UUID = /^[0-9a-f-]{36}$/i;

const OPEN_RDV = (alias) => `${alias}.status in ('new', 'confirmed', 'contacted') and coalesce(${alias}.slot_at, ${alias}.created_at) >= now() - interval '1 hour'`;

router.get('/admin/team-overview', requireAdmin, async (_req, res) => {
  try {
    const data = await withClient(async (c) => {
      const staff = (await c.query(`
        select u.id, u.full_name, u.email, u.organization, u.role, u.created_at, u.last_login_at
          from users u where u.role in ('expert', 'conseiller', 'admin')
         order by u.full_name asc nulls last, u.email asc`)).rows;
      const assignments = (await c.query(`
        select ea.expert_id, ea.client_id, ea.assigned_at, u.full_name, u.email, u.organization,
               (select count(*) from expert_requests er where er.user_id = u.id and er.status not in ('replied', 'closed'))::int as pending,
               (select count(*) from expert_requests er where er.user_id = u.id and er.status in ('replied', 'closed'))::int as done
          from expert_assignments ea join users u on u.id = ea.client_id
         order by u.full_name asc nulls last`)).rows;
      const rdv = (await c.query(`
        select assigned_to, count(*) filter (where ${OPEN_RDV('r')})::int as upcoming,
               min(slot_at) filter (where ${OPEN_RDV('r')} and slot_at is not null) as next_slot,
               count(*) filter (where r.status in ('done', 'converted', 'closed') and coalesce(r.slot_at, r.created_at) > now() - interval '30 days')::int as done_30d
          from (select assigned_to, status, slot_at, created_at from diag_flash_requests
                union all
                select assigned_to, status, slot_at, created_at from contact_requests where subject in ('rappel', 'visio')) r
         where assigned_to is not null group by assigned_to`)).rows;
      const unassignedRdv = (await c.query(`
        select (select count(*) from diag_flash_requests r where r.assigned_to is null and ${OPEN_RDV('r')})::int
             + (select count(*) from contact_requests r where r.assigned_to is null and r.subject in ('rappel', 'visio') and ${OPEN_RDV('r')})::int as n`)).rows[0].n;
      const orphans = (await c.query(`
        select u.id, u.full_name, u.email, u.organization, u.created_at,
               (select count(*) from expert_requests er where er.user_id = u.id and er.status not in ('replied', 'closed'))::int as pending
          from users u
         where u.role = 'client' and not exists (select 1 from expert_assignments ea where ea.client_id = u.id)
         order by pending desc, u.created_at desc limit 300`)).rows;
      const clientsCount = (await c.query(`select count(*)::int as n from users where role = 'client'`)).rows[0].n;
      const byRdv = new Map(rdv.map((r) => [r.assigned_to, r]));
      const withRdv = (m) => ({ ...m, upcoming: byRdv.get(m.id)?.upcoming || 0, next_slot: byRdv.get(m.id)?.next_slot || null, done_30d: byRdv.get(m.id)?.done_30d || 0 });
      return {
        experts: staff.filter((m) => m.role === 'expert').map((m) => ({ ...withRdv(m), clients: assignments.filter((a) => a.expert_id === m.id) })),
        conseillers: staff.filter((m) => m.role === 'conseiller').map(withRdv),
        admins: staff.filter((m) => m.role === 'admin').map(withRdv),
        clients_without_expert: orphans,
        counts: { clients: clientsCount, assignments: assignments.length, unassigned_rdv: unassignedRdv },
      };
    });
    res.json(data);
  } catch (e) { console.error('[équipe] vue d\'ensemble :', e.message); res.status(500).json({ error: 'server_error' }); }
});

router.patch('/admin/users/:id/role', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const role = String(req.body?.role || '');
  if (!UUID.test(id)) return res.status(400).json({ error: 'invalid_id' });
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'invalid_role' });
  if (id === req.user.sub && role !== 'admin') return res.status(400).json({ error: 'cannot_demote_self' });
  try {
    const out = await withClient(async (c) => {
      await c.query('begin');
      const cur = (await c.query('select id, role, email from users where id = $1 for update', [id])).rows[0];
      if (!cur) { await c.query('rollback'); return { status: 404, error: 'not_found' }; }
      const from = ROLES.includes(cur.role) ? cur.role : 'client';
      if (from === role) { await c.query('rollback'); return { ok: true, role, unchanged: true }; }
      if (from === 'admin') {
        const n = (await c.query(`select count(*)::int as n from users where role = 'admin'`)).rows[0].n;
        if (n <= 1) { await c.query('rollback'); return { status: 400, error: 'last_admin' }; }
      }
      await c.query('update users set role = $2 where id = $1', [id, role]);
      let removedAssignments = 0, releasedAppointments = 0, removedAsClient = 0;
      // Un expert qui change de profil laisse son portefeuille de clients
      if (from === 'expert') removedAssignments = (await c.query('delete from expert_assignments where expert_id = $1', [id])).rowCount;
      // Un client qui devient membre de l'équipe n'est plus suivi comme client
      if (from === 'client') removedAsClient = (await c.query('delete from expert_assignments where client_id = $1', [id])).rowCount;
      // Ses rendez-vous à venir repassent « sans conseiller » s'il ne peut plus en recevoir
      if (role === 'client') {
        releasedAppointments = (await c.query(`update diag_flash_requests r set assigned_to = null, updated_at = now() where r.assigned_to = $1 and ${OPEN_RDV('r')}`, [id])).rowCount
          + (await c.query(`update contact_requests r set assigned_to = null, updated_at = now() where r.assigned_to = $1 and ${OPEN_RDV('r')}`, [id])).rowCount;
      }
      await c.query('commit');
      return { ok: true, role, from, removedAssignments, releasedAppointments, removedAsClient };
    });
    if (out.error) return res.status(out.status).json({ error: out.error });
    console.log(JSON.stringify({ scope: 'admin', action: 'change_role', actor: req.user.email, at: new Date().toISOString(), details: { id, ...out } }));
    res.json(out);
  } catch (e) { console.error('[équipe] profil :', e.message); res.status(500).json({ error: 'server_error' }); }
});

export default router;
