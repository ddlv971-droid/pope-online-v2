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

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
}

function buildAttachmentContent(name, payload) {
  const data = payload || {};
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(name)}</title><style>body{font-family:Arial,sans-serif;margin:28px;color:#07162A;line-height:1.6}h1,h2{color:#0c5ea8;margin:0 0 10px}section{margin:0 0 24px}pre{white-space:pre-wrap;font-family:Arial,sans-serif;background:#f7fbff;border:1px solid #dce9f6;border-radius:14px;padding:14px;margin:10px 0 0}table{border-collapse:collapse;width:100%;margin-top:12px}th,td{padding:10px 12px;border:1px solid #dce9f6;vertical-align:top;text-align:left}th{background:#eef7fd}</style></head><body><h1>POPE Online — ${escapeHtml(name)}</h1><table><tr><th>Type</th><td>${escapeHtml(data.usecaseLabel || 'Génération IA')}</td></tr><tr><th>Date</th><td>${escapeHtml(data.createdAt || new Date().toISOString())}</td></tr></table><section><h2>Contexte</h2><pre>${escapeHtml(data?.prompt?.context || '-')}</pre></section><section><h2>Objectif</h2><pre>${escapeHtml(data?.prompt?.objective || '-')}</pre></section><section><h2>Éléments factuels</h2><pre>${escapeHtml(data?.prompt?.facts || '-')}</pre></section><section><h2>Résultat généré</h2><pre>${escapeHtml(data?.result || '-')}</pre></section></body></html>`;
  return Buffer.from(html, 'utf8').toString('base64');
}

router.post('/request', optionalAuth, limiter, async (req, res) => {
  try {
    const email = String(req.body?.email || req.user?.email || '').trim();
    const objective = clamp(String(req.body?.subject || req.body?.objective || '').trim(), 1200);
    const expectations = clamp(String(req.body?.content || req.body?.expectations || '').trim(), 4000);
    const context = clamp(String(req.body?.context || '').trim(), 6000);
    const generationAttachment = req.body?.generation_attachment || null;

    if (!email || !email.includes('@')) return res.status(400).json({ error: 'invalid_email' });
    if (!objective) return res.status(400).json({ error: 'missing_objective' });
    if (!expectations) return res.status(400).json({ error: 'missing_expectations' });

    const combined = `${objective}\n${expectations}\n${context}\n${generationAttachment?.result || ''}`;
    if (rejectIfSensitive(combined)) return res.status(400).json({ error: 'sensitive_data' });

    const userId = req.user?.sub || null;
    const mailTo = process.env.MAIL_TO || 'contact@popeconsulting-group.com';

    const result = await withClient(async (client) => {
      await client.query('begin');
      if (userId) {
        const walletRes = await client.query('select * from wallets where user_id=$1 for update', [userId]);
        const wallet = walletRes.rows[0];
        if (wallet?.trial_expires_at && new Date(wallet.trial_expires_at).getTime() < Date.now()) {
          await client.query('update wallets set status=$2, updated_at=now() where user_id=$1', [userId, 'trial_expired']);
          await client.query('commit');
          return { ok: false, status: 402, body: { error: 'trial_expired' } };
        }
      }

      const ins = await client.query(
        `insert into expert_requests(user_id, email, objective, expectations, context)
         values($1,$2,$3,$4,$5)
         returning id`,
        [userId, email, objective, expectations, context]
      );
      const requestId = ins.rows[0].id;
      let usedTicket = false;
      let wallet = null;

      if (userId) {
        const w = await client.query('select * from wallets where user_id=$1 for update', [userId]);
        wallet = w.rows[0];
        const t = Number(wallet?.tickets_expert ?? 0);
        if (t > 0) {
          usedTicket = true;
          await client.query('update wallets set tickets_expert=tickets_expert-1, updated_at=now() where user_id=$1', [userId]);
        } else {
          const used = Number(wallet?.public_dossiers_used ?? 0);
          const limit = Number(wallet?.public_dossiers_limit ?? 1);
          if (used >= limit) {
            await client.query('rollback');
            return { ok: false, status: 402, body: { error: 'public_dossier_limit_reached' } };
          }
          await client.query('update wallets set public_dossiers_used=public_dossiers_used+1, updated_at=now() where user_id=$1', [userId]);
        }
        await client.query('insert into usage_logs(user_id, kind, meta) values($1,$2,$3::jsonb)', [userId, 'expert_request', JSON.stringify({ requestId, usedTicket, hasGenerationAttachment: Boolean(generationAttachment?.result) })]);
        const refresh = await client.query('select * from wallets where user_id=$1', [userId]);
        wallet = refresh.rows[0];
      }

      await client.query('commit');
      return { ok: true, requestId, usedTicket, wallet };
    });

    if (!result.ok) return res.status(result.status).json(result.body);

    const attachments = [];
    if (generationAttachment?.result) {
      attachments.push({
        filename: 'pope-online-generation-attachee.html',
        content: buildAttachmentContent('Pièce jointe de génération', generationAttachment),
        type: 'text/html'
      });
    }

    await sendMail({
      to: mailTo,
      subject: `POPE Online — Demande EXPERT (${email})`,
      text:
`Nouvelle demande POPE EXPERT\n\nID: ${result.requestId}\nClient: ${email}\n\nObjet:\n${objective}\n\nDemande:\n${expectations}\n\nContexte:\n${context || '(non précisé)'}\n\nPièce jointe génération : ${generationAttachment?.result ? 'OUI' : 'NON'}\nCouverture ticket expert: ${result.usedTicket ? 'OUI (décrémenté)' : 'NON (qualifié au titre du dossier)'}\n\n— POPE Online`,
      attachments
    });

    return res.json({ ok: true, requestId: result.requestId, usedTicket: result.usedTicket, wallet: result.wallet });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error', detail: String(e?.message || e) });
  }
});

export default router;
