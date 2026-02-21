# POPE Online — V2 (SaaS structuré + PostgreSQL)

Cette V2 ajoute :
- Inscription / connexion (JWT)
- Vérification email
- Wallet tickets (AI + Expert)
- 3 tickets gratuits attribués après vérification email (anti-abus "soft fingerprint")
- Envoi automatique des demandes Expert/Mission à `contact@popeconsulting-group.com` + confirmation UI

## 1) Déploiement Backend (Render)

### A. Créer la DB Postgres
- Render → New → PostgreSQL
- Copie `DATABASE_URL`

### B. Créer le service API
- Render → New → Web Service
- Root directory: `backend`
- Build command: `npm install`
- Start command: `npm start`

### C. Variables d'environnement (Render)
Copie `.env.example` et renseigne :
- `DATABASE_URL`
- `JWT_SECRET`
- `CORS_ORIGIN` (ton domaine Netlify)
- `FRONTEND_BASE_URL` (ton domaine Netlify)
- `MISTRAL_API_KEY`
- `MAIL_PROVIDER` / `MAIL_API_KEY` / `MAIL_FROM` / `MAIL_TO`

### D. Initialiser le schéma SQL
Option 1 (recommandée) :
- En local : `cd backend && npm install && npm run db:init`
  (en ayant `DATABASE_URL` dans ton environnement)

Option 2 :
- Exécuter le contenu de `backend/db/schema.sql` dans un client SQL (pgAdmin, DBeaver, etc.)

## 2) Déploiement Frontend (Netlify)

- Netlify → Add new site → Deploy manually
- Choisir le dossier `frontend/` comme publish directory
- (ou connecter le repo Git)

### Config front
Dans `frontend/api.js`, remplace :
- `https://pope-online-v2.onrender.com` par l’URL de ton service Render.

## 3) Parcours utilisateur
1) `signup.html` → création compte → email de vérification
2) `verify.html?token=...` → vérification → attribution 3 tickets gratuits (si éligible)
3) `login.html` → connexion → `dashboard.html`
4) `app.html` → consomme 1 ticket AI par génération
5) `expert.html` / `mission.html` → envoi direct mail + flash message

## 4) Anti-abus (MVP)
- Empreinte soft côté front (WebCrypto SHA-256)
- IP hash + user-agent hash côté back
- Attribution du free trial bloquée si empreinte déjà utilisée

> Ajustable ensuite (FingerprintJS, règles B2B par domaine, etc.)
