import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import aiRoutes from './routes/ai.js';
import expertRoutes from './routes/expert.js';
import missionRoutes from './routes/mission.js';
import billingRoutes from './routes/billing.js';
import usageRoutes from './routes/usage.js';
import adminRoutes from './routes/admin.js';
import clientRoutes from './routes/client.js';
import vaultRoutes from './routes/vault.js';
import { localizeApiBody } from './services/i18n.js';
import { pool } from './db/index.js';

dotenv.config();

const isProd = String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
const requiredEnv = ['DATABASE_URL', 'JWT_SECRET', 'FRONTEND_BASE_URL', ...(isProd ? ['CORS_ORIGIN', 'TURNSTILE_SECRET_KEY'] : [])];
const missingEnv = requiredEnv.filter((key) => !String(process.env[key] || '').trim());
if (missingEnv.length) {
  console.error(`Missing required environment variables: ${missingEnv.join(', ')}`);
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1);

// 🔒 Headers sécurité
app.use((req, res, next) => {
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline' https:",
    "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
    "connect-src 'self' https://challenges.cloudflare.com",
    "frame-src https://challenges.cloudflare.com https://www.youtube.com https://www.youtube-nocookie.com",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ].join('; ');
  res.setHeader('Content-Security-Policy', csp);
  if (req.secure || String(req.headers['x-forwarded-proto'] || '').includes('https')) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Stripe webhook raw body (doit être AVANT express.json)
app.use('/billing/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '15mb' }));

// 🌍 Localisation API
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => originalJson(localizeApiBody(body));
  next();
});

// 🔥 CORS CORRIGÉ
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

console.log('CORS_ORIGIN =', process.env.CORS_ORIGIN);
console.log('Allowed origins =', allowedOrigins);

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // mobile / curl
    if (allowedOrigins.length === 0) return cb(new Error('CORS not configured'), false);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked: ${origin}`), false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // 🔥 FIX PRE-FLIGHT

// 🚦 Rate limit
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 90,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS'
}));

// ❤️ Health check
app.get('/health', (_req, res) => res.json({ ok: true, v: 'beta3-admin-fr-export' }));

// 🔗 Routes
app.use('/auth', authRoutes);
app.use('/ai', aiRoutes);
app.use('/expert', expertRoutes);
app.use('/mission', missionRoutes);
app.use('/billing', billingRoutes);
app.use('/usage', usageRoutes);
app.use('/admin', adminRoutes);
app.use('/client', clientRoutes);
app.use('/vault', vaultRoutes);

// ❌ Gestion erreurs
app.use((err, _req, res, _next) => {
  if (String(err?.message || '').includes('CORS')) {
    return res.status(403).json({ error: 'cors_blocked' });
  }
  console.error(err);
  res.status(500).json({ error: 'server_error' });
});

// 🚀 Start
const port = process.env.PORT || 8787;
// ── Job : emails fin de période d'essai (toutes les 6h) ─────────────

app.listen(port, () => console.log(`POPE Online API listening on :${port}`));
// ── Job nocturne : emails de fin de période d'essai ─────────────────────────
// Lancé 30s après le démarrage du serveur, puis toutes les 6h
async function runTrialExpiryJob() {
  try {
    const expiredAccounts = await pool.query(`
      SELECT u.id, u.email, u.full_name, u.account_space
      FROM users u
      JOIN wallets w ON w.user_id = u.id
      WHERE w.status = 'trial_active'
        AND w.trial_expires_at IS NOT NULL
        AND w.trial_expires_at < NOW()
      LIMIT 50
    `);

    if (!expiredAccounts.rowCount) return;

    console.log(`[trial-job] ${expiredAccounts.rowCount} compte(s) expiré(s) à traiter`);
    const { resolveFrontendBaseUrl } = await import('./services/urls.js');
    const { sendMail } = await import('./services/mailer.js');
    const base = resolveFrontendBaseUrl();

    for (const row of expiredAccounts.rows) {
      try {
        // Marquer expiré AVANT l'envoi mail (évite double envoi si mail échoue)
        await pool.query(
          `UPDATE wallets SET status='trial_expired', updated_at=NOW() WHERE user_id=$1 AND status='trial_active'`,
          [row.id]
        );

        const firstName = (row.full_name || '').split(' ')[0] || 'Utilisateur';
        const spaceLabel = row.account_space === 'private' ? 'privé' : 'public';

        await sendMail({
          to: row.email,
          subject: `POPE Online — Votre période d'essai est terminée`,
          text: `Bonjour ${firstName},\n\nVotre essai gratuit POPE Online (espace ${spaceLabel}) s'est terminé.\n\nPour continuer : ${base}/pricing.html\n\n— POPE Online`,
          html: `<p>Bonjour ${firstName},</p><p>Votre essai gratuit POPE Online (espace <strong>${spaceLabel}</strong>) s'est terminé.</p><p>Continuez avec un plan adapté :</p><p><a href="${base}/pricing.html" style="display:inline-block;background:linear-gradient(135deg,#0079c1,#03a0d7);color:#fff;border-radius:12px;padding:12px 28px;font-weight:700;text-decoration:none;font-family:sans-serif">Voir les plans →</a></p><p style="color:#50627a;font-size:13px">Questions : <a href="mailto:contact@pope-online.com">contact@pope-online.com</a></p><p style="color:#50627a;font-size:13px">— POPE Online</p>`
        });

        console.log(`[trial-job] ✅ Email envoyé : ${row.email}`);
      } catch (err) {
        console.error(`[trial-job] ❌ ${row.email}:`, err.message);
      }
      await new Promise(r => setTimeout(r, 300));
    }
  } catch (err) {
    console.error('[trial-job] Erreur:', err.message);
  }
}

// Lancer 30s après le démarrage puis toutes les 6h
setTimeout(() => {
  runTrialExpiryJob();
  setInterval(runTrialExpiryJob, 6 * 60 * 60 * 1000);
}, 30000);