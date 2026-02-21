import express from 'express';

const router = express.Router();

router.get('/plans', (_req, res) => {
  res.json({
    pope_ai: {
      trial: { tickets_free: 3 },
      plans: [
        { id: 'ai_50', name: '50 tickets / an', price_eur_ht: 1000, tickets_ai: 50 },
        { id: 'ai_100', name: '100 tickets / an', price_eur_ht: 1800, tickets_ai: 100 },
        { id: 'ai_300', name: '300 tickets / an', price_eur_ht: 3600, tickets_ai: 300 },
        { id: 'ai_unlimited', name: 'Illimité / an', price_eur_ht: 4800, tickets_ai: 999999 }
      ]
    },
    pope_expert: {
      unit: { id: 'expert_1', name: '1 ticket expert', price_eur_ht: 80, tickets_expert: 1 },
      bundles: [
        { id: 'bundle_50_10', name: '50 AI + 10 Expert', price_eur_ht: 1500, tickets_ai: 50, tickets_expert: 10 },
        { id: 'bundle_100_20', name: '100 AI + 20 Expert', price_eur_ht: 2750, tickets_ai: 100, tickets_expert: 20 },
        { id: 'bundle_300_60', name: '300 AI + 60 Expert', price_eur_ht: 5200, tickets_ai: 300, tickets_expert: 60 },
        { id: 'bundle_full', name: 'Full illimité', price_eur_ht: 8500, tickets_ai: 999999, tickets_expert: 999999 }
      ]
    },
    mission: {
      id: 'mission_custom',
      name: 'Mission / accompagnement',
      pricing: 'sur devis'
    }
  });
});

export default router;
