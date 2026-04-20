VERSION CORRIGEE - Archive Premium

Correctifs appliqués par rapport à la version jointe :
- suppression des marqueurs de conflits Git restants (HEAD/staging)
- conservation de la branche fonctionnelle la plus récente et sécurisée
- suppression des références POPY restantes
- suppression des dossiers non déployables inclus par erreur (frontend/dist, backend/node_modules)
- configuration Netlify propre pour Vite
- version sécurisée avec cookies de session HttpOnly, Turnstile côté serveur et correction SameSite=None pour Netlify/Render
- package-lock frontend propre sans registre npm interne

Variables d'environnement à vérifier avant déploiement :
- Netlify : VITE_API_URL, VITE_TURNSTILE_SITE_KEY
- Render : DATABASE_URL, JWT_SECRET, CORS_ORIGIN, FRONTEND_BASE_URL, TURNSTILE_SECRET_KEY, SESSION_COOKIE_SAMESITE=None
