<<<<<<< HEAD
=======

>>>>>>> 7bbf5523fa98ca38a268f527416bf281554fe2d1
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
import { localizeApiBody } from './services/i18n.js';

dotenv.config();

<<<<<<< HEAD
const requiredEnv = ['DATABASE_URL', 'JWT_SECRET', 'CORS_ORIGIN'];
const missingEnv = requiredEnv.filter((key) => !String(process.env[key] || '').trim());
if (missingEnv.length) {
  console.error(`❌ Variables d'environnement obligatoires manquantes : ${missingEnv.join(', ')}`);
  process.exit(1);
}

=======
>>>>>>> 7bbf5523fa98ca38a268f527416bf281554fe2d1
const app = express();
app.set('trust proxy', 1);
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
<<<<<<< HEAD
  res.setHeader('Cache-Control', 'no-store');
=======
>>>>>>> 7bbf5523fa98ca38a268f527416bf281554fe2d1
  next();
});
app.use(express.json({ limit: '250kb' }));
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => originalJson(localizeApiBody(body));
  next();
});

<<<<<<< HEAD
const allowedOrigins = String(process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('CORS blocked'), false);
  },
  credentials: true,
=======
const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.length === 0) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('CORS blocked'), false);
  },
>>>>>>> 7bbf5523fa98ca38a268f527416bf281554fe2d1
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.options('*', cors());
app.use(rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false }));

<<<<<<< HEAD
app.get('/health', (_req, res) => res.json({ ok: true, v: 'beta-secure-1704' }));
=======
app.get('/health', (_req, res) => res.json({ ok: true, v: 'beta3-admin-fr-export' }));
>>>>>>> 7bbf5523fa98ca38a268f527416bf281554fe2d1
app.use('/auth', authRoutes);
app.use('/ai', aiRoutes);
app.use('/expert', expertRoutes);
app.use('/mission', missionRoutes);
app.use('/billing', billingRoutes);
app.use('/usage', usageRoutes);
app.use('/admin', adminRoutes);
app.use('/client', clientRoutes);

app.use((err, _req, res, _next) => {
  if (String(err?.message || '').includes('CORS')) return res.status(403).json({ error: 'cors_blocked' });
  console.error(err);
  res.status(500).json({ error: 'server_error' });
});

const port = process.env.PORT || 8787;
<<<<<<< HEAD
app.listen(port, () => console.log(`POPE Online Secure API listening on :${port}`));
=======
app.listen(port, () => console.log(`POPE Online Beta 2 API listening on :${port}`));
>>>>>>> 7bbf5523fa98ca38a268f527416bf281554fe2d1
