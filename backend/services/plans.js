// ============================================================================
// POPE Online V88 — Catalogue des offres (source unique côté API)
// Offres commercialisées : Découverte (essai), Élu, Collectivité, crédit à l'unité.
// Starter / Pro / Premium ne sont plus vendus mais restent reconnus pour
// d'éventuels abonnés historiques (aucune rupture de service).
// ============================================================================

export const UNLIMITED = 9999;           // valeur sentinelle « illimité »
export const ANNUAL_DISCOUNT = 0.15;     // remise annuelle affichée
export const RESPONSE_DELAY_LABEL = '24 h';
export const TRIAL_DAYS = 15;
export const TRIAL_EXPERT_LIMIT = 2;

const yearly = (monthly) => Math.round(monthly * 12 * (1 - ANNUAL_DISCOUNT) * 100) / 100;

export const PLANS = {
  FREE:           { code: 'FREE',           family: 'free',         label: 'Découverte',    paid: false, monthly: 0,   expertLimit: TRIAL_EXPERT_LIMIT },
  ELU_M:          { code: 'ELU_M',          family: 'elu',          label: 'Élu',           paid: true,  monthly: 49,  price: 49,           interval: 'month', expertLimit: 10 },
  ELU_A:          { code: 'ELU_A',          family: 'elu',          label: 'Élu',           paid: true,  monthly: 49,  price: yearly(49),   interval: 'year',  expertLimit: 10 },
  // V88.6 : offre Commune (moins de 10 000 hab.) — achat public, sur devis. Prix à valider.
  COMMUNE_M:      { code: 'COMMUNE_M',      family: 'commune',      label: 'Commune',       paid: true,  monthly: 149, price: 149,          interval: 'month', expertLimit: 10, seats: 3 },
  COMMUNE_A:      { code: 'COMMUNE_A',      family: 'commune',      label: 'Commune',       paid: true,  monthly: 149, price: yearly(149),  interval: 'year',  expertLimit: 10, seats: 3 },
  COLLECTIVITE_M: { code: 'COLLECTIVITE_M', family: 'collectivite', label: 'Collectivité',  paid: true,  monthly: 499, price: 499,          interval: 'month', expertLimit: UNLIMITED },
  COLLECTIVITE_A: { code: 'COLLECTIVITE_A', family: 'collectivite', label: 'Collectivité',  paid: true,  monthly: 499, price: yearly(499),  interval: 'year',  expertLimit: UNLIMITED },
  // Historique (non commercialisé)
  STARTER_M:      { code: 'STARTER_M',      family: 'starter',      label: 'Starter',       paid: true,  legacy: true, interval: 'month', expertLimit: 5 },
  STARTER_A:      { code: 'STARTER_A',      family: 'starter',      label: 'Starter',       paid: true,  legacy: true, interval: 'year',  expertLimit: 5 },
  PRO_M:          { code: 'PRO_M',          family: 'pro',          label: 'Pro',           paid: true,  legacy: true, interval: 'month', expertLimit: 12 },
  PRO_A:          { code: 'PRO_A',          family: 'pro',          label: 'Pro',           paid: true,  legacy: true, interval: 'year',  expertLimit: 12 },
  PREMIUM:        { code: 'PREMIUM',        family: 'premium',      label: 'Premium',       paid: true,  legacy: true, interval: 'year',  expertLimit: UNLIMITED },
  CUSTOM:         { code: 'CUSTOM',         family: 'custom',       label: 'Sur mesure',    paid: false, expertLimit: TRIAL_EXPERT_LIMIT },
};

export const CREDIT = { code: 'CREDIT', label: 'Conseil Expert à l\'unité', price: 25, quantity: 1 };

// Alias acceptés (admin, métadonnées Stripe, anciens codes sans suffixe)
const ALIASES = {
  ELU: 'ELU_M', COLLECTIVITE: 'COLLECTIVITE_M', COMMUNE: 'COMMUNE_M', STARTER: 'STARTER_M', PRO: 'PRO_M',
  ELU_MENSUEL: 'ELU_M', ELU_ANNUEL: 'ELU_A',
};

export function getPlan(code) {
  const c = String(code || '').trim().toUpperCase();
  return PLANS[c] || PLANS[ALIASES[c]] || null;
}

export function planFamily(code) {
  return getPlan(code)?.family || 'free';
}

