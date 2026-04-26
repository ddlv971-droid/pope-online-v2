# POPE Online — V25 — Fix définitif signup + base VPROD intacte

## ⚡ Déploiement

```bash
unzip popeonline_v25.zip
cp -r popeonline_v25_deploy/frontend/. monrepo/frontend/
cp -r popeonline_v25_deploy/backend/.  monrepo/backend/
git add -A && git commit -m "fix: V25 - signup définitif, base VPROD, rollback auto"
git push origin staging
```

---

## 🔴 Action sur Render (si pas déjà fait en V24)

```sql
-- Dans Render Shell ou pgAdmin :
UPDATE users SET role='admin', is_email_verified=true
WHERE email='ddlv971@gmail.com';
```

Le `db_init.js` fait aussi cette promotion automatiquement au redémarrage.

---

## 🔍 Analyse des bugs précédents

### Pourquoi les V22/V23/V24 cassaient le signup

**VPROD** fonctionnait avec cette structure exacte :
```
withClient → begin → INSERT user → INSERT wallet → INSERT devices → 
INSERT email_verifications → commit → sendMail → return res.json(ok)
```

**V22/V23/V24** avaient restructuré le code en déplaçant `sendMail` hors de `withClient`
et en introduisant des variables intermédiaires (`verifyToken`, `createdEmail`).
Le problème : la restructuration avait aussi **changé les paramètres du wallet INSERT** :

```sql
-- VPROD (correct) :
values($1,'FREE','pending_verification', $2, 0, 0, 0, $3, $4, $5)
-- $2 = entitlements.ticketsAi (= 10)

-- V24 (cassé) :
values($1,'FREE', $2, 0, 0, 0, 0, $3, $4, $5)  
-- $2 = initialStatus (string 'pending_verification' dans le champ tickets_ai !)
-- → erreur de type PostgreSQL → exception → catch → 500
-- → compte créé (INSERT users déjà fait) mais wallet raté
```

Le compte était créé (INSERT users réussi), le wallet échouait silencieusement
→ erreur 500 pour l'utilisateur → 2ème tentative → `email_exists`.

### Stratégie V25 : patches chirurgicaux sur VPROD intact

Au lieu de restructurer le code, V25 **repart du VPROD qui fonctionnait** et applique
seulement les modifications minimales nécessaires, sans toucher à la structure du signup.

---

## ✅ Ce qui a changé par rapport au VPROD

| Fichier | Modification |
|---|---|
| `backend/db/index.js` | `withClient` : rollback automatique si exception après BEGIN |
| `backend/routes/auth.js` | `verify` : `tickets_expert=$2` (= `tickets_ai`) au lieu de `0` |
| `backend/routes/auth.js` | `signup` : vérif `deleted_accounts` résiliente avant INSERT wallet |
| `backend/routes/auth.js` | `DELETE /me` : enregistre l'empreinte dans `deleted_accounts` |
| `backend/routes/admin.js` | Suppression à deux niveaux (soft/full reset) |
| `backend/services/antiAbuse.js` | `hasPriorFreeTrialOnFingerprint` vérifie `admin_full` |
| `backend/scripts/db_init.js` | `seedAdmin` promeut si rôle client → admin |
| `backend/db/schema_patch_v22.sql` | Table `deleted_accounts` |
| `backend/db/schema_patch_v24.sql` | Promotion admin + V22 idempotent |
| `frontend/app.css` | Responsive admin, `.po-menu-tuto`, tickets_expert field |
| `frontend/dashboard-admin.html` | Champ tickets_expert, bouton reset intégral, password vide |
| `frontend/index.html` | Lien tutoriel dans nav + footer |
| `frontend/api.js` | Message `mail_send_warning` |
| `frontend/signup-public.html` | Gestion `mailFailed` |
| `frontend/signup-private.html` | Gestion `mailFailed` |
| `frontend/tutoriel.html` | Tutoriel interactif avec photo Léa |
| `frontend/assets/lea-avatar.jpg` | Photo Léa |

---

## ✅ Checklist de validation

- [ ] Render redémarre → DB init → `ddlv971@gmail.com` promu admin
- [ ] Connexion sur `dashboard-admin.html` → accès OK
- [ ] Créer un compte test → **mail reçu** → **pas d'erreur 500** ✓
- [ ] Vérifier email → `tickets_expert = tickets_ai` dans le dashboard admin ✓
- [ ] Supprimer compte (self) → recréer → mail envoyé → 0 tickets (no free trial) ✓
- [ ] Reset intégral admin → recréer → 10 tickets ✓
- [ ] Dashboard admin responsive sur mobile ✓
- [ ] Tutoriel accessible depuis l'accueil ✓
