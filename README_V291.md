# POPE Online — V29.1 — Compléments upgrade premium

## Ajouts par rapport à V29

### 1. Email automatique de fin de période d'essai
**Fichier** : `backend/server.js` + `backend/scripts/trial_expiry_mailer.js`

- Job intégré dans le serveur, lancé 30s après démarrage puis toutes les 6h
- Détecte les comptes `trial_active` dont `trial_expires_at < NOW()`
- Marque en `trial_expired` AVANT l'envoi (évite les doublons)
- Email HTML responsive avec les 3 plans (Starter/Pro/Premium) côte à côte
- Pause 300ms entre chaque envoi (respect du rate-limit Resend)

**Email envoyé** :
- Objet : "POPE Online — Votre période d'essai est terminée"
- CTA principal → pricing.html
- Lien secondaire → login.html (lecture seule)

### 2. Wording adapté selon l'espace dans pricing.html
**Fichier** : `frontend/pricing.html`

- Détecte automatiquement `localStorage.pope_account_space` ou param `?space=`
- **Espace public** : "Notes, délibérations, courriers institutionnels…"
- **Espace privé** : "Marchés, formalités, courriers métier…"
- Badge espace visible en haut de la grille
- Descriptions de plans et features adaptées selon l'espace
- CTA signup redirige vers signup-public.html ou signup-private.html

## Déploiement

```bash
git checkout staging
robocopy popeonline_v291_deploy\frontend frontend /E /IS /IT
robocopy popeonline_v291_deploy\backend backend /E /IS /IT
git add -A
git commit -m "feat: V29.1 - email fin essai, wording pricing adapté par espace"
git push origin staging
```

## Vérification du job trial

Dans **Render → Logs** après démarrage :
```
[trial-job] 0 compte(s) expiré(s)   ← normal si personne n'a expiré
```

Pour tester manuellement (Render Shell) :
```bash
node scripts/trial_expiry_mailer.js
```
