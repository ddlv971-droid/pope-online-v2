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
    const subject = clamp(String(req.body?.subject || '').trim(), 180);
    const description = clamp(String(req.body?.description || '').trim(), 6000);

    if (!email || !email.includes('@')) return res.status(400).json({ error: 'invalid_email' });
    if (!subject) return res.status(400).json({ error: 'missing_subject' });
    if (!description) return res.status(400).json({ error: 'missing_description' });

    if (rejectIfSensitive(subject + '\n' + description)) return res.status(400).json({ error: 'sensitive_data' });

    const userId = req.user?.sub || null;
    const mailTo = process.env.MAIL_TO || 'contact@popeconsulting-group.com';

    const requestId = await withClient(async (client) => {
      const ins = await client.query(
        `insert into mission_requests(user_id, email, subject, description)
         values($1,$2,$3,$4)
         returning id`,
        [userId, email, subject, description]
      );

      if (userId) {
        await client.query(
          'insert into usage_logs(user_id, kind, meta) values($1,$2,$3::jsonb)',
          [userId, 'mission_request', JSON.stringify({ requestId: ins.rows[0].id })]
        );
      }

      return ins.rows[0].id;
    });

    await sendMail({
      to: mailTo,
      subject: `POPE Online — Demande MISSION (${email})`,
      text:
`Nouvelle demande POPE MISSION\n\nID: ${requestId}\nClient: ${email}\n\nSujet:\n${subject}\n\nDescription:\n${description}\n\n— POPE Online`,
    });

    return res.json({ ok: true, requestId });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error', detail: String(e?.message || e) });
  }
});

export default router;
