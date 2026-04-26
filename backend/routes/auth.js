
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { withClient } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { sendMail } from '../services/mailer.js';
import { normalizeEmail, fpHash, computeSuspicion, hasPriorFreeTrialOnFingerprint } from '../services/antiAbuse.js';
import { sha256Hex, randomToken, ipToHash, uaToHash, nowPlusHours, verifyTurnstileToken, setSessionCookie, clearSessionCookie } from '../services/security.js';
import { resolveFrontendBaseUrl } from '../services/urls.js';

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
  message: { error: 'too_many_attempts' }
});

function signJwt(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role || 'client', accountSpace: user.account_space || 'public', sv: Number(user.session_version || 1) },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
  );
}

function trialExpiryDate(days = 15) {
  return new Date(Date.now() + days * 24 * 3600 * 1000);
}

function walletPayload(row = {}) {
  return {
    plan_code: row.plan_code || 'FREE',
    status: row.status || 'pending_verification',
    tickets_ai: Number(row.tickets_ai || 0),
    tickets_expert: Number(row.tickets_expert || 0),
    public_dossiers_used: Number(row.public_dossiers_used || 0),
    private_dossiers_used: Number(row.private_dossiers_used || 0),
    public_dossiers_limit: Number(row.public_dossiers_limit || 1),
    private_dossiers_limit: Number(row.private_dossiers_limit || 1),
    private_users_limit: Number(row.private_users_limit || 1),
    trial_started_at: row.trial_started_at || null,
    trial_expires_at: row.trial_expires_at || null
  };
}

function cleanPhone(v) {
  return String(v || '').trim() || null;
}

function resolveFreeTrialEntitlements(accountSpace = 'public') {
  const space = String(accountSpace || 'public').trim().toLowerCase();
  if (space === 'private') {
    return {
      ticketsAi: 10,
      publicDossiersLimit: 0,
      privateDossiersLimit: 1,
      privateUsersLimit: 1
    };
  }
  return {
    ticketsAi: 10,
    publicDossiersLimit: 1,
    privateDossiersLimit: 0,
    privateUsersLimit: 1
  };
}

async function requireTurnstile(req, res) {
  const remoteIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
  const outcome = await verifyTurnstileToken({ token: req.body?.turnstileToken, ip: remoteIp });
  if (outcome.success) return true;
  res.status(403).json({ error: 'bot_protection_failed' });
  return false;
}


