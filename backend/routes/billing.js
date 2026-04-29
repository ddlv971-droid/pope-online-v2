import express from 'express';
import crypto from 'crypto';
import { withClient } from '../db/index.js';
import { sendMail } from '../services/mailer.js';

const router = express.Router();

// ── GET /billing/plans ───────────────────────────────────────────────────────
router.get('/plans', (_req, res) => {
  res.json({
    starter_m: { id: 'starter_m', name: 'Starter mensuel', price: 49, currency: 'eur', expert_limit: 5, ai_unlimited: true },
    starter_a: { id: 'starter_a', name: 'Starter annuel',  price: 500, currency: 'eur', expert_limit: 5, ai_unlimited: true },
    pro_m:     { id: 'pro_m',     name: 'Pro mensuel',     price: 89, currency: 'eur', expert_limit: 15, ai_unlimited: true },
    pro_a:     { id: 'pro_a',     name: 'Pro annuel',      price: 908, currency: 'eur', expert_limit: 15, ai_unlimited: true }
  });
});

// Plan metadata depuis le price_id ou metadata Stripe
function resolvePlan(session) {
  const meta      = session.metadata || {};
  const planCode  = String(meta.plan_code || '').toUpperCase();
  const clientRef = String(meta.client_reference_id || session.client_reference_id || '').toLowerCase();

  if (planCode === 'STARTER' || clientRef.includes('starter')) {
    const isAnnual = planCode.includes('A') || clientRef.includes('_a');
    return { label: 'Starter', code: isAnnual ? 'STARTER_A' : 'STARTER_M', expertLimit: 5 };
  }
  if (planCode === 'PRO' || clientRef.includes('pro')) {
    const isAnnual = planCode.includes('A') || clientRef.includes('_a');
    return { label: 'Pro', code: isAnnual ? 'PRO_A' : 'PRO_M', expertLimit: 15 };
  }
  // Fallback : tenter de déduire du montant
  const amount = Number(session.amount_total || 0);
  if (amount <= 4900)  return { label: 'Starter', code: 'STARTER_M', expertLimit: 5 };
  if (amount <= 50000) return { label: 'Starter', code: 'STARTER_A', expertLimit: 5 };
  if (amount <= 8900)  return { label: 'Pro',     code: 'PRO_M',     expertLimit: 15 };
  return { label: 'Pro', code: 'PRO_A', expertLimit: 15 };
}

// ── POST /billing/webhook — Stripe webhook ───────────────────────────────────
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig    = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    if (secret && sig) {
      // Vérification signature Stripe
      const parts    = sig.split(',').reduce((acc, p) => { const [k,v] = p.split('='); acc[k]=v; return acc; }, {});
      const ts       = parts.t;
      const payload  = `${ts}.${req.body.toString()}`;
      const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      if (!crypto.timingSafeEqual(Buffer.from(parts.v1||'','hex'), Buffer.from(expected,'hex'))) {
        return res.status(400).json({ error: 'invalid_signature' });
      }
    }
    event = JSON.parse(req.body.toString());
  } catch (e) {
    return res.status(400).json({ error: 'parse_error' });
  }

  // Idempotence
  try {
    await withClient(async (client) => {
      await client.query(
        'insert into stripe_events(id, type, payload) values($1,$2,$3::jsonb) on conflict do nothing',
        [event.id, event.type, JSON.stringify(event)]
      );
    });
  } catch (_) {}

  // Traiter l'événement
  if (event.type === 'checkout.session.completed') {
    const session   = event.data.object;
    const userEmail = String(session.customer_email || session.customer_details?.email || '').trim().toLowerCase();
    const plan      = resolvePlan(session);

    if (userEmail) {
      try {
        await withClient(async (client) => {
          // Trouver l'utilisateur
          const userRes = await client.query(
            'select id from users where email=$1 limit 1',
            [userEmail]
          );
          if (!userRes.rowCount) {
            console.warn(`[stripe] user not found for email: ${userEmail}`);
            return;
          }
          const userId = userRes.rows[0].id;

          // Activer le wallet
          await client.query(
            `insert into wallets(user_id, plan_code, plan_label, status, ai_unlimited, expert_limit, expert_used, tickets_ai, tickets_expert)
             values($1,$2,$3,'active',true,$4,0,9999,$4)
             on conflict(user_id) do update set
               plan_code    = excluded.plan_code,
               plan_label   = excluded.plan_label,
               status       = 'active',
               ai_unlimited = true,
               expert_limit = excluded.expert_limit,
               expert_used  = 0,
               tickets_ai   = 9999,
               tickets_expert = excluded.expert_limit,
               updated_at   = now()`,
            [userId, plan.code, plan.label, plan.expertLimit]
          );

          // Notification in-app
          await client.query(
            `insert into notifications(user_id, kind, title, body, link)
             values($1,'plan_upgraded','Abonnement activé',$2,'/dashboard.html')`,
            [userId, `Votre plan ${plan.label} est actif. Vous disposez de ${plan.expertLimit} relectures expertes par mois.`]
          );

          console.log(`[stripe] plan ${plan.label} activé pour ${userEmail}`);
        });

        // Email de confirmation
        await sendMail({
          to: userEmail,
          subject: `POPE Online — Votre abonnement ${plan.label} est actif`,
          text: `Bonjour,\n\nVotre abonnement POPE Online ${plan.label} est maintenant actif.\n\nVous disposez de :\n• Production de livrables IA illimitée\n• ${plan.expertLimit} relectures expertes par mois\n• Accès au clausier documentaire\n\nConnectez-vous à votre espace :\nhttps://pope-online.com/dashboard.html\n\nMerci de votre confiance.\nL'équipe POPE Online\ncontact@pope-online.com — 09 70 70 30 55`
        });
      } catch (e) {
        console.error('[stripe webhook] error:', e.message);
      }
    }
  }

  // Gérer l'abonnement annulé
  if (event.type === 'customer.subscription.deleted') {
    const sub    = event.data.object;
    const custId = sub.customer;
    console.log(`[stripe] subscription deleted for customer ${custId} — downgrade à gérer manuellement ou via customer lookup`);
  }

  res.json({ received: true });
});

export default router;
