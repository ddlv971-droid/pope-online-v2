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
    const email = String(req.body?.email || '').trim();
    const objective = clamp(String(req.body?.objective || '').trim(), 1200);
    const expectations = clamp(String(req.body?.expectations || '').trim(), 4000);
    const context = clamp(String(req.body?.context || '').trim(), 6000);

    if (!email || !email.includes('@')) return res.status(400).json({ error: 'invalid_email' });
    if (!objective) return res.status(400).json({ error: 'missing_objective' });
    if (!expectations) return res.status(400).json({ error: 'missing_expectations' });

    const combined = `${objective}\n${expectations}\n${context}`;
    if (rejectIfSensitive(combined)) return res.status(400).json({ error: 'sensitive_data' });

    const userId = req.user?.sub || null;
    const mailTo = process.env.MAIL_TO || 'contact@popeconsulting-group.com';

    const { requestId, usedTicket } = await withClient(async (client) => {
      await client.query('begin');

      const ins = await client.query(
        `insert into expert_requests(user_id, email, objective, expectations, context)
         values($1,$2,$3,$4,$5)
         returning id`,
        [userId, email, objective, expectations, context]
      );
      const requestId = ins.rows[0].id;

      let usedTicket = false;
      if (userId) {
        const w = await client.query('select tickets_expert from wallets where user_id=$1 for update', [userId]);
        const t = Number(w.rows?.[0]?.tickets_expert ?? 0);
        if (t > 0) {
          usedTicket = true;
          await client.query('update wallets set tickets_expert=tickets_expert-1, updated_at=now() where user_id=$1', [userId]);
          await client.query(
            'insert into usage_logs(user_id, kind, meta) values($1,$2,$3::jsonb)',
            [userId, 'expert_request', JSON.stringify({ requestId })]
          );
        }
      }

      await client.query('commit');
      return { requestId, usedTicket };
    });

    await sendMail({
      to: mailTo,
      subject: `POPE Online — Demande EXPERT (${email})`,
      text:
`Nouvelle demande POPE EXPERT\n\nID: ${requestId}\nClient: ${email}\n\nObjectif:\n${objective}\n\nAttentes:\n${expectations}\n\nContexte:\n${context || '(non précisé)'}\n\nCouverture ticket expert: ${usedTicket ? 'OUI (décrémenté)' : 'NON (à qualifier)'}\n\n— POPE Online`,
    });

    return res.json({ ok: true, requestId, usedTicket });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error', detail: String(e?.message || e) });
  }
});

export default router;
