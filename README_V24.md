# POPE Online — V24 — Correctifs critiques signup + compte admin

## ⚡ Déploiement

```bash
unzip popeonline_v24.zip
cp -r popeonline_v24_deploy/frontend/. monrepo/frontend/
cp -r popeonline_v24_deploy/backend/.  monrepo/backend/
git add -A && git commit -m "fix: V24 - signup atomique, compte admin, mailFailed"
git push origin staging
```

---

## 🔴 Action manuelle IMMÉDIATE sur Render — Promouvoir le compte admin

**Avant de déployer**, exécuter dans Render Shell (ou pgAdmin) :

```sql
UPDATE users
   SET role = 'admin', is_email_verified = true, must_change_password = false
 WHERE email = 'ddlv971@gmail.com';

-- Vérifier :
SELECT email, role FROM users WHERE email = 'ddlv971@gmail.com';
```

**Ou** définir les variables d'environnement sur Render, ce qui le fera automatiquement au redémarrage :

```
DEFAULT_ADMIN_EMAIL=ddlv971@gmail.com
DEFAULT_ADMIN_USERNAME=Denis DELVER
DEFAULT_ADMIN_PASSWORD=<votre_mot_de_passe_actuel>
```

Le `db_init.js` V24 détecte que le compte existe déjà et **met à jour le rôle** au lieu de créer un doublon.

---

## 🐛 Bugs corrigés en V24

### [CRITIQUE] Bug signup — erreur 500 puis "email déjà existant"

**Cause racine identifiée** : `sendMail()` était appelée **après** `commit` mais **dans** le bloc `withClient`. Si Resend/SendGrid levait une exception (timeout, quota, erreur réseau), le `catch` global renvoyait un `500` — mais le compte **était déjà créé et committé** en base. Le second clic trouvait l'utilisateur existant → `email_exists`.

Ce bug pouvait se déclencher même sans migration manquante : il suffisait d'un échec momentané du service mail.

**Correction** (`backend/routes/auth.js`) :
- La transaction DB (`begin → commit`) est complètement **séparée** de l'envoi mail
- `sendMail()` est appelée **après** que `withClient` se soit terminé proprement
- Si le mail échoue : `{ ok: true, mailFailed: true }` → le compte est créé, l'utilisateur voit un message clair
- Si le mail réussit : comportement normal `{ ok: true }`
- `res.headersSent` est vérifié avant d'envoyer le mail pour éviter les double-réponses

**Correction** (`frontend/signup-public.html`, `frontend/signup-private.html`) :
- Gestion du flag `mailFailed` → message d'alerte clair avec adresse de contact

### [CRITIQUE] Compte admin ddlv971@gmail.com rétrogradé en client

**Cause** : `seedAdmin()` dans `db_init.js` faisait `return` immédiatement si le compte existait déjà, sans vérifier ni corriger le rôle. Le compte existait comme client → jamais promu.

**Correction** (`backend/scripts/db_init.js`) :
- Si le compte existe et `role !== 'admin'` → `UPDATE role='admin'`
- Si le compte n'existe pas → INSERT (comportement inchangé)

**Correction** (`backend/db/schema_patch_v24.sql`) :
- Patch SQL à appliquer manuellement (ou via Render Shell) pour la promotion immédiate sans attendre un redéploiement

---

## 📋 Fichiers modifiés en V24

| Fichier | Modification |
|---|---|
| `backend/routes/auth.js` | **Refactoring signup** : sendMail hors withClient, gestion mailFailed |
| `backend/scripts/db_init.js` | Fix seedAdmin : promouvoir si rôle = client |
| `backend/db/schema_patch_v24.sql` | **NOUVEAU** : promotion admin + V22 idempotent |
| `frontend/signup-public.html` | Gestion mailFailed avec message utilisateur |
| `frontend/signup-private.html` | Gestion mailFailed avec message utilisateur |
| `frontend/api.js` | Message `mail_send_warning` ajouté |
| `frontend/tutoriel.html` | Photo Léa (inchangé depuis V23) |
| `frontend/assets/lea-avatar.jpg` | Photo Léa (inchangé depuis V23) |

---

## ✅ Checklist de validation

- [ ] **Render Shell** : exécuter `schema_patch_v24.sql` ou définir `DEFAULT_ADMIN_*`
- [ ] Vérifier que `ddlv971@gmail.com` a `role = admin` en base
- [ ] Se connecter sur `dashboard-admin.html` avec ddlv971@gmail.com → accès OK ✓
- [ ] Créer un compte test → mail reçu → pas d'erreur 500 ✓
- [ ] Couper temporairement `MAIL_API_KEY` sur Render → recréer un compte → message `mailFailed` visible ✓ (remettre la clé après)
- [ ] Supprimer le compte test (self) → recréer → pas d'erreur, mail envoyé ✓
- [ ] Reset intégral admin → recréer → 10 tickets attribués ✓
