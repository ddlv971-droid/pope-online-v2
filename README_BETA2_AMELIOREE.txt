
POPE ONLINE — BETA 2 AMÉLIORÉE

Principales évolutions intégrées
- Correction du bouton Paramétrer des cookies avec véritable fenêtre de préférences.
- Icône d’affichage du mot de passe visible sur les formulaires.
- Nouvelle page offre-gratuite.html avec déclinaison public / privé.
- Création de compte enrichie avec sélecteur téléphonique international type SaaS.
- Nouvel espace client privé : dashboard-private.html avec formulaire de besoin et accusé de réception.
- Nouveau profil modifiable : profile.html.
- Nouveau dashboard administrateur : dashboard-admin.html.
- Backend enrichi : gestion profil, changement de mot de passe, administration utilisateurs, messages clients.
- Compte administrateur par défaut au seed DB : POPADMIN / admin (email technique admin@pope-online.local), avec changement obligatoire du mot de passe à la première connexion.

Conseils de mise en service
1. Frontend : déployer le dossier frontend.
2. Backend : lancer npm install puis npm start dans /backend.
3. Vérifier les variables d’environnement : DATABASE_URL, JWT_SECRET, FRONTEND_BASE_URL, MAIL_TO, MAIL_FROM, MAIL_PROVIDER, MAIL_API_KEY, CORS_ORIGIN.
4. À la première connexion admin, aller dans Mon compte et changer le mot de passe.


Mise à jour complémentaire : offre gratuite unifiée, connexion discrète admin depuis la page login, double champ téléphone visible.
