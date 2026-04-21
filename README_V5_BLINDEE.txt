
POPE Online V5 blindée

Modifications principales :
- Ajout de CSP et HSTS côté backend et Netlify.
- Durcissement admin : suppression du mot de passe implicite admin12345, mot de passe requis >= 12 caractères, journalisation minimale des actions admin, restriction IP admin optionnelle via ADMIN_ALLOWED_IPS.
- Durcissement RGPD opérationnel : ajout des endpoints /auth/me/export et DELETE /auth/me.
- Suppression des artefacts POPY.
- Imports/exports limités aux formats TXT, DOC et CSV côté interface.
- Dépôt sécurisé 48h limité aux formats TXT, DOC et CSV.
- TXT et CSV uniquement analysables automatiquement par l'IA ; DOC conservé en pièce jointe sécurisée.
- Suppression des dossiers d'artefacts dist et node_modules du livrable.

Variables optionnelles nouvelles :
- ADMIN_ALLOWED_IPS=1.2.3.4,5.6.7.8

A conserver :
- SESSION_COOKIE_SAMESITE=None
- TURNSTILE_SECRET_KEY
- VITE_TURNSTILE_SITE_KEY
