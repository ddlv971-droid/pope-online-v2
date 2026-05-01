import express from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth, optionalAuth, requireAdmin } from '../middleware/auth.js';
import { withClient } from '../db/index.js';
import { sendMail } from '../services/mailer.js';
import { clamp, rejectIfSensitive } from '../services/rgpd.js';
import { getUserVaultFiles, buildMailAttachments } from './vault.js';

const router = express.Router();
const limiter = rateLimit({ windowMs: 60000, max: 10, standardHeaders: true, legacyHeaders: false });

function escapeHtml(v = '') {
  return String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function buildAttachmentContent(name, payload) {
  const d = payload || {};
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(name)}</title>
<style>body{font-family:Arial,sans-serif;margin:28px;color:#07162A;line-height:1.6}h1,h2{color:#0c5ea8}section{margin:0 0 24px}pre{white-space:pre-wrap;background:#f7fbff;border:1px solid #dce9f6;border-radius:8px;padding:14px}table{border-collapse:collapse;width:100%}th,td{padding:10px;border:1px solid #dce9f6;text-align:left}th{background:#eef7fd}</style>
</head><body><h1>POPE Online — ${escapeHtml(name)}</h1>
<table><tr><th>Type</th><td>${escapeHtml(d.usecaseLabel||'Génération IA')}</td></tr><tr><th>Date</th><td>${escapeHtml(d.createdAt||new Date().toISOString())}</td></tr></table>
<section><h2>Contexte</h2><pre>${escapeHtml(d?.prompt?.context||'-')}</pre></section>
<section><h2>Objectif</h2><pre>${escapeHtml(d?.prompt?.objective||'-')}</pre></section>
<section><h2>Résultat généré</h2><pre>${escapeHtml(d?.result||'-')}</pre></section>
</body></html>`;
  return Buffer.from(html, 'utf8').toString('base64');
}

// ── POST /expert/request ─────────────────────────────────────────────────────
router.post('/request', optionalAuth, limiter, async (req, res) => {
  try {
    const email        = String(req.body?.email || req.user?.email || '').trim();
    const objective    = clamp(String(req.body?.subject || req.body?.objective || '').trim(), 1200);
    const expectations = clamp(String(req.body?.content || req.body?.expectations || '').trim(), 4000);
    const context      = clamp(String(req.body?.context || '').trim(), 6000);
    const generationAttachment = req.body?.generation_attachment || null;
    const vaultFileIds = Array.isArray(req.body?.vault_file_ids) ? req.body.vault_file_ids.slice(0, 8) : [];

    if (!email || !email.includes('@')) return res.status(400).json({ error: 'invalid_email' });
    if (!objective)    return res.status(400).json({ error: 'missing_objective' });
    if (!expectations) return res.status(400).json({ error: 'missing_expectations' });

    const combined = `${objective}\n${expectations}\n${context}\n${generationAttachment?.result || ''}`;
    if (rejectIfSensitive(combined)) return res.status(400).json({ error: 'sensitive_data' });

    const userId  = req.user?.sub || null;
    const mailTo  = process.env.MAIL_TO || 'contact@popeconsulting-group.com';

    const result = await withClient(async (client) => {
      await client.query('begin');

      // Vérif trial
      if (userId) {
        const walletRes = await client.query('select * from wallets where user_id=$1 for update', [userId]);
        const wallet = walletRes.rows[0];
        if (wallet?.trial_expires_at && new Date(wallet.trial_expires_at) < new Date()) {
          await client.query("update wallets set status='trial_expired', updated_at=now() where user_id=$1", [userId]);
          await client.query('commit');
          return { ok: false, status: 402, body: { error: 'trial_expired' } };
        }
      }

      const ins = await client.query(
        `insert into expert_requests(user_id, email, objective, expectations, context, generation_attachment, status)
         values($1,$2,$3,$4,$5,$6,'new') returning id`,
        [userId, email, objective, expectations, context,
         generationAttachment ? JSON.stringify(generationAttachment) : null]
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
          await client.query('update wallets set tickets_expert=tickets_expert-1, expert_used=expert_used+1, updated_at=now() where user_id=$1', [userId]);
        } else {
          const used  = Number(wallet?.public_dossiers_used  ?? 0);
          const limit = Number(wallet?.public_dossiers_limit ?? 1);
          if (used >= limit) {
            await client.query('rollback');
            return { ok: false, status: 402, body: { error: 'public_dossier_limit_reached' } };
          }
          await client.query('update wallets set public_dossiers_used=public_dossiers_used+1, expert_used=expert_used+1, updated_at=now() where user_id=$1', [userId]);
        }
        await client.query(
          'insert into usage_logs(user_id, kind, meta) values($1,$2,$3::jsonb)',
          [userId, 'expert_request', JSON.stringify({ requestId, usedTicket })]
        );

        // Notification in-app : demande reçue
        await client.query(
          `insert into notifications(user_id, kind, title, body, link)
           values($1,'expert_received','Demande de relecture reçue','Votre demande est en cours de traitement. Vous serez notifié dès la réponse de votre conseiller.','/expert.html')`,
          [userId]
        );

        const refresh = await client.query('select * from wallets where user_id=$1', [userId]);
        wallet = refresh.rows[0];
      }

      await client.query('commit');
      return { ok: true, requestId, usedTicket, wallet };
    });

    if (!result.ok) return res.status(result.status).json(result.body);

    // Email équipe
    const attachments = [];
    if (generationAttachment?.result) {
      attachments.push({
        filename: 'pope-online-generation-attachee.doc',
        content: buildAttachmentContent('Pièce jointe de génération', generationAttachment),
        type: 'application/msword'
      });
    }
    if (userId && vaultFileIds.length) {
      const vaultFiles = await withClient(c => getUserVaultFiles(c, userId, vaultFileIds));
      attachments.push(...buildMailAttachments(vaultFiles));
    }

    await sendMail({
      to: mailTo,
      subject: `POPE Online — Demande EXPERT #${result.requestId.slice(0,8)} (${email})`,
      text: `Nouvelle demande POPE EXPERT\n\nID: ${result.requestId}\nClient: ${email}\n\nObjet:\n${objective}\n\nDemande:\n${expectations}\n\nContexte:\n${context||'(non précisé)'}\n\nPJ génération: ${generationAttachment?.result?'OUI':'NON'}\nPJ vault: ${vaultFileIds.length}\nTicket utilisé: ${result.usedTicket?'OUI':'NON'}\n\n→ Répondre via le dashboard admin POPE Online\n\n— POPE Online`,
      attachments
    });

    return res.json({ ok: true, requestId: result.requestId, usedTicket: result.usedTicket, wallet: result.wallet });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error', detail: String(e?.message || e) });
  }
});

