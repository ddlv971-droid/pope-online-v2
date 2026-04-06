
import express from 'express';

const router = express.Router();

router.get('/plans', (_req, res) => {
  res.json({
    architecture: {
      free: {
        id: 'FREE',
        duration_days: 15,
        public: { tickets_ai: 10, dossiers: 1 },
        private: { dossiers: 1, users: 1 }
      },
      public: {
        id: 'PUBLIC',
        pricing: 'sur mesure',
        description: 'Abonnement et offre adaptés au volume, aux usages IA et au niveau d’accompagnement.'
      },
      prive: {
        id: 'PRIVE',
        pricing: 'sur mesure',
        description: 'Offre privée calibrée selon la structure, le besoin et le niveau de délégation administrative.'
      }
    },
    restrictions: {
      after_expiration: "Votre période gratuite est terminée\nContactez-nous pour définir l'offre adaptée à votre besoin"
    }
  });
});

export default router;
