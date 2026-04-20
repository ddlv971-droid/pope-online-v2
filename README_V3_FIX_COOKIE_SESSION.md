POPE Online V3 — correctif cookie de session

Correctif principal
- le cookie de session backend est désormais émis en SameSite=None en production, avec Secure, afin d'être renvoyé correctement sur les appels cross-site Netlify -> Render avec credentials: include.

Impact
- correction du bug de déconnexion lors des actions protégées après connexion (génération, relecture experte, accompagnement sur mesure)

Variables
- SESSION_COOKIE_SAMESITE=None recommandé en staging et en production lorsque le frontend et le backend sont sur des domaines différents.
