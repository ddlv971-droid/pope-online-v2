import express from 'express';
import crypto  from 'crypto';
import { withClient } from '../db/index.js';
import { sendMail }   from '../services/mailer.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// ── GET /billing/plans ───────────────────────────────────────────────────────
router.get('/plans', (_req, res) => {
  res.json({
    starter_m: { id:'starter_m', name:'Starter mensuel', price:49,  currency:'eur', expert_limit:5,  ai_unlimited:true },
    starter_a: { id:'starter_a', name:'Starter annuel',  price:500, currency:'eur', expert_limit:5,  ai_unlimited:true },
    pro_m:     { id:'pro_m',     name:'Pro mensuel',     price:89,  currency:'eur', expert_limit:15, ai_unlimited:true },
    pro_a:     { id:'pro_a',     name:'Pro annuel',      price:908, currency:'eur', expert_limit:15, ai_unlimited:true },
  });
});

// ── Résolution du plan depuis une session Stripe ─────────────────────────────
function resolvePlan(session) {
  const meta      = session.metadata || {};
  const planCode  = String(meta.plan_code || '').toUpperCase();
  const clientRef = String(meta.client_reference_id || session.client_reference_id || '').toLowerCase();

  if (planCode === 'STARTER' || clientRef.includes('starter')) {
    const annual = planCode.includes('A') || clientRef.includes('_a');
    return { label:'Starter', code: annual ? 'STARTER_A' : 'STARTER_M', expertLimit:5 };
  }
  if (planCode === 'PRO' || clientRef.includes('pro')) {
    const annual = planCode.includes('A') || clientRef.includes('_a');
    return { label:'Pro', code: annual ? 'PRO_A' : 'PRO_M', expertLimit:15 };
  }
  // Fallback montant (centimes)
  const amount = Number(session.amount_total || 0);
  if (amount <= 4900)  return { label:'Starter', code:'STARTER_M', expertLimit:5  };
  if (amount <= 50000) return { label:'Starter', code:'STARTER_A', expertLimit:5  };
  if (amount <= 8900)  return { label:'Pro',     code:'PRO_M',     expertLimit:15 };
  return                      { label:'Pro',     code:'PRO_A',     expertLimit:15 };
}

function resolvePlanFromInvoice(lines) {
  for (const line of (lines || [])) {
    const desc = String(line.description || line.price?.nickname || line.price?.product?.name || '').toLowerCase();
    if (desc.includes('pro'))     return { label:'Pro',     code:'PRO_M',     expertLimit:15 };
    if (desc.includes('starter')) return { label:'Starter', code:'STARTER_M', expertLimit:5  };
    const amt = Number(line.amount || 0);
    if (amt >= 8900)  return { label:'Pro',     code:'PRO_M', expertLimit:15 };
    if (amt >= 4900)  return { label:'Starter', code:'STARTER_M', expertLimit:5 };
  }
  return null;
}

// ── Vérification signature Stripe ────────────────────────────────────────────
function verifyStripeSignature(rawBody, sigHeader, secret) {
  try {
    const parts = {};
    for (const part of sigHeader.split(',')) {
      const eq = part.indexOf('=');
      if (eq > 0) parts[part.slice(0, eq)] = part.slice(eq + 1);
    }
    const ts = parts.t;
    const v1 = parts.v1;
    if (!ts || !v1) return false;

    const payload  = `${ts}.${rawBody}`;
    const expected = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');

    // Comparaison résistante aux timing attacks
    // Les deux chaînes doivent avoir la même longueur (64 hex chars)
    if (v1.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(v1, 'hex'), Buffer.from(expected, 'hex'));
  } catch (e) {
    console.error('[stripe sig] verification error:', e.message);
    return false;
  }
}

// ── Activation/mise à jour du wallet ─────────────────────────────────────────
async function activateWallet(client, userId, plan, stripeCustomerId) {
  await client.query(
    `insert into wallets(user_id, plan_code, plan_label, status, ai_unlimited,
                         expert_limit, expert_used, tickets_ai, tickets_expert,
                         stripe_customer_id, plan_start, renews_at)
     values($1,$2,$3,'active',true,$4,0,9999,$4,$5,now(),now() + interval '30 days')
     on conflict(user_id) do update set
       plan_code          = excluded.plan_code,
       plan_label         = excluded.plan_label,
       status             = 'active',
       ai_unlimited       = true,
       expert_limit       = excluded.expert_limit,
       expert_used        = 0,
       tickets_ai         = 9999,
       tickets_expert     = excluded.expert_limit,
       stripe_customer_id = coalesce(excluded.stripe_customer_id, wallets.stripe_customer_id),
       plan_start         = coalesce(wallets.plan_start, now()),
       renews_at          = excluded.renews_at,
       updated_at         = now()`,
    [userId, plan.code, plan.label, plan.expertLimit, stripeCustomerId || null]
  );
}

