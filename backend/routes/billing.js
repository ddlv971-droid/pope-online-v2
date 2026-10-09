import express from 'express';
import crypto from 'crypto';
import { withClient } from '../db/index.js';
import { sendMail } from '../services/mailer.js';
import { requireAuth } from '../middleware/auth.js';
import { resolveFrontendBaseUrl } from '../services/urls.js';
import {
  publicCatalogue, getPlan, CREDIT, resolvePurchase, resolvePlanFromInvoiceLines, parseClientReference,
  isUnlimited, RESPONSE_DELAY_LABEL
} from '../services/plans.js';

const router = express.Router();
const SIGNATURE_TOLERANCE_SECONDS = 300;

// ── GET /billing/plans — catalogue V88 (Élu, Collectivité, crédit) ──────────
router.get('/plans', (_req, res) => {
  res.json(publicCatalogue());
});

// ── POST /billing/checkout — ouvre la page de paiement Stripe (V88.11) ───────
// Corrige « Souscrire l'offre Élu ne renvoie pas au paiement » : plus besoin de créer des
// liens de paiement à la main. Nécessite STRIPE_SECRET_KEY sur l'API (clé « sk_live_… » en
// production, « sk_test_… » en recette). Si STRIPE_PAYMENT_LINK_<OFFRE> est défini
// (ex. STRIPE_PAYMENT_LINK_ELU_M), ce lien est utilisé à la place.
// Offres vendues en ligne : Élu mensuel/annuel et pack de Conseils Expert.
// Collectivité reste sur devis.
function formEncode(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') formEncode(v, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out;
}

router.post('/checkout', requireAuth, async (req, res) => {
  try {
    const key = String(req.body?.plan || '').trim().toLowerCase();
    const allowed = { elu_m: 'ELU_M', elu_a: 'ELU_A', credit: 'CREDIT' };
    if (!allowed[key]) return res.status(400).json({ error: 'unknown_plan' });

    const userId = req.user.sub;
    const email = String(req.user.email || '').trim();
    const reference = `${key}--${userId}`;

    const linkEnv = process.env[`STRIPE_PAYMENT_LINK_${key.toUpperCase()}`];
    if (linkEnv) {
      const url = new URL(linkEnv);
      url.searchParams.set('client_reference_id', reference);
      if (email) url.searchParams.set('prefilled_email', email);
      return res.json({ ok: true, url: url.toString() });
    }

    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) return res.status(503).json({ error: 'payment_not_configured' });

    const base = resolveFrontendBaseUrl();
    const isCredit = key === 'credit';
    const plan = isCredit ? null : getPlan(allowed[key]);
    const unitAmount = Math.round((isCredit ? CREDIT.price : plan.price) * 100);
    const productName = isCredit
      ? 'POPE Online — Pack de 3 Conseils Expert (valable 1 mois)'
      : `POPE Online — Offre Élu (${plan.interval === 'year' ? 'annuelle, -15 %' : 'mensuelle'})`;

    const params = {
      mode: isCredit ? 'payment' : 'subscription',
      client_reference_id: reference,
      success_url: `${base}/dashboard.html?paiement=ok`,
      cancel_url: `${base}/pricing.html?paiement=annule`,
      allow_promotion_codes: 'true',
      metadata: { plan_code: isCredit ? 'CREDIT' : plan.code, client_reference_id: reference, user_id: userId },
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: unitAmount,
          product_data: { name: productName, metadata: { plan_code: isCredit ? 'CREDIT' : plan.code } },
          ...(isCredit ? {} : { recurring: { interval: plan.interval === 'year' ? 'year' : 'month' } })
        }
      }]
    };
    if (email) params.customer_email = email;
    if (!isCredit) params.subscription_data = { metadata: { plan_code: plan.code, user_id: userId } };

    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formEncode(params).join('&')
    });
    const out = await r.json().catch(() => ({}));
    if (!r.ok || !out.url) {
      console.error('[billing] création session Stripe refusée :', out?.error?.message || r.status);
      return res.status(502).json({ error: 'payment_provider_error' });
    }
    return res.json({ ok: true, url: out.url });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
});