// ── GET /expert/my-requests — client voit ses relectures ────────────────────
router.get('/my-requests', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const rows = await withClient(async (client) => {
      const r = await client.query(
        `select id, objective, expectations, context, status,
                reply_text, reply_by, replied_at, created_at, updated_at
         from expert_requests
         where user_id = $1
         order by created_at desc
         limit 50`,
        [userId]
      );
      return r.rows;
    });
    return res.json({ requests: rows });
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
});

// ── GET /expert/all — admin voit toutes les demandes ────────────────────────
router.get('/all', requireAdmin, async (req, res) => {
  try {
    const status = req.query.status || null;
    const rows = await withClient(async (client) => {
      const q = status
        ? `select er.*, u.email as user_email, u.full_name, u.organization
           from expert_requests er
           left join users u on u.id = er.user_id
           where er.status = $1
           order by er.created_at desc limit 100`
        : `select er.*, u.email as user_email, u.full_name, u.organization
           from expert_requests er
           left join users u on u.id = er.user_id
           order by er.created_at desc limit 100`;
      const r = await client.query(q, status ? [status] : []);
      return r.rows;
    });
    return res.json({ requests: rows });
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
});

// ── POST /expert/:id/reply — admin répond à une relecture ───────────────────
router.post('/:id/reply', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const replyText = String(req.body?.reply_text || '').trim();
    const replyBy   = String(req.user?.email || 'conseiller@pope-online.com');
    if (!replyText) return res.status(400).json({ error: 'missing_reply' });

    const result = await withClient(async (client) => {
      const upd = await client.query(
        `update expert_requests
         set reply_text=$2, reply_by=$3, replied_at=now(), status='replied', updated_at=now()
         where id=$1
         returning user_id, email, objective`,
        [id, replyText, replyBy]
      );
      if (!upd.rowCount) return { ok: false };
      const row = upd.rows[0];

      // Notification in-app pour le client
      if (row.user_id) {
        await client.query(
          `insert into notifications(user_id, kind, title, body, link)
           values($1,'expert_replied','Votre relecture experte est prête',$2,'/expert.html')`,
          [row.user_id, `Votre conseiller a répondu à votre demande : "${String(row.objective||'').slice(0,80)}"`]
        );
      }
      return { ok: true, email: row.email, objective: row.objective, userId: row.user_id };
    });

    if (!result.ok) return res.status(404).json({ error: 'not_found' });

    // Email au client
    await sendMail({
      to: result.email,
      subject: 'POPE Online — Votre relecture experte est prête',
      text: `Bonjour,\n\nVotre conseiller POPE Online a répondu à votre demande de relecture.\n\nObjet de la demande :\n${result.objective}\n\nRéponse de votre conseiller :\n${replyText}\n\nConnectez-vous à votre espace pour consulter la réponse complète :\nhttps://pope-online.com/expert.html\n\nCordialement,\nL'équipe POPE Online\ncontact@pope-online.com — 09 70 70 30 55`
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
});

// ── PUT /expert/:id/status — admin change le statut ─────────────────────────
router.put('/:id/status', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const status = String(req.body?.status || '');
    const allowed = ['new', 'in_progress', 'replied', 'closed'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'invalid_status' });
    await withClient(c => c.query(
      "update expert_requests set status=$2, updated_at=now() where id=$1",
      [id, status]
    ));
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
});

