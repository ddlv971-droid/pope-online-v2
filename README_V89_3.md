# POPE Online V89.3 — Filigrane du diagnostic, rendez-vous « Parler à un conseiller »

Complète les V89, V89.1 et V89.2 (voir les README correspondants).

## 1. Logo arbre en filigrane sur la page du diagnostic

Le logo arbre de Pope Online (le même que sur l'accueil) est placé en filigrane, en
grand, derrière la carte du diagnostic : la frondaison déborde de part et d'autre de
la carte, le tronc apparaît dessous. Il est masqué à l'impression.
Réglage : `.dg-watermark` dans `frontend/diagnostic.css` (taille, opacité).

## 2. « Parler à un conseiller » : la même prise de rendez-vous que le diagnostic

Le champ texte « Créneau souhaité » (puis la bande de jours de la V88) est remplacé,
dans la fenêtre « Parler à un conseiller » de toutes les pages publiques (accueil,
Pour qui ?, Qui sommes-nous ?, Tarifs, Charte de déontologie), par le composant du
diagnostic flash :

- étapes Créneau → Coordonnées → Confirmation ;
- appel téléphonique ou visioconférence, synchronisé avec « Votre demande » ;
- « Prochaine disponibilité » en un clic, calendrier mensuel, créneaux matin et
  après-midi, fuseau détecté (Hexagone et outre-mer) avec l'heure de Paris rappelée ;
- récapitulatif avec « Modifier » ;
- téléphone requis pour un appel, e-mail requis pour une visio ;
- confirmation animée avec « Ajouter à mon agenda (.ics) » et « Google Agenda » ;
- pour « Poser une question sur le service », pas de calendrier.

Les horaires sont les mêmes que pour le diagnostic : clé `callback` de
`public/site-config.js`. Un lien d'agenda externe (`bookingUrl`) reste possible.

Technique : `booking.js` + `booking.css` (composant commun), `contact-booking.js`
(branchement sur la fenêtre de contact, sans modifier son envoi). L'ancien
`public/slot-picker.js` est supprimé.

## 3. Anti-abus étendu au formulaire de contact et aux devis

Le formulaire de contact envoyait lui aussi un accusé de réception à l'adresse saisie,
sans contrôle. Il applique désormais les mêmes règles que le diagnostic, regroupées
dans `backend/services/antiabuse.js` : délai minimal de saisie, Turnstile si
configuré (jeton invalide = refus), téléphone contrôlé, liens interdits dans le nom et
la collectivité, e-mail requis pour une visio, dédoublonnage 15 min, accusé de
réception au plus 3 fois par adresse en 24 h et 40 fois par heure au total.
Une demande non vérifiée est toujours transmise à l'équipe, sans accusé de réception.

## Fichiers

| Fichier | Statut |
| --- | --- |
| `frontend/booking.css` | nouveau (styles sortis de `diagnostic.css`) |
| `frontend/contact-booking.js` | nouveau |
| `frontend/booking.js` | modifié : import des styles, `setMode()` |
| `frontend/diagnostic.html`, `diagnostic.css` | filigrane |
| `frontend/index.html`, `about.html`, `deontologie.html`, `elus.html`, `pricing.html` | nouveau script, texte de la fenêtre |
| `frontend/public/slot-picker.js` | supprimé |
| `frontend/public/site-config.js` | version `V89.3` |
| `backend/services/antiabuse.js` | nouveau |
| `backend/routes/contact.js`, `backend/routes/diagnostic.js` | anti-abus commun |
| `backend/server.js` | `/health` → `v89.3` |

Aucun changement de base de données.

## Tests réalisés

Site compilé (`vite build`) testé dans Chromium, ordinateur et mobile : filigrane,
parcours complet du diagnostic, fenêtre de contact sur l'accueil et la page Tarifs
(créneau obligatoire, téléphone requis pour un appel, synchronisation sujet / mode,
requête envoyée avec créneau, fuseau et mode, confirmation et liens d'agenda,
réouverture, sujet « question » sans calendrier), aucune erreur JavaScript, aucun
débordement. Routes : contact et diagnostic (envoi trop rapide ignoré, téléphone
invalide, lien, visio sans e-mail, jeton invalide refusés ; devis accepté).