// ── POST /billing/webhook ─────────────────────────────────────────────────────
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig    = req.headers['stripe-signature'];
  const rawBody = req.body instanceof Buffer ? req.body.toString('utf8') : String(req.body);

  // Vérification de signature uniquement si le secret est configuré
  if (secret) {
    if (!sig) {
      console.error('[stripe webhook] Signature absente — requête rejetée');
      return res.status(400).json({ error: 'missing_signature' });
    }
    if (!verifyStripeSignature(rawBody, sig, secret)) {
      console.error('[stripe webhook] Signature invalide — requête rejetée');
      return res.status(400).json({ error: 'invalid_signature' });
    }
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (e) {
    return res.status(400).json({ error: 'parse_error' });
  }

  console.log(`[stripe webhook] event reçu: ${event.type} (${event.id})`);

  // Idempotence — évite les doublons en cas de retry Stripe
  try {
    const inserted = await withClient(async (client) => {
      const r = await client.query(
        `insert into stripe_events(id, type, payload)
         values($1,$2,$3::jsonb)
         on conflict(id) do nothing
         returning id`,
        [event.id, event.type, JSON.stringify(event)]
      );
      return r.rowCount > 0;
    });
    if (!inserted) {
      console.log(`[stripe webhook] event déjà traité: ${event.id}`);
      return res.json({ received: true, skipped: true });
    }
  } catch (e) {
    console.warn('[stripe webhook] idempotence check failed:', e.message);
    // On continue quand même
  }

  // ── checkout.session.completed ────────────────────────────────────────────
  if (event.type === 'checkout.session.completed') {
    const session   = event.data.object;
    const userEmail = String(
      session.customer_email || session.customer_details?.email || ''
    ).trim().toLowerCase();
    const plan = resolvePlan(session);
    const stripeCustomerId = session.customer || null;

    console.log(`[stripe] checkout.completed — email=${userEmail} plan=${plan.label}`);

    if (!userEmail) {
      console.error('[stripe] checkout.completed: email introuvable dans la session');
    } else {
      try {
        await withClient(async (client) => {
          const userRes = await client.query(
            'select id, full_name from users where lower(email)=$1 limit 1',
            [userEmail]
          );
          if (!userRes.rowCount) {
            console.error(`[stripe] user introuvable pour: ${userEmail}`);
            return;
          }
          const userId   = userRes.rows[0].id;
          const fullName = userRes.rows[0].full_name || '';

          // Activer le wallet
          await activateWallet(client, userId, plan, stripeCustomerId);
          console.log(`[stripe] wallet activé: userId=${userId} plan=${plan.label} expertLimit=${plan.expertLimit}`);

          // Notification in-app
          try {
            await client.query(
              `insert into notifications(user_id, kind, title, body, link)
               values($1,'plan_upgraded','Abonnement activé',$2,'/dashboard.html')`,
              [userId, `Votre plan ${plan.label} est actif — ${plan.expertLimit} conseils experts disponibles ce mois.`]
            );
          } catch (notifErr) {
            console.warn('[stripe] notification failed:', notifErr.message);
          }

          // Email de confirmation (hors transaction pour ne pas bloquer si SMTP lent)
          const prenom = fullName.split(' ')[0] || 'Client';
          setImmediate(async () => {
            try {
              await sendMail({
                to:      userEmail,
                subject: `POPE Online — Votre abonnement ${plan.label} est actif ✓`,
                text:    `Bonjour ${prenom},\n\nVotre abonnement POPE Online ${plan.label} est maintenant actif.\n\nVous disposez de :\n• Génération IA illimitée\n• ${plan.expertLimit} conseils experts par mois\n• Accès au clausier documentaire\n\nConnectez-vous à votre espace :\nhttps://pope-online.com/dashboard.html\n\nMerci de votre confiance.\nL'équipe POPE Online\ncontact@pope-online.com — 09 70 70 30 55`,
              });
              console.log(`[stripe] email confirmation envoyé à ${userEmail}`);
            } catch (mailErr) {
              console.error(`[stripe] ÉCHEC email confirmation (${userEmail}):`, mailErr.message);
            }
          });
        });
      } catch (e) {
        console.error('[stripe checkout.completed] Erreur DB:', e.message);
      }
    }
  }

  // ── invoice.paid — renouvellement mensuel/annuel + premier paiement ────────
  if (event.type === 'invoice.paid') {
    const invoice       = event.data.object;
    const custId        = String(invoice.customer || '').trim();
    const billingReason = invoice.billing_reason;
    // Traiter: renouvellement (subscription_cycle) ET premier paiement (subscription_create)
    // subscription_create est émis quand checkout.session.completed peut avoir raté
    const isRenewal = billingReason === 'subscription_cycle';
    const isCreate  = billingReason === 'subscription_create';

    console.log(`[stripe] invoice.paid — customer=${custId} reason=${billingReason}`);

    if (custId && (isRenewal || isCreate)) {
      try {
        await withClient(async (client) => {
          const userRes = await client.query(
            `select w.user_id, u.email, u.full_name
             from wallets w join users u on u.id=w.user_id
             where w.stripe_customer_id=$1 limit 1`,
            [custId]
          );

          if (!userRes.rowCount) {
            // Sur subscription_create: l'email est parfois dans la facture
            const invoiceEmail = String(invoice.customer_email || '').trim().toLowerCase();
            if (invoiceEmail && isCreate) {
              console.log(`[stripe] invoice.paid/create: recherche par email ${invoiceEmail}`);
              const byEmail = await client.query(
                'select id, full_name from users where lower(email)=$1 limit 1',
                [invoiceEmail]
              );
              if (byEmail.rowCount) {
                const userId = byEmail.rows[0].id;
                const plan   = resolvePlanFromInvoice(invoice.lines?.data) || { label:'Starter', code:'STARTER_M', expertLimit:5 };
                await activateWallet(client, userId, plan, custId);
                console.log(`[stripe] invoice/create wallet activé par email: ${invoiceEmail}`);
              } else {
                console.error(`[stripe] invoice.paid/create: user introuvable pour ${invoiceEmail} et ${custId}`);
              }
            } else {
              console.warn('[stripe invoice.paid] customer introuvable:', custId);
            }
            return;
          }

          const userId   = userRes.rows[0].user_id;
          const email    = userRes.rows[0].email;
          const fullName = userRes.rows[0].full_name || '';
          const plan     = resolvePlanFromInvoice(invoice.lines?.data);

          const invoicePeriodEnd = invoice.period_end
            ? new Date(Number(invoice.period_end) * 1000)
            : new Date(Date.now() + 30 * 86400000);

          if (isCreate) {
            // Premier paiement : activer le wallet (fallback si checkout.completed a raté)
            const planToUse = plan || { label:'Starter', code:'STARTER_M', expertLimit:5 };
            await activateWallet(client, userId, planToUse, custId);
            console.log(`[stripe] invoice/create — wallet activé (fallback) userId=${userId}`);

            // Email de confirmation si pas encore envoyé
            const prenom = fullName.split(' ')[0] || 'Client';
            setImmediate(async () => {
              try {
                await sendMail({
                  to:      email,
                  subject: `POPE Online — Votre abonnement ${planToUse.label} est actif ✓`,
                  text:    `Bonjour ${prenom},\n\nVotre abonnement POPE Online ${planToUse.label} est maintenant actif.\n\nVous disposez de :\n• Génération IA illimitée\n• ${planToUse.expertLimit} conseils experts par mois\n\nConnectez-vous :\nhttps://pope-online.com/dashboard.html\n\nMerci.\nL'équipe POPE Online`,
                });
              } catch (mailErr) {
                console.error(`[stripe] ÉCHEC email invoice/create (${email}):`, mailErr.message);
              }
            });
          } else if (isRenewal) {
            // Renouvellement : remise à zéro du compteur
            if (plan) {
              await client.query(
                `update wallets set expert_used=0, expert_limit=$2, plan_code=$3,
                 plan_label=$4, status='active', renews_at=$5, updated_at=now()
                 where user_id=$1`,
                [userId, plan.expertLimit, plan.code, plan.label, invoicePeriodEnd]
              );
            } else {
              await client.query(
                `update wallets set expert_used=0, status='active', renews_at=$2, updated_at=now()
                 where user_id=$1`,
                [userId, invoicePeriodEnd]
              );
            }
            console.log(`[stripe] renouvellement — expert_used remis à 0 pour ${custId}`);

            // Notification in-app
            try {
              const expertLimit = plan?.expertLimit ?? 0;
              await client.query(
                `insert into notifications(user_id, kind, title, body, link)
                 values($1,'plan_renewed','Abonnement renouvelé',$2,'/expert.html')`,
                [userId, `Votre abonnement a été renouvelé. ${expertLimit} conseils experts disponibles ce mois.`]
              );
            } catch (_) {}
          }
        });
      } catch (e) {
        console.error('[stripe invoice.paid] Erreur DB:', e.message);
      }
    }
  }

  // ── customer.subscription.deleted — résiliation ───────────────────────────
  if (event.type === 'customer.subscription.deleted') {
    const sub    = event.data.object;
    const custId = String(sub.customer || '').trim();

    if (custId) {
      try {
        await withClient(async (client) => {
          const userRes = await client.query(
            'select w.user_id, u.email from wallets w join users u on u.id=w.user_id where w.stripe_customer_id=$1 limit 1',
            [custId]
          );
          if (!userRes.rowCount) {
            console.warn('[stripe subscription.deleted] customer introuvable:', custId);
            return;
          }
          const { user_id: userId, email } = userRes.rows[0];

          await client.query(
            `update wallets set plan_code='FREE', plan_label='Free', status='cancelled',
             expert_limit=2, expert_used=0, ai_unlimited=false, tickets_ai=0, updated_at=now()
             where user_id=$1`,
            [userId]
          );
          console.log(`[stripe] abonnement annulé — downgrade Free pour ${custId}`);

          try {
            await client.query(
              `insert into notifications(user_id, kind, title, body, link)
               values($1,'plan_cancelled','Abonnement résilié',$2,'/pricing.html')`,
              [userId, 'Votre abonnement a été résilié. Vous êtes repassé en offre Free.']
            );
          } catch (_) {}

          setImmediate(async () => {
            try {
              await sendMail({
                to:      email,
                subject: 'POPE Online — Votre abonnement a été résilié',
                text:    `Bonjour,\n\nVotre abonnement POPE Online a bien été résilié.\n\nVous continuez à accéder à POPE Online en offre Free (2 conseils experts/mois).\n\nPour vous réabonner : https://pope-online.com/pricing.html\n\nL'équipe POPE Online`,
              });
            } catch (mailErr) {
              console.error(`[stripe] ÉCHEC email résiliation (${email}):`, mailErr.message);
            }
          });
        });
      } catch (e) {
        console.error('[stripe subscription.deleted] Erreur:', e.message);
      }
    }
  }

  res.json({ received: true });
});

