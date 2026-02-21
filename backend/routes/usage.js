import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { query } from '../db/index.js';

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const r = await query(
      `select id, kind, meta, created_at
         from usage_logs
        where user_id=$1
        order by created_at desc
        limit 200`,
      [userId]
    );
    res.json({ items: r.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

export default router;
