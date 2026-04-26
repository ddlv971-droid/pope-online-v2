# POPE Online — V22 — Patch sécurité, bugs & tutoriel

## ⚡ Déploiement rapide (staging puis prod)

### 1 · Extraire ce ZIP dans votre dossier de travail
```
unzip popeonline_v22.zip -d popeonline/
cd popeonline/
```
Structure attendue : `frontend/` + `backend/` + ce README.

---

### 2 · Base de données — migration V22 (OBLIGATOIRE EN PREMIER)

Le patch est **idempotent** (`IF NOT EXISTS` + `UPDATE` ciblé). Il s'applique automatiquement
au démarrage Render via `db_init.js`. Pour l'appliquer manuellement :

```sql
-- Via Render Shell, pgAdmin ou DBeaver
\i backend/db/schema_patch_v22.sql
```

**Effets** :
- Crée la table `deleted_accounts` (blocage réinscription free trial après auto-suppression)
- `UPDATE wallets SET tickets_expert = tickets_ai WHERE tickets_expert = 0 AND tickets_ai > 0`

---

### 3 · Backend — Render (staging)

```bash
# Variables d'environnement à définir sur Render staging
NODE_ENV=production
DATABASE_URL=postgresql://...
JWT_SECRET=<secret_fort_32_chars_min>
CORS_ORIGIN=https://VOTRE-STAGING.netlify.app
FRONTEND_BASE_URL=https://VOTRE-STAGING.netlify.app
MISTRAL_API_KEY=...
MAIL_PROVIDER=resend
MAIL_API_KEY=...
MAIL_FROM=contact@pope-online.com
MAIL_TO=contact@pope-online.com
SESSION_COOKIE_SAMESITE=None
TURNSTILE_SECRET_KEY=...
DEFAULT_ADMIN_USERNAME=...
DEFAULT_ADMIN_PASSWORD=...
DEFAULT_ADMIN_EMAIL=...
```

- Root directory : `backend`
- Build command : `npm install`
- Start command : `npm start`  ← lance db_init.js puis server.js

---

### 4 · Frontend — Netlify (staging)

```bash
# Variable d'environnement Netlify
VITE_API_URL=https://VOTRE-STAGING-BACKEND.onrender.com
```

- Base directory : `frontend`
- Build command : `npm install && npm run build`
- Publish directory : `dist`

---

### 5 · Checklist de validation staging

- [ ] GET `/health` sur Render → `{ ok: true }`
- [ ] Créer un compte test → email reçu → vérification → `tickets_expert = tickets_ai = 10` dans admin
- [ ] Auto-supprimer le compte (Mon compte > Supprimer)
- [ ] Recréer le même compte → wallet en `verified_no_trial` (0 tickets, pas de free trial) ✓
- [ ] Dashboard admin → mot de passe vide (plus `admin`) ✓
- [ ] Dashboard admin → champ "Tickets Relecture experte" visible ✓
- [ ] Dashboard admin → bouton "Réinitialiser intégralement" → double confirmation ✓
- [ ] Après reset admin → recréer le compte → 10 tickets attribués ✓
- [ ] Responsive admin sur mobile (560px) → boutons en 1 colonne ✓
- [ ] `pope-online.com/tutoriel.html` → avatar Léa animé, 5 étapes, navigation ✓
- [ ] Lien "▶ Tutoriel" visible dans la nav de l'accueil ✓

---

## 📋 Changements V22 — Détail

### 🔒 Sécurité

#### [CRITIQUE] Réinscription avec free trial après auto-suppression du compte
**Fichiers** : `backend/routes/auth.js`, `backend/db/schema_patch_v22.sql`

Avant : `DELETE /auth/me` supprimait uniquement l'entrée `users`. L'utilisateur pouvait
se réinscrire avec le même email ou navigateur et obtenir 10 nouveaux tickets gratuits.

Après : La suppression enregistre `email_hash (SHA-256) + fp_hash + ip_hash` dans
`deleted_accounts` (`deleted_by = 'self'`). À la réinscription, si l'email OU le
fingerprint est présent → wallet en `verified_no_trial` → 0 tickets.

Seul `DELETE /admin/users/:id?reset=true` efface cette empreinte.

#### [IMPORTANT] Mot de passe admin en clair dans le HTML
**Fichier** : `frontend/dashboard-admin.html`

`value="admin"` retiré du champ password de connexion admin.

#### [ADMIN] Suppression à deux niveaux distincts
**Fichier** : `backend/routes/admin.js`

- `DELETE /admin/users/:id` → suppression + conservation empreinte (pas de nouveau free trial)
- `DELETE /admin/users/:id?reset=true` → suppression + effacement empreinte (réinscription autorisée)

### 🐛 Bugs corrigés

#### tickets_expert toujours = 0 malgré tickets_ai = 10
**Fichiers** : `backend/routes/auth.js`, `backend/routes/admin.js`, `backend/db/schema_patch_v22.sql`

- Handler `verify` : `tickets_expert = tickets_ai` (était `tickets_expert = 0`)
- `POST /admin/users` : wallet avec `tickets_expert = tickets_ai`
- `PUT /admin/users/:id` : payload inclut `ticketsExpert` (défaut = valeur de `ticketsAi`)
- Migration SQL : `UPDATE wallets SET tickets_expert = tickets_ai WHERE tickets_expert = 0 AND tickets_ai > 0`

#### Dashboard admin — responsive cassé
**Fichier** : `frontend/app.css`

Grille 5 champs (nouveau : tickets_expert) et 6 boutons (nouveau : réinitialiser).
Breakpoints revus : 1440→3col / 1100→2col / 860→2col / 560→1col.

### 🎓 Nouveau : Tutoriel interactif
**Fichier** : `frontend/tutoriel.html`

Page standalone 100% autonome (CSS + JS vanilla, aucune dépendance externe) :
- Avatar "Léa" SVG animé : clignements, mouvement de tête, bouche qui parle (typewriter)
- 5 étapes pédagogiques avec maquettes d'écran interactives
- Navigation Précédent/Suivant, points de progression, chapitres rapides, raccourcis clavier
- CTA final → signup / pricing / login
- Entièrement responsive mobile/tablette/desktop

Accessible depuis :
- Navigation principale de `index.html` (lien "▶ Tutoriel")
- Footer de `index.html`

---

## 🚀 Passage en production

Reprendre exactement les étapes staging en remplaçant les URL staging par les URL prod.
Les variables critiques à changer :
```
CORS_ORIGIN=https://pope-online.com,https://www.pope-online.com
FRONTEND_BASE_URL=https://pope-online.com
VITE_API_URL=https://pope-online-api.onrender.com
```
