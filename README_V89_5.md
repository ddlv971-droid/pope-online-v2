# POPE Online V89.5 — Rendez-vous : fenêtre conseiller, tableau de bord admin

Complète les V89 à V89.4 (voir les README correspondants).

## 1. Fenêtre « Parler à un conseiller » (toutes les pages publiques)

- Mise en page à deux volets, à l'image de la page de connexion : à gauche, volet vert
  sapin sur la photo du site, logo, « Un conseiller, au moment qui vous arrange », trois
  engagements, numéro de téléphone sur une seule ligne, lien devis ; à droite, le
  formulaire. Sur mobile, le volet se réduit à un bandeau avec le numéro.
- Un seul choix « comment échanger », en trois cartes : Être rappelé, Visioconférence,
  Question écrite. Le menu déroulant et la bascule appel / visio du calendrier ont
  disparu (le menu reste caché dans la page, pour l'envoi).
- Le calendrier ne s'affiche que pour un rappel ou une visio ; pour une question écrite,
  l'e-mail et la question sont demandés, et le bouton devient « Envoyer ma question ».
- Le numéro de téléphone ne passe plus à la ligne.

## 2. Accueil

- « Comment ça marche ? » : chiffres 1, 2, 3 entourés (cercle ocre).
- Échanges du bloc principal : filigrane d'un hôtel de ville dans la question de l'élu,
  arbre de Pope Online dans la réponse de l'expert.

## 3. Administration : onglet « Rendez-vous »

Nouvel onglet dans `dashboard-admin.html`, en plus des e-mails reçus :

- pastille du nombre de rendez-vous à confirmer dans le menu ;
- indicateurs : à confirmer, aujourd'hui, 7 prochains jours, sans conseiller ;
- agenda groupé par jour (Aujourd'hui, Demain, …), heures dans le fuseau de
  l'administrateur et heure chez l'élu (outre-mer) ; appel ou visio ; origine
  (diagnostic flash avec niveau de vigilance et mention « Urgent », ou « Parler à un
  conseiller ») ;
- filtres : à venir, à confirmer, passés, tous ; par conseiller (dont « non attribués ») ;
  recherche ;
- « Avec » : désignation du conseiller directement dans la liste (administrateurs et
  experts) ;
- fiche détaillée : appel et e-mail en un clic, créneau (Paris et heure de l'élu),
  diagnostic, message, statut (à confirmer, confirmé, terminé, annulé, absent),
  conseiller, report du créneau, mode, notes internes ;
- à la confirmation : envoi facultatif au demandeur d'un e-mail de confirmation avec le
  nom du conseiller et un fichier d'agenda (.ics), et au conseiller désigné du
  rendez-vous complet avec fichier d'agenda.

API (administrateurs uniquement) :

| Route | Rôle |
| --- | --- |
| `GET /admin/appointments` | demandes de rendez-vous des 120 derniers jours et à venir |
| `PATCH /admin/appointments/:kind/:id` | statut, conseiller, créneau, mode, notes ; `notifyClient`, `notifyAdvisor` |
| `GET /admin/team` | administrateurs et experts pouvant recevoir un rendez-vous |

`kind` vaut `diag` (diagnostic flash) ou `contact` (fenêtre conseiller).

## Base de données

`backend/db/schema_patch_v94.sql` (idempotent, appliqué par `db_init.js` et au
démarrage) : `contact_requests` reçoit `slot_at`, `timezone`, `contact_mode`,
`assigned_to`, `notes`, `updated_at` ; `diag_flash_requests` reçoit `assigned_to`,
`notes`, `updated_at`. Le formulaire conseiller enregistre désormais le créneau précis.

## Fichiers

| Fichier | Statut |
| --- | --- |
| `frontend/admin-rdv.js` | nouveau : onglet Rendez-vous |
| `frontend/dashboard-admin.html` | onglet, styles, chargement |
| `frontend/contact-booking.js`, `frontend/booking.css`, `frontend/booking.js` | fenêtre conseiller |
| `frontend/site-v88.css` | chiffres entourés, filigranes des échanges |
| `frontend/public/site-config.js` | version `V89.5` |
| `backend/routes/appointments.js` | nouveau |
| `backend/db/schema_patch_v94.sql` | nouveau |
| `backend/routes/contact.js`, `backend/server.js`, `backend/scripts/db_init.js` | modifiés |

## Tests réalisés

- API sur une base PostgreSQL locale, schéma complet (`db_init.js`) : liste, équipe,
  attribution, refus d'un conseiller qui n'est ni administrateur ni expert, statut
  invalide refusé, report, accès refusé sans session administrateur ; contenu des
  e-mails de confirmation et du conseiller et des fichiers d'agenda vérifié.
- Interface d'administration réelle (connexion administrateur, API locale) : pastille,
  indicateurs, filtres, attribution dans la liste, confirmation depuis la fiche.
- Site compilé, Chromium ordinateur et mobile : fenêtre conseiller (trois modes, envoi,
  confirmation, réouverture), diagnostic complet, aucune erreur JavaScript.
