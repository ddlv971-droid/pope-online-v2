# POPE Online — V5.2 full clean

## Correctifs intégrés

- Correction robuste de l'enregistrement des fiches client en base de données.
- Création/patch SQL : `backend/db/schema_patch_v52_full_clean.sql`.
- Préremplissage de la fiche admin à partir des données du compte client : nom, organisation, email, téléphone, espace.
- Séparation email / téléphone dans la fiche client côté admin.
- Ajout d'une assignation expert directement depuis la fiche client.
- L'expert assigné voit les requêtes et le portefeuille client via les routes existantes `/expert/my-assigned-requests`.
- Parcours dashboard public/privé reconstruit : la soumission du besoin se fait directement depuis l'étape 4, sans redirection doublon vers `expert.html` ou `expert-private.html`.
- Récapitulatif professionnel avec référence de demande, statut de traitement et compteur de demandes restantes.
- Décompte corrigé selon l'espace public/privé.
- Étape “Décrivez votre besoin” enrichie : échéance, urgence, livrable attendu, sensibilité, public concerné, décision attendue, bulles d'aide.
- Wording `private.html`, `public.html` et `tutoriel.html` recentré sur le besoin utilisateur et l'expertise humaine.

## À exécuter sur la base PostgreSQL staging/prod

```sql
\i backend/db/schema_patch_v52_full_clean.sql
```

## Tests locaux réalisés

- Vérification syntaxique Node OK : `server.js`, `routes/client_fiche.js`, `routes/expert.js`, `frontend/dashboard-v5.js`, `frontend/admin-v52.js`.
- Build frontend non exécuté localement : `vite` n'est pas installé dans l'environnement local extrait. Netlify fera l'installation via `npm install` lors du déploiement.

## Point important

Le ZIP exclut les dossiers `node_modules`. C'est volontaire et plus propre pour GitHub/Netlify/Render.
