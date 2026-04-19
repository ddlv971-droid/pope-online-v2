# POPE Online Beta - version full compatible staging

## Ce qui a été ajouté
- Frontend converti en projet Vite prêt pour un environnement staging.
- Support clair de `VITE_API_URL` via `.env` côté frontend.
- `frontend/netlify.toml` mis à jour pour builder avec Vite et publier `frontend/dist`.
- Exemples d'environnements séparés pour le frontend et le backend.
- Scripts racine pour lancer le frontend et le backend plus simplement.
- Nettoyage du ZIP: suppression de `.git` et de `backend/node_modules` pour un livrable plus propre.

## Arborescence utile
- `frontend/` : site Vite multi-pages
- `backend/` : API Express
- `frontend/.env.staging.example` : exemple pour la Netlify staging
- `backend/.env.staging.example` : exemple pour le backend staging Render

## Mise en place locale
### Backend
1. Copier `backend/.env.example` ou `backend/.env.staging.example` vers `backend/.env`
2. Installer: `npm --prefix backend install`
3. Lancer: `npm --prefix backend run dev`

### Frontend Vite
1. Copier `frontend/.env.development.example` vers `frontend/.env`
2. Installer: `npm --prefix frontend install`
3. Lancer: `npm --prefix frontend run dev`
4. Le frontend lira `VITE_API_URL`

## Déploiement staging conseillé
### Frontend Netlify staging
- Base directory: `frontend`
- Build command: `npm install && npm run build`
- Publish directory: `dist`
- Variable d'environnement: `VITE_API_URL=https://VOTRE-BACKEND-STAGING.onrender.com`

### Backend Render staging
- Root directory: `backend`
- Start command: `npm start`
- Variables: reprendre `backend/.env.staging.example`
- `CORS_ORIGIN` doit contenir l'URL Netlify staging
- `FRONTEND_BASE_URL` doit pointer vers le frontend staging

## Déploiement production ensuite
- `frontend/.env.production.example`
- `backend/.env.production.example`
- Remplacer les URL staging par les URL production

## Point important
Le code frontend utilisait déjà une lecture de `VITE_API_URL` dans `frontend/api.js`. Cette version le formalise en vraie structure Vite pour que ton staging soit propre, reproductible et simple à maintenir.
