# POPE Online — V61 Correctifs de stabilisation

## Correctifs intégrés

1. Retour depuis `app.html` / `app-private.html`
   - Le retour parcours est désormais forcé vers `step=2`.
   - Le dernier draft IA est mémorisé et sélectionnable, mais ne déclenche plus d'ouverture automatique de l'étape 3.

2. Navigation entre étapes
   - Nouveau correctif chargé en dernier : `frontend/dashboard-v61-fix.js`.
   - Il neutralise les régressions V58/V60 et réimpose une seule logique stable de navigation.
   - Les données saisies sont conservées dans les clés V61, V60 et V58 pour compatibilité descendante.

3. Étape 3 Documents
   - Restauration de l'affichage des drafts IA générés.
   - Restauration du dépôt sécurisé 48h.
   - Gestion du lien vers `vault.html` avec retour vers l'étape 3.
   - Sélection persistante du draft à joindre.

4. Étape 4 Transmission expert
   - Restauration du récapitulatif du besoin.
   - Ajout d'un résumé détaillé du contexte.
   - Affichage du draft IA sélectionné et du nombre de pièces détectées.
   - Conservation du bouton de transmission expert existant.

5. Bandeau utilisateur
   - Hydratation renforcée via `/auth/me`.
   - Fallback via `localStorage.pope_session_user`.
   - Affichage dynamique du prénom, du plan actif et du nombre de demandes expertes restantes.

6. Correction de structure fichiers
   - `dashboard-v60.js` et `app-v60-bridge.js` ont été dupliqués à la racine `frontend/` en plus de `frontend/public/` afin d'éviter les erreurs 404 selon le mode de déploiement.
   - Ajout de `dashboard-v61-fix.js` et `app-v61-bridge.js` à la racine et dans `frontend/public/`.

7. Correction syntaxique
   - Correction d'un bloc inline dans `app.html` et `app-private.html` contenant des doubles accolades `{{ }}` invalides en JavaScript.

## Fichiers principaux modifiés

- `frontend/dashboard.html`
- `frontend/dashboard-private.html`
- `frontend/app.html`
- `frontend/app-private.html`
- `frontend/dashboard-v61-fix.js`
- `frontend/app-v61-bridge.js`
- `frontend/dashboard-v60.js`
- `frontend/app-v60-bridge.js`
- `frontend/public/dashboard-v61-fix.js`
- `frontend/public/app-v61-bridge.js`

## Remarque build local

Le build local n'a pas pu être exécuté dans l'environnement d'analyse parce que les dépendances optionnelles natives de Rollup sont absentes du `node_modules` fourni dans le ZIP (`@rollup/rollup-linux-x64-gnu`). Sur Netlify/GitHub, un `npm install` propre doit restaurer cette dépendance automatiquement.
