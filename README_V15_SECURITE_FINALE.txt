POPE Online V15 — durcissement sécurité final

Correctifs principaux :
- CORS désormais bloquant par défaut en production si CORS_ORIGIN n'est pas renseigné.
- Turnstile désormais obligatoire : plus de bypass silencieux si le secret manque.
- Session utilisateur déplacée sur cookie HttpOnly uniquement ; le JWT n'est plus exposé au JavaScript du navigateur.
- Durée de session réduite par défaut à 12h (paramétrable via SESSION_COOKIE_MAX_AGE_SECONDS et JWT_EXPIRES_IN).
- Ajout d'une invalidation réelle de session via session_version en base : logout, reset password et changement de mot de passe invalident les anciens jetons.
- Vérification serveur de la version de session dans le middleware d'authentification.
- Validation renforcée du contenu des fichiers uploadés (signature PDF/DOC, heuristique texte TXT/CSV).
- Rate limit global resserré.

Points de déploiement :
1. Exécuter backend/scripts/db_init.js pour ajouter session_version.
2. Renseigner impérativement en production :
   - CORS_ORIGIN=https://pope-online.com,https://www.pope-online.com
   - TURNSTILE_SECRET_KEY=...
   - SESSION_COOKIE_MAX_AGE_SECONDS=43200
   - JWT_EXPIRES_IN=12h
3. Redéployer le backend puis le frontend.
4. Tester login, verify, logout, reset password et upload de fichiers.
