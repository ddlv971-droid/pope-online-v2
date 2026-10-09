# POPE Online V88_11 — notes de version

## À faire de votre côté (sinon le paiement reste indisponible)
- Render (API) : ajouter `STRIPE_SECRET_KEY` (sk_live_… en prod, sk_test_… en recette). Le bouton « Continuer vers le paiement » crée alors la session Stripe (Élu mensuel/annuel, pack de 3 Conseils Expert). Collectivité reste sur devis.
- Le webhook Stripe existant est inchangé (`STRIPE_WEBHOOK_SECRET`).
- Facultatif : `MISSION_MAIL_TO` / `MISSION_MAIL_CC` (défauts : contact@pope-online.com / contact@popeconsulting-group.com).
- Le patch base `schema_patch_v92.sql` s'applique seul au démarrage de l'API.

## Modifications
1. Souscrire l'offre Élu → paiement Stripe (POST /billing/checkout) ; reconnexion automatique si session expirée.
2. Header : « Exemples de questions » supprimé ; « Qui sommes-nous » après « Pour qui ? » ; footer réordonné.
3. Textes : « Budget, ressources humaines, marchés publics, urbanisme… » ; « personnel communal » → « personnel » ; « Alimentent directement l'outil de rédaction ».
4. CGU : offre d'essai réécrite (15 jours, 2 Conseils Expert, réponse sous 24 h ouvrées, sans IA).
5. Demande expert : texte intégral, domaine, contexte, premier jet et pièces jointes conservés avec la demande et affichés dans le dashboard admin (téléchargement authentifié) ; visibles aussi du client et de l'expert assigné ; l'e-mail à contact@pope-online.com part avec les pièces, un échec d'envoi n'annule plus la demande.
6. Dépôt sécurisé : PDF, Word, Excel, PowerPoint, ODF, RTF, TXT, CSV, images, ZIP (10 Mo) ; messages d'erreur précis ; zone d'ajout de fichiers dans l'étape 3 du dashboard (auto-sélection).
7. Sur mesure : formulaire de qualification complet → contact@pope-online.com, copie contact@popeconsulting-group.com, accusé au demandeur, sans consommer de quota.
8. Tutoriel : vidéo motion design animée avec avatars (6 scènes, intégrée) ; deux blocs (Qualification + Conseil Expert fusionnés / Sur mesure), sans IA.

## Points d'attention
- CGV : délai « 48 heures ouvrées » à aligner sur 24 h.
- CGU § « Contenus générés par l'IA » conservé (information légale) : à vous de valider.
- Les copies de pièces jointes de demandes expert sont conservées (hors purge 48 h) : à mentionner dans la politique de confidentialité.

---
# V88_12
- Header : « Pour qui ? · Qui sommes-nous ? · Tarifs · Connexion · Tester gratuitement » à gauche près du logo ; à droite « Rechercher » (fenêtre de recherche dans le site) et icône Contact (rappel / écrire). « Qui sommes-nous ? » avec « ? » en header et footer.
- Dashboard expert (et admin) : pièce jointe facultative (10 Mo, formats courants) en plus du texte de réponse ; envoyée aussi par e-mail au client lors d'une réponse admin.
- Espace client : onglet « Mes Conseils Expert » dans le profil (profile.html?sec=conseils) avec téléchargement de la pièce jointe de l'expert ; également visible dans la page Conseil Expert.