// ── GET /billing/invoices — historique paiements ─────────────────────────────
router.get('/invoices', requireAuth, async (req, res) => {
  const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_SECRET) return res.json({ invoices: [] });

  try {
    const userId     = req.user.sub;
    const walletRes  = await withClient(async (c) =>
      c.query('select stripe_customer_id from wallets where user_id=$1 limit 1', [userId])
    );
    const customerId = walletRes.rows[0]?.stripe_customer_id;
    if (!customerId) return res.json({ invoices: [] });

    const stripeRes = await fetch(
      `https://api.stripe.com/v1/invoices?customer=${encodeURIComponent(customerId)}&limit=24&status=paid`,
      { headers: { Authorization: `Bearer ${STRIPE_SECRET}` } }
    );
    if (!stripeRes.ok) return res.json({ invoices: [] });

    const stripeData = await stripeRes.json();
    const invoices = (stripeData.data || []).map(inv => ({
      id:                  inv.id,
      number:              inv.number,
      amount_paid:         inv.amount_paid,
      currency:            inv.currency,
      status:              inv.status,
      created:             inv.created,
      period_start:        inv.period_start,
      period_end:          inv.period_end,
      invoice_pdf:         inv.invoice_pdf,
      hosted_invoice_url:  inv.hosted_invoice_url,
      description:         inv.lines?.data?.[0]?.description || null,
    }));
    return res.json({ invoices });
  } catch (e) {
    console.error('[billing/invoices] error:', e.message);
    return res.json({ invoices: [] });
  }
});

export default router;