router.post('/signup', async (req, res) => {
  if (!(await requireTurnstile(req, res))) return;
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');
  const fullName = String(req.body?.fullName || '').trim() || null;
  const organization = String(req.body?.organization || '').trim() || null;
  const phoneCountry = cleanPhone(req.body?.phoneCountry);
  const phoneNumber = cleanPhone(req.body?.phoneNumber);
  const phoneFull = cleanPhone(req.body?.phoneFull);
  const fp = String(req.body?.fp || '').trim();
  const accountSpace = String(req.body?.accountSpace || 'public').trim().toLowerCase();

  if (!email || !email.includes('@')) return res.status(400).json({ error: 'invalid_email' });
  if (password.length < 8) return res.status(400).json({ error: 'password_too_short' });
  if (!fp) return res.status(400).json({ error: 'missing_fp' });
  if (!['public','private'].includes(accountSpace)) return res.status(400).json({ error: 'invalid_account_space' });

  const fp_hash = fpHash(fp);
  const ip_hash = ipToHash(req);
  const user_agent_hash = uaToHash(req);

  try {
    await withClient(async (client) => {
      await client.query('begin');
      const existing = await client.query('select 1 from users where email=$1', [email]);
      if (existing.rowCount) {
        await client.query('rollback');
        return res.status(409).json({ error: 'email_exists' });
      }

      const password_hash = await bcrypt.hash(password, 12);
      const suspicious = await computeSuspicion({ client, fp_hash, ip_hash, user_agent_hash });

      // Vérifier si compte précédemment supprimé par l'utilisateur lui-même
      // → bloque le free trial mais autorise la réinscription
      // Résilient : si deleted_accounts n'existe pas encore → wasDeletedBySelf = false
      let wasDeletedBySelf = false;
      try {
        const emailHash = sha256Hex(normalizeEmail(email));
        const selfDel = await client.query(
          `SELECT 1 FROM deleted_accounts WHERE (email_hash=$1 OR fp_hash=$2) AND deleted_by='self' LIMIT 1`,
          [emailHash, fp_hash]
        );
        wasDeletedBySelf = selfDel.rowCount > 0;
      } catch (_) { /* table absente → pas de blocage */ }

      const userIns = await client.query(
        `insert into users(email, password_hash, full_name, organization, account_space, is_suspicious, phone_country, phone_number, phone_full)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9)
         returning id, email, account_space, is_email_verified, is_suspicious, role, phone_country, phone_number, phone_full`,
        [email, password_hash, fullName, organization, accountSpace, suspicious, phoneCountry, phoneNumber, phoneFull]
      );
      const user = userIns.rows[0];
const entitlements = resolveFreeTrialEntitlements(accountSpace);
      const initialWalletStatus = wasDeletedBySelf ? 'verified_no_trial' : 'pending_verification';
     await client.query(
  `insert into wallets(
    user_id, plan_code, status, tickets_ai, tickets_expert,
    public_dossiers_used, private_dossiers_used,
    public_dossiers_limit, private_dossiers_limit, private_users_limit
  ) values($1,'FREE',$2,$3,0,0,0,$4,$5,$6)`,
  [
    user.id,
    initialWalletStatus,
    entitlements.ticketsAi,
    entitlements.publicDossiersLimit,
    entitlements.privateDossiersLimit,
    entitlements.privateUsersLimit
  ]
);

      await client.query(
        `insert into devices(user_id, fp_hash, ip_hash, user_agent_hash)
         values($1,$2,$3,$4)`,
        [user.id, fp_hash, ip_hash, user_agent_hash]
      );

      const token = randomToken(24);
      const token_hash = sha256Hex(token);
      const expires = nowPlusHours(24);
      await client.query(
        `insert into email_verifications(user_id, token_hash, expires_at)
         values($1,$2,$3)`,
        [user.id, token_hash, expires]
      );
      await client.query('commit');

      const base = resolveFrontendBaseUrl();
      const verifyUrl = `${base}/verify.html?token=${encodeURIComponent(token)}`;
      await sendMail({
        to: email,
        subject: 'POPE Online — Vérification de votre compte',
        text: `Bonjour,

Veuillez vérifier votre compte POPE Online en cliquant sur ce lien :
${verifyUrl}

Ce lien expire dans 24h.

— POPE Online`,
        html: `<p>Bonjour,</p><p>Veuillez vérifier votre compte POPE Online :</p><p><a href="${verifyUrl}">Vérifier mon compte</a></p><p><small>Ce lien expire dans 24h.</small></p><p>— POPE Online</p>`
      });

      return res.json({ ok: true, message: 'verification_email_sent' });
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.post('/login', loginLimiter, async (req, res) => {
  if (!(await requireTurnstile(req, res))) return;
  const rawIdentifier = String(req.body?.identifier || req.body?.email || '').trim();
  const adminUsername = String(process.env.DEFAULT_ADMIN_USERNAME || '').trim().toLowerCase();
  const adminEmail = String(process.env.DEFAULT_ADMIN_EMAIL || '').trim().toLowerCase();
  const email = normalizeEmail(rawIdentifier.toLowerCase() === adminUsername ? adminEmail : rawIdentifier);
  const password = String(req.body?.password || '');
  const fp = String(req.body?.fp || '').trim();

  if (!email || !email.includes('@')) return res.status(400).json({ error: 'invalid_email' });
  if (!password) return res.status(400).json({ error: 'missing_password' });
  if (!fp) return res.status(400).json({ error: 'missing_fp' });

  const fp_hash = fpHash(fp);
  const ip_hash = ipToHash(req);
  const user_agent_hash = uaToHash(req);

  try {
    await withClient(async (client) => {
      const u = await client.query(
        `select id, email, password_hash, is_email_verified, is_suspicious, full_name, organization, account_space, role, must_change_password,
                phone_country, phone_number, phone_full, session_version
           from users
          where email=$1`,
        [email]
      );
      if (!u.rowCount) return res.status(401).json({ error: 'invalid_credentials' });
      const user = u.rows[0];
      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

      await client.query(
        `insert into devices(user_id, fp_hash, ip_hash, user_agent_hash)
         values($1,$2,$3,$4)
         on conflict do nothing`,
        [user.id, fp_hash, ip_hash, user_agent_hash]
      );
      await client.query(`update devices set last_seen_at=now() where user_id=$1 and fp_hash=$2`, [user.id, fp_hash]);
      await client.query('update users set last_login_at=now() where id=$1', [user.id]);
      const w = await client.query('select * from wallets where user_id=$1', [user.id]);
      const token = signJwt(user);
      setSessionCookie(res, token);

      return res.json({
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          organization: user.organization,
          accountSpace: user.account_space,
          isEmailVerified: user.is_email_verified,
          isSuspicious: user.is_suspicious,
          role: user.role || 'client',
          mustChangePassword: !!user.must_change_password,
          phoneCountry: user.phone_country,
          phoneNumber: user.phone_number,
          phoneFull: user.phone_full
        },
        wallet: walletPayload(w.rows[0]),
        token
      });
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
});


const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
  message: { error: 'too_many_attempts' }
});

router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  if (!(await requireTurnstile(req, res))) return;
  const email = normalizeEmail(req.body?.email);
  const genericResponse = { ok: true, message: 'reset_email_sent_if_account_exists' };

  if (!email || !email.includes('@')) return res.json(genericResponse);

  try {
    await withClient(async (client) => {
      const userRes = await client.query(
        `select id, email from users where email=$1 limit 1`,
        [email]
      );
      if (!userRes.rowCount) return;

      const user = userRes.rows[0];
      const token = randomToken(32);
      const token_hash = sha256Hex(token);
      const expires = nowPlusHours(1);

      await client.query('begin');
      await client.query(
        `update password_resets
            set used_at=coalesce(used_at, now())
          where user_id=$1 and used_at is null`,
        [user.id]
      );
      await client.query(
        `insert into password_resets(user_id, token_hash, expires_at)
         values($1,$2,$3)`,
        [user.id, token_hash, expires]
      );
      await client.query('commit');

      const base = resolveFrontendBaseUrl();
      const resetUrl = `${base}/reset-password.html?token=${encodeURIComponent(token)}`;
      await sendMail({
        to: user.email,
        subject: 'POPE Online — Réinitialisation de votre mot de passe',
        text: `Bonjour,

Une demande de réinitialisation de mot de passe a été enregistrée pour votre compte POPE Online.

Pour définir un nouveau mot de passe, cliquez sur ce lien :
${resetUrl}

Ce lien expire dans 1 heure.
Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer ce message.

— POPE Online`,
        html: `<p>Bonjour,</p><p>Une demande de réinitialisation de mot de passe a été enregistrée pour votre compte POPE Online.</p><p><a href="${resetUrl}">Définir un nouveau mot de passe</a></p><p><small>Ce lien expire dans 1 heure.</small></p><p>Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer ce message.</p><p>— POPE Online</p>`
      });
    });

    return res.json(genericResponse);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.post('/reset-password', forgotPasswordLimiter, async (req, res) => {
  const token = String(req.body?.token || '').trim();
  const password = String(req.body?.password || '');

  if (!token) return res.status(400).json({ error: 'missing_token' });
  if (password.length < 8) return res.status(400).json({ error: 'password_too_short' });

  const token_hash = sha256Hex(token);

  try {
    await withClient(async (client) => {
      await client.query('begin');
      const resetRes = await client.query(
        `select pr.id, pr.user_id, pr.expires_at, pr.used_at, u.email
           from password_resets pr
           join users u on u.id = pr.user_id
          where pr.token_hash=$1
          limit 1`,
        [token_hash]
      );

      if (!resetRes.rowCount) {
        await client.query('rollback');
        return res.status(400).json({ error: 'invalid_or_expired_token' });
      }

      const reset = resetRes.rows[0];
      if (reset.used_at || new Date(reset.expires_at).getTime() < Date.now()) {
        await client.query('rollback');
        return res.status(400).json({ error: 'invalid_or_expired_token' });
      }

      const password_hash = await bcrypt.hash(password, 12);
      await client.query(
        `update users
            set password_hash=$1,
                must_change_password=false,
                session_version = session_version + 1
          where id=$2`,
        [password_hash, reset.user_id]
      );
      await client.query(
        `update password_resets
            set used_at=now()
          where id=$1`,
        [reset.id]
      );
      await client.query(
        `update password_resets
            set used_at=coalesce(used_at, now())
          where user_id=$1 and id<>$2 and used_at is null`,
        [reset.user_id, reset.id]
      );
      await client.query('commit');

      return res.json({ ok: true, message: 'password_reset_success' });
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.post('/admin-login', loginLimiter, async (req, res) => {
  if (!(await requireTurnstile(req, res))) return;
  const rawIdentifier = String(req.body?.identifier || req.body?.email || process.env.DEFAULT_ADMIN_USERNAME || '').trim();
  const adminUsername = String(process.env.DEFAULT_ADMIN_USERNAME || '').trim().toLowerCase();
  const adminEmail = String(process.env.DEFAULT_ADMIN_EMAIL || '').trim().toLowerCase();
  const email = normalizeEmail(rawIdentifier.toLowerCase() === adminUsername ? adminEmail : rawIdentifier);
  const password = String(req.body?.password || '');
  const fp = String(req.body?.fp || '').trim() || 'admin-dashboard';

  if (!email || !email.includes('@')) return res.status(400).json({ error: 'invalid_email' });
  if (!password) return res.status(400).json({ error: 'missing_password' });

  const fp_hash = fpHash(fp);
  const ip_hash = ipToHash(req);
  const user_agent_hash = uaToHash(req);

  try {
    await withClient(async (client) => {
      const u = await client.query(`select id, email, password_hash, is_email_verified, is_suspicious, full_name, organization, account_space, role, must_change_password,
                phone_country, phone_number, phone_full, session_version
           from users
          where email=$1`, [email]);
      if (!u.rowCount) return res.status(401).json({ error: 'invalid_credentials' });
      const user = u.rows[0];
      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok || user.role !== 'admin') return res.status(401).json({ error: 'invalid_credentials' });

      await client.query(`insert into devices(user_id, fp_hash, ip_hash, user_agent_hash)
         values($1,$2,$3,$4)
         on conflict do nothing`, [user.id, fp_hash, ip_hash, user_agent_hash]);
      await client.query('update devices set last_seen_at=now() where user_id=$1 and fp_hash=$2', [user.id, fp_hash]);
      await client.query('update users set last_login_at=now() where id=$1', [user.id]);
      const w = await client.query('select * from wallets where user_id=$1', [user.id]);
      const token = signJwt(user);
      setSessionCookie(res, token);
      return res.json({ user: { id: user.id, email: user.email, fullName: user.full_name, organization: user.organization, accountSpace: user.account_space, isEmailVerified: user.is_email_verified, isSuspicious: user.is_suspicious, role: user.role || 'client', mustChangePassword: !!user.must_change_password, phoneCountry: user.phone_country, phoneNumber: user.phone_number, phoneFull: user.phone_full }, wallet: walletPayload(w.rows[0]), token });
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
});

async function handleVerify(req, res) {
  const token = String(req.body?.token || '').trim();
  const fp = String(req.body?.fp || '').trim();
  if (!token) return res.status(400).json({ error: 'missing_token' });
  if (!fp) return res.status(400).json({ error: 'missing_fp' });

  const token_hash = sha256Hex(token);
  const fp_hash = fpHash(fp);
  const ip_hash = ipToHash(req);
  const user_agent_hash = uaToHash(req);

  try {
    await withClient(async (client) => {
      await client.query('begin');
      const v = await client.query(
        `select ev.id, ev.user_id, ev.expires_at, ev.used_at, u.is_suspicious, u.account_space
           from email_verifications ev
           join users u on u.id = ev.user_id
          where ev.token_hash=$1
          limit 1`,
        [token_hash]
      );
      if (!v.rowCount) { await client.query('rollback'); return res.status(400).json({ error: 'invalid_token' }); }
      const row = v.rows[0];
      if (row.used_at) { await client.query('rollback'); return res.status(400).json({ error: 'token_used' }); }
      if (new Date(row.expires_at).getTime() < Date.now()) { await client.query('rollback'); return res.status(400).json({ error: 'token_expired' }); }

      await client.query('update email_verifications set used_at=now() where id=$1', [row.id]);
      await client.query('update users set is_email_verified=true where id=$1', [row.user_id]);
      await client.query(
        `insert into devices(user_id, fp_hash, ip_hash, user_agent_hash)
         values($1,$2,$3,$4)
         on conflict do nothing`,
        [row.user_id, fp_hash, ip_hash, user_agent_hash]
      );

      let awardedFreeTickets = 0;
      let suspicious = row.is_suspicious;
      if (!suspicious) {
        const fpAlready = await hasPriorFreeTrialOnFingerprint({ client, fp_hash });
        if (!fpAlready) {
          const entitlements = resolveFreeTrialEntitlements(row.account_space);
          awardedFreeTickets = entitlements.ticketsAi;
          const startedAt = new Date();
          const expiresAt = trialExpiryDate(15);
          await client.query(
            `update wallets
                set plan_code='FREE', status='trial_active', tickets_ai=$2, tickets_expert=$2,
                    public_dossiers_used=0, private_dossiers_used=0,
                    public_dossiers_limit=$3, private_dossiers_limit=$4, private_users_limit=$5,
                    trial_started_at=$6, trial_expires_at=$7, updated_at=now()
              where user_id=$1`,
            [row.user_id, entitlements.ticketsAi, entitlements.publicDossiersLimit, entitlements.privateDossiersLimit, entitlements.privateUsersLimit, startedAt, expiresAt]
          );
        } else {
          await client.query(`update wallets set status='verified_no_trial', updated_at=now() where user_id=$1`, [row.user_id]);
        }
      }
      const computed = await computeSuspicion({ client, fp_hash, ip_hash, user_agent_hash });
      if (computed && !row.is_suspicious) {
        suspicious = true;
        await client.query('update users set is_suspicious=true where id=$1', [row.user_id]);
      }
      const walletRes = await client.query('select * from wallets where user_id=$1', [row.user_id]);
      const tokenRes = await client.query('select id, email, full_name, organization, account_space, is_email_verified, is_suspicious, role, must_change_password, phone_country, phone_number, phone_full, session_version from users where id=$1', [row.user_id]);
      await client.query('commit');
      const user = tokenRes.rows[0];
      const token = signJwt(user);
      setSessionCookie(res, token);
      return res.json({
        ok: true,
        awardedFreeTickets,
        suspicious,
        user: {
          email: user.email,
          fullName: user.full_name,
          organization: user.organization,
          accountSpace: user.account_space,
          isEmailVerified: user.is_email_verified,
          isSuspicious: user.is_suspicious,
          role: user.role || 'client',
          mustChangePassword: !!user.must_change_password,
          phoneCountry: user.phone_country,
          phoneNumber: user.phone_number,
          phoneFull: user.phone_full
        },
        wallet: walletPayload(walletRes.rows[0])
      });
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
}

router.post('/verify', handleVerify);
router.post('/verify-email', handleVerify);

router.get('/me', requireAuth, async (req, res) => {
  try {
    await withClient(async (client) => {
      const u = await client.query(
        `select id, email, full_name, organization, account_space, is_email_verified, is_suspicious, created_at, role, must_change_password,
                phone_country, phone_number, phone_full, session_version
           from users
          where id=$1`,
        [req.user.sub]
      );
      if (!u.rowCount) return res.status(401).json({ error: 'unauthorized' });
      const w = await client.query('select * from wallets where user_id=$1', [req.user.sub]);
      return res.json({ user: u.rows[0], wallet: walletPayload(w.rows[0]) });
    });
  } catch {
    return res.status(401).json({ error: 'unauthorized' });
  }
});

router.put('/me', requireAuth, async (req, res) => {
  const fullName = String(req.body?.fullName || '').trim() || null;
  const organization = String(req.body?.organization || '').trim() || null;
  const rawIdentifier = String(req.body?.identifier || req.body?.email || '').trim();
  const adminUsername = String(process.env.DEFAULT_ADMIN_USERNAME || '').trim().toLowerCase();
  const adminEmail = String(process.env.DEFAULT_ADMIN_EMAIL || '').trim().toLowerCase();
  const email = normalizeEmail(rawIdentifier.toLowerCase() === adminUsername ? adminEmail : rawIdentifier);
  const phoneCountry = cleanPhone(req.body?.phoneCountry);
  const phoneNumber = cleanPhone(req.body?.phoneNumber);
  const phoneFull = cleanPhone(req.body?.phoneFull);
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'invalid_email' });
  try {
    await withClient(async (client) => {
      const dup = await client.query('select id from users where email=$1 and id<>$2 limit 1', [email, req.user.sub]);
      if (dup.rowCount) return res.status(409).json({ error: 'email_exists' });
      await client.query(
        `update users
            set full_name=$2, organization=$3, email=$4, phone_country=$5, phone_number=$6, phone_full=$7
          where id=$1`,
        [req.user.sub, fullName, organization, email, phoneCountry, phoneNumber, phoneFull]
      );
      const u = await client.query('select id, email, full_name, organization, account_space, role, must_change_password, phone_country, phone_number, phone_full, session_version from users where id=$1', [req.user.sub]);
      return res.json({ ok: true, user: u.rows[0] });
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.put('/change-password', requireAuth, async (req, res) => {
  const currentPassword = String(req.body?.currentPassword || '');
  const newPassword = String(req.body?.newPassword || '');
  if (newPassword.length < 8) return res.status(400).json({ error: 'password_too_short' });
  try {
    await withClient(async (client) => {
      const u = await client.query('select id, password_hash, must_change_password from users where id=$1', [req.user.sub]);
      if (!u.rowCount) return res.status(404).json({ error: 'user_not_found' });
      const user = u.rows[0];
      if (!user.must_change_password) {
        const ok = await bcrypt.compare(currentPassword, user.password_hash);
        if (!ok) return res.status(401).json({ error: 'invalid_credentials' });
      }
      const password_hash = await bcrypt.hash(newPassword, 12);
      await client.query('update users set password_hash=$2, must_change_password=false, session_version = session_version + 1 where id=$1', [req.user.sub, password_hash]);
      const fresh = await client.query('select id, email, account_space, role, session_version from users where id=$1', [req.user.sub]);
      const token = signJwt(fresh.rows[0]);
      setSessionCookie(res, token);
      return res.json({ ok: true });
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
});


router.get('/me/export', requireAuth, async (req, res) => {
  try {
    await withClient(async (client) => {
      const userRes = await client.query(
        `select id, email, full_name, organization, account_space, is_email_verified, is_suspicious, created_at, last_login_at, role,
                phone_country, phone_number, phone_full, satisfaction_mail_sent_at, satisfaction_response_received_at, satisfaction_last_response
           from users
          where id=$1`,
        [req.user.sub]
      );
      if (!userRes.rowCount) return res.status(404).json({ error: 'user_not_found' });
      const walletRes = await client.query('select * from wallets where user_id=$1', [req.user.sub]);
      const usageRes = await client.query(
        `select kind, meta, created_at from usage_logs where user_id=$1 order by created_at desc limit 200`,
        [req.user.sub]
      );
      return res.json({
        ok: true,
        exportedAt: new Date().toISOString(),
        user: userRes.rows[0],
        wallet: walletRes.rows[0] || null,
        usage: usageRes.rows
      });
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.delete('/me', requireAuth, async (req, res) => {
  try {
    await withClient(async (client) => {
      await client.query('begin');

      // Récupérer email + devices pour enregistrer l'empreinte (bloque le free trial à la réinscription)
      const userRow = await client.query(
        `SELECT u.email FROM users u WHERE u.id=$1`, [req.user.sub]
      );
      if (userRow.rowCount) {
        const devicesRes = await client.query(
          `SELECT fp_hash, ip_hash FROM devices WHERE user_id=$1 LIMIT 10`, [req.user.sub]
        );
        try {
          const emailHash = sha256Hex(normalizeEmail(userRow.rows[0].email));
          const ipHash = ipToHash(req);
          await client.query(
            `INSERT INTO deleted_accounts(email_hash, fp_hash, ip_hash, deleted_by)
             VALUES($1,$2,$3,'self') ON CONFLICT DO NOTHING`,
            [emailHash, devicesRes.rows[0]?.fp_hash || null, ipHash]
          );
          for (const dev of devicesRes.rows.slice(1)) {
            await client.query(
              `INSERT INTO deleted_accounts(email_hash, fp_hash, ip_hash, deleted_by)
               VALUES($1,$2,null,'self') ON CONFLICT DO NOTHING`,
              [emailHash, dev.fp_hash]
            );
          }
        } catch (_) { /* table deleted_accounts absente → on supprime quand même */ }
      }

      await client.query('delete from users where id=$1', [req.user.sub]);
      await client.query('commit');
    });
    clearSessionCookie(res);
    return res.json({ ok: true, message: 'account_deleted' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.post('/logout', requireAuth, async (req, res) => {
  try {
    await withClient(async (client) => {
      await client.query('update users set session_version = session_version + 1 where id=$1', [req.user.sub]);
    });
  } catch (e) {
    console.error(e);
  }
  clearSessionCookie(res);
  return res.json({ ok: true });
});

export default router;
