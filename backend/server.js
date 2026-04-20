<<<<<<< HEAD

=======
>>>>>>> staging
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

dotenv.config();

<<<<<<< HEAD
const app = express();
app.set('trust proxy', 1);
=======
const requiredEnv = ['DATABASE_URL', 'JWT_SECRET', 'FRONTEND_BASE_URL'];
const missingEnv = requiredEnv.filter((key) => !String(process.env[key] || '').trim());
if (missingEnv.length) {
  console.error(`Missing required environment variables: ${missingEnv.join(', ')}`);
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1);

// 🔒 Headers sécurité
>>>>>>> staging
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
<<<<<<< HEAD
app.use(express.json({ limit: '15mb' }));
=======

app.use(express.json({ limit: '15mb' }));

// 🌍 Localisation API
>>>>>>> staging
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => originalJson(localizeApiBody(body));
  next();
});

<<<<<<< HEAD
const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.length === 0) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('CORS blocked'), false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.options('*', cors());
app.use(rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false }));

app.get('/health', (_req, res) => res.json({ ok: true, v: 'beta3-admin-fr-export' }));
=======
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
    if (allowedOrigins.length === 0) return cb(null, true);
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
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS'
}));

// ❤️ Health check
app.get('/health', (_req, res) => res.json({ ok: true, v: 'beta3-admin-fr-export' }));

// 🔗 Routes
>>>>>>> staging
app.use('/auth', authRoutes);
app.use('/ai', aiRoutes);
app.use('/expert', expertRoutes);
app.use('/mission', missionRoutes);
app.use('/billing', billingRoutes);
app.use('/usage', usageRoutes);
app.use('/admin', adminRoutes);
app.use('/client', clientRoutes);
app.use('/vault', vaultRoutes);

<<<<<<< HEAD
app.use((err, _req, res, _next) => {
  if (String(err?.message || '').includes('CORS')) return res.status(403).json({ error: 'cors_blocked' });
=======
// ❌ Gestion erreurs
app.use((err, _req, res, _next) => {
  if (String(err?.message || '').includes('CORS')) {
    return res.status(403).json({ error: 'cors_blocked' });
  }
>>>>>>> staging
  console.error(err);
  res.status(500).json({ error: 'server_error' });
});

<<<<<<< HEAD
const port = process.env.PORT || 8787;
app.listen(port, () => console.log(`POPE Online Beta 2 API listening on :${port}`));
=======
// 🚀 Start
const port = process.env.PORT || 8787;
app.listen(port, () => console.log(`POPE Online API listening on :${port}`));
>>>>>>> staging
