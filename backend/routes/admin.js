import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { withClient } from '../db/index.js';
import { requireAdmin } from '../middleware/auth.js';
import { sendMail } from '../services/mailer.js';

const router = express.Router();
router.use(requireAdmin);

function resolveFreeTrialEntitlements(accountSpace = 'public') {
  const space = String(accountSpace || 'public').trim().toLowerCase();
  if (space === 'private') {
    return { ticketsAi: 10, publicDossiersLimit: 0, privateDossiersLimit: 1, privateUsersLimit: 1 };
  }
  return { ticketsAi: 10, publicDossiersLimit: 1, privateDossiersLimit: 0, privateUsersLimit: 1 };
}

function buildSatisfactionLink(user) {
  const frontendBase = String(process.env.FRONTEND_BASE_URL || '').trim().replace(/\/$/, '')
    .replace('https://popeonlinev1.netlify.app', 'https://pope-online.com')
    .replace('http://popeonlinev1.netlify.app', 'https://pope-online.com') || 'https://pope-online.com';
  const token = jwt.sign(
    {
      scope: 'satisfaction',
      sub: user.id,
      email: user.email,
      fullName: user.full_name || '',
      organization: user.organization || ''
    },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '30d' }
  );
  return `${frontendBase}/satisfaction.html?token=${encodeURIComponent(token)}`;
}

function satisfactionMailHtml(user, formUrl) {
  const displayName = user.full_name ? ` ${user.full_name}` : '';
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#f4f8fb;font-family:Arial,sans-serif;color:#0b2440;">
    <div style="max-width:720px;margin:0 auto;padding:32px 18px;">
      <div style="background:#ffffff;border:1px solid #dce7f0;border-radius:24px;overflow:hidden;box-shadow:0 12px 32px rgba(11,36,64,.08);">
        <div style="padding:28px 28px 18px;background:linear-gradient(135deg,#0b2440,#0079c1);color:#fff;">
          <h1 style="margin:0;font-size:24px;line-height:1.2;">Merci pour votre inscription à POPE Online</h1>
          <p style="margin:12px 0 0;line-height:1.6;opacity:.95;">Votre retour nous aide à améliorer l'accompagnement, la qualité de service et l'expérience de la plateforme.</p>
        </div>
        <div style="padding:28px;">
          <p style="margin:0 0 16px;line-height:1.7;">Bonjour${displayName},</p>
          <p style="margin:0 0 16px;line-height:1.7;">Nous vous remercions pour votre inscription à <strong>POPE Online</strong>. Afin de continuer à faire évoluer la plateforme dans le bon sens, nous vous invitons à répondre à un court formulaire de satisfaction.</p>
          <p style="margin:0 0 12px;line-height:1.7;">Le questionnaire vous permettra notamment d'évaluer :</p>
          <ul style="margin:0 0 22px 18px;padding:0;line-height:1.8;">
            <li>la qualité du premier contact avec un conseiller POPE Online ;</li>
            <li>l'ergonomie et la facilité d'utilisation des fonctionnalités du site ;</li>
            <li>la clarté des parcours et des services proposés ;</li>
            <li>la rapidité et la fluidité d'utilisation de la plateforme ;</li>
            <li>la pertinence globale de l'accompagnement proposé.</li>
          </ul>
          <p style="margin:0 0 24px;line-height:1.7;">Le formulaire est simple, rapide et se complète à l'aide d'un baromètre visuel allant de <strong>mauvais</strong> à <strong>excellent</strong>.</p>
          <a href="${formUrl}" style="display:inline-block;background:#0079c1;color:#fff;text-decoration:none;padding:14px 22px;border-radius:14px;font-weight:700;">Accéder au formulaire de satisfaction</a>
          <p style="margin:24px 0 0;line-height:1.7;color:#50627a;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br><span style="word-break:break-all;">${formUrl}</span></p>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

router.get('/users', async (_req, res) => {
  try {
    const result = await withClient(async (client) => {
      const q = await client.query(`
        select u.id, u.full_name, u.organization, u.email, u.phone_full, u.account_space, u.role, u.must_change_password,
               u.satisfaction_mail_sent_at, u.satisfaction_response_received_at, u.satisfaction_last_response,
               round(
                 coalesce((
                   select avg((elem->>'score')::numeric)
                   from jsonb_array_elements(coalesce(u.satisfaction_last_response->'criteria', '[]'::jsonb)) elem
                 ), 0) * 10.0 / 7.0
               , 1) as satisfaction_score_10,
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
          [
            id,
            w.planCode || 'CUSTOM',
            w.status || 'trial_active',
            Number(w.ticketsAi ?? 0),
            Number(w.publicDossiersLimit ?? 1),
            Number(w.privateDossiersLimit ?? 1),
            Number(w.privateUsersLimit ?? 1),
            w.trialExpiresAt || null
          ]
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

router.post('/users/:id/send-satisfaction', async (req, res) => {
  try {
    const result = await withClient(async (client) => {
      const q = await client.query(
        `select id, email, full_name, organization, satisfaction_mail_sent_at
           from users
          where id=$1
          limit 1`,
        [req.params.id]
      );
      if (!q.rowCount) return { status: 404, body: { error: 'user_not_found' } };
      const user = q.rows[0];
      if (user.satisfaction_mail_sent_at) {
        return { status: 409, body: { error: 'satisfaction_mail_already_sent', sentAt: user.satisfaction_mail_sent_at } };
      }

      const formUrl = buildSatisfactionLink(user);
      await sendMail({
        to: user.email,
        from: process.env.MAIL_FROM || 'contact@pope-online.com',
        replyTo: process.env.MAIL_TO || 'contact@pope-online.com',
        subject: 'POPE Online — Merci pour votre inscription',
        text: `Bonjour${user.full_name ? ' ' + user.full_name : ''},\n\nMerci pour votre inscription à POPE Online.\n\nNous vous invitons à compléter notre formulaire de satisfaction :\n${formUrl}\n\nVotre retour est précieux pour améliorer l'expérience proposée.\n\n— L'équipe POPE Online`,
        html: satisfactionMailHtml(user, formUrl)
      });

      await client.query(
        `update users
            set satisfaction_mail_sent_at=now(),
                satisfaction_mail_sent_by=$2
          where id=$1`,
        [req.params.id, req.user.sub]
      );

      return { status: 200, body: { ok: true, message: 'satisfaction_mail_sent' } };
    });

    return res.status(result.status).json(result.body);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'mail_send_failed' });
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
