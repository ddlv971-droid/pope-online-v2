V22 correctif staging/front-back

Correctifs appliqués:
1. frontend/api.js : suppression du double 'const envApiBase' qui cassait le build Vite et empêchait la prise en compte de VITE_API_URL.
2. frontend/api.js : priorite propre a VITE_API_URL, avec fallback prod uniquement si la variable n'est pas definie.
3. frontend/.npmrc : forçage du registre npm public.
4. frontend/netlify.toml : build Netlify force vers registry.npmjs.org pour éviter le timeout sur le registre privé.
5. frontend/package-lock.json supprime : ce fichier contenait des URLs internes non accessibles depuis Netlify.

A faire sur Netlify staging:
- Variable VITE_API_URL = https://popeonline-staging.onrender.com
- Clear cache and deploy site

A faire sur Render staging:
- CORS_ORIGIN = https://popeonline-staging.netlify.app
