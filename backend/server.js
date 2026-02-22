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

dotenv.config();

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: '250kb' }));

// CORS (strict)
const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // server-to-server / curl
    if (allowedOrigins.length === 0) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('CORS blocked'), false);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.options('*', cors());

// Global rate limit (light)
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false
}));

app.get('/health', (_req, res) => {
  res.json({ ok: true, v: 2 });
});

app.use('/auth', authRoutes);
app.use('/ai', aiRoutes);
app.use('/expert', expertRoutes);
app.use('/mission', missionRoutes);
app.use('/billing', billingRoutes);
app.use('/usage', usageRoutes);

app.use((err, _req, res, _next) => {
  if (String(err?.message || '').includes('CORS')) {
    return res.status(403).json({ error: 'cors_blocked' });
  }
  console.error(err);
  res.status(500).json({ error: 'server_error' });
});

const port = process.env.PORT || 8787;
app.listen(port, () => {
  console.log(`POPE Online V2 API listening on :${port}`);
});
