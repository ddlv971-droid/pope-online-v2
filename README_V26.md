# POPE Online — V26 — Fix définitif création de compte

## ⚡ Déploiement

```bash
unzip popeonline_v26.zip
cp -r popeonline_v26_deploy/frontend/. monrepo/frontend/
cp -r popeonline_v26_deploy/backend/.  monrepo/backend/
git add -A && git commit -m "fix: V26 - signup atomique definitif, sendMail hors transaction"
git push origin staging
```

---

## 🔴 Variable d'environnement obligatoire sur Render

`MAIL_API_KEY` et `MAIL_FROM` sont désormais **requises au démarrage**.
Si elles manquent, le serveur refuse de démarrer avec un message clair en log.

Vérifier dans Render → Environment :
- `MAIL_PROVIDER` = `resend` (ou `sendgrid`)
- `MAIL_API_KEY` = votre clé Resend/SendGrid
- `MAIL_FROM` = `contact@pope-online.com`

---

## 🔍 Cause racine définitive du bug signup

### Le pattern fautif (VPROD + toutes les versions jusqu'à V25)

```
withClient(async (client) => {
  begin
  INSERT user     ← commit si OK
  INSERT wallet
  INSERT devices
  INSERT email_verifications
  commit          ← COMMIT réussi
  await sendMail(...)  ← Si MAIL_API_KEY absent ou timeout → THROW
                        ← withClient.catch → rollback (inutile, trop tard)
                        ← rethrow → catch externe → res.status(500)
  res.json(ok)    ← jamais atteint
})
```

**Résultat** : compte créé en base, réponse 500 → utilisateur réessaie → `email_exists`.

### Pourquoi VPROD fonctionnait

VPROD fonctionnait parce que `MAIL_API_KEY` et `MAIL_FROM` étaient correctement
configurées sur l'instance Render de production. Le bug se déclenchait uniquement
quand ces variables manquaient (staging, test) ou quand Resend retournait une erreur
(rate limit, timeout).

### La correction V26

```
// PHASE 1 — DB uniquement, dans withClient
withClient(async (client) => {
  begin → tous les INSERT → commit
  verifyToken = token  // stocké hors withClient
})
// PHASE 1 termine proprement, withClient fermé

// PHASE 2 — Mail, hors withClient, avec son propre try/catch
try {
  await sendMail(...)
  return res.json({ ok: true })        // mail OK → 200 normal
} catch (mailErr) {
  return res.json({ ok: true, mailFailed: true })  // mail KO → 200 avec warning
  // Jamais de 500 ici. Jamais de compte fantôme.
}
```

---

## ✅ Fichiers modifiés en V26 (par rapport à V25)

| Fichier | Modification |
|---|---|
| `backend/routes/auth.js` | **Signup refactorisé** : sendMail strictement hors withClient |
| `backend/server.js` | `MAIL_API_KEY` + `MAIL_FROM` ajoutés à `requiredEnv` (fail-fast) |

Tous les autres fichiers sont identiques à V25.

---

## ✅ Checklist de validation

- [ ] Render redémarre → logs : `✅ DB schema applied`, `✅ DB patch v22`, `✅ DB patch v24`
- [ ] Si `MAIL_API_KEY` manque → Render refuse de démarrer (log clair) ✓
- [ ] Créer un compte → **mail reçu** → **pas d'erreur 500** ✓
- [ ] 2ème tentative avec même email → `"Un compte existe déjà"` (409) ✓
- [ ] Vérifier email → tickets_expert = tickets_ai dans le dashboard admin ✓
- [ ] `ddlv971@gmail.com` → accès dashboard admin ✓
