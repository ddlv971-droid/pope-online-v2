# POPE Online V89.2 — Diagnostic flash : accueil allégé, articulation avec l'essai, anti-abus

Complète la V89 et la V89.1 (voir `README_V89.md` et `README_V89_1.md`).

## 1. Accueil : moins de défilement, un point d'entrée plus visible

- La grande section « diagnostic » de la V89.1 est retirée de l'accueil.
- Le simple lien souligné du bloc principal devient une **tuile aux couleurs du site** :
  pictogramme sapin, filet ocre, badge « Nouveau », « Diagnostic flash · gratuit ·
  2 min · sans inscription », accroche « Pas encore sûr de votre besoin ? Évaluez
  votre situation en 8 questions », flèche. Elle ouvre la page `diagnostic.html`.
- Rappel discret en bas de page, sous « Tester gratuitement » :
  « Pas encore prêt ? Commencez par le diagnostic flash, en 2 minutes → ».

## 2. Articulation « Tester gratuitement » / « Diagnostic flash »

Les deux offres ne se concurrencent pas, elles se suivent :

| Le visiteur… | Action proposée |
| --- | --- |
| sait ce qu'il veut demander | **Tester gratuitement 15 jours** (bouton principal, inchangé) |
| n'est pas encore sûr | **Diagnostic flash** (tuile secondaire, juste en dessous) |
| a fait le diagnostic | **« Utiliser mon Conseil Expert offert »** : création du compte d'essai, première demande pré-remplie |

- Résultat du diagnostic : le bouton principal devient « Utiliser mon Conseil Expert
  offert → », avec « Avec l'essai gratuit de 15 jours, 2 Conseils Expert vous sont
  offerts, sans carte bancaire : votre première demande est déjà pré-remplie ».
- Page d'inscription (`signup-public.html`) : si un diagnostic récent existe, un
  encadré « Votre diagnostic flash est prêt » rappelle le sujet, et la fonction et la
  taille de la commune sont pré-remplies.

## 3. Le diagnostic commence comme en V89

Écran d'accueil du diagnostic puis : profil, taille de la collectivité, domaine,
situation (avec « Ma situation est différente »), état, échéance, enjeux, besoin,
champ libre facultatif. Le lien `diagnostic.html?domaine=…` reste accepté : il
présélectionne le domaine.

## 4. Anti-abus

### Formulaire de rendez-vous du diagnostic (`POST /diagnostic`)

| Protection | Réglage |
| --- | --- |
| Limite par adresse IP | 8 demandes par heure (`trust proxy` déjà réglé pour Render) |
| Pot de miel | champ caché `website` |
| Délai minimal | formulaire envoyé moins de 3 s après son ouverture = ignoré |
| Cloudflare Turnstile | case anti-robot affichée si `VITE_TURNSTILE_SITE_KEY` est défini côté frontend ; jeton invalide = refus |
| Dédoublonnage | même e-mail ou téléphone dans les 15 minutes = pas de nouvel envoi |
| Contrôle des champs | téléphone (6 à 20 chiffres), liens interdits dans le nom et la collectivité |
| Accusé de réception à l'élu | envoyé seulement si la demande est vérifiée, 2 fois au plus par adresse en 24 h, 40 par heure au total |

Le dernier point empêche d'utiliser le formulaire pour envoyer des e-mails à des
tiers. Une demande non vérifiée est quand même enregistrée et transmise à l'équipe,
avec la mention « Vérification anti-robot : non ».

### Inscription

L'inscription vérifie déjà Turnstile, mais acceptait une demande **sans jeton**
(un robot pouvait donc passer). Nouvelle variable d'environnement côté API :

- `TURNSTILE_ENFORCE=true` : refus des inscriptions sans jeton.

À activer sur Render **après avoir vérifié** que la case anti-robot apparaît bien sur
`/signup-public` en production (variable `VITE_TURNSTILE_SITE_KEY` du frontend). Sinon
les inscriptions légitimes seraient bloquées.

### Déjà en place, inchangé

Limite générale 90 requêtes par minute et par IP ; connexion 12 essais / 15 min ;
inscription, vérification et mot de passe oublié 20 / 15 min ; IA et coffre
15 / min ; formulaire de contact 8 / h avec pot de miel. Les compteurs sont gardés en
mémoire : ils repartent à zéro à chaque redémarrage du serveur et ne sont pas
partagés si l'API tourne un jour sur plusieurs instances.

## Fichiers modifiés

`frontend/index.html`, `frontend/site-v88.css`, `frontend/diagnostic.js`,
`frontend/signup-public.html`, `frontend/public/site-config.js` (version `V89.2`),
`backend/routes/diagnostic.js`, `backend/routes/auth.js`, `backend/server.js`
(`/health` → `v89.2`). Aucun changement de base de données.

## Tests réalisés

Chromium ordinateur et mobile : tuile → page du diagnostic, ordre des questions V89,
« Ma situation est différente », prise de rendez-vous et requête envoyée, encadré et
pré-remplissage de l'inscription, pré-remplissage du tableau de bord, aucun
débordement, aucune erreur JavaScript, `vite build` correct. Route `/diagnostic` :
envoi trop rapide ignoré, téléphone invalide et lien dans le nom refusés, jeton
Turnstile invalide refusé (403), jeton valide accepté, 9e demande dans l'heure
refusée (429).