// ── Vérification de signature Stripe (V88) ───────────────────────────────────
// En V87, l'absence d'en-tête « stripe-signature » faisait sauter la vérification :
// n'importe qui pouvait simuler un paiement. Désormais, dès qu'un secret est
// configuré, la signature est obligatoire et datée (tolérance 5 min).
function verifyStripeSignature(rawBody, header, secret) {
  if (!header) return false;
  const items = String(header).split(',').map((p) => p.trim().split('='));
  const ts = items.find(([k]) => k === 't')?.[1];
  const signatures = items.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!ts || !signatures.length) return false;
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(ts));
  if (!Number.isFinite(age) || age > SIGNATURE_TOLERANCE_SECONDS) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');
  const exp = Buffer.from(expected, 'hex');
  return signatures.some((sig) => {
    const got = Buffer.from(String(sig || ''), 'hex');
    return got.length === exp.length && crypto.timingSafeEqual(got, exp);
  });
}

function limitText(limit) {
  return isUnlimited(limit) ? 'des Conseils Expert illimités' : `${limit} Conseils Expert par mois`;
}

// Retrouve l'utilisateur : d'abord par l'identifiant transmis par la page
// Tarifs (client_reference_id), sinon par l'e-mail du paiement.
async function findUserForSession(client, session) {
  const { userId } = parseClientReference(session.client_reference_id || session.metadata?.client_reference_id);
  if (userId) {
    const r = await client.query('select id, email from users where id=$1 limit 1', [userId]);
    if (r.rowCount) return r.rows[0];
  }
  const email = String(session.customer_email || session.customer_details?.email || '').trim().toLowerCase();
  if (email) {
    const r = await client.query('select id, email from users where lower(email)=$1 limit 1', [email]);
    if (r.rowCount) return r.rows[0];
  }
  return null;
}

async function handleCheckoutCompleted(session) {
  const purchase = resolvePurchase(session);
  if (!purchase) {
    console.warn('[stripe] achat non reconnu', session.id, session.amount_total, session.client_reference_id);
    return;
  }
  const base = resolveFrontendBaseUrl();
  let mail = null;

  await withClient(async (client) => {
    const user = await findUserForSession(client, session);
    if (!user) {
      console.warn('[stripe] utilisateur introuvable pour la session', session.id);
      return;
    }
    const stripeCustomerId = session.customer || null;

    if (purchase.kind === 'credit') {
      // Conseil Expert à l'unité : on ajoute un crédit, sans toucher à l'abonnement
      await client.query(
        `update wallets set
                tickets_expert = (case when credits_expire_at is not null and credits_expire_at < now() then 0
                                       when coalesce(tickets_expert,0) >= 1000 then 0
                                       else coalesce(tickets_expert,0) end) + $2,
                credits_expire_at = now() + interval '1 month',
                stripe_customer_id = coalesce($3, stripe_customer_id), updated_at = now()
          where user_id = $1`,
        [user.id, purchase.quantity, stripeCustomerId]
      );
      await client.query(
        `insert into notifications(user_id, kind, title, body, link) values($1,'credit_added','Conseil Expert ajouté',$2,'/dashboard.html')`,
        [user.id, `${purchase.quantity} Conseil${purchase.quantity > 1 ? 's' : ''} Expert ${purchase.quantity > 1 ? 'ont été ajoutés' : 'a été ajouté'} à votre compte, utilisables pendant un mois.`]
      );
      console.log(`[stripe] +${purchase.quantity} crédit(s) pour ${user.email}`);
      mail = {
        to: user.email,
        subject: 'POPE Online — Vos Conseils Expert supplémentaires sont disponibles',
        text: `Bonjour,\n\nVotre achat est confirmé : ${purchase.quantity} Conseil${purchase.quantity > 1 ? 's' : ''} Expert ${purchase.quantity > 1 ? 'ont été ajoutés' : 'a été ajouté'} à votre compte. Ils sont utilisables pendant un mois.\n\nPoser votre question : ${base}/dashboard.html\n\nL'équipe POPE Online\ncontact@pope-online.com — 09 70 70 30 55`
      };
      return;
    }

    const plan = purchase.plan;
    await client.query(
      `insert into wallets(user_id, plan_code, plan_label, status, ai_unlimited, expert_limit, expert_used, tickets_ai, tickets_expert, stripe_customer_id)
       values($1,$2,$3,'active',true,$4,0,9999,0,$5)
       on conflict(user_id) do update set
         plan_code    = excluded.plan_code,
         plan_label   = excluded.plan_label,
         status       = 'active',
         ai_unlimited = true,
         expert_limit = excluded.expert_limit,
         expert_used  = 0,
         tickets_ai   = 9999,
         stripe_customer_id = coalesce(excluded.stripe_customer_id, wallets.stripe_customer_id),
         updated_at   = now()`,
      [user.id, plan.code, plan.label, plan.expertLimit, stripeCustomerId]
    );
    try {
      await client.query(
        `update wallets set plan_start = now(), quota_period_start = now(),
                renews_at = now() + ($2)::interval
          where user_id = $1`,
        [user.id, plan.interval === 'year' ? '1 year' : '1 month']
      );
    } catch (e) { console.warn('[stripe] colonnes de dates absentes :', e.message); }

    await client.query(
      `insert into notifications(user_id, kind, title, body, link) values($1,'plan_upgraded','Abonnement activé',$2,'/dashboard.html')`,
      [user.id, `Votre offre ${plan.label} est active. Vous disposez de ${limitText(plan.expertLimit)}.`]
    );
    console.log(`[stripe] offre ${plan.code} activée pour ${user.email}`);
    mail = {
      to: user.email,
      subject: `POPE Online — Votre offre ${plan.label} est active`,
      text: `Bonjour,\n\nVotre offre POPE Online ${plan.label} est active.\n\nVous disposez de ${limitText(plan.expertLimit)}, avec une réponse d'expert sous ${RESPONSE_DELAY_LABEL}, ainsi que du clausier, du dépôt sécurisé et de l'outil de rédaction.\n\nAccéder à votre espace : ${base}/dashboard.html\n\nMerci de votre confiance.\nL'équipe POPE Online\ncontact@pope-online.com — 09 70 70 30 55`
    };
  });

  if (mail) {
    try { await sendMail(mail); } catch (e) { console.error('[stripe] e-mail non envoyé :', e.message); }
  }
}

