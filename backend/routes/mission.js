
import express from 'express';
import rateLimit from 'express-rate-limit';
import { optionalAuth } from '../middleware/auth.js';
import { withClient } from '../db/index.js';
import { sendMail } from '../services/mailer.js';
import { clamp, rejectIfSensitive } from '../services/rgpd.js';

const router = express.Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false
});

router.post('/request', optionalAuth, limiter, async (req, res) => {
  try {
    const email = String(req.body?.email || req.user?.email || '').trim();
    const subject = clamp(String(req.body?.subject || '').trim(), 180);
    const description = clamp(String(req.body?.content || req.body?.description || req.body?.context || '').trim(), 6000);

    if (!email || !email.includes('@')) return res.status(400).json({ error: 'invalid_email' });
    if (!subject) return res.status(400).json({ error: 'missing_subject' });
    if (!description) return res.status(400).json({ error: 'missing_description' });

    if (rejectIfSensitive(subject + '\n' + description)) return res.status(400).json({ error: 'sensitive_data' });

    const userId = req.user?.sub || null;
    const mailTo = process.env.MAIL_TO || 'contact@popeconsulting-group.com';

    const result = await withClient(async (client) => {
      await client.query('begin');

      let wallet = null;
      if (userId) {
        const w = await client.query('select * from wallets where user_id=$1 for update', [userId]);
        wallet = w.rows[0];
        if (wallet?.trial_expires_at && new Date(wallet.trial_expires_at).getTime() < Date.now()) {
          await client.query('update wallets set status=$2, updated_at=now() where user_id=$1', [userId, 'trial_expired']);
          await client.query('commit');
          return { ok: false, status: 402, body: { error: 'trial_expired' } };
        }
        const used = Number(wallet?.private_dossiers_used ?? 0);
        const limit = Number(wallet?.private_dossiers_limit ?? 1);
        if (used >= limit) {
          await client.query('rollback');
          return { ok: false, status: 402, body: { error: 'private_dossier_limit_reached' } };
        }
      }

      const ins = await client.query(
        `insert into mission_requests(user_id, email, subject, description)
         values($1,$2,$3,$4)
         returning id`,
        [userId, email, subject, description]
      );

      if (userId) {
        await client.query('update wallets set private_dossiers_used=private_dossiers_used+1, updated_at=now() where user_id=$1', [userId]);
        await client.query(
          'insert into usage_logs(user_id, kind, meta) values($1,$2,$3::jsonb)',
          [userId, 'mission_request', JSON.stringify({ requestId: ins.rows[0].id })]
        );
        const refresh = await client.query('select * from wallets where user_id=$1', [userId]);
        wallet = refresh.rows[0];
      }

      await client.query('commit');
      return { ok: true, requestId: ins.rows[0].id, wallet };
    });

    if (!result.ok) return res.status(result.status).json(result.body);

    await sendMail({
      to: mailTo,
      subject: `POPE Online — Demande MISSION (${email})`,
      text:
`Nouvelle demande POPE MISSION\n\nID: ${result.requestId}\nClient: ${email}\n\nSujet:\n${subject}\n\nDescription:\n${description}\n\n— POPE Online`,
    });

    return res.json({ ok: true, requestId: result.requestId, wallet: result.wallet });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error', detail: String(e?.message || e) });
  }
});

export default router;
