import express from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import { withClient } from '../db/index.js';
import { clamp, rejectIfSensitive } from '../services/rgpd.js';
import { getUserVaultFiles, buildAiFileContext, buildDossierAnalysis } from './vault.js';
import { buildSystemPrompt, buildUserPrompt, callMistral } from '../services/mistral.js';

const router = express.Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
});

// ── V90.2 : garde-fous de dépense ─────────────────────────────────────────────
const MAX_PER_USER_MIN = Number(process.env.AI_MAX_PER_USER_MIN || 5);
const MAX_PER_USER_DAY = Number(process.env.AI_MAX_PER_USER_DAY || 40);
const MAX_GLOBAL_DAY   = Number(process.env.AI_MAX_GLOBAL_DAY || 500);
const MAX_CONCURRENT   = Number(process.env.AI_MAX_CONCURRENT || 6);

// Limite par UTILISATEUR (et non par IP) : keyGenerator sur l'identifiant du compte.
const userLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: MAX_PER_USER_MIN,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `u:${req.user?.sub || 'anon'}`,
  validate: false,
  message: { error: 'too_many_requests' }
});

const inFlightUsers = new Set();   // une seule génération à la fois par compte
let inFlightTotal = 0;             // et un nombre borné au global

router.post('/generate', requireAuth, userLimiter, limiter, async (req, res) => {
  const lockId = String(req.user?.sub || '');
  let locked = false;
  try {
    if (inFlightUsers.has(lockId)) return res.status(429).json({ error: 'ai_busy' });
    if (inFlightTotal >= MAX_CONCURRENT) return res.status(503).json({ error: 'ai_unavailable', reason: 'busy' });
    inFlightUsers.add(lockId); inFlightTotal++; locked = true;

    const payload = req.body || {};
    payload.context = clamp(payload.context, 6000);
    payload.facts = clamp(payload.facts, 6000);
    payload.objective = clamp(payload.objective, 1200);

    const userId = req.user.sub;
    const uploadedFileIds = Array.isArray(payload.uploaded_file_ids) ? payload.uploaded_file_ids.slice(0, 8) : [];
    const fileBundle = await withClient(async (client) => getUserVaultFiles(client, userId, uploadedFileIds));
    const dossierAnalysis = buildDossierAnalysis(fileBundle);
    // Plafond global du contexte issu des pièces jointes (évite des prompts de plusieurs dizaines de milliers de tokens)
    const fileContext = String(buildAiFileContext(fileBundle) || '').slice(0, 24000);
    payload.facts = [payload.facts, fileContext].filter(Boolean).join('\n\n');

    const combined = `${payload.context}\n${payload.objective}\n${payload.facts}`;
    if (rejectIfSensitive(combined)) {
      return res.status(400).json({ error: 'sensitive_data' });
    }

    // Plafonds glissants sur 24 h (comptés sur les générations réussies, tous comptes y compris « illimités »)
    const caps = await withClient((c) => c.query(
      `select count(*) filter (where user_id = $1)::int as mine, count(*)::int as total
         from usage_logs where kind = 'ai_generate' and created_at > now() - interval '24 hours'`, [userId]));
    const { mine, total } = caps.rows[0] || { mine: 0, total: 0 };
    if (total >= MAX_GLOBAL_DAY) return res.status(503).json({ error: 'ai_unavailable', reason: 'global_cap' });
    if (mine >= MAX_PER_USER_DAY) return res.status(429).json({ error: 'ai_daily_limit' });

    const result = await withClient(async (client) => {
      await client.query('begin');

      const wRes = await client.query('select * from wallets where user_id=$1 for update', [userId]);
      const wallet = wRes.rows[0];
      if (!wallet) {
        await client.query('rollback');
        return { ok: false, status: 403, body: { error: 'wallet_missing' } };
      }

      // ── V88.4 : accès à l'outil de rédaction ───────────────────────────────
      // Inclus dans l'essai (15 jours) et dans les offres payantes actives.
      // Illimité quand ai_unlimited est vrai : aucun décompte (en V88, chaque
      // génération décrémentait la valeur sentinelle 9999 → 9998…).
      const status = String(wallet.status || '');
      const trialOver = status === 'trial_expired'
        || (status !== 'active' && wallet.trial_expires_at && new Date(wallet.trial_expires_at).getTime() < Date.now());
      if (trialOver) {
        if (status !== 'trial_expired' && status === 'trial_active') {
          await client.query(`update wallets set status='trial_expired', updated_at=now() where user_id=$1`, [userId]);
        }
        await client.query('commit');
        return { ok: false, status: 402, body: { error: 'trial_expired' } };
      }
      if (status === 'pending_verification') {
        await client.query('rollback');
        return { ok: false, status: 403, body: { error: 'email_not_verified' } };
      }
      if (!['active', 'trial_active'].includes(status)) {
        await client.query('rollback');
        return { ok: false, status: 402, body: { error: 'subscription_required' } };
      }
      const tickets = Number(wallet.tickets_ai ?? 0);
      const unlimited = Boolean(wallet.ai_unlimited) || tickets >= 1000;
      if (!unlimited) {
        if (tickets <= 0) {
          await client.query('rollback');
          return { ok: false, status: 402, body: { error: 'no_tickets' } };
        }
        await client.query('update wallets set tickets_ai = tickets_ai - 1, updated_at=now() where user_id=$1', [userId]);
      }
      await client.query('commit');
      return { ok: true, charged: !unlimited };
    });

    if (!result.ok) return res.status(result.status).json(result.body);

    // Appel Mistral HORS transaction / hors connexion DB, avec remboursement en cas d'échec.
    const accountSpace = req.user.accountSpace || 'public';
    const system = buildSystemPrompt(accountSpace);
    const user = buildUserPrompt({ ...payload, accountSpace });
    let text;
    try {
      text = await callMistral({ system, user });
    } catch (err) {
      if (result.charged) {
        try {
          await withClient((c) => c.query('update wallets set tickets_ai = tickets_ai + 1, updated_at=now() where user_id=$1', [userId]));
        } catch (e2) { console.error('refund_failed', e2); }
      }
      throw err;
    }

    const w2 = await withClient(async (client) => {
      await client.query(
        `insert into usage_logs(user_id, kind, meta)
         values($1,$2,$3::jsonb)`,
        [userId, 'ai_generate', JSON.stringify({ usecase: payload.usecase, mode: payload.mode, len: combined.length, uploadedFiles: uploadedFileIds.length })]
      );
      return client.query('select * from wallets where user_id=$1', [userId]);
    });
    return res.json({ text, wallet: w2.rows[0], dossierAnalysis: dossierAnalysis || null });
  } catch (e) {
    console.error(e);
    if (e?.code === 'ai_unavailable') {
      return res.status(503).json({ error: 'ai_unavailable', reason: e.reason });
    }
    return res.status(500).json({ error: 'ai_error' });
  } finally {
    if (locked) { inFlightUsers.delete(lockId); inFlightTotal = Math.max(0, inFlightTotal - 1); }
  }
});

export default router;