async function handleInvoicePaid(invoice) {
  const custId = String(invoice.customer || '').trim();
  if (!custId || invoice.billing_reason !== 'subscription_cycle') return;
  await withClient(async (client) => {
    const userRes = await client.query('select user_id from wallets where stripe_customer_id=$1 limit 1', [custId]);
    if (!userRes.rowCount) { console.warn('[stripe invoice.paid] client introuvable :', custId); return; }
    const userId = userRes.rows[0].user_id;
    const plan = resolvePlanFromInvoiceLines(invoice.lines?.data || []);
    const periodEnd = invoice.period_end ? new Date(Number(invoice.period_end) * 1000) : null;

    if (plan) {
      await client.query(
        `update wallets set expert_used = 0, expert_limit = $2, plan_code = $3, plan_label = $4,
                status = 'active', updated_at = now() where user_id = $1`,
        [userId, plan.expertLimit, plan.code, plan.label]
      );
    } else {
      await client.query(`update wallets set expert_used = 0, status = 'active', updated_at = now() where user_id = $1`, [userId]);
    }
    try {
      await client.query(
        `update wallets set quota_period_start = now(), renews_at = coalesce($2, renews_at) where user_id = $1`,
        [userId, periodEnd]
      );
    } catch (_) {}

    const w = await client.query('select expert_limit from wallets where user_id=$1', [userId]);
    await client.query(
      `insert into notifications(user_id, kind, title, body, link) values($1,'plan_renewed','Abonnement renouvelé',$2,'/dashboard.html')`,
      [userId, `Votre abonnement a été renouvelé. Vous disposez à nouveau de ${limitText(w.rows[0]?.expert_limit ?? 0)}.`]
    );
    console.log(`[stripe] renouvellement traité pour ${custId}`);
  });
}

async function handleSubscriptionDeleted(sub) {
  const custId = String(sub.customer || '').trim();
  if (!custId) return;
  const base = resolveFrontendBaseUrl();
  let email = null;
  await withClient(async (client) => {
    const userRes = await client.query('select user_id from wallets where stripe_customer_id=$1 limit 1', [custId]);
    if (!userRes.rowCount) { console.warn('[stripe subscription.deleted] client introuvable :', custId); return; }
    const userId = userRes.rows[0].user_id;
    // Plus d'offre gratuite permanente en V88 : le compte reste consultable,
    // les nouveaux Conseils Expert nécessitent une nouvelle souscription.
    await client.query(
      `update wallets set plan_code = 'FREE', plan_label = 'Découverte', status = 'cancelled',
              expert_limit = 0, expert_used = 0, ai_unlimited = false, tickets_ai = 0,
              updated_at = now() where user_id = $1`,
      [userId]
    );
    await client.query(
      `insert into notifications(user_id, kind, title, body, link) values($1,'plan_cancelled','Abonnement résilié',$2,'/pricing.html')`,
      [userId, 'Votre abonnement a été résilié. Votre compte et vos échanges restent consultables. Vous pouvez vous réabonner à tout moment.']
    );
    const e = await client.query('select email from users where id=$1 limit 1', [userId]);
    email = e.rows[0]?.email || null;
  });
  if (email) {
    try {
      await sendMail({
        to: email,
        subject: 'POPE Online — Votre abonnement a été résilié',
        text: `Bonjour,\n\nVotre abonnement POPE Online a bien été résilié.\n\nVotre compte, vos échanges et vos documents restent consultables. Pour solliciter à nouveau un expert, il suffit de vous réabonner : ${base}/pricing.html\n\nL'équipe POPE Online`
      });
    } catch (err) { console.error('[stripe] e-mail de résiliation non envoyé :', err.message); }
  }
}

