import express from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import { withClient } from '../db/index.js';
import { sendMail } from '../services/mailer.js';
import { sha256Hex } from '../services/security.js';

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
      const ins = await client.query(`insert into client_messages(user_id, company_name, requester_name, requester_email, requester_phone, need_text) values($1,$2,$3,$4,$5,$6) returning id`, [req.user.sub, companyName, requesterName, requesterEmail, requesterPhone, needText]);
      return ins.rows[0];
    });
    const to = process.env.MAIL_TO || 'contact@pope-online.com';
    await sendMail({ to, subject: 'POPE Online — Nouveau besoin client', text: `Société: ${companyName || '(non précisée)'}
Demandeur: ${requesterName || '(non précisé)'}
Email: ${requesterEmail}
Téléphone: ${requesterPhone || '(non précisé)'}

Besoin:
${needText}` });
    await sendMail({ to: requesterEmail, subject: 'Accusé de réception — POPE Online', text: `Votre demande a bien été reçue.
Un conseiller POPE Online vous contactera rapidement.` });
    return res.json({ ok: true, id: result.id });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'server_error' }); }
});

router.post('/satisfaction-submit', limiter, async (req, res) => {
  const token = String(req.body?.token || '').trim();
  const comment = String(req.body?.comment || '').trim();
  const criteria = Array.isArray(req.body?.criteria) ? req.body.criteria : [];
  if (!token) return res.status(400).json({ error: 'missing_satisfaction_token' });
  if (!criteria.length) return res.status(400).json({ error: 'missing_satisfaction_answers' });
  try {
    const cleanedCriteria = criteria.map((item) => ({ key: String(item?.key || '').trim(), label: String(item?.label || '').trim(), value: String(item?.value || '').trim(), score: Number(item?.score || 0) })).filter((item) => item.key && item.label && item.value && item.score >= 1 && item.score <= 7);
    if (!cleanedCriteria.length) return res.status(400).json({ error: 'missing_satisfaction_answers' });
    const token_hash = sha256Hex(token);
    const user = await withClient(async (client) => {
      await client.query('begin');
      const tokenRes = await client.query(`select st.id, st.user_id, st.expires_at, st.used_at, u.email, u.full_name, u.organization from satisfaction_tokens st join users u on u.id = st.user_id where st.token_hash=$1 limit 1`, [token_hash]);
      if (!tokenRes.rowCount) { await client.query('rollback'); return null; }
      const row = tokenRes.rows[0];
      if (row.used_at || new Date(row.expires_at).getTime() < Date.now()) { await client.query('rollback'); return 'expired'; }
      await client.query(`update users set satisfaction_response_received_at=now(), satisfaction_last_response=$2::jsonb where id=$1`, [row.user_id, JSON.stringify({ criteria: cleanedCriteria, comment, submittedAt: new Date().toISOString() })]);
      await client.query(`update satisfaction_tokens set used_at=now() where id=$1`, [row.id]);
      await client.query('commit');
      return row;
    });
    if (!user) return res.status(400).json({ error: 'invalid_or_expired_token' });
    if (user === 'expired') return res.status(400).json({ error: 'invalid_or_expired_token' });
    const to = process.env.MAIL_TO || 'contact@pope-online.com';
    const lines = cleanedCriteria.map((item) => `- ${item.label} : ${item.value} (${item.score}/7)`).join('
');
    await sendMail({ to, replyTo: user.email, subject: 'POPE Online — Nouveau retour de satisfaction client', text: `Client : ${user.full_name || '(non précisé)'}
Organisation : ${user.organization || '(non précisée)'}
Email : ${user.email}

Évaluations :
${lines}

Commentaire libre :
${comment || '(aucun commentaire)'}` });
    return res.json({ ok: true, message: 'satisfaction_response_sent' });
  } catch (e) { console.error(e); return res.status(400).json({ error: 'invalid_or_expired_token' }); }
});

export default router;
