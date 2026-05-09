# POPE Online V62 — correctif critique dashboards

## Correctifs intégrés

- Ajout de `frontend/dashboard-v62.js`, moteur externe unique pour les dashboards public et privé.
- Exposition garantie de `window.goStep`, `window.selectDomain`, `window.forceStep`, `window.restoreDashboardStep`.
- Neutralisation automatique des anciens `onclick` critiques (`goStep`, `selectDomain`, `v58Toggle`) pour éviter les `ReferenceError`.
- Maintien du bandeau dynamique V61 fonctionnel.
- Restauration du domaine, de l'étape active, des champs de besoin et des drafts via `POPEV61State`.
- Rappel visuel du domaine aux étapes 2, 3 et 4.
- Rechargement de l'étape exacte via `?step=...` sans retour forcé à l'étape 1.
- Nettoyage des imports conflictuels dans `dashboard.html` et `dashboard-private.html` : retrait de `dashboard-v60.js` et `dashboard-v61.js` au profit de `dashboard-v62.js`.

## Tests à réaliser en staging

1. Dashboard public : sélectionner un domaine puis cliquer sur Continuer.
2. Dashboard privé : sélectionner un domaine puis cliquer sur Continuer.
3. Rafraîchir l'étape 2 : le domaine et les champs doivent rester visibles.
4. Aller vers app/app-private puis revenir : l'étape et le domaine doivent être restaurés.
5. Vérifier la console : plus d'erreur `goStep is not defined` ou `selectDomain is not defined`.

## Base de données

Aucun patch SQL nouveau n'est nécessaire pour ce correctif V62.
