
import express from 'express';
import bcrypt from 'bcryptjs';
import { withClient } from '../db/index.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAdmin);

function resolveFreeTrialEntitlements(accountSpace = 'public') {
  const space = String(accountSpace || 'public').trim().toLowerCase();
  if (space === 'private') {
    return { ticketsAi: 0, publicDossiersLimit: 0, privateDossiersLimit: 1, privateUsersLimit: 1 };
  }
  return { ticketsAi: 10, publicDossiersLimit: 1, privateDossiersLimit: 0, privateUsersLimit: 1 };
}

router.get('/users', async (_req, res) => {
  try {
    const result = await withClient(async (client) => {
      const q = await client.query(`
        select u.id, u.full_name, u.organization, u.email, u.phone_full, u.account_space, u.role, u.must_change_password,
               w.plan_code, w.status, w.tickets_ai, w.public_dossiers_limit, w.private_dossiers_limit, w.private_users_limit,
               w.trial_expires_at, u.created_at
          from users u
          left join wallets w on w.user_id = u.id
         order by u.created_at desc
      `);
      return q.rows;
    });
    return res.json({ users: result });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.post('/users', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const fullName = String(req.body?.fullName || '').trim() || null;
  const organization = String(req.body?.organization || '').trim() || null;
  const accountSpace = String(req.body?.accountSpace || 'public').trim().toLowerCase();
  const phoneFull = String(req.body?.phoneFull || '').trim() || null;
  const password = String(req.body?.password || 'admin12345');
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'invalid_email' });
  if (!['public','private'].includes(accountSpace)) return res.status(400).json({ error: 'invalid_account_space' });
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const entitlements = resolveFreeTrialEntitlements(accountSpace);
    const result = await withClient(async (client) => {
      await client.query('begin');
      const dup = await client.query('select id from users where email=$1', [email]);
      if (dup.rowCount) { await client.query('rollback'); return { error: 'email_exists', status: 409 }; }
      const ins = await client.query(
        `insert into users(email, password_hash, full_name, organization, account_space, is_email_verified, phone_full)
         values($1,$2,$3,$4,$5,true,$6)
         returning id`,
        [email, passwordHash, fullName, organization, accountSpace, phoneFull]
      );
      await client.query(`insert into wallets(user_id, plan_code, status, tickets_ai, public_dossiers_limit, private_dossiers_limit, private_users_limit)
                          values($1,'CUSTOM','trial_active',$2,$3,$4,$5) on conflict do nothing`, [ins.rows[0].id, entitlements.ticketsAi, entitlements.publicDossiersLimit, entitlements.privateDossiersLimit, entitlements.privateUsersLimit]);
      await client.query('commit');
      return { id: ins.rows[0].id };
    });
    if (result.error) return res.status(result.status).json({ error: result.error });
    return res.json({ ok: true, id: result.id });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.put('/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await withClient(async (client) => {
      await client.query('begin');
      if (req.body.user) {
        const u = req.body.user;
        await client.query(
          `update users set full_name=$2, organization=$3, email=$4, phone_full=$5, account_space=$6 where id=$1`,
          [id, u.fullName || null, u.organization || null, String(u.email || '').trim().toLowerCase(), u.phoneFull || null, u.accountSpace || 'public']
        );
      }
      if (req.body.wallet) {
        const w = req.body.wallet;
        await client.query(
          `insert into wallets(user_id, plan_code, status, tickets_ai, public_dossiers_limit, private_dossiers_limit, private_users_limit, trial_expires_at)
           values($1,$2,$3,$4,$5,$6,$7,$8)
           on conflict(user_id) do update set
             plan_code=excluded.plan_code,
             status=excluded.status,
             tickets_ai=excluded.tickets_ai,
             public_dossiers_limit=excluded.public_dossiers_limit,
             private_dossiers_limit=excluded.private_dossiers_limit,
             private_users_limit=excluded.private_users_limit,
             trial_expires_at=excluded.trial_expires_at,
             updated_at=now()`,
          [id, w.planCode || 'CUSTOM', w.status || 'trial_active', Number(w.ticketsAi || 0), Number(w.publicDossiersLimit || 1), Number(w.privateDossiersLimit || 1), Number(w.privateUsersLimit || 1), w.trialExpiresAt || null]
        );
      }
      await client.query('commit');
      return res.json({ ok: true });
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    await withClient(async (client) => {
      await client.query("delete from users where id=$1 and role<>'admin'", [req.params.id]);
    });
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
});

export default router;
