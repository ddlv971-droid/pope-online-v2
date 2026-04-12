
import express from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import { withClient } from '../db/index.js';
import { sendMail } from '../services/mailer.js';

const router = express.Router();
const limiter = rateLimit({ windowMs: 60 * 1000, max: 12, standardHeaders: true, legacyHeaders: false });

router.post('/message', requireAuth, limiter, async (req, res) => {
  const companyName = String(req.body?.companyName || '').trim() || null;
  const requesterName = String(req.body?.requesterName || '').trim() || null;
  const suppliedEmail = String(req.body?.requesterEmail || '').trim();
  const requesterEmail = suppliedEmail && suppliedEmail.includes('@') ? suppliedEmail : String(req.user?.email || '').trim();
  const requesterPhone = String(req.body?.requesterPhone || '').trim() || null;
  const needText = String(req.body?.needText || '').trim();
  if (!requesterEmail || !requesterEmail.includes('@')) return res.status(400).json({ error: 'invalid_email' });
  if (!needText) return res.status(400).json({ error: 'missing_need' });
  try {
    const result = await withClient(async (client) => {
      const ins = await client.query(
        `insert into client_messages(user_id, company_name, requester_name, requester_email, requester_phone, need_text)
         values($1,$2,$3,$4,$5,$6)
         returning id`,
        [req.user.sub, companyName, requesterName, requesterEmail, requesterPhone, needText]
      );
      return ins.rows[0];
    });
    const to = process.env.MAIL_TO || 'contact@pope-online.com';
    await sendMail({
      to,
      subject: 'POPE Online — Nouveau besoin client',
      text: `Société: ${companyName || '(non précisée)'}
Demandeur: ${requesterName || '(non précisé)'}
Email: ${requesterEmail}
Téléphone: ${requesterPhone || '(non précisé)'}

Besoin:
${needText}`
    });
    await sendMail({
      to: requesterEmail,
      subject: 'Accusé de réception — POPE Online',
      text: `Votre demande a bien été reçue.
Un conseiller POPE Online vous contactera rapidement.`
    });
    return res.json({ ok: true, id: result.id });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
});

export default router;
