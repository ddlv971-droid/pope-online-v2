import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { withClient } from '../db/index.js';
import { sendMail } from '../services/mailer.js';
import { normalizeEmail, fpHash, computeSuspicion, hasPriorFreeTrialOnFingerprint } from '../services/antiAbuse.js';
import { sha256Hex, randomToken, ipToHash, uaToHash, nowPlusHours } from '../services/security.js';

const router = express.Router();

function signJwt(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

router.post('/signup', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');
  const fullName = String(req.body?.fullName || '').trim() || null;
  const organization = String(req.body?.organization || '').trim() || null;
  const fp = String(req.body?.fp || '').trim();

  if (!email || !email.includes('@')) return res.status(400).json({ error: 'invalid_email' });
  if (password.length < 8) return res.status(400).json({ error: 'password_too_short' });
  if (!fp) return res.status(400).json({ error: 'missing_fp' });

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

      // suspicion check BEFORE creating (using already existing devices)
      const suspicious = await computeSuspicion({ client, fp_hash, ip_hash, user_agent_hash });

      const userIns = await client.query(
        `insert into users(email, password_hash, full_name, organization, is_suspicious)
         values($1,$2,$3,$4,$5)
         returning id, email, is_email_verified, is_suspicious`,
        [email, password_hash, fullName, organization, suspicious]
      );
      const user = userIns.rows[0];

      await client.query('insert into wallets(user_id, tickets_ai, tickets_expert) values($1,0,0)', [user.id]);

      await client.query(
        `insert into devices(user_id, fp_hash, ip_hash, user_agent_hash)
         values($1,$2,$3,$4)`,
        [user.id, fp_hash, ip_hash, user_agent_hash]
      );

      // create verification token
      const token = randomToken(24);
      const token_hash = sha256Hex(token);
      const expires = nowPlusHours(24);
      await client.query(
        `insert into email_verifications(user_id, token_hash, expires_at)
         values($1,$2,$3)`,
        [user.id, token_hash, expires]
      );

      await client.query('commit');

      const base = (process.env.FRONTEND_BASE_URL || '').replace(/\/$/, '');
      const verifyUrl = `${base}/verify.html?token=${encodeURIComponent(token)}`;

      // Send verification email
      await sendMail({
        to: email,
        subject: 'POPE Online — Vérification de votre compte',
        text: `Bonjour,\n\nVeuillez vérifier votre compte POPE Online en cliquant sur ce lien :\n${verifyUrl}\n\nCe lien expire dans 24h.\n\n— POPE Online`,
        html: `<p>Bonjour,</p><p>Veuillez vérifier votre compte POPE Online :</p><p><a href="${verifyUrl}">Vérifier mon compte</a></p><p><small>Ce lien expire dans 24h.</small></p><p>— POPE Online</p>`
      });

      return res.json({ ok: true });
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.post('/login', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
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
        `select id, email, password_hash, is_email_verified, is_suspicious
           from users
          where email=$1`,
        [email]
      );
      if (!u.rowCount) return res.status(401).json({ error: 'invalid_credentials' });

      const user = u.rows[0];
      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

      // upsert device
      await client.query(
        `insert into devices(user_id, fp_hash, ip_hash, user_agent_hash)
         values($1,$2,$3,$4)
         on conflict do nothing`,
        [user.id, fp_hash, ip_hash, user_agent_hash]
      );

      await client.query(
        `update devices set last_seen_at=now() where user_id=$1 and fp_hash=$2`,
        [user.id, fp_hash]
      );

      await client.query('update users set last_login_at=now() where id=$1', [user.id]);

      const w = await client.query('select tickets_ai, tickets_expert from wallets where user_id=$1', [user.id]);

      const token = signJwt(user);
      return res.json({
        token,
        user: {
          email: user.email,
          isEmailVerified: user.is_email_verified,
          isSuspicious: user.is_suspicious
        },
        wallet: w.rows[0] || { tickets_ai: 0, tickets_expert: 0 }
      });
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.post('/verify', async (req, res) => {
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
        `select ev.id, ev.user_id, ev.expires_at, ev.used_at, u.is_email_verified, u.is_suspicious
           from email_verifications ev
           join users u on u.id = ev.user_id
          where ev.token_hash=$1
          limit 1`,
        [token_hash]
      );

      if (!v.rowCount) {
        await client.query('rollback');
        return res.status(400).json({ error: 'invalid_token' });
      }

      const row = v.rows[0];
      if (row.used_at) {
        await client.query('rollback');
        return res.status(400).json({ error: 'token_used' });
      }

      if (new Date(row.expires_at).getTime() < Date.now()) {
        await client.query('rollback');
        return res.status(400).json({ error: 'token_expired' });
      }

      // Mark verification used
      await client.query('update email_verifications set used_at=now() where id=$1', [row.id]);
      await client.query('update users set is_email_verified=true where id=$1', [row.user_id]);

      // Ensure device exists
      await client.query(
        `insert into devices(user_id, fp_hash, ip_hash, user_agent_hash)
         values($1,$2,$3,$4)
         on conflict do nothing`,
        [row.user_id, fp_hash, ip_hash, user_agent_hash]
      );

      // Anti-abuse: award 3 free AI tickets only if not suspicious AND fingerprint hasn't claimed before
      let awardedFreeTickets = 0;
      let suspicious = row.is_suspicious;

      if (!suspicious) {
        const fpAlready = await hasPriorFreeTrialOnFingerprint({ client, fp_hash });
        if (!fpAlready) {
          awardedFreeTickets = 999;
          await client.query(
            `update wallets set tickets_ai = tickets_ai + 999, updated_at=now() where user_id=$1`,
            [row.user_id]
          );
          await client.query(
            `insert into usage_logs(user_id, kind, meta) values($1,'free_trial_awarded',$2::jsonb)`,
            [row.user_id, JSON.stringify({ tickets: 999 })]
          );
        }
      }

      // If fingerprint looks suspicious now, mark suspicious (post-check)
      const computed = await computeSuspicion({ client, fp_hash, ip_hash, user_agent_hash });
      if (computed && !row.is_suspicious) {
        suspicious = true;
        await client.query('update users set is_suspicious=true where id=$1', [row.user_id]);
      }

      await client.query('commit');
      return res.json({ ok: true, awardedFreeTickets, suspicious });
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
});

// JWT required: return current user + wallet
router.get("/me", async (req, res) => {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: "unauthorized" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    await withClient(async (client) => {
      const u = await client.query("select id, email, full_name, organization, is_email_verified, is_suspicious, created_at from users where id=$1", [decoded.sub]);
      if (!u.rowCount) return res.status(401).json({ error: "unauthorized" });
      const w = await client.query("select tickets_ai, tickets_expert from wallets where user_id=$1", [decoded.sub]);
      return res.json({ user: u.rows[0], wallet: w.rows[0] || { tickets_ai:0, tickets_expert:0 } });
    });
  } catch (e) {
    return res.status(401).json({ error: "unauthorized" });
  }
});

export default router;
