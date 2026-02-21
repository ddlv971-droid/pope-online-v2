import express from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import { withClient } from '../db/index.js';
import { clamp, rejectIfSensitive } from '../services/rgpd.js';
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

    const combined = `${payload.context}\n${payload.objective}\n${payload.facts}`;
    if (rejectIfSensitive(combined)) {
      return res.status(400).json({ error: 'sensitive_data' });
    }

    const userId = req.user.sub;

    const result = await withClient(async (client) => {
      await client.query('begin');

      const w = await client.query('select tickets_ai from wallets where user_id=$1 for update', [userId]);
      const tickets = Number(w.rows?.[0]?.tickets_ai ?? 0);
      if (tickets <= 0) {
        await client.query('rollback');
        return { ok: false, status: 402, body: { error: 'no_tickets' } };
      }

      await client.query('update wallets set tickets_ai = tickets_ai - 1, updated_at=now() where user_id=$1', [userId]);

      // do the expensive call outside the transaction? We keep minimal: commit, call, then log.
      await client.query('commit');

      const system = buildSystemPrompt();
      const user = buildUserPrompt(payload);
      const text = await callMistral({ system, user });

      await client.query(
        'insert into usage_logs(user_id, kind, meta) values($1,$2,$3::jsonb)',
        [userId, 'ai_generate', JSON.stringify({ usecase: payload.usecase, mode: payload.mode, len: combined.length })]
      );

      const w2 = await client.query('select tickets_ai, tickets_expert from wallets where user_id=$1', [userId]);
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
