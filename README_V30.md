# POPE Online — V30

## Corrections

### dashboard-admin.html
- Fonctions JS parasites supprimées (étaient avant <!DOCTYPE> → affichées en texte brut)
- Doublon du champ "Offre" supprimé (gardé uniquement le sélecteur Plan complet)
- Badges plan + jours d'essai restants dans les cards utilisateurs

### pricing.html
- Phrase "L'IA est toujours disponible..." supprimée
- Switch mensuel/annuel corrigé : affiche le prix annuel total (499€/890€) et le mensuel équivalent
- FAQ corrigée : attachement via addEventListener (plus de conflit avec apostrophes inline)
- Modale paiement Stripe sécurisée (SSL, PCI DSS) avec récapitulatif de l'offre choisie
- ⚠️ Remplacez les liens STRIPE_LINKS dans pricing.html par vos vrais liens Stripe Payment Links

### tutoriel.html (interactif)
- Toutes les mentions de "tickets" supprimées
- STEPS réécrits : valorisation du réseau d'experts humains à chaque étape
- Mockup dashboard : "Illimitée" au lieu de compteur tickets
- Mockup relecture : "2 relectures expertes offertes"
- Steps vidéo : "production illimitée" et "validation humaine 48h"

## Action Stripe requise
1. Créer des Payment Links sur dashboard.stripe.com pour les 4 offres
2. Remplacer dans pricing.html les 4 URLs VOTRE_LIEN_* par les vrais liens
3. Configurer les webhooks Stripe pour mettre à jour les plans en DB

## Déploiement
```bash
git checkout staging
robocopy popeonline_v30_deploy\frontend frontend /E /IS /IT
robocopy popeonline_v30_deploy\backend backend /E /IS /IT
git add -A && git commit -m "feat: V30 - dashboard admin, pricing, FAQ, tutoriel, Stripe"
git push origin staging
```