// ── POST /billing/webhook — Stripe ───────────────────────────────────────────
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const secret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  const isProd = String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body || {});

  if (secret) {
    if (!verifyStripeSignature(rawBody, req.headers['stripe-signature'], secret)) {
      console.warn('[stripe] signature invalide ou absente — événement refusé');
      return res.status(400).json({ error: 'invalid_signature' });
    }
  } else if (isProd) {
    console.error('[stripe] STRIPE_WEBHOOK_SECRET manquant — webhook refusé');
    return res.status(500).json({ error: 'webhook_not_configured' });
  } else {
    console.warn('[stripe] STRIPE_WEBHOOK_SECRET absent : signature non vérifiée (hors production uniquement)');
  }

  let event;
  try { event = JSON.parse(rawBody); }
  catch { return res.status(400).json({ error: 'parse_error' }); }

  // Idempotence : un événement déjà traité n'est pas rejoué
  try {
    const ins = await withClient((client) => client.query(
      'insert into stripe_events(id, type, payload) values($1,$2,$3::jsonb) on conflict do nothing returning id',
      [event.id, event.type, rawBody]
    ));
    if (ins && ins.rowCount === 0) return res.json({ received: true, duplicate: true });
  } catch (e) {
    console.warn('[stripe] journalisation impossible :', e.message);
  }

  try {
    if (event.type === 'checkout.session.completed') await handleCheckoutCompleted(event.data.object);
    else if (event.type === 'invoice.paid') await handleInvoicePaid(event.data.object);
    else if (event.type === 'customer.subscription.deleted') await handleSubscriptionDeleted(event.data.object);
  } catch (e) {
    console.error(`[stripe] erreur de traitement ${event.type} :`, e.message);
    // On libère l'événement pour que Stripe le renvoie automatiquement
    try { await withClient((client) => client.query('delete from stripe_events where id=$1', [event.id])); } catch (_) {}
    return res.status(500).json({ error: 'processing_failed' });
  }

  res.json({ received: true });
});

// ── GET /billing/invoices — historique des paiements Stripe ─────────────────
router.get('/invoices', requireAuth, async (req, res) => {
  const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_SECRET) return res.json({ invoices: [] });

  try {
    const userId = req.user.sub;

    // Récupérer le stripe_customer_id depuis le wallet
    const walletRes = await withClient(async (client) => {
      return client.query(
        `select stripe_customer_id from wallets where user_id=$1 limit 1`,
        [userId]
      );
    });

    const customerId = walletRes.rows[0]?.stripe_customer_id;
    if (!customerId) return res.json({ invoices: [] });

    // Appel API Stripe pour lister les invoices
    const stripeRes = await fetch(
      `https://api.stripe.com/v1/invoices?customer=${encodeURIComponent(customerId)}&limit=24&status=paid`,
      {
        headers: {
          Authorization: `Bearer ${STRIPE_SECRET}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    if (!stripeRes.ok) {
      console.error('[billing/invoices] Stripe error', stripeRes.status);
      return res.json({ invoices: [] });
    }
    const stripeData = await stripeRes.json();
    const invoices = (stripeData.data || []).map(inv => ({
      id: inv.id,
      number: inv.number,
      amount_paid: inv.amount_paid,
      currency: inv.currency,
      status: inv.status,
      created: inv.created,
      period_start: inv.period_start,
      period_end: inv.period_end,
      invoice_pdf: inv.invoice_pdf,
      hosted_invoice_url: inv.hosted_invoice_url,
      description: inv.lines?.data?.[0]?.description || null
    }));

    return res.json({ invoices });
  } catch (e) {
    console.error('[billing/invoices] error:', e.message);
    return res.json({ invoices: [] });
  }
});

export default router;