export function isPaidPlan(code) {
  return Boolean(getPlan(code)?.paid);
}

export function planLabel(code) {
  return getPlan(code)?.label || 'Découverte';
}

export function isUnlimited(limit) {
  return Number(limit) >= UNLIMITED;
}

// Une offre annuelle (ou Collectivité) a besoin d'une remise à zéro mensuelle
// du quota indépendante de la facturation.
export function needsMonthlyReset(code) {
  const p = getPlan(code);
  return Boolean(p && p.paid && p.interval === 'year');
}

// ---------------------------------------------------------------------------
// Lecture de la référence transmise par la page Tarifs :
// client_reference_id = "<offre>--<userId>"  (ex. "elu_m--3f2a…")
// ---------------------------------------------------------------------------
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseClientReference(ref) {
  const raw = String(ref || '').trim();
  if (!raw) return { key: '', userId: null };
  const [key, userId] = raw.split('--');
  return {
    key: String(key || '').toLowerCase(),
    userId: userId && UUID_RE.test(userId) ? userId : null,
  };
}

// Détermine ce qui a été acheté lors d'un checkout Stripe.
// Retourne { kind: 'credit', quantity } ou { kind: 'plan', plan } ou null.
export function resolvePurchase(session = {}) {
  const meta = session.metadata || {};
  const { key } = parseClientReference(session.client_reference_id || meta.client_reference_id);
  const metaCode = String(meta.plan_code || '').toUpperCase();

  if (key === 'credit' || metaCode === 'CREDIT') {
    return { kind: 'credit', quantity: Number(meta.quantity || 1) || 1 };
  }
  const byKey = getPlan(key) || getPlan(metaCode);
  if (byKey) return { kind: 'plan', plan: byKey };

  // Repli sur le montant (centimes), en dernier recours
  const amount = Number(session.amount_total || 0);
  if (session.mode === 'payment' && amount > 0 && amount <= 2500 * 10) {
    return { kind: 'credit', quantity: Math.max(1, Math.round(amount / 2500)) };
  }
  const table = [
    [4900, 'ELU_M'], [49980, 'ELU_A'], [49900, 'COLLECTIVITE_M'], [508980, 'COLLECTIVITE_A'],
    [8900, 'STARTER_M'], [90800, 'STARTER_A'], [14900, 'PRO_M'], [152000, 'PRO_A'],
  ];
  const hit = table.find(([cents]) => cents === amount);
  if (hit) return { kind: 'plan', plan: PLANS[hit[1]] };
  return null;
}

// Plan déduit d'une facture de renouvellement (invoice.paid)
export function resolvePlanFromInvoiceLines(lines = []) {
  for (const line of lines) {
    const meta = line.metadata || line.price?.metadata || {};
    const byMeta = getPlan(meta.plan_code);
    if (byMeta) return byMeta;
    const desc = String(line.description || line.price?.nickname || line.plan?.nickname || '')
      .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const annual = line.price?.recurring?.interval === 'year' || /annuel|annual|year/.test(desc);
    if (desc.includes('collectivite')) return PLANS[annual ? 'COLLECTIVITE_A' : 'COLLECTIVITE_M'];
    if (/\belu\b/.test(desc)) return PLANS[annual ? 'ELU_A' : 'ELU_M'];
    if (desc.includes('starter')) return PLANS[annual ? 'STARTER_A' : 'STARTER_M'];
    if (desc.includes('pro')) return PLANS[annual ? 'PRO_A' : 'PRO_M'];
  }
  return null;
}

// Catalogue public (GET /billing/plans)
export function publicCatalogue() {
  const pick = (p) => ({ code: p.code, label: p.label, price: p.price, interval: p.interval,
    expert_limit: isUnlimited(p.expertLimit) ? 'unlimited' : p.expertLimit });
  return {
    currency: 'eur', taxes: 'HT', annual_discount: ANNUAL_DISCOUNT, response_delay: RESPONSE_DELAY_LABEL,
    trial: { days: TRIAL_DAYS, expert_limit: TRIAL_EXPERT_LIMIT },
    plans: ['ELU_M', 'ELU_A', 'COMMUNE_M', 'COMMUNE_A', 'COLLECTIVITE_M', 'COLLECTIVITE_A'].map((c) => pick(PLANS[c])),
    credit: { code: CREDIT.code, label: CREDIT.label, price: CREDIT.price },
  };
}
