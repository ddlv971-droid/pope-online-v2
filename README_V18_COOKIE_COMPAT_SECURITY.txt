POPE Online V18 — correctif de compatibilité session/cookies

Objectif
- conserver le renforcement sécurité de la V15+ (cookie HttpOnly, session_version, invalidation de session)
- rétablir la robustesse observée en V14 sur les environnements où le cookie cross-site peut être refusé ou retardé

Correctifs
- retour d'un token JWT de secours dans la réponse de login
- stockage limité à sessionStorage côté navigateur (pas de localStorage pour le jeton)
- envoi automatique du header Authorization sur les appels API quand ce jeton de secours existe
- middleware backend compatible cookie HttpOnly OU Bearer token
- auth-guard et liens protégés compatibles avec ce mode de secours

Impact
- le cookie HttpOnly reste prioritaire
- si le navigateur mobile/responsive ne renvoie pas immédiatement le cookie cross-site, la session reste stable dans l'onglet courant
- le logout et l'invalidation par session_version restent actifs

Variables recommandées
- SESSION_COOKIE_SAMESITE=None
- NODE_ENV=production derrière HTTPS
- CORS_ORIGIN strictement aligné sur le domaine frontend
