# POPE Online — validation ouverture publique

## Corrections intégrées
- suppression complète de POPY
- suppression des artefacts `frontend/dist` et `backend/node_modules` du livrable
- neutralisation des valeurs admin par défaut
- suppression des fallbacks `dev-secret`
- validation stricte des variables critiques au démarrage backend
- préflight CORS préservé et rate limit compatible OPTIONS
- lockfile frontend réécrit pour npm officiel
- nettoyage du rendu HTML le plus exposé côté frontend

## Contrôle avant ouverture
1. Déployer le backend Render avec `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_BASE_URL`, `CORS_ORIGIN`, `MAIL_*`, `MISTRAL_API_KEY`.
2. Vérifier `/health` sur Render.
3. Déployer le frontend Netlify avec base `frontend`, publish `dist`, variable `VITE_API_URL`.
4. Créer un compte public test.
5. Vérifier la réception du mail et le lien de validation.
6. Vérifier la connexion, le dashboard, la génération, le compteur de tickets et la déconnexion.
7. Vérifier le parcours privé, le formulaire de contact et le mot de passe oublié.
8. Contrôler dans DevTools qu'aucun appel ne part vers un ancien domaine ou vers la production.
9. Vérifier l'absence d'accès admin sans rôle admin.
10. Après validation, ouvrir l'accès public.
