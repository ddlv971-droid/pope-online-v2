# POPE Online V89.1 — Diagnostic flash : accueil, situations, rendez-vous

Complète la V89 (voir `README_V89.md`). Trois évolutions demandées le 13 octobre 2026.

## 1. Présentation sur la page d'accueil

L'ancien encart a été remplacé par une section complète (`#diagnostic`), placée avant
« Quatre sujets… », construite sur les principes des meilleures pages de quiz et
d'auto-évaluation en ligne :

- **promesse chiffrée** dès le titre : « Une situation délicate ? En 2 minutes, sachez
  ce qu'elle implique. », avec les badges Nouveau · Gratuit · 2 minutes · sans inscription ;
- **la première question est posée directement sur l'accueil** : les 10 domaines sont
  des boutons ; un clic ouvre le diagnostic à la question 2, le domaine déjà choisi
  (`diagnostic.html?domaine=mp`). Commencer à répondre est l'engagement le plus
  efficace : l'effort perçu disparaît ;
- **aperçu du résultat** (carte « Exemple de résultat ») : le visiteur voit ce qu'il
  obtiendra avant de commencer (vigilance, points examinés, recommandation, demande
  pré-remplie) ;
- **réassurance** : « Calculé sur votre appareil : rien n'est transmis sans votre accord » ;
- **3 étapes** : répondre, recevoir le diagnostic, passer à l'action.

Le lien du bloc principal de l'accueil mène désormais à cette section.

## 2. Question « Plus précisément, votre situation est… »

Les 4 à 5 situations proposées par domaine sont les plus fréquentes, mais ne couvrent
pas tous les cas. Solution :

- chaque domaine propose en dernier choix **« Ma situation est différente »** (cadre en
  pointillés) ; un champ « Décrivez votre situation en une phrase » s'ouvre aussitôt
  (5 caractères minimum pour continuer) ;
- la phrase de l'élu devient le **titre du diagnostic** et de la demande pré-remplie ;
  les points examinés et les pièces à rassembler sont les points génériques du domaine
  (`GENERIC` dans `diagnostic-tree.js`), avec une alerte : « un expert du domaine lira
  votre description » ;
- le domaine « Autre sujet » passe directement à la description libre ;
- l'aide sous la question l'annonce : « Rien ne correspond ? Choisissez… ».

Le compteur affiche « Question X sur 8 », puis « Dernière étape, facultative » pour le
champ libre, avec le temps restant estimé.

## 3. Prise de rendez-vous

La dernière étape (« Prendre rendez-vous avec un conseiller ») reprend les codes des
agendas en ligne de référence :

- choix **Appel téléphonique / Visioconférence**, durée affichée (15 min, gratuit, sans
  engagement) ;
- **« Prochaine disponibilité »** en un clic ;
- **calendrier mensuel** (jours ouvrés disponibles en surbrillance, aujourd'hui marqué) et
  **créneaux Matin / Après-midi** ;
- **fuseau horaire détecté** automatiquement et modifiable (Hexagone, Antilles, Guyane,
  Réunion, Mayotte, Saint-Pierre-et-Miquelon, Nouvelle-Calédonie, Polynésie,
  Wallis-et-Futuna) ; l'heure de Paris correspondante est rappelée ;
- **récapitulatif** du créneau avec « Modifier », progression Créneau → Coordonnées →
  Confirmation ;
- téléphone obligatoire pour un appel, e-mail obligatoire pour une visio ;
- **confirmation animée** avec « Ajouter à mon agenda (.ics) » et « Google Agenda ».

C'est une **demande de créneau** : l'équipe la reçoit par e-mail et la confirme à l'élu.
Il n'y a pas de synchronisation avec un agenda réel ; si l'équipe adopte plus tard un
outil (Cal.com, Calendly…), on pourra y brancher ce composant.

**Horaires** : réglables dans `public/site-config.js`, clé `callback` (par défaut du lundi
au vendredi, 8 h 30 – 12 h et 13 h 30 – 18 h, pas de 30 min, au moins 2 h à l'avance,
sur 21 jours ouvrés). Ces heures s'entendent **dans l'heure locale de l'élu** : un élu de
Guadeloupe peut demander 17 h (23 h à Paris). À valider avec l'équipe selon qui
assure les rappels.

## Backend

- `POST /diagnostic` accepte `slot_at` (date ISO, entre maintenant et 90 jours),
  `timezone` et `contact_mode` (`phone` ou `visio`) ; refus `email_required_for_visio`.
- E-mail à l'équipe : « Rendez-vous demandé : … — visio/appel » ; accusé de réception à
  l'élu avec le créneau demandé.
- `GET /admin/diagnostics` renvoie ces champs et trie par urgence puis par créneau.
- `schema_patch_v93.sql` : colonnes `slot_at`, `timezone`, `contact_mode` et index
  (ajouts idempotents, rejoués au démarrage).

## Fichiers

| Fichier | Statut |
| --- | --- |
| `frontend/booking.js` | nouveau : composant de prise de rendez-vous |
| `frontend/diagnostic.js` | modifié : ordre des questions, situation libre, rendez-vous |
| `frontend/diagnostic-tree.js` | modifié : `OTHER_SITUATION`, `GENERIC` |
| `frontend/diagnostic.css` | modifié : styles V89.1 |
| `frontend/index.html`, `frontend/site-v88.css` | modifiés : section d'accueil |
| `frontend/public/site-config.js` | version `V89.1`, clé `callback` |
| `backend/routes/diagnostic.js`, `backend/db/schema_patch_v93.sql` | modifiés |

## Tests réalisés

Chromium, ordinateur (fuseau Guadeloupe) et mobile 390 px : section d'accueil, accès
direct par domaine, « Ma situation est différente » (bouton bloqué sans description),
prochaine disponibilité, changement de fuseau (Mayotte 10 h = 9 h à Paris ; Antilles
14 h = 20 h à Paris), visio refusée sans e-mail, requête envoyée vérifiée (`slot_at`,
`timezone`, `contact_mode`), confirmation et liens d'agenda, pré-remplissage du tableau
de bord, aucun débordement horizontal, aucune erreur JavaScript, `vite build` correct.
