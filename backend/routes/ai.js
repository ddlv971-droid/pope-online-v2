import express from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import { withClient } from '../db/index.js';
import { clamp, rejectIfSensitive } from '../services/rgpd.js';
import { getUserVaultFiles, buildAiFileContext } from './vault.js';
import { buildSystemPrompt, buildUserPrompt, callMistral } from '../services/mistral.js';

const router = express.Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
});

router.post('/generate', requireAuth, limiter, async (req, res) => {
  try {
    const payload = req.body || {};
    payload.context = clamp(payload.context, 6000);
    payload.facts = clamp(payload.facts, 6000);
    payload.objective = clamp(payload.objective, 1200);

    const userId = req.user.sub;
    const uploadedFileIds = Array.isArray(payload.uploaded_file_ids) ? payload.uploaded_file_ids.slice(0, 8) : [];
    const fileBundle = await withClient(async (client) => getUserVaultFiles(client, userId, uploadedFileIds));
    const fileContext = buildAiFileContext(fileBundle);
    payload.facts = [payload.facts, fileContext].filter(Boolean).join('\n\n');

    const combined = `${payload.context}\n${payload.objective}\n${payload.facts}`;
    if (rejectIfSensitive(combined)) {
      return res.status(400).json({ error: 'sensitive_data' });
    }

    const result = await withClient(async (client) => {
      await client.query('begin');

      const wRes = await client.query('select * from wallets where user_id=$1 for update', [userId]);
      const wallet = wRes.rows[0];
      if (!wallet) {
        await client.query('rollback');
        return { ok: false, status: 403, body: { error: 'wallet_missing' } };
      }

      if (wallet.trial_expires_at && new Date(wallet.trial_expires_at).getTime() < Date.now()) {
        await client.query(
          `update wallets
              set status='trial_expired',
                  tickets_ai=0,
                  updated_at=now()
            where user_id=$1`,
          [userId]
        );
        await client.query('commit');
        return {
          ok: false,
          status: 402,
          body: {
            error: 'trial_expired',
            message: "Votre période gratuite est terminée\nContactez-nous pour définir l'offre adaptée à votre besoin"
          }
        };
      }

      const tickets = Number(wallet.tickets_ai ?? 0);
      if (tickets <= 0) {
        await client.query('rollback');
        return {
          ok: false,
          status: 402,
          body: {
            error: 'no_tickets',
            message: "Votre période gratuite est terminée\nContactez-nous pour définir l'offre adaptée à votre besoin"
          }
        };
      }

      await client.query('update wallets set tickets_ai = tickets_ai - 1, updated_at=now() where user_id=$1', [userId]);
      await client.query('commit');

      const system = buildSystemPrompt();
      const user = buildUserPrompt(payload);
      const text = await callMistral({ system, user });

      await client.query(
        `insert into usage_logs(user_id, kind, meta)
         values($1,$2,$3::jsonb)`,
        [userId, 'ai_generate', JSON.stringify({ usecase: payload.usecase, mode: payload.mode, len: combined.length, uploadedFiles: uploadedFileIds.length })]
      );

      const w2 = await client.query('select * from wallets where user_id=$1', [userId]);
      return { ok: true, text, wallet: w2.rows[0] };
    });

    if (!result.ok) return res.status(result.status).json(result.body);
    return res.json({ text: result.text, wallet: result.wallet });
  } catch (e) {
    console.error(e);
    const status = e?.status === 401 ? 502 : 500;
    return res.status(status).json({ error: 'ai_error', detail: String(e?.message || e) });
  }
});

export default router;
