/* ==========================================================================
   POPE Online V88 — Configuration centrale du site (copiée telle quelle dans dist/)
   Un seul endroit pour les réglages commerciaux affichés sur le site.
   ========================================================================== */
(function () {
  var host = String(window.location.hostname || '').toLowerCase();
  // Production = domaine officiel, avec ou sans www (corrige la détection V87)
  var isProd = host === 'pope-online.com' || host === 'www.pope-online.com';

  window.POPE_SITE = {
    version: 'V88',
    isProd: isProd,

    // Espace privé (artisans, TPE) : en veille. Passer à true pour le réactiver
    // (à faire aussi côté API : variable PRIVATE_SPACE_ENABLED=true sur Render).
    privateSpaceEnabled: false,

    // Délai de réponse affiché partout
    responseDelay: '24 h',

    phone: { display: '09 70 70 30 55', href: 'tel:+33970703055' },
    email: 'contact@pope-online.com',

    // Grille tarifaire (HT). Remise annuelle : 15 %.
    annualDiscount: 0.15,
    plans: {
      elu:          { monthly: 49,  label: 'Élu',          expert: 10 },
      collectivite: { monthly: 499, label: 'Collectivité', expert: 'illimités' }
    },
    creditPrice: 25,

    // Liens de paiement Stripe — À CRÉER dans Stripe (voir README_V88.md).
    // Tant qu'un lien est vide, le bouton propose un contact par e-mail.
    stripe: {
      live: {
        elu_m: '',
        elu_a: '',
        collectivite_m: '',
        collectivite_a: '',
        credit: 'https://buy.stripe.com/5kQ9AN1veeIIgbo2wbb7y04'
      },
      test: {
        elu_m: '',
        elu_a: '',
        collectivite_m: '',
        collectivite_a: '',
        credit: 'https://buy.stripe.com/test_5kQ9AN1veeIIgbo2wbb7y04'
      }
    }
  };
})();
