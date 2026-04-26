# POPE Online — V28

## Corrections

### 1. verify.html — Page de bienvenue professionnelle
Après validation de l'email, l'utilisateur voit une page élégante avec :
- Confirmation animée (✓ avec animation)
- Titre de bienvenue personnalisé selon l'espace (public/privé)
- Rappel du nombre de tickets disponibles
- Grille des 4 fonctionnalités clés
- CTA principal "Commencer mon expérience POPE Online →" vers le dashboard
- CTA secondaire vers l'espace
- Gestion des erreurs (token invalide, expiré, déjà utilisé)
- Plus aucune redirection automatique ni fenêtre de connexion intermédiaire

### 2. Tickets : 10 → 5
- Backend `resolveFreeTrialEntitlements` : `ticketsAi: 5`
- Tous les textes frontend mis à jour (signup, offre-gratuite, trial-start, tutoriel, dashboard)

### 3. Texte offre gratuite
- "1 dossier gratuit" → "5 tickets de relecture experte" partout
- signup-public, signup-private, offre-gratuite, trial-start-public, trial-start-private

### 4. Responsive — débordement section mission/public
- `&nbsp;` retiré des titres `h1` dans `public.html`
- `overflow-wrap:break-word` + `min-width:0` ajoutés sur `po-grid-cards` et ses enfants

### 5. tickets_expert en admin
- Si le champ "Relecture experte" est vide ou 0 → synchronisé automatiquement avec Tickets IA
- Hint clarifié : "Laisser vide ou 0 = synchronisé automatiquement avec Tickets IA"

## Déploiement
```bash
cp -r popeonline_v28_deploy/frontend/. monrepo/frontend/
cp -r popeonline_v28_deploy/backend/.  monrepo/backend/
git add -A && git commit -m "feat: V28 - verify bienvenue, 5 tickets, offre corrigée, responsive"
git push origin main
```
