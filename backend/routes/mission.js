import express from 'express';
import rateLimit from 'express-rate-limit';
import { optionalAuth } from '../middleware/auth.js';
import { withClient } from '../db/index.js';
import { sendMail } from '../services/mailer.js';
import { clamp, rejectIfSensitive } from '../services/rgpd.js';
import { getUserVaultFiles } from './vault.js';
import fs from 'fs';

// « Sur mesure » : qualification d'un besoin hors Conseil Expert (mission, accompagnement).
// Aucun quota consommé. La demande est enregistrée, puis envoyée à contact@pope-online.com
// avec copie à contact@popeconsulting-group.com (surchargeable : MISSION_MAIL_TO / MISSION_MAIL_CC).
const router = express.Router();

const limiter = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });

const MISSION_TO = () => process.env.MISSION_MAIL_TO || 'contact@pope-online.com';
const MISSION_CC = () => process.env.MISSION_MAIL_CC || 'contact@popeconsulting-group.com';

router.post('/request', optionalAuth, limiter, async (req, res) => {
  try {
    const email = String(req.body?.email || req.user?.email || '').trim();
    const fullName = clamp(String(req.body?.full_name || req.body?.name || '').trim(), 160);
    const organization = clamp(String(req.body?.organization || '').trim(), 200);
    const phone = clamp(String(req.body?.phone || '').trim(), 40);
    const domain = clamp(String(req.body?.domain || '').trim(), 180);
    const deadline = clamp(String(req.body?.deadline || '').trim(), 120);
    const subject = clamp(String(req.body?.subject || '').trim(), 180);
    const description = clamp(String(req.body?.content || req.body?.description || req.body?.context || '').trim(), 6000);
    const vaultFileIds = Array.isArray(req.body?.vault_file_ids) ? req.body.vault_file_ids.slice(0, 8) : [];

    if (!email || !email.includes('@')) return res.status(400).json({ error: 'invalid_email' });
    if (!subject) return res.status(400).json({ error: 'missing_subject' });
    if (!description) return res.status(400).json({ error: 'missing_description' });
    if (rejectIfSensitive(`${subject}\n${description}`)) return res.status(400).json({ error: 'sensitive_data' });

    const userId = req.user?.sub || null;

    const requestId = await withClient(async (client) => {
      const ins = await client.query(
        `insert into mission_requests(user_id, email, subject, description, full_name, organization, phone, domain, deadline)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
        [userId, email, subject, description, fullName || null, organization || null, phone || null, domain || null, deadline || null]
      );
      if (userId) {
        await client.query('insert into usage_logs(user_id, kind, meta) values($1,$2,$3::jsonb)',
          [userId, 'mission_request', JSON.stringify({ requestId: ins.rows[0].id })]).catch(() => {});
      }
      return ins.rows[0].id;
    });

    let attachments = [];
    if (userId && vaultFileIds.length) {
      try {
        const files = await withClient((c) => getUserVaultFiles(c, userId, vaultFileIds));
        attachments = files.map((f) => ({ filename: f.name, content: fs.readFileSync(f.path).toString('base64'), type: f.type, disposition: 'attachment' }));
      } catch (e) { console.error('[mission] pièces jointes illisibles :', e?.message || e); }
    }

    let mailSent = true;
    try {
      await sendMail({
        to: MISSION_TO(),
        cc: MISSION_CC(),
        replyTo: email,
        subject: `POPE Online — Besoin SUR MESURE (${organization || email})`,
        text:
`Nouvelle qualification de besoin « sur mesure »

ID : ${requestId}
Nom : ${fullName || '(non précisé)'}
Organisation : ${organization || '(non précisée)'}
E-mail : ${email}
Téléphone : ${phone || '(non précisé)'}
Domaine : ${domain || '(non précisé)'}
Échéance souhaitée : ${deadline || '(non précisée)'}
Compte POPE Online : ${userId ? 'oui' : 'non'}

Sujet :
${subject}

Description du besoin :
${description}

Pièces jointes : ${attachments.length}

— POPE Online`,
        attachments
      });
    } catch (e) {
      mailSent = false;
      console.error('[mission] envoi e-mail impossible :', e?.message || e);
    }
    await withClient((c) => c.query('update mission_requests set mail_sent=$2 where id=$1', [requestId, mailSent])).catch(() => {});

    // Accusé de réception au demandeur (non bloquant)
    sendMail({
      to: email,
      subject: 'POPE Online — Nous avons bien reçu votre besoin',
      text: `Bonjour${fullName ? ' ' + fullName : ''},\n\nNous avons bien reçu votre demande « ${subject} ». Un conseiller vous recontacte sous 24 h ouvrées pour qualifier votre besoin et vous proposer un accompagnement sur mesure.\n\nCordialement,\nL'équipe POPE Online\ncontact@pope-online.com — 09 70 70 30 55`
    }).catch(() => {});

    return res.json({ ok: true, requestId, mailSent });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
});

export default router;