// ── GET /expert/notifications — notifs non lues du client ───────────────────
router.get('/notifications', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const rows = await withClient(async (client) => {
      const r = await client.query(
        `select id, kind, title, body, link, read, created_at
         from notifications where user_id=$1
         order by created_at desc limit 20`,
        [userId]
      );
      return r.rows;
    });
    const unread = rows.filter(r => !r.read).length;
    return res.json({ notifications: rows, unread });
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
});

// ── POST /expert/notifications/read — marquer comme lues ────────────────────
router.post('/notifications/read', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    await withClient(c => c.query(
      "update notifications set read=true where user_id=$1 and read=false",
      [userId]
    ));
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
});


// Route pour que l'expert envoie sa réponse (accessible avec rôle 'expert')
router.post('/:id/expert-reply', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const replyText = String(req.body?.reply_text || '').trim();
    const replyBy   = String(req.user?.email || '');
    if (!replyText) return res.status(400).json({ error: 'missing_reply' });
    if (!['expert','admin'].includes(req.user?.role)) return res.status(403).json({ error: 'forbidden' });

    const result = await withClient(async (client) => {
      const upd = await client.query(
        `update expert_requests
         set reply_text=$2, reply_by=$3, replied_at=now(), status='replied', updated_at=now()
         where id=$1
         returning user_id, email, objective`,
        [id, replyText, replyBy]
      );
      if (!upd.rowCount) return { ok: false };
      const row = upd.rows[0];
      if (row.user_id) {
        try {
          await client.query(
            `insert into notifications(user_id, kind, title, body, link)
             values($1,'expert_replied','Votre relecture experte est prête',$2,'/dashboard.html')
             on conflict do nothing`,
            [row.user_id, 'Votre conseiller expert a répondu à votre demande de relecture.']
          );
        } catch(_) {}
      }
      return { ok: true, row };
    });
    return res.json(result);
  } catch(e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
});


// ── GET /expert/my-assigned-requests — relectures des clients assignés ───────
router.get('/my-assigned-requests', requireAuth, async (req, res) => {
  if (!['expert','admin'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  try {
    const expertId = req.user.sub;
    const rows = await withClient(async (client) => {
      const r = await client.query(
        `select er.id, er.objective, er.expectations, er.context, er.status,
                er.reply_text, er.reply_by, er.replied_at,
                er.created_at, er.updated_at,
                er.generation_attachment,
                u.email, u.full_name, u.organization, u.id as user_id
           from expert_requests er
           join users u on u.id = er.user_id
           join expert_assignments ea on ea.client_id = er.user_id
                                     AND ea.expert_id = $1
          order by er.created_at desc
          limit 100`,
        [expertId]
      );
      return r.rows;
    });
    return res.json({ requests: rows });
  } catch(e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
});

// ── GET /expert/my-clients — portefeuille de l'expert connecté ───────────────
router.get('/my-clients', requireAuth, async (req, res) => {
  if (!['expert','admin'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  try {
    const expertId = req.user.sub;
    const rows = await withClient(async (client) => {
      const r = await client.query(
        `select u.id, u.full_name, u.email, u.organization, ea.assigned_at,
                (select count(*) from expert_requests er
                  where er.user_id = u.id
                    and er.status not in ('replied','closed'))::int as pending_count,
                (select count(*) from expert_requests er
                  where er.user_id = u.id
                    and er.status in ('replied','closed'))::int as done_count
           from expert_assignments ea
           join users u on u.id = ea.client_id
          where ea.expert_id = $1
          order by ea.assigned_at desc`,
        [expertId]
      );
      return r.rows;
    });
    return res.json({ clients: rows });
  } catch(e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
});

export default router;
